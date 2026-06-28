//go:build dev

package server

import "net/http"

// In dev the SPA is served by Vite (npm run dev); the Go server only handles
// /api and /v1. No embed → no webdist needed for hot-reload builds.
func spaHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte("dev mode: frontend served by Vite (http://localhost:5173)"))
	})
}
