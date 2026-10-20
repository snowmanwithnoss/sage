import { useCallback } from "react";
import { deletePhoto, PHOTOS_MAX, uploadPhoto, type Spot, type SpotPhoto } from "../api";
import { PhotoError, processPhoto, type ProcessedPhoto } from "./images";

/** A photo tile in the spot form: already on the server, or picked in this session. */
export type FormPhoto =
  | { key: string; kind: "existing"; photo: SpotPhoto }
  | {
      key: string;
      kind: "new";
      status: "processing" | "ready" | "uploading" | "failed";
      /** Object URL of the processed thumbnail (revoked when the tile goes away). */
      preview?: string;
      processed?: ProcessedPhoto;
      /** Upload progress 0..1 while uploading. */
      progress: number;
      error?: string;
    };

/** The photo part of the spot form state. */
export type PhotoFormState = {
  photos: FormPhoto[];
  /** Existing photos the user removed; deleted on save. */
  removedPhotoIds: string[];
  /** Last pick/decode error, shown under the photo row. */
  photoError?: string;
};

export function initialPhotos(spot?: Spot): PhotoFormState {
  return {
    photos: (spot?.photos ?? []).map((photo) => ({ key: photo.id, kind: "existing", photo })),
    removedPhotoIds: [],
  };
}

type Setter<T> = (update: (prev: T) => T) => void;

let nextKey = 0;
const newKey = () => `new-${++nextKey}`;

function revoke(p: FormPhoto | undefined) {
  if (p?.kind === "new" && p.preview) URL.revokeObjectURL(p.preview);
}

/** Frees the preview URLs of a form's photos (call when the form closes). */
export function releasePhotos(state: PhotoFormState | null) {
  state?.photos.forEach(revoke);
}

/**
 * Photo picking, processing and uploading for the spot form. `setForm`
 * updates the form's photo state; `setSpots` patches the spot list in place
 * so new photos show immediately (no refetch: KV is eventually consistent).
 */
export function usePhotoUploads<F extends PhotoFormState>(
  setForm: Setter<F | null>,
  setSpots: Setter<Spot[]>
) {
  const patchTile = useCallback(
    (key: string, patch: (p: FormPhoto) => FormPhoto | null) => {
      setForm((f) => {
        if (!f) return f;
        const photos: FormPhoto[] = [];
        for (const p of f.photos) {
          if (p.key !== key) photos.push(p);
          else {
            const next = patch(p);
            if (next !== p) revokeIfDropped(p, next);
            if (next) photos.push(next);
          }
        }
        return { ...f, photos };
      });
    },
    [setForm]
  );

  const patchSpotPhotos = useCallback(
    (spotId: string, update: (photos: SpotPhoto[]) => SpotPhoto[]) =>
      setSpots((prev) => prev.map((s) => (s.id === spotId ? { ...s, photos: update(s.photos) } : s))),
    [setSpots]
  );

  /** Adds picked files (up to the remaining slots) and processes each in the background. */
  const addFiles = useCallback(
    (files: File[], current: PhotoFormState) => {
      const room = PHOTOS_MAX - current.photos.length;
      const accepted = files.slice(0, Math.max(0, room));
      const tiles = accepted.map((file) => ({ file, key: newKey() }));
      setForm((f) =>
        f && {
          ...f,
          photoError: files.length > accepted.length ? `Up to ${PHOTOS_MAX} photos per spot.` : undefined,
          photos: [
            ...f.photos,
            ...tiles.map(({ key }): FormPhoto => ({ key, kind: "new", status: "processing", progress: 0 })),
          ],
        }
      );
      for (const { file, key } of tiles) {
        processPhoto(file).then(
          (processed) =>
            patchTile(key, (p) =>
              p.kind === "new"
                ? { ...p, status: "ready", processed, preview: URL.createObjectURL(processed.thumb) }
                : p
            ),
          (e: unknown) => {
            patchTile(key, () => null);
            const msg = e instanceof PhotoError ? e.message : "Couldn't read that photo.";
            setForm((f) => f && { ...f, photoError: msg });
          }
        );
      }
    },
    [setForm, patchTile]
  );

  const removeTile = useCallback(
    (key: string) => {
      setForm((f) => {
        if (!f) return f;
        const tile = f.photos.find((p) => p.key === key);
        if (!tile || (tile.kind === "new" && tile.status === "uploading")) return f;
        revoke(tile);
        return {
          ...f,
          photoError: undefined,
          photos: f.photos.filter((p) => p !== tile),
          removedPhotoIds: tile.kind === "existing" ? [...f.removedPhotoIds, tile.photo.id] : f.removedPhotoIds,
        };
      });
    },
    [setForm]
  );

  /** Uploads one tile; on success it becomes an "existing" photo. Returns success. */
  const uploadTile = useCallback(
    async (spotId: string, tile: FormPhoto): Promise<boolean> => {
      if (tile.kind !== "new" || !tile.processed) return true;
      const { key, processed } = tile;
      patchTile(key, (p) => (p.kind === "new" ? { ...p, status: "uploading", progress: 0, error: undefined } : p));
      try {
        const photo = await uploadPhoto(spotId, processed, (progress) =>
          patchTile(key, (p) => (p.kind === "new" ? { ...p, progress } : p))
        );
        patchTile(key, () => ({ key, kind: "existing", photo }));
        patchSpotPhotos(spotId, (photos) => [...photos.filter((p) => p.id !== photo.id), photo]);
        return true;
      } catch (e) {
        const error = e instanceof Error ? e.message : "Upload failed";
        patchTile(key, (p) => (p.kind === "new" ? { ...p, status: "failed", progress: 0, error } : p));
        return false;
      }
    },
    [patchTile, patchSpotPhotos]
  );

  /**
   * After the spot itself is saved: delete removed photos, then upload new
   * ones one at a time. Returns how many photo operations failed.
   */
  const syncPhotos = useCallback(
    async (spotId: string, state: PhotoFormState): Promise<number> => {
      let failed = 0;
      for (const id of state.removedPhotoIds) {
        try {
          await deletePhoto(spotId, id);
          patchSpotPhotos(spotId, (photos) => photos.filter((p) => p.id !== id));
          setForm((f) => f && { ...f, removedPhotoIds: f.removedPhotoIds.filter((r) => r !== id) });
        } catch {
          failed++;
        }
      }
      for (const tile of state.photos) {
        if (tile.kind === "new" && (tile.status === "ready" || tile.status === "failed")) {
          if (!(await uploadTile(spotId, tile))) failed++;
        }
      }
      return failed;
    },
    [setForm, uploadTile, patchSpotPhotos]
  );

  return { addFiles, removeTile, uploadTile, syncPhotos };
}

/** When a "new" tile becomes "existing" or is dropped, free its preview URL. */
function revokeIfDropped(prev: FormPhoto, next: FormPhoto | null) {
  if (prev.kind === "new" && prev.preview && (next === null || next.kind !== "new" || next.preview !== prev.preview)) {
    URL.revokeObjectURL(prev.preview);
  }
}
