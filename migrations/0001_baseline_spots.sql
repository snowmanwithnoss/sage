-- Baseline: the spots table as it existed before migrations (formerly schema.sql).
-- IF NOT EXISTS so this is a no-op on databases created from the old schema.sql.
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
