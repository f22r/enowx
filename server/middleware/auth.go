// Package middleware holds HTTP middleware for the gateway.
package middleware

import (
	"context"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/enowdev/enowx/store"
)

type ctxKey int

const keyIDKey ctxKey = 0

// KeyID returns the gateway key id that authorized the request, if any.
func KeyID(ctx context.Context) (int64, bool) {
	v, ok := ctx.Value(keyIDKey).(int64)
	return v, ok
}

// Auth enforces gateway API keys on protected routes. With no keys configured
// the gateway stays open (local-first). Once keys exist, a request must carry a
// matching, enabled, non-expired key that is under its token and concurrency
// limits. Concurrency is tracked in-memory for the process lifetime.
type Auth struct {
	keys     store.KeyStore
	mu       sync.Mutex
	inflight map[int64]int64
}

func NewAuth(keys store.KeyStore) *Auth {
	return &Auth{keys: keys, inflight: map[int64]int64{}}
}

func (a *Auth) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n, err := a.keys.Count(r.Context())
		if err != nil || n == 0 {
			next.ServeHTTP(w, r) // open gateway
			return
		}

		token := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		key, _ := a.keys.BySecret(r.Context(), token)
		if key == nil {
			deny(w, http.StatusUnauthorized, "invalid or missing API key")
			return
		}
		if !key.Enabled {
			deny(w, http.StatusForbidden, "API key is disabled")
			return
		}
		if key.ExpiresAt != nil && time.Now().After(*key.ExpiresAt) {
			deny(w, http.StatusForbidden, "API key has expired")
			return
		}
		if key.TokenLimit > 0 && key.TokensUsed >= key.TokenLimit {
			deny(w, http.StatusForbidden, "API key token limit reached")
			return
		}

		if !a.acquire(key.ID, key.MaxConcurrent) {
			deny(w, http.StatusTooManyRequests, "API key concurrency limit reached")
			return
		}
		defer a.release(key.ID)

		ctx := context.WithValue(r.Context(), keyIDKey, key.ID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (a *Auth) acquire(id, max int64) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	if max > 0 && a.inflight[id] >= max {
		return false
	}
	a.inflight[id]++
	return true
}

func (a *Auth) release(id int64) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.inflight[id] > 0 {
		a.inflight[id]--
	}
}

func deny(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write([]byte(`{"error":{"message":"` + msg + `"}}`))
}
