-- Extra per-request detail for the Requests log: which proxy carried the request
-- (empty = direct) and which account (label) served it. Both default to '' so
-- old rows and un-instrumented paths stay valid.
ALTER TABLE request_logs ADD COLUMN proxy_used TEXT NOT NULL DEFAULT '';
ALTER TABLE request_logs ADD COLUMN account_label TEXT NOT NULL DEFAULT '';
