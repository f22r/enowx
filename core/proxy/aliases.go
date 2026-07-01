package proxy

import (
	"bytes"
	"context"
	"encoding/json"
	"sync"
	"time"
)

// AliasResolver resolves an aliased model id to its real target using the user's
// LOCAL alias map (from the enowx SQLite store), and rewrites the raw request
// body's "model" field so upstream sees the real model. Aliases are per-user and
// never leave this instance.
type AliasResolver struct {
	source func(ctx context.Context) map[string]string
	ttl    time.Duration

	mu      sync.RWMutex
	aliases map[string]string
	fetched time.Time
}

// NewAliasResolver builds a resolver over a local alias-map source (e.g. the
// SQLite alias store's Map method).
func NewAliasResolver(source func(ctx context.Context) map[string]string, ttl time.Duration) *AliasResolver {
	if ttl <= 0 {
		ttl = 30 * time.Second
	}
	return &AliasResolver{source: source, ttl: ttl, aliases: map[string]string{}}
}

// Resolve returns the real model id for a possibly-aliased model. The cached map
// is refreshed lazily when stale. Unknown models pass through unchanged.
func (r *AliasResolver) Resolve(ctx context.Context, model string) string {
	r.mu.RLock()
	stale := time.Since(r.fetched) > r.ttl
	real, ok := r.aliases[model]
	r.mu.RUnlock()

	if stale {
		if m := r.source(ctx); m != nil {
			r.mu.Lock()
			r.aliases = m
			r.fetched = time.Now()
			real, ok = m[model]
			r.mu.Unlock()
		}
	}
	if ok && real != "" {
		return real
	}
	return model
}

// RewriteBody replaces the top-level "model" field in an OpenAI/Anthropic JSON
// body with real, if it differs. Returns the (possibly unchanged) body.
func RewriteBody(raw json.RawMessage, alias, real string) json.RawMessage {
	if alias == real || len(raw) == 0 {
		return raw
	}
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		return raw
	}
	b, _ := json.Marshal(real)
	m["model"] = b
	out, err := json.Marshal(m)
	if err != nil {
		return raw
	}
	// Preserve compactness; json.Marshal already produces compact output.
	return bytes.TrimSpace(out)
}
