import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createSpot, fetchSpots, DANGER_DEFAULT, DANGER_MAX, type Spot } from "./api";

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

type FormState = { lat: number; lng: number; name: string; description: string; danger: number };

function dangerPeppers(rating: number): string {
  return "🌶️".repeat(rating) + "·".repeat(DANGER_MAX - rating);
}

function popupDom(spot: Spot): HTMLElement {
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
  return wrap;
}

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Init map, load spots, handle click-to-add
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: OSM_STYLE,
      center: [0, 20],
      zoom: 2,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    let cancelled = false;

    map.on("load", async () => {
      try {
        const loaded = await fetchSpots();
        if (cancelled) return;
        setSpots(loaded);
        if (loaded.length > 0) {
          const bounds = new maplibregl.LngLatBounds();
          for (const s of loaded) bounds.extend([s.lng, s.lat]);
          map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load spots");
      }
    });

    map.on("click", (e) => {
      setForm({
        lat: Number(e.lngLat.lat.toFixed(6)),
        lng: Number(e.lngLat.lng.toFixed(6)),
        name: "",
        description: "",
        danger: DANGER_DEFAULT,
      });
    });

    return () => {
      cancelled = true;
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, []);

  // Sync markers with spots
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = spots.map((spot) => {
      const el = document.createElement("div");
      el.className = "marker";
      el.title = spot.name;
      return new maplibregl.Marker({ element: el })
        .setLngLat([spot.lng, spot.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 24, closeButton: false }).setDOMContent(
            popupDom(spot)
          )
        )
        .addTo(map);
    });
  }, [spots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setError(null);
    try {
      const spot = await createSpot({
        name: form.name,
        description: form.description,
        lat: form.lat,
        lng: form.lng,
        danger: form.danger,
      });
      setSpots((prev) => [spot, ...prev]);
      setForm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add spot");
    } finally {
      setSubmitting(false);
    }
  };

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

      {error && (
        <div className="toast toast-error" role="alert">
          {error}
        </div>
      )}

      {!form && !error && spots.length === 0 && (
        <div className="hint">Click anywhere on the map to add the first herb spot</div>
      )}

      {form && (
        <form className="panel" onSubmit={handleSubmit}>
          <h2>
            Add herb spot <span className="coords">({form.lat}, {form.lng})</span>
          </h2>
          <label>
            Name
            <input
              autoFocus
              required
              maxLength={100}
              placeholder="e.g. Rosemary by the gate"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            Description <span className="optional">(optional)</span>
            <textarea
              maxLength={1000}
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
                  {dangerPeppers(value).replace(/·/g, "○")}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="actions">
            <button type="button" onClick={() => setForm(null)} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add spot"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
