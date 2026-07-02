package handlers

import (
	"net/http"

	"github.com/enowdev/enowx/core/leonardo"
	"github.com/enowdev/enowx/core/transport"
	"github.com/enowdev/enowx/store"
)

// Leonardo handles the cookie-based add flow: exchange an app.leonardo.ai cookie
// for the session access token, then save + warm the account.
type Leonardo struct {
	store  store.AccountStore
	client *leonardo.Client
	warmer Warmer
}

func NewLeonardo(s store.AccountStore, doer transport.Doer) *Leonardo {
	return &Leonardo{store: s, client: leonardo.New(doer)}
}

func (h *Leonardo) SetWarmer(w Warmer) { h.warmer = w }

// POST /api/accounts/leonardo/cookie { cookie, label }
func (h *Leonardo) FromCookie(w http.ResponseWriter, r *http.Request) {
	var in struct{ Cookie, Label string }
	readJSON(r, &in)
	creds, err := h.client.SessionFromCookie(in.Cookie)
	if err != nil {
		writeAPIErr(w, http.StatusBadGateway, err.Error())
		return
	}
	c := map[string]string{"access_token": creds.AccessToken}
	if creds.CognitoSub != "" {
		c["cognito_sub"] = creds.CognitoSub
	}
	if creds.Email != "" {
		c["email"] = creds.Email
	}
	id, err := h.store.Add(r.Context(), store.Account{
		Provider: "leonardo",
		Label:    nz(in.Label, creds.Email),
		Creds:    c,
		Status:   "active",
	})
	if err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	out := map[string]any{"id": id, "email": creds.Email}
	if warm := autoWarm(r.Context(), h.warmer, h.store, id); warm != nil {
		out["warmup"] = warm
	}
	writeData(w, out)
}
