package handlers

import (
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// MarketplaceList proxies browsing listings (forwards the query string).
func (h *Sync) MarketplaceList(w http.ResponseWriter, r *http.Request) {
	q := ""
	if raw := r.URL.RawQuery; raw != "" {
		q = "?" + raw
	}
	out, err := h.mgr.MarketplaceList(r.Context(), q)
	proxyJSON(w, out, err)
}

// MarketplaceGet proxies fetching one listing.
func (h *Sync) MarketplaceGet(w http.ResponseWriter, r *http.Request) {
	out, err := h.mgr.MarketplaceGet(r.Context(), chi.URLParam(r, "id"))
	proxyJSON(w, out, err)
}

// MarketplaceCreate proxies creating a listing.
func (h *Sync) MarketplaceCreate(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	out, err := h.mgr.MarketplaceCreate(r.Context(), body)
	proxyJSON(w, out, err)
}

// MarketplaceUpdate proxies editing a listing.
func (h *Sync) MarketplaceUpdate(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	out, err := h.mgr.MarketplaceAction(r.Context(), http.MethodPatch, chi.URLParam(r, "id"), body)
	proxyJSON(w, out, err)
}

// MarketplaceDelete proxies deleting a listing.
func (h *Sync) MarketplaceDelete(w http.ResponseWriter, r *http.Request) {
	out, err := h.mgr.MarketplaceAction(r.Context(), http.MethodDelete, chi.URLParam(r, "id"), nil)
	proxyJSON(w, out, err)
}
