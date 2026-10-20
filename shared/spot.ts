// Types and constants shared by the Worker (src/) and the SPA (web/).
// Keep this file dependency-free: it is compiled under both tsconfigs.

export const DANGER_MIN = 1;
export const DANGER_MAX = 5;
export const DANGER_DEFAULT = 3;

export const NAME_MAX = 100;
export const DESCRIPTION_MAX = 1000;

/** Max photos per spot. */
export const PHOTOS_MAX = 3;
/** Upload caps (bytes) and longest-edge sizes the client resizes to. */
export const PHOTO_FULL_MAX_BYTES = 1_500_000;
export const PHOTO_THUMB_MAX_BYTES = 150_000;
export const PHOTO_FULL_EDGE = 1600;
export const PHOTO_THUMB_EDGE = 400;

/** Optional "heads-up" tags, in display order. Keys are stored in D1 (JSON array). */
export const SPOT_TAGS = ["dog", "fence", "cameras", "ask", "footpath", "public"] as const;
export type SpotTag = (typeof SPOT_TAGS)[number];

export const SPOT_TAG_LABELS: Record<SpotTag, string> = {
  dog: "Dog",
  fence: "Behind fence / gate",
  cameras: "Security cameras",
  ask: "Private — ask first",
  footpath: "On footpath / nature strip",
  public: "Public space",
};

export function isSpotTag(value: unknown): value is SpotTag {
  return typeof value === "string" && (SPOT_TAGS as readonly string[]).includes(value);
}

/** How much each tag nudges the suggested danger rating. */
const TAG_DANGER_WEIGHTS: Record<SpotTag, number> = {
  dog: 2,
  fence: 1,
  cameras: 1,
  ask: 1,
  footpath: -1,
  public: -1,
};

/**
 * Danger rating suggested by a set of tags (base 1 plus each tag's weight,
 * clamped to the danger range), or null when there are no tags to go on.
 * A suggestion only: the user's own pick always wins.
 */
export function suggestDanger(tags: readonly SpotTag[]): number | null {
  if (tags.length === 0) return null;
  const raw = tags.reduce((sum, t) => sum + TAG_DANGER_WEIGHTS[t], DANGER_MIN);
  return Math.min(DANGER_MAX, Math.max(DANGER_MIN, raw));
}

/** A photo of a spot. Image URLs: /api/photos/<id>/full and /api/photos/<id>/thumb. */
export type SpotPhoto = {
  id: string;
  /** Pixel size of the full image (the thumb has the same aspect ratio). */
  width: number;
  height: number;
  position: number;
};

/** A spot as returned by the API. The owner's id is never exposed. */
export type Spot = {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  danger: number;
  created_at: string;
  /** True when the signed-in user created this spot. */
  is_mine: boolean;
  /** Ordered by position. */
  photos: SpotPhoto[];
  /** Heads-up tags, in SPOT_TAGS order. */
  tags: SpotTag[];
};

/** Fields a client sends to create or update a spot. */
export type SpotInput = {
  name: string;
  description: string;
  lat: number;
  lng: number;
  danger: number;
  /** POST: defaults to []. PATCH: omitted keeps the spot's current tags. */
  tags?: SpotTag[];
};
