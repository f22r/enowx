-- Content filters: pattern→replacement rules applied to upstream request text
-- (obfuscate) and reversed on the downstream reply (deobfuscate). Used to get
-- past providers that block certain words (brand names, etc.).
CREATE TABLE IF NOT EXISTS content_filters (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern     TEXT NOT NULL,
    replacement TEXT NOT NULL DEFAULT '',
    is_regex    INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    sort        INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
