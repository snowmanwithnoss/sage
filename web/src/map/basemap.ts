import type maplibregl from "maplibre-gl";
import type { Theme } from "../lib/hooks";
import { INITIAL_CENTER, INITIAL_ZOOM, MAX_ZOOM, sageMapStyle, type StyleOptions } from "./mapStyle";
import { RESERVOIR_BBOX } from "./reservoirArea";

/**
 * The single place the basemap is chosen. `useMap` calls this on creation and
 * again (via `map.setStyle`) whenever the colour scheme changes or the Vicmap
 * overlay switches on.
 */
export function basemapStyle(theme: Theme, options: StyleOptions = {}): maplibregl.StyleSpecification {
  return sageMapStyle(theme, options);
}

/** Below this zoom the Vicmap overlay (lots + street numbers) is never fetched. */
const VICMAP_MIN_ZOOM = 14;

/**
 * True once the view is close enough to Reservoir that the Vicmap overlay
 * (~1.8 MB gzipped) is worth downloading. One-way: `useMap` keeps it on.
 */
export function vicmapInView(map: maplibregl.Map): boolean {
  if (map.getZoom() < VICMAP_MIN_ZOOM) return false;
  const b = map.getBounds();
  const [w, s, e, n] = RESERVOIR_BBOX;
  return b.getWest() <= e && b.getEast() >= w && b.getSouth() <= n && b.getNorth() >= s;
}

/**
 * Reservoir, Melbourne at street level (z15), so the first thing you see is
 * houses and streets you can drop a pin on. Zoom goes to z20 for pin placement.
 */
export const INITIAL_VIEW = { center: INITIAL_CENTER, zoom: INITIAL_ZOOM, maxZoom: MAX_ZOOM };
