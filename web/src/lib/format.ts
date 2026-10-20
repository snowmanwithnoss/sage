import { DANGER_MAX } from "../api";

/** Short, friendly meaning of each danger rating (1–5): how likely you get chased. */
export const DANGER_LABELS: Record<number, string> = {
  1: "Help yourself",
  2: "Probably fine",
  3: "Be polite",
  4: "Ask first",
  5: "Run!",
};

export function dangerLabel(rating: number): string {
  return DANGER_LABELS[rating] ?? `${rating}/${DANGER_MAX}`;
}

export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Great-circle distance in metres. */
export function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  if (m < 10000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000)} km`;
}

/** "12 Oct 2026" from an ISO / SQLite datetime string; empty string if unparseable. */
export function formatDate(value: string): string {
  // SQLite's datetime('now') gives "YYYY-MM-DD HH:MM:SS" (UTC, no zone).
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/**
 * Google Street View at the nearest panorama (free Maps URLs deep link, no
 * key). The camera won't necessarily face the spot: we don't know where the
 * panorama is, so we can't compute a `heading`.
 */
export function streetViewUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

/** Deep link that opens the app with this spot selected (see `?spot=` handling in App). */
export function spotUrl(id: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("spot", id);
  return url.toString();
}

/** Lower-cases and strips accents so "Méliss" matches "melissa". */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
