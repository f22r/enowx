package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// ReportBug proxies filing a bug report.
func (h *Sync) ReportBug(w http.ResponseWriter, r *http.Request) {
	out, err := h.mgr.ReportBug(r.Context(), readBody(r))
	proxyJSON(w, out, err)
}

// --- admin bug reports ---

func (h *Sync) BugReports(w http.ResponseWriter, r *http.Request) {
	out, err := h.mgr.BugReports(r.Context(), r.URL.RawQuery)
	proxyJSON(w, out, err)
}

func (h *Sync) ResolveBug(w http.ResponseWriter, r *http.Request) {
	err := h.mgr.SetBugStatus(r.Context(), chi.URLParam(r, "id"), "resolve")
	proxyJSON(w, "{\"ok\":true}", err)
}

func (h *Sync) ReopenBug(w http.ResponseWriter, r *http.Request) {
	err := h.mgr.SetBugStatus(r.Context(), chi.URLParam(r, "id"), "reopen")
	proxyJSON(w, "{\"ok\":true}", err)
}

func (h *Sync) DeleteBug(w http.ResponseWriter, r *http.Request) {
	err := h.mgr.DeleteBug(r.Context(), chi.URLParam(r, "id"))
	proxyJSON(w, "{\"ok\":true}", err)
}
