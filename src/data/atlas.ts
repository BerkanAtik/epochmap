import type { FeatureCollection, MultiPolygon, Point, Polygon } from "geojson";
import { polityColor } from "../lib/colors";
import type { SearchEntry } from "../lib/search";

export type Snapshot = { id: string; year: number; count: number };

export type AtlasIndex = {
  source: { repo: string; commit: string; license: string };
  snapshots: Snapshot[];
};

export type PolityProps = {
  name: string;
  subject?: string;
  partOf?: string;
  /** 1 approximate, 2 moderately precise, 3 set by international law. */
  precision?: number;
  wiki?: string;
  /** km² */
  area: number;
  /** Added on load: fill colour for the map. */
  color: string;
};

export type LabelProps = { name: string; area: number };

export type Borders = FeatureCollection<Polygon | MultiPolygon, PolityProps>;
export type Labels = FeatureCollection<Point, LabelProps>;

export type SnapshotData = { snapshot: Snapshot; borders: Borders; labels: Labels };

/** Absolute URL for a file in public/, honouring Vite's relative `base`. */
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
export const loadSearchIndex = () => getJson<SearchEntry[]>("search.json");

const colored = new WeakSet<Borders>();

export async function loadSnapshot(snapshot: Snapshot): Promise<SnapshotData> {
  const [borders, labels] = await Promise.all([
    getJson<Borders>(`borders/${snapshot.id}.json`),
    getJson<Labels>(`labels/${snapshot.id}.json`),
  ]);
  // Colours are derived here rather than stored, so palette tweaks don't require rebuilding the data.
  if (!colored.has(borders)) {
    for (const f of borders.features)
      f.properties.color = polityColor(f.properties.name, f.properties.subject);
    colored.add(borders);
  }
  return { snapshot, borders, labels };
}

/** Warms the cache for neighbouring snapshots so stepping and playback feel instant. */
export function prefetchSnapshot(snapshot: Snapshot | undefined): void {
  if (snapshot) void loadSnapshot(snapshot).catch(() => {});
}
