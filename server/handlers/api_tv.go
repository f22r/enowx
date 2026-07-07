package handlers

import (
	"bufio"
	"bytes"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/enowdev/enowx/server/middleware"
)

// TV proxies IPTV (HLS) streams so channels that block cross-origin playback
// (CORS) still work in the browser. It relays the .m3u8 playlist — rewriting the
// segment/child-playlist URLs back through this proxy — and the .ts segments.
// Gated by the dashboard guard like the other local-machine features.
type TV struct {
	dash   *middleware.Dashboard
	client *http.Client
}

func NewTV(dash *middleware.Dashboard) *TV {
	return &TV{dash: dash, client: &http.Client{Timeout: 30 * time.Second}}
}

// Proxy relays GET /api/tv/proxy?url=<stream>&ua=<user-agent>&ref=<referrer>.
func (h *TV) Proxy(w http.ResponseWriter, r *http.Request) {
	if !h.dash.Authorized(r) {
		writeAPIErr(w, http.StatusForbidden, "requires the dashboard login when accessed remotely")
		return
	}
	raw := r.URL.Query().Get("url")
	if raw == "" {
		writeAPIErr(w, http.StatusBadRequest, "url is required")
		return
	}
	target, err := url.Parse(raw)
	if err != nil || (target.Scheme != "http" && target.Scheme != "https") {
		writeAPIErr(w, http.StatusBadRequest, "invalid url")
		return
	}
	ua := r.URL.Query().Get("ua")
	ref := r.URL.Query().Get("ref")

	req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, raw, nil)
	if ua != "" {
		req.Header.Set("User-Agent", ua)
	} else {
		req.Header.Set("User-Agent", "Mozilla/5.0 (VLC)")
	}
	if ref != "" {
		req.Header.Set("Referer", ref)
	}
	resp, err := h.client.Do(req)
	if err != nil {
		writeAPIErr(w, http.StatusBadGateway, "upstream error: "+err.Error())
		return
	}
	defer resp.Body.Close()

	ct := resp.Header.Get("Content-Type")
	isPlaylist := strings.Contains(ct, "mpegurl") ||
		strings.HasSuffix(strings.ToLower(target.Path), ".m3u8")

	w.Header().Set("Access-Control-Allow-Origin", "*")
	if !isPlaylist {
		// A media segment (.ts/.aac/…) — stream it straight through.
		if ct != "" {
			w.Header().Set("Content-Type", ct)
		}
		w.WriteHeader(resp.StatusCode)
		_, _ = io.Copy(w, resp.Body)
		return
	}

	// A playlist: rewrite every URL (segments + child playlists) so they also
	// come back through this proxy, resolving relative URLs against the base.
	w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	rewritten := rewritePlaylist(string(body), target, ua, ref)
	w.WriteHeader(resp.StatusCode)
	_, _ = io.WriteString(w, rewritten)
}

// rewritePlaylist rewrites each URI line (and URI="..." attributes) in an M3U8 so
// it points at /api/tv/proxy?url=<absolute>, carrying ua/ref forward.
func rewritePlaylist(m3u8 string, base *url.URL, ua, ref string) string {
	proxied := func(ref0 string) string {
		abs, err := base.Parse(strings.TrimSpace(ref0))
		if err != nil {
			return ref0
		}
		q := url.Values{"url": {abs.String()}}
		if ua != "" {
			q.Set("ua", ua)
		}
		if ref != "" {
			q.Set("ref", ref)
		}
		return "/api/tv/proxy?" + q.Encode()
	}

	var out bytes.Buffer
	sc := bufio.NewScanner(strings.NewReader(m3u8))
	sc.Buffer(make([]byte, 0, 64*1024), 8<<20)
	for sc.Scan() {
		line := sc.Text()
		trimmed := strings.TrimSpace(line)
		switch {
		case trimmed == "" || (strings.HasPrefix(trimmed, "#") && !strings.Contains(trimmed, "URI=\"")):
			out.WriteString(line)
		case strings.Contains(trimmed, "URI=\""):
			// e.g. #EXT-X-KEY / #EXT-X-MEDIA with URI="..."
			out.WriteString(rewriteURIAttr(line, proxied))
		default:
			// A bare segment/child-playlist URL line.
			out.WriteString(proxied(trimmed))
		}
		out.WriteByte('\n')
	}
	return out.String()
}

func rewriteURIAttr(line string, proxied func(string) string) string {
	const key = `URI="`
	i := strings.Index(line, key)
	if i < 0 {
		return line
	}
	start := i + len(key)
	end := strings.Index(line[start:], `"`)
	if end < 0 {
		return line
	}
	uri := line[start : start+end]
	return line[:start] + proxied(uri) + line[start+end:]
}
