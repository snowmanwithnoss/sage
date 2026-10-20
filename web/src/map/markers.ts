// Map pin: guitar-pick body with an upward sage sprout. Static markup (no
// user data). The body colour comes from CSS (.marker / .marker-selected): every
// herb is the same green, whoever added it.
const LEAF = "M0-10C4.5-5 4.5 5 0 10-4.5 5-4.5-5 0-10Z";

export function markerSvg(size = 32): string {
  return (
    `<svg viewBox="-2 -2 68 68" width="${size}" height="${size}" aria-hidden="true">` +
    '<path class="marker-body" d="M26 56C16 46 4 33 4 19.5 4 8 17 2.5 32 2.5S60 8 60 19.5C60 33 48 46 38 56Q32 62 26 56Z" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/>' +
    '<path d="M32 48V21" stroke="#e8f3e8" stroke-width="3.5" stroke-linecap="round"/>' +
    `<path d="${LEAF}" fill="#cfe3c8" transform="translate(32.0 15.5) rotate(0) scale(0.65)"/>` +
    `<path d="${LEAF}" fill="#cfe3c8" transform="translate(38.4 23.6) rotate(45) scale(0.9)"/>` +
    `<path d="${LEAF}" fill="#cfe3c8" transform="translate(25.6 23.6) rotate(-45) scale(0.9)"/>` +
    `<path d="${LEAF}" fill="#a8c69f" transform="translate(39.0 37.1) rotate(55) scale(0.85)"/>` +
    `<path d="${LEAF}" fill="#a8c69f" transform="translate(25.0 37.1) rotate(-55) scale(0.85)"/>` +
    "</svg>"
  );
}

/**
 * The SVG maps 68 viewBox units, and the pick's tip (y≈59, i.e. 61 of 68
 * units from the top ≈ 89.7%) sits ~7 units above the box bottom. For the
 * 32px marker that is ~3px, so shift the marker down to put the tip on the
 * spot. CSS scales the selected marker's SVG about this same tip point
 * (transform-origin in style.css), so the tip stays put.
 */
export const MARKER_TIP_FRACTION = 61 / 68;
export const MARKER_OFFSET: [number, number] = [0, 3];

export function markerElement(extraClass = ""): HTMLElement {
  const el = document.createElement("div");
  el.className = ["marker", extraClass].filter(Boolean).join(" ");
  el.innerHTML = markerSvg();
  return el;
}
