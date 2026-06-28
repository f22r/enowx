package handlers

import (
	"context"
	"net/http"

	"github.com/enowdev/enowx/core/model"
	"github.com/enowdev/enowx/server/middleware"
	"github.com/enowdev/enowx/store"
)

// chargeKey adds a request's token usage to the gateway key that authorized it
// (no-op when the gateway is open / no key in context).
func chargeKey(r *http.Request, keys store.KeyStore, u model.Usage) {
	if keys == nil {
		return
	}
	id, ok := middleware.KeyID(r.Context())
	if !ok {
		return
	}
	total := u.PromptTokens + u.CompletionTokens
	if total <= 0 {
		return
	}
	_ = keys.AddUsage(context.Background(), id, total)
}

// usageStream wraps a model.Stream and remembers the last usage seen so the
// handler can log token counts after the response is written.
type usageStream struct {
	inner model.Stream
	usage model.Usage
}

func wrapUsage(s model.Stream) *usageStream { return &usageStream{inner: s} }

func (u *usageStream) Recv() (model.Event, error) {
	ev, err := u.inner.Recv()
	if ev.Usage != nil {
		u.usage = *ev.Usage
	}
	return ev, err
}

func (u *usageStream) Close() error { return u.inner.Close() }
