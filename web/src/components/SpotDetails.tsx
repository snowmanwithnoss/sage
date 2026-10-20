import type { Spot } from "../api";
import { dangerLabel, directionsUrl, distanceMetres, formatCoords, formatDate, formatDistance } from "../lib/format";
import { DangerPeppers } from "./DangerPicker";
import { CalendarIcon, DeleteIcon, DirectionsIcon, EditIcon, PlaceIcon, ShareIcon } from "./icons";

type HeaderProps = {
  spot: Spot;
  userPosition: { lat: number; lng: number } | null;
  onShare: (spot: Spot) => void;
  onEdit: (spot: Spot) => void;
  onDelete: (spot: Spot) => void;
};

/** The peek part of a spot's sheet: name, danger, and the action chips. */
export function SpotHeader({ spot, userPosition, onShare, onEdit, onDelete }: HeaderProps) {
  const distance = userPosition ? formatDistance(distanceMetres(userPosition, spot)) : null;
  return (
    <>
      <div className="sheet-title">
        <h2 className="selectable">{spot.name}</h2>
        <p className="sheet-sub">
          <DangerPeppers value={spot.danger} />
          <span>{dangerLabel(spot.danger)}</span>
          {distance && (
            <>
              <span aria-hidden>·</span>
              <span>{distance} away</span>
            </>
          )}
          {spot.is_mine && <span className="badge">Your spot</span>}
        </p>
      </div>
      <div className="chip-row">
        <a className="chip chip-primary" href={directionsUrl(spot.lat, spot.lng)} target="_blank" rel="noopener noreferrer">
          <DirectionsIcon size={18} />
          Directions
        </a>
        <button type="button" className="chip" onClick={() => onShare(spot)}>
          <ShareIcon size={18} />
          Share
        </button>
        {spot.is_mine && (
          <>
            <button type="button" className="chip" onClick={() => onEdit(spot)}>
              <EditIcon size={18} />
              Edit
            </button>
            <button type="button" className="chip chip-danger" onClick={() => onDelete(spot)}>
              <DeleteIcon size={18} />
              Delete
            </button>
          </>
        )}
      </div>
    </>
  );
}

/** The expanded part: description and details. */
export function SpotBody({ spot }: { spot: Spot }) {
  const added = formatDate(spot.created_at);
  return (
    <div className="spot-body">
      {spot.description ? (
        <p className="spot-description selectable">{spot.description}</p>
      ) : (
        <p className="spot-description muted">No description yet.</p>
      )}
      <ul className="detail-list">
        <li>
          <PlaceIcon size={20} />
          <span className="selectable coords">{formatCoords(spot.lat, spot.lng)}</span>
        </li>
        {added && (
          <li>
            <CalendarIcon size={20} />
            <span>Added {added}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
