package handlers

import (
	"context"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/enowdev/enowx/core/transport"
	"github.com/enowdev/enowx/server/middleware"
)

// Agent backs the local coding-agent tools: filesystem, one-shot command
// execution, and outbound HTTP. Every tool runs against the user's machine, so
// access is dashboard-gated (free from localhost, session-auth from remote) and
// filesystem paths are confined to the per-request working directory.
type Agent struct {
	dash *middleware.Dashboard
	doer transport.Doer
}

func NewAgent(dash *middleware.Dashboard, doer transport.Doer) *Agent {
	return &Agent{dash: dash, doer: doer}
}

func (h *Agent) guard(w http.ResponseWriter, r *http.Request) bool {
	if !h.dash.Authorized(r) {
		writeAPIErr(w, http.StatusForbidden, "agent tools require the dashboard login when accessed remotely")
		return false
	}
	return true
}

// resolve joins path onto cwd and rejects anything escaping cwd (via .. or an
// absolute path). Returns the cleaned absolute path.
func resolveInCwd(cwd, path string) (string, bool) {
	cwd = strings.TrimSpace(cwd)
	if cwd == "" {
		return "", false
	}
	base, err := filepath.Abs(cwd)
	if err != nil {
		return "", false
	}
	joined := path
	if !filepath.IsAbs(path) {
		joined = filepath.Join(base, path)
	}
	clean := filepath.Clean(joined)
	if clean != base && !strings.HasPrefix(clean, base+string(os.PathSeparator)) {
		return "", false
	}
	return clean, true
}

// Tool reads are capped so a huge file can't bloat the chat history sent back to
// the model or the DOM. 128 KB is plenty for source files.
const agentMaxRead = 128 * 1024

// POST /api/agent/fs/read  {cwd, path}
func (h *Agent) FSRead(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	var in struct{ Cwd, Path string }
	readJSON(r, &in)
	p, ok := resolveInCwd(in.Cwd, in.Path)
	if !ok {
		writeAPIErr(w, http.StatusBadRequest, "path escapes working directory")
		return
	}
	f, err := os.Open(p)
	if err != nil {
		writeAPIErr(w, http.StatusNotFound, err.Error())
		return
	}
	defer f.Close()
	buf := make([]byte, agentMaxRead)
	n, _ := io.ReadFull(f, buf)
	writeData(w, map[string]any{"path": in.Path, "content": string(buf[:n]), "truncated": n == agentMaxRead})
}

// POST /api/agent/fs/list  {cwd, path}
func (h *Agent) FSList(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	var in struct{ Cwd, Path string }
	readJSON(r, &in)
	dir, ok := resolveInCwd(in.Cwd, in.Path)
	if !ok {
		writeAPIErr(w, http.StatusBadRequest, "path escapes working directory")
		return
	}
	ents, err := os.ReadDir(dir)
	if err != nil {
		writeAPIErr(w, http.StatusNotFound, err.Error())
		return
	}
	out := make([]entryDTO, 0, len(ents))
	for _, e := range ents {
		info, _ := e.Info()
		var size int64
		var mod string
		if info != nil {
			size = info.Size()
			mod = info.ModTime().Format("2006-01-02 15:04")
		}
		out = append(out, entryDTO{Name: e.Name(), IsDir: e.IsDir(), Size: size, Mod: mod})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].IsDir != out[j].IsDir {
			return out[i].IsDir
		}
		return out[i].Name < out[j].Name
	})
	writeData(w, map[string]any{"path": in.Path, "entries": out})
}

// POST /api/agent/fs/write  {cwd, path, content}
func (h *Agent) FSWrite(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	var in struct{ Cwd, Path, Content string }
	readJSON(r, &in)
	p, ok := resolveInCwd(in.Cwd, in.Path)
	if !ok {
		writeAPIErr(w, http.StatusBadRequest, "path escapes working directory")
		return
	}
	old, _ := os.ReadFile(p)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	if err := os.WriteFile(p, []byte(in.Content), 0o644); err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeData(w, map[string]any{"path": in.Path, "old": string(old), "new": in.Content, "created": len(old) == 0})
}

