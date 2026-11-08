import type { FeatureCollection } from "geojson";
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
import { dataUrl, type SnapshotData } from "../data/atlas";
import { LABEL_FONT, loadMapFonts } from "../lib/fonts";
import { graticule } from "../lib/graticule";

setWorkerUrl(workerUrl);

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FADE_MS = reducedMotion ? 0 : 650;

/** Polities at least this large (km²) get spaced small-caps labels, like on a printed atlas. */
const LARGE_AREA = 1_500_000;

const COLORS = {
  ocean: "#0a1526",
  land: "#1a2232",
  coast: "rgba(214, 226, 255, 0.12)",
  grid: "rgba(214, 226, 255, 0.07)",
  border: "rgba(250, 240, 220, 0.5)",
  label: "#f4ecdb",
  halo: "rgba(6, 10, 19, 0.9)",
  selected: "#ffe2a0",
};

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * Two identical layer stacks ("a" and "b"). The next snapshot is loaded into the hidden
 * one and then the two cross-fade, so borders morph instead of blinking.
 */
type Slot = "a" | "b";
const other = (slot: Slot): Slot => (slot === "a" ? "b" : "a");
const polSource = (slot: Slot) => `pol-${slot}`;
const labSource = (slot: Slot) => `lab-${slot}`;
const fillLayer = (slot: Slot) => `pol-${slot}-fill`;

function slotLayers(slot: Slot): { fills: LayerSpecification[]; overlays: LayerSpecification[] } {
  const pol = polSource(slot);
  return {
    fills: [
      {
        id: fillLayer(slot),
        type: "fill",
        source: pol,
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0 },
      },
      {
        id: `pol-${slot}-hover`,
        type: "fill",
        source: pol,
        paint: {
          "fill-color": "#ffffff",
          "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.13, 0],
        },
      },
    ],
    overlays: [
      {
        id: `pol-${slot}-line`,
        type: "line",
        source: pol,
        paint: {
          "line-color": COLORS.border,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.35, 6, 1.1],
          "line-opacity": 0,
        },
      },
      {
        id: `pol-${slot}-selected`,
        type: "line",
        source: pol,
        layout: { "line-join": "round" },
        paint: {
          "line-color": COLORS.selected,
          "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.2, 0],
        },
      },
    ],
  };
}

function labelLayer(slot: Slot): LayerSpecification {
  const large: ExpressionSpecification = [">=", ["get", "area"], LARGE_AREA];
  // Text size grows with the square root of the area (a proxy for the polity's width) and with zoom.
  const sizeAt = (min: number, max: number): ExpressionSpecification => [
    "interpolate",
    ["linear"],
    ["sqrt", ["get", "area"]],
    0,
    min,
    3000,
    max,
  ];
  return {
    id: labSource(slot),
    type: "symbol",
    source: labSource(slot),
    layout: {
      "text-field": ["case", large, ["upcase", ["get", "name"]], ["get", "name"]],
      "text-font": [LABEL_FONT],
      "text-size": ["interpolate", ["linear"], ["zoom"], 1, sizeAt(9, 15), 5, sizeAt(12, 26)],
      "text-letter-spacing": ["case", large, 0.14, 0.02],
      "text-max-width": 9,
      "text-padding": 3,
      "symbol-sort-key": ["-", 0, ["get", "area"]],
    },
    paint: {
      "text-color": COLORS.label,
      "text-halo-color": COLORS.halo,
      "text-halo-width": 1.3,
      "text-halo-blur": 0.4,
      "text-opacity": 0,
    },
  };
}

