// Sage basemap: a hand-built MapLibre vector style in the spirit of the modern
// Google Maps phone app — pastel, legible — tuned for a herb-spotting app, so
// green space is the hero. People drop pins by hand, so at street zoom it
// shows everything the tiles carry that helps you recognise where you're
// standing: building outlines, house numbers, shops/cafés/schools/stops,
// footpaths, driveways and laneway names. Flat (no 3D); zooms to z20.
//
// Data: OpenFreeMap vector tiles (OpenMapTiles schema, free, no API key).
// Schema reference: https://openmaptiles.org/schema/
//
// Layout of this file:
//   1. Palettes (one per theme) — every colour lives here.
//   2. Small helpers (zoom ramps, filters, name field).
//   3. Layer builders, grouped: land → water → green space → roads/rail →
//      buildings → house numbers → POIs/labels. Order in the final array is
//      draw order (and later symbol layers win label collisions).

import type maplibregl from "maplibre-gl";
import { RESERVOIR_OUTLINE } from "./reservoirArea";

export type MapTheme = "light" | "dark";

/** Reservoir, Melbourne VIC (around Reservoir station), at street level. */
export const INITIAL_CENTER: [number, number] = [145.007, -37.7168];
export const INITIAL_ZOOM = 15;
/** Vector tiles stop at z14; MapLibre overzooms them up to here. */
export const MAX_ZOOM = 20;

type Spec = maplibregl.StyleSpecification;
type Layer = maplibregl.LayerSpecification;
type Expr = maplibregl.ExpressionSpecification;

// ---------------------------------------------------------------------------
// 1. Palettes
// ---------------------------------------------------------------------------

type Palette = {
  land: string;
  landWarm: string; // commercial / retail
  landCivic: string; // schools, universities
  landHospital: string;
  landIndustrial: string;
  sand: string;
  water: string;
  waterway: string;
  waterLabel: string;

  park: string;
  garden: string; // gardens, allotments, community gardens
  reserve: string; // nature reserves, national parks
  wood: string;
  grass: string;
  scrub: string;
  golf: string;
  cemetery: string;
  pitch: string;
  wetland: string;
  farmland: string;
  parkLabel: string;
  parkDot: string;

  building: string;
  buildingOutline: string;
  housenumber: string;
  lotLine: string; // Vicmap property boundaries

  roadMinor: string;
  roadMinorCasing: string;
  roadMajor: string;
  roadMajorCasing: string;
  trunk: string;
  trunkCasing: string;
  motorway: string;
  motorwayCasing: string;
  path: string;
  cycleway: string;
  pedestrian: string;
  rail: string;
  railDash: string;
  tram: string;
  tunnelOpacity: number;
  aeroway: string;

  roadLabel: string;
  roadLabelHalo: string;
  placeCity: string;
  placeSuburb: string;
  placeNeighbourhood: string;
  labelHalo: string;
  transit: string;
  boundary: string;

  // POI label colours by category (icons come pre-coloured from the sprite).
  poiFood: string;
  poiShop: string;
  poiHealth: string;
  poiCivic: string;
  poiLeisure: string;
  poiOther: string;
};

const LIGHT: Palette = {
  land: "#f4f2ed",
  landWarm: "#f3efe8",
  landCivic: "#efece4",
  landHospital: "#f8eaea",
  landIndustrial: "#efeeec",
  sand: "#f3ecd8",
  water: "#a9d4f0",
  waterway: "#a9d4f0",
  waterLabel: "#4f86b0",

  park: "#c9eabb",
  garden: "#b5e0a2",
  reserve: "#c2e4b2",
  wood: "#b3d9a0",
  grass: "#d6eecb",
  scrub: "#d4e8c6",
  golf: "#c4e9b6",
  cemetery: "#d7e6d0",
  pitch: "#c2e6b6",
  wetland: "#cde6dc",
  farmland: "#eef0e2",
  parkLabel: "#3a7a3f",
  parkDot: "#5aa65c",

  building: "#ebe8e1",
  buildingOutline: "#cfc9bd",
  housenumber: "#8a8379",
  lotLine: "#c9bda8",

  roadMinor: "#ffffff",
  roadMinorCasing: "#e4e1da",
  roadMajor: "#ffffff",
  roadMajorCasing: "#d9d4ca",
  trunk: "#fef5d9",
  trunkCasing: "#ecdcae",
  motorway: "#fddf97",
  motorwayCasing: "#e8c070",
  path: "#b8b0a2",
  cycleway: "#6fa89d",
  pedestrian: "#fbfaf7",
  rail: "#cfccc5",
  railDash: "#f5f3ee",
  tram: "#c4bfb5",
  tunnelOpacity: 0.35,
  aeroway: "#e6e4df",

  roadLabel: "#6f6c66",
  roadLabelHalo: "#ffffff",
  placeCity: "#3b3a37",
  placeSuburb: "#7c7871",
  placeNeighbourhood: "#9a968e",
  labelHalo: "#f8f7f3",
  transit: "#3f73c4",
  boundary: "#c9c3d6",

  poiFood: "#c46a1c",
  poiShop: "#3f6fb0",
  poiHealth: "#c0484a",
  poiCivic: "#7a6a58",
  poiLeisure: "#3a7a3f",
  poiOther: "#6f6c66",
};

