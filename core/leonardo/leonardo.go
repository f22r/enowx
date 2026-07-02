// Package leonardo is a small client for Leonardo.ai's GraphQL backend. Image
// generation is async: a Generate mutation returns a generationId, which is then
// polled until COMPLETE and the image URLs are read from the feed.
package leonardo

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/enowdev/enowx/core/transport"
)

const (
	graphQLEndpoint = "https://api.leonardo.ai/v1/graphql"
	origin          = "https://app.leonardo.ai"
	referer         = "https://app.leonardo.ai/"
	schemaVersion   = "latest"
	noneStyleID     = "556c1ee5-ec38-42e8-955a-1e82dad0ffa1"
)

// Client talks to Leonardo's GraphQL API with a given doer.
type Client struct{ doer transport.Doer }

func New(doer transport.Doer) *Client { return &Client{doer: doer} }

// ImageRequest is a normalized text-to-image request.
type ImageRequest struct {
	Model  string
	Prompt string
	Size   string // "WxH", default 1024x1024
	N      int
}

// Quota is the account's Leonardo token balance.
type Quota struct {
	Plan               string
	SubscriptionTokens int
	PaidTokens         int
	RolloverTokens     int
	StreamTokens       int
	RenewalDate        string
}

// Remaining is the usable image-token balance.
func (q *Quota) Remaining() int {
	if q == nil {
		return 0
	}
	return q.SubscriptionTokens + q.PaidTokens + q.RolloverTokens
}

// GenerateImage starts a generation and returns its id + credit cost.
func (c *Client) GenerateImage(token string, req ImageRequest) (genID string, creditCost float64, err error) {
	if strings.TrimSpace(req.Model) == "" {
		return "", 0, fmt.Errorf("leonardo: model is required")
	}
	if strings.TrimSpace(req.Prompt) == "" {
		return "", 0, fmt.Errorf("leonardo: prompt is required")
	}
	w, h := parseSize(req.Size)
	qty := req.N
	if qty <= 0 {
		qty = 1
	}
	vars := map[string]any{
		"request": map[string]any{
			"model":  strings.TrimSpace(req.Model),
			"public": true,
			"parameters": map[string]any{
				"prompt":         strings.TrimSpace(req.Prompt),
				"prompt_enhance": "OFF",
				"quantity":       qty,
				"style_ids":      []string{noneStyleID},
				"width":          w,
				"height":         h,
			},
		},
	}
	var out struct {
		Generate struct {
			APICreditCost float64 `json:"apiCreditCost"`
			GenerationID  string  `json:"generationId"`
		} `json:"generate"`
	}
	if err := c.do(token, generateMutation, vars, &out); err != nil {
		return "", 0, err
	}
	if strings.TrimSpace(out.Generate.GenerationID) == "" {
		return "", 0, fmt.Errorf("leonardo: empty generation id")
	}
	return out.Generate.GenerationID, out.Generate.APICreditCost, nil
}

// PollStatus returns the current status of a generation ("PENDING"/"COMPLETE"/
// "FAILED", or "" if not yet in the feed).
func (c *Client) PollStatus(token, genID string) (string, error) {
	vars := map[string]any{
		"where": map[string]any{
			"id":     map[string]any{"_in": []string{genID}},
			"status": map[string]any{"_in": []string{"PENDING", "COMPLETE", "FAILED"}},
		},
	}
	var out struct {
		Generations []struct {
			Status string `json:"status"`
		} `json:"generations"`
	}
	if err := c.do(token, statusQuery, vars, &out); err != nil {
		return "", err
	}
	if len(out.Generations) == 0 {
		return "", nil
	}
	return strings.ToUpper(strings.TrimSpace(out.Generations[0].Status)), nil
}

// Result returns the generated image URLs (and a failure reason if FAILED).
func (c *Client) Result(token, genID string) (urls []string, failure string, err error) {
	vars := map[string]any{
		"where":  map[string]any{"id": map[string]any{"_eq": genID}},
		"limit":  1,
		"offset": 0,
	}
	var out struct {
		Generations []struct {
			Status          string `json:"status"`
			GeneratedImages []struct {
				URL string `json:"url"`
			} `json:"generated_images"`
			Notes []struct {
				FailureReason string `json:"failureReason"`
				NotePayload   string `json:"notePayload"`
			} `json:"notes"`
		} `json:"generations"`
	}
	if err := c.do(token, resultQuery, vars, &out); err != nil {
		return nil, "", err
	}
	if len(out.Generations) == 0 {
		return nil, "", fmt.Errorf("leonardo: generation %s not found", genID)
	}
	row := out.Generations[0]
	for _, img := range row.GeneratedImages {
		if u := strings.TrimSpace(img.URL); u != "" {
			urls = append(urls, u)
		}
	}
	if strings.EqualFold(row.Status, "FAILED") {
		failure = "leonardo generation failed"
		for _, n := range row.Notes {
			if strings.TrimSpace(n.FailureReason) != "" {
				failure = n.FailureReason
				break
			}
			if strings.TrimSpace(n.NotePayload) != "" {
				failure = n.NotePayload
				break
			}
		}
	}
	return urls, failure, nil
}

