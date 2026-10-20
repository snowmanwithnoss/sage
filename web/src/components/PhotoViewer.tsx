import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { photoUrl, type SpotPhoto } from "../api";
import { prefersReducedMotion } from "../lib/hooks";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "./icons";

type Props = {
  photos: SpotPhoto[];
  /** Index to open at. */
  start: number;
  /** For alt text, e.g. "Rosemary by the gate". */
  name: string;
  onClose: () => void;
};

/**
 * Full-screen photo viewer: a native modal <dialog> (focus trap, Escape,
 * top layer) with a scroll-snap track, so swiping is the browser's own.
 * Arrow buttons/keys for desktop.
 */
export default function PhotoViewer({ photos, start, name, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(() => new Set());
  const indexRef = useRef(index);
  indexRef.current = index;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const track = trackRef.current;
    if (track) track.scrollLeft = start * track.clientWidth;
  }, [start]);

  // Keep the current slide in place across rotation/resizes.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const ro = new ResizeObserver(() => {
      track.scrollLeft = indexRef.current * track.clientWidth;
    });
    ro.observe(track);
    return () => ro.disconnect();
  }, []);

  const go = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const to = Math.max(0, Math.min(photos.length - 1, i));
    track.scrollTo({ left: to * track.clientWidth, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  const many = photos.length > 1;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="photo-viewer"
      aria-label={`Photos of ${name}`}
      onCancel={(e) => {
        e.preventDefault(); // Escape: let React own the open state
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        else if (e.key === "ArrowLeft") go(index - 1);
      }}
      // Don't let sheet drag handlers (React tree parents) see these.
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        ref={trackRef}
        className="viewer-track"
        onScroll={(e) => {
          const t = e.currentTarget;
          const i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
          if (i !== indexRef.current) setIndex(i);
        }}
      >
        {photos.map((p, i) => (
          <figure key={p.id} className="viewer-slide" aria-hidden={i !== index}>
            {/* Thumb (already cached from the strip) underneath while the full image loads. */}
            {!loaded.has(p.id) && (
              <img className="viewer-thumb" src={photoUrl(p.id, "thumb")} alt="" width={p.width} height={p.height} />
            )}
            <img
              className="viewer-img"
              src={photoUrl(p.id, "full")}
              alt={`${name}, photo ${i + 1} of ${photos.length}`}
              width={p.width}
              height={p.height}
              loading={Math.abs(i - start) <= 1 ? "eager" : "lazy"}
              decoding="async"
              draggable={false}
              onLoad={() => setLoaded((prev) => new Set(prev).add(p.id))}
            />
          </figure>
        ))}
      </div>

      <div className="viewer-bar">
        <span className="viewer-count" aria-live="polite">
          {many ? `${index + 1} / ${photos.length}` : ""}
        </span>
        <button type="button" className="viewer-btn" aria-label="Close photos" onClick={onClose} autoFocus>
          <CloseIcon size={24} />
        </button>
      </div>

      {many && (
        <>
          <button
            type="button"
            className="viewer-btn viewer-nav viewer-prev"
            aria-label="Previous photo"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            <ChevronLeftIcon size={28} />
          </button>
          <button
            type="button"
            className="viewer-btn viewer-nav viewer-next"
            aria-label="Next photo"
            disabled={index === photos.length - 1}
            onClick={() => go(index + 1)}
          >
            <ChevronRightIcon size={28} />
          </button>
        </>
      )}
    </dialog>,
    document.body
  );
}