const DARK: Palette = {
  land: "#1c2330",
  landWarm: "#1f2633",
  landCivic: "#1f2734",
  landHospital: "#252636",
  landIndustrial: "#1e2431",
  sand: "#2a2b2b",
  water: "#0e1a2b",
  waterway: "#12223a",
  waterLabel: "#5d7fa8",

  park: "#1f3a31",
  garden: "#23452f",
  reserve: "#1f3c2f",
  wood: "#1d3a2c",
  grass: "#21352f",
  scrub: "#213530",
  golf: "#21402f",
  cemetery: "#25332f",
  pitch: "#22402f",
  wetland: "#1d3434",
  farmland: "#222a2e",
  parkLabel: "#86c093",
  parkDot: "#5f9e6c",

  building: "#252d3a",
  buildingOutline: "#3d4758",
  housenumber: "#8792a3",
  lotLine: "#4a5770",

  roadMinor: "#2a3240",
  roadMinorCasing: "#1c2330",
  roadMajor: "#343e4e",
  roadMajorCasing: "#1f2633",
  trunk: "#3f4250",
  trunkCasing: "#232832",
  motorway: "#544d40",
  motorwayCasing: "#2a2a2c",
  path: "#4c5668",
  cycleway: "#3f7a72",
  pedestrian: "#283040",
  rail: "#3c4554",
  railDash: "#1c2330",
  tram: "#394252",
  tunnelOpacity: 0.3,
  aeroway: "#262d39",

  roadLabel: "#9aa3b1",
  roadLabelHalo: "#1c2330",
  placeCity: "#d5dae2",
  placeSuburb: "#8e98a7",
  placeNeighbourhood: "#727c8b",
  labelHalo: "#1c2330",
  transit: "#7aa7ec",
  boundary: "#3e4658",

  poiFood: "#e2a066",
  poiShop: "#86aee6",
  poiHealth: "#e98a8b",
  poiCivic: "#b5a897",
  poiLeisure: "#86c093",
  poiOther: "#9aa3b1",
};

// ---------------------------------------------------------------------------
// 2. Helpers
// ---------------------------------------------------------------------------

const SOURCE = "openmaptiles";
const FONT_REGULAR = ["Noto Sans Regular"];
const FONT_BOLD = ["Noto Sans Bold"];
const FONT_ITALIC = ["Noto Sans Italic"];

/** English name where tagged, else the local name. */
const NAME: Expr = ["coalesce", ["get", "name:en"], ["get", "name_en"], ["get", "name"]];

type Stops = ReadonlyArray<readonly [number, number]>;

/** Exponential zoom ramp (base 1.5 feels like Google's road growth). */
function ramp(stops: Stops, base = 1.5): Expr {
  return ["interpolate", ["exponential", base], ["zoom"], ...stops.flat()] as unknown as Expr;
}

/** Adds a (zoom-interpolated) amount to every non-zero stop — road casings. */
function widen(stops: Stops, extra: Stops): Stops {
  const extraAt = (z: number): number => {
    // linear interpolation through the `extra` stops
    const first = extra[0];
    const last = extra[extra.length - 1];
    if (!first || !last) return 0;
    if (z <= first[0]) return first[1];
    if (z >= last[0]) return last[1];
    for (let i = 1; i < extra.length; i++) {
      const a = extra[i - 1];
      const b = extra[i];
      if (a && b && z <= b[0]) return a[1] + ((b[1] - a[1]) * (z - a[0])) / (b[0] - a[0]);
    }
    return last[1];
  };
  return stops.map(([z, w]) => [z, w > 0 ? w + extraAt(z) : 0] as const);
}

function linear(stops: Stops): Expr {
  return ["interpolate", ["linear"], ["zoom"], ...stops.flat()] as unknown as Expr;
}

const isLine: Expr = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
const isPolygon: Expr = ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];
const isPoint: Expr = ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false];

function classIn(...classes: string[]): Expr {
  return ["match", ["get", "class"], classes, true, false];
}
function subclassIn(...subclasses: string[]): Expr {
  return ["match", ["get", "subclass"], subclasses, true, false];
}
const notBrunnel: Expr = ["match", ["get", "brunnel"], ["bridge", "tunnel"], false, true];
const isTunnel: Expr = ["==", ["get", "brunnel"], "tunnel"];
const isBridge: Expr = ["==", ["get", "brunnel"], "bridge"];

/** Named community / kitchen gardens and allotments. */
const COMMUNITY_GARDEN: Expr = [
  "any",
  ["==", ["get", "subclass"], "allotments"],
  ["in", "community garden", ["downcase", ["coalesce", ["get", "name"], ""]]],
  ["in", "kitchen garden", ["downcase", ["coalesce", ["get", "name"], ""]]],
];

