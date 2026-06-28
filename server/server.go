// Package server is the single net/http listener that multiplexes /v1, /api, and
// the SPA by path. It is the only place that knows about HTTP.
package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/enowdev/enowx/core/provider"
	"github.com/enowdev/enowx/core/proxy"
	"github.com/enowdev/enowx/server/handlers"
	"github.com/enowdev/enowx/store"
)

type Server struct {
	addr string
	mux  *chi.Mux
}

type Deps struct {
	Proxy    *proxy.Proxy
	Route    func(modelID string) string
	Registry *provider.Registry
	Accounts store.AccountStore
	Logs     store.LogStore
	Settings handlers.SettingsInfo
}

func New(addr string, d Deps) *Server {
	r := chi.NewRouter()
	v1 := handlers.NewV1(d.Proxy, d.Route, d.Logs)
	providers := handlers.NewProviders(d.Registry)
	accounts := handlers.NewAccounts(d.Accounts)
	requests := handlers.NewRequests(d.Logs)
	settings := handlers.NewSettings(d.Settings)

	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})
	r.Post("/v1/chat/completions", v1.ChatCompletions)

	r.Route("/api", func(r chi.Router) {
		r.Get("/providers", providers.List)
		r.Get("/accounts", accounts.List)
		r.Post("/accounts", accounts.Add)
		r.Patch("/accounts/{id}/status", accounts.SetStatus)
		r.Delete("/accounts/{id}", accounts.Delete)
		r.Get("/requests", requests.List)
		r.Get("/requests/summary", requests.Summary)
		r.Get("/settings", settings.Get)
	})

	// WebOS SPA on the same port (everything not matched above).
	r.Handle("/*", spaHandler())

	return &Server{addr: addr, mux: r}
}

func (s *Server) ListenAndServe() error {
	return http.ListenAndServe(s.addr, s.mux)
}
