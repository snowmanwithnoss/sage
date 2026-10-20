import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;

type Handlers = {
  /** A plain tap/click on the map itself (not on a marker). */
  onTap?: () => void;
  /** Press-and-hold (~500ms, touch or mouse) without moving, like Google Maps' dropped pin. */
  onLongPress?: (lngLat: maplibregl.LngLat) => void;
};

export function useMapGestures(map: maplibregl.Map | null, handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!map) return;
    const container = map.getCanvasContainer();
    let timer: number | undefined;
    let start: { x: number; y: number; id: number } | null = null;
    let activePointers = 0;
    // The click that ends a long press must not also count as a tap.
    let suppressClickUntil = 0;

    const cancel = () => {
      window.clearTimeout(timer);
      timer = undefined;
      start = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      activePointers++;
      if (activePointers > 1 || !e.isPrimary || e.button !== 0) return cancel();
      if (e.target instanceof Element && e.target.closest(".marker")) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      timer = window.setTimeout(() => {
        if (!start) return;
        const rect = container.getBoundingClientRect();
        const lngLat = map.unproject([start.x - rect.left, start.y - rect.top]);
        cancel();
        suppressClickUntil = Date.now() + 800;
        navigator.vibrate?.(20);
        handlersRef.current.onLongPress?.(lngLat);
      }, LONG_PRESS_MS);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE_PX) cancel();
    };
    const onPointerEnd = () => {
      activePointers = Math.max(0, activePointers - 1);
      cancel();
    };
    // Touch long-press would otherwise raise the browser's context menu.
    const onContextMenu = (e: Event) => e.preventDefault();

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const target = e.originalEvent.target;
      if (target instanceof Element && target.closest(".marker")) return;
      if (Date.now() < suppressClickUntil) return;
      handlersRef.current.onTap?.();
    };

    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    container.addEventListener("contextmenu", onContextMenu);
    map.on("click", onClick);
    // Two-finger gestures, inertia etc.
    map.on("zoomstart", cancel);
    map.on("rotatestart", cancel);
    return () => {
      cancel();
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      container.removeEventListener("contextmenu", onContextMenu);
      map.off("click", onClick);
      map.off("zoomstart", cancel);
      map.off("rotatestart", cancel);
    };
  }, [map]);
}

/** Current bearing/pitch, for the compass button. */
export function useMapOrientation(map: maplibregl.Map | null): { bearing: number; pitch: number } {
  const [state, setState] = useState({ bearing: 0, pitch: 0 });
  useEffect(() => {
    if (!map) return;
    const update = () => setState({ bearing: map.getBearing(), pitch: map.getPitch() });
    update();
    map.on("rotate", update);
    map.on("pitch", update);
    return () => {
      map.off("rotate", update);
      map.off("pitch", update);
    };
  }, [map, setState]);
  return state;
}