function buildStyle(): StyleSpecification {
  const borders =
    "Borders: <a href='https://github.com/aourednik/historical-basemaps'>historical-basemaps</a> (GPL-3.0)";
  const a = slotLayers("a");
  const b = slotLayers("b");
  return {
    version: 8,
    projection: { type: "globe" },
    // No `glyphs` URL: labels are drawn with the page's own fonts (see lib/fonts.ts).
    sky: {
      "sky-color": "#0b1a33",
      "horizon-color": "#36639a",
      "fog-color": "#0b1a33",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.9,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 4, 1, 7, 0],
    },
    transition: { duration: FADE_MS, delay: 0 },
    sources: {
      land: {
        type: "geojson",
        data: dataUrl("land.json"),
        attribution: "<a href='https://www.naturalearthdata.com/'>Natural Earth</a>",
      },
      grid: { type: "geojson", data: graticule() },
      "pol-a": { type: "geojson", data: EMPTY, promoteId: "name", attribution: borders },
      "pol-b": { type: "geojson", data: EMPTY, promoteId: "name", attribution: borders },
      "lab-a": { type: "geojson", data: EMPTY },
      "lab-b": { type: "geojson", data: EMPTY },
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": COLORS.ocean } },
      { id: "grid", type: "line", source: "grid", paint: { "line-color": COLORS.grid, "line-width": 0.7 } },
      { id: "land", type: "fill", source: "land", paint: { "fill-color": COLORS.land } },
      { id: "coast", type: "line", source: "land", paint: { "line-color": COLORS.coast, "line-width": 0.6 } },
      ...a.fills,
      ...b.fills,
      ...a.overlays,
      ...b.overlays,
      labelLayer("a"),
      labelLayer("b"),
    ],
  };
}

function setSlotOpacity(map: MapLibreMap, slot: Slot, value: number) {
  map.setPaintProperty(fillLayer(slot), "fill-opacity", value);
  map.setPaintProperty(`pol-${slot}-line`, "line-opacity", value);
  map.setPaintProperty(labSource(slot), "text-opacity", value);
}

/**
 * Zoom level that fits a polity of the given area (km²) with room around it. Capped at 4.5:
 * borders are simplified for a world-scale map and look blocky beyond that.
 */
function zoomForArea(area: number): number {
  const width = Math.sqrt(Math.max(area, 1));
  return Math.min(4.5, Math.max(1.5, Math.log2(9_000 / width)));
}

/** Centres the globe in the space between the top bar and the timeline. */
function basePadding(): PaddingOptions {
  return { top: 64, bottom: window.innerWidth >= 640 ? 190 : 200, left: 0, right: 0 };
}

/**
 * Where a flown-to polity should land relative to the centre, clear of the info panel
 * (right side on desktop, upper half on mobile). An offset, unlike padding, isn't persisted.
 */
function focusOffset(): [number, number] {
  return window.innerWidth >= 1024 ? [-200, 0] : [0, Math.round(window.innerHeight * 0.16)];
}

export type FocusRequest = { name: string; key: number };

type Props = {
  data: SnapshotData | null;
  selected: string | null;
  focus: FocusRequest | null;
  onSelect: (name: string | null) => void;
  onError: (kind: "webgl") => void;
};

