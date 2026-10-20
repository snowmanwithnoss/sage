// Place search for the top search bar: Reservoir street addresses from the
// shipped Vicmap snapshot (client-side, free), and everything else from
// Photon (komoot's OpenStreetMap geocoder, free, no key, fair use).

export type PlaceKind = "address" | "street" | "place";

export type Place = {
  id: string;
  /** Main line, e.g. "14 Kenilworth Street". */
  name: string;
  /** Second line, e.g. "Reservoir" or "Train station · Reservoir". */
  detail: string;
  /** Suburb, for the one-line label ("14 Kenilworth Street, Reservoir"). */
  area: string;
  lng: number;
  lat: number;
  kind: PlaceKind;
  /** Zoom to fly to when there's no bbox. */
  zoom: number;
  /** [west, south, east, north], for areas (suburbs, parks, streets). */
  bbox?: [number, number, number, number];
};

export const placeLabel = (p: Place) => (p.area ? `${p.name}, ${p.area}` : p.name);

// ---------------------------------------------------------------------------
// Query normalisation (shared by both sources)
// ---------------------------------------------------------------------------

/** Street-type abbreviations → the full word Vicmap uses. */
const STREET_TYPES: Record<string, string> = {
  st: "street",
  str: "street",
  rd: "road",
  ave: "avenue",
  av: "avenue",
  pde: "parade",
  cres: "crescent",
  cr: "crescent",
  crs: "crescent",
  ct: "court",
  crt: "court",
  dr: "drive",
  drv: "drive",
  gr: "grove",
  gv: "grove",
  gve: "grove",
  pl: "place",
  cl: "close",
  blvd: "boulevard",
  bvd: "boulevard",
  bwy: "broadway",
  hwy: "highway",
  tce: "terrace",
  ln: "lane",
  wy: "way",
  wk: "walk",
  cct: "circuit",
  esp: "esplanade",
  sq: "square",
};

function words(s: string): string[] {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9/\- ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Expands abbreviations, except as the first word ("St Georges Road"). */
function expandTypes(tokens: string[]): string[] {
  return tokens.map((t, i) => (i > 0 && STREET_TYPES[t]) || t);
}

// ---------------------------------------------------------------------------
// Vicmap (Reservoir) addresses
// ---------------------------------------------------------------------------

const VICMAP_URL = "/data/vicmap/reservoir-addresses.json";
const SUBURB = "Reservoir";

type Point = { n: string; lng: number; lat: number };
type Street = {
  name: string; // "Kenilworth Street"
  tokens: string[]; // ["kenilworth", "street"]
  points: Point[];
  centre: [number, number];
  bbox: [number, number, number, number];
};

type AddressFile = {
  features: { properties: { n: string; s: string }; geometry: { coordinates: [number, number] } }[];
};

let indexPromise: Promise<Street[]> | null = null;

/**
 * Lazily downloads and indexes the Reservoir addresses (once). The map's
 * Vicmap overlay fetches the same URL, so this usually hits the HTTP cache.
 */
export function loadVicmapIndex(): Promise<Street[]> {
  indexPromise ??= fetch(VICMAP_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<AddressFile>;
    })
    .then(buildIndex)
    .catch((e: unknown) => {
      indexPromise = null; // allow a retry on the next focus
      throw e;
    });
  return indexPromise;
}

function buildIndex(file: AddressFile): Street[] {
  const byName = new Map<string, Point[]>();
  for (const f of file.features) {
    const { n, s } = f.properties;
    const [lng, lat] = f.geometry.coordinates;
    let pts = byName.get(s);
    if (!pts) byName.set(s, (pts = []));
    pts.push({ n, lng, lat });
  }
  const streets: Street[] = [];
  for (const [name, points] of byName) {
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity, sx = 0, sy = 0;
    for (const p of points) {
      w = Math.min(w, p.lng);
      e = Math.max(e, p.lng);
      s = Math.min(s, p.lat);
      n = Math.max(n, p.lat);
      sx += p.lng;
      sy += p.lat;
    }
    // Centre: the address nearest the mean, so it sits on the street even if it curves.
    const mx = sx / points.length, my = sy / points.length;
    let best = points[0]!;
    let bestD = Infinity;
    for (const p of points) {
      const d = (p.lng - mx) ** 2 + (p.lat - my) ** 2;
      if (d < bestD) (bestD = d), (best = p);
    }
    points.sort((a, b) => parseInt(a.n, 10) - parseInt(b.n, 10) || a.n.localeCompare(b.n));
    streets.push({ name, tokens: words(name), points, centre: [best.lng, best.lat], bbox: [w, s, e, n] });
  }
  streets.sort((a, b) => a.name.localeCompare(b.name));
  return streets;
}

