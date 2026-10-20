import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { Spot } from "../api";
import { markerElement, MARKER_OFFSET } from "./markers";

/** Keeps one DOM marker per spot, with a selected (enlarged) state. */
export function useSpotMarkers(
  map: maplibregl.Map | null,
  spots: Spot[],
  selectedId: string | null,
  onSelect: (spot: Spot) => void
) {
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    if (!map) return;
    const markers = markersRef.current;
    for (const m of markers.values()) m.remove();
    markers.clear();
    for (const spot of spots) {
      const el = markerElement(spot.id === selectedRef.current ? "marker-selected" : "");
      el.title = spot.name;
      // The map-level tap handler ignores taps on `.marker`, so this click
      // only selects the spot (it doesn't also dismiss the sheet).
      el.addEventListener("click", () => onSelectRef.current(spot));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectRef.current(spot);
        }
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom", offset: MARKER_OFFSET })
        .setLngLat([spot.lng, spot.lat])
        .addTo(map);
      // MapLibre sets a generic aria-label/role in the constructor; override.
      el.setAttribute("role", "button");
      el.setAttribute("aria-label", spot.name);
      el.tabIndex = 0;
      markers.set(spot.id, marker);
    }
    return () => {
      for (const m of markers.values()) m.remove();
      markers.clear();
    };
  }, [map, spots]);

  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const el = marker.getElement();
      const selected = id === selectedId;
      el.classList.toggle("marker-selected", selected);
      el.style.zIndex = selected ? "2" : "";
    }
  }, [selectedId, spots, map]);
}

/** A translucent "new spot" pin shown while the add form is open. */
export function useDraftMarker(map: maplibregl.Map | null, position: { lat: number; lng: number } | null) {
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const lat = position?.lat;
  const lng = position?.lng;
  useEffect(() => {
    if (!map || lat === undefined || lng === undefined) return;
    const el = markerElement("marker-draft marker-selected");
    const marker = new maplibregl.Marker({ element: el, anchor: "bottom", offset: MARKER_OFFSET })
      .setLngLat([lng, lat])
      .addTo(map);
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [map, lat, lng]);
}
