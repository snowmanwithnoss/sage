import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { Spot } from "../api";
import { distanceMetres, formatDistance, normalize } from "../lib/format";
import { markerSvg } from "../map/markers";
import { DangerPeppers } from "./DangerPicker";
import { CloseIcon, SageLogo, SearchIcon } from "./icons";

type Props = {
  spots: Spot[];
  onPick: (spot: Spot) => void;
  /** Where "nearby" is measured from (user's position, else the map centre). */
  getOrigin: () => { lat: number; lng: number };
  /** True when `getOrigin` is the user's real position (so distances are shown). */
  originIsUser: boolean;
  account: ReactNode;
};

const MAX_RESULTS = 8;

/** Google-Maps-style floating search pill with a results dropdown (client-side filter). */
export default function SearchBar({ spots, onPick, getOrigin, originIsUser, account }: Props) {
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
    return withDist.slice(0, MAX_RESULTS);
    // getOrigin is read when the dropdown opens / query changes, on purpose.
  }, [spots, q, focused]);

  const open = focused && (results.length > 0 || q.length > 0);

  const pick = (spot: Spot) => {
    onPick(spot);
    setQuery(spot.name);
    setFocused(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      const r = results[active];
      if (r) {
        e.preventDefault();
        pick(r.spot);
      }
    } else if (e.key === "Escape") {
      e.stopPropagation();
      if (query) setQuery("");
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
          placeholder="Search herbs"
          aria-label="Search herbs"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(e) => {
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
              setQuery("");
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
        <div className="search-results" onPointerDown={(e) => e.preventDefault()}>
          {!q && <p className="search-section">{originIsUser ? "Near you" : "Nearby"}</p>}
          <ul id={listId} role="listbox" aria-label="Herb spots">
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
          {q && results.length === 0 && (
            <p className="search-empty">
              No herbs match “{query.trim()}”.
            </p>
          )}
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
