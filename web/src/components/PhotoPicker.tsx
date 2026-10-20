import { useRef } from "react";
import { photoUrl, PHOTOS_MAX } from "../api";
import type { FormPhoto } from "../lib/usePhotoUploads";
import { AddPhotoIcon, CloseIcon, RetryIcon } from "./icons";

type Props = {
  photos: FormPhoto[];
  error?: string;
  /** While saving: no adding/removing. */
  busy: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (key: string) => void;
  /** Retry a failed upload; only offered when the spot already exists. */
  onRetry?: (key: string) => void;
};

/** Photo tiles + an "Add photo" tile in the spot form. */
export default function PhotoPicker({ photos, error, busy, onAdd, onRemove, onRetry }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const full = photos.length >= PHOTOS_MAX;

  return (
    <div className="field photo-field">
      <span className="field-label" id="photos-label">
        Photos <span className="optional">optional · up to {PHOTOS_MAX}</span>
      </span>
      <ul className="photo-tiles" aria-labelledby="photos-label">
        {photos.map((p, i) => (
          <PhotoTile
            key={p.key}
            photo={p}
            index={i}
            busy={busy}
            onRemove={() => onRemove(p.key)}
            onRetry={onRetry && (() => onRetry(p.key))}
          />
        ))}
        {!full && (
          <li>
            <button
              type="button"
              className="photo-tile photo-add"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <AddPhotoIcon size={26} />
              <span>Add photo</span>
            </button>
          </li>
        )}
      </ul>
      {/* No `capture` attribute: phones then offer both camera and library. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ""; // allow picking the same file again
          if (files.length) onAdd(files);
        }}
      />
      {error ? (
        <p className="photo-note photo-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="photo-note">Photos are resized and their location data removed before upload.</p>
      )}
    </div>
  );
}

function PhotoTile({
  photo,
  index,
  busy,
  onRemove,
  onRetry,
}: {
  photo: FormPhoto;
  index: number;
  busy: boolean;
  onRemove: () => void;
  onRetry?: () => void;
}) {
  const src = photo.kind === "existing" ? photoUrl(photo.photo.id, "thumb") : photo.preview;
  const status = photo.kind === "new" ? photo.status : "saved";
  const pct = photo.kind === "new" ? Math.round(photo.progress * 100) : 100;
  const canRemove = !busy && status !== "uploading";

  return (
    <li className={`photo-tile photo-${status}`}>
      {src && <img src={src} alt={`Photo ${index + 1}`} draggable={false} />}
      {status === "processing" && <span className="photo-spinner" aria-label="Preparing photo" />}
      {status === "uploading" && (
        <span className="photo-progress" role="progressbar" aria-label="Uploading" aria-valuenow={pct}>
          <span style={{ width: `${Math.max(pct, 4)}%` }} />
        </span>
      )}
      {photo.kind === "new" && status === "failed" && (
        <button
          type="button"
          className="photo-retry"
          onClick={onRetry}
          disabled={!onRetry || busy}
          title={photo.error}
          aria-label={onRetry ? `Retry upload (${photo.error ?? "failed"})` : "Upload failed"}
        >
          <RetryIcon size={20} />
          <span>{onRetry ? "Retry" : "Failed"}</span>
        </button>
      )}
      {canRemove && (
        <button type="button" className="photo-remove" aria-label={`Remove photo ${index + 1}`} onClick={onRemove}>
          <CloseIcon size={16} />
        </button>
      )}
    </li>
  );
}
