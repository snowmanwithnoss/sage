import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { prefersReducedMotion } from "../lib/hooks";

export type LocateStatus = "off" | "locating" | "active";
export type UserPosition = { lat: number; lng: number; accuracy: number };

const EARTH_CIRCUMFERENCE_M = 40075016.686;

/** Metres per CSS pixel at `lat` for MapLibre's 512px world tiles. */
function metresPerPixel(lat: number, zoom: number): number {
  return (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
}

function dotElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "user-dot";
  el.setAttribute("aria-label", "Your location");
  el.innerHTML = '<div class="user-dot-halo"></div><div class="user-dot-pulse"></div><div class="user-dot-core"></div>';
  return el;
}

/**
 * "Locate me": watches the browser position while active and shows a blue
 * dot with an accuracy halo. `locate()` starts watching, or re-centres on the
 * user if already active.
 */
export function useUserLocation(map: maplibregl.Map | null, onError: (message: string) => void) {
  const [status, setStatus] = useState<LocateStatus>("off");
  const [position, setPosition] = useState<UserPosition | null>(null);
  const watchRef = useRef<number | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const flyOnFixRef = useRef(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const stop = useCallback(() => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setStatus("off");
  }, []);

  const flyTo = useCallback(
    (p: UserPosition) => {
      if (!map) return;
      map.flyTo({
        center: [p.lng, p.lat],
        zoom: Math.max(map.getZoom(), 15.5),
        duration: prefersReducedMotion() ? 0 : 1200,
        essential: false,
      });
    },
    [map]
  );

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      onErrorRef.current("Your browser can't share your location.");
      return;
    }
    if (watchRef.current !== null) {
      if (position) flyTo(position);
      return;
    }
    setStatus("locating");
    flyOnFixRef.current = true;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        setPosition(p);
        setStatus("active");
        if (flyOnFixRef.current) {
          flyOnFixRef.current = false;
          flyTo(p);
        }
      },
      (err) => {
        stop();
        onErrorRef.current(
          err.code === err.PERMISSION_DENIED
            ? "Location access is off. Allow it in your browser settings to see where you are."
            : "Couldn't find your location. Try again in a moment."
        );
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );
  }, [flyTo, position, stop]);

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
  }, []);

  // Blue dot + accuracy halo (resized with zoom).
  useEffect(() => {
    if (!map || !position || status === "off") {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ element: dotElement(), anchor: "center" });
      markerRef.current.setLngLat([position.lng, position.lat]).addTo(map);
    }
    const marker = markerRef.current;
    marker.setLngLat([position.lng, position.lat]);
    const halo = marker.getElement().querySelector<HTMLElement>(".user-dot-halo");
    const sizeHalo = () => {
      if (!halo) return;
      const px = Math.min(600, (2 * position.accuracy) / metresPerPixel(position.lat, map.getZoom()));
      halo.style.width = halo.style.height = `${Math.max(0, px)}px`;
    };
    sizeHalo();
    map.on("zoom", sizeHalo);
    return () => {
      map.off("zoom", sizeHalo);
    };
  }, [map, position, status]);

  useEffect(
    () => () => {
      markerRef.current?.remove();
      markerRef.current = null;
    },
    [map]
  );

  return { status, position, locate };
}
