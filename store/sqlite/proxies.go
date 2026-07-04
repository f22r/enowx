package sqlite

import (
	"context"
	"database/sql"

	"github.com/enowdev/enowx/core/syncbus"
	"github.com/enowdev/enowx/store"
)

type proxyStore struct{ db *sql.DB }

func (s *proxyStore) List(ctx context.Context) ([]store.Proxy, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, label, scheme, host, port, username, password, enabled, status,
		        latency_ms, COALESCE(last_checked,''), created_at
		 FROM proxies ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []store.Proxy{}
	for rows.Next() {
		var p store.Proxy
		if err := rows.Scan(&p.ID, &p.Label, &p.Scheme, &p.Host, &p.Port, &p.Username, &p.Password,
			&p.Enabled, &p.Status, &p.LatencyMS, &p.LastChecked, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *proxyStore) Add(ctx context.Context, p store.Proxy) (int64, error) {
	// Upsert on the unique identity so re-adding the same proxy (e.g. from a bulk
	// paste or a sync pull) doesn't error — it just refreshes the label.
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO proxies (label, scheme, host, port, username, password)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(scheme, host, port, username) DO UPDATE SET label = excluded.label`,
		p.Label, nz(p.Scheme, "http"), p.Host, p.Port, p.Username, p.Password)
	if err != nil {
		return 0, err
	}
	syncbus.Dirty("proxy")
	return res.LastInsertId()
}

func (s *proxyStore) Delete(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM proxies WHERE id = ?`, id)
	if err == nil {
		syncbus.Dirty("proxy")
	}
	return err
}

func (s *proxyStore) SetEnabled(ctx context.Context, id int64, enabled bool) error {
	_, err := s.db.ExecContext(ctx, `UPDATE proxies SET enabled = ? WHERE id = ?`, enabled, id)
	if err == nil {
		syncbus.Dirty("proxy")
	}
	return err
}

// SetStatus records the outcome of a health check (not synced — status is
// per-device runtime state, not shared config).
func (s *proxyStore) SetStatus(ctx context.Context, id int64, status string, latencyMS int) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE proxies SET status = ?, latency_ms = ?, last_checked = CURRENT_TIMESTAMP WHERE id = ?`,
		status, latencyMS, id)
	return err
}
