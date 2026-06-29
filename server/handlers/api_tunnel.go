package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/enowdev/enowx/core/tunnel"
	"github.com/enowdev/enowx/store"
)

// Tunnel exposes the gateway publicly via Cloudflare Tunnel. Enabling is gated
// on having at least one gateway API key — exposing an unauthenticated gateway
// to the internet would let anyone spend your upstream accounts.
type Tunnel struct {
	mgr  *tunnel.Manager
	keys store.KeyStore
}

func NewTunnel(mgr *tunnel.Manager, keys store.KeyStore) *Tunnel {
	return &Tunnel{mgr: mgr, keys: keys}
}

func (h *Tunnel) status(w http.ResponseWriter) {
	st := h.mgr.Status()
	downloading, progress := h.mgr.Downloading()
	writeData(w, map[string]any{
		"enabled":      st.Enabled,
		"mode":         st.Mode,
		"url":          st.URL,
		"hostname":     st.Hostname,
		"logged_in":    st.LoggedIn,
		"downloading":  downloading,
		"download_pct": progress,
	})
}

func (h *Tunnel) Status(w http.ResponseWriter, _ *http.Request) { h.status(w) }

// guard refuses to expose the gateway while it is unauthenticated.
func (h *Tunnel) guard(ctx context.Context) error {
	n, err := h.keys.Count(ctx)
	if err != nil {
		return err
	}
	if n == 0 {
		return errString("create a gateway API key before exposing the gateway publicly")
	}
	return nil
}

// Enable starts a quick tunnel (random trycloudflare.com URL, no account).
func (h *Tunnel) Enable(w http.ResponseWriter, r *http.Request) {
	if err := h.guard(r.Context()); err != nil {
		writeAPIErr(w, http.StatusForbidden, err.Error())
		return
	}
	st, err := h.mgr.EnableQuick()
	if err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeData(w, st)
}

func (h *Tunnel) Disable(w http.ResponseWriter, _ *http.Request) {
	h.mgr.Disable()
	h.status(w)
}

// Login drives `cloudflared tunnel login` and streams progress + the browser
// authorization URL as SSE, finishing when the cert is saved.
func (h *Tunnel) Login(w http.ResponseWriter, r *http.Request) {
	if err := h.guard(r.Context()); err != nil {
		writeAPIErr(w, http.StatusForbidden, err.Error())
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeAPIErr(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	send := func(event string, data any) {
		b, _ := json.Marshal(data)
		w.Write([]byte("event: " + event + "\ndata: "))
		w.Write(b)
		w.Write([]byte("\n\n"))
		flusher.Flush()
	}

	err := h.mgr.Login(
		func(line string) { send("progress", map[string]string{"message": line}) },
		func(url string) { send("auth_url", map[string]string{"url": url}) },
	)
	if err != nil {
		send("error", map[string]string{"error": err.Error()})
		return
	}
	send("done", map[string]bool{"logged_in": true})
}

// Named creates/routes/runs a named tunnel on the user's own hostname. Requires
// a prior successful Login.
func (h *Tunnel) Named(w http.ResponseWriter, r *http.Request) {
	if err := h.guard(r.Context()); err != nil {
		writeAPIErr(w, http.StatusForbidden, err.Error())
		return
	}
	var body struct {
		Hostname string `json:"hostname"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	st, err := h.mgr.EnableNamed(body.Hostname)
	if err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeData(w, st)
}