// Quota fetches the account's token balance by its cognito sub.
func (c *Client) Quota(token, sub string) (*Quota, error) {
	vars := map[string]any{"sub": strings.TrimSpace(sub)}
	var out struct {
		UserDetails []struct {
			Plan               string  `json:"plan"`
			SubscriptionTokens int     `json:"subscriptionTokens"`
			PaidTokens         int     `json:"paidTokens"`
			RolloverTokens     int     `json:"rolloverTokens"`
			StreamTokens       int     `json:"streamTokens"`
			TokenRenewalDate   *string `json:"tokenRenewalDate"`
		} `json:"user_details"`
	}
	if err := c.do(token, tokensQuery, vars, &out); err != nil {
		return nil, err
	}
	if len(out.UserDetails) == 0 {
		return nil, fmt.Errorf("leonardo: no user_details")
	}
	d := out.UserDetails[0]
	q := &Quota{
		Plan: d.Plan, SubscriptionTokens: d.SubscriptionTokens, PaidTokens: d.PaidTokens,
		RolloverTokens: d.RolloverTokens, StreamTokens: d.StreamTokens,
	}
	if d.TokenRenewalDate != nil {
		q.RenewalDate = *d.TokenRenewalDate
	}
	return q, nil
}

// JWTFields extracts the cognito sub + email from a Leonardo access token.
func JWTFields(token string) (sub, email string) {
	parts := strings.Split(strings.TrimSpace(token), ".")
	if len(parts) < 2 {
		return "", ""
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", ""
	}
	var claims struct {
		Sub   string `json:"sub"`
		Email string `json:"email"`
	}
	if json.Unmarshal(raw, &claims) != nil {
		return "", ""
	}
	return strings.TrimSpace(claims.Sub), strings.TrimSpace(claims.Email)
}

func (c *Client) do(token, query string, vars map[string]any, out any) error {
	body, _ := json.Marshal(map[string]any{
		"operationName": operationName(query),
		"variables":     vars,
		"query":         query,
	})
	req, err := http.NewRequest(http.MethodPost, graphQLEndpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(token))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", origin)
	req.Header.Set("Referer", referer)
	req.Header.Set("X-Leo-Schema-Version", schemaVersion)

	resp, err := c.doer.Do(req)
	if err != nil {
		return fmt.Errorf("leonardo request: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("leonardo %d: %s", resp.StatusCode, trunc(raw))
	}
	var env struct {
		Data   json.RawMessage `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}
	if err := json.Unmarshal(raw, &env); err != nil {
		return fmt.Errorf("leonardo decode: %w", err)
	}
	if len(env.Errors) > 0 {
		return fmt.Errorf("leonardo: %s", env.Errors[0].Message)
	}
	if out != nil && len(env.Data) > 0 {
		return json.Unmarshal(env.Data, out)
	}
	return nil
}

func parseSize(s string) (int, int) {
	s = strings.TrimSpace(s)
	if i := strings.IndexAny(s, "xX"); i > 0 {
		w, e1 := strconv.Atoi(strings.TrimSpace(s[:i]))
		h, e2 := strconv.Atoi(strings.TrimSpace(s[i+1:]))
		if e1 == nil && e2 == nil && w > 0 && h > 0 {
			return w, h
		}
	}
	return 1024, 1024
}

func operationName(query string) string {
	// e.g. "mutation Generate(" → "Generate", "query GetX(" → "GetX"
	f := strings.Fields(query)
	if len(f) >= 2 {
		name := f[1]
		if i := strings.IndexAny(name, "({"); i >= 0 {
			name = name[:i]
		}
		return name
	}
	return ""
}

func trunc(b []byte) string {
	s := strings.TrimSpace(string(b))
	if len(s) > 400 {
		return s[:400]
	}
	return s
}

const generateMutation = `mutation Generate($request: CreateGenerationRequest!) {
  generate(request: $request) {
    apiCreditCost
    generationId
    __typename
  }
}`

const statusQuery = `query GetAIGenerationFeedStatuses($where: generations_bool_exp = {}) {
  generations(where: $where) {
    id
    status
    __typename
  }
}`

const resultQuery = `query GetLeonardoGenerationByID($where: generations_bool_exp = {}, $limit: Int, $offset: Int = 0) {
  generations(limit: $limit, offset: $offset, order_by: [{createdAt: desc}], where: $where) {
    id
    status
    generated_images(order_by: [{url: desc}]) {
      url
      motionMP4URL
      __typename
    }
    notes {
      failureReason
      notePayload
      noteType
      __typename
    }
    __typename
  }
}`

const tokensQuery = `query GetUserTokensFromSub($sub: String) {
  user_details(where: {cognitoId: {_eq: $sub}}) {
    plan
    subscriptionGptTokens
    subscriptionModelTokens
    tokenRenewalDate
    streamTokens
    paidTokens
    subscriptionTokens
    rolloverTokens
    __typename
  }
}`
