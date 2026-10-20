import type maplibregl from "maplibre-gl";
import type { Theme } from "../lib/hooks";
import { INITIAL_CENTER, INITIAL_ZOOM, MAX_ZOOM, sageMapStyle } from "./mapStyle";

/**
 * The single place the basemap is chosen. `useMap` calls this on creation and
 * again (via `map.setStyle`) whenever the colour scheme changes.
 */
export function basemapStyle(theme: Theme): maplibregl.StyleSpecification {
  return sageMapStyle(theme);
}

/**
 * Reservoir, Melbourne at street level (z15), so the first thing you see is
 * houses and streets you can drop a pin on. Zoom goes to z20 for pin placement.
 */
export const INITIAL_VIEW = { center: INITIAL_CENTER, zoom: INITIAL_ZOOM, maxZoom: MAX_ZOOM };
