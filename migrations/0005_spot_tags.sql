-- Optional "heads-up" tags on a spot (dog, behind fence, cameras, ...), stored
-- as a JSON array of tag keys from SPOT_TAGS in shared/spot.ts. The API
-- validates on write and filters unknown keys on read.
ALTER TABLE spots ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
