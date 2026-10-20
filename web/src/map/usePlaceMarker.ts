import { useEffect } from "react";
import maplibregl from "maplibre-gl";
import type { Place } from "../lib/places";

/**
 * A small temporary marker for a searched place (address, street, suburb):
 * a dark dot with a white ring, deliberately unlike the herb pins.
 */
export function usePlaceMarker(map: maplibregl.Map | null, place: Place | null) {
  useEffect(() => {
    if (!map || !place) return;
    const el = document.createElement("div");
    el.className = "place-marker";
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", `Search result: ${place.name}`);
    el.innerHTML = '<div class="place-marker-ring"></div><div class="place-marker-dot"></div>';
    const marker = new maplibregl.Marker({ element: el }).setLngLat([place.lng, place.lat]).addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, place]);
}
