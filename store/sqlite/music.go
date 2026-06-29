package sqlite

import (
	"context"
	"database/sql"

	"github.com/enowdev/enowx/store"
)

type musicStore struct{ db *sql.DB }

func (s *musicStore) ListPlaylists(ctx context.Context) ([]store.Playlist, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT p.id, p.name, p.description, p.share_code, p.created_at,
		        (SELECT COUNT(*) FROM playlist_tracks t WHERE t.playlist_id = p.id) AS cnt
		 FROM playlists p ORDER BY p.created_at DESC, p.id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []store.Playlist
	for rows.Next() {
		var p store.Playlist
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.ShareCode, &p.CreatedAt, &p.Count); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *musicStore) GetPlaylist(ctx context.Context, id int64) (*store.Playlist, error) {
	var p store.Playlist
	err := s.db.QueryRowContext(ctx,
		`SELECT id, name, description, share_code, created_at FROM playlists WHERE id = ?`, id).
		Scan(&p.ID, &p.Name, &p.Description, &p.ShareCode, &p.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	tracks, err := s.tracks(ctx, p.ID)
	if err != nil {
		return nil, err
	}
	p.Tracks = tracks
	p.Count = len(tracks)
	return &p, nil
}

func (s *musicStore) PlaylistByShareCode(ctx context.Context, code string) (*store.Playlist, error) {
	var p store.Playlist
	err := s.db.QueryRowContext(ctx,
		`SELECT id, name, description, share_code, created_at FROM playlists WHERE share_code = ?`, code).
		Scan(&p.ID, &p.Name, &p.Description, &p.ShareCode, &p.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	tracks, err := s.tracks(ctx, p.ID)
	if err != nil {
		return nil, err
	}
	p.Tracks = tracks
	p.Count = len(tracks)
	return &p, nil
}

func (s *musicStore) tracks(ctx context.Context, playlistID int64) ([]store.MusicTrack, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT video_id, title, artist, album, duration, thumbnail
		 FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC, id ASC`, playlistID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []store.MusicTrack{}
	for rows.Next() {
		var t store.MusicTrack
		if err := rows.Scan(&t.VideoID, &t.Title, &t.Artist, &t.Album, &t.Duration, &t.Thumbnail); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *musicStore) CreatePlaylist(ctx context.Context, name, description, shareCode string) (int64, error) {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO playlists (name, description, share_code) VALUES (?, ?, ?)`,
		name, description, shareCode)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *musicStore) DeletePlaylist(ctx context.Context, id int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `DELETE FROM playlist_tracks WHERE playlist_id = ?`, id); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM playlists WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *musicStore) AddTrack(ctx context.Context, playlistID int64, t store.MusicTrack) error {
	// Append to the end; ignore if the track is already in the playlist.
	var pos int
	_ = s.db.QueryRowContext(ctx,
		`SELECT COALESCE(MAX(position)+1, 0) FROM playlist_tracks WHERE playlist_id = ?`, playlistID).Scan(&pos)
	_, err := s.db.ExecContext(ctx,
		`INSERT OR IGNORE INTO playlist_tracks
		   (playlist_id, video_id, title, artist, album, duration, thumbnail, position)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		playlistID, t.VideoID, t.Title, t.Artist, t.Album, t.Duration, t.Thumbnail, pos)
	return err
}

func (s *musicStore) RemoveTrack(ctx context.Context, playlistID int64, videoID string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM playlist_tracks WHERE playlist_id = ? AND video_id = ?`, playlistID, videoID)
	return err
}

func (s *musicStore) RecordPlay(ctx context.Context, e store.PlayEvent) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO play_history (video_id, title, artist, album) VALUES (?, ?, ?, ?)`,
		e.VideoID, e.Title, e.Artist, e.Album)
	return err
}

func (s *musicStore) RecentPlays(ctx context.Context, limit int) ([]store.MusicTrack, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	// Most recent distinct tracks (latest play wins).
	rows, err := s.db.QueryContext(ctx,
		`SELECT video_id, title, artist, album FROM play_history
		 WHERE id IN (SELECT MAX(id) FROM play_history GROUP BY video_id)
		 ORDER BY id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []store.MusicTrack{}
	for rows.Next() {
		var t store.MusicTrack
		if err := rows.Scan(&t.VideoID, &t.Title, &t.Artist, &t.Album); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *musicStore) TopArtists(ctx context.Context, limit int) ([]store.ArtistCount, error) {
	if limit <= 0 || limit > 50 {
		limit = 8
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT artist, COUNT(*) AS plays FROM play_history
		 WHERE artist <> '' GROUP BY artist ORDER BY plays DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []store.ArtistCount{}
	for rows.Next() {
		var a store.ArtistCount
		if err := rows.Scan(&a.Artist, &a.Plays); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *musicStore) ClearHistory(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM play_history`)
	return err
}