// Road width ramps (px). Roughly Google-like: thin threads at city zoom,
// growing towards true-ish street widths by z18–20.
const W_MOTORWAY: Stops = [[5, 0.6], [9, 1.6], [12, 3], [14, 5.5], [16, 11], [18, 26], [20, 70]];
const W_TRUNK: Stops = [[7, 0.5], [10, 1.4], [12, 2.6], [14, 5], [16, 10], [18, 24], [20, 64]];
const W_PRIMARY: Stops = [[8, 0.4], [10, 1.1], [12, 2.3], [14, 5], [16, 10.5], [18, 24], [20, 60]];
const W_SECONDARY: Stops = [[9, 0.3], [11, 0.9], [12, 1.7], [14, 4.2], [16, 9], [18, 20], [20, 52]];
// Minor/service roads keep growing to roughly true width at z19–20 so the
// footpaths and driveways mapped beside them line up.
const W_MINOR: Stops = [[12, 0.4], [13, 0.9], [14, 1.9], [15, 3.1], [16, 5.2], [18, 15], [20, 56]];
const W_SERVICE: Stops = [[14, 0.4], [15, 1], [16, 2.2], [18, 6.5], [20, 24]];
const CASING_MAJOR: Stops = [[8, 0.6], [12, 1], [16, 1.6], [20, 3]];
const CASING_MINOR: Stops = [[12, 0.5], [16, 1.2], [20, 2.5]];

// ---------------------------------------------------------------------------
// 3. Layers
// ---------------------------------------------------------------------------

function fill(id: string, sourceLayer: string, filter: Expr, color: string, extra: Partial<maplibregl.FillLayerSpecification> = {}): Layer {
  return {
    id,
    type: "fill",
    source: SOURCE,
    "source-layer": sourceLayer,
    filter,
    ...extra,
    paint: { "fill-color": color, "fill-antialias": true, ...(extra.paint ?? {}) },
  } as maplibregl.FillLayerSpecification;
}

function landLayers(p: Palette): Layer[] {
  return [
    { id: "background", type: "background", paint: { "background-color": p.land } },
    fill("landuse-commercial", "landuse", classIn("commercial", "retail"), p.landWarm, { minzoom: 12 }),
    fill("landuse-industrial", "landuse", classIn("industrial", "garages", "railway", "dam"), p.landIndustrial, { minzoom: 12 }),
    fill("landuse-civic", "landuse", classIn("school", "university", "college", "kindergarten", "library"), p.landCivic, { minzoom: 12 }),
    fill("landuse-hospital", "landuse", classIn("hospital"), p.landHospital, { minzoom: 12 }),
    fill("landcover-farmland", "landcover", classIn("farmland"), p.farmland),
    fill("landcover-sand", "landcover", classIn("sand"), p.sand),
    fill("aeroway-area", "aeroway", ["all", isPolygon, classIn("aerodrome", "runway", "taxiway", "apron")], p.aeroway, { minzoom: 10 }),
  ];
}

function greenLayers(p: Palette): Layer[] {
  const fade = linear([[4, 0.6], [8, 1]]);
  return [
    // Big-picture green first, then more specific green on top so gardens,
    // golf courses and woods inside a park still read as distinct.
    fill("park-reserve", "park", ["all", isPolygon, ["!", classIn("park", "garden")]], p.reserve, { paint: { "fill-color": p.reserve, "fill-opacity": fade } }),
    fill("landcover-wood", "landcover", classIn("wood"), p.wood, { paint: { "fill-color": p.wood, "fill-opacity": fade } }),
    fill("landcover-scrub", "landcover", ["all", classIn("grass"), subclassIn("scrub", "heath", "fell", "grassland", "tundra")], p.scrub),
    fill("landcover-grass", "landcover", ["all", classIn("grass"), subclassIn("grass", "meadow", "village_green", "recreation_ground")], p.grass),
    fill("landcover-wetland", "landcover", classIn("wetland"), p.wetland),
    fill("park", "park", ["all", isPolygon, classIn("park")], p.park),
    fill("landcover-park", "landcover", ["all", classIn("grass"), subclassIn("park")], p.park),
    fill("landuse-cemetery", "landuse", classIn("cemetery"), p.cemetery),
    fill("landcover-golf", "landcover", ["all", classIn("grass"), subclassIn("golf_course")], p.golf),
    fill("landuse-pitch", "landuse", classIn("pitch", "playground", "track"), p.pitch, { minzoom: 13 }),
    fill("landcover-garden", "landcover", ["all", classIn("grass"), subclassIn("garden", "allotments", "plant_nursery")], p.garden),
    fill("park-garden", "park", ["all", isPolygon, classIn("garden")], p.garden),
  ];
}

function waterLayers(p: Palette): Layer[] {
  return [
    {
      id: "waterway",
      type: "line",
      source: SOURCE,
      "source-layer": "waterway",
      filter: ["all", isLine, ["!=", ["get", "brunnel"], "tunnel"]],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": p.waterway,
        "line-width": ["interpolate", ["exponential", 1.4], ["zoom"],
          8, ["match", ["get", "class"], "river", 0.8, 0],
          12, ["match", ["get", "class"], "river", 1.6, "canal", 1, 0.4],
          16, ["match", ["get", "class"], "river", 4, "canal", 3, 1.5],
          20, ["match", ["get", "class"], "river", 12, "canal", 8, 4]],
      },
    },
    fill("water", "water", ["all", isPolygon, ["!=", ["get", "brunnel"], "tunnel"]], p.water),
  ];
}

