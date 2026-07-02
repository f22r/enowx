package handlers

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// readBody reads a small JSON request body for proxying (nil when empty).
func readBody(r *http.Request) any {
	b, _ := io.ReadAll(io.LimitReader(r.Body, 1<<16))
	if len(b) == 0 {
		return nil
	}
	return json.RawMessage(b)
}

// Subscription proxies the caller's Premium status from the cloud.
func (h *Sync) Subscription(w http.ResponseWriter, r *http.Request) {
	out, err := h.mgr.Subscription(r.Context())
	proxyJSON(w, out, err)
}

// Subscribe proxies starting a Premium payment (optionally with a coupon).
func (h *Sync) Subscribe(w http.ResponseWriter, r *http.Request) {
	out, err := h.mgr.SubscribePremium(r.Context(), readBody(r))
	proxyJSON(w, out, err)
}

// ValidateCoupon proxies previewing a coupon discount.
func (h *Sync) ValidateCoupon(w http.ResponseWriter, r *http.Request) {
	out, err := h.mgr.ValidateCoupon(r.Context(), readBody(r))
	proxyJSON(w, out, err)
}

// --- admin coupons ---

func (h *Sync) AdminCoupons(w http.ResponseWriter, r *http.Request) {
	out, err := h.mgr.AdminCoupons(r.Context())
	proxyJSON(w, out, err)
}

func (h *Sync) CreateCoupon(w http.ResponseWriter, r *http.Request) {
	out, err := h.mgr.CreateCoupon(r.Context(), readBody(r))
	proxyJSON(w, out, err)
}

func (h *Sync) DeleteCoupon(w http.ResponseWriter, r *http.Request) {
	err := h.mgr.DeleteCoupon(r.Context(), chi.URLParam(r, "id"))
	proxyJSON(w, "{\"ok\":true}", err)
}
