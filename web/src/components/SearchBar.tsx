import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { Spot } from "../api";
import { distanceMetres, formatDistance, normalize } from "../lib/format";
import { placeLabel, type Place } from "../lib/places";
import { usePlaceSearch } from "../lib/usePlaceSearch";
import { markerSvg } from "../map/markers";
import { DangerPeppers } from "./DangerPicker";
import { CloseIcon, PlaceIcon, SageLogo, SearchIcon } from "./icons";

type Props = {
  spots: Spot[];
  onPick: (spot: Spot) => void;
  /** A street address / suburb / landmark was chosen. */
  onPickPlace: (place: Place) => void;
  /** The search text was cleared (drops any place marker). */
  onClear: () => void;
  /** Where "nearby" is measured from (user's position, else the map centre). */
  getOrigin: () => { lat: number; lng: number };
  /** True when `getOrigin` is the user's real position (so distances are shown). */
  originIsUser: boolean;
  account: ReactNode;
};

const MAX_RESULTS = 8;
/** With a query, herbs share the list with places. */
const MAX_HERBS_WITH_QUERY = 5;

type Item = { kind: "spot"; spot: Spot; dist: number } | { kind: "place"; place: Place };

/** Google-Maps-style floating search pill with a results dropdown (client-side filter). */
export default function SearchBar({ spots, onPick, onPickPlace, onClear, getOrigin, originIsUser, account }: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const q = normalize(query.trim());
  const results = useMemo(() => {
    if (!focused) return [];
    const origin = getOrigin();
    const withDist = spots
      .filter((s) => !q || normalize(s.name).includes(q) || normalize(s.description).includes(q))
      .map((s) => ({ spot: s, dist: distanceMetres(origin, s), nameHit: !q || normalize(s.name).includes(q) }));
    // Name matches first, then nearest.
    withDist.sort((a, b) => Number(b.nameHit) - Number(a.nameHit) || a.dist - b.dist);
    return withDist.slice(0, q ? MAX_HERBS_WITH_QUERY : MAX_RESULTS);
    // getOrigin is read when the dropdown opens / query changes, on purpose.
  }, [spots, q, focused]);

  const placeSearch = usePlaceSearch(query, focused, getOrigin);
  const places = focused && q ? placeSearch.places : [];
  const showPlaces = q.length > 0 && (places.length > 0 || placeSearch.searched);

  // One flat list for keyboard navigation: herbs first, then places.
  const items: Item[] = [
    ...results.map(({ spot, dist }) => ({ kind: "spot" as const, spot, dist })),
    ...places.map((place) => ({ kind: "place" as const, place })),
  ];

  const open = focused && (items.length > 0 || q.length > 0);

  const done = (text: string) => {
    setQuery(text);
    setFocused(false);
    inputRef.current?.blur(); // dismisses the on-screen keyboard
  };
  const pick = (spot: Spot) => {
    onPick(spot);
    done(spot.name);
  };
  const pickPlace = (place: Place) => {
    onPickPlace(place);
    done(placeLabel(place));
  };
  const pickItem = (item: Item) => (item.kind === "spot" ? pick(item.spot) : pickPlace(item.place));
  const clear = () => {
    setQuery("");
    onClear();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      const item = items[active];
      if (item) {
        e.preventDefault();
        pickItem(item);
      }
    } else if (e.key === "Escape") {
      e.stopPropagation();
      if (query) clear();
      else inputRef.current?.blur();
    }
  };

  return (
    <div className={`search${open ? " search-open" : ""}`}>
      <div className="search-pill">
        <span className="search-logo">
          <SageLogo size={30} />
        </span>
        <input
          ref={inputRef}
          type="search"
          className="search-input"
          placeholder="Search herbs or places"
          aria-label="Search herbs or places"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(e) => {
            if (!e.target.value) onClear();
            setQuery(e.target.value);
            setActive(0);
          }}
          onFocus={() => {
            setFocused(true);
            setActive(0);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="icon-btn"
            aria-label="Clear search"
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => {
              clear();
              inputRef.current?.focus();
            }}
          >
            <CloseIcon size={22} />
          </button>
        ) : (
          <span className="search-icon" aria-hidden>
            <SearchIcon size={22} />
          </span>
        )}
        {account}
      </div>
      {open && (
        // Keep input focus while tapping results.
        <div
          className="search-results"
          role="listbox"
          id={listId}
          aria-label="Search results"
          onPointerDown={(e) => e.preventDefault()}
        >
          {!q && <p className="search-section" aria-hidden>{originIsUser ? "Near you" : "Nearby"}</p>}
          {q && results.length > 0 && <p className="search-section" aria-hidden>Herbs</p>}
          {results.length > 0 && (
            <ul role="group" aria-label="Herb spots">
              {results.map(({ spot, dist }, i) => (
                <li
                  key={spot.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={i === active ? "active" : ""}
                  onClick={() => pick(spot)}
                  onPointerEnter={() => setActive(i)}
                >
                  <span className={`result-icon${spot.is_mine ? " mine" : ""}`} aria-hidden>
                    <span dangerouslySetInnerHTML={{ __html: markerSvg(26) }} />
                  </span>
                  <span className="result-text">
                    <span className="result-name">
                      <Highlight text={spot.name} q={q} />
                    </span>
                    <span className="result-meta">
                      <DangerPeppers value={spot.danger} small />
                      {spot.description && <span className="result-desc">{spot.description}</span>}
                    </span>
                  </span>
                  {originIsUser && <span className="result-dist">{formatDistance(dist)}</span>}
                </li>
              ))}
            </ul>
          )}
          {showPlaces && (
            <>
              <p className="search-section search-section-places" aria-hidden>
                Places
                {placeSearch.loading && <span className="search-spinner" />}
              </p>
              {places.length > 0 && (
                <ul role="group" aria-label="Places">
                  {places.map((place, j) => {
                    const i = results.length + j;
                    return (
                      <li
                        key={place.id}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={i === active}
                        className={i === active ? "active" : ""}
                        onClick={() => pickPlace(place)}
                        onPointerEnter={() => setActive(i)}
                      >
                        <span className="result-icon result-icon-place" aria-hidden>
                          <PlaceIcon size={20} />
                        </span>
                        <span className="result-text">
                          <span className="result-name">{place.name}</span>
                          {place.detail && <span className="result-detail">{place.detail}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {places.length === 0 && !placeSearch.loading && placeSearch.searched && (
                <p className="search-empty">{placeSearch.failed
                    ? "Place search isn't available right now."
                    : results.length === 0
                      ? "No herbs or places found."
                      : "No places found."}</p>
              )}
              {places.length === 0 && placeSearch.loading && <p className="search-empty">Searching places…</p>}
              {places.some((p) => p.id.startsWith("photon:")) && (
                <p className="search-attribution">
                  Places ©{" "}
                  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                    OpenStreetMap
                  </a>{" "}
                  contributors, via{" "}
                  <a href="https://photon.komoot.io" target="_blank" rel="noreferrer">
                    Photon
                  </a>
                </p>
              )}
            </>
          )}
          {q && results.length === 0 && !showPlaces && <p className="search-empty">No herbs match “{query.trim()}”.</p>}
        </div>
      )}
    </div>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  // normalize() keeps string length for most Latin text (it strips combining
  // marks after NFD); fall back to no highlight if lengths differ.
  const n = normalize(text);
  const i = n.indexOf(q);
  if (i < 0 || n.length !== text.length) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}
