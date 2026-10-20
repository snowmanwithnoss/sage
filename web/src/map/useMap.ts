import { useEffect, useRef, useState, type RefObject } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Theme } from "../lib/hooks";
import { basemapStyle, INITIAL_VIEW, vicmapInView } from "./basemap";

/**
 * Creates the MapLibre map in `containerRef` and returns it once its style
 * has loaded (null before that). Re-applies the basemap when `theme` changes,
 * and once when the view first reaches Reservoir (adds the Vicmap overlay).
 */
export function useMap(containerRef: RefObject<HTMLDivElement>, theme: Theme): maplibregl.Map | null {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const themeRef = useRef(theme);
  const appliedThemeRef = useRef(theme);
  themeRef.current = theme;
  // Vicmap lots + street numbers: off until the view first reaches Reservoir
  // at street zoom, then on for good (part of every later style, so theme
  // swaps keep the already-downloaded GeoJSON — the diff sees no change).
  const [vicmap, setVicmap] = useState(false);
  const appliedVicmapRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const m = new maplibregl.Map({
      container,
      style: basemapStyle(themeRef.current),
      center: INITIAL_VIEW.center,
      zoom: INITIAL_VIEW.zoom,
      maxZoom: INITIAL_VIEW.maxZoom,
      // Pinch zoom on phones, scroll/keyboard zoom on desktop; no +/- buttons.
      attributionControl: false,
      // Rotate yes, tilt no: the map is flat (top-down is easiest for placing
      // a pin on the right house).
      dragRotate: true,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
    });
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    appliedThemeRef.current = themeRef.current;
    m.once("load", () => {
      // Start the compact attribution collapsed (just the "i"), out of the way.
      const attrib = container.querySelector(".maplibregl-ctrl-attrib");
      attrib?.classList.remove("maplibregl-compact-show");
      attrib?.removeAttribute("open");
      setMap(m);
      const checkVicmap = (): void => {
        if (!vicmapInView(m)) return;
        m.off("moveend", checkVicmap);
        setVicmap(true);
      };
      m.on("moveend", checkVicmap);
      checkVicmap();
    });
    return () => {
      m.remove();
      setMap(null);
    };
  }, [containerRef]);

  useEffect(() => {
    if (!map || (appliedThemeRef.current === theme && appliedVicmapRef.current === vicmap)) return;
    appliedThemeRef.current = theme;
    appliedVicmapRef.current = vicmap;
    // DOM markers (spots, draft pin, blue dot) live outside the style, so
    // they survive this; diffing keeps unchanged sources (tiles, Vicmap
    // GeoJSON) and only adds layers / swaps paints and filters.
    map.setStyle(basemapStyle(theme, { vicmap }), { diff: true });
  }, [map, theme, vicmap]);

  return map;
}
