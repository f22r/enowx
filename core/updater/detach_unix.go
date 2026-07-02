//go:build !windows

package updater

import (
	"os/exec"
	"syscall"
)

// detach puts the updater in its own session so it survives the parent's exit.
func detach(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
}
