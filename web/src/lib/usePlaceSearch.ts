import { useEffect, useMemo, useRef, useState } from "react";
import { loadVicmapIndex, mergePlaces, PHOTON_MIN_CHARS, searchPhoton, searchVicmap, type Place } from "./places";

const DEBOUNCE_MS = 350;

type Status = "idle" | "loading" | "done" | "error";

/**
 * Place results for the search bar. `active` (the box has focus) starts the
 * one-off Reservoir address download; Photon is queried after a debounce,
 * with superseded requests aborted.
 */
export function usePlaceSearch(query: string, active: boolean, getBias: () => { lat: number; lng: number }) {
  const [index, setIndex] = useState<Awaited<ReturnType<typeof loadVicmapIndex>> | null>(null);
  const [photon, setPhoton] = useState<{ q: string; places: Place[]; status: Status }>({
    q: "",
    places: [],
    status: "idle",
  });
  const biasRef = useRef(getBias);
  biasRef.current = getBias;

  // Lazy-load the Reservoir index on first focus.
  useEffect(() => {
    if (!active || index) return;
    let cancelled = false;
    loadVicmapIndex()
      .then((i) => !cancelled && setIndex(i))
      .catch(() => {}); // Photon still works; retried on next focus
    return () => {
      cancelled = true;
    };
  }, [active, index]);

  const q = query.trim();
  const vicmap = useMemo(() => (index && q ? searchVicmap(index, q) : []), [index, q]);

  useEffect(() => {
    if (!active || q.length < PHOTON_MIN_CHARS) {
      setPhoton({ q, places: [], status: "idle" });
      return;
    }
    setPhoton((p) => ({ q, places: p.places, status: "loading" }));
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      searchPhoton(q, biasRef.current(), ctrl.signal)
        .then((places) => setPhoton({ q, places, status: "done" }))
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setPhoton({ q, places: [], status: "error" });
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, active]);

  // While the next query loads, keep showing the previous results (less flicker).
  const photonPlaces = photon.status === "error" ? [] : photon.places;
  return {
    places: mergePlaces(vicmap, photonPlaces),
    loading: photon.status === "loading",
    failed: photon.status === "error",
    /** True when Photon was asked (query long enough). */
    searched: q.length >= PHOTON_MIN_CHARS,
  };
}
