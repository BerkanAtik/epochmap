/**
 * Builds the static map data served from `public/data`.
 *
 *   npm run data
 *
 * Sources
 * - Historical borders: aourednik/historical-basemaps (GPL-3.0), pinned to a commit
 *   so the output is reproducible.
 * - Land: Natural Earth 1:50m via the `world-atlas` package (public domain).
 *
 * Raw downloads are cached in `.cache/` (git-ignored); only the processed,
 * simplified output is committed.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import mapshaper from "mapshaper";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

const BASEMAPS_REPO = "aourednik/historical-basemaps";
const BASEMAPS_COMMIT = "4b5039e50d8d2464b065bd76ad6086cd4597108d";

// Every snapshot published in historical-basemaps, oldest first.
const SNAPSHOTS = [
  "bc123000",
  "bc10000",
  "bc8000",
  "bc5000",
  "bc4000",
  "bc3000",
  "bc2000",
  "bc1500",
  "bc1000",
  "bc700",
  "bc500",
  "bc400",
  "bc323",
  "bc300",
  "bc200",
  "bc100",
  "bc1",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
  "1000",
  "1100",
  "1200",
  "1279",
  "1300",
  "1400",
  "1492",
  "1500",
  "1530",
  "1600",
  "1650",
  "1700",
  "1715",
  "1783",
  "1800",
  "1815",
  "1878",
  "1880",
  "1900",
  "1914",
  "1920",
  "1930",
  "1938",
  "1945",
  "1960",
  "1994",
  "2000",
  "2010",
];

// Source field -> our (shorter) field name. Missing fields are skipped per file.
const FIELDS: Record<string, string> = {
  NAME: "name",
  SUBJECTO: "subject",
  PARTOF: "partOf",
  BORDERPRECISION: "precision",
  wikipedia: "wiki",
};

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CACHE_DIR = join(ROOT, ".cache", "historical-basemaps", BASEMAPS_COMMIT);
const OUT_DIR = join(ROOT, "public", "data");

/** "bc323" -> -323, "1492" -> 1492. Negative numbers are years BCE. */
function yearOf(id: string): number {
  return id.startsWith("bc") ? -Number(id.slice(2)) : Number(id);
}

async function download(id: string): Promise<string> {
  const file = join(CACHE_DIR, `world_${id}.geojson`);
  if (existsSync(file)) return readFile(file, "utf8");

  const url = `https://raw.githubusercontent.com/${BASEMAPS_REPO}/${BASEMAPS_COMMIT}/geojson/world_${id}.geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  const text = await res.text();
  await writeFile(file, text);
  return text;
}

type PolityProps = {
  name: string;
  subject?: string;
  partOf?: string;
  precision?: number;
  wiki?: string;
  area: number;
};

type FeatureCollection<P> = {
  type: "FeatureCollection";
  features: { type: "Feature"; properties: P; geometry: unknown }[];
};

async function buildSnapshot(id: string) {
  const raw = await download(id);
  const parsed = JSON.parse(raw) as FeatureCollection<Record<string, unknown>>;

  const present = new Set(parsed.features.flatMap((f) => Object.keys(f.properties ?? {})));
  const fields = Object.keys(FIELDS).filter((f) => present.has(f));
  const copyFields = fields.filter((f) => f !== "NAME");
  const renames = fields.map((f) => `${FIELDS[f]}=${f}`);

  const out = await mapshaper.applyCommands(
    [
      "-i",
      "in.json",
      // Drop unnamed (unclaimed) areas; the land layer shows them instead.
      "-filter",
      "!!NAME",
      // Topology-aware simplification keeps neighbouring borders in sync.
      "-simplify",
      "12%",
      "keep-shapes",
      // One feature per polity, so hovering highlights the whole polity.
      "-dissolve",
      "NAME",
      ...(copyFields.length ? [`copy-fields=${copyFields.join(",")}`] : []),
      "-each",
      "area = Math.round(this.area / 1e6)",
      "-rename-fields",
      renames.join(","),
      "-o",
      "borders.json",
      "format=geojson",
      "precision=0.002",
      // One label point per polity, placed well inside the shape. Labels only need
      // the name and area; everything else lives on the border features.
      "-points",
      "inner",
      "-filter-fields",
      "name,area",
      "-o",
      "labels.json",
      "format=geojson",
      "precision=0.01",
    ],
    { "in.json": raw },
  );

  const borders = outputFile(out, "borders.json");
  const labels = outputFile(out, "labels.json");
  await writeFile(join(OUT_DIR, "borders", `${id}.json`), borders);
  await writeFile(join(OUT_DIR, "labels", `${id}.json`), labels);

  const polities = (JSON.parse(labels) as FeatureCollection<PolityProps>).features.map((f) => f.properties);
  return { id, year: yearOf(id), bytes: borders.length, polities };
}

async function buildLand() {
  const require = (await import("node:module")).createRequire(import.meta.url);
  const topo = require("world-atlas/land-50m.json") as Topology<{ land: GeometryCollection }>;
  const geo = JSON.stringify(feature(topo, topo.objects.land));
  const out = await mapshaper.applyCommands(
    [
      "-i",
      "land.json",
      "-simplify",
      "50%",
      "keep-shapes",
      "-o",
      "land.json",
      "format=geojson",
      "precision=0.01",
    ],
    { "land.json": geo },
  );
  await writeFile(join(OUT_DIR, "land.json"), outputFile(out, "land.json"));
}

function outputFile(out: Record<string, string>, name: string): string {
  const file = out[name];
  if (file === undefined) throw new Error(`mapshaper produced no ${name}`);
  return file;
}

/** Runs `fn` over `items` with at most `limit` in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true });
  await rm(join(OUT_DIR, "borders"), { recursive: true, force: true });
  await rm(join(OUT_DIR, "labels"), { recursive: true, force: true });
  await mkdir(join(OUT_DIR, "borders"), { recursive: true });
  await mkdir(join(OUT_DIR, "labels"), { recursive: true });

  const snapshots = await mapLimit(SNAPSHOTS, 4, async (id) => {
    const s = await buildSnapshot(id);
    console.log(
      `${id.padStart(8)}  ${String(s.polities.length).padStart(4)} polities  ${(s.bytes / 1024).toFixed(0).padStart(5)} KB`,
    );
    return s;
  });
  snapshots.sort((a, b) => a.year - b.year);

  // Search index: every polity name with the snapshots it appears in.
  const index = new Map<string, { name: string; years: number[]; wiki?: string }>();
  for (const s of snapshots) {
    for (const p of s.polities) {
      const entry = index.get(p.name) ?? { name: p.name, years: [] };
      entry.years.push(s.year);
      entry.wiki ??= p.wiki || undefined;
      index.set(p.name, entry);
    }
  }

  await writeFile(
    join(OUT_DIR, "index.json"),
    JSON.stringify({
      source: {
        repo: BASEMAPS_REPO,
        commit: BASEMAPS_COMMIT,
        license: "GPL-3.0",
      },
      snapshots: snapshots.map(({ id, year, polities }) => ({ id, year, count: polities.length })),
    }),
  );
  await writeFile(
    join(OUT_DIR, "search.json"),
    JSON.stringify([...index.values()].sort((a, b) => b.years.length - a.years.length)),
  );

  await buildLand();

  const totalKb = snapshots.reduce((sum, s) => sum + s.bytes, 0) / 1024;
  console.log(
    `\n${snapshots.length} snapshots, ${index.size} polities, ${totalKb.toFixed(0)} KB of borders.`,
  );
}

await main();
