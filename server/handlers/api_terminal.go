package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"runtime"

	"github.com/coder/websocket"
	"github.com/creack/pty"

	"github.com/enowdev/enowx/server/middleware"
)

// defaultShell picks the user's interactive shell per OS.
func defaultShell() string {
	if runtime.GOOS == "windows" {
		if ps, err := exec.LookPath("powershell.exe"); err == nil {
			return ps
		}
		return "cmd.exe"
	}
	if sh := os.Getenv("SHELL"); sh != "" {
		return sh
	}
	return "/bin/bash"
}

// Terminal serves a real PTY shell over a WebSocket. Access is gated by the
// dashboard guard: free from localhost, session-authenticated from remote — a
// shell reachable from the network without auth would be a takeover risk.
type Terminal struct{ dash *middleware.Dashboard }

func NewTerminal(dash *middleware.Dashboard) *Terminal { return &Terminal{dash: dash} }

type termMsg struct {
	Type string `json:"type"`           // "input" | "resize"
	Data string `json:"data,omitempty"` // input bytes
	Cols uint16 `json:"cols,omitempty"`
	Rows uint16 `json:"rows,omitempty"`
}

func (h *Terminal) WS(w http.ResponseWriter, r *http.Request) {
	if !h.dash.Authorized(r) {
		http.Error(w, "terminal requires the dashboard login when accessed remotely", http.StatusForbidden)
		return
	}

	// Same-origin only (default when OriginPatterns is unset): the library rejects
	// a WebSocket whose Origin host differs from the request Host. This blocks
	// cross-site WebSocket hijacking — a malicious page can't open the localhost
	// shell — while the app's own UI (localhost or the tunnel host) still works
	// because its Origin matches the Host.
	c, err := websocket.Accept(w, r, nil)
	if err != nil {
		return
	}
	defer c.Close(websocket.StatusNormalClosure, "")

	cmd := exec.Command(defaultShell())
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")
	if home, err := os.UserHomeDir(); err == nil {
		cmd.Dir = home
	}
	ptmx, err := pty.Start(cmd)
	if err != nil {
		c.Close(websocket.StatusInternalError, "pty start failed")
		return
	}
	defer func() {
		_ = ptmx.Close()
		_ = cmd.Process.Kill()
		_, _ = cmd.Process.Wait()
	}()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// PTY -> client (binary frames).
	go func() {
		buf := make([]byte, 32*1024)
		for {
			n, err := ptmx.Read(buf)
			if n > 0 {
				if werr := c.Write(ctx, websocket.MessageBinary, buf[:n]); werr != nil {
					cancel()
					return
				}
			}
			if err != nil {
				cancel()
				return
			}
		}
	}()

	// client -> PTY (control + input).
	for {
		typ, data, err := c.Read(ctx)
		if err != nil {
			return
		}
		if typ != websocket.MessageText {
			ptmx.Write(data)
			continue
		}
		var m termMsg
		if json.Unmarshal(data, &m) != nil {
			ptmx.Write(data)
			continue
		}
		switch m.Type {
		case "resize":
			_ = pty.Setsize(ptmx, &pty.Winsize{Cols: m.Cols, Rows: m.Rows})
		case "input":
			ptmx.Write([]byte(m.Data))
		default:
			ptmx.Write(data)
		}
	}
}

