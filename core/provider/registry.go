package provider

import "fmt"

type Registry struct{ m map[string]Provider }

func NewRegistry() *Registry { return &Registry{m: map[string]Provider{}} }

func (r *Registry) Register(p Provider) { r.m[p.Name()] = p }

func (r *Registry) Get(name string) (Provider, error) {
	p, ok := r.m[name]
	if !ok {
		return nil, fmt.Errorf("provider %q not registered", name)
	}
	return p, nil
}

func (r *Registry) Names() []string {
	out := make([]string, 0, len(r.m))
	for n := range r.m {
		out = append(out, n)
	}
	return out
}
