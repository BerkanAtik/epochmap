import type { FeatureCollection, LineString } from "geojson";

/**
 * Latitude/longitude grid lines. Points are densified every 2° so the lines
 * follow the curve of the globe instead of cutting straight through it.
 */
export function graticule(step = 30, latStep = 15): FeatureCollection<LineString> {
  const features: FeatureCollection<LineString>["features"] = [];
  const range = (from: number, to: number, by: number) =>
    Array.from({ length: Math.floor((to - from) / by) + 1 }, (_, i) => from + i * by);

  for (const lng of range(-180, 180 - step, step)) {
    features.push({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: range(-80, 80, 2).map((lat) => [lng, lat]) },
    });
  }
  for (const lat of range(-75, 75, latStep)) {
    features.push({
      type: "Feature",
      properties: { equator: lat === 0 },
      geometry: { type: "LineString", coordinates: range(-180, 180, 2).map((lng) => [lng, lat]) },
    });
  }
  return { type: "FeatureCollection", features };
}
