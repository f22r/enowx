-- Per-user local model aliases: call a model by a custom name that routes to the
-- real model id at request time. Local to this enowx instance (not synced).
CREATE TABLE IF NOT EXISTS model_aliases (
    alias      TEXT PRIMARY KEY,
    target     TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
