package plugins

import (
	"os"
	"path/filepath"
)

// iconFiles are the accepted plugin icon filenames, in priority order.
var iconFiles = []string{"icon.png", "icon.webp", "icon.jpg", "icon.jpeg", "icon.svg"}

// IconPath returns the absolute path to a plugin's icon image file, or "" if the
// plugin has none (it then falls back to a default/lucide icon in the UI).
func (m *Manager) IconPath(id string) string {
	if !idRe.MatchString(id) {
		return ""
	}
	for _, name := range iconFiles {
		p := filepath.Join(m.dir, id, name)
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			return p
		}
	}
	return ""
}

// HasIcon reports whether the plugin has an icon image file.
func (m *Manager) HasIcon(id string) bool { return m.IconPath(id) != "" }

// SaveIcon writes an uploaded icon image to the plugin folder (as icon.<ext>).
func (m *Manager) SaveIcon(id, ext string, data []byte) error {
	if !idRe.MatchString(id) {
		return os.ErrInvalid
	}
	switch ext {
	case "png", "webp", "jpg", "jpeg", "svg":
	default:
		ext = "png"
	}
	// Remove any existing icon so only one remains.
	for _, name := range iconFiles {
		_ = os.Remove(filepath.Join(m.dir, id, name))
	}
	return os.WriteFile(filepath.Join(m.dir, id, "icon."+ext), data, 0o644)
}
