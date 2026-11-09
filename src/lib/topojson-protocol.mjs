/**
 * A "topojson://" protocol for MapLibre. It fetches a TopoJSON file and hands MapLibre the
 * decoded GeoJSON, inside MapLibre's web workers (loaded with `importScriptInWorkers`), so the
 * big border files are downloaded, parsed and decoded without blocking the page. URLs look like
 *
 *   topojson://data/<encoded file URL>            every object in the file
 *   topojson://data/<encoded file URL>#lakes      one named object
 *
 * The file URL is encoded because MapLibre normalises URLs, which would turn
 * "topojson://https://…" into "topojson://https//…".
 *
 * Plain JavaScript without imports, so that workers can load it as it is. The page imports it
 * too, as a fallback in case the workers can't.
 */

export const PROTOCOL = "topojson";

/** The URL MapLibre should load for a TopoJSON file, optionally picking one named object. */
export function topojsonUrl(fileUrl, objectName) {
  return `${PROTOCOL}://data/${encodeURIComponent(fileUrl)}${objectName ? `#${encodeURIComponent(objectName)}` : ""}`;
}

/** Decodes the polygons of a TopoJSON topology (quantized or not) into a GeoJSON FeatureCollection. */
export function topologyToGeoJSON(topology, objectName) {
  const transform = topology.transform;
  const arcs = topology.arcs.map((arc) => {
    if (!transform) return arc;
    // Quantized arcs store their first position, then the difference to the one before.
    const [sx, sy] = transform.scale;
    const [tx, ty] = transform.translate;
    let x = 0;
    let y = 0;
    return arc.map((position) => {
      x += position[0];
      y += position[1];
      return [x * sx + tx, y * sy + ty];
    });
  });

  const ring = (indexes) => {
    const points = [];
    for (const index of indexes) {
      // A negative index (~i) means arc i, walked backwards.
      const arc = arcs[index < 0 ? ~index : index];
      const part = index < 0 ? arc.slice().reverse() : arc;
      // Consecutive arcs share the position where they join.
      if (points.length > 0) points.pop();
      for (const position of part) points.push(position);
    }
    // A ring made of one two-position arc: close it (topojson-client does the same).
    if (points.length > 0 && points.length < 4) points.push(points[0]);
    return points;
  };
  const polygon = (rings) => rings.map(ring);

  const objects = objectName === undefined ? Object.values(topology.objects) : [topology.objects[objectName]];
  const features = [];
  for (const object of objects) {
    if (!object) continue;
    for (const geometry of object.type === "GeometryCollection" ? object.geometries : [object]) {
      let decoded = null;
      if (geometry.type === "Polygon") decoded = { type: "Polygon", coordinates: polygon(geometry.arcs) };
      else if (geometry.type === "MultiPolygon") {
        decoded = { type: "MultiPolygon", coordinates: geometry.arcs.map(polygon) };
      }
      if (decoded)
        features.push({ type: "Feature", properties: geometry.properties ?? {}, geometry: decoded });
    }
  }
  return { type: "FeatureCollection", features };
}

/** MapLibre protocol handler for the URLs made by `topojsonUrl`. */
export async function loadTopology(params, abortController) {
  const url = new URL(params.url);
  const fileUrl = decodeURIComponent(url.pathname.slice(1));
  const objectName = url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined;
  const response = await fetch(fileUrl, { signal: abortController?.signal });
  if (!response.ok) throw new Error(`${fileUrl}: HTTP ${response.status}`);
  return { data: topologyToGeoJSON(await response.json(), objectName) };
}

/**
 * MapLibre sends data it loaded from a URL back to the page (copying it twice on the way), for
 * `GeoJSONSource.getData`. The page never reads these shapes, so for this protocol's URLs the
 * copy stays in the worker. This wraps a MapLibre internal: if it ever changes, nothing
 * breaks, the data simply travels back to the page as before.
 */
function keepDataInWorker(worker) {
  if (typeof worker?._getWorkerSource !== "function" || worker.epochmapPatched) return;
  worker.epochmapPatched = true;
  const getWorkerSource = worker._getWorkerSource;
  worker._getWorkerSource = function (...args) {
    const source = getWorkerSource.apply(this, args);
    if (typeof source?.loadData === "function" && !source.epochmapPatched) {
      source.epochmapPatched = true;
      const loadData = source.loadData;
      source.loadData = async function (params) {
        const result = await loadData.call(this, params);
        if (result && params?.request?.url?.startsWith(`${PROTOCOL}://`)) delete result.data;
        return result;
      };
    }
    return source;
  };
}

// Inside a MapLibre worker, register right away. On the page this does nothing.
if (typeof self !== "undefined" && typeof self.addProtocol === "function") {
  self.addProtocol(PROTOCOL, loadTopology);
  keepDataInWorker(self.worker);
}
