import { useEffect, useState } from "react";
import type maplibregl from "maplibre-gl";
import { formatCoords } from "../lib/format";
import { markerSvg } from "../map/markers";
import { PanToolIcon } from "./icons";

type Props = {
  map: maplibregl.Map;
  onCancel: () => void;
  onConfirm: (lngLat: maplibregl.LngLat) => void;
};

/**
 * "Move the map to place the pin": a pin fixed at the map centre (its tip is
 * exactly on the centre point), a top banner and Cancel / Confirm buttons.
 */
export default function PlacementOverlay({ map, onCancel, onConfirm }: Props) {
  const [center, setCenter] = useState(() => map.getCenter());
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    const onMove = () => setCenter(map.getCenter());
    const onStart = () => setMoving(true);
    const onEnd = () => setMoving(false);
    map.on("move", onMove);
    map.on("movestart", onStart);
    map.on("moveend", onEnd);
    return () => {
      map.off("move", onMove);
      map.off("movestart", onStart);
      map.off("moveend", onEnd);
    };
  }, [map]);

  return (
    <>
      <div className="placement-banner" role="status">
        <PanToolIcon size={20} />
        <span>Move the map to place the pin</span>
      </div>
      <div className={`placement-pin${moving ? " lifted" : ""}`} aria-hidden>
        <div className="placement-shadow" />
        <div className="placement-marker marker" dangerouslySetInnerHTML={{ __html: markerSvg(56) }} />
      </div>
      <div className="placement-bar">
        <p className="placement-coords">{formatCoords(center.lat, center.lng)}</p>
        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onConfirm(map.getCenter())}>
            Confirm location
          </button>
        </div>
      </div>
    </>
  );
}
