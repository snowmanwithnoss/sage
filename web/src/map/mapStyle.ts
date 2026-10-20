// Sage basemap: a hand-built MapLibre vector style in the spirit of the modern
// Google Maps phone app — calm, pastel, legible — tuned for a herb-spotting app,
// so green space is the hero.
//
// Data: OpenFreeMap vector tiles (OpenMapTiles schema, free, no API key).
// Schema reference: https://openmaptiles.org/schema/
//
// Layout of this file:
//   1. Palettes (one per theme) — every colour lives here.
//   2. Small helpers (zoom ramps, filters, name field).
//   3. Layer builders, grouped: land → water → green space → roads/rail →
//      buildings → labels. Order in the final array is draw order.

import type maplibregl from "maplibre-gl";

export type MapTheme = "light" | "dark";

/** Inner Melbourne (just north of the CBD, so Carlton/Fitzroy/Southbank are in view). */
export const MELBOURNE_CENTER: [number, number] = [144.9671, -37.8105];
export const MELBOURNE_ZOOM = 13;

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
  buildingTop: string; // fill-extrusion colour
  buildingOpacity: number;

  roadMinor: string;
  roadMinorCasing: string;
  roadMajor: string;
  roadMajorCasing: string;
  trunk: string;
  trunkCasing: string;
  motorway: string;
  motorwayCasing: string;
  path: string;
  pedestrian: string;
  rail: string;
  railDash: string;
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

  building: "#efede8",
  buildingOutline: "#e8e5df",
  buildingTop: "#e3dfd7",
  buildingOpacity: 0.85,

  roadMinor: "#ffffff",
  roadMinorCasing: "#e4e1da",
  roadMajor: "#ffffff",
  roadMajorCasing: "#d9d4ca",
  trunk: "#fef5d9",
  trunkCasing: "#ecdcae",
  motorway: "#fddf97",
  motorwayCasing: "#e8c070",
  path: "#dedad1",
  pedestrian: "#fbfaf7",
  rail: "#cfccc5",
  railDash: "#f5f3ee",
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

  building: "#232b37",
  buildingOutline: "#29313e",
  buildingTop: "#202733",
  buildingOpacity: 0.9,

  roadMinor: "#2a3240",
  roadMinorCasing: "#1c2330",
  roadMajor: "#343e4e",
  roadMajorCasing: "#1f2633",
  trunk: "#3f4250",
  trunkCasing: "#232832",
  motorway: "#544d40",
  motorwayCasing: "#2a2a2c",
  path: "#2f3644",
  pedestrian: "#283040",
  rail: "#3c4554",
  railDash: "#1c2330",
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
// growing towards true-ish street widths by z18+.
const W_MOTORWAY: Stops = [[5, 0.6], [9, 1.6], [12, 3], [14, 5.5], [16, 11], [18, 26], [20, 70]];
const W_TRUNK: Stops = [[7, 0.5], [10, 1.4], [12, 2.6], [14, 5], [16, 10], [18, 24], [20, 64]];
const W_PRIMARY: Stops = [[8, 0.4], [10, 1.1], [12, 2.3], [14, 5], [16, 10.5], [18, 24], [20, 60]];
const W_SECONDARY: Stops = [[9, 0.3], [11, 0.9], [12, 1.7], [14, 4.2], [16, 9], [18, 20], [20, 52]];
const W_MINOR: Stops = [[12, 0.4], [13, 0.9], [14, 1.9], [15, 3.1], [16, 5.2], [18, 13], [20, 36]];
const W_SERVICE: Stops = [[14, 0.4], [15, 1], [16, 2.2], [18, 6], [20, 16]];
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
      minzoom: 15.5,
      filter: ["all", isLine, classIn("path"), ["!=", ["get", "brunnel"], "tunnel"]],
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: {
        "line-color": p.path,
        "line-width": ramp([[15.5, 0.6], [18, 1.2], [20, 2]]),
        "line-dasharray": [2, 1.5],
        "line-opacity": linear([[15.5, 0], [16.5, 1]]),
      },
    },
  ];
}

function railLayers(p: Palette): Layer[] {
  // Heavy rail + light rail only: Melbourne's trams run down most major
  // roads and would draw a grey line along every one of them.
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

function buildingLayers(p: Palette): Layer[] {
  return [
    {
      id: "building",
      type: "fill",
      source: SOURCE,
      "source-layer": "building",
      minzoom: 14.5,
      maxzoom: 16,
      paint: {
        "fill-color": p.building,
        "fill-outline-color": p.buildingOutline,
        "fill-opacity": linear([[14.5, 0], [15.3, 1], [15.6, 1], [16, 0]]),
      },
    },
    {
      id: "building-3d",
      type: "fill-extrusion",
      source: SOURCE,
      "source-layer": "building",
      minzoom: 15,
      filter: ["!=", ["get", "hide_3d"], true],
      paint: {
        "fill-extrusion-color": p.buildingTop,
        "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.8, ["get", "render_height"]],
        "fill-extrusion-base": ["get", "render_min_height"],
        "fill-extrusion-opacity": linear([[15, 0], [15.6, p.buildingOpacity]]),
        "fill-extrusion-vertical-gradient": true,
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
      id: "label-road-minor",
      type: "symbol",
      source: SOURCE,
      "source-layer": "transportation_name",
      minzoom: 15,
      filter: ["all", isLine, classIn("minor", "service")],
      layout: {
        "symbol-placement": "line",
        "text-field": NAME,
        "text-font": FONT_REGULAR,
        "text-size": linear([[15, 10.5], [18, 12.5]]),
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
        "text-size": linear([[12.5, 10.5], [15, 12], [18, 14]]),
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

export function sageMapStyle(theme: MapTheme): Spec {
  const p = theme === "dark" ? DARK : LIGHT;
  return {
    version: 8,
    name: `Sage ${theme}`,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sprite: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
    // Soft, low-contrast lighting so 3D buildings look like Google's pale
    // massing models rather than grey slabs.
    light: { anchor: "viewport", color: "#ffffff", intensity: theme === "dark" ? 0.25 : 0.2, position: [1.2, 200, 35] },
    sources: {
      [SOURCE]: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        attribution:
          '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> ' +
          '<a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> ' +
          '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
      },
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
      ...buildingLayers(p),
      ...boundaryLayers(p),
      ...labelLayers(p),
    ],
  };
}
