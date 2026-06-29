package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/kkdai/youtube/v2"
)

// Music powers the Music app: it searches YouTube Music for songs and proxies
// the chosen track's audio stream so the browser can play it.
//
// Why a backend proxy: the resolved googlevideo URLs are CORS-blocked and
// often signature-ciphered, so a browser <audio> tag cannot fetch them
// directly. We resolve the playable URL here and stream the bytes through,
// forwarding Range headers so the player can seek.
type Music struct {
	yt    youtube.Client
	http  *http.Client
	mu    sync.Mutex
	cache map[string]urlEntry // videoID -> resolved audio URL (short-lived)
}

type urlEntry struct {
	url string
	exp time.Time
}

func NewMusic() *Music {
	return &Music{
		http:  &http.Client{Timeout: 30 * time.Second},
		cache: map[string]urlEntry{},
	}
}

type musicTrack struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Artist    string `json:"artist"`
	Album     string `json:"album"`
	Duration  string `json:"duration"`
	Thumbnail string `json:"thumbnail"`
}

// innerTube is YouTube Music's private API. Public song search works without
// any auth cookies (logged_in: 0); we send the standard WEB_REMIX context.
const innerTubeSearch = "https://music.youtube.com/youtubei/v1/search?prettyPrint=false"

// songsParam restricts results to the "Songs" tab so we only get playable tracks.
const songsParam = "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D"

func (h *Music) Search(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeData(w, []musicTrack{})
		return
	}

	body, _ := json.Marshal(map[string]any{
		"query":  q,
		"params": songsParam,
		"context": map[string]any{
			"client": map[string]any{
				"clientName":    "WEB_REMIX",
				"clientVersion": "1.20240101.00.00",
				"hl":            "en",
				"gl":            "US",
			},
		},
	})

	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, innerTubeSearch, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://music.youtube.com")

	resp, err := h.http.Do(req)
	if err != nil {
		writeAPIErr(w, http.StatusBadGateway, "search failed: "+err.Error())
		return
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		writeAPIErr(w, http.StatusBadGateway, "search read failed")
		return
	}

	var parsed any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		writeAPIErr(w, http.StatusBadGateway, "search decode failed")
		return
	}
	writeData(w, parseSongResults(parsed))
}

// parseSongResults walks the InnerTube response for musicResponsiveListItem
// renderers (one per song row) and extracts the fields we need.
func parseSongResults(root any) []musicTrack {
	out := []musicTrack{}
	seen := map[string]bool{}
	var walk func(any)
	walk = func(n any) {
		switch v := n.(type) {
		case map[string]any:
			if item, ok := v["musicResponsiveListItemRenderer"].(map[string]any); ok {
				if t, ok := songFromRenderer(item); ok && !seen[t.ID] {
					seen[t.ID] = true
					out = append(out, t)
				}
			}
			for _, child := range v {
				walk(child)
			}
		case []any:
			for _, child := range v {
				walk(child)
			}
		}
	}
	walk(root)
	return out
}

func songFromRenderer(item map[string]any) (musicTrack, bool) {
	id := firstVideoID(item)
	if id == "" {
		return musicTrack{}, false
	}
	t := musicTrack{ID: id, Thumbnail: lastThumbnail(item)}

	cols, _ := item["flexColumns"].([]any)
	if len(cols) > 0 {
		t.Title = flexText(cols[0])
	}
	if len(cols) > 1 {
		// Subtitle runs look like: Artist • Album • 3:45 (separators are " • ").
		parts := splitRuns(flexText(cols[1]))
		switch len(parts) {
		case 0:
		case 1:
			t.Artist = parts[0]
		default:
			t.Artist = parts[0]
			t.Album = parts[1]
			if last := parts[len(parts)-1]; looksLikeDuration(last) {
				t.Duration = last
				if len(parts) == 2 {
					t.Album = ""
				}
			}
		}
	}
	if t.Title == "" {
		return musicTrack{}, false
	}
	return t, true
}

