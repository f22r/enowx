-- Outbound proxy pool. Upstream provider requests can be routed through these
-- (per the proxy_* settings). Credentials are stored as-is locally; the sync
-- layer encrypts them before they leave the device.
CREATE TABLE IF NOT EXISTS proxies (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    label        TEXT NOT NULL DEFAULT '',
    scheme       TEXT NOT NULL DEFAULT 'http', -- http | https | socks5 | socks5h
    host         TEXT NOT NULL,
    port         INTEGER NOT NULL,
    username     TEXT NOT NULL DEFAULT '',
    password     TEXT NOT NULL DEFAULT '',
    enabled      INTEGER NOT NULL DEFAULT 1,
    status       TEXT NOT NULL DEFAULT 'unknown', -- unknown | ok | dead
    latency_ms   INTEGER NOT NULL DEFAULT 0,
    last_checked TIMESTAMP,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(scheme, host, port, username)
);
