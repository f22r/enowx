// Package server is the single net/http listener that multiplexes /v1, /api, and
// the SPA by path. It is the only place that knows about HTTP.
package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/enowdev/enowx/core/proxy"
	"github.com/enowdev/enowx/server/handlers"
)

type Server struct {
	addr string
	mux  *chi.Mux
}

type Deps struct {
	Proxy *proxy.Proxy
	Route func(modelID string) string
}

func New(addr string, d Deps) *Server {
	r := chi.NewRouter()
	v1 := handlers.NewV1(d.Proxy, d.Route)

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})
	r.Post("/v1/chat/completions", v1.ChatCompletions)

	return &Server{addr: addr, mux: r}
}

func (s *Server) ListenAndServe() error {
	return http.ListenAndServe(s.addr, s.mux)
}
