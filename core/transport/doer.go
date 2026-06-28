// Package transport isolates outbound HTTP. Everything depends on Doer; the
// TLS-spoofing impl lives behind it so it can be swapped or faked.
package transport

import "net/http"

type Doer interface {
	Do(*http.Request) (*http.Response, error)
}
