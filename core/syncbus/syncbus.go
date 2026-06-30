// Package syncbus is a tiny in-process signal that local stores raise when their
// data changes, so the sync engine can schedule a push without the store and
// the syncer importing each other. Stores call Dirty(); the syncer subscribes.
package syncbus

import "sync"

var (
	mu        sync.Mutex
	listeners []func(kind string)
)

// Dirty signals that data of the given kind (e.g. "playlist") changed locally.
func Dirty(kind string) {
	mu.Lock()
	ls := append([]func(string){}, listeners...)
	mu.Unlock()
	for _, l := range ls {
		l(kind)
	}
}

// Subscribe registers a listener for dirty signals.
func Subscribe(fn func(kind string)) {
	mu.Lock()
	listeners = append(listeners, fn)
	mu.Unlock()
}
