import type { FeatureCollection, MultiPolygon, Point, Polygon } from "geojson";
import { topojsonUrl as protocolUrl } from "../lib/topojson-protocol.mjs";

/** A span of years whose shapes are stored in one file. */
export type Window = { id: string; from: number; to: number };

export type AtlasIndex = {
  start: number;
  end: number;
  eras: { cshapes: number; modern: number };
  windows: Window[];
  /** Years in which anything on the map changes, ascending. */
  changes: number[];
};

export type LabelProps = {
  /** Polity identity (a Wikidata id when known). */
  id: string;
  /** Empire or sovereign it belongs to. */
  g?: string;
  /** First and last year (inclusive) of this shape. */
  f: number;
  t: number;
  /** Area in km². */
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

export type Labels = FeatureCollection<Point, LabelProps>;
export type Disputes = FeatureCollection<Polygon | MultiPolygon, DisputeProps>;

/**
 * One time window. Border shapes are large, so the page never holds them: the map's worker
 * fetches and decodes them from `bordersUrl` (see lib/topojson-protocol.mjs).
 */
export type WindowData = { window: Window; bordersUrl: string; labels: Labels };

/**
 * Absolute URL for a file in public/data, honouring Vite's relative `base`. The data version
 * changes with every data build, so browsers never mix files from two different builds.
 */
export function dataUrl(path: string): string {
  return `${new URL(`${import.meta.env.BASE_URL}data/${path}`, document.baseURI).href}?v=${__DATA_VERSION__}`;
}

/** A URL the map loads through its TopoJSON protocol, optionally picking one named object. */
export function topojsonUrl(path: string, object?: string): string {
  return protocolUrl(dataUrl(path), object);
}

/** Fetches JSON, retrying a couple of times so a flaky connection doesn't break the page. */
async function fetchJson<T>(path: string, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(dataUrl(path));
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }
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

/** Recently used windows' labels (small) stay in memory; Map order tracks recency. */
const MAX_WINDOWS = 6;
const windows = new Map<string, Promise<WindowData>>();

/** Loads one time window's labels; its borders are loaded by the map itself. */
export function loadWindow(window: Window): Promise<WindowData> {
  const cached = windows.get(window.id);
  if (cached) {
    windows.delete(window.id);
    windows.set(window.id, cached);
    return cached;
  }
  const request = fetchJson<Labels>(`labels/${window.id}.json`).then((labels) => ({
    window,
    bordersUrl: topojsonUrl(`borders/${window.id}.json`),
    labels: withCapitals(labels),
  }));
  request.catch(() => windows.delete(window.id));
  windows.set(window.id, request);
  for (const id of windows.keys()) {
    if (windows.size <= MAX_WINDOWS) break;
    windows.delete(id);
  }
  return request;
}

export function windowFor(index: AtlasIndex, year: number): Window | undefined {
  return index.windows.find((w) => w.from <= year && year <= w.to);
}

/**
 * Warms up the windows next to the current one: their labels, and their border files in the
 * browser's HTTP cache (at low priority), so stepping and playback across a boundary are quick.
 */
export function prefetchAround(index: AtlasIndex, window: Window): void {
  const i = index.windows.indexOf(window);
  for (const w of [index.windows[i + 1], index.windows[i - 1]]) {
    if (!w) continue;
    void loadWindow(w).catch(() => {});
    void fetch(dataUrl(`borders/${w.id}.json`), { priority: "low" } as RequestInit).catch(() => {});
  }
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

/** Names of oceans, seas and lakes; their shapes are loaded by the map from `water.json`. */
export async function loadWaterLabels(): Promise<FeatureCollection<Point, WaterLabelProps>> {
  return withCapitals(await getJson<FeatureCollection<Point, WaterLabelProps>>("water-labels.json"));
}