/** Index of the street token where the query tokens match (as prefixes, in order), or -1. */
function matchAt(street: string[], q: string[]): number {
  for (let start = 0; start + q.length <= street.length; start++) {
    if (q.every((t, i) => street[start + i]!.startsWith(t))) return start;
  }
  return -1;
}

/** "14" matches "14", "14A"…; "14" also matches ranges like "12-16". */
function numberMatches(n: string, q: string): boolean {
  const lower = n.toLowerCase();
  if (lower === q) return true;
  const range = /^(\d+)-(\d+)$/.exec(n);
  const qn = Number(q);
  if (range && /^\d+$/.test(q)) return qn >= Number(range[1]) && qn <= Number(range[2]);
  return false;
}

const MAX_VICMAP = 5;

/** Searches the (already loaded) Reservoir index. Synchronous and cheap (~1k streets). */
export function searchVicmap(streets: Street[], query: string): Place[] {
  let tokens = words(query).filter((t) => t !== "reservoir" && t !== "vic" && t !== "3073");
  if (tokens.length === 0) return [];
  // Leading house number: "14", "14a", "3/14" (unit → base number), "14-16".
  let num: string | null = null;
  const m = /^(?:\d+[a-z]?\/)?(\d+[a-z]?(?:-\d+[a-z]?)?)$/.exec(tokens[0]!);
  if (m) {
    num = m[1]!;
    tokens = tokens.slice(1);
  }
  if (tokens.length === 0) return []; // a bare number isn't a useful query
  const q = expandTypes(tokens);
  if (q.join("").length < 3) return [];

  const hits: { street: Street; start: number }[] = [];
  for (const street of streets) {
    const start = matchAt(street.tokens, q);
    if (start >= 0) hits.push({ street, start });
  }
  hits.sort((a, b) => a.start - b.start || a.street.name.localeCompare(b.street.name));

  const out: Place[] = [];
  for (const { street } of hits) {
    if (out.length >= MAX_VICMAP) break;
    if (num) {
      const exact = street.points.filter((p) => p.n.toLowerCase() === num);
      const pts = exact.length > 0 ? exact : street.points.filter((p) => numberMatches(p.n, num!));
      for (const p of pts.slice(0, 2)) {
        out.push({
          id: `vicmap:${p.n}:${street.name}`,
          name: `${p.n} ${street.name}`,
          detail: SUBURB,
          area: SUBURB,
          lng: p.lng,
          lat: p.lat,
          kind: "address",
          zoom: 18,
        });
      }
      if (pts.length > 0) continue;
    }
    out.push({
      id: `vicmap:street:${street.name}`,
      name: street.name,
      detail: SUBURB,
      area: SUBURB,
      lng: street.centre[0],
      lat: street.centre[1],
      kind: "street",
      zoom: 16.5,
      bbox: street.bbox,
    });
  }
  return out.slice(0, MAX_VICMAP);
}

// ---------------------------------------------------------------------------
// Photon (OpenStreetMap) — https://photon.komoot.io
// Terms: "You can use the API for your project, but please be fair — extensive
// usage will be throttled." Data © OpenStreetMap contributors (ODbL).
// Callers debounce (~350 ms), require ≥3 chars and abort superseded requests.
// ---------------------------------------------------------------------------

const PHOTON_URL = "https://photon.komoot.io/api/";
/** Victoria, so suburbs/landmarks across the state resolve but not interstate namesakes. */
const VIC_BBOX = "140.9,-39.2,150.0,-33.9";
export const PHOTON_MIN_CHARS = 3;

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    extent?: [number, number, number, number]; // [minLon, maxLat, maxLon, minLat]
  };
};

