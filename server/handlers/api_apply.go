package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/enowdev/enowx/core/localcreds"
	"github.com/enowdev/enowx/store"
)

// Apply writes a pool account's credentials back to the local IDE/CLI auth file
// and optionally relaunches that app. Supported for kiro and codex.
type Apply struct {
	store store.AccountStore
}

func NewApply(s store.AccountStore) *Apply { return &Apply{store: s} }

// POST /api/accounts/{id}/apply  { "target": "desktop"|"cli", "launch": true }
func (h *Apply) Apply(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		writeAPIErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	var in struct {
		Target string `json:"target"`
		Launch *bool  `json:"launch"`
	}
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &in)
	target := strings.ToLower(strings.TrimSpace(in.Target))
	if target == "" {
		target = "desktop"
	}
	if target != "desktop" && target != "cli" {
		writeAPIErr(w, http.StatusBadRequest, "target must be desktop or cli")
		return
	}
	launch := in.Launch == nil || *in.Launch // default true

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
	if !localcreds.SupportsApply(acc.Provider) {
		writeAPIErr(w, http.StatusBadRequest, "apply is only supported for Kiro and Codex")
		return
	}
	if len(acc.Creds) == 0 {
		writeAPIErr(w, http.StatusBadRequest, "account credentials are not available locally")
		return
	}

	// The refresh_token written here lets the IDE/CLI refresh its own tokens.
	path, err := localcreds.Apply(acc.Provider, acc.Creds, target)
	if err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}

	out := map[string]any{"applied": true, "target_path": path, "action": "applied"}
	if launch {
		if spec, ok := localcreds.AppSpecFor(acc.Provider, target); ok {
			if action, lerr := localcreds.RelaunchApp(spec); lerr != nil {
				out["action"] = "applied_launch_failed"
				out["launch_error"] = lerr.Error()
			} else {
				out["action"] = action
			}
		}
	}
	out["message"] = applyMessage(out["action"].(string), acc.Provider, target)
	writeData(w, out)
}

func applyMessage(action, provider, target string) string {
	name := strings.Title(provider)
	if target == "cli" {
		name += " CLI"
	}
	switch action {
	case "restarted":
		return name + " relaunched with this account"
	case "launched":
		return name + " launched with this account"
	case "applied_launch_failed":
		return "Auth file written, but launching " + name + " failed"
	default:
		return "Auth file written for " + name
	}
}
