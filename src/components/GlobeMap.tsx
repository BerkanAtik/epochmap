import type { FeatureCollection, Point } from "geojson";
import {
  AttributionControl,
  type ExpressionSpecification,
  type GeoJSONSource,
  GPUInitializationError,
  type LayerSpecification,
  Map as MapLibreMap,
  type PaddingOptions,
  type StyleSpecification,
  setWorkerUrl,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { type Disputes, topojsonUrl, type WaterLabelProps, type WindowData } from "../data/atlas";
import { PALETTE } from "../lib/colors";
import { LABEL_FONT, LABEL_FONT_ITALIC, loadMapFonts } from "../lib/fonts";
import { graticule } from "../lib/graticule";
import type { Lang } from "../lib/i18n";
import { registerTopoJsonProtocol } from "../lib/topojson";

setWorkerUrl(workerUrl);

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Touch screens have no hover: hover effects would stick after every tap. */
const canHover = matchMedia("(hover: hover)").matches;
const FADE_MS = reducedMotion ? 0 : 500;

/**
 * NASA's Blue Marble with shaded relief and bathymetry (public domain): land as seen from
 * space, and oceans in blue, lighter over continental shelves and navy over the deep sea.
 */
const IMAGERY =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";

/** Polities at least this large (km²) get spaced small-caps labels, like on a printed atlas. */
const LARGE_AREA = 1_500_000;
const FILL_OPACITY = 0.46;
const PALETTE_CSS = PALETTE.map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`);

const COLORS = {
  /** Shows while imagery loads (and if it can't), so the sea is never black. */
  background: "#174a7c",
  /** A light blue wash over the imagery's oceans; the deep sea would otherwise look almost black. */
  oceanTint: "#2f7fd0",
  /** Lakes are barely visible in the imagery, so they are drawn as solid water. */
  lake: "#3478bf",
  waterLabel: "#cfe6ff",
  waterHalo: "rgba(10, 42, 82, 0.7)",
  grid: "rgba(214, 226, 255, 0.07)",
  border: "rgba(255, 249, 235, 0.78)",
  label: "#fbf4e4",
  halo: "rgba(5, 9, 18, 0.88)",
  selected: "#ffe2a0",
  dispute: "rgba(255, 236, 200, 0.95)",
};

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * Shapes carry their own year range; the map shows those that include the "year" state. The
 * page sets that state to the last year in which anything changed, not to the year itself, so
 * MapLibre only re-filters when the map really changes.
 */
const inYear: ExpressionSpecification = [
  "all",
  ["<=", ["get", "f"], ["global-state", "year"]],
  [">=", ["get", "t"], ["global-state", "year"]],
];
const localName: ExpressionSpecification = [
  "case",
  ["==", ["global-state", "lang"], "tr"],
  ["get", "tr"],
  ["get", "en"],
];
/** Upper-cased on load with each language's rules (MapLibre's `upcase` turns Turkish "i" into "I"). */
const localUpper: ExpressionSpecification = [
  "case",
  ["==", ["global-state", "lang"], "tr"],
  ["get", "tru"],
  ["get", "enu"],
];
/** The data build picks a palette index per polity so that neighbours never share a colour. */
const polityColor: ExpressionSpecification = [
  "to-color",
  ["at", ["number", ["get", "c"], 0], ["literal", PALETTE_CSS]],
];

/**
 * Two identical layer stacks ("a" and "b"). When the year moves into another time window, the
 * new window loads into the hidden stack and the two cross-fade.
 */
type Slot = "a" | "b";
const other = (slot: Slot): Slot => (slot === "a" ? "b" : "a");
const polSource = (slot: Slot) => `pol-${slot}`;
const labSource = (slot: Slot) => `lab-${slot}`;
const fillLayer = (slot: Slot) => `pol-${slot}-fill`;
const DISPUTE_FILL = "dispute-fill";

function slotLayers(slot: Slot): { fills: LayerSpecification[]; lines: LayerSpecification[] } {
  const source = polSource(slot);
  return {
    fills: [
      {
        id: fillLayer(slot),
        type: "fill",
        source,
        filter: inYear,
        paint: { "fill-color": polityColor, "fill-opacity": 0, "fill-antialias": true },
      },
      {
        id: `pol-${slot}-hover`,
        type: "fill",
        source,
        filter: inYear,
        paint: {
          "fill-color": "#ffffff",
          "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.16, 0],
        },
      },
    ],
    lines: [
      {
        id: `pol-${slot}-line`,
        type: "line",
        source,
        filter: inYear,
        layout: { "line-join": "round" },
        paint: {
          "line-color": COLORS.border,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.45, 4, 0.9, 7, 1.6],
          "line-opacity": 0,
        },
      },
      {
        id: `pol-${slot}-selected`,
        type: "line",
        source,
        filter: inYear,
        layout: { "line-join": "round" },
        paint: {
          "line-color": COLORS.selected,
          "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.4, 0],
        },
      },
    ],
  };
}

function labelLayer(slot: Slot): LayerSpecification {
  const large: ExpressionSpecification = [">=", ["get", "a"], LARGE_AREA];
  // Text grows with the square root of the area (a proxy for the polity's width) and with zoom.
  const sizeAt = (min: number, max: number): ExpressionSpecification => [
    "interpolate",
    ["linear"],
    ["sqrt", ["get", "a"]],
    0,
    min,
    3000,
    max,
  ];
  return {
    id: labSource(slot),
    type: "symbol",
    source: labSource(slot),
    filter: inYear,
    layout: {
      "text-field": ["case", large, localUpper, localName],
      "text-font": [LABEL_FONT],
      "text-size": ["interpolate", ["linear"], ["zoom"], 1, sizeAt(9, 15), 5, sizeAt(12, 26)],
      "text-letter-spacing": ["case", large, 0.14, 0.02],
      "text-max-width": 9,
      "text-padding": 3,
      "symbol-sort-key": ["-", 0, ["get", "a"]],
    },
    paint: {
      "text-color": COLORS.label,
      "text-halo-color": COLORS.halo,
      "text-halo-width": 1.4,
      "text-halo-blur": 0.4,
      "text-opacity": 0,
    },
  };
}

function buildStyle(year: number, lang: Lang): StyleSpecification {
  const a = slotLayers("a");
  const b = slotLayers("b");
  return {
    version: 8,
    projection: { type: "globe" },
    state: { year: { default: year }, lang: { default: lang } },
    // No `glyphs` URL: labels are drawn with the page's own fonts (see lib/fonts.ts).
    sky: {
      "sky-color": "#0b1a33",
      "horizon-color": "#4a7bb8",
      "fog-color": "#0b1a33",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.9,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 4, 1, 7, 0],
    },
    transition: { duration: FADE_MS, delay: 0 },
    sources: {
      imagery: {
        type: "raster",
        tiles: [IMAGERY],
        tileSize: 256,
        maxzoom: 8,
        attribution: "Imagery: <a href='https://earthdata.nasa.gov/gibs'>NASA Blue Marble, GIBS</a>",
      },
      grid: { type: "geojson", data: graticule() },
      "pol-a": { type: "geojson", data: EMPTY, promoteId: "id" },
      "pol-b": { type: "geojson", data: EMPTY, promoteId: "id" },
      "lab-a": { type: "geojson", data: EMPTY },
      "lab-b": { type: "geojson", data: EMPTY },
      disputes: {
        type: "geojson",
        data: EMPTY,
        promoteId: "id",
        attribution:
          "Borders: <a href='https://github.com/Seshat-Global-History-Databank/cliopatria'>Cliopatria</a>, <a href='https://icr.ethz.ch/data/cshapes/'>CShapes 2.0</a>, <a href='https://www.naturalearthdata.com/'>Natural Earth</a>",
      },
      "dispute-labels": { type: "geojson", data: EMPTY },
      ocean: { type: "geojson", data: EMPTY },
      lakes: { type: "geojson", data: EMPTY },
      "water-labels": { type: "geojson", data: EMPTY },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": COLORS.background } },
      {
        id: "imagery",
        type: "raster",
        source: "imagery",
        paint: { "raster-contrast": 0.06, "raster-fade-duration": 200 },
      },
      { id: "grid", type: "line", source: "grid", paint: { "line-color": COLORS.grid, "line-width": 0.7 } },
      ...a.fills,
      ...b.fills,
      // Water above the countries keeps coasts clean and lakes blue whatever the period.
      {
        id: "ocean",
        type: "fill",
        source: "ocean",
        paint: { "fill-color": COLORS.oceanTint, "fill-opacity": 0.34, "fill-antialias": false },
      },
      {
        id: "lakes",
        type: "fill",
        source: "lakes",
        paint: { "fill-color": COLORS.lake, "fill-opacity": 0.95 },
      },
      ...a.lines,
      ...b.lines,
      {
        id: DISPUTE_FILL,
        type: "fill",
        source: "disputes",
        filter: inYear,
        paint: { "fill-pattern": "hatch", "fill-opacity": 0.9 },
      },
      {
        id: "dispute-line",
        type: "line",
        source: "disputes",
        filter: inYear,
        paint: {
          "line-color": COLORS.dispute,
          "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.4, 1.1],
          "line-dasharray": [2, 1.5],
        },
      },
      // Water names sit below country names, so countries win when labels collide.
      ...waterLabelLayers(),
      labelLayer("a"),
      labelLayer("b"),
      {
        id: "dispute-labels",
        type: "symbol",
        source: "dispute-labels",
        filter: inYear,
        minzoom: 3,
        layout: {
          "text-field": localName,
          "text-font": [LABEL_FONT_ITALIC],
          "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 7, 14],
          "text-max-width": 8,
        },
        paint: {
          "text-color": COLORS.dispute,
          "text-halo-color": COLORS.halo,
          "text-halo-width": 1.2,
        },
      },
    ],
  };
}

/**
 * Ocean, sea and lake names in italic light blue, like on a printed atlas: oceans from the
 * start, main seas once the globe fills the screen, smaller seas and lakes closer in.
 */
function waterLabelLayers(): LayerSpecification[] {
  const paint = {
    "text-color": COLORS.waterLabel,
    "text-halo-color": COLORS.waterHalo,
    "text-halo-width": 1.2,
    "text-halo-blur": 0.6,
  };
  const layout = (size: ExpressionSpecification, extra: Record<string, unknown> = {}) => ({
    "text-field": localName,
    "text-font": [LABEL_FONT_ITALIC],
    "text-size": size,
    "text-max-width": 7,
    "text-padding": 6,
    ...extra,
  });
  return [
    {
      id: "water-labels-ocean",
      type: "symbol",
      source: "water-labels",
      filter: ["==", ["get", "k"], "ocean"],
      layout: layout(["interpolate", ["linear"], ["zoom"], 1, 12, 4, 18], {
        "text-field": localUpper,
        "text-letter-spacing": 0.32,
        "text-max-width": 12,
      }),
      paint,
    },
    {
      id: "water-labels-sea",
      type: "symbol",
      source: "water-labels",
      minzoom: 1.8,
      filter: ["all", ["==", ["get", "k"], "sea"], ["<=", ["get", "z"], 2]],
      layout: layout(["interpolate", ["linear"], ["zoom"], 2, 10.5, 6, 15]),
      paint,
    },
    {
      id: "water-labels-minor",
      type: "symbol",
      source: "water-labels",
      minzoom: 3.2,
      filter: ["any", ["==", ["get", "k"], "lake"], [">", ["get", "z"], 2]],
      layout: layout(["interpolate", ["linear"], ["zoom"], 3, 10, 7, 13]),
      paint,
    },
  ] as LayerSpecification[];
}

/** Diagonal stripes for disputed areas, drawn once at 2× for sharpness. */
function hatchImage(): ImageData {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new ImageData(size, size);
  ctx.strokeStyle = "rgba(255, 236, 200, 0.55)";
  ctx.lineWidth = 2;
  for (const offset of [-size, 0, size]) {
    ctx.beginPath();
    ctx.moveTo(offset, size);
    ctx.lineTo(offset + size, 0);
    ctx.stroke();
  }
  return ctx.getImageData(0, 0, size, size);
}

function setSlotOpacity(map: MapLibreMap, slot: Slot, value: number) {
  map.setPaintProperty(fillLayer(slot), "fill-opacity", value * FILL_OPACITY);
  map.setPaintProperty(`pol-${slot}-line`, "line-opacity", value);
  map.setPaintProperty(labSource(slot), "text-opacity", value);
}

/**
 * Zoom level that fits a polity of the given area (km²) with room around it. Capped at 5:
 * borders are simplified for a world-scale map and the imagery stops at zoom 8.
 */
function zoomForArea(area: number): number {
  const width = Math.sqrt(Math.max(area, 1));
  return Math.min(5, Math.max(1.5, Math.log2(9_000 / width)));
}

/** Very short screens (phones held sideways) use the compact layout from index.css. */
const isShort = () => window.innerHeight <= 520;

/** Centres the globe in the space between the top bar and the timeline. */
function basePadding(): PaddingOptions {
  if (isShort()) return { top: 52, bottom: 110, left: 0, right: 0 };
  return { top: 64, bottom: window.innerWidth >= 640 ? 200 : 210, left: 0, right: 0 };
}

/**
 * The visible map while the info panel is open, which sits on the right on desktops and short
 * screens and at the bottom on taller phones and tablets: a flown-to place lands in its middle.
 */
function panelPadding(): PaddingOptions {
  const base = basePadding();
  if (window.innerWidth >= 1024) return { ...base, right: 420 };
  if (isShort()) return { ...base, right: Math.round(Math.min(340, window.innerWidth * 0.5)) + 16 };
  return { ...base, bottom: (base.bottom ?? 0) + Math.round(window.innerHeight * 0.4) };
}

const samePadding = (a: PaddingOptions, b: PaddingOptions) =>
  a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right;

export type Selection = { kind: "polity" | "dispute"; id: string };
export type FocusRequest = { id: string; key: number };

type Props = {
  data: WindowData | null;
  disputes: Disputes | null;
  waterLabels: FeatureCollection<Point, WaterLabelProps> | null;
  /** The year on screen (for names). */
  year: number;
  /** The last year up to `year` in which the map changed (for filtering). */
  mapYear: number;
  lang: Lang;
  selected: Selection | null;
  focus: FocusRequest | null;
  onSelect: (selection: Selection | null) => void;
  /** A window's borders are on screen (they load after its labels arrive in `data`). */
  onWindowShown: (id: string) => void;
  onError: (kind: "webgl" | "window") => void;
};

export function GlobeMap(props: Props) {
  const { data, disputes, waterLabels, year, mapYear, lang, selected, focus } = props;
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const active = useRef<Slot>("b");
  /** Years covered by the window on screen. */
  const shown = useRef<{ from: number; to: number } | null>(null);
  const hovered = useRef<Selection | null>(null);
  const swapToken = useRef(0);
  const doneFocus = useRef<number | null>(null);
  const outlined = useRef<{ source: string; id: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null);

  // Map listeners are registered once; effect events let them see the latest props.
  const select = useEffectEvent((selection: Selection | null) => props.onSelect(selection));
  const fail = useEffectEvent((kind: "webgl" | "window") => props.onError(kind));
  const windowShown = useEffectEvent((id: string) => props.onWindowShown(id));
  const currentSelection = useEffectEvent(() => selected);
  const currentMapYear = useEffectEvent(() => mapYear);
  const initialView = useEffectEvent(() => ({ mapYear, lang }));
  /** The name to show for a hovered shape, in the UI language and for the current year. */
  const nameOf = useEffectEvent((hit: Selection): string | null => {
    if (hit.kind === "dispute") {
      const d = disputes?.features.find((f) => f.properties.id === hit.id)?.properties;
      return d ? (lang === "tr" ? d.tr : d.en) : null;
    }
    const label = data?.labels.features.find(
      (f) => f.properties.id === hit.id && f.properties.f <= year && year <= f.properties.t,
    )?.properties;
    return label ? (lang === "tr" ? label.tr : label.en) : null;
  });

  // Create the map once.
  useEffect(() => {
    let map: MapLibreMap | null = null;
    let cancelled = false;

    Promise.all([loadMapFonts(), registerTopoJsonProtocol()]).then(() => {
      if (cancelled || !container.current) return;
      const { mapYear: y, lang: l } = initialView();
      try {
        map = new MapLibreMap({
          container: container.current,
          style: buildStyle(y, l),
          center: [35, 32],
          zoom: window.innerWidth < 640 ? 1 : 1.75,
          minZoom: 0.3,
          maxZoom: 8,
          hash: true,
          keyboard: false, // arrow keys drive the timeline instead
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          attributionControl: false, // re-added bottom-left, away from the info panel
        });
      } catch (error) {
        if (error instanceof GPUInitializationError) fail("webgl");
        else throw error;
        return;
      }
      mapRef.current = map;
      const m = map;
      if (import.meta.env.DEV) Object.assign(window, { __map: m }); // handy in the devtools console
      m.addControl(new AttributionControl({ compact: true }), "bottom-left");
      m.setMissingStyleImageResolver((id) => {
        if (id === "hatch") m.addImage("hatch", hatchImage(), { pixelRatio: 2 });
      });
      m.setPadding(basePadding());
      m.on("resize", () => m.setPadding(currentSelection() ? panelPadding() : basePadding()));

      const setHover = (hit: Selection | null) => {
        const previous = hovered.current;
        if (previous?.id === hit?.id && previous?.kind === hit?.kind) return;
        const sourceOf = (s: Selection) => (s.kind === "dispute" ? "disputes" : polSource(active.current));
        if (previous) m.setFeatureState({ source: sourceOf(previous), id: previous.id }, { hover: false });
        if (hit) m.setFeatureState({ source: sourceOf(hit), id: hit.id }, { hover: true });
        hovered.current = hit;
        m.getCanvas().style.cursor = hit ? "pointer" : "";
      };

      // Disputed areas sit on top of the countries, so they win when both are under the cursor.
      const hitAt = (point: { x: number; y: number }): Selection | null => {
        // Until a window's layers are added, querying them throws; skip the ones not there yet.
        const layers = [DISPUTE_FILL, fillLayer(active.current)].filter((id) => m.getLayer(id));
        if (layers.length === 0) return null;
        const [feature] = m.queryRenderedFeatures([point.x, point.y], { layers });
        const id = feature?.properties?.id as string | undefined;
        if (!feature || !id) return null;
        return { kind: feature.layer.id === DISPUTE_FILL ? "dispute" : "polity", id };
      };

      m.on("load", () => {
        // Start with the attribution folded into its "i" button; it opens on click.
        const attribution = m.getContainer().querySelector(".maplibregl-ctrl-attrib");
        attribution?.classList.remove("maplibregl-compact-show");
        attribution?.removeAttribute("open");
        // Oceans and lakes never change: decoded once, in the map's worker.
        m.getSource<GeoJSONSource>("ocean")?.setData(topojsonUrl("water.json", "ocean"));
        m.getSource<GeoJSONSource>("lakes")?.setData(topojsonUrl("water.json", "lakes"));
        setReady(true);
      });
      // Hover only exists with a mouse: on touch screens a tap would leave the highlight behind.
      if (canHover) {
        m.on("mousemove", (e) => {
          const hit = hitAt(e.point);
          setHover(hit);
          const name = hit && nameOf(hit);
          setTooltip(name ? { name, x: e.point.x, y: e.point.y } : null);
        });
        m.on("mouseout", () => {
          setHover(null);
          setTooltip(null);
        });
        m.on("movestart", () => setTooltip(null));
      }
      m.on("click", (e) => select(hitAt(e.point)));
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      active.current = "b";
      setReady(false);
    };
  }, []);

  // Year and language are global style state: changing them re-filters and relabels instantly.
  // A year outside the window on screen waits for its window, so the map never shows a
  // half-empty period while the next one loads.
  useEffect(() => {
    const window = shown.current;
    if (!ready || (window && (mapYear < window.from || mapYear > window.to))) return;
    mapRef.current?.setGlobalStateProperty("year", mapYear);
  }, [mapYear, ready]);
  useEffect(() => {
    if (ready) mapRef.current?.setGlobalStateProperty("lang", lang);
  }, [lang, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !disputes) return;
    map.getSource<GeoJSONSource>("disputes")?.setData(disputes);
    const points: FeatureCollection<Point> = {
      type: "FeatureCollection",
      features: disputes.features.map((f) => ({
        type: "Feature",
        properties: f.properties,
        geometry: { type: "Point", coordinates: [f.properties.lx, f.properties.ly] },
      })),
    };
    map.getSource<GeoJSONSource>("dispute-labels")?.setData(points);
  }, [disputes, ready]);

  useEffect(() => {
    if (ready && waterLabels) mapRef.current?.getSource<GeoJSONSource>("water-labels")?.setData(waterLabels);
  }, [waterLabels, ready]);

  // Cross-fade to a new time window. Its borders are fetched and decoded in the map's worker.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !data) return;
    const token = ++swapToken.current;
    const next = other(active.current);

    map.removeFeatureState({ source: polSource(next) });
    Promise.all([
      map.getSource<GeoJSONSource>(polSource(next))?.setData(data.bordersUrl),
      map.getSource<GeoJSONSource>(labSource(next))?.setData(data.labels),
    ])
      .then(() => {
        if (token !== swapToken.current || mapRef.current !== map) return; // a newer window won
        const previous = active.current;
        active.current = next;
        shown.current = data.window;
        hovered.current = null;
        map.setGlobalStateProperty("year", currentMapYear());
        setSlotOpacity(map, next, 1);
        setSlotOpacity(map, previous, 0);
        map.removeFeatureState({ source: polSource(previous) });
        const sel = currentSelection();
        if (sel?.kind === "polity") {
          outlined.current = { source: polSource(next), id: sel.id };
          map.setFeatureState(outlined.current, { selected: true });
        }

        windowShown(data.window.id);

        // Free the hidden stack once it has faded out, so it costs nothing to render.
        setTimeout(() => {
          if (token !== swapToken.current) return;
          map.getSource<GeoJSONSource>(polSource(previous))?.setData(EMPTY);
          map.getSource<GeoJSONSource>(labSource(previous))?.setData(EMPTY);
        }, FADE_MS + 100);
      })
      .catch((error) => {
        // Superseded loads end up here too; only the latest one's failure matters.
        if (token !== swapToken.current || mapRef.current !== map) return;
        console.warn("Could not load map window:", error);
        fail("window");
      });
  }, [data, ready]);

  // Outline the selection; when it is cleared, give the map its full width back.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const previous = outlined.current;
    if (previous && map.getSource(previous.source)) map.setFeatureState(previous, { selected: false });
    outlined.current = null;
    if (!selected) {
      const base = basePadding();
      if (!samePadding(map.getPadding(), base))
        map.easeTo({ padding: base, duration: reducedMotion ? 0 : 700 });
      return;
    }
    const target = {
      source: selected.kind === "dispute" ? "disputes" : polSource(active.current),
      id: selected.id,
    };
    map.setFeatureState(target, { selected: true });
    outlined.current = target;
  }, [selected, ready]);

  // Fly to a polity once the window that contains it is on screen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !data || !focus || doneFocus.current === focus.key) return;
    const label = data.labels.features.find(
      (f) => f.properties.id === focus.id && f.properties.f <= year && year <= f.properties.t,
    );
    if (!label) return;
    doneFocus.current = focus.key;
    const [lng, lat] = label.geometry.coordinates as [number, number];
    map.flyTo({
      center: [lng, lat],
      zoom: zoomForArea(label.properties.a),
      padding: panelPadding(),
      duration: reducedMotion ? 0 : 1800,
      essential: true,
    });
  }, [focus, data, year, ready]);

  return (
    <div className="absolute inset-0">
      {/* MapLibre forces `position: relative` on its container, so size it explicitly. */}
      <div ref={container} className="h-full w-full" />
      {tooltip && (
        <div
          className="pointer-events-none absolute top-0 left-0 z-10 rounded-full border border-white/10 bg-panel px-3 py-1 font-medium text-ink text-xs shadow-lg backdrop-blur-md"
          style={{ transform: `translate(${tooltip.x + 14}px, ${tooltip.y + 14}px)` }}
        >
          {tooltip.name}
        </div>
      )}
    </div>
  );
}
