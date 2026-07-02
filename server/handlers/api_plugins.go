package handlers

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/enowdev/enowx/core/plugins"
	"github.com/enowdev/enowx/server/middleware"
)

// Plugins manages user-built sidecar plugins. Plugins run with the user's full
// privileges, so every management endpoint is dashboard-gated.
type Plugins struct {
	dash *middleware.Dashboard
	mgr  *plugins.Manager
}

func NewPlugins(dash *middleware.Dashboard, mgr *plugins.Manager) *Plugins {
	return &Plugins{dash: dash, mgr: mgr}
}

func (h *Plugins) guard(w http.ResponseWriter, r *http.Request) bool {
	if !h.dash.Authorized(r) {
		writeAPIErr(w, http.StatusForbidden, "plugins require the dashboard login when accessed remotely")
		return false
	}
	return true
}

// GET /api/plugins -> { plugins, runtimes }
func (h *Plugins) List(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	writeData(w, map[string]any{
		"plugins":  h.mgr.List(),
		"runtimes": plugins.DetectRuntimes(),
	})
}

// POST /api/plugins { id, name, runtime }
func (h *Plugins) Create(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	var in struct{ ID, Name, Runtime string }
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &in)
	man, err := h.mgr.Create(in.ID, in.Name, in.Runtime)
	if err != nil {
		writeAPIErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeData(w, man)
}

// POST /api/plugins/{id}/start
func (h *Plugins) Start(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	if err := h.mgr.Start(chi.URLParam(r, "id")); err != nil {
		writeAPIErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeData(w, map[string]any{"ok": true})
}

// POST /api/plugins/{id}/stop
func (h *Plugins) Stop(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	h.mgr.Stop(chi.URLParam(r, "id"))
	writeData(w, map[string]any{"ok": true})
}

// DELETE /api/plugins/{id}
func (h *Plugins) Delete(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	if err := h.mgr.Delete(chi.URLParam(r, "id")); err != nil {
		writeAPIErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeData(w, map[string]any{"ok": true})
}

// GET /api/plugins/{id}/logs
func (h *Plugins) Logs(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	writeData(w, map[string]any{"lines": h.mgr.Logs(chi.URLParam(r, "id"))})
}

// PluginProxy serves the plugin UI at /plugins/<id>/* (also dashboard-gated,
// since a running plugin has full local access).
func (h *Plugins) PluginProxy() http.Handler {
	inner := h.mgr.Handler()
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !h.dash.Authorized(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		inner.ServeHTTP(w, r)
	})
}
