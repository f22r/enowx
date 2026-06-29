//go:build windows

package tunnel

import (
	"os/exec"
	"syscall"
)

// hideWindow prevents a console window from flashing when cloudflared spawns.
func hideWindow(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
}
