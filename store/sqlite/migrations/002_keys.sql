CREATE TABLE IF NOT EXISTS api_keys (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    label          TEXT NOT NULL DEFAULT '',
    secret         TEXT NOT NULL,
    token_limit    INTEGER NOT NULL DEFAULT 0,
    tokens_used    INTEGER NOT NULL DEFAULT 0,
    max_concurrent INTEGER NOT NULL DEFAULT 0,
    expires_at     TIMESTAMP,
    enabled        INTEGER NOT NULL DEFAULT 1,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used      TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_secret ON api_keys(secret);
