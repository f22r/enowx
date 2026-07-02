package plugins

import (
	"context"
	"os/exec"
	"strings"
	"time"
)

// Runtime describes a plugin runtime and whether it's installed.
type Runtime struct {
	ID        string `json:"id"`      // go | python | node
	Available bool   `json:"available"`
	Version   string `json:"version,omitempty"`
	bin       string
}

// runtimeProbes maps a runtime id to candidate binaries + a version flag.
var runtimeProbes = []struct {
	id   string
	bins []string
	flag string
}{
	{"go", []string{"go"}, "version"},
	{"python", []string{"python3", "python"}, "--version"},
	{"node", []string{"node"}, "--version"},
}

// DetectRuntimes probes the machine for installed plugin runtimes.
func DetectRuntimes() []Runtime {
	out := make([]Runtime, 0, len(runtimeProbes))
	for _, p := range runtimeProbes {
		r := Runtime{ID: p.id}
		for _, b := range p.bins {
			if path, err := exec.LookPath(b); err == nil {
				r.Available = true
				r.bin = path
				r.Version = probeVersion(path, p.flag)
				break
			}
		}
		out = append(out, r)
	}
	return out
}

// runtimeBin returns the resolved binary for a runtime id, or "" if missing.
func runtimeBin(id string) string {
	for _, r := range DetectRuntimes() {
		if r.ID == id {
			return r.bin
		}
	}
	return ""
}

// runArgs builds the command + args to launch a plugin's entry for a runtime.
func runArgs(runtime, entry string) (bin string, args []string, ok bool) {
	b := runtimeBin(runtime)
	if b == "" {
		return "", nil, false
	}
	switch runtime {
	case "python":
		return b, []string{entry}, true
	case "node":
		return b, []string{entry}, true
	case "go":
		// `go run <entry-or-dir>` — entry may be "." or a file.
		return b, []string{"run", entry}, true
	}
	return "", nil, false
}

func probeVersion(bin, flag string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, bin, flag).CombinedOutput()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(strings.SplitN(string(out), "\n", 2)[0])
}
