package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"path/filepath"
	"strings"

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

// POST /api/plugins { id, name, runtime, starter }
func (h *Plugins) Create(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	var in struct {
		ID, Name, Runtime string
		Starter           bool `json:"starter"`
	}
	body, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(body, &in)
	man, err := h.mgr.Create(in.ID, in.Name, in.Runtime, in.Starter)
	if err != nil {
		writeAPIErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeData(w, map[string]any{"manifest": man, "path": h.mgr.Path(in.ID)})
}

// GET /api/plugins/{id}/icon — serve the plugin's icon image (if any). Not gated
// so the WebOS icon renders without a session, but it only reads an image file.
func (h *Plugins) Icon(w http.ResponseWriter, r *http.Request) {
	path := h.mgr.IconPath(chi.URLParam(r, "id"))
	if path == "" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeFile(w, r, path)
}

// POST /api/plugins/{id}/icon — upload an icon image (multipart "file" or raw body).
func (h *Plugins) UploadIcon(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	id := chi.URLParam(r, "id")
	data, ext, err := readImageUpload(r)
	if err != nil {
		writeAPIErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := h.mgr.SaveIcon(id, ext, data); err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeData(w, map[string]any{"ok": true})
}

// readImageUpload reads an image from a multipart "file" field, capped at 2MB.
func readImageUpload(r *http.Request) (data []byte, ext string, err error) {
	f, hdr, ferr := r.FormFile("file")
	if ferr != nil {
		return nil, "", ferr
	}
	defer f.Close()
	data, err = io.ReadAll(io.LimitReader(f, 2<<20))
	if err != nil {
		return nil, "", err
	}
	ext = strings.ToLower(strings.TrimPrefix(filepath.Ext(hdr.Filename), "."))
	return data, ext, nil
}

// POST /api/plugins/{id}/reveal — open the plugin folder in the OS file manager.
func (h *Plugins) Reveal(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	path, err := h.mgr.Reveal(chi.URLParam(r, "id"))
	if err != nil {
		writeAPIErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeData(w, map[string]any{"ok": true, "path": path})
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