const EXCLUDED_TAGS = ["highway:bus_stop", "public_transport:platform", "railway:platform", "railway:stop"];

/** Friendlier names for a few common OSM categories (others are humanised as-is). */
const CATEGORY: Record<string, string> = {
  "railway:station": "Train station",
  "railway:tram_stop": "Tram stop",
  "place:suburb": "Suburb",
  "place:neighbourhood": "Neighbourhood",
  "place:locality": "Locality",
  "leisure:park": "Park",
  "leisure:garden": "Garden",
  "amenity:police": "Police station",
};

function category(p: PhotonFeature["properties"]): string {
  const key = p.osm_key ?? "";
  const value = p.osm_value ?? "";
  const known = CATEGORY[`${key}:${value}`];
  if (known) return known;
  // Streets, buildings and plain addresses speak for themselves.
  if (!value || key === "highway" || key === "building" || key === "landuse" || value === "house" || value === "yes") return "";
  const words = value.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const cache = new Map<string, Place[]>();
const CACHE_SIZE = 40;

export async function searchPhoton(
  query: string,
  bias: { lat: number; lng: number },
  signal: AbortSignal
): Promise<Place[]> {
  const key = query.trim().toLowerCase().replace(/\s+/g, " ");
  const hit = cache.get(key);
  if (hit) return hit;
  const params = new URLSearchParams({
    q: query.trim(),
    limit: "6",
    lang: "en",
    bbox: VIC_BBOX,
    lat: bias.lat.toFixed(4),
    lon: bias.lng.toFixed(4),
  });
  // Bus bays and platforms crowd out the useful results ("reservoir station").
  for (const tag of EXCLUDED_TAGS) params.append("osm_tag", `!${tag}`);
  const res = await fetch(`${PHOTON_URL}?${params}`, { signal });
  if (!res.ok) throw new Error(`Place search failed (HTTP ${res.status})`);
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const places = (data.features ?? []).map(photonPlace).filter((p): p is Place => p !== null);
  cache.set(key, places);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
  return places;
}

function photonPlace(f: PhotonFeature): Place | null {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const street = p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street;
  const name = p.name ?? street;
  if (!name) return null;
  const suburb = p.district ?? p.locality ?? p.city ?? p.county ?? "";
  const area = suburb && suburb !== name ? suburb : "";
  const where = [p.name && street !== p.name ? street : "", area].filter(Boolean).join(", ");
  const detail = [p.name ? category(p) : "", where].filter(Boolean).join(" · ");
  const type = p.type ?? "";
  const isAddress = type === "house" && !!p.housenumber && !p.name;
  const zoom =
    isAddress || type === "house" ? 18 : type === "street" ? 16.5 : type === "district" || type === "locality" ? 14.5 : type === "city" ? 12 : 16;
  const e = p.extent;
  return {
    id: `photon:${p.osm_type ?? ""}${p.osm_id ?? `${lng},${lat}`}`,
    name,
    detail,
    area,
    lng,
    lat,
    kind: isAddress ? "address" : type === "street" ? "street" : "place",
    zoom,
    bbox: e && !isAddress ? [e[0], e[3], e[2], e[1]] : undefined,
  };
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

const near = (a: Place, b: Place) => Math.abs(a.lat - b.lat) < 0.0003 && Math.abs(a.lng - b.lng) < 0.0004; // ~35 m

/** Vicmap first, then Photon minus anything Vicmap already covers. */
export function mergePlaces(vicmap: Place[], photon: Place[], max = 6): Place[] {
  const labels = new Set(vicmap.map((p) => words(placeLabel(p)).join(" ")));
  const seen = new Set<string>();
  const rest = photon.filter((p) => {
    const label = words(expandTypes(words(placeLabel(p))).join(" ")).join(" ");
    if (labels.has(label) || seen.has(label)) return false;
    if (vicmap.some((v) => v.kind === p.kind && near(v, p))) return false;
    seen.add(label);
    return true;
  });
  return [...vicmap, ...rest].slice(0, max);
}
