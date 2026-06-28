package sqlite

import (
	"context"
	"database/sql"

	"github.com/enowdev/enowx/store"
)

type logStore struct{ db *sql.DB }

func (s *logStore) Insert(ctx context.Context, l store.RequestLog) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO request_logs (provider, model, status, in_tokens, out_tokens, latency_ms)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		l.Provider, l.Model, l.Status, l.InTokens, l.OutTokens, l.LatencyMS)
	return err
}

func (s *logStore) Recent(ctx context.Context, limit int) ([]store.RequestLog, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, provider, model, status, in_tokens, out_tokens, latency_ms, created_at
		 FROM request_logs ORDER BY created_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.RequestLog
	for rows.Next() {
		var l store.RequestLog
		if err := rows.Scan(&l.ID, &l.Provider, &l.Model, &l.Status, &l.InTokens, &l.OutTokens, &l.LatencyMS, &l.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}