type RoadClass = { id: string; classes: string[]; width: Stops; casing: Stops; fill: string; casingColor: string; minzoom: number };

function roadClasses(p: Palette): RoadClass[] {
  // Drawn bottom → top, so motorways sit above everything.
  return [
    { id: "service", classes: ["service", "track"], width: W_SERVICE, casing: CASING_MINOR, fill: p.roadMinor, casingColor: p.roadMinorCasing, minzoom: 14 },
    { id: "minor", classes: ["minor"], width: W_MINOR, casing: CASING_MINOR, fill: p.roadMinor, casingColor: p.roadMinorCasing, minzoom: 12 },
    { id: "secondary", classes: ["secondary", "tertiary"], width: W_SECONDARY, casing: CASING_MAJOR, fill: p.roadMajor, casingColor: p.roadMajorCasing, minzoom: 9 },
    { id: "primary", classes: ["primary"], width: W_PRIMARY, casing: CASING_MAJOR, fill: p.roadMajor, casingColor: p.roadMajorCasing, minzoom: 7 },
    { id: "trunk", classes: ["trunk"], width: W_TRUNK, casing: CASING_MAJOR, fill: p.trunk, casingColor: p.trunkCasing, minzoom: 6 },
    { id: "motorway", classes: ["motorway"], width: W_MOTORWAY, casing: CASING_MAJOR, fill: p.motorway, casingColor: p.motorwayCasing, minzoom: 5 },
  ];
}

/** Motorway/trunk slip roads are drawn narrower than their class. */
const LINK_FACTOR: Expr = ["case", ["==", ["get", "ramp"], 1], 0.6, 1];

/** Width ramp whose stop values are scaled per feature (links narrower). */
function roadWidth(stops: Stops): Expr {
  return ["interpolate", ["exponential", 1.5], ["zoom"], ...stops.flatMap(([z, w]) => [z, ["*", w, LINK_FACTOR]])] as unknown as Expr;
}

/**
 * Casing + fill pairs for one brunnel group. Tunnels get a faint fill only
 * (no casing) so the Domain/Burnley tunnels don't scribble across parks.
 */
function roadGroup(p: Palette, group: "tunnel" | "road" | "bridge"): Layer[] {
  const brunnel = group === "tunnel" ? isTunnel : group === "bridge" ? isBridge : notBrunnel;
  const opacity = group === "tunnel" ? p.tunnelOpacity : 1;
  const casings: Layer[] = [];
  const fills: Layer[] = [];
  for (const rc of roadClasses(p)) {
    const filter: Expr = ["all", isLine, brunnel, classIn(...rc.classes)];
    // Minor roads fade in over a zoom level instead of popping.
    const fadeIn = (span: number): Expr | number =>
      rc.id === "minor" || rc.id === "service" ? linear([[rc.minzoom, 0], [rc.minzoom + span, opacity]]) : opacity;
    const base = { type: "line", source: SOURCE, "source-layer": "transportation", minzoom: group === "tunnel" ? Math.max(rc.minzoom, 12) : rc.minzoom, filter } as const;
    if (group !== "tunnel") {
      casings.push({
        ...base,
        id: `${group}-${rc.id}-casing`,
        layout: { "line-cap": group === "road" ? "round" : "butt", "line-join": "round" },
        paint: {
          "line-color": rc.casingColor,
          "line-width": roadWidth(widen(rc.width, rc.casing)),
          "line-opacity": fadeIn(1.5),
        },
      });
    }
    fills.push({
      ...base,
      id: `${group}-${rc.id}`,
      layout: { "line-cap": group === "tunnel" ? "butt" : "round", "line-join": "round" },
      paint: {
        "line-color": rc.fill,
        "line-width": roadWidth(rc.width),
        "line-opacity": fadeIn(1),
      },
    });
  }
  return [...casings, ...fills];
}

function pathLayers(p: Palette): Layer[] {
  // Footpaths, cycleways, steps, tracks through parks: the things you use to
  // work out exactly where you're standing. Cycleways get a teal tint.
  const isCycleway: Expr = ["==", ["get", "subclass"], "cycleway"];
  return [
    fill("pedestrian-area", "transportation", ["all", isPolygon, classIn("pedestrian", "path")], p.pedestrian, { minzoom: 14 }),
    {
      id: "pedestrian",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 14,
      filter: ["all", isLine, classIn("pedestrian")],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": p.pedestrian, "line-width": ramp([[14, 1], [16, 3], [18, 8], [20, 20]]) },
    },
    {
      id: "path",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 14.5,
      filter: ["all", isLine, classIn("path", "track"), ["!=", ["get", "brunnel"], "tunnel"]],
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": ["case", isCycleway, p.cycleway, p.path],
        "line-width": ramp([[14.5, 0.6], [16, 1], [18, 1.6], [20, 2.6]]),
        "line-dasharray": [2.5, 1.5],
        "line-opacity": linear([[14.5, 0], [15.5, 1]]),
      },
    },
  ];
}

