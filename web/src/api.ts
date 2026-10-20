import type { Spot, SpotInput, SpotPhoto } from "../../shared/spot";
import type { ProcessedPhoto } from "./lib/images";

export type { Spot, SpotInput, SpotPhoto, SpotTag } from "../../shared/spot";
export {
  DANGER_DEFAULT,
  DANGER_MAX,
  DANGER_MIN,
  NAME_MAX,
  DESCRIPTION_MAX,
  PHOTOS_MAX,
  SPOT_TAGS,
  SPOT_TAG_LABELS,
  suggestDanger,
} from "../../shared/spot";

/** An API failure; `status` lets callers react to e.g. 401 (session expired). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function errorFrom(res: Response, fallback: string): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new ApiError(body?.error ?? `${fallback} (${res.status})`, res.status);
}

export async function fetchSpots(): Promise<Spot[]> {
  const res = await fetch("/api/spots");
  if (!res.ok) throw await errorFrom(res, "Failed to load spots");
  return (await res.json()) as Spot[];
}

export async function createSpot(input: SpotInput): Promise<Spot> {
  const res = await fetch("/api/spots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await errorFrom(res, "Failed to add spot");
  return (await res.json()) as Spot;
}

export async function updateSpot(id: string, input: SpotInput): Promise<Spot> {
  const res = await fetch(`/api/spots/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await errorFrom(res, "Failed to update spot");
  return (await res.json()) as Spot;
}

export async function deleteSpot(id: string): Promise<void> {
  const res = await fetch(`/api/spots/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw await errorFrom(res, "Failed to delete spot");
}

// Photos uploaded in this session are shown from their local blobs: KV is
// eventually consistent, so a fresh key may briefly 404 at other edges.
const localPhotoUrls = new Map<string, string>();

/** URL of a stored photo: a local blob if we just uploaded it, else the public (immutable) URL. */
export function photoUrl(photoId: string, size: "full" | "thumb"): string {
  return localPhotoUrls.get(`${photoId}/${size}`) ?? `/api/photos/${encodeURIComponent(photoId)}/${size}`;
}

/**
 * Uploads one processed photo to a spot the user owns. Uses XHR (not fetch)
 * for upload progress; `onProgress` gets 0..1.
 */
export function uploadPhoto(
  spotId: string,
  photo: ProcessedPhoto,
  onProgress?: (fraction: number) => void
): Promise<SpotPhoto> {
  const ext = (b: Blob) => (b.type === "image/webp" ? "webp" : "jpg");
  const body = new FormData();
  body.append("full", photo.full, `full.${ext(photo.full)}`);
  body.append("thumb", photo.thumb, `thumb.${ext(photo.thumb)}`);
  body.append("width", String(photo.width));
  body.append("height", String(photo.height));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/spots/${encodeURIComponent(spotId)}/photos`);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const saved = xhr.response as SpotPhoto;
        localPhotoUrls.set(`${saved.id}/full`, URL.createObjectURL(photo.full));
        localPhotoUrls.set(`${saved.id}/thumb`, URL.createObjectURL(photo.thumb));
        resolve(saved);
      } else {
        const err = (xhr.response as { error?: string } | null)?.error;
        reject(new ApiError(err ?? `Photo upload failed (${xhr.status})`, xhr.status));
      }
    };
    xhr.onerror = () => reject(new ApiError("Photo upload failed. Check your connection.", 0));
    xhr.send(body);
  });
}

export async function deletePhoto(spotId: string, photoId: string): Promise<void> {
  const res = await fetch(`/api/spots/${encodeURIComponent(spotId)}/photos/${encodeURIComponent(photoId)}`, {
    method: "DELETE",
  });
  // 404: already gone, which is what we wanted.
  if (!res.ok && res.status !== 404) throw await errorFrom(res, "Failed to remove photo");
}
