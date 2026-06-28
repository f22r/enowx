package handlers

import (
	"net/http"
	"time"
)

// SettingsInfo is static gateway info supplied at startup.
type SettingsInfo struct {
	Version    string
	Host       string
	Port       int
	RuntimeDir string
	Started    time.Time
}

type Settings struct{ info SettingsInfo }

func NewSettings(info SettingsInfo) *Settings { return &Settings{info: info} }

func (h *Settings) Get(w http.ResponseWriter, _ *http.Request) {
	writeData(w, map[string]any{
		"version":     h.info.Version,
		"host":        h.info.Host,
		"port":        h.info.Port,
		"runtime_dir": h.info.RuntimeDir,
		"uptime_sec":  int64(time.Since(h.info.Started).Seconds()),
	})
}