export function GlobeMap({ data, selected, focus, onSelect, onError }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const active = useRef<Slot>("b");
  const hovered = useRef<string | null>(null);
  const swapToken = useRef(0);
  const doneFocus = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [tooltip, setTooltip] = useState<{ name: string; x: number; y: number } | null>(null);

  // Map listeners are registered once; effect events let them see the latest props.
  const select = useEffectEvent((name: string | null) => onSelect(name));
  const fail = useEffectEvent((kind: "webgl") => onError(kind));
  const currentSelection = useEffectEvent(() => selected);

  // Create the map once.
  useEffect(() => {
    let map: MapLibreMap | null = null;
    let cancelled = false;

    loadMapFonts().then(() => {
      if (cancelled || !container.current) return;
      try {
        map = new MapLibreMap({
          container: container.current,
          style: buildStyle(),
          center: [35, 32],
          zoom: window.innerWidth < 640 ? 1 : 1.75,
          minZoom: 0.3,
          maxZoom: 7,
          hash: true,
          keyboard: false, // arrow keys drive the timeline instead
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          attributionControl: false, // re-added bottom-left, away from the info panel
        });
        map.addControl(new AttributionControl({ compact: true }), "bottom-left");
      } catch (error) {
        if (error instanceof GPUInitializationError) fail("webgl");
        else throw error;
        return;
      }
      mapRef.current = map;
      const m = map;
      if (import.meta.env.DEV) Object.assign(window, { __map: m }); // handy in the devtools console
      m.setPadding(basePadding());
      m.on("resize", () => m.setPadding(basePadding()));

      const setHover = (name: string | null) => {
        if (hovered.current === name) return;
        const source = polSource(active.current);
        if (hovered.current) m.setFeatureState({ source, id: hovered.current }, { hover: false });
        if (name) m.setFeatureState({ source, id: name }, { hover: true });
        hovered.current = name;
        m.getCanvas().style.cursor = name ? "pointer" : "";
      };

      const nameAt = (point: { x: number; y: number }) => {
        const [feature] = m.queryRenderedFeatures([point.x, point.y], {
          layers: [fillLayer(active.current)],
        });
        return (feature?.properties?.name as string | undefined) ?? null;
      };

      m.on("load", () => setReady(true));
      m.on("mousemove", (e) => {
        const name = nameAt(e.point);
        setHover(name);
        setTooltip(name ? { name, x: e.point.x, y: e.point.y } : null);
      });
      m.on("mouseout", () => {
        setHover(null);
        setTooltip(null);
      });
      m.on("movestart", () => setTooltip(null));
      m.on("click", (e) => select(nameAt(e.point)));
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
      active.current = "b";
      setReady(false);
    };
  }, []);

  // Cross-fade to a new snapshot.
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
      if (token !== swapToken.current || mapRef.current !== map) return; // a newer snapshot won
      const previous = active.current;
      active.current = next;
      hovered.current = null;
      setSlotOpacity(map, next, 1);
      setSlotOpacity(map, previous, 0);
      map.removeFeatureState({ source: polSource(previous) });
      const name = currentSelection();
      if (name) map.setFeatureState({ source: polSource(next), id: name }, { selected: true });

      // Free the hidden stack once it has faded out, so it costs nothing to render.
      setTimeout(() => {
        if (token !== swapToken.current) return;
        map.getSource<GeoJSONSource>(polSource(previous))?.setData(EMPTY);
        map.getSource<GeoJSONSource>(labSource(previous))?.setData(EMPTY);
      }, FADE_MS + 100);
    });
  }, [data, ready]);

  // Outline the selected polity.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const source = polSource(active.current);
    map.removeFeatureState({ source });
    if (hovered.current) map.setFeatureState({ source, id: hovered.current }, { hover: true });
    if (selected) map.setFeatureState({ source, id: selected }, { selected: true });
  }, [selected, ready]);

  // Fly to a polity once the snapshot that contains it is on screen.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !data || !focus || doneFocus.current === focus.key) return;
    const label = data.labels.features.find((f) => f.properties.name === focus.name);
    if (!label) return;
    doneFocus.current = focus.key;
    const [lng, lat] = label.geometry.coordinates as [number, number];
    map.flyTo({
      center: [lng, lat],
      zoom: zoomForArea(label.properties.area),
      offset: focusOffset(),
      duration: reducedMotion ? 0 : 1800,
      essential: true,
    });
  }, [focus, data, ready]);

  return (
    <div className="absolute inset-0">
      {/* MapLibre forces `position: relative` on its container, so size it explicitly. */}
      <div ref={container} className="h-full w-full" />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-full border border-white/10 bg-panel px-3 py-1 font-medium text-ink text-xs shadow-lg backdrop-blur-md"
          style={{ transform: `translate(${tooltip.x + 14}px, ${tooltip.y + 14}px)`, left: 0, top: 0 }}
        >
          {tooltip.name}
        </div>
      )}
    </div>
  );
}
