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
import type { Disputes, WindowData } from "../data/atlas";
import { LABEL_FONT, LABEL_FONT_ITALIC, loadMapFonts } from "../lib/fonts";
import { graticule } from "../lib/graticule";
import type { Lang } from "../lib/i18n";

setWorkerUrl(workerUrl);

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FADE_MS = reducedMotion ? 0 : 500;

/** NASA's Blue Marble: Next Generation, a cloud-free true-colour mosaic (public domain). */
const IMAGERY =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";

/** Polities at least this large (km²) get spaced small-caps labels, like on a printed atlas. */
const LARGE_AREA = 1_500_000;
const FILL_OPACITY = 0.46;

const COLORS = {
  ocean: "#06101f",
  grid: "rgba(214, 226, 255, 0.07)",
  border: "rgba(255, 249, 235, 0.78)",
  label: "#fbf4e4",
  halo: "rgba(5, 9, 18, 0.88)",
  selected: "#ffe2a0",
  dispute: "rgba(255, 236, 200, 0.95)",
};

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

// Shapes carry their own year range; the map shows those that include the selected year.
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
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0, "fill-antialias": true },
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
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": COLORS.ocean } },
      {
        id: "imagery",
        type: "raster",
        source: "imagery",
        paint: {
          "raster-saturation": -0.2,
          "raster-contrast": 0.08,
          "raster-brightness-max": 0.82,
          "raster-fade-duration": 200,
        },
      },
      { id: "grid", type: "line", source: "grid", paint: { "line-color": COLORS.grid, "line-width": 0.7 } },
      ...a.fills,
      ...b.fills,
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

/** Centres the globe in the space between the top bar and the timeline. */
function basePadding(): PaddingOptions {
  return { top: 64, bottom: window.innerWidth >= 640 ? 200 : 210, left: 0, right: 0 };
}

/** Where a flown-to place lands relative to the centre, clear of the info panel (side on desktop, bottom sheet on smaller screens). */
function focusOffset(): [number, number] {
  return window.innerWidth >= 1024 ? [-200, 0] : [0, -Math.round(window.innerHeight * 0.2)];
}

export type Selection = { kind: "polity" | "dispute"; id: string };
export type FocusRequest = { id: string; key: number };

type Props = {
  data: WindowData | null;
  disputes: Disputes | null;
  year: number;
  lang: Lang;
  selected: Selection | null;
  focus: FocusRequest | null;
  onSelect: (selection: Selection | null) => void;
  onError: (kind: "webgl") => void;
};

export function GlobeMap({ data, disputes, year, lang, selected, focus, onSelect, onError }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const active = useRef<Slot>("b");
  const hovered = useRef<Selection | null>(null);
  const swapToken = useRef(0);
  const doneFocus = useRef<number | null>(null);
  const outlined = useRef<{ source: string; id: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null);

  // Map listeners are registered once; effect events let them see the latest props.
  const select = useEffectEvent((selection: Selection | null) => onSelect(selection));
  const fail = useEffectEvent((kind: "webgl") => onError(kind));
  const currentSelection = useEffectEvent(() => selected);
  const initialView = useEffectEvent(() => ({ year, lang }));
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

    loadMapFonts().then(() => {
      if (cancelled || !container.current) return;
      const { year: y, lang: l } = initialView();
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
      m.on("resize", () => m.setPadding(basePadding()));

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
        const [feature] = m.queryRenderedFeatures([point.x, point.y], {
          layers: [DISPUTE_FILL, fillLayer(active.current)],
        });
        const id = feature?.properties?.id as string | undefined;
        if (!feature || !id) return null;
        return { kind: feature.layer.id === DISPUTE_FILL ? "dispute" : "polity", id };
      };

      m.on("load", () => {
        // Start with the attribution folded into its "i" button; it opens on click.
        const attribution = m.getContainer().querySelector(".maplibregl-ctrl-attrib");
        attribution?.classList.remove("maplibregl-compact-show");
        attribution?.removeAttribute("open");
        setReady(true);
      });
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
  useEffect(() => {
    if (ready) mapRef.current?.setGlobalStateProperty("year", year);
  }, [year, ready]);
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

  // Cross-fade to a new time window.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !data) return;
    const token = ++swapToken.current;
    const next = other(active.current);

    map.removeFeatureState({ source: polSource(next) });
    Promise.all([
      map.getSource<GeoJSONSource>(polSource(next))?.setData(data.borders),
      map.getSource<GeoJSONSource>(labSource(next))?.setData(data.labels),
    ]).then(() => {
      if (token !== swapToken.current || mapRef.current !== map) return; // a newer window won
      const previous = active.current;
      active.current = next;
      hovered.current = null;
      setSlotOpacity(map, next, 1);
      setSlotOpacity(map, previous, 0);
      map.removeFeatureState({ source: polSource(previous) });
      const sel = currentSelection();
      if (sel?.kind === "polity") {
        outlined.current = { source: polSource(next), id: sel.id };
        map.setFeatureState(outlined.current, { selected: true });
      }

      // Free the hidden stack once it has faded out, so it costs nothing to render.
      setTimeout(() => {
        if (token !== swapToken.current) return;
        map.getSource<GeoJSONSource>(polSource(previous))?.setData(EMPTY);
        map.getSource<GeoJSONSource>(labSource(previous))?.setData(EMPTY);
      }, FADE_MS + 100);
    });
  }, [data, ready]);

  // Outline the selection.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const previous = outlined.current;
    if (previous && map.getSource(previous.source)) map.setFeatureState(previous, { selected: false });
    outlined.current = null;
    if (!selected) return;
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
      offset: focusOffset(),
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
