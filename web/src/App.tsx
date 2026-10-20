import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ApiError,
  createSpot,
  deleteSpot,
  fetchSpots,
  updateSpot,
  DANGER_DEFAULT,
  DANGER_MAX,
  DESCRIPTION_MAX,
  NAME_MAX,
  type Spot,
} from "./api";
import { authClient } from "./auth";
import AuthDialog from "./AuthDialog";

// Free OSM raster tiles (no token needed). Attribution is required by OSM.
const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

/** `id` set means editing that spot; otherwise adding a new one. */
type FormState = {
  id?: string;
  lat: number;
  lng: number;
  name: string;
  description: string;
  danger: number;
};

// Map pin: guitar-pick body with an upward sage sprout. Static markup (no
// user data). The body colour comes from CSS (.marker-body / .marker-mine).
const LEAF = "M0-10C4.5-5 4.5 5 0 10-4.5 5-4.5-5 0-10Z";
const MARKER_SVG =
  '<svg viewBox="-2 -2 68 68" width="32" height="32" aria-hidden="true">' +
  '<path class="marker-body" d="M26 56C16 46 4 33 4 19.5 4 8 17 2.5 32 2.5S60 8 60 19.5C60 33 48 46 38 56Q32 62 26 56Z" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/>' +
  '<path d="M32 48V21" stroke="#e8f3e8" stroke-width="3.5" stroke-linecap="round"/>' +
  `<path d="${LEAF}" fill="#cfe3c8" transform="translate(32.0 15.5) rotate(0) scale(0.65)"/>` +
  `<path d="${LEAF}" fill="#cfe3c8" transform="translate(38.4 23.6) rotate(45) scale(0.9)"/>` +
  `<path d="${LEAF}" fill="#cfe3c8" transform="translate(25.6 23.6) rotate(-45) scale(0.9)"/>` +
  `<path d="${LEAF}" fill="#a8c69f" transform="translate(39.0 37.1) rotate(55) scale(0.85)"/>` +
  `<path d="${LEAF}" fill="#a8c69f" transform="translate(25.0 37.1) rotate(-55) scale(0.85)"/>` +
  "</svg>";

// The 32px SVG maps 68 viewBox units, and the pick's tip (y≈59) sits ~7 units
// (~3px) above the box bottom, so shift the marker down to put the tip on the
// spot. The pick's top is ~28px above the spot; popups open just above it.
const MARKER_OFFSET: [number, number] = [0, 3];
const POPUP_OFFSET: maplibregl.Offset = {
  center: [0, -14],
  top: [0, 2],
  "top-left": [0, 2],
  "top-right": [0, 2],
  bottom: [0, -30],
  "bottom-left": [0, -30],
  "bottom-right": [0, -30],
  left: [16, -14],
  right: [-16, -14],
};

function markerElement(mine: boolean): HTMLElement {
  const el = document.createElement("div");
  el.className = mine ? "marker marker-mine" : "marker";
  el.innerHTML = MARKER_SVG;
  return el;
}

type PopupActions = {
  onEdit: (spot: Spot) => void;
  onDelete: (spot: Spot) => void;
};

function dangerPeppers(rating: number): string {
  return "🌶️".repeat(rating) + "·".repeat(DANGER_MAX - rating);
}

