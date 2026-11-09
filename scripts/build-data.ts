/**
 * Builds the static map data served from `public/data`.
 *
 *   npm run data             build everything
 *   npm run data -- report   also list the names used for 1886–2013 (to review NAME_FIXES)
 *
 * Sources, downloaded at pinned versions and cached in `.cache/`:
 * - 0–1885      Cliopatria (Seshat Global History Databank), CC BY 4.0.
 * - 1886–2013   CShapes 2.0 (ETH Zürich), CC BY-NC-SA 4.0. De jure borders of states and
 *               dependencies. Period names and empire membership come from Cliopatria.
 * - 2014–2026   Natural Earth 1:10m countries, public domain (de facto, after Crimea's annexation).
 * - Disputed areas: Natural Earth, with notes written for this project.
 * - Land:       Natural Earth 1:50m via world-atlas, clips Cliopatria's coastlines.
 * - Names:      Wikidata (CC0) for Turkish names and Wikipedia titles.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import mapshaper from "mapshaper";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { hash, PALETTE } from "../src/lib/colors.ts";
import {
  CSHAPES_NAMES,
  DISPUTES,
  MODERN_RENAMES,
  NAME_FIXES,
  type NameFix,
  TURKISH_NAMES,
  TURKISH_PATTERNS,
} from "./sources.ts";

export const START_YEAR = 0;
export const END_YEAR = 2026;
const CSHAPES_FROM = 1886;
const MODERN_FROM = 2014;

const CLIOPATRIA = { repo: "Seshat-Global-History-Databank/cliopatria", tag: "v0.2.1" };
const CSHAPES = { version: "2.0", url: "https://icr.ethz.ch/data/cshapes/CShapes-2.0.geojson" };
/** Gleditsch & Ward's list of independent states (only served over plain HTTP, so it is checksummed). */
const GLEDITSCH_WARD = {
  url: "http://ksgleditsch.com/data/iisystem.dat",
  sha256: "c9e559020492c246d2d7b60ac5b6fbd75ba1e681136be2212ed1444b0a28e067",
};
const NATURAL_EARTH = { repo: "nvkelso/natural-earth-vector", tag: "v5.1.2" };

/** Simplification tolerance in metres per era. Lower is sharper but heavier. */
const TOLERANCE = { ancient: 1500, cshapes: 800, modern: 600, disputes: 500 };
/** Size budget per time window, in vertices before topology sharing. */
const WINDOW_BUDGET = 400_000;

const USER_AGENT = "EpochmapDataBuilder/1.0 (https://github.com/BerkanAtik/epochmap)";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CACHE = join(ROOT, ".cache");
const OUT = join(ROOT, "public", "data");
const REPORT = process.argv.includes("report");

// ---------------------------------------------------------------------------
// Types and helpers

type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
type Feature<P> = { type: "Feature"; properties: P; geometry: Geometry };
type Collection<P> = { type: "FeatureCollection"; features: Feature<P>[] };
type BBox = [number, number, number, number];

/** One shape of one polity, valid from year `f` to year `t` inclusive. */
type Row = {
  /** Polity identity: a Wikidata id when known, otherwise a name. Stable across rows. */
  id: string;
  /** Group (empire, sovereign) identity used for colouring and "part of". */
  g?: string;
  f: number;
  t: number;
  en: string;
  tr?: string;
  wikidata?: string;
  geometry: Geometry;
};

async function download(url: string, file: string): Promise<Buffer> {
  if (existsSync(file)) return readFile(file);
  console.log(`  downloading ${url}`);
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const data = Buffer.from(await res.arrayBuffer());
  await mkdir(join(file, ".."), { recursive: true });
  await writeFile(file, data);
  return data;
}

function outputFile(out: Record<string, string>, name: string): string {
  const file = out[name];
  if (file === undefined) throw new Error(`mapshaper produced no ${name}`);
  return file;
}

function countVertices(coords: unknown): number {
  if (!Array.isArray(coords)) return 0;
  if (typeof coords[0] === "number") return 1;
  let n = 0;
  for (const c of coords) n += countVertices(c);
  return n;
}

function bboxOf(geometry: Geometry): BBox {
  const box: BBox = [180, 90, -180, -90];
  const walk = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === "number") {
      const [x = 0, y = 0] = c as number[];
      if (x < box[0]) box[0] = x;
      if (y < box[1]) box[1] = y;
      if (x > box[2]) box[2] = x;
      if (y > box[3]) box[3] = y;
    } else for (const x of c) walk(x);
  };
  walk(geometry.coordinates);
  return box;
}

function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi = 0, yi = 0] = ring[i] ?? [];
    const [xj = 0, yj = 0] = ring[j] ?? [];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInGeometry([x = 0, y = 0]: number[], geometry: Geometry): boolean {
  const polygons = (
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates
  ) as number[][][][];
  return polygons.some(
    (p) => p[0] && pointInRing(x, y, p[0]) && !p.slice(1).some((hole) => pointInRing(x, y, hole)),
  );
}

const stripParens = (name: string) => name.replace(/^\((.*)\)$/, "$1");

/** The name fix in force for a Cliopatria name in a given year, if any. */
function fixFor(name: string, year: number): NameFix | undefined {
  let found: NameFix | undefined;
  for (const fix of NAME_FIXES) {
    if (fix.match === name && fix.from <= year && (!found || fix.from > found.from)) found = fix;
  }
  return found;
}

/** A CShapes country's name in a given year ("Turkey (Ottoman Empire)" is "Ottoman Empire" in 1900). */
function cshapesName(raw: string, year: number): string {
  for (const [to, name] of CSHAPES_NAMES[raw] ?? []) if (year <= to) return name;
  return raw.replace(/\s*\(.*\)$/, "");
}

// ---------------------------------------------------------------------------
// Wikidata: names and Wikipedia titles

type WikidataInfo = { en?: string; tr?: string; enwiki?: string; trwiki?: string };

