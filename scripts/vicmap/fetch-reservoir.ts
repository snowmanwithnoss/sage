// Downloads Vicmap property boundaries (lots) and street addresses for the
// suburb of Reservoir from the Victorian Government's open WFS, cleans them
// up and writes the small static files the map loads.
//
//   npm run data:vicmap            # download (cached) + build
//   npm run data:vicmap -- --fresh # ignore the download cache
//
// Outputs (committed; regenerate to refresh the snapshot):
//   web/public/data/vicmap/reservoir-parcels.json    lot polygons
//   web/public/data/vicmap/reservoir-addresses.json  street-number points
//   web/src/map/reservoirArea.ts                     simplified suburb outline,
//                                                    bbox and snapshot date
//
// Raw WFS pages are cached in .cache/vicmap/ (gitignored, ~150 MB).
//
// Data: Vicmap Property, Vicmap Address, Vicmap Admin — © State of Victoria
// (Department of Transport and Planning), CC BY 4.0.
//
// Runs on Node 24 directly (type stripping): only erasable TS syntax here, no
// dependencies beyond Node built-ins.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CACHE = join(ROOT, ".cache/vicmap");
const OUT_DATA = join(ROOT, "web/public/data/vicmap");
const OUT_TS = join(ROOT, "web/src/map/reservoirArea.ts");

const WFS = "https://opendata.maps.vic.gov.au/geoserver/wfs";
const SUBURB = "RESERVOIR";
const PAGE = 5000;
/** Keep features within this distance (m) of the suburb boundary. */
const MARGIN_M = 200;
/** Unit addresses sharing a base number + street within this distance (m) collapse to one label. */
const DEDUPE_M = 60;
/** Douglas–Peucker tolerance (m) for the suburb outline used in map filters. */
const SIMPLIFY_M = 2;

const FRESH = process.argv.includes("--fresh");

type Pos = [number, number];
type Ring = Pos[];
type Geometry =
  | { type: "Point"; coordinates: Pos }
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };
type Feature = { type: "Feature"; properties: Record<string, unknown>; geometry: Geometry | null };
type Collection = { type: "FeatureCollection"; features: Feature[]; numberMatched?: number; totalFeatures?: number; timeStamp?: string };

// ---------------------------------------------------------------------------
// Download (WFS 2.0, GeoJSON, paged, cached on disk)
// ---------------------------------------------------------------------------

