import type { LocateStatus } from "../map/useUserLocation";
import { AddIcon, CompassIcon, LocationSearchingIcon, MyLocationIcon } from "./icons";

export function CompassButton({ bearing, pitch, onReset }: { bearing: number; pitch: number; onReset: () => void }) {
  const visible = Math.abs(bearing) > 0.5 || pitch > 0.5;
  return (
    <button
      type="button"
      className={`fab-round compass${visible ? " visible" : ""}`}
      aria-label="Reset map to north"
      title="Reset north"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      onClick={onReset}
    >
      <span style={{ transform: `rotateX(${pitch}deg) rotate(${-bearing}deg)` }}>
        <CompassIcon size={26} />
      </span>
    </button>
  );
}

export function LocateButton({ status, onClick }: { status: LocateStatus; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`fab-round locate locate-${status}`}
      aria-label={status === "active" ? "Centre on my location" : "Show my location"}
      title="My location"
      onClick={onClick}
    >
      {status === "active" ? <MyLocationIcon /> : <LocationSearchingIcon />}
    </button>
  );
}

export function AddFab({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="fab-add" onClick={onClick}>
      <AddIcon size={24} />
      <span>Add herb</span>
    </button>
  );
}