async function wikidata(ids: string[]): Promise<Map<string, WikidataInfo>> {
  const file = join(CACHE, "wikidata.json");
  const cache: Record<string, WikidataInfo> = existsSync(file)
    ? JSON.parse(await readFile(file, "utf8"))
    : {};
  const missing = [...new Set(ids)].filter((id) => /^Q\d+$/.test(id) && !(id in cache));

  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    const params = new URLSearchParams({
      action: "wbgetentities",
      ids: batch.join("|"),
      props: "labels|sitelinks",
      languages: "en|tr",
      sitefilter: "enwiki|trwiki",
      format: "json",
    });
    const res = await fetch(`https://www.wikidata.org/w/api.php?${params}`, {
      headers: { "user-agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
    const data = (await res.json()) as {
      entities: Record<
        string,
        { labels?: Record<string, { value: string }>; sitelinks?: Record<string, { title: string }> }
      >;
    };
    for (const id of batch) {
      const e = data.entities[id];
      cache[id] = {
        en: e?.labels?.en?.value,
        tr: e?.labels?.tr?.value,
        enwiki: e?.sitelinks?.enwiki?.title,
        trwiki: e?.sitelinks?.trwiki?.title,
      };
    }
    console.log(`  wikidata ${Math.min(i + 50, missing.length)}/${missing.length}`);
  }
  await writeFile(file, JSON.stringify(cache));
  return new Map(Object.entries(cache));
}

/**
 * Ids of people rather than polities (Cliopatria tags Denmark with its king Christopher II).
 * Their labels and Wikipedia articles must not be used. One small SPARQL query per 100 ids, cached.
 */
async function wikidataMistakes(ids: string[]): Promise<Set<string>> {
  const file = join(CACHE, "wikidata-humans.json");
  const cache: Record<string, boolean> = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : {};
  const missing = [...new Set(ids)].filter((id) => /^Q\d+$/.test(id) && !(id in cache));
  for (let i = 0; i < missing.length; i += 100) {
    const batch = missing.slice(i, i + 100);
    // Q5: human.
    const query = `SELECT DISTINCT ?item WHERE { VALUES ?item { ${batch.map((id) => `wd:${id}`).join(" ")} }
      ?item wdt:P31 wd:Q5 }`;
    let res: Response | undefined;
    // The public endpoint has occasional 5xx hiccups: retry a few times with a growing pause.
    for (let attempt = 1; attempt <= 5; attempt++) {
      res = await fetch("https://query.wikidata.org/sparql", {
        method: "POST",
        headers: {
          "user-agent": USER_AGENT,
          accept: "application/sparql-results+json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ query }),
      });
      if (res.ok || res.status < 500) break;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
    if (!res?.ok) throw new Error(`Wikidata SPARQL HTTP ${res?.status}`);
    const data = (await res.json()) as { results: { bindings: { item: { value: string } }[] } };
    const wrong = new Set(data.results.bindings.map((b) => b.item.value.split("/").pop()));
    for (const id of batch) cache[id] = wrong.has(id);
  }
  await writeFile(file, JSON.stringify(cache));
  return new Set(Object.keys(cache).filter((id) => cache[id]));
}

/** Turkish for a name with no Turkish label anywhere: the curated list, then common patterns. */
function turkishFallback(en: string): string | undefined {
  const known = TURKISH_NAMES[en];
  if (known) return known;
  for (const [pattern, replacement] of TURKISH_PATTERNS)
    if (pattern.test(en)) return en.replace(pattern, replacement);
  return undefined;
}

// ---------------------------------------------------------------------------
// Sources

type ClioProps = {
  Name: string;
  FromYear: number;
  ToYear: number;
  Type: string;
  Area: number;
  Wikidata: string;
  Components: string;
  MemberOf: string;
};

/** A Cliopatria polity row, kept in full detail for point lookups. */
type ClioRow = {
  name: string;
  wikidata: string;
  group?: string;
  f: number;
  t: number;
  area: number;
  bbox: BBox;
  geometry: Geometry;
};

async function loadCliopatria(): Promise<ClioRow[]> {
  const zip = await download(
    `https://raw.githubusercontent.com/${CLIOPATRIA.repo}/${CLIOPATRIA.tag}/cliopatria.geojson.zip`,
    join(CACHE, "cliopatria", CLIOPATRIA.tag, "cliopatria.geojson.zip"),
  );
  const files = unzipSync(new Uint8Array(zip), { filter: (f) => f.name.endsWith(".geojson") });
  const [entry] = Object.values(files);
  if (!entry) throw new Error("No GeoJSON inside the Cliopatria archive");
  const clio = JSON.parse(new TextDecoder().decode(entry)) as Collection<ClioProps>;

  // "(British Empire)"-style rows are unions of their members; members point to them via MemberOf.
  const groupWikidata = new Map<string, string>();
  for (const f of clio.features) {
    if (f.properties.Components && f.properties.Wikidata)
      groupWikidata.set(f.properties.Name, f.properties.Wikidata);
  }
  return clio.features
    .filter((f) => f.properties.Type === "POLITY" && !f.properties.Components && f.geometry)
    .map((f) => ({
      name: f.properties.Name,
      wikidata: f.properties.Wikidata,
      group: f.properties.MemberOf
        ? (groupWikidata.get(f.properties.MemberOf) ?? stripParens(f.properties.MemberOf))
        : undefined,
      f: f.properties.FromYear,
      t: f.properties.ToYear,
      area: f.properties.Area,
      bbox: bboxOf(f.geometry),
      geometry: f.geometry,
    }));
}

/** Finds the most specific (smallest) Cliopatria polity at a point in a year. */
function clioLookup(rows: ClioRow[]) {
  const BUCKET = 25;
  const buckets = new Map<number, ClioRow[]>();
  for (const r of rows) {
    for (let b = Math.floor(r.f / BUCKET); b <= Math.floor(r.t / BUCKET); b++) {
      buckets.set(b, [...(buckets.get(b) ?? []), r]);
    }
  }
  return (point: number[], year: number): ClioRow | undefined => {
    const [x = 0, y = 0] = point;
    let best: ClioRow | undefined;
    for (const r of buckets.get(Math.floor(year / BUCKET)) ?? []) {
      if (r.f > year || r.t < year || (best && r.area >= best.area)) continue;
      if (x < r.bbox[0] || x > r.bbox[2] || y < r.bbox[1] || y > r.bbox[3]) continue;
      if (pointInGeometry(point, r.geometry)) best = r;
    }
    return best;
  };
}

type CShapesProps = {
  cntry_name: string;
  /** km² */
  area: number;
  gwcode: number;
  gwsyear: number;
  gwsmonth: number;
  gwsday: number;
  gweyear: number;
  gwemonth: number;
  gweday: number;
};

type NeProps = Record<string, string | number | null>;

async function loadNaturalEarth(name: string): Promise<Collection<NeProps>> {
  const buf = await download(
    `https://raw.githubusercontent.com/${NATURAL_EARTH.repo}/${NATURAL_EARTH.tag}/geojson/${name}.geojson`,
    join(CACHE, "natural-earth", NATURAL_EARTH.tag, `${name}.geojson`),
  );
  return JSON.parse(buf.toString("utf8"));
}

function landGeoJson(): string {
  const require = createRequire(import.meta.url);
  const topo = require("world-atlas/land-50m.json") as Topology<{ land: GeometryCollection }>;
  return JSON.stringify(feature(topo, topo.objects.land));
}

/** Interior label points for a list of geometries (pole of inaccessibility, via mapshaper). */
async function interiorPoints(geometries: Geometry[]): Promise<(number[] | undefined)[]> {
  const input = {
    type: "FeatureCollection",
    features: geometries.map((geometry, i) => ({ type: "Feature", properties: { i }, geometry })),
  };
  const out = await mapshaper.applyCommands(
    ["-i", "in.json", "-points", "inner", "-o", "points.json", "format=geojson"],
    { "in.json": JSON.stringify(input) },
  );
  const points = JSON.parse(outputFile(out, "points.json")) as {
    features: { properties: { i: number }; geometry: { coordinates: number[] } | null }[];
  };
  const result: (number[] | undefined)[] = new Array(geometries.length);
  for (const p of points.features) result[p.properties.i] = p.geometry?.coordinates;
  return result;
}

/**
 * Water drawn over the satellite imagery, whose deep oceans are almost black and whose lakes
 * barely show: oceans (seas included) and lakes as TopoJSON, plus label points for oceans,
 * main seas and large lakes in English and Turkish.
 */
async function buildWater(): Promise<void> {
  const ocean = await loadNaturalEarth("ne_50m_ocean");
  const lakes = await loadNaturalEarth("ne_50m_lakes");
  const marine = await loadNaturalEarth("ne_50m_geography_marine_polys");
  const shapesOnly = (c: Collection<NeProps>) =>
    JSON.stringify({
      type: "FeatureCollection",
      features: c.features.map((f) => ({ type: "Feature", properties: {}, geometry: f.geometry })),
    });

  const out = await mapshaper.applyCommands(
    [
      "-i",
      "ocean.json",
      "lakes.json",
      "combine-files",
      "-simplify",
      "interval=2000",
      "keep-shapes",
      "-o",
      "water.json",
      "format=topojson",
      "quantization=100000",
    ],
    { "ocean.json": shapesOnly(ocean), "lakes.json": shapesOnly(lakes) },
  );
  await writeFile(join(OUT, "water.json"), outputFile(out, "water.json"));

  // Oceans and main seas, then lakes large enough to be named at a world scale.
  type WaterLabel = { en: string; tr: string; k: "ocean" | "sea" | "lake"; z: number };
  const labelled: { label: WaterLabel; geometry: Geometry }[] = [];
  for (const f of marine.features) {
    const p = f.properties;
    if (Number(p.scalerank) > 2) continue;
    const en = String(p.name_en ?? p.name);
    labelled.push({
      label: {
        en,
        tr: String(p.name_tr ?? en),
        k: p.featurecla === "ocean" ? "ocean" : "sea",
        z: Number(p.min_label ?? 2),
      },
      geometry: f.geometry,
    });
  }
  for (const f of lakes.features) {
    const p = f.properties;
    const minLabel = Number(p.min_label ?? 99);
    if (minLabel > 3.6 || !p.name) continue;
    const en = String(p.name);
    const trBase = String(p.name_tr ?? p.name_en ?? en);
    // Natural Earth's Turkish lake names drop the word "lake" ("Victoria"); add it back.
    const tr = /göl|deniz|lagün/i.test(trBase) ? trBase : `${trBase} Gölü`;
    labelled.push({ label: { en, tr, k: "lake", z: minLabel }, geometry: f.geometry });
  }
  const points = await interiorPoints(labelled.map((l) => l.geometry));
  await writeFile(
    join(OUT, "water-labels.json"),
    JSON.stringify({
      type: "FeatureCollection",
      features: labelled.flatMap((l, i) => {
        const point = points[i];
        if (!point) return [];
        const coordinates = point.map((c) => Math.round(c * 100) / 100);
        return [{ type: "Feature", properties: l.label, geometry: { type: "Point", coordinates } }];
      }),
    }),
  );
}

// ---------------------------------------------------------------------------
// Eras

/** Groups consecutive years with the same key into rows. */
function runs<T>(from: number, to: number, keyOf: (year: number) => { key: string; value: T }) {
  const result: { f: number; t: number; value: T }[] = [];
  let current: { f: number; t: number; key: string; value: T } | undefined;
  for (let y = from; y <= to; y++) {
    const { key, value } = keyOf(y);
    if (current && current.key === key) current.t = y;
    else {
      if (current) result.push(current);
      current = { f: y, t: y, key, value };
    }
  }
  if (current) result.push(current);
  return result;
}

function ancientRows(clio: ClioRow[]): Row[] {
  const rows: Row[] = [];
  for (const r of clio) {
    if (r.t < START_YEAR || r.f >= CSHAPES_FROM) continue;
    const parts = runs(Math.max(r.f, START_YEAR), Math.min(r.t, CSHAPES_FROM - 1), (year) => {
      const fix = fixFor(r.name, year);
      return { key: fix?.drop ? "drop" : (fix?.name ?? ""), value: fix };
    });
    for (const { f, t, value: fix } of parts) {
      if (fix?.drop) continue;
      const name = fix?.name ?? r.name;
      // A fix without an id deliberately drops the source's (wrong) one.
      const wikidata = fix ? fix.wikidata : r.wikidata || undefined;
      rows.push({
        id: wikidata ?? name,
        g: r.group,
        f,
        t,
        en: name,
        tr: fix?.tr,
        wikidata,
        geometry: r.geometry,
      });
    }
  }
  return rows;
}

/** Whether a Gleditsch–Ward country code was an independent state on 1 July of a year. */
async function loadIndependence(): Promise<(gwcode: number, year: number) => boolean> {
  const buf = await download(GLEDITSCH_WARD.url, join(CACHE, "gleditsch-ward", "iisystem.dat"));
  const hash = createHash("sha256").update(buf).digest("hex");
  if (hash !== GLEDITSCH_WARD.sha256) throw new Error(`Unexpected checksum for iisystem.dat: ${hash}`);

  const spans = new Map<number, [number, number][]>();
  for (const line of buf.toString("utf8").split(/\r?\n/)) {
    const [code, , , start, end] = line.split("\t");
    if (!code || !start || !end) continue;
    const [sd = 1, sm = 1, sy = 0] = start.split(":").map(Number);
    const [ed = 1, em = 1, ey = 0] = end.split(":").map(Number);
    const from = sm < 7 || (sm === 7 && sd <= 1) ? sy : sy + 1;
    // The list ends on 31 Dec 2017; states still on it then are independent today.
    const to = ey >= 2017 ? 9999 : em > 7 || (em === 7 && ed >= 1) ? ey : ey - 1;
    spans.set(Number(code), [...(spans.get(Number(code)) ?? []), [from, to]]);
  }
  return (gwcode, year) => (spans.get(gwcode) ?? []).some(([f, t]) => f <= year && year <= t);
}

/** Year range a dated period covers: a row counts for a year if it is in force on 1 July. */
function yearRange(p: CShapesProps): [number, number] | null {
  const from = p.gwsmonth < 7 || (p.gwsmonth === 7 && p.gwsday <= 1) ? p.gwsyear : p.gwsyear + 1;
  const to = p.gwemonth > 7 || (p.gwemonth === 7 && p.gweday >= 1) ? p.gweyear : p.gweyear - 1;
  return from <= to ? [from, to] : null;
}

async function cshapesRows(clio: ClioRow[]): Promise<Row[]> {
  const buf = await download(CSHAPES.url, join(CACHE, "cshapes", CSHAPES.version, "CShapes-2.0.geojson"));
  const cshapes = JSON.parse(buf.toString("utf8")) as Collection<CShapesProps>;
  const lookup = clioLookup(clio);
  const independent = await loadIndependence();
  // Wikidata id per Cliopatria name, after fixes (for CShapes rows that use a known name).
  const wikidataByName = new Map<string, string>();
  for (const r of clio) {
    const fix = fixFor(r.name, r.t);
    const name = fix?.name ?? r.name;
    const id = fix ? fix.wikidata : r.wikidata;
    if (id && !wikidataByName.has(name)) wikidataByName.set(name, id);
  }
  const labels = await interiorPoints(cshapes.features.map((f) => f.geometry));

  const rows: Row[] = [];
  const gwOf = new Map<Row, number>();
  const aggregated = new Map<string, string>();
  cshapes.features.forEach((f, i) => {
    const range = yearRange(f.properties);
    const label = labels[i];
    if (!range || !label) return;
    const from = Math.max(range[0], CSHAPES_FROM);
    const to = Math.min(range[1], MODERN_FROM - 1);
    if (from > to) return;
    const raw = f.properties.cntry_name;

    // Name each year after the Cliopatria polity at this shape's centre, so periods get their
    // own names (Ottoman Empire, then Republic of Turkey) and colonies their empire.
    for (const run of runs(from, to, (year) => {
      const found = lookup(label, year);
      const fix = found ? fixFor(found.name, year) : undefined;
      const c = fix?.drop ? undefined : found;
      const ownName = cshapesName(raw, year);
      const own = {
        name: ownName,
        // "Ottoman Empire" is the same polity whether the shape comes from Cliopatria or CShapes.
        wikidata: wikidataByName.get(ownName) ?? "",
        group: undefined as string | undefined,
        tr: undefined as string | undefined,
      };
      // Cliopatria's polity only names this country when it covers roughly the same land.
      const ratio = c ? c.area / f.properties.area : 0;
      const isIndependent = independent(f.properties.gwcode, year);
      const ownNameWanted = fix?.name === null;
      // Cliopatria's polity names this country only when it covers about the same land. A
      // dependency has to match closely: "Portuguese Republic" with its colonies is not Angola.
      const sameLand = c && !ownNameWanted && ratio >= 0.5 && ratio <= (isIndependent ? 2 : 1.3);

      let value = own;
      if (c && sameLand) {
        value = {
          name: fix?.name ?? c.name,
          wikidata: fix ? (fix.wikidata ?? "") : c.wikidata,
          // An independent state answers to nobody, whatever Cliopatria's spheres of influence say.
          group: isIndependent ? undefined : c.group,
          tr: fix?.tr,
        };
      } else if (c && !isIndependent && (ratio > 1.3 || ownNameWanted)) {
        // A dependency inside a whole colonial region ("British Africa") or empire: it keeps
        // its own name and joins that empire.
        value = { ...own, group: c.group ?? (c.wikidata || c.name) };
        if (REPORT) aggregated.set(`${own.name} in ${c.name}`, `${year}`);
      }
      return { key: `${value.name}|${value.wikidata}|${value.group ?? ""}`, value };
    })) {
      const v = run.value;
      const row: Row = {
        id: v.wikidata || `gw:${f.properties.gwcode}`,
        g: v.group,
        f: run.f,
        t: run.t,
        en: v.name,
        tr: v.tr,
        wikidata: v.wikidata || undefined,
        geometry: f.geometry,
      };
      rows.push(row);
      gwOf.set(row, f.properties.gwcode);
    }
  });

  // A colony and the state it became are one polity: rows without a Wikidata id take the
  // identity of the same CShapes country's latest row that has one.
  const latestId = new Map<number, { t: number; id: string }>();
  for (const r of rows) {
    const gw = gwOf.get(r);
    if (!r.wikidata || gw === undefined) continue;
    const current = latestId.get(gw);
    if (!current || r.t > current.t) latestId.set(gw, { t: r.t, id: r.id });
  }
  for (const r of rows) {
    const gw = gwOf.get(r);
    const latest = gw === undefined ? undefined : latestId.get(gw);
    if (!r.wikidata && latest) r.id = latest.id;
  }

  if (REPORT) {
    console.log("\nCountries named by CShapes inside a larger Cliopatria region:");
    for (const [k, y] of aggregated) console.log(`  ${y}  ${k}`);
  }
  return rows;
}

function modernRows(ne: Collection<NeProps>): Row[] {
  // Dependencies (Greenland, French Guiana…) are coloured with their sovereign.
  const sovereignId = new Map<string, string>();
  for (const f of ne.features) {
    const p = f.properties;
    if (p.SOVEREIGNT === p.ADMIN && p.WIKIDATAID) sovereignId.set(String(p.SOVEREIGNT), String(p.WIKIDATAID));
  }
  return ne.features.flatMap((f) => {
    const p = f.properties;
    const id = String(p.WIKIDATAID || p.NAME_EN);
    const sovereign = sovereignId.get(String(p.SOVEREIGNT));
    const base: Row = {
      id,
      g: sovereign && sovereign !== id ? sovereign : undefined,
      f: MODERN_FROM,
      t: END_YEAR,
      en: String(p.NAME_EN),
      tr: p.NAME_TR ? String(p.NAME_TR) : undefined,
      wikidata: p.WIKIDATAID ? String(p.WIKIDATAID) : undefined,
      geometry: f.geometry,
    };
    // Split the row where a country changed its name after Natural Earth's release.
    const renames = MODERN_RENAMES.filter((r) => r.wikidata === id);
    const cuts = [...new Set(renames.flatMap((r) => [r.from, r.to + 1]))]
      .filter((y) => y > MODERN_FROM && y <= END_YEAR)
      .sort((a, b) => a - b);
    const bounds = [MODERN_FROM, ...cuts, END_YEAR + 1];
    return bounds.slice(0, -1).map((from, i) => {
      const to = (bounds[i + 1] ?? END_YEAR + 1) - 1;
      const rename = renames.find((r) => r.from <= from && to <= r.to);
      return { ...base, f: from, t: to, en: rename?.en ?? base.en, tr: rename?.tr ?? base.tr };
    });
  });
}

/**
 * A polity on the map in 2013 and in 2014 should keep one identity, so its colour and the
 * selection survive the switch from CShapes to Natural Earth. Rows that end in 2013 adopt
 * the Natural Earth identity of the country at the same place.
 */
async function bridgeIdentities(history: Row[], modern: Row[]) {
  const last = history.filter((r) => r.t === MODERN_FROM - 1);
  const points = await interiorPoints(last.map((r) => r.geometry));
  const remap = new Map<string, string>();
  last.forEach((r, i) => {
    const point = points[i];
    const match = point && modern.find((m) => pointInGeometry(point, m.geometry));
    // Same place and either the same name or no identity of its own: the same country.
    if (match && match.id !== r.id && (match.en === r.en || !r.wikidata)) remap.set(r.id, match.id);
  });
  for (const r of history) {
    const to = remap.get(r.id);
    if (to) r.id = to;
  }
}

/**
 * Lists rows whose name shares no meaningful word with the Wikidata label of their id: usually
 * a wrong id in the source, which would show the wrong Turkish name and Wikipedia article.
 */
function reportWikidataMismatches(rows: Row[], info: Map<string, WikidataInfo>) {
  const generic = new Set(
    "of the and empire kingdom republic dynasty state states sultanate caliphate khanate principality duchy grand emirate federation union people's peoples democratic socialist islamic united first second third fourth fifth great early late later eastern western northern southern".split(
      " ",
    ),
  );
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .split(/[^a-z]+/)
        .filter((w) => w.length > 2 && !generic.has(w)),
    );
  const totals = new Map<string, { name: string; label: string; id: string; years: number }>();
  for (const r of rows) {
    const label = r.wikidata ? info.get(r.wikidata)?.en : undefined;
    if (!r.wikidata || !label) continue;
    const a = words(r.en);
    const b = words(label);
    if ([...a].some((w) => b.has(w)) || a.size === 0) continue;
    const key = `${r.en}|${r.wikidata}`;
    const t = totals.get(key) ?? { name: r.en, label, id: r.wikidata, years: 0 };
    t.years += r.t - r.f + 1;
    totals.set(key, t);
  }
  console.log("\nNames that don't match their Wikidata label (most years first):");
  for (const t of [...totals.values()].sort((x, y) => y.years - x.years).slice(0, 80)) {
    console.log(`  ${String(t.years).padStart(5)}y  ${t.name}  ->  ${t.label} [${t.id}]`);
  }
}

// ---------------------------------------------------------------------------
// Geometry processing and output

type Shaped = { row: Row; geometry: Geometry; label: number[]; area: number; vertices: number };

/** Simplifies shapes (optionally clipped to land) and finds a label point inside each. */
async function shape(rows: Row[], tolerance: number, clip?: string): Promise<Shaped[]> {
  const input = {
    type: "FeatureCollection",
    features: rows.map((r, i) => ({ type: "Feature", properties: { i }, geometry: r.geometry })),
  };
  const out = await mapshaper.applyCommands(
    [
      "-i",
      "in.json",
      ...(clip ? ["-clip", "land.json", "remove-slivers"] : []),
      "-simplify",
      `interval=${tolerance}`,
      "keep-shapes",
      "-filter",
      "!this.isNull",
      "-each",
      "area = Math.round(this.area / 1e6)",
      "-o",
      "shapes.json",
      "format=geojson",
      "precision=0.0001",
      "-points",
      "inner",
      "-o",
      "points.json",
      "format=geojson",
      "precision=0.01",
    ],
    clip ? { "in.json": JSON.stringify(input), "land.json": clip } : { "in.json": JSON.stringify(input) },
  );
  const shapes = JSON.parse(outputFile(out, "shapes.json")) as Collection<{ i: number; area: number }>;
  const points = JSON.parse(outputFile(out, "points.json")) as {
    features: { properties: { i: number }; geometry: { coordinates: number[] } | null }[];
  };
  const labelOf = new Map(points.features.map((p) => [p.properties.i, p.geometry?.coordinates]));
  return shapes.features.flatMap((f) => {
    const row = rows[f.properties.i];
    const label = labelOf.get(f.properties.i);
    if (!row || !label) return [];
    const vertices = countVertices(f.geometry.coordinates);
    return [{ row, geometry: f.geometry, label, area: f.properties.area, vertices }];
  });
}

/** Greedily groups years into windows whose shapes stay under the vertex budget. */
function windows(shaped: Shaped[]): { from: number; to: number }[] {
  // Shapes that begin in each year are the only ones that can join a growing window.
  const byStart = new Map<number, Shaped[]>();
  for (const s of shaped) byStart.set(s.row.f, [...(byStart.get(s.row.f) ?? []), s]);

  const result: { from: number; to: number }[] = [];
  let from = START_YEAR;
  while (from <= END_YEAR) {
    let cost = shaped
      .filter((s) => s.row.f <= from && s.row.t >= from)
      .reduce((sum, s) => sum + s.vertices, 0);
    let to = from;
    while (to < END_YEAR) {
      const extra = (byStart.get(to + 1) ?? []).reduce((sum, s) => sum + s.vertices, 0);
      if (extra > 0 && cost + extra > WINDOW_BUDGET) break;
      cost += extra;
      to++;
    }
    result.push({ from, to });
    from = to + 1;
  }
  return result;
}

type BorderProperties = { id: string; g?: string; f: number; t: number; a: number; c?: number };
type TopoGeometry = { type: string | null; arcs?: unknown; properties: BorderProperties };

function geometriesOf(topology: Topology): TopoGeometry[] {
  const [object] = Object.values(topology.objects) as unknown as { geometries: TopoGeometry[] }[];
  return object?.geometries ?? [];
}

/**
 * Adds up how strongly polities border each other: shapes that share an edge in the topology
 * and exist at the same time, weighted by the years they coexist. Keys are colour keys (the
 * empire when there is one), so colonies never count as neighbours of their own empire.
 */
function addNeighbours(topology: Topology, weights: Map<string, number>) {
  const geometries = geometriesOf(topology);
  const owners = new Map<number, Set<number>>();
  const collect = (arcs: unknown, index: number): void => {
    if (typeof arcs === "number") {
      const arc = arcs < 0 ? ~arcs : arcs;
      const set = owners.get(arc) ?? new Set<number>();
      set.add(index);
      owners.set(arc, set);
    } else if (Array.isArray(arcs)) for (const a of arcs) collect(a, index);
  };
  for (const [i, g] of geometries.entries()) collect(g.arcs, i);

  for (const set of owners.values()) {
    if (set.size < 2) continue;
    // Group the shapes on this edge by colour key, keeping their year ranges.
    const byKey = new Map<string, [number, number][]>();
    for (const i of set) {
      const p = geometries[i]?.properties;
      if (!p) continue;
      const key = p.g ?? p.id;
      byKey.set(key, [...(byKey.get(key) ?? []), [p.f, p.t]]);
    }
    const keys = [...byKey.keys()];
    for (let a = 0; a < keys.length; a++) {
      for (let b = a + 1; b < keys.length; b++) {
        const ka = keys[a] as string;
        const kb = keys[b] as string;
        let years = 0;
        for (const [fa, ta] of byKey.get(ka) ?? []) {
          for (const [fb, tb] of byKey.get(kb) ?? [])
            years += Math.max(0, Math.min(ta, tb) - Math.max(fa, fb) + 1);
        }
        if (years === 0) continue;
        const pair = ka < kb ? `${ka}\u0000${kb}` : `${kb}\u0000${ka}`;
        weights.set(pair, (weights.get(pair) ?? 0) + years);
      }
    }
  }
}

/**
 * Picks a palette colour per polity so that neighbours look different: polities with the most
 * borders choose first, each taking the colour least used by its already-coloured neighbours.
 * Ties fall back to a hash of the key, so a polity's colour is stable between builds.
 */
function assignColors(weights: Map<string, number>, keys: string[]): Map<string, number> {
  const neighbours = new Map<string, Map<string, number>>();
  for (const [pair, w] of weights) {
    const [a = "", b = ""] = pair.split("\u0000");
    neighbours.set(a, (neighbours.get(a) ?? new Map()).set(b, w));
    neighbours.set(b, (neighbours.get(b) ?? new Map()).set(a, w));
  }
  const total = (key: string) => [...(neighbours.get(key)?.values() ?? [])].reduce((s, w) => s + w, 0);
  const order = [...new Set(keys)].sort((a, b) => total(b) - total(a) || a.localeCompare(b));

  const colors = new Map<string, number>();
  for (const key of order) {
    const cost = new Array<number>(PALETTE.length).fill(0);
    for (const [n, w] of neighbours.get(key) ?? []) {
      const c = colors.get(n);
      if (c !== undefined) cost[c] = (cost[c] ?? 0) + w;
    }
    let best = hash(key) % PALETTE.length;
    for (let c = 0; c < PALETTE.length; c++) if ((cost[c] ?? 0) < (cost[best] ?? 0)) best = c;
    colors.set(key, best);
  }

  const clashes = [...weights].filter(([pair]) => {
    const [a = "", b = ""] = pair.split("\u0000");
    return colors.get(a) === colors.get(b);
  });
  console.log(
    `  colours: ${colors.size} polities, ${clashes.length} of ${weights.size} neighbour pairs share a colour`,
  );
  return colors;
}

/** Encodes border shapes as TopoJSON, so borders shared between neighbours and years are stored once. */
async function toTopoJson(shaped: Shaped[]): Promise<string> {
  const input = {
    type: "FeatureCollection",
    features: shaped.map((s) => ({
      type: "Feature",
      properties: { id: s.row.id, ...(s.row.g ? { g: s.row.g } : {}), f: s.row.f, t: s.row.t, a: s.area },
      geometry: s.geometry,
    })),
  };
  const out = await mapshaper.applyCommands(
    ["-i", "borders.json", "-o", "out.json", "format=topojson", "quantization=200000"],
    { "borders.json": JSON.stringify(input) },
  );
  return outputFile(out, "out.json");
}

async function main() {
  await mkdir(CACHE, { recursive: true });

  console.log("Sources");
  const clio = await loadCliopatria();
  const ne = await loadNaturalEarth("ne_10m_admin_0_countries");
  const disputedNe = await loadNaturalEarth("ne_10m_admin_0_disputed_areas");

  console.log("Eras");
  const ancient = ancientRows(clio);
  const cshapes = await cshapesRows(clio);
  const modern = modernRows(ne);
  await bridgeIdentities([...ancient, ...cshapes], modern);
  console.log(
    `  ${ancient.length} Cliopatria rows, ${cshapes.length} CShapes rows, ${modern.length} countries`,
  );

  if (REPORT) {
    const seen = new Map<string, { f: number; t: number; id: string }>();
    for (const r of cshapes) {
      const s = seen.get(r.en);
      if (s) {
        s.f = Math.min(s.f, r.f);
        s.t = Math.max(s.t, r.t);
      } else seen.set(r.en, { f: r.f, t: r.t, id: r.id });
    }
    console.log("\nNames used for 1886–2013:");
    for (const [name, s] of [...seen].sort((a, b) => b[1].t - a[1].t || a[0].localeCompare(b[0]))) {
      console.log(`  ${s.f}-${s.t}  ${name}  [${s.id}]`);
    }
  }

  // Disputed areas: a small overlay loaded once for all years.
  const disputes: Row[] = DISPUTES.map((d, i) => {
    const f = disputedNe.features.find(
      (x) => x.properties.NAME_EN === d.ne && (!d.sov || x.properties.SOVEREIGNT === d.sov),
    );
    if (!f) throw new Error(`Disputed area not found in Natural Earth: ${d.ne}`);
    return {
      id: `dispute:${i}`,
      f: Math.max(d.from, START_YEAR),
      t: d.to ?? END_YEAR,
      en: d.ne,
      tr: f.properties.NAME_TR ? String(f.properties.NAME_TR) : undefined,
      geometry: f.geometry,
    };
  });

  console.log("Simplifying (a minute or two)");
  // Historical shapes are clipped to the same coastline as the water layer, so no border
  // spills into the sea; Natural Earth's own countries already follow it.
  const land = landGeoJson();
  const shaped = [
    ...(await shape(ancient, TOLERANCE.ancient, land)),
    ...(await shape(cshapes, TOLERANCE.cshapes, land)),
    ...(await shape(modern, TOLERANCE.modern)),
  ];
  const disputeShapes = await shape(disputes, TOLERANCE.disputes);

  console.log("Wikidata");
  const allRows = shaped.map((s) => s.row);
  const groupIds = allRows.map((r) => r.g).filter((g): g is string => !!g);
  const allIds = [...allRows.map((r) => r.wikidata ?? ""), ...groupIds];
  const info = await wikidata(allIds);
  const mistakes = await wikidataMistakes(allIds);
  // "History of …" topics are not polities either: their names and articles are about history.
  for (const [id, wd] of info) {
    if (/^history of /i.test(wd.en ?? "") || /\btarihi$/i.test(wd.tr ?? "")) mistakes.add(id);
  }
  if (REPORT) {
    reportWikidataMismatches(allRows, info);
    console.log("\nIds that are people or history topics (labels and articles ignored):");
    for (const id of mistakes) {
      const names = [...new Set(allRows.filter((r) => r.wikidata === id).map((r) => r.en))];
      console.log(`  ${id} ${info.get(id)?.en ?? ""}  <-  ${names.join(", ")}`);
    }
  }
  /** Wikidata details for a row, unless its id is known to be wrong. */
  const reliable = (id: string | undefined) => (id && !mistakes.has(id) ? info.get(id) : undefined);

  // English keeps the source's period-specific names. Turkish comes from a name fix, then
  // Wikidata, then Natural Earth (same English name), then the curated list and patterns.
  const neTurkish = new Map(ne.features.map((f) => [String(f.properties.NAME_EN), f.properties.NAME_TR]));
  for (const r of allRows) {
    const fromNe = neTurkish.get(r.en);
    // A label like "Katar tarihi" means the id points at a history article, not the polity.
    const wikidataTr = reliable(r.wikidata)?.tr;
    const usableTr = wikidataTr && !/\btarihi$/i.test(wikidataTr) ? wikidataTr : undefined;
    r.tr ??= usableTr ?? (fromNe ? String(fromNe) : undefined) ?? turkishFallback(r.en);
  }

  console.log("Writing");
  await rm(OUT, { recursive: true, force: true });
  await mkdir(join(OUT, "borders"), { recursive: true });
  await mkdir(join(OUT, "labels"), { recursive: true });
  // The generated data carries its own license (CC BY-NC-SA, because of CShapes).
  await copyFile(join(ROOT, "scripts", "DATA_LICENSE.md"), join(OUT, "LICENSE.md"));
  await buildWater();

  const spans = windows(shaped);
  const topologies: Topology[] = [];
  const neighbours = new Map<string, number>();
  for (const { from, to } of spans) {
    // Larger shapes first, so smaller ones (enclaves, breakaway regions) draw on top.
    const inWindow = shaped.filter((s) => s.row.f <= to && s.row.t >= from).sort((a, b) => b.area - a.area);
    const topology = JSON.parse(await toTopoJson(inWindow)) as Topology;
    addNeighbours(topology, neighbours);
    topologies.push(topology);
  }
  const colors = assignColors(
    neighbours,
    shaped.map((s) => s.row.g ?? s.row.id),
  );

  const windowIndex: { id: string; from: number; to: number; bytes: number }[] = [];
  for (const [i, { from, to }] of spans.entries()) {
    const inWindow = shaped.filter((s) => s.row.f <= to && s.row.t >= from).sort((a, b) => b.area - a.area);
    const id = `${from}-${to}`;
    const topology = topologies[i] as Topology;
    for (const g of geometriesOf(topology))
      g.properties.c = colors.get(g.properties.g ?? g.properties.id) ?? 0;
    const borders = JSON.stringify(topology);
    const labels = JSON.stringify({
      type: "FeatureCollection",
      features: inWindow.map((s) => ({
        type: "Feature",
        properties: {
          id: s.row.id,
          // The page reads "part of" from labels: border shapes only live in the map's worker.
          ...(s.row.g ? { g: s.row.g } : {}),
          f: s.row.f,
          t: s.row.t,
          a: s.area,
          en: s.row.en,
          tr: s.row.tr ?? s.row.en,
        },
        geometry: { type: "Point", coordinates: s.label },
      })),
    });
    await writeFile(join(OUT, "borders", `${id}.json`), borders);
    await writeFile(join(OUT, "labels", `${id}.json`), labels);
    windowIndex.push({ id, from, to, bytes: borders.length + labels.length });
    console.log(
      `  ${id.padEnd(10)} ${String(inWindow.length).padStart(5)} shapes ${(borders.length / 1024).toFixed(0).padStart(6)} KB`,
    );
  }

  await writeFile(
    join(OUT, "disputes.json"),
    JSON.stringify({
      type: "FeatureCollection",
      features: disputeShapes.map((s) => {
        const d = DISPUTES[Number(s.row.id.split(":")[1])];
        return {
          type: "Feature",
          properties: {
            id: s.row.id,
            f: s.row.f,
            t: s.row.t,
            en: s.row.en,
            tr: s.row.tr ?? s.row.en,
            note_en: d?.en,
            note_tr: d?.tr,
            lx: s.label[0],
            ly: s.label[1],
          },
          geometry: s.geometry,
        };
      }),
    }),
  );

  // Polity index for search and the info panel.
  type Entry = {
    id: string;
    en: string[];
    tr: string[];
    spans: [number, number][];
    wiki: { en?: string; tr?: string };
  };
  const entries = new Map<string, Entry>();
  for (const r of [...allRows].sort((a, b) => a.f - b.f)) {
    const e = entries.get(r.id) ?? { id: r.id, en: [], tr: [], spans: [], wiki: {} };
    if (!e.en.includes(r.en)) e.en.push(r.en);
    const tr = r.tr ?? r.en;
    if (!e.tr.includes(tr)) e.tr.push(tr);
    const lastSpan = e.spans.at(-1);
    if (lastSpan && r.f <= lastSpan[1] + 1) lastSpan[1] = Math.max(lastSpan[1], r.t);
    else e.spans.push([r.f, r.t]);
    const wd = reliable(r.wikidata);
    e.wiki.en ??= wd?.enwiki;
    e.wiki.tr ??= wd?.trwiki;
    entries.set(r.id, e);
  }
  const groups: Record<string, { en: string; tr: string }> = {};
  for (const g of new Set(groupIds)) {
    const wd = reliable(g);
    const known = entries.get(g);
    groups[g] = { en: known?.en.at(-1) ?? wd?.en ?? g, tr: known?.tr.at(-1) ?? wd?.tr ?? wd?.en ?? g };
  }
  await writeFile(join(OUT, "polities.json"), JSON.stringify({ polities: [...entries.values()], groups }));

  // Years in which anything on the map changes. Besides "previous / next change", the page
  // filters the map by the last change year rather than the year itself, so this must cover
  // every shape and every disputed area.
  const changes = new Set<number>();
  for (const s of [...shaped, ...disputeShapes]) {
    if (s.row.f > START_YEAR) changes.add(s.row.f);
    if (s.row.t < END_YEAR) changes.add(s.row.t + 1);
  }

  await writeFile(
    join(OUT, "index.json"),
    JSON.stringify({
      start: START_YEAR,
      end: END_YEAR,
      eras: { cshapes: CSHAPES_FROM, modern: MODERN_FROM },
      windows: windowIndex.map(({ id, from, to }) => ({ id, from, to })),
      changes: [...changes].sort((a, b) => a - b),
      sources: { cliopatria: CLIOPATRIA.tag, cshapes: CSHAPES.version, naturalEarth: NATURAL_EARTH.tag },
    }),
  );

  const total = windowIndex.reduce((sum, w) => sum + w.bytes, 0) / 1024 / 1024;
  console.log(
    `\n${spans.length} windows, ${entries.size} polities, ${changes.size} change years, ${total.toFixed(1)} MB in total.`,
  );
}

await main();
