package sync

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/enowdev/enowx/core/syncbus"
)

// Auto-sync timings: coalesce a burst of local edits into one push, and a
// periodic safety net for devices that were offline and missed /live events.
const (
	autoDebounce = 2 * time.Second
	autoSafety   = 5 * time.Minute
)

// RunAuto runs the automatic push side of sync: it subscribes to local "dirty"
// signals (raised by stores when their data changes) and pushes after a short
// debounce, plus a full reconcile on startup and every few minutes as a safety
// net. /live already handles the pull/reconnect side. onChange is called after a
// successful sync so the UI can refresh. It returns when ctx is cancelled.
//
// Only the manual "Sync now" path bypasses the Enabled() gate; auto-push obeys
// the global toggle and the login state. It never touches device-local secrets
// (dashboard password/session/sync token are not sync items).
func (m *Manager) RunAuto(ctx context.Context, onChange func()) {
	var mu sync.Mutex
	var timer *time.Timer
	dirty := make(chan struct{}, 1)

	// Translate debounced dirty signals into a single pending wakeup.
	syncbus.Subscribe(func(kind string) {
		mu.Lock()
		defer mu.Unlock()
		if timer != nil {
			timer.Stop()
		}
		timer = time.AfterFunc(autoDebounce, func() {
			select {
			case dirty <- struct{}{}:
			default:
			}
		})
	})

	safety := time.NewTicker(autoSafety)
	defer safety.Stop()

	run := func(reason string) {
		if !m.AutoEnabled(ctx) {
			return
		}
		if _, _, err := m.Sync(ctx); err != nil {
			if ctx.Err() == nil {
				log.Printf("[sync] auto (%s) failed: %v", reason, err)
			}
			return
		}
		// Report cumulative usage so the server can credit Kleos for new tokens.
		m.reportUsage(ctx)
		if onChange != nil {
			onChange()
		}
	}

	// Startup safety reconcile (covers data changed while this device was off).
	run("startup")

	for {
		select {
		case <-ctx.Done():
			return
		case <-dirty:
			run("mutation")
		case <-safety.C:
			run("safety")
		}
	}
}
