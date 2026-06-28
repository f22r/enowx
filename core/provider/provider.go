// Package provider defines the upstream boundary. Each upstream is one small impl
// of Provider; the proxy and pool never see provider-specific quirks.
package provider

import (
	"net/http"

	"github.com/enowdev/enowx/core/model"
)

// Account is the minimal credential a provider needs to build a request.
type Account struct {
	ID     int64
	Secret string
}

type Caps struct {
	Chat   bool
	Images bool
}

// Outcome classifies an upstream failure so the pool can react.
type Outcome int

const (
	OutcomeOK        Outcome = iota
	OutcomeTransient         // retry / rotate
	OutcomeExhausted         // this account is out of quota
	OutcomeDead              // key invalid → ban account
)

type Provider interface {
	Name() string
	Caps() Caps
	BuildRequest(*model.Request, Account) (*http.Request, error)
	ParseResponse(*http.Response, *model.Request) (model.Stream, error)
	Classify(status int, body []byte) Outcome
}
