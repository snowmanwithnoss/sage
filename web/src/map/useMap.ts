import { useEffect, useRef, useState, type RefObject } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Theme } from "../lib/hooks";
import { basemapStyle, INITIAL_VIEW } from "./basemap";

/**
 * Creates the MapLibre map in `containerRef` and returns it once its style
 * has loaded (null before that). Re-applies the basemap when `theme` changes.
 */
export function useMap(containerRef: RefObject<HTMLDivElement>, theme: Theme): maplibregl.Map | null {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const themeRef = useRef(theme);
  const appliedThemeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const m = new maplibregl.Map({
      container,
      style: basemapStyle(themeRef.current),
      center: INITIAL_VIEW.center,
      zoom: INITIAL_VIEW.zoom,
      // Pinch zoom on phones, scroll/keyboard zoom on desktop; no +/- buttons.
      attributionControl: false,
      dragRotate: true,
      pitchWithRotate: true,
      // Two-finger vertical drag tilts up to 60° so the 3D buildings show.
      touchPitch: true,
      maxPitch: 60,
    });
    m.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    appliedThemeRef.current = themeRef.current;
    m.once("load", () => {
      // Start the compact attribution collapsed (just the "i"), out of the way.
      const attrib = container.querySelector(".maplibregl-ctrl-attrib");
      attrib?.classList.remove("maplibregl-compact-show");
      attrib?.removeAttribute("open");
      setMap(m);
    });
    return () => {
      m.remove();
      setMap(null);
    };
  }, [containerRef]);

  useEffect(() => {
    if (!map || appliedThemeRef.current === theme) return;
    appliedThemeRef.current = theme;
    // DOM markers (spots, draft pin, blue dot) live outside the style, so
    // they survive this; diffing keeps the tile source and only swaps paints.
    map.setStyle(basemapStyle(theme), { diff: true });
  }, [map, theme]);

  return map;
}
