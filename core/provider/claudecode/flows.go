package claudecode

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/enowdev/enowx/core/transport"
)

// OAuth login (Authorization Code + PKCE). Claude Code uses a manual-code flow:
// the user approves at claude.ai and pastes back the returned code.
const (
	oauthAuthorizeURL = "https://claude.ai/oauth/authorize"
	// oauthRedirectURI is Claude Code's manual-code callback (the page that shows
	// the code to paste back).
	oauthRedirectURI = "https://console.anthropic.com/oauth/code/callback"
)

// oauthScopes are the scopes Claude Code requests.
var oauthScopes = []string{"org:create_api_key", "user:profile", "user:inference"}

// OAuthFlow is a pending login: the URL to open + the verifier/state to complete.
type OAuthFlow struct {
	CodeVerifier string `json:"code_verifier"`
	State        string `json:"state"`
	AuthorizeURL string `json:"authorize_url"`
}

// StartOAuth builds the authorize URL + PKCE verifier for a Claude login.
func StartOAuth() (*OAuthFlow, error) {
	verifier, err := randString(64)
	if err != nil {
		return nil, err
	}
	state, err := randString(32)
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])
	params := url.Values{
		"code":                  {"true"},
		"client_id":             {oauthClientID},
		"response_type":         {"code"},
		"redirect_uri":          {oauthRedirectURI},
		"scope":                 {strings.Join(oauthScopes, " ")},
		"code_challenge":        {challenge},
		"code_challenge_method": {"S256"},
		"state":                 {state},
	}
	return &OAuthFlow{
		CodeVerifier: verifier,
		State:        state,
		AuthorizeURL: oauthAuthorizeURL + "?" + params.Encode(),
	}, nil
}

// ExchangeOAuth swaps the pasted code (which may be "code#state") for tokens.
func ExchangeOAuth(doer transport.Doer, code, verifier, state string) (map[string]string, error) {
	code = strings.TrimSpace(code)
	// The returned code can carry the state after a '#'.
	if i := strings.Index(code, "#"); i >= 0 {
		if state == "" {
			state = code[i+1:]
		}
		code = code[:i]
	}
	payload, _ := json.Marshal(map[string]string{
		"grant_type":    "authorization_code",
		"code":          code,
		"state":         state,
		"client_id":     oauthClientID,
		"redirect_uri":  oauthRedirectURI,
		"code_verifier": strings.TrimSpace(verifier),
	})
	req, err := http.NewRequest(http.MethodPost, oauthTokenURL, strings.NewReader(string(payload)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := doer.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("claude oauth exchange %d: %s", resp.StatusCode, trunc(raw))
	}
	var out struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		Scope        string `json:"scope"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, fmt.Errorf("claude oauth decode: %w", err)
	}
	if out.AccessToken == "" {
		return nil, fmt.Errorf("claude oauth: empty access_token")
	}
	exp := out.ExpiresIn
	if exp <= 0 {
		exp = 3600
	}
	return map[string]string{
		"access_token":  out.AccessToken,
		"refresh_token": out.RefreshToken,
		"expires_at":    fmt.Sprintf("%d", time.Now().Add(time.Duration(exp)*time.Second).UnixMilli()),
		"scopes":        out.Scope,
	}, nil
}

// --- helpers ---

func randString(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b)[:n], nil
}

func trunc(b []byte) string {
	s := strings.TrimSpace(string(b))
	if len(s) > 300 {
		return s[:300]
	}
	return s
}
