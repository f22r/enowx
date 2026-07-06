package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/enowdev/enowx/core/localcreds"
	"github.com/enowdev/enowx/store"
)

// Accounts is the management API over the credential pool.
type Accounts struct {
	store   store.AccountStore
	warmer  Warmer
	onWrite func() // fire-and-forget: push local changes to the cloud now
	// donate hands an account's creds to the cloud Free-AI pool; returns the
	// cloud's raw JSON reply (nil disables the feature — not syncing).
	donate func(ctx context.Context, provider string, creds map[string]string, models []string) (string, error)
}

func NewAccounts(s store.AccountStore) *Accounts { return &Accounts{store: s} }

// SetDonate wires the Free-AI donation call (via the sync manager).
func (h *Accounts) SetDonate(f func(ctx context.Context, provider string, creds map[string]string, models []string) (string, error)) {
	h.donate = f
}

// SetWarmer enables automatic warmup of newly-added accounts.
func (h *Accounts) SetWarmer(w Warmer) { h.warmer = w }

// SetSyncPush registers a callback that pushes local account changes to the
// cloud immediately. Called after a delete so the deletion's tombstone lands
// before the next background pull can re-add the account (bug: deleted accounts
// coming back). A no-op if the user isn't syncing.
func (h *Accounts) SetSyncPush(f func()) { h.onWrite = f }

type accountDTO struct {
	ID        int64    `json:"id"`
	Provider  string   `json:"provider"`
	Label     string   `json:"label"`
	Status    string   `json:"status"`
	Disabled  bool     `json:"disabled"`
	Has       []string `json:"has"` // credential keys present (never the values)
	CanApply  bool     `json:"can_apply"` // creds can be written to a local IDE/CLI
	CreatedAt string   `json:"created_at"`
}

func toDTO(a store.Account) accountDTO {
	has := make([]string, 0, len(a.Creds)+1)
	if a.Secret != "" {
		has = append(has, "secret")
	}
	for k := range a.Creds {
		has = append(has, k)
	}
	return accountDTO{
		ID:        a.ID,
		Provider:  a.Provider,
		Label:     a.Label,
		Status:    a.Status,
		Disabled:  a.Disabled,
		Has:       has,
		CanApply:  localcreds.SupportsApply(a.Provider) && len(a.Creds) > 0,
		CreatedAt: a.CreatedAt.Format("2006-01-02 15:04"),
	}
}

func (h *Accounts) List(w http.ResponseWriter, r *http.Request) {
	provider := r.URL.Query().Get("provider")
	rows, err := h.store.List(r.Context(), provider)
	if err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	out := make([]accountDTO, 0, len(rows))
	for _, a := range rows {
		out = append(out, toDTO(a))
	}
	writeData(w, out)
}

type addAccountReq struct {
	Provider string            `json:"provider"`
	Label    string            `json:"label"`
	Secret   string            `json:"secret"`
	Creds    map[string]string `json:"creds"`
}

func (h *Accounts) Add(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body)
	var in addAccountReq
	if err := json.Unmarshal(body, &in); err != nil || in.Provider == "" {
		writeAPIErr(w, http.StatusBadRequest, "provider is required")
		return
	}
	if in.Secret == "" && len(in.Creds) == 0 {
		writeAPIErr(w, http.StatusBadRequest, "a secret or credentials are required")
		return
	}
	id, err := h.store.Add(r.Context(), store.Account{
		Provider: in.Provider,
		Label:    in.Label,
		Secret:   in.Secret,
		Creds:    in.Creds,
		Status:   "active",
	})
	if err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	// Auto-warmup before the account enters the pool (credit check + test
	// request); the result is included so the UI can show it immediately. Bulk
	// importers pass ?warmup=0 to skip it (warming hundreds of accounts inline is
	// slow + rate-limited; the user can Warm all afterwards).
	out := map[string]any{"id": id}
	if q := r.URL.Query().Get("warmup"); q != "0" && q != "false" {
		if warm := autoWarm(r.Context(), h.warmer, h.store, id); warm != nil {
			out["warmup"] = warm
		}
	}
	writeData(w, out)
}

type setStatusReq struct {
	Status string `json:"status"`
}

func (h *Accounts) SetStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeAPIErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in setStatusReq
	body, _ := io.ReadAll(r.Body)
	if err := json.Unmarshal(body, &in); err != nil || in.Status == "" {
		writeAPIErr(w, http.StatusBadRequest, "status is required")
		return
	}
	if err := h.store.SetStatus(r.Context(), id, in.Status); err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeData(w, map[string]any{"ok": true})
}

func (h *Accounts) SetDisabled(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeAPIErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in struct {
		Disabled bool `json:"disabled"`
	}
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &in)
	if err := h.store.SetDisabled(r.Context(), id, in.Disabled); err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeData(w, map[string]any{"ok": true})
}

// Donate hands a local account's credentials to the cloud Free-AI pool, then —
// on success — deletes it locally (it now lives in the shared pool). The client
// supplies the models this account should serve.
func (h *Accounts) Donate(w http.ResponseWriter, r *http.Request) {
	if h.donate == nil {
		writeAPIErr(w, http.StatusServiceUnavailable, "sign in to the cloud to donate accounts")
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeAPIErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in struct {
		Models []string `json:"models"`
	}
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<14))
	_ = json.Unmarshal(body, &in)

	// Find the account (with creds) by id.
	rows, err := h.store.List(r.Context(), "")
	if err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	var acc *store.Account
	for i := range rows {
		if rows[i].ID == id {
			acc = &rows[i]
			break
		}
	}
	if acc == nil {
		writeAPIErr(w, http.StatusNotFound, "account not found")
		return
	}
	// Assemble the credential map (secret folds into api_key for single-token).
	creds := map[string]string{}
	for k, v := range acc.Creds {
		creds[k] = v
	}
	if acc.Secret != "" {
		if _, ok := creds["api_key"]; !ok {
			creds["api_key"] = acc.Secret
		}
	}
	raw, err := h.donate(r.Context(), acc.Provider, creds, in.Models)
	if err != nil {
		writeAPIErr(w, http.StatusBadGateway, err.Error())
		return
	}
	// Success → remove locally so it only lives in the shared pool.
	if err := h.store.Delete(r.Context(), id); err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if h.onWrite != nil {
		go h.onWrite()
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"data":` + raw + `}`))
}

func (h *Accounts) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeAPIErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := h.store.Delete(r.Context(), id); err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	// Propagate the deletion to the cloud now (tombstone push) so a background
	// pull can't resurrect it. Non-blocking; no-op when the user isn't syncing.
	if h.onWrite != nil {
		go h.onWrite()
	}
	writeData(w, map[string]any{"ok": true})
}
