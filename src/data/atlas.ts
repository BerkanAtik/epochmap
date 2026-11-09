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

const cache = new Map<string, Promise<unknown>>();

/** Fetches JSON once per path; failed requests are dropped from the cache so they can be retried. */
function getJson<T>(path: string): Promise<T> {
  let request = cache.get(path) as Promise<T> | undefined;
  if (!request) {
    request = fetch(dataUrl(path)).then((res) => {
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res.json() as Promise<T>;
    });
    request.catch(() => cache.delete(path));
    cache.set(path, request);
  }
  return request;
}

export const loadIndex = () => getJson<AtlasIndex>("index.json");
export const loadPolities = () => getJson<PolityIndex>("polities.json");
export const loadDisputes = () => getJson<Disputes>("disputes.json");

const windows = new Map<string, Promise<WindowData>>();

/** Loads one time window: borders (TopoJSON, decoded here) and label points. */
export function loadWindow(window: Window): Promise<WindowData> {
  let request = windows.get(window.id);
  if (!request) {
    request = Promise.all([
      getJson<Topology>(`borders/${window.id}.json`),
      getJson<Labels>(`labels/${window.id}.json`),
    ]).then(([topology, labels]) => {
      const [object] = Object.values(topology.objects) as GeometryCollection<BorderProps>[];
      const borders = (
        object ? feature(topology, object) : { type: "FeatureCollection", features: [] }
      ) as Borders;
      for (const f of borders.features) f.properties.color = paletteColor(f.properties.c);
      // Capitals for the small-caps labels of large polities, with each language's own rules
      // (Turkish upper-cases "i" to "İ").
      for (const l of labels.features) {
        l.properties.enu = l.properties.en.toLocaleUpperCase("en");
        l.properties.tru = l.properties.tr.toLocaleUpperCase("tr");
      }
      return { window, borders, labels };
    });
    request.catch(() => windows.delete(window.id));
    windows.set(window.id, request);
  }
  return request;
}

export function windowFor(index: AtlasIndex, year: number): Window | undefined {
  return index.windows.find((w) => w.from <= year && year <= w.to);
}

/** Warms the cache for the windows around a year so scrubbing and playback feel instant. */
export function prefetchAround(index: AtlasIndex, window: Window): void {
  const i = index.windows.indexOf(window);
  for (const w of [index.windows[i + 1], index.windows[i - 1]]) if (w) void loadWindow(w).catch(() => {});
}
