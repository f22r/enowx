package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/enowdev/enowx/core/sanitize"
	syncpkg "github.com/enowdev/enowx/core/sync"
	"github.com/enowdev/enowx/server/middleware"
	"github.com/enowdev/enowx/store"
)

// Filters manages content-filter rules (pattern→replacement) that obfuscate
// request text upstream and restore it downstream, plus community templates.
type Filters struct {
	dash  *middleware.Dashboard
	store store.FilterStore
	mgr   *syncpkg.Manager
}

func NewFilters(dash *middleware.Dashboard, s store.FilterStore, mgr *syncpkg.Manager) *Filters {
	f := &Filters{dash: dash, store: s, mgr: mgr}
	f.reload() // load rules into the engine on startup
	return f
}

// reload pushes the active DB rules into the sanitize engine.
func (h *Filters) reload() {
	list, err := h.store.List(context.Background())
	if err != nil {
		return
	}
	rules := make([]sanitize.Rule, 0, len(list))
	for _, f := range list {
		if f.IsActive {
			rules = append(rules, sanitize.Rule{Pattern: f.Pattern, Replacement: f.Replacement, Regex: f.IsRegex})
		}
	}
	sanitize.SetRules(rules)
}

func (h *Filters) guard(w http.ResponseWriter, r *http.Request) bool {
	if !h.dash.Authorized(r) {
		writeAPIErr(w, http.StatusForbidden, "requires the dashboard login when accessed remotely")
		return false
	}
	return true
}

func (h *Filters) List(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	list, err := h.store.List(r.Context())
	if err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeData(w, map[string]any{"filters": list})
}

type filterBody struct {
	Pattern     string `json:"pattern"`
	Replacement string `json:"replacement"`
	IsRegex     bool   `json:"is_regex"`
	IsActive    bool   `json:"is_active"`
}

func (h *Filters) Add(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	var b filterBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || strings.TrimSpace(b.Pattern) == "" {
		writeAPIErr(w, http.StatusBadRequest, "pattern is required")
		return
	}
	pat := strings.TrimSpace(b.Pattern)
	id, err := h.store.Add(r.Context(), store.ContentFilter{
		Pattern: pat, Replacement: b.Replacement, IsRegex: sanitize.LooksRegex(pat), IsActive: b.IsActive,
	})
	if err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.reload()
	writeData(w, map[string]any{"id": id})
}

func (h *Filters) Update(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var b filterBody
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeAPIErr(w, http.StatusBadRequest, "bad body")
		return
	}
	pat := strings.TrimSpace(b.Pattern)
	if err := h.store.Update(r.Context(), store.ContentFilter{
		ID: id, Pattern: pat, Replacement: b.Replacement, IsRegex: sanitize.LooksRegex(pat), IsActive: b.IsActive,
	}); err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.reload()
	writeData(w, map[string]any{"ok": true})
}

func (h *Filters) Delete(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err := h.store.Delete(r.Context(), id); err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.reload()
	writeData(w, map[string]any{"ok": true})
}

// ListTemplates returns the saved named filter sets.
func (h *Filters) ListTemplates(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	list, err := h.store.ListTemplates(r.Context())
	if err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeData(w, map[string]any{"templates": list})
}

// SaveTemplate snapshots the current active filters under a name.
func (h *Filters) SaveTemplate(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	var b struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || strings.TrimSpace(b.Name) == "" {
		writeAPIErr(w, http.StatusBadRequest, "name is required")
		return
	}
	cur, err := h.store.List(r.Context())
	if err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := h.store.SaveTemplate(r.Context(), strings.TrimSpace(b.Name), cur); err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeData(w, map[string]any{"ok": true})
}

// LoadTemplate replaces the active filters with a template's set.
func (h *Filters) LoadTemplate(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	name := chi.URLParam(r, "name")
	rules, err := h.store.LoadTemplate(r.Context(), name)
	if err != nil {
		writeAPIErr(w, http.StatusNotFound, "template not found")
		return
	}
	// Merge: keep existing rules, add the template's, skip duplicate patterns.
	if err := h.store.MergeAll(r.Context(), rules); err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.reload()
	writeData(w, map[string]any{"ok": true})
}

// DeleteTemplate removes a saved template.
func (h *Filters) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	if err := h.store.DeleteTemplate(r.Context(), chi.URLParam(r, "name")); err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeData(w, map[string]any{"ok": true})
}

// --- community templates (proxied to the cloud) ---

// CommunityList browses the public community templates.
func (h *Filters) CommunityList(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	out, err := h.mgr.CommunityFilterTemplates(r.Context(), r.URL.RawQuery)
	if err != nil {
		writeAPIErr(w, http.StatusBadGateway, err.Error())
		return
	}
	proxyJSON(w, out, nil)
}

// CommunityPublish publishes the current local filter set to the community.
func (h *Filters) CommunityPublish(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	var b struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil || strings.TrimSpace(b.Name) == "" {
		writeAPIErr(w, http.StatusBadRequest, "name is required")
		return
	}
	cur, err := h.store.List(r.Context())
	if err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	rules := make([]map[string]any, 0, len(cur))
	for _, f := range cur {
		rules = append(rules, map[string]any{"pattern": f.Pattern, "replacement": f.Replacement, "is_regex": f.IsRegex})
	}
	out, err := h.mgr.PublishFilterTemplate(r.Context(), map[string]any{
		"name": strings.TrimSpace(b.Name), "description": b.Description, "rules": rules,
	})
	if err != nil {
		writeAPIErr(w, http.StatusBadGateway, err.Error())
		return
	}
	proxyJSON(w, out, nil)
}

// CommunityInstall fetches a community template's rules and merges them locally.
func (h *Filters) CommunityInstall(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	raw, err := h.mgr.InstallCommunityFilterTemplate(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeAPIErr(w, http.StatusBadGateway, err.Error())
		return
	}
	var payload struct {
		Rules []struct {
			Pattern     string `json:"pattern"`
			Replacement string `json:"replacement"`
			IsRegex     bool   `json:"is_regex"`
		} `json:"rules"`
	}
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		writeAPIErr(w, http.StatusBadGateway, "bad template payload")
		return
	}
	rules := make([]store.ContentFilter, 0, len(payload.Rules))
	for _, ru := range payload.Rules {
		p := strings.TrimSpace(ru.Pattern)
		if p == "" {
			continue
		}
		rules = append(rules, store.ContentFilter{Pattern: p, Replacement: ru.Replacement, IsRegex: sanitize.LooksRegex(p), IsActive: true})
	}
	if err := h.store.MergeAll(r.Context(), rules); err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	h.reload()
	writeData(w, map[string]any{"installed": len(rules)})
}

// CommunityDelete removes a community template the user owns.
func (h *Filters) CommunityDelete(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	if err := h.mgr.DeleteCommunityFilterTemplate(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeAPIErr(w, http.StatusBadGateway, err.Error())
		return
	}
	writeData(w, map[string]any{"ok": true})
}