// POST /api/agent/fs/edit  {cwd, path, old, new}  (single string replace)
func (h *Agent) FSEdit(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	var in struct{ Cwd, Path, Old, New string }
	readJSON(r, &in)
	p, ok := resolveInCwd(in.Cwd, in.Path)
	if !ok {
		writeAPIErr(w, http.StatusBadRequest, "path escapes working directory")
		return
	}
	b, err := os.ReadFile(p)
	if err != nil {
		writeAPIErr(w, http.StatusNotFound, err.Error())
		return
	}
	content := string(b)
	if !strings.Contains(content, in.Old) {
		writeAPIErr(w, http.StatusBadRequest, "old string not found in file")
		return
	}
	if strings.Count(content, in.Old) > 1 {
		writeAPIErr(w, http.StatusBadRequest, "old string is not unique; include more context")
		return
	}
	updated := strings.Replace(content, in.Old, in.New, 1)
	if err := os.WriteFile(p, []byte(updated), 0o644); err != nil {
		writeAPIErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeData(w, map[string]any{"path": in.Path, "old": content, "new": updated})
}

// POST /api/agent/exec  {cwd, command, timeout_ms}
func (h *Agent) Exec(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	var in struct {
		Cwd       string `json:"cwd"`
		Command   string `json:"command"`
		TimeoutMS int    `json:"timeout_ms"`
	}
	readJSON(r, &in)
	if strings.TrimSpace(in.Command) == "" {
		writeAPIErr(w, http.StatusBadRequest, "command required")
		return
	}
	base, ok := resolveInCwd(in.Cwd, ".")
	if !ok {
		writeAPIErr(w, http.StatusBadRequest, "invalid working directory")
		return
	}
	timeout := time.Duration(in.TimeoutMS) * time.Millisecond
	if timeout <= 0 || timeout > 5*time.Minute {
		timeout = 60 * time.Second
	}
	ctx, cancel := context.WithTimeout(r.Context(), timeout)
	defer cancel()

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(ctx, defaultShell(), "/C", in.Command)
	} else {
		cmd = exec.CommandContext(ctx, defaultShell(), "-c", in.Command)
	}
	cmd.Dir = base
	// Bounded output so a runaway command can't blow up memory.
	var out, errb limitedBuffer
	out.max, errb.max = 256*1024, 64*1024
	cmd.Stdout, cmd.Stderr = &out, &errb
	err := cmd.Run()
	exit := 0
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			exit = ee.ExitCode()
		} else {
			exit = -1
			if errb.buf.Len() == 0 {
				errb.buf.WriteString(err.Error())
			}
		}
	}
	writeData(w, map[string]any{
		"stdout":    out.buf.String(),
		"stderr":    errb.buf.String(),
		"exit_code": exit,
		"timed_out": ctx.Err() == context.DeadlineExceeded,
	})
}

// POST /api/agent/http  {method, url, headers, body}
func (h *Agent) HTTP(w http.ResponseWriter, r *http.Request) {
	if !h.guard(w, r) {
		return
	}
	var in struct {
		Method  string            `json:"method"`
		URL     string            `json:"url"`
		Headers map[string]string `json:"headers"`
		Body    string            `json:"body"`
	}
	readJSON(r, &in)
	if in.Method == "" {
		in.Method = http.MethodGet
	}
	if strings.TrimSpace(in.URL) == "" {
		writeAPIErr(w, http.StatusBadRequest, "url required")
		return
	}
	var body io.Reader
	if in.Body != "" {
		body = strings.NewReader(in.Body)
	}
	req, err := http.NewRequestWithContext(r.Context(), strings.ToUpper(in.Method), in.URL, body)
	if err != nil {
		writeAPIErr(w, http.StatusBadRequest, err.Error())
		return
	}
	for k, v := range in.Headers {
		req.Header.Set(k, v)
	}
	resp, err := h.doer.Do(req)
	if err != nil {
		writeAPIErr(w, http.StatusBadGateway, err.Error())
		return
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(io.LimitReader(resp.Body, agentMaxRead))
	hdr := map[string]string{}
	for k := range resp.Header {
		hdr[k] = resp.Header.Get(k)
	}
	writeData(w, map[string]any{"status": resp.StatusCode, "headers": hdr, "body": string(rb)})
}

// limitedBuffer caps how much output it retains.
//
type limitedBuffer struct {
	buf strings.Builder
	max int
}

func (b *limitedBuffer) Write(p []byte) (int, error) {
	if b.buf.Len() < b.max {
		room := b.max - b.buf.Len()
		if room > len(p) {
			room = len(p)
		}
		b.buf.Write(p[:room])
	}
	return len(p), nil // report full write so the command isn't blocked
}
