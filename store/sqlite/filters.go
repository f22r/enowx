package sqlite

import (
	"context"
	"database/sql"

	"github.com/enowdev/enowx/store"
)

type filterStore struct{ db *sql.DB }

func (s *filterStore) List(ctx context.Context) ([]store.ContentFilter, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, pattern, replacement, is_regex, is_active FROM content_filters ORDER BY sort, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []store.ContentFilter{}
	for rows.Next() {
		var f store.ContentFilter
		if err := rows.Scan(&f.ID, &f.Pattern, &f.Replacement, &f.IsRegex, &f.IsActive); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

func (s *filterStore) Add(ctx context.Context, f store.ContentFilter) (int64, error) {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO content_filters (pattern, replacement, is_regex, is_active) VALUES (?, ?, ?, ?)`,
		f.Pattern, f.Replacement, f.IsRegex, f.IsActive)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *filterStore) Update(ctx context.Context, f store.ContentFilter) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE content_filters SET pattern=?, replacement=?, is_regex=?, is_active=? WHERE id=?`,
		f.Pattern, f.Replacement, f.IsRegex, f.IsActive, f.ID)
	return err
}

func (s *filterStore) Delete(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM content_filters WHERE id = ?`, id)
	return err
}
