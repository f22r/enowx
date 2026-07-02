package plugins

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"runtime"
)

// Reveal opens a plugin's folder in the OS file manager so the user can edit it
// in their own IDE.
func (m *Manager) Reveal(id string) (string, error) {
	if !idRe.MatchString(id) {
		return "", fmt.Errorf("invalid plugin id")
	}
	dir := filepath.Join(m.dir, id)
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", dir)
	case "windows":
		cmd = exec.Command("explorer", dir)
	default:
		cmd = exec.Command("xdg-open", dir)
	}
	if err := cmd.Start(); err != nil {
		return dir, fmt.Errorf("open folder: %w", err)
	}
	go func() { _ = cmd.Wait() }()
	return dir, nil
}

// Path returns the absolute path of a plugin's folder (for display).
func (m *Manager) Path(id string) string { return filepath.Join(m.dir, id) }