-- Sage D1 schema
-- Note: the CHECK on `danger` only applies to fresh DBs; the live table got the column
-- via ALTER TABLE (SQLite can't add a CHECK that way), so API validation is the real guard.
CREATE TABLE IF NOT EXISTS spots (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  danger      INTEGER NOT NULL DEFAULT 3 CHECK (danger BETWEEN 1 AND 5),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_spots_created_at ON spots (created_at);
