-- Photos attached to a spot (max 3, enforced in the API). The image bytes
-- live in the PHOTOS KV namespace under photo/<id>/full and photo/<id>/thumb;
-- this table is the index. Deleting a spot cascades here, but the API must
-- delete the KV keys itself (read the photo ids first).
CREATE TABLE spot_photos (
  id          TEXT PRIMARY KEY,
  spot_id     TEXT NOT NULL REFERENCES spots (id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  width       INTEGER NOT NULL,
  height      INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_spot_photos_spot_id ON spot_photos (spot_id);
