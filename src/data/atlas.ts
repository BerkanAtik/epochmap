import type { FeatureCollection, MultiPolygon, Point, Polygon } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { paletteColor } from "../lib/colors";

/** A span of years whose shapes are stored in one file. */
export type Window = { id: string; from: number; to: number };

export type AtlasIndex = {
  start: number;
  end: number;
  eras: { cshapes: number; modern: number };
  windows: Window[];
  /** Years in which any border changes, ascending. */
  changes: number[];
};

export type BorderProps = {
  /** Polity identity (a Wikidata id when known). */
  id: string;
  /** Empire or sovereign it belongs to. */
  g?: string;
  /** First and last year (inclusive) of this shape. */
  f: number;
  t: number;
  /** Area in km². */
  a: number;
  /** Palette index chosen by the data build. */
  c: number;
  /** Added on load. */
  color: string;
};

export type LabelProps = {
  id: string;
  f: number;
  t: number;
  a: number;
  en: string;
  tr: string;
  /** Upper-case names, added on load. */
  enu?: string;
  tru?: string;
};

export type DisputeProps = {
  id: string;
  f: number;
  t: number;
  en: string;
  tr: string;
  note_en: string;
  note_tr: string;
  lx: number;
  ly: number;
};

export type Polity = {
  id: string;
  /** Names in order of first use. */
  en: string[];
  tr: string[];
  spans: [number, number][];
  wiki: { en?: string; tr?: string };
};

export type PolityIndex = {
  polities: Polity[];
  groups: Record<string, { en: string; tr: string }>;
};

export type Borders = FeatureCollection<Polygon | MultiPolygon, BorderProps>;
export type Labels = FeatureCollection<Point, LabelProps>;
export type Disputes = FeatureCollection<Polygon | MultiPolygon, DisputeProps>;
export type WindowData = { window: Window; borders: Borders; labels: Labels };

/** Absolute URL for a file in public/data, honouring Vite's relative `base`. */
export function dataUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}data/${path}`, document.baseURI).href;
}

function fetchJson<T>(path: string): Promise<T> {
  return fetch(dataUrl(path)).then((res) => {
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return res.json() as Promise<T>;
  });
}

const cache = new Map<string, Promise<unknown>>();

/** Fetches a small JSON file once; failed requests are dropped from the cache so they can be retried. */
function getJson<T>(path: string): Promise<T> {
  let request = cache.get(path) as Promise<T> | undefined;
  if (!request) {
    request = fetchJson<T>(path);
    request.catch(() => cache.delete(path));
    cache.set(path, request);
  }
  return request;
}

export const loadIndex = () => getJson<AtlasIndex>("index.json");
export const loadPolities = () => getJson<PolityIndex>("polities.json");
export const loadDisputes = () => getJson<Disputes>("disputes.json");

/** Adds upper-case names for the small-caps labels, with each language's rules ("i" → "İ" in Turkish). */
function withCapitals<P extends { en: string; tr: string; enu?: string; tru?: string }>(
  labels: FeatureCollection<Point, P>,
): FeatureCollection<Point, P> {
  for (const l of labels.features) {
    l.properties.enu = l.properties.en.toLocaleUpperCase("en");
    l.properties.tru = l.properties.tr.toLocaleUpperCase("tr");
  }
  return labels;
}

/**
 * Decoded windows are large (tens of MB in memory for all of them), so only the most recently
 * used few are kept; the browser's HTTP cache makes going back to an evicted one cheap.
 */
const MAX_WINDOWS = 4;
const windows = new Map<string, Promise<WindowData>>();

/** Loads one time window: borders (TopoJSON, decoded here) and label points. */
export function loadWindow(window: Window): Promise<WindowData> {
  const cached = windows.get(window.id);
  if (cached) {
    // Map keeps insertion order: re-inserting marks the window as most recently used.
    windows.delete(window.id);
    windows.set(window.id, cached);
    return cached;
  }
  const request = Promise.all([
    fetchJson<Topology>(`borders/${window.id}.json`),
    fetchJson<Labels>(`labels/${window.id}.json`),
  ]).then(([topology, labels]) => {
    const [object] = Object.values(topology.objects) as GeometryCollection<BorderProps>[];
    const borders = (
      object ? feature(topology, object) : { type: "FeatureCollection", features: [] }
    ) as Borders;
    for (const f of borders.features) f.properties.color = paletteColor(f.properties.c);
    return { window, borders, labels: withCapitals(labels) };
  });
  request.catch(() => windows.delete(window.id));
  windows.set(window.id, request);
  for (const id of windows.keys()) {
    if (windows.size <= MAX_WINDOWS) break;
    windows.delete(id);
  }
  return request;
}

export type WaterLabelProps = {
  en: string;
  tr: string;
  /** Kind of water body. */
  k: "ocean" | "sea" | "lake";
  /** Zoom from which the name is shown. */
  z: number;
  enu?: string;
  tru?: string;
};

export type Water = {
  ocean: FeatureCollection<Polygon | MultiPolygon>;
  lakes: FeatureCollection<Polygon | MultiPolygon>;
  labels: FeatureCollection<Point, WaterLabelProps>;
};

/** Oceans, lakes and their names, drawn over the satellite imagery. */
export async function loadWater(): Promise<Water> {
  const [topology, labels] = await Promise.all([
    getJson<Topology>("water.json"),
    getJson<FeatureCollection<Point, WaterLabelProps>>("water-labels.json"),
  ]);
  const objects = topology.objects as Record<string, GeometryCollection>;
  const collection = (name: string) => {
    const object = objects[name];
    return (
      object ? feature(topology, object) : { type: "FeatureCollection", features: [] }
    ) as FeatureCollection<Polygon | MultiPolygon>;
  };
  return { ocean: collection("ocean"), lakes: collection("lakes"), labels: withCapitals(labels) };
}

export function windowFor(index: AtlasIndex, year: number): Window | undefined {
  return index.windows.find((w) => w.from <= year && year <= w.to);
}

/** Warms the cache for the windows around a year so scrubbing and playback feel instant. */
export function prefetchAround(index: AtlasIndex, window: Window): void {
  const i = index.windows.indexOf(window);
  for (const w of [index.windows[i + 1], index.windows[i - 1]]) if (w) void loadWindow(w).catch(() => {});
}