async function getJson(params: Record<string, string>, cacheName: string): Promise<Collection> {
  const file = join(CACHE, cacheName);
  if (!FRESH && existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as Collection;
  const url = `${WFS}?${new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "2.0.0",
    REQUEST: "GetFeature",
    OUTPUTFORMAT: "application/json",
    SRSNAME: "EPSG:4326",
    ...params,
  })}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const json = JSON.parse(text) as Collection;
      if (!Array.isArray(json.features)) throw new Error("not a FeatureCollection");
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(file, text);
      return json;
    } catch (err) {
      if (attempt >= 3) throw new Error(`WFS request failed (${cacheName}): ${String(err)}`);
      console.warn(`  retrying ${cacheName} after: ${String(err)}`);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
}

/** All features of `layer` inside `bbox` ([w, s, e, n], lon/lat), 5000 per page. */
async function fetchLayer(layer: string, sortBy: string, bbox: readonly number[]): Promise<Feature[]> {
  const [w, s, e, n] = bbox;
  const out: Feature[] = [];
  for (let start = 0; ; start += PAGE) {
    const page = await getJson(
      {
        TYPENAMES: `open-data-platform:${layer}`,
        // urn CRS => lat/lon axis order
        BBOX: `${s},${w},${n},${e},urn:ogc:def:crs:EPSG::4326`,
        SORTBY: sortBy,
        COUNT: String(PAGE),
        STARTINDEX: String(start),
      },
      `${layer}_${start}.json`,
    );
    out.push(...page.features);
    const total = page.numberMatched ?? page.totalFeatures ?? 0;
    console.log(`  ${layer}: ${out.length}/${total}`);
    if (page.features.length < PAGE || out.length >= total) return out;
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers (local equirectangular metres — fine at suburb scale)
// ---------------------------------------------------------------------------

const LAT0 = -37.71;
const KX = 111320 * Math.cos((-LAT0 * Math.PI) / 180);
const KY = 110570;
const toM = ([lng, lat]: Pos): Pos => [lng * KX, lat * KY];

type Seg = [Pos, Pos];

function segDist2(x: number, y: number, [[x1, y1], [x2, y2]]: Seg): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = dx * dx + dy * dy;
  const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L));
  const ex = x1 + t * dx - x;
  const ey = y1 + t * dy - y;
  return ex * ex + ey * ey;
}

function pointInRing(x: number, y: number, segs: readonly Seg[]): boolean {
  let c = false;
  for (const [[x1, y1], [x2, y2]] of segs) {
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
}

/** Fast "inside the suburb or within MARGIN_M of its boundary" test. */
function makeNear(outer: Ring): (p: Pos) => boolean {
  const ring = outer.map(toM);
  const segs: Seg[] = [];
  for (let i = 1; i < ring.length; i++) segs.push([ring[i - 1]!, ring[i]!]);
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const bb = [Math.min(...xs) - MARGIN_M, Math.min(...ys) - MARGIN_M, Math.max(...xs) + MARGIN_M, Math.max(...ys) + MARGIN_M] as const;
  // Grid of boundary segments (cell = MARGIN_M) for the distance test.
  const G = MARGIN_M;
  const cells = new Map<string, Seg[]>();
  for (const sg of segs) {
    const [[x1, y1], [x2, y2]] = sg;
    for (let i = Math.floor((Math.min(x1, x2) - G) / G); i <= Math.floor((Math.max(x1, x2) + G) / G); i++) {
      for (let j = Math.floor((Math.min(y1, y2) - G) / G); j <= Math.floor((Math.max(y1, y2) + G) / G); j++) {
        const k = `${i},${j}`;
        const list = cells.get(k);
        if (list) list.push(sg);
        else cells.set(k, [sg]);
      }
    }
  }
  const insideCache = new Map<string, boolean>();
  const M2 = MARGIN_M * MARGIN_M;
  return (p) => {
    const [x, y] = toM(p);
    if (!(bb[0] <= x && x <= bb[2] && bb[1] <= y && y <= bb[3])) return false;
    for (const sg of cells.get(`${Math.floor(x / G)},${Math.floor(y / G)}`) ?? []) {
      if (segDist2(x, y, sg) <= M2) return true;
    }
    // > MARGIN_M from the boundary, so a 50 m cell centre shares the point's
    // inside/outside status.
    const i = Math.floor(x / 50);
    const j = Math.floor(y / 50);
    const k = `${i},${j}`;
    let v = insideCache.get(k);
    if (v === undefined) {
      v = pointInRing((i + 0.5) * 50, (j + 0.5) * 50, segs);
      insideCache.set(k, v);
    }
    return v;
  };
}

const r6 = (v: number): number => Math.round(v * 1e6) / 1e6;

function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0; i < r.length - 1; i++) {
    const [x1, y1] = toM(r[i]!);
    const [x2, y2] = toM(r[i + 1]!);
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** Rounds to 6 dp (~0.1 m), drops repeated points, closes; null if degenerate (< 0.5 m²). */
function cleanRing(r: Ring): Ring | null {
  const o: Ring = [];
  for (const [x, y] of r) {
    const p: Pos = [r6(x), r6(y)];
    const last = o[o.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) o.push(p);
  }
  const first = o[0];
  const last = o[o.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) o.push(first);
  if (o.length < 4 || Math.abs(ringArea(o)) < 0.5) return null;
  return o;
}

/** Douglas–Peucker in metres; keeps first/last point. */
function simplify(r: Ring, tol: number): Ring {
  const pts = r.map(toM);
  const keep = new Uint8Array(r.length);
  keep[0] = 1;
  keep[r.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, r.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = pts[i]!;
      const d = segDist2(x, y, [pts[a]!, pts[b]!]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > tol * tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return r.filter((_, i) => keep[i] === 1);
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/** "KENILWORTH STREET" -> "Kenilworth Street", "MCMAHON" -> "McMahon". */
const titleCase = (s: string): string =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.startsWith("MC") ? "Mc" + cap(w.slice(2)) : cap(w)))
    .join(" ");
const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

function count(c: Record<string, number>, k: string): void {
  c[k] = (c[k] ?? 0) + 1;
}

async function main(): Promise<void> {
  console.log(`Fetching ${SUBURB} boundary…`);
  const loc = await getJson(
    { TYPENAMES: "open-data-platform:locality_polygon", CQL_FILTER: `locality_name='${SUBURB}'` },
    "locality.json",
  );
  const locGeom = loc.features[0]?.geometry;
  if (loc.features.length !== 1 || locGeom?.type !== "Polygon") throw new Error(`expected one Polygon for ${SUBURB}`);
  const outer = locGeom.coordinates[0]!;
  const near = makeNear(outer);
  const outline = simplify(outer.map(([x, y]) => [r6(x), r6(y)] as Pos), SIMPLIFY_M);
  const outlineSegs: Seg[] = outline.slice(1).map((p, i) => [outline[i]!, p]);

  const lngs = outer.map((p) => p[0]);
  const lats = outer.map((p) => p[1]);
  const suburbBbox = [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)] as const;
  const dLng = MARGIN_M / KX;
  const dLat = MARGIN_M / KY;
  const fetchBbox = [suburbBbox[0] - dLng, suburbBbox[1] - dLat, suburbBbox[2] + dLng, suburbBbox[3] + dLat].map(r6);

  // --- Parcels -------------------------------------------------------------
  console.log("Fetching parcels…");
  const rawParcels = await fetchLayer("v_parcel_mp", "parcel_ufi", fetchBbox);
  const pStats: Record<string, number> = {};
  const parcels: Feature[] = [];
  const seenGeom = new Set<string>();
  for (const f of rawParcels) {
    const p = f.properties;
    if (p.parcel_road === "Y") { count(pStats, "road"); continue; }
    if (p.parcel_status !== "A") { count(pStats, "proposed"); continue; }
    if (p.parcel_accessory_lot === "Y") { count(pStats, "accessory"); continue; }
    const g = f.geometry;
    const raw: Ring[][] = g?.type === "MultiPolygon" ? g.coordinates : g?.type === "Polygon" ? [g.coordinates] : [];
    const polys: Ring[][] = [];
    for (const poly of raw) {
      const rings = poly.map(cleanRing).filter((r): r is Ring => r !== null);
      // first ring must be the (valid) outer ring
      if (rings.length && cleanRing(poly[0] ?? []) !== null) polys.push(rings);
    }
    if (!polys.length) { count(pStats, "degenerate"); continue; }
    if (!polys.some((poly) => poly[0]!.some(near))) { count(pStats, "outside"); continue; }
    // Same lot geometry listed twice (e.g. multi-parcel properties): keep one.
    const key = JSON.stringify(polys.map((poly) => JSON.stringify([...poly[0]!].sort((a, b) => a[0] - b[0] || a[1] - b[1]))).sort());
    if (seenGeom.has(key)) { count(pStats, "dupgeom"); continue; }
    seenGeom.add(key);
    parcels.push({
      type: "Feature",
      properties: {},
      geometry: polys.length === 1 ? { type: "Polygon", coordinates: polys[0]! } : { type: "MultiPolygon", coordinates: polys },
    });
  }
  console.log(`parcels kept ${parcels.length}`, pStats);

  // --- Addresses -----------------------------------------------------------
  // Vicmap has one point per address, including every unit ("2/14", "8/19-21").
  // On a map those stack on one lot, so each address is reduced to its
  // street-facing base number ("14", "19-21") and, per base number + street,
  // points within DEDUPE_M of an already kept point are dropped. The plain
  // (non-unit) address point is preferred as the survivor because it sits at
  // the front of the lot. Lots (above) keep the 200 m margin; addresses don't.
  console.log("Fetching addresses…");
  const rawAddresses = await fetchLayer("address", "ufi", fetchBbox);
  const aStats: Record<string, number> = {};
  type Cand = { n: string; s: string; c: Pos; unit: boolean };
  const cands: Cand[] = [];
  const seenExact = new Set<string>();
  for (const f of rawAddresses) {
    const p = f.properties;
    const num = str(p.num_address);
    if (!num) { count(aStats, "nonumber"); continue; }
    if (f.geometry?.type !== "Point") { count(aStats, "nogeom"); continue; }
    const c: Pos = [r6(f.geometry.coordinates[0]), r6(f.geometry.coordinates[1])];
    // Addresses only *inside* the (simplified) suburb outline: the map hides
    // OSM house numbers inside exactly that outline, so the two never overlap.
    if (!pointInRing(c[0], c[1], outlineSegs)) { count(aStats, "outside"); continue; }
    const s = titleCase([p.road_name, p.road_type, p.road_suffix].map(str).filter(Boolean).join(" "));
    const exact = `${num}|${s}|${c[0]}|${c[1]}`;
    if (seenExact.has(exact)) { count(aStats, "dup"); continue; }
    seenExact.add(exact);
    const slash = num.lastIndexOf("/");
    cands.push({ n: slash >= 0 ? num.slice(slash + 1) : num, s, c, unit: slash >= 0 });
  }
  const beforeCollapse = cands.length;
  cands.sort((a, b) => Number(a.unit) - Number(b.unit));
  const kept = new Map<string, Pos[]>();
  const addresses: Feature[] = [];
  const D2 = DEDUPE_M * DEDUPE_M;
  for (const a of cands) {
    const key = `${a.n}|${a.s}`;
    const [x, y] = toM(a.c);
    const prev = kept.get(key) ?? [];
    if (prev.some(([px, py]) => (px - x) ** 2 + (py - y) ** 2 <= D2)) { count(aStats, "collapsed"); continue; }
    prev.push([x, y]);
    kept.set(key, prev);
    addresses.push({ type: "Feature", properties: { n: a.n, s: a.s }, geometry: { type: "Point", coordinates: a.c } });
  }
  console.log(`addresses before collapse ${beforeCollapse}, kept ${addresses.length}`, aStats);

  // --- Write ---------------------------------------------------------------
  mkdirSync(OUT_DATA, { recursive: true });
  const write = (name: string, fs: Feature[]): void => {
    const file = join(OUT_DATA, name);
    writeFileSync(file, JSON.stringify({ type: "FeatureCollection", features: fs }));
    console.log(`wrote ${file}`);
  };
  write("reservoir-parcels.json", parcels);
  write("reservoir-addresses.json", addresses);

  // Download time of the (possibly cached) boundary response.
  const snapshot = (loc.timeStamp ?? new Date().toISOString()).slice(0, 10);
  writeFileSync(
    OUT_TS,
    `// GENERATED by scripts/vicmap/fetch-reservoir.ts — do not edit by hand.
// Reservoir suburb outline (Vicmap Admin, simplified to ${SIMPLIFY_M} m) and bbox.

/** Date the Vicmap snapshot in web/public/data/vicmap/ was downloaded. */
export const VICMAP_SNAPSHOT = "${snapshot}";

/** [west, south, east, north] of the suburb itself. */
export const RESERVOIR_BBOX: [number, number, number, number] = ${JSON.stringify(suburbBbox.map(r6))};

/** Suburb outline (GeoJSON Polygon, ${outline.length} points) — used to swap OSM house numbers for Vicmap ones. */
export const RESERVOIR_OUTLINE: { type: "Polygon"; coordinates: [number, number][][] } = {
  type: "Polygon",
  coordinates: [${JSON.stringify(outline)}],
};
`,
  );
  console.log(`wrote ${OUT_TS} (outline ${outer.length} -> ${outline.length} points)`);
}

await main();
