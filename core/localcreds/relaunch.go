package localcreds

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// AppSpec describes a desktop/CLI app for relaunch after applying credentials.
type AppSpec struct {
	Provider     string
	DisplayName  string
	IsCLI        bool
	ProcessNames []string
	LaunchPaths  []string
}

// AppSpecFor returns the relaunch spec for a provider + target, or ok=false if
// there's nothing to launch.
func AppSpecFor(provider, target string) (AppSpec, bool) {
	cli := strings.EqualFold(strings.TrimSpace(target), "cli")
	switch provider {
	case "kiro":
		if cli {
			return AppSpec{
				Provider: "kiro", DisplayName: "kiro-cli", IsCLI: true,
				ProcessNames: []string{"kiro-cli"},
				LaunchPaths: []string{
					filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "Kiro", "kiro-cli.exe"),
					filepath.Join(os.Getenv("ProgramFiles"), "Kiro", "kiro-cli.exe"),
					"/opt/homebrew/bin/kiro-cli", "/usr/local/bin/kiro-cli",
					"/opt/Kiro/kiro-cli", "/usr/bin/kiro-cli",
					filepath.Join(os.Getenv("HOME"), "Applications", "kiro-cli.AppImage"),
				},
			}, true
		}
		return AppSpec{
			Provider: "kiro", DisplayName: "Kiro", ProcessNames: []string{"Kiro", "kiro"},
			LaunchPaths: []string{
				"/Applications/Kiro.app",
				filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "Kiro", "Kiro.exe"),
				filepath.Join(os.Getenv("ProgramFiles"), "Kiro", "Kiro.exe"),
				filepath.Join(os.Getenv("HOME"), "Applications", "Kiro.AppImage"),
				"/opt/Kiro/kiro", "/usr/bin/kiro",
			},
		}, true
	case "codex":
		return AppSpec{
			Provider: "codex", DisplayName: "Codex", ProcessNames: []string{"Codex", "codex"},
			LaunchPaths: []string{
				"/Applications/Codex.app",
				filepath.Join(os.Getenv("LOCALAPPDATA"), "Programs", "Codex", "Codex.exe"),
				filepath.Join(os.Getenv("ProgramFiles"), "Codex", "Codex.exe"),
				filepath.Join(os.Getenv("HOME"), "Applications", "Codex.AppImage"),
				"/opt/Codex/codex", "/usr/bin/codex",
			},
		}, true
	}
	return AppSpec{}, false
}

// RelaunchApp restarts the app if running, else launches it. Returns
// "restarted"|"launched".
func RelaunchApp(spec AppSpec) (string, error) {
	running, err := appRunning(spec)
	if err != nil {
		return "", err
	}
	if running {
		if err := stopApp(spec); err != nil {
			return "", err
		}
		time.Sleep(1200 * time.Millisecond)
		if err := launchApp(spec); err != nil {
			return "", err
		}
		return "restarted", nil
	}
	if err := launchApp(spec); err != nil {
		return "", err
	}
	return "launched", nil
}

func appRunning(spec AppSpec) (bool, error) {
	if runtime.GOOS == "darwin" && !spec.IsCLI {
		script := fmt.Sprintf(`tell application "System Events" to (name of processes) contains "%s"`, spec.DisplayName)
		out, err := exec.Command("osascript", "-e", script).CombinedOutput()
		if err != nil {
			return false, fmt.Errorf("detect %s: %s", spec.DisplayName, strings.TrimSpace(string(out)))
		}
		return strings.EqualFold(strings.TrimSpace(string(out)), "true"), nil
	}
	for _, name := range spec.ProcessNames {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		var cmd *exec.Cmd
		switch runtime.GOOS {
		case "linux", "darwin":
			cmd = exec.Command("pgrep", "-ix", name)
		case "windows":
			cmd = exec.Command("tasklist", "/FI", "IMAGENAME eq "+name+".exe")
		default:
			return false, fmt.Errorf("unsupported OS: %s", runtime.GOOS)
		}
		out, err := cmd.CombinedOutput()
		if runtime.GOOS == "windows" {
			if err == nil && strings.Contains(strings.ToLower(string(out)), strings.ToLower(name)+".exe") {
				return true, nil
			}
			continue
		}
		if err == nil && strings.TrimSpace(string(out)) != "" {
			return true, nil
		}
	}
	return false, nil
}

func stopApp(spec AppSpec) error {
	switch runtime.GOOS {
	case "darwin":
		if spec.IsCLI {
			for _, name := range spec.ProcessNames {
				if strings.TrimSpace(name) != "" {
					_ = exec.Command("pkill", "-ix", name).Run()
				}
			}
			return nil
		}
		script := fmt.Sprintf(`tell application "%s" to quit`, spec.DisplayName)
		if out, err := exec.Command("osascript", "-e", script).CombinedOutput(); err != nil {
			return fmt.Errorf("quit %s: %s", spec.DisplayName, strings.TrimSpace(string(out)))
		}
	case "linux":
		for _, name := range spec.ProcessNames {
			if strings.TrimSpace(name) != "" {
				_ = exec.Command("pkill", "-ix", name).Run()
			}
		}
	case "windows":
		for _, name := range spec.ProcessNames {
			if strings.TrimSpace(name) != "" {
				_ = exec.Command("taskkill", "/IM", name+".exe", "/F").Run()
			}
		}
	default:
		return fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}
	return nil
}

func launchApp(spec AppSpec) error {
	switch runtime.GOOS {
	case "darwin":
		if spec.IsCLI {
			for _, c := range spec.LaunchPaths {
				if c = strings.TrimSpace(c); c == "" {
					continue
				}
				if _, err := os.Stat(c); err == nil {
					return exec.Command(c).Start()
				}
			}
			if path, err := exec.LookPath(spec.DisplayName); err == nil {
				return exec.Command(path).Start()
			}
			return fmt.Errorf("%s launch path not found", spec.DisplayName)
		}
		for _, c := range spec.LaunchPaths {
			if c = strings.TrimSpace(c); c == "" {
				continue
			}
			if strings.HasSuffix(c, ".app") {
				if _, err := os.Stat(c); err == nil {
					return exec.Command("open", "-a", c).Start()
				}
				continue
			}
			if _, err := os.Stat(c); err == nil {
				return exec.Command("open", c).Start()
			}
		}
		return exec.Command("open", "-a", spec.DisplayName).Start()
	case "linux":
		for _, c := range spec.LaunchPaths {
			if c = strings.TrimSpace(c); c == "" {
				continue
			}
			if _, err := os.Stat(c); err == nil {
				return exec.Command(c).Start()
			}
		}
		if path, err := exec.LookPath(strings.ToLower(spec.DisplayName)); err == nil {
			return exec.Command(path).Start()
		}
		return fmt.Errorf("%s launch path not found", spec.DisplayName)
	case "windows":
		for _, c := range spec.LaunchPaths {
			if c = strings.TrimSpace(c); c == "" {
				continue
			}
			if _, err := os.Stat(c); err == nil {
				return exec.Command(c).Start()
			}
		}
		return fmt.Errorf("%s launch path not found", spec.DisplayName)
	}
	return fmt.Errorf("unsupported OS: %s", runtime.GOOS)
}