function railLayers(p: Palette): Layer[] {
  // Heavy rail + light rail; trams are drawn separately, above the roads.
  const filter: Expr = ["all", isLine, classIn("rail", "transit"), ["!", subclassIn("tram")], ["!=", ["get", "brunnel"], "tunnel"], ["!", ["has", "service"]]];
  const width = ramp([[10, 0.6], [14, 1.6], [18, 3.2], [20, 5]]);
  return [
    {
      id: "rail",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 10,
      filter,
      paint: { "line-color": p.rail, "line-width": width },
    },
    {
      id: "rail-dash",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 13,
      filter,
      paint: {
        "line-color": p.railDash,
        "line-width": ramp([[13, 0.4], [14, 0.8], [18, 1.8], [20, 3]]),
        "line-dasharray": [3, 3],
      },
    },
  ];
}

function tramLayers(p: Palette): Layer[] {
  const notTunnel: Expr = ["!=", ["get", "brunnel"], "tunnel"];
  return [
    {
      // Melbourne's trams run down most major roads: a thin line on top of the
      // road fill is enough to recognise a tram route.
      id: "tram",
      type: "line",
      source: SOURCE,
      "source-layer": "transportation",
      minzoom: 14,
      filter: ["all", isLine, subclassIn("tram"), notTunnel],
      paint: { "line-color": p.tram, "line-width": ramp([[14, 0.6], [16, 1], [18, 1.6], [20, 2.4]]) },
    },
  ];
}

function buildingLayers(p: Palette): Layer[] {
  // Flat footprints with a crisp outline, so individual houses are easy to
  // tell apart when placing a pin.
  return [
    {
      id: "building",
      type: "fill",
      source: SOURCE,
      "source-layer": "building",
      minzoom: 13.5,
      paint: {
        "fill-color": p.building,
        "fill-opacity": linear([[13.5, 0], [14.5, 1]]),
      },
    },
    {
      id: "building-outline",
      type: "line",
      source: SOURCE,
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "line-color": p.buildingOutline,
        "line-width": linear([[14, 0.4], [16, 0.7], [18, 1], [20, 1.4]]),
        "line-opacity": linear([[14, 0], [15, 1]]),
      },
    },
  ];
}

function housenumberLayers(p: Palette, vicmap: boolean): Layer[] {
  const layout: maplibregl.SymbolLayerSpecification["layout"] = {
    "text-font": FONT_REGULAR,
    "text-size": linear([[16.5, 9.5], [18, 11], [20, 13]]),
    "text-padding": 1,
    "text-max-width": 6,
  };
  const paint: maplibregl.SymbolLayerSpecification["paint"] = {
    "text-color": p.housenumber,
    "text-halo-color": p.building,
    "text-halo-width": 1.2,
    "text-opacity": linear([[16.5, 0], [17, 1]]),
  };
  const osm: Layer = {
    id: "housenumber",
    type: "symbol",
    source: SOURCE,
    "source-layer": "housenumber",
    minzoom: 16.5,
    layout: { ...layout, "text-field": ["get", "housenumber"] },
    paint,
  };
  if (!vicmap) return [osm];
  return [
    // Inside Reservoir the official Vicmap numbers replace OSM's, so the two
    // never double up. The address file only holds points inside this same
    // outline (see scripts/vicmap/fetch-reservoir.ts).
    { ...osm, filter: ["!", ["within", RESERVOIR_OUTLINE]] as unknown as Expr },
    {
      id: "vicmap-housenumber",
      type: "symbol",
      source: VICMAP_ADDRESSES,
      minzoom: 16.5,
      layout: { ...layout, "text-field": ["get", "n"] },
      paint,
    },
  ];
}

// --- Vicmap (Victorian Government) property data, Reservoir only ------------
// Static GeoJSON in web/public/data/vicmap/, built by
// scripts/vicmap/fetch-reservoir.ts. Only added to the style once the view
// reaches Reservoir (see `vicmapInView` in basemap.ts), so other areas never
// download it.

const VICMAP_PARCELS = "vicmap-parcels";
const VICMAP_ADDRESSES = "vicmap-addresses";
const VICMAP_ATTRIBUTION =
  'Contains Vicmap Property and Vicmap Address data &copy; State of Victoria (Department of Transport and Planning), ' +
  '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank">CC BY 4.0</a>';

function vicmapSources(): Spec["sources"] {
  return {
    [VICMAP_PARCELS]: {
      type: "geojson",
      data: "/data/vicmap/reservoir-parcels.json",
      attribution: VICMAP_ATTRIBUTION,
    },
    [VICMAP_ADDRESSES]: {
      type: "geojson",
      data: "/data/vicmap/reservoir-addresses.json",
      attribution: VICMAP_ATTRIBUTION,
    },
  };
}