function popupDom(spot: Spot, actions: PopupActions): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "popup";
  const h = document.createElement("h3");
  h.textContent = spot.name;
  wrap.appendChild(h);
  if (spot.description) {
    const p = document.createElement("p");
    p.textContent = spot.description;
    wrap.appendChild(p);
  }
  const danger = document.createElement("p");
  danger.className = "popup-danger";
  danger.textContent = `Danger: ${dangerPeppers(spot.danger)}`;
  wrap.appendChild(danger);

  if (spot.is_mine) {
    const row = document.createElement("div");
    row.className = "popup-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => actions.onEdit(spot));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger-action";
    del.textContent = "Delete";
    del.addEventListener("click", () => actions.onDelete(spot));
    row.append(edit, del);
    wrap.appendChild(row);
  }
  return wrap;
}

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | undefined>(undefined);

  const { data: session, isPending: sessionPending } = authClient.useSession();
  const userId = session?.user.id ?? null;

  // The map click handler is registered once; read the latest session via a ref.
  const sessionRef = useRef<"pending" | "signed-in" | "signed-out">("pending");
  sessionRef.current = sessionPending ? "pending" : userId !== null ? "signed-in" : "signed-out";

  const openSignIn = (reason?: string) => {
    setAuthReason(reason);
    setAuthOpen(true);
  };

  /** Shows an API error; a 401 means the session expired, so prompt sign-in instead. */
  const reportError = (e: unknown, fallback: string) => {
    if (e instanceof ApiError && e.status === 401) {
      setError(null);
      openSignIn("Your session has expired. Please sign in again.");
      return;
    }
    setError(e instanceof Error ? e.message : fallback);
  };

  // Init map, handle click-to-add
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: OSM_STYLE,
      center: [0, 20],
      zoom: 2,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    mapRef.current = map;

    map.on("load", () => setMapReady(true));

    map.on("click", (e) => {
      // MapLibre opens marker popups from its own map-level click handler
      // (checking e.originalEvent.target), so clicks on markers and popups
      // reach this handler too. Ignore them so the add-spot form only opens
      // for clicks on the map itself.
      const target = e.originalEvent.target;
      if (target instanceof Element && (target.closest(".marker") || target.closest(".maplibregl-popup"))) return;
      // Session still loading: we don't know yet, so do nothing.
      if (sessionRef.current === "pending") return;
      if (sessionRef.current === "signed-out") {
        openSignIn("Sign in to add a herb spot.");
        return;
      }
      setForm({
        lat: Number(e.lngLat.lat.toFixed(6)),
        lng: Number(e.lngLat.lng.toFixed(6)),
        name: "",
        description: "",
        danger: DANGER_DEFAULT,
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
      setMapReady(false);
    };
  }, []);

  // Load spots once the session is known, and again whenever the user
  // changes, so `is_mine` reflects who is signed in.
  const fittedRef = useRef(false);
  useEffect(() => {
    if (sessionPending) return;
    let cancelled = false;
    fetchSpots()
      .then((loaded) => {
        if (cancelled) return;
        setSpots(loaded);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load spots");
      });
    return () => {
      cancelled = true;
    };
  }, [userId, sessionPending]);

  // Signing out closes any open add/edit form.
  useEffect(() => {
    if (!userId) setForm(null);
  }, [userId]);

  // Fit the map to the spots the first time both are available.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || fittedRef.current || spots.length === 0) return;
    fittedRef.current = true;
    const bounds = new maplibregl.LngLatBounds();
    for (const s of spots) bounds.extend([s.lng, s.lat]);
    map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
  }, [spots, mapReady]);

  const handleEdit = (spot: Spot) => {
    for (const m of markersRef.current) m.getPopup()?.remove();
    setForm({
      id: spot.id,
      lat: spot.lat,
      lng: spot.lng,
      name: spot.name,
      description: spot.description,
      danger: spot.danger,
    });
  };

  const handleDelete = async (spot: Spot) => {
    if (!window.confirm(`Delete “${spot.name}”? This can't be undone.`)) return;
    setError(null);
    try {
      await deleteSpot(spot.id);
      setSpots((prev) => prev.filter((s) => s.id !== spot.id));
      setForm((f) => (f?.id === spot.id ? null : f));
    } catch (e) {
      reportError(e, "Failed to delete spot");
    }
  };

  // Marker popups are plain DOM built once per spots change; route their
  // button clicks through a ref so they always call the latest handlers.
  const popupActionsRef = useRef<PopupActions>({ onEdit: handleEdit, onDelete: handleDelete });
  popupActionsRef.current = { onEdit: handleEdit, onDelete: handleDelete };

  // Sync markers with spots
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    for (const m of markersRef.current) m.remove();
    const actions: PopupActions = {
      onEdit: (s) => popupActionsRef.current.onEdit(s),
      onDelete: (s) => popupActionsRef.current.onDelete(s),
    };
    markersRef.current = spots.map((spot) => {
      const el = markerElement(spot.is_mine);
      el.title = spot.name;
      const popup = new maplibregl.Popup({ offset: POPUP_OFFSET, closeButton: false }).setDOMContent(
        popupDom(spot, actions)
      );
      // Don't stop propagation on marker/popup clicks here: MapLibre toggles
      // the popup from its own map-level click handler, so the click must
      // reach the map. The map click handler ignores clicks that landed on a
      // marker or popup, which is what keeps the add-form from opening.
      return new maplibregl.Marker({ element: el, anchor: "bottom", offset: MARKER_OFFSET })
        .setLngLat([spot.lng, spot.lat])
        .setPopup(popup)
        .addTo(map);
    });
  }, [spots, mapReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setError(null);
    const input = {
      name: form.name,
      description: form.description,
      lat: form.lat,
      lng: form.lng,
      danger: form.danger,
    };
    try {
      if (form.id) {
        const updated = await updateSpot(form.id, input);
        setSpots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      } else {
        const spot = await createSpot(input);
        setSpots((prev) => [spot, ...prev]);
      }
      setForm(null);
    } catch (e) {
      reportError(e, form.id ? "Failed to update spot" : "Failed to add spot");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await authClient.signOut();
  };

  const editing = form?.id !== undefined;

  return (
    <div className="app">
      <div ref={mapContainer} className="map" />
      <header className="topbar">
        <span className="logo" aria-hidden>
          🌿
        </span>
        <h1>Sage</h1>
        <span className="tagline">neighbourhood herbs</span>
        <span className="count">
          {spots.length} spot{spots.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="account">
        {sessionPending ? null : session ? (
          <>
            <span className="account-email" title={session.user.email}>
              {session.user.email}
            </span>
            <button type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <button type="button" onClick={() => openSignIn()}>
            Sign in
          </button>
        )}
      </div>

      <AuthDialog open={authOpen} reason={authReason} onClose={() => setAuthOpen(false)} />

      {error && (
        <div className="toast toast-error" role="alert">
          {error}
        </div>
      )}

      {!form && !error && spots.length === 0 && (
        <div className="hint">
          {session ? "Click anywhere on the map to add the first herb spot" : "Sign in to add the first herb spot"}
        </div>
      )}

      {form && (
        <form
          className="panel"
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !submitting) setForm(null);
          }}
        >
          <h2>
            {editing ? "Edit herb spot" : "Add herb spot"}{" "}
            <span className="coords">
              ({form.lat}, {form.lng})
            </span>
          </h2>
          <label>
            Name
            <input
              autoFocus
              required
              maxLength={NAME_MAX}
              id="spot-name"
              name="spot-name"
              autoComplete="off"
              data-1p-ignore
              placeholder="e.g. Rosemary by the gate"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Description <span className="optional">(optional)</span>
            <textarea
              maxLength={DESCRIPTION_MAX}
              rows={3}
              placeholder="Which herb? Public or ask first? Best time to visit…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <fieldset className="danger-picker">
            <legend>
              Danger <span className="optional">(how likely you get chased)</span>
            </legend>
            <div className="danger-options" role="radiogroup" aria-label="Danger rating">
              {Array.from({ length: DANGER_MAX }, (_, i) => i + 1).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={form.danger === value}
                  className={form.danger === value ? "danger-btn selected" : "danger-btn"}
                  title={`Danger rating ${value} of ${DANGER_MAX}`}
                  onClick={() => setForm({ ...form, danger: value })}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="danger-preview" aria-live="polite">
              {dangerPeppers(form.danger).replace(/·/g, "○")} {form.danger}/{DANGER_MAX}
            </p>
          </fieldset>
          <div className="actions">
            <button type="button" onClick={() => setForm(null)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? (editing ? "Saving…" : "Adding…") : editing ? "Save changes" : "Add spot"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
