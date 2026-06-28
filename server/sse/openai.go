// Package sse encodes a normalized model.Stream into OpenAI-style SSE on the
// wire. Other wire formats get their own encoder here later.
package sse

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/enowdev/enowx/core/model"
)

// WriteOpenAI streams events as `data: {chat.completion.chunk}` lines.
func WriteOpenAI(w http.ResponseWriter, s model.Stream) {
	fl, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "stream unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.WriteHeader(http.StatusOK)
	defer s.Close()

	for {
		ev, err := s.Recv()
		if err == io.EOF {
			return
		}
		if err != nil || ev.Type == model.EventError {
			return
		}
		if ev.Type == model.EventDone {
			fmt.Fprint(w, "data: [DONE]\n\n")
			fl.Flush()
			return
		}
		emit(w, fl, chunk(ev))
	}
}

func emit(w io.Writer, fl http.Flusher, v any) {
	b, _ := json.Marshal(v)
	fmt.Fprintf(w, "data: %s\n\n", b)
	fl.Flush()
}

func chunk(ev model.Event) map[string]any {
	return map[string]any{
		"object": "chat.completion.chunk",
		"model":  ev.Model,
		"choices": []map[string]any{{
			"index": 0,
			"delta": map[string]any{"content": ev.Text},
		}},
	}
}
