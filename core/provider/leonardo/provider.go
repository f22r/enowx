// Package leonardo registers Leonardo.ai as an image-generation provider. It
// speaks GraphQL under the hood (see core/leonardo) and reuses the ImageGenerator
// capability + pool rotation.
package leonardo

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/enowdev/enowx/core/leonardo"
	"github.com/enowdev/enowx/core/model"
	"github.com/enowdev/enowx/core/provider"
	"github.com/enowdev/enowx/core/proxy"
	"github.com/enowdev/enowx/core/transport"
)

const (
	pollInterval = 2 * time.Second
	maxPollTime  = 2 * time.Minute
)

type Provider struct{ client *leonardo.Client }

func New(doer transport.Doer) *Provider { return &Provider{client: leonardo.New(doer)} }

func (p *Provider) Name() string        { return "leonardo" }
func (p *Provider) Caps() provider.Caps { return provider.Caps{Images: true} }

// Leonardo is image-only; it isn't a chat/completions upstream.
func (p *Provider) BuildRequest(*model.Request, provider.Account) (*http.Request, error) {
	return nil, fmt.Errorf("leonardo does not support chat completions")
}
func (p *Provider) ParseResponse(*http.Response, *model.Request) (model.Stream, error) {
	return nil, fmt.Errorf("leonardo does not support chat completions")
}

func (p *Provider) Classify(status int, _ []byte) provider.Outcome {
	switch {
	case status == http.StatusUnauthorized, status == http.StatusForbidden:
		return provider.OutcomeDead
	case status == http.StatusTooManyRequests:
		return provider.OutcomeExhausted
	default:
		return provider.OutcomeTransient
	}
}

// GenerateImage runs a text-to-image generation and polls it to completion.
func (p *Provider) GenerateImage(_ transport.Doer, acc provider.Account, req provider.ImageRequest) (*provider.ImageResult, error) {
	token := strings.TrimSpace(acc.Cred("access_token"))
	if token == "" {
		return nil, fmt.Errorf("leonardo account has no access_token")
	}
	model := req.Model
	if _, bare := proxy.SplitModel(model); bare != "" {
		model = bare
	}
	genID, cost, err := p.client.GenerateImage(token, leonardo.ImageRequest{
		Model: model, Prompt: req.Prompt, Size: req.Size, N: req.N,
	})
	if err != nil {
		return nil, err
	}

	deadline := time.Now().Add(maxPollTime)
	for {
		status, err := p.client.PollStatus(token, genID)
		if err != nil {
			return nil, err
		}
		if status == "COMPLETE" || status == "FAILED" {
			urls, failure, rerr := p.client.Result(token, genID)
			if rerr != nil {
				return nil, rerr
			}
			if failure != "" {
				return nil, fmt.Errorf("%s", failure)
			}
			res := &provider.ImageResult{Credit: cost}
			for _, u := range urls {
				res.Images = append(res.Images, provider.ImageData{URL: u})
			}
			return res, nil
		}
		if time.Now().After(deadline) {
			return nil, fmt.Errorf("leonardo generation timed out")
		}
		time.Sleep(pollInterval)
	}
}

// Models returns Leonardo's image model catalog (no live models endpoint).
func (p *Provider) Models(provider.Account) ([]provider.Model, error) {
	ids := []string{
		"flux-dev", "flux-schnell", "gpt-image-1", "gpt-image-1.5", "gpt-image-2",
		"ideogram-v3.0", "lucid-origin", "lucid-realism", "nano-banana-2",
		"seedream-4.0", "seedream-4.5",
	}
	out := make([]provider.Model, 0, len(ids))
	for _, id := range ids {
		out = append(out, provider.Model{ID: id, Name: id, Type: "image", OwnedBy: "leonardo"})
	}
	return out, nil
}

// Usage reports the account's remaining Leonardo tokens.
func (p *Provider) Usage(acc provider.Account) (*provider.Usage, error) {
	token := strings.TrimSpace(acc.Cred("access_token"))
	sub := strings.TrimSpace(acc.Cred("cognito_sub"))
	if sub == "" && token != "" {
		sub, _ = leonardo.JWTFields(token)
	}
	if token == "" || sub == "" {
		return &provider.Usage{Message: "credits unavailable"}, nil
	}
	q, err := p.client.Quota(token, sub)
	if err != nil {
		return &provider.Usage{Message: "credits unavailable"}, nil
	}
	remaining := q.Remaining()
	return &provider.Usage{
		Remaining: float64(remaining),
		Limit:     float64(remaining), // no known ceiling; show remaining
		Plan:      normalizePlan(q.Plan),
		Message:   fmt.Sprintf("%d tokens", remaining),
	}, nil
}

// Email resolves the account email from the token.
func (p *Provider) Email(acc provider.Account) string {
	if e := acc.Cred("email"); e != "" {
		return e
	}
	if token := strings.TrimSpace(acc.Cred("access_token")); token != "" {
		_, email := leonardo.JWTFields(token)
		return email
	}
	return ""
}

func normalizePlan(p string) string {
	p = strings.ToLower(strings.TrimSpace(p))
	switch p {
	case "", "free":
		return "free"
	default:
		return p
	}
}
