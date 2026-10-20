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
};

/** Fields a client sends to create or update a spot. */
export type SpotInput = {
  name: string;
  description: string;
  lat: number;
  lng: number;
  danger: number;
};
