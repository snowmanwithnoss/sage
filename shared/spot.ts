// Types and constants shared by the Worker (src/) and the SPA (web/).
// Keep this file dependency-free: it is compiled under both tsconfigs.

export const DANGER_MIN = 1;
export const DANGER_MAX = 5;
export const DANGER_DEFAULT = 3;

export const NAME_MAX = 100;
export const DESCRIPTION_MAX = 1000;

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
};

/** Fields a client sends to create or update a spot. */
export type SpotInput = {
  name: string;
  description: string;
  lat: number;
  lng: number;
  danger: number;
};
