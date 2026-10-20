import { useEffect, useState } from "react";

/** Tracks a CSS media query, e.g. `useMediaQuery("(min-width: 768px)")`. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export type Theme = "light" | "dark";

/** The OS/browser colour scheme. UI chrome follows it via CSS; the map style takes it as a value. */
export function useColorScheme(): Theme {
  return useMediaQuery("(prefers-color-scheme: dark)") ? "dark" : "light";
}

/** Desktop layout (side card instead of bottom sheet). Keep in sync with the 768px breakpoint in style.css. */
export const DESKTOP_QUERY = "(min-width: 768px)";

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