// flexText pulls the joined run text out of a flex column renderer.
func flexText(col any) string {
	m, ok := col.(map[string]any)
	if !ok {
		return ""
	}
	r, ok := m["musicResponsiveListItemFlexColumnRenderer"].(map[string]any)
	if !ok {
		return ""
	}
	text, ok := r["text"].(map[string]any)
	if !ok {
		return ""
	}
	runs, ok := text["runs"].([]any)
	if !ok {
		return ""
	}
	var b strings.Builder
	for _, run := range runs {
		if rm, ok := run.(map[string]any); ok {
			if s, ok := rm["text"].(string); ok {
				b.WriteString(s)
			}
		}
	}
	return b.String()
}

func splitRuns(s string) []string {
	parts := strings.Split(s, "•")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func looksLikeDuration(s string) bool {
	if !strings.Contains(s, ":") {
		return false
	}
	for _, c := range s {
		if (c < '0' || c > '9') && c != ':' {
			return false
		}
	}
	return true
}

// firstVideoID returns the nearest videoId in the subtree.
func firstVideoID(n any) string {
	var found string
	var walk func(any)
	walk = func(n any) {
		if found != "" {
			return
		}
		switch v := n.(type) {
		case map[string]any:
			if id, ok := v["videoId"].(string); ok && id != "" {
				found = id
				return
			}
			for _, c := range v {
				walk(c)
			}
		case []any:
			for _, c := range v {
				walk(c)
			}
		}
	}
	walk(n)
	return found
}

// lastThumbnail returns the highest-resolution thumbnail URL in the subtree.
func lastThumbnail(n any) string {
	var found string
	var walk func(any)
	walk = func(n any) {
		switch v := n.(type) {
		case map[string]any:
			if thumbs, ok := v["thumbnails"].([]any); ok && len(thumbs) > 0 {
				if last, ok := thumbs[len(thumbs)-1].(map[string]any); ok {
					if u, ok := last["url"].(string); ok && u != "" {
						found = u
					}
				}
			}
			for _, c := range v {
				walk(c)
			}
		case []any:
			for _, c := range v {
				walk(c)
			}
		}
	}
	walk(n)
	return found
}

// Stream resolves the best audio-only format for a video and proxies its bytes,
// forwarding Range so the <audio> element can seek.
func (h *Music) Stream(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.URL.Query().Get("id"))
	if id == "" {
		http.Error(w, "id required", http.StatusBadRequest)
		return
	}

	streamURL, err := h.resolve(id)
	if err != nil {
		http.Error(w, "resolve failed: "+err.Error(), http.StatusBadGateway)
		return
	}

	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, streamURL, nil)
	if err != nil {
		http.Error(w, "bad upstream url", http.StatusBadGateway)
		return
	}
	if rng := r.Header.Get("Range"); rng != "" {
		req.Header.Set("Range", rng)
	}

	resp, err := h.http.Do(req)
	if err != nil {
		http.Error(w, "upstream fetch failed", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	// Forward the headers that matter for seeking/streaming audio.
	for _, k := range []string{"Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"} {
		if v := resp.Header.Get(k); v != "" {
			w.Header().Set(k, v)
		}
	}
	if w.Header().Get("Content-Type") == "" {
		w.Header().Set("Content-Type", "audio/mp4")
	}
	if w.Header().Get("Accept-Ranges") == "" {
		w.Header().Set("Accept-Ranges", "bytes")
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// resolve returns a playable audio URL for the video, caching it briefly since
// resolving (which decodes the signature cipher) is the slow part.
func (h *Music) resolve(id string) (string, error) {
	h.mu.Lock()
	if e, ok := h.cache[id]; ok && time.Now().Before(e.exp) {
		h.mu.Unlock()
		return e.url, nil
	}
	h.mu.Unlock()

	v, err := h.yt.GetVideo(id)
	if err != nil {
		return "", err
	}
	formats := v.Formats.WithAudioChannels().Type("audio")
	if len(formats) == 0 {
		formats = v.Formats.WithAudioChannels()
	}
	if len(formats) == 0 {
		return "", errNoAudio
	}
	formats.Sort() // best first
	best := formats[0]

	url, err := h.yt.GetStreamURL(v, &best)
	if err != nil {
		return "", err
	}
	h.mu.Lock()
	h.cache[id] = urlEntry{url: url, exp: time.Now().Add(20 * time.Minute)}
	h.mu.Unlock()
	return url, nil
}

var errNoAudio = errString("no audio stream available")

type errString string

func (e errString) Error() string { return string(e) }
