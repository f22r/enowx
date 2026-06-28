package openaicompat

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/enowdev/enowx/core/model"
)

// sseStream reads OpenAI's `data: {...}` SSE chunks and yields normalized events.
type sseStream struct {
	resp *http.Response
	sc   *bufio.Scanner
	done bool
}

func newSSEStream(resp *http.Response) *sseStream {
	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	return &sseStream{resp: resp, sc: sc}
}

func (s *sseStream) Recv() (model.Event, error) {
	if s.done {
		return model.Event{}, io.EOF
	}
	for s.sc.Scan() {
		line := bytes.TrimSpace(s.sc.Bytes())
		if !bytes.HasPrefix(line, dataPrefix) {
			continue
		}
		payload := bytes.TrimSpace(line[len(dataPrefix):])
		if bytes.Equal(payload, doneMarker) {
			s.done = true
			return model.Event{Type: model.EventDone}, nil
		}
		var chunk chatChunk
		if err := json.Unmarshal(payload, &chunk); err != nil {
			continue
		}
		if txt := chunk.delta(); txt != "" {
			return model.Event{Type: model.EventDelta, Text: txt, Model: chunk.Model}, nil
		}
	}
	if err := s.sc.Err(); err != nil {
		return model.Event{}, err
	}
	s.done = true
	return model.Event{Type: model.EventDone}, nil
}

func (s *sseStream) Close() error { return s.resp.Body.Close() }

// jsonStream wraps a non-streaming reply as a single delta + done.
type jsonStream struct {
	ev   model.Event
	sent bool
	doneSent bool
}

func newJSONStream(resp *http.Response) (*jsonStream, error) {
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var parsed chatResponse
	_ = json.Unmarshal(b, &parsed)
	return &jsonStream{ev: model.Event{Type: model.EventDelta, Text: parsed.text(), Model: parsed.Model}}, nil
}

func (s *jsonStream) Recv() (model.Event, error) {
	if !s.sent {
		s.sent = true
		return s.ev, nil
	}
	if !s.doneSent {
		s.doneSent = true
		return model.Event{Type: model.EventDone}, nil
	}
	return model.Event{}, io.EOF
}

func (s *jsonStream) Close() error { return nil }

var (
	dataPrefix = []byte("data:")
	doneMarker = []byte("[DONE]")
)