/** Property boundaries: hairlines that firm up as you zoom in to pick a house. */
function lotLayers(p: Palette): Layer[] {
  return [
    {
      id: "vicmap-lot-line",
      type: "line",
      source: VICMAP_PARCELS,
      minzoom: 15.5,
      layout: { "line-join": "round" },
      paint: {
        "line-color": p.lotLine,
        "line-width": linear([[15.5, 0.4], [17, 0.7], [19, 1.1], [20, 1.4]]),
        "line-opacity": linear([[15.5, 0], [16.5, 0.7], [17.5, 1]]),
      },
    },
  ];
}

function boundaryLayers(p: Palette): Layer[] {
  return [
    {
      id: "boundary-state",
      type: "line",
      source: SOURCE,
      "source-layer": "boundary",
      maxzoom: 9,
      filter: ["all", ["<=", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
      paint: { "line-color": p.boundary, "line-width": 1, "line-dasharray": [3, 2] },
    },
  ];
}

// --- POIs -----------------------------------------------------------------

/**
 * `<name>_11` icons in the OpenFreeMap "ofm" sprite (pre-coloured badges).
 * MapLibre v4's `coalesce` can't fall back past a missing image, so icons are
 * picked by explicit lookup instead.
 */
const SPRITE_ICONS = [
  "alcohol_shop", "art_gallery", "attraction", "bakery", "bank", "bar", "beer", "bicycle", "bicycle_rental", "bus",
  "butcher", "cafe", "campsite", "car", "castle", "cemetery", "cinema", "clothing_store", "college", "dentist",
  "doctors", "dog_park", "drinking_water", "fast_food", "ferry", "fire_station", "fuel", "garden", "gift", "golf",
  "grocery", "hairdresser", "harbor", "hospital", "ice_cream", "information", "laundry", "library", "lodging",
  "monument", "museum", "music", "park", "parking", "parking_garage", "pharmacy", "picnic_site", "pitch",
  "place_of_worship", "playground", "police", "post", "railway", "railway_light", "restaurant", "school", "shelter",
  "shop", "soccer", "stadium", "swimming", "telephone", "tennis", "theatre", "toilets", "town_hall", "veterinary",
  "zoo",
];

/** Sprite icon for a POI: `<subclass>_11`, else `<class>_11`, else a dot. */
const POI_ICON: Expr = [
  "match",
  ["get", "subclass"],
  SPRITE_ICONS,
  ["concat", ["get", "subclass"], "_11"],
  ["match", ["get", "class"], SPRITE_ICONS, ["concat", ["get", "class"], "_11"], "dot_11"],
];

function poiColor(p: Palette): Expr {
  return [
    "match",
    ["get", "class"],
    ["cafe", "restaurant", "fast_food", "bar", "beer", "ice_cream", "bakery"], p.poiFood,
    ["shop", "grocery", "clothing_store", "alcohol_shop", "furniture", "gift", "florist", "hairdresser", "laundry", "butcher", "car", "bicycle", "fuel"], p.poiShop,
    ["hospital", "pharmacy", "doctors", "dentist", "veterinary"], p.poiHealth,
    ["school", "college", "library", "place_of_worship", "town_hall", "post", "police", "fire_station", "museum", "art_gallery", "theatre", "cinema"], p.poiCivic,
    ["playground", "pitch", "sports", "swimming", "stadium", "golf", "dog_park", "picnic_site", "tennis", "soccer"], p.poiLeisure,
    p.poiOther,
  ] as unknown as Expr;
}

/**
 * Shops, cafés, schools, churches, pharmacies, playgrounds… progressively by
 * the tile's `rank` (lower = more notable) so z15 shows a handful of
 * landmarks and z17+ shows nearly everything. Parks/gardens and transit have
 * their own layers.
 */
function poiLayers(p: Palette): Layer[] {
  const notOwnLayer: Expr = ["!", classIn("park", "garden", "railway", "bus", "entrance")];
  // Landmarks people navigate by show from z15 whatever their tile rank.
  const landmark: Expr = ["any", classIn("school", "college", "place_of_worship", "hospital", "pharmacy", "library", "town_hall", "post"), subclassIn("supermarket", "playground")];
  const poi = (id: string, minzoom: number, rankFilter: Expr): Layer => ({
    id,
    type: "symbol",
    source: SOURCE,
    "source-layer": "poi",
    minzoom,
    filter: ["all", isPoint, notOwnLayer, ["has", "name"], rankFilter],
    layout: {
      "icon-image": POI_ICON,
      "icon-size": linear([[minzoom, 0.8], [18, 1], [20, 1.1]]),
      "text-field": NAME,
      "text-font": FONT_REGULAR,
      "text-size": linear([[15, 10.5], [18, 11.5], [20, 12.5]]),
      "text-max-width": 8,
      "text-anchor": "top",
      "text-offset": [0, 0.8],
      "text-optional": true,
      "text-padding": 2,
      "symbol-sort-key": ["get", "rank"],
    },
    paint: { "text-color": poiColor(p), "text-halo-color": p.labelHalo, "text-halo-width": 1.4 },
  });
  return [
    poi("poi-17", 17, ["all", ["!", landmark], [">", ["get", "rank"], 20]]),
    poi("poi-16", 16, ["all", ["!", landmark], [">", ["get", "rank"], 6], ["<=", ["get", "rank"], 20]]),
    poi("poi-15", 15, ["any", landmark, ["<=", ["get", "rank"], 6]]),
  ];
}

/** Bus and tram stops: icon only until z18 so they don't crowd street names. */
function stopLayers(p: Palette): Layer[] {
  return [
    {
      id: "poi-stop",
      type: "symbol",
      source: SOURCE,
      "source-layer": "poi",
      minzoom: 16,
      filter: ["all", isPoint, ["any", ["all", classIn("bus"), subclassIn("bus_stop")], ["all", classIn("railway"), subclassIn("tram_stop")]]],
      layout: {
        "icon-image": ["match", ["get", "subclass"], "tram_stop", "railway_light_11", "bus_11"],
        "icon-size": linear([[16, 0.7], [18, 0.9], [20, 1]]),
        "text-field": ["step", ["zoom"], "", 18, NAME],
        "text-font": FONT_REGULAR,
        "text-size": 10.5,
        "text-max-width": 8,
        "text-anchor": "top",
        "text-offset": [0, 0.8],
        "text-optional": true,
      },
      paint: { "text-color": p.transit, "text-halo-color": p.labelHalo, "text-halo-width": 1.4 },
    },
  ];
}

// --- Labels ---------------------------------------------------------------

function labelLayers(p: Palette): Layer[] {
  const halo = { "text-halo-color": p.labelHalo, "text-halo-width": 1.4, "text-halo-blur": 0.4 };
  return [
    {
      id: "label-waterway",
      type: "symbol",
      source: SOURCE,
      "source-layer": "waterway",
      minzoom: 13,
      filter: ["all", isLine, classIn("river", "canal")],
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": FONT_ITALIC,
        "text-size": 12,
        "text-letter-spacing": 0.05,
        "symbol-spacing": 400,
      },
      paint: { "text-color": p.waterLabel, ...halo, "text-halo-color": p.water, "text-halo-width": 0 },
    },
    {
      id: "label-water",
      type: "symbol",
      source: SOURCE,
      "source-layer": "water_name",
      filter: isPoint,
      layout: {
        "text-field": NAME,
        "text-font": FONT_ITALIC,
        "text-size": linear([[8, 11], [14, 14]]),
        "text-letter-spacing": 0.08,
        "text-max-width": 8,
      },
      paint: { "text-color": p.waterLabel },
    },
    {
      id: "label-park",
      type: "symbol",
      source: SOURCE,
      "source-layer": "poi",
      minzoom: 14,
      filter: ["all", isPoint, classIn("park", "garden"), subclassIn("park", "garden", "nature_reserve"), ["has", "name"], ["!", COMMUNITY_GARDEN]],
      layout: {
        "text-field": NAME,
        "text-font": FONT_ITALIC,
        "text-size": linear([[14, 11], [17, 13]]),
        "text-max-width": 6,
        "text-anchor": "center",
        "text-padding": linear([[14, 14], [16, 4]]),
        "text-line-height": 1.15,
      },
      paint: { "text-color": p.parkLabel, ...halo, "text-halo-width": 1.2 },
    },
    {
      id: "label-park-large",
      type: "symbol",
      source: SOURCE,
      "source-layer": "park",
      minzoom: 10,
      maxzoom: 13,
      filter: ["all", isPoint, ["has", "name"]],
      layout: {
        "text-field": NAME,
        "text-font": FONT_ITALIC,
        "text-size": 11,
        "text-max-width": 7,
        "text-padding": 8,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": p.parkLabel, ...halo, "text-halo-width": 1.2 },
    },
    {
      // Community & kitchen gardens are where herbs live — give them a little
      // tulip badge and show them a zoom level earlier than other gardens.
      id: "label-community-garden",
      type: "symbol",
      source: SOURCE,
      "source-layer": "poi",
      minzoom: 14,
      filter: ["all", isPoint, classIn("garden", "park"), COMMUNITY_GARDEN],
      layout: {
        "icon-image": "garden_11",
        "icon-size": linear([[14, 0.6], [17, 0.8]]),
        "text-field": NAME,
        "text-font": FONT_ITALIC,
        "text-size": linear([[14, 11], [17, 12.5]]),
        "text-max-width": 7,
        "text-anchor": "top",
        "text-offset": [0, 0.9],
        "text-optional": true,
      },
      paint: { "text-color": p.parkLabel, ...halo },
    },
    {
      // Driveways and car-park aisles are rarely named; laneways often are.
      id: "label-road-path",
      type: "symbol",
      source: SOURCE,
      "source-layer": "transportation_name",
      minzoom: 16,
      filter: ["all", isLine, classIn("service", "track", "path", "pedestrian")],
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": FONT_REGULAR,
        "text-size": linear([[16, 9.5], [18, 11], [20, 12.5]]),
        "symbol-spacing": 250,
        "text-padding": 2,
      },
      paint: { "text-color": p.roadLabel, "text-halo-color": p.roadLabelHalo, "text-halo-width": 1.4 },
    },
    {
      id: "label-road-minor",
      type: "symbol",
      source: SOURCE,
      "source-layer": "transportation_name",
      minzoom: 14,
      filter: ["all", isLine, classIn("minor")],
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": FONT_REGULAR,
        "text-size": linear([[14, 10], [16, 11], [18, 12.5], [20, 14]]),
        "symbol-spacing": 300,
        "text-padding": 4,
      },
      paint: { "text-color": p.roadLabel, "text-halo-color": p.roadLabelHalo, "text-halo-width": 1.5 },
    },
    {
      id: "label-road-major",
      type: "symbol",
      source: SOURCE,
      "source-layer": "transportation_name",
      minzoom: 12.5,
      filter: ["all", isLine, classIn("trunk", "primary", "secondary", "tertiary")],
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": FONT_REGULAR,
        "text-size": linear([[12.5, 10.5], [15, 12], [18, 14], [20, 15.5]]),
        "symbol-spacing": 350,
        "text-padding": 6,
      },
      paint: { "text-color": p.roadLabel, "text-halo-color": p.roadLabelHalo, "text-halo-width": 1.6 },
    },
    {
      id: "label-motorway",
      type: "symbol",
      source: SOURCE,
      "source-layer": "transportation_name",
      minzoom: 11,
      filter: ["all", isLine, classIn("motorway")],
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": FONT_REGULAR,
        "text-size": linear([[11, 10.5], [16, 12.5]]),
        "symbol-spacing": 500,
      },
      paint: { "text-color": p.roadLabel, "text-halo-color": p.roadLabelHalo, "text-halo-width": 1.6 },
    },
    {
      id: "label-transit",
      type: "symbol",
      source: SOURCE,
      "source-layer": "poi",
      minzoom: 14,
      filter: ["all", isPoint, classIn("railway"), subclassIn("station", "halt")],
      layout: {
        "text-field": NAME,
        "text-font": FONT_REGULAR,
        "text-size": 11.5,
        "text-max-width": 8,
        "text-anchor": "top",
        "text-offset": [0, 0.7],
        "icon-image": "railway_11",
        "icon-size": 0.9,
      },
      paint: { "text-color": p.transit, ...halo },
    },
    {
      id: "label-neighbourhood",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      minzoom: 14,
      filter: classIn("neighbourhood", "quarter", "hamlet"),
      layout: {
        "text-field": NAME,
        "text-font": FONT_REGULAR,
        "text-size": 10.5,
        "text-transform": "uppercase",
        "text-letter-spacing": 0.14,
        "text-max-width": 8,
        "text-padding": 6,
      },
      paint: { "text-color": p.placeNeighbourhood, ...halo },
    },
    {
      id: "label-suburb",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      minzoom: 11,
      maxzoom: 16,
      filter: classIn("suburb", "village", "town"),
      layout: {
        "text-field": NAME,
        "text-font": FONT_REGULAR,
        "text-size": linear([[11, 10], [13, 11.5], [15, 13]]),
        "text-transform": "uppercase",
        "text-letter-spacing": 0.16,
        "text-max-width": 8,
        "text-padding": 4,
        "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": p.placeSuburb, ...halo, "text-halo-width": 1.6 },
    },
    {
      id: "label-city",
      type: "symbol",
      source: SOURCE,
      "source-layer": "place",
      maxzoom: 14,
      filter: classIn("city"),
      layout: {
        "text-field": NAME,
        "text-font": FONT_BOLD,
        "text-size": linear([[6, 13], [10, 16], [13, 18]]),
        "text-letter-spacing": 0.02,
        "text-max-width": 8,
      },
      paint: { "text-color": p.placeCity, ...halo, "text-halo-width": 1.8 },
    },
  ];
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export type StyleOptions = {
  /** Include the Vicmap lot lines + street numbers (Reservoir only). */
  vicmap?: boolean;
};

export function sageMapStyle(theme: MapTheme, { vicmap = false }: StyleOptions = {}): Spec {
  const p = theme === "dark" ? DARK : LIGHT;
  return {
    version: 8,
    name: `Sage ${theme}`,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sprite: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
    sources: {
      [SOURCE]: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        attribution:
          '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> ' +
          '<a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> ' +
          '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
      },
      ...(vicmap ? vicmapSources() : {}),
    },
    layers: [
      ...landLayers(p),
      ...greenLayers(p),
      ...waterLayers(p),
      ...roadGroup(p, "tunnel"),
      ...railLayers(p),
      ...pathLayers(p),
      ...roadGroup(p, "road"),
      ...roadGroup(p, "bridge"),
      ...tramLayers(p),
      ...(vicmap ? lotLayers(p) : []),
      ...buildingLayers(p),
      ...boundaryLayers(p),
      // Symbols: later layers win collisions, so house numbers give way to
      // POIs, which give way to street/place names.
      ...housenumberLayers(p, vicmap),
      ...poiLayers(p),
      ...stopLayers(p),
      ...labelLayers(p),
    ],
  };
}
