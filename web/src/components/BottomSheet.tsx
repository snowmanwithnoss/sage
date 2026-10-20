import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useIsDesktop, prefersReducedMotion } from "../lib/hooks";
import { CloseIcon } from "./icons";

export type SheetSnap = "peek" | "expanded";

type Props = {
  open: boolean;
  /** Changing this resets the sheet to `initialSnap` (e.g. a different spot). */
  contentKey: string;
  /** "peek" shows only the header first (swipe up for the rest); "expanded" has no peek state. */
  initialSnap: SheetSnap;
  label: string;
  /** Always-visible top part (the peek). */
  header: ReactNode;
  children?: ReactNode;
  /** Pinned below the scrolling body, e.g. form buttons. */
  footer?: ReactNode;
  /** Swipe-down / close button. Not called when `dismissible` is false. */
  onDismiss: () => void;
  dismissible?: boolean;
  /** How much of the screen bottom the sheet covers (0 on desktop), live during drags. */
  onVisibleHeightChange?: (px: number, dragging: boolean) => void;
};

const DURATION_MS = 280;
const FLICK_PX_PER_MS = 0.45;
const DRAG_SLOP_PX = 6;

/**
 * Phone: a draggable bottom sheet with peek/expanded snap points, swipe down
 * to dismiss. Desktop (≥768px): a floating card on the left. Keeps rendering
 * its last content while animating closed.
 */
export default function BottomSheet(props: Props) {
  const [present, setPresent] = useState(props.open);
  const last = useRef(props);
  if (props.open) last.current = props;

  useEffect(() => {
    if (props.open) setPresent(true);
  }, [props.open]);

  if (!present && !props.open) return null;
  return <SheetInner {...last.current} closing={!props.open} onExited={() => setPresent(false)} />;
}

