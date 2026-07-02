//go:build windows

package updater

import (
	"os/exec"
	"syscall"
)

// detach runs the updater detached from the parent console so it survives exit.
func detach(cmd *exec.Cmd) {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		CreationFlags: 0x00000008 | 0x00000200, // DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
	}
}
