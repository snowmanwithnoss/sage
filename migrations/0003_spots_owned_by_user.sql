-- Spots now belong to a user. Existing spots were test data and are wiped.
-- WARNING: applying this to a database deletes every existing spot.
DROP TABLE IF EXISTS spots;

CREATE TABLE spots (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  danger      INTEGER NOT NULL DEFAULT 3 CHECK (danger BETWEEN 1 AND 5),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_spots_user_id ON spots (user_id);
CREATE INDEX idx_spots_created_at ON spots (created_at);
