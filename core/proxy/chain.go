package proxy

import (
	"context"

	"github.com/enowdev/enowx/core/model"
)

// ForwardChain tries each target in order, starting at startIdx and wrapping,
// stopping at the first success. It calls the existing Forward once per
// target — no new definition of "this target failed" is introduced; a target
// is skipped exactly when Forward already returns an error for it today
// (accounts exhausted/dead, upstream error, etc). Returns the model id that
// actually served the request, for logging.
func (p *Proxy) ForwardChain(ctx context.Context, route func(string) string, targets []string, startIdx int, req *model.Request) (model.Stream, string, error) {
	var lastErr error
	origModel := req.Model
	for i := 0; i < len(targets); i++ {
		t := targets[(startIdx+i)%len(targets)]
		providerName := route(t)
		_, bare := SplitModel(t)
		attempt := *req
		attempt.Model = bare
		attempt.Raw = RewriteBody(req.Raw, origModel, bare)
		stream, err := p.Forward(ctx, providerName, &attempt)
		if err == nil {
			return stream, t, nil
		}
		lastErr = err
	}
	return nil, "", lastErr
}
