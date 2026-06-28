// Package sqlite is the default Store impl (modernc, CGO-free).
package sqlite

import (
	"database/sql"
	"embed"
	"fmt"

	_ "modernc.org/sqlite"

	"github.com/enowdev/enowx/store"
)

//go:embed migrations/*.sql
var migrations embed.FS

type DB struct {
	db   *sql.DB
	acct *accountStore
	logs *logStore
}

func Open(path string) (*DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if err := migrate(db); err != nil {
		db.Close()
		return nil, err
	}
	d := &DB{db: db}
	d.acct = &accountStore{db: db}
	d.logs = &logStore{db: db}
	return d, nil
}

func (d *DB) Accounts() store.AccountStore { return d.acct }
func (d *DB) Logs() store.LogStore         { return d.logs }
func (d *DB) Close() error                 { return d.db.Close() }

func migrate(db *sql.DB) error {
	b, err := migrations.ReadFile("migrations/001_init.sql")
	if err != nil {
		return err
	}
	if _, err := db.Exec(string(b)); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}
