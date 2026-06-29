// Package tunnel exposes the local gateway to the public internet via Cloudflare
// Tunnel. It downloads the cloudflared binary on demand (per OS/arch) and drives
// it as a subprocess — quick tunnels (random trycloudflare.com URL, no account)
// and named tunnels (the user's own domain, via browser login).
package tunnel

import (
	"bufio"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"
)

const githubLatest = "https://github.com/cloudflare/cloudflared/releases/latest/download"

// assetFor maps the current platform to the cloudflared release asset name.
func assetFor() (name string, archive bool, err error) {
	switch runtime.GOOS {
	case "darwin":
		if runtime.GOARCH == "arm64" {
			return "cloudflared-darwin-arm64.tgz", true, nil
		}
		return "cloudflared-darwin-amd64.tgz", true, nil
	case "windows":
		if runtime.GOARCH == "amd64" {
			return "cloudflared-windows-amd64.exe", false, nil
		}
		return "cloudflared-windows-386.exe", false, nil
	case "linux":
		if runtime.GOARCH == "arm64" {
			return "cloudflared-linux-arm64", false, nil
		}
		if runtime.GOARCH == "arm" {
			return "cloudflared-linux-arm", false, nil
		}
		return "cloudflared-linux-amd64", false, nil
	}
	return "", false, fmt.Errorf("unsupported platform: %s/%s", runtime.GOOS, runtime.GOARCH)
}

func (m *Manager) binPath() string {
	name := "cloudflared"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	return filepath.Join(m.dir, "bin", name)
}

// downloadState is read by the status API while a download is in flight.
type downloadState struct {
	mu          sync.Mutex
	downloading bool
	progress    int
}

func (d *downloadState) get() (bool, int) {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.downloading, d.progress
}
func (d *downloadState) set(downloading bool, progress int) {
	d.mu.Lock()
	d.downloading, d.progress = downloading, progress
	d.mu.Unlock()
}

// ensureBinary downloads cloudflared if it is missing or invalid, returning its
// path. Concurrent callers share a single download.
func (m *Manager) ensureBinary() (string, error) {
	m.dlOnce.Lock()
	defer m.dlOnce.Unlock()

	bin := m.binPath()
	if validBinary(bin) {
		if runtime.GOOS != "windows" {
			_ = os.Chmod(bin, 0o755)
		}
		return bin, nil
	}
	_ = os.MkdirAll(filepath.Dir(bin), 0o755)

	asset, archive, err := assetFor()
	if err != nil {
		return "", err
	}
	url := githubLatest + "/" + asset

	tmp := bin + ".download"
	_ = os.Remove(tmp)
	if err := m.download(url, tmp); err != nil {
		_ = os.Remove(tmp)
		return "", fmt.Errorf("download cloudflared: %w", err)
	}

	if archive {
		// macOS assets are .tgz containing the `cloudflared` binary.
		if err := extractTgz(tmp, filepath.Dir(bin)); err != nil {
			_ = os.Remove(tmp)
			return "", fmt.Errorf("extract cloudflared: %w", err)
		}
		_ = os.Remove(tmp)
	} else {
		if err := os.Rename(tmp, bin); err != nil {
			return "", err
		}
	}
	if runtime.GOOS != "windows" {
		_ = os.Chmod(bin, 0o755)
	}
	if !validBinary(bin) {
		return "", fmt.Errorf("downloaded cloudflared is invalid")
	}
	return bin, nil
}

func (m *Manager) download(url, dest string) error {
	m.dl.set(true, 0)
	defer m.dl.set(false, 100)

	req, _ := http.NewRequest(http.MethodGet, url, nil)
	resp, err := m.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("status %d", resp.StatusCode)
	}

	f, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer f.Close()

	total := resp.ContentLength
	var got int64
	buf := make([]byte, 64*1024)
	for {
		n, rerr := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := f.Write(buf[:n]); werr != nil {
				return werr
			}
			got += int64(n)
			if total > 0 {
				m.dl.set(true, int(got*100/total))
			}
		}
		if rerr == io.EOF {
			break
		}
		if rerr != nil {
			return rerr
		}
	}
	return nil
}

const minBinarySize = 1 << 20 // 1MB; cloudflared is ~30MB

// validBinary checks size + magic bytes so a truncated/HTML-error download is
// not mistaken for a usable binary.
func validBinary(path string) bool {
	st, err := os.Stat(path)
	if err != nil || st.Size() < minBinarySize {
		return false
	}
	f, err := os.Open(path)
	if err != nil {
		return false
	}
	defer f.Close()
	magic := make([]byte, 4)
	if _, err := io.ReadFull(f, magic); err != nil {
		return false
	}
	hex := fmt.Sprintf("%x", magic)
	switch runtime.GOOS {
	case "windows":
		return strings.HasPrefix(hex, "4d5a") // PE "MZ"
	case "darwin":
		return strings.HasPrefix(hex, "cffaedfe") || strings.HasPrefix(hex, "cefaedfe") // Mach-O
	default:
		return strings.HasPrefix(hex, "7f454c46") // ELF
	}
}

// extractTgz pulls the cloudflared entry out of a .tgz into dir.
func extractTgz(tgz, dir string) error {
	// Use the system tar; it exists on macOS (the only .tgz target) and avoids
	// pulling an archive lib into the binary.
	cmd := exec.Command("tar", "-xzf", tgz, "-C", dir)
	return cmd.Run()
}

var (
	reQuickURL   = regexp.MustCompile(`https://([a-z0-9-]+)\.trycloudflare\.com`)
	reLoginURL   = regexp.MustCompile(`https://[^\s]*cloudflare[^\s]*`)
	reRegistered = regexp.MustCompile(`Registered tunnel connection`)
)

// runProc starts cloudflared with args, streaming combined stdout+stderr lines
// to onLine until the process exits. The caller keeps the returned *exec.Cmd to
// kill it. Lines are also useful for scraping URLs.
func (m *Manager) runProc(args []string, onLine func(string)) (*exec.Cmd, error) {
	bin, err := m.ensureBinary()
	if err != nil {
		return nil, err
	}
	cmd := exec.Command(bin, args...)
	hideWindow(cmd)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	scan := func(r io.Reader) {
		s := bufio.NewScanner(r)
		s.Buffer(make([]byte, 64*1024), 1<<20)
		for s.Scan() {
			if onLine != nil {
				onLine(s.Text())
			}
		}
	}
	go scan(stdout)
	go scan(stderr)
	return cmd, nil
}

// waitForLine runs cloudflared and resolves when a line matches `match`,
// returning the first capture group (or whole match). Times out otherwise.
func scrape(re *regexp.Regexp, line string) string {
	mm := re.FindStringSubmatch(line)
	if mm == nil {
		return ""
	}
	if len(mm) > 1 {
		return mm[0]
	}
	return mm[0]
}

func killCmd(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}
	_ = cmd.Process.Kill()
	// Reap in the background so we don't leak a zombie.
	go func() { _ = cmd.Wait() }()
}

// deadline helper for flows that must not hang forever.
func withTimeout(d time.Duration) <-chan time.Time { return time.After(d) }
