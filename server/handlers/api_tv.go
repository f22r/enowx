package handlers

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
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

	mu       sync.RWMutex
	channels []tvChannel // full catalog (loaded once from iptv-org)
	online   map[string]bool
	loaded   bool
	checked  int // how many channels probed at least once (progress)
}

// tvChannel is one channel: metadata + its stream URL and any headers it needs.
type tvChannel struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Logo       string   `json:"logo,omitempty"`
	Country    string   `json:"country"`
	Categories []string `json:"categories"`
	URL        string   `json:"url"`
	Quality    string   `json:"quality,omitempty"`
	UA         string   `json:"ua,omitempty"`
	Ref        string   `json:"ref,omitempty"`
}

func NewTV(dash *middleware.Dashboard) *TV {
	t := &TV{
		dash:   dash,
		client: &http.Client{Timeout: 30 * time.Second},
		online: map[string]bool{},
	}
	go t.run()
	return t
}

// Channels returns the channels probed online so far, newest-first-known. While
// the first pass is still running it returns whatever is confirmed online plus a
// "loading" flag + progress, so the UI can show results as they come in.
func (h *TV) Channels(w http.ResponseWriter, r *http.Request) {
	if !h.dash.Authorized(r) {
		writeAPIErr(w, http.StatusForbidden, "requires the dashboard login when accessed remotely")
		return
	}
	h.mu.RLock()
	out := make([]tvChannel, 0, len(h.online))
	for _, c := range h.channels {
		if h.online[c.ID] {
			out = append(out, c)
		}
	}
	loading := !h.loaded || h.checked < len(h.channels)
	total := len(h.channels)
	checked := h.checked
	h.mu.RUnlock()
	writeData(w, map[string]any{"channels": out, "loading": loading, "checked": checked, "total": total})
}

// --- background service: load catalog, probe sports first, then the rest ---

func (h *TV) run() {
	if err := h.load(); err != nil {
		return
	}
	for {
		h.probeAll()
		time.Sleep(15 * time.Minute) // re-probe periodically (channels go up/down)
	}
}

// load fetches the iptv-org streams + channels and merges them into the catalog,
// skipping geo-blocked / not-24-7 streams. Sports channels are placed first so
// they're probed first.
func (h *TV) load() error {
	// The fields we read; the JSON has nulls we tolerate via pointer-less strings.
	var streams []struct {
		Channel   *string `json:"channel"`
		URL       string  `json:"url"`
		Quality   *string `json:"quality"`
		UserAgent *string `json:"user_agent"`
		Referrer  *string `json:"referrer"`
		Label     *string `json:"label"`
	}
	if err := h.getJSON("https://iptv-org.github.io/api/streams.json", &streams); err != nil {
		return err
	}
	var chans []struct {
		ID         string   `json:"id"`
		Name       string   `json:"name"`
		Country    string   `json:"country"`
		Categories []string `json:"categories"`
	}
	if err := h.getJSON("https://iptv-org.github.io/api/channels.json", &chans); err != nil {
		return err
	}
	// Logos live in a separate dataset keyed by channel id.
	var logos []struct {
		Channel string `json:"channel"`
		URL     string `json:"url"`
	}
	_ = h.getJSON("https://iptv-org.github.io/api/logos.json", &logos)
	logoOf := make(map[string]string, len(logos))
	for _, l := range logos {
		if _, ok := logoOf[l.Channel]; !ok {
			logoOf[l.Channel] = l.URL
		}
	}
	type chMeta struct {
		Name, Country, Logo string
		Categories          []string
	}
	meta := make(map[string]chMeta, len(chans))
	for _, c := range chans {
		meta[c.ID] = chMeta{c.Name, c.Country, logoOf[c.ID], c.Categories}
	}

	seen := map[string]bool{}
	var sports, rest []tvChannel
	str := func(p *string) string {
		if p == nil {
			return ""
		}
		return *p
	}
	for _, s := range streams {
		if s.Channel == nil || s.URL == "" || seen[*s.Channel] {
			continue
		}
		lbl := strings.ToLower(str(s.Label))
		if strings.Contains(lbl, "geo-blocked") || strings.Contains(lbl, "not 24/7") {
			continue
		}
		m, ok := meta[*s.Channel]
		if !ok {
			continue
		}
		seen[*s.Channel] = true
		c := tvChannel{
			ID: *s.Channel, Name: m.Name, Country: m.Country, Categories: m.Categories,
			URL: s.URL, Quality: str(s.Quality), UA: str(s.UserAgent), Ref: str(s.Referrer),
			Logo: m.Logo,
		}
		isSport := false
		for _, cat := range m.Categories {
			if cat == "sports" {
				isSport = true
				break
			}
		}
		if isSport {
			sports = append(sports, c)
		} else {
			rest = append(rest, c)
		}
	}

	h.mu.Lock()
	h.channels = append(sports, rest...) // sports first → probed first
	h.loaded = true
	h.mu.Unlock()
	return nil
}

// probeAll probes every channel with bounded concurrency, updating online status
// incrementally so Channels() reflects progress live.
func (h *TV) probeAll() {
	h.mu.RLock()
	list := make([]tvChannel, len(h.channels))
	copy(list, h.channels)
	h.mu.RUnlock()

	sem := make(chan struct{}, 24) // 24 concurrent probes
	var wg sync.WaitGroup
	var done int
	var dmu sync.Mutex
	for _, c := range list {
		sem <- struct{}{}
		wg.Add(1)
		go func(c tvChannel) {
			defer wg.Done()
			defer func() { <-sem }()
			ok := h.probe(c.URL, c.UA, c.Ref)
			h.mu.Lock()
			h.online[c.ID] = ok
			h.mu.Unlock()
			dmu.Lock()
			done++
			h.mu.Lock()
			if done > h.checked {
				h.checked = done
			}
			h.mu.Unlock()
			dmu.Unlock()
		}(c)
	}
	wg.Wait()
}

// probe fetches the first bytes of a stream and checks it's a valid m3u8.
func (h *TV) probe(raw, ua, ref string) bool {
	client := &http.Client{Timeout: 6 * time.Second}
	req, err := http.NewRequest(http.MethodGet, raw, nil)
	if err != nil {
		return false
	}
	if ua == "" {
		ua = "Mozilla/5.0 (VLC)"
	}
	req.Header.Set("User-Agent", ua)
	if ref != "" {
		req.Header.Set("Referer", ref)
	}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return false
	}
	head, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	return bytes.Contains(head, []byte("#EXTM3U"))
}

func (h *TV) getJSON(url string, dst any) error {
	resp, err := h.client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
	if err != nil {
		return err
	}
	return json.Unmarshal(b, dst)
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
