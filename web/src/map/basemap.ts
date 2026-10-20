import type maplibregl from "maplibre-gl";
import type { Theme } from "../lib/hooks";
import { MELBOURNE_CENTER, MELBOURNE_ZOOM, sageMapStyle } from "./mapStyle";

/**
 * The single place the basemap is chosen. `useMap` calls this on creation and
 * again (via `map.setStyle`) whenever the colour scheme changes.
 */
export function basemapStyle(theme: Theme): maplibregl.StyleSpecification {
  return sageMapStyle(theme);
}

/** Inner Melbourne. */
export const INITIAL_VIEW = { center: MELBOURNE_CENTER, zoom: MELBOURNE_ZOOM };
