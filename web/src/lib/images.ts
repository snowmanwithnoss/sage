// Client-side photo processing: decode → resize on a canvas → re-encode.
//
// Re-encoding through a canvas drops all metadata, including EXIF GPS
// coordinates and camera details. That is deliberate (people photograph
// herbs in their own gardens), so never upload the original file.

import {
  PHOTO_FULL_EDGE,
  PHOTO_FULL_MAX_BYTES,
  PHOTO_THUMB_EDGE,
  PHOTO_THUMB_MAX_BYTES,
} from "../../../shared/spot";

export type ProcessedPhoto = {
  full: Blob;
  thumb: Blob;
  /** Size of `full` in pixels. */
  width: number;
  height: number;
};

/** A user-facing failure (unreadable file, unsupported format…). */
export class PhotoError extends Error {}

type Source = { image: CanvasImageSource; width: number; height: number; release: () => void };

/** Decodes a picked file, honouring the EXIF orientation (phones store most photos rotated). */
async function decode(file: File): Promise<Source> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Older Safari rejects the options bag, or the format; try an <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    // <img> applies EXIF orientation by default (CSS image-orientation: from-image).
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, release: () => {} };
  } catch {
    throw new PhotoError(
      "Couldn't read that photo. Try a JPEG or PNG, or set your camera to “Most Compatible”."
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fit(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * WebP when the browser can encode it, else JPEG (older iOS Safari silently
 * returns PNG for WebP). Steps quality down until it fits `maxBytes`.
 */
async function encode(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  const attempts: [string, number][] = [
    ["image/webp", 0.8],
    ["image/jpeg", 0.82],
    ["image/webp", 0.65],
    ["image/jpeg", 0.68],
    ["image/jpeg", 0.5],
  ];
  for (const [type, quality] of attempts) {
    const blob = await toBlob(canvas, type, quality);
    if (blob && blob.type === type && blob.size <= maxBytes) return blob;
  }
  throw new PhotoError("That photo is too large to upload, even after shrinking it.");
}

function render(src: Source, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoError("Your browser couldn't process that photo.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src.image, 0, 0, width, height);
  return canvas;
}

/** Turns a picked image file into an upload-ready full image + thumbnail. */
export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  if (file.type && !file.type.startsWith("image/")) throw new PhotoError("That file isn't an image.");
  const src = await decode(file);
  try {
    if (!src.width || !src.height) throw new PhotoError("Couldn't read that photo.");
    const fullSize = fit(src.width, src.height, PHOTO_FULL_EDGE);
    const fullCanvas = render(src, fullSize.width, fullSize.height);
    const thumbSize = fit(src.width, src.height, PHOTO_THUMB_EDGE);
    // Downscale the thumb from the already-reduced canvas: cheaper, and fine at 400px.
    const thumbCanvas = render({ ...src, image: fullCanvas }, thumbSize.width, thumbSize.height);
    const [full, thumb] = await Promise.all([
      encode(fullCanvas, PHOTO_FULL_MAX_BYTES),
      encode(thumbCanvas, PHOTO_THUMB_MAX_BYTES),
    ]);
    return { full, thumb, width: fullSize.width, height: fullSize.height };
  } finally {
    src.release();
  }
}
