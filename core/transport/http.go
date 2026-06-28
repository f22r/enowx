package transport

import (
	"net/http"
	"time"
)

// Standard is the default Doer over net/http. The bogdanfinn TLS-spoofing impl
// will be added later behind the same interface.
type Standard struct{ c *http.Client }

func NewStandard(timeout time.Duration) *Standard {
	return &Standard{c: &http.Client{Timeout: timeout}}
}

func (s *Standard) Do(r *http.Request) (*http.Response, error) { return s.c.Do(r) }
