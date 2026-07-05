package handlers

import (
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	syncpkg "github.com/enowdev/enowx/core/sync"
	"github.com/enowdev/enowx/server/middleware"
)

// Registry proxies the community MCP & Skill registry to the cloud.
// Dashboard-gated; publishing requires a cloud login (the sync token carries
// identity). The cloud does the scan + GitHub commit.
type Registry struct {
	dash *middleware.Dashboard
	sync *syncpkg.Manager
}

func NewRegistry(dash *middleware.Dashboard, sm *syncpkg.Manager) *Registry {
	return &Registry{dash: dash, sync: sm}
}

func (h *Registry) rawJSON(w http.ResponseWriter, raw string) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"data":` + raw + `}`))
}

// GET /api/registry?kind=mcp|skill&q=
func (h *Registry) List(w http.ResponseWriter, r *http.Request) {
	if !h.dash.Authorized(r) {
		writeAPIErr(w, http.StatusForbidden, "requires the dashboard login when accessed remotely")
		return
	}
	raw, err := h.sync.RegistryList(r.Context(), r.URL.Query().Get("kind"), strings.TrimSpace(r.URL.Query().Get("q")))
	if err != nil {
		writeAPIErr(w, http.StatusBadGateway, err.Error())
		return
	}
	h.rawJSON(w, raw)
}

// GET /api/registry/{id}
func (h *Registry) Get(w http.ResponseWriter, r *http.Request) {
	if !h.dash.Authorized(r) {
		writeAPIErr(w, http.StatusForbidden, "requires the dashboard login when accessed remotely")
		return
	}
	raw, err := h.sync.RegistryGet(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeAPIErr(w, http.StatusBadGateway, err.Error())
		return
	}
	h.rawJSON(w, raw)
}

// POST /api/registry/publish — multipart: kind, name, description, version, file.
func (h *Registry) Publish(w http.ResponseWriter, r *http.Request) {
	if !h.dash.Authorized(r) {
		writeAPIErr(w, http.StatusForbidden, "requires the dashboard login when accessed remotely")
		return
	}
	if err := r.ParseMultipartForm(6 << 20); err != nil {
		writeAPIErr(w, http.StatusBadRequest, "bad upload")
		return
	}
	f, _, err := r.FormFile("file")
	if err != nil {
		writeAPIErr(w, http.StatusBadRequest, "a bundle file is required")
		return
	}
	defer f.Close()
	zipBytes, _ := io.ReadAll(io.LimitReader(f, 6<<20))
	fields := map[string]string{
		"kind":        r.FormValue("kind"),
		"name":        r.FormValue("name"),
		"description": r.FormValue("description"),
		"version":     r.FormValue("version"),
	}
	raw, err := h.sync.RegistryPublish(r.Context(), fields, zipBytes)
	if err != nil {
		writeAPIErr(w, http.StatusBadGateway, err.Error())
		return
	}
	h.rawJSON(w, raw)
}