function SheetInner({
  contentKey,
  initialSnap,
  label,
  header,
  children,
  footer,
  onDismiss,
  dismissible = true,
  onVisibleHeightChange,
  closing,
  onExited,
}: Props & { closing: boolean; onExited: () => void }) {
  const isDesktop = useIsDesktop();
  const sheetRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const safeProbeRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<SheetSnap>(initialSnap);
  const [bodyScrollable, setBodyScrollable] = useState(false);
  const offsetRef = useRef<number | null>(null); // current translateY in px (null = not placed yet)
  const draggingRef = useRef(false);
  const justDraggedRef = useRef(false);
  const dismissingRef = useRef(false);
  const visibleCb = useRef(onVisibleHeightChange);
  visibleCb.current = onVisibleHeightChange;

  // Reset to the initial snap when the content changes (another spot, form ↔ details).
  const [prevKey, setPrevKey] = useState(contentKey);
  if (prevKey !== contentKey) {
    setPrevKey(contentKey);
    setSnap(initialSnap);
  }

  const metrics = useCallback(() => {
    const sheet = sheetRef.current;
    const head = headRef.current;
    const height = sheet?.offsetHeight ?? 0;
    // The peek shows the handle + header, plus the home-indicator safe area.
    const safeBottom = safeProbeRef.current?.offsetHeight ?? 0;
    const peekHeight = head ? head.offsetTop + head.offsetHeight + safeBottom : height;
    const peekOffset = Math.max(0, height - peekHeight);
    const hasPeek = initialSnap === "peek" && peekOffset > 24;
    return { height, peekOffset: hasPeek ? peekOffset : 0, hasPeek };
  }, [initialSnap]);

  const apply = useCallback(
    (offset: number, animate: boolean) => {
      const sheet = sheetRef.current;
      if (!sheet) return;
      sheet.style.transition = animate && !prefersReducedMotion() ? `transform ${DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)` : "none";
      sheet.style.transform = `translate3d(0, ${offset}px, 0)`;
      offsetRef.current = offset;
      const { height } = metrics();
      visibleCb.current?.(Math.max(0, height - offset), !animate);
    },
    [metrics]
  );

  const targetOffset = useCallback(
    (s: SheetSnap) => {
      const m = metrics();
      return s === "peek" && m.hasPeek ? m.peekOffset : 0;
    },
    [metrics]
  );

  // Place the sheet (slide in on first placement) whenever snap/size changes.
  const place = useCallback(() => {
    if (isDesktop) {
      const sheet = sheetRef.current;
      if (sheet) {
        sheet.style.transform = "";
        sheet.style.transition = "";
      }
      offsetRef.current = 0;
      visibleCb.current?.(0, false);
      return;
    }
    if (draggingRef.current || dismissingRef.current || closing) return;
    const target = targetOffset(snap);
    if (offsetRef.current === null) {
      // Start off-screen, then animate in.
      apply(metrics().height + 40, false);
      sheetRef.current?.getBoundingClientRect();
    }
    apply(target, true);
  }, [isDesktop, closing, snap, targetOffset, apply, metrics]);

  useLayoutEffect(() => {
    place();
  }, [place, contentKey]);

  // Re-place on size changes (content edits, keyboard, rotation).
  useEffect(() => {
    const sheet = sheetRef.current;
    const body = bodyRef.current;
    if (!sheet) return;
    const ro = new ResizeObserver(() => {
      if (body) setBodyScrollable(body.scrollHeight > body.clientHeight + 1);
      if (!draggingRef.current) place();
    });
    ro.observe(sheet);
    if (body) ro.observe(body);
    if (headRef.current) ro.observe(headRef.current);
    return () => ro.disconnect();
  }, [place]);

  // Closing (parent set open=false, or a swipe-dismiss finished).
  useEffect(() => {
    if (!closing) return;
    visibleCb.current?.(0, false);
    if (isDesktop || prefersReducedMotion()) {
      const t = window.setTimeout(onExited, isDesktop && !prefersReducedMotion() ? 160 : 0);
      return () => window.clearTimeout(t);
    }
    apply(metrics().height + 40, true);
    const t = window.setTimeout(onExited, DURATION_MS);
    return () => window.clearTimeout(t);
  }, [closing, isDesktop, apply, metrics, onExited]);

  // When re-opened mid-close, `closing` flips back and `place` restores the snap.
  useEffect(() => {
    if (!closing) dismissingRef.current = false;
  }, [closing]);

  const dismiss = () => {
    if (!dismissible) return;
    dismissingRef.current = true;
    onDismiss();
  };

  // ---- drag ----
  const drag = useRef<{
    id: number;
    startY: number;
    startOffset: number;
    active: boolean;
    samples: { t: number; y: number }[];
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (isDesktop || closing || (e.pointerType === "mouse" && e.button !== 0)) return;
    const t = e.target as Element;
    if (t.closest("input, textarea, select, [contenteditable]")) return;
    if (t.closest(".sheet-body") && bodyScrollable) return; // let the body scroll natively
    drag.current = {
      id: e.pointerId,
      startY: e.clientY,
      startOffset: offsetRef.current ?? 0,
      active: false,
      samples: [{ t: e.timeStamp, y: e.clientY }],
    };
    // Track on window so fast mouse drags that leave the sheet still count
    // (touch pointers are implicitly captured anyway).
    const move = (ev: PointerEvent) => dragHandlers.current.move(ev);
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      dragHandlers.current.up(ev);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dy = e.clientY - d.startY;
    if (!d.active) {
      if (Math.abs(dy) < DRAG_SLOP_PX) return;
      d.active = true;
      draggingRef.current = true;
    }
    let off = d.startOffset + dy;
    if (off < 0) off = off / 4; // rubber-band past fully expanded
    apply(off, false);
    d.samples.push({ t: e.timeStamp, y: e.clientY });
    if (d.samples.length > 6) d.samples.shift();
  };

  const onPointerUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || e.pointerId !== d.id || !d.active) return;
    draggingRef.current = false;
    justDraggedRef.current = true;
    window.setTimeout(() => (justDraggedRef.current = false), 50);

    const first = d.samples[0]!;
    const lastSample = d.samples[d.samples.length - 1]!;
    const dt = Math.max(1, lastSample.t - first.t);
    const v = (lastSample.y - first.y) / dt;
    const m = metrics();
    const off = offsetRef.current ?? 0;
    type Stop = { at: number; snap: SheetSnap | "dismiss" };
    const stops: Stop[] = [{ at: 0, snap: "expanded" }];
    if (m.hasPeek) stops.push({ at: m.peekOffset, snap: "peek" });
    if (dismissible) stops.push({ at: m.height, snap: "dismiss" });

    let target: Stop;
    if (v > FLICK_PX_PER_MS) target = stops.find((s) => s.at > off + 1) ?? stops[stops.length - 1]!;
    else if (v < -FLICK_PX_PER_MS) target = [...stops].reverse().find((s) => s.at < off - 1) ?? stops[0]!;
    else target = stops.reduce((a, b) => (Math.abs(b.at - off) < Math.abs(a.at - off) ? b : a));

    if (target.snap === "dismiss") {
      dismiss();
      return;
    }
    if (target.snap === snap) apply(targetOffset(snap), true);
    else setSnap(target.snap);
  };

  const dragHandlers = useRef({ move: onPointerMove, up: onPointerUp });
  dragHandlers.current = { move: onPointerMove, up: onPointerUp };

  const toggleSnap = () => {
    if (!metrics().hasPeek) return;
    setSnap((s) => (s === "peek" ? "expanded" : "peek"));
  };

  return (
    <section
      ref={sheetRef}
      className={`sheet${closing ? " sheet-closing" : ""}${snap === "expanded" ? " sheet-expanded" : ""}`}
      aria-label={label}
      onPointerDown={onPointerDown}
      onClickCapture={(e) => {
        if (justDraggedRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <button
        type="button"
        className="sheet-handle"
        aria-label={snap === "peek" ? "Expand" : "Collapse"}
        onClick={toggleSnap}
        tabIndex={initialSnap === "peek" ? 0 : -1}
      >
        <span />
      </button>
      <div ref={headRef} className="sheet-head">
        {header}
        {dismissible && (
          <button type="button" className="icon-btn sheet-close" aria-label="Close" onClick={dismiss}>
            <CloseIcon size={20} />
          </button>
        )}
      </div>
      {children !== undefined && (
        <div ref={bodyRef} className={`sheet-body${bodyScrollable ? " scrollable" : ""}`}>
          {children}
        </div>
      )}
      {footer && <div className="sheet-foot">{footer}</div>}
      <div ref={safeProbeRef} className="sheet-safe-probe" aria-hidden />
    </section>
  );
}
