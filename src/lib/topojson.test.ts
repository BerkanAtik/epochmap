import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import { describe, expect, it } from "vitest";
import { loadTopology, topojsonUrl, topologyToGeoJSON } from "./topojson-protocol.mjs";

// Two squares sharing an edge, quantized, with arcs walked in both directions.
const topology = {
  type: "Topology",
  transform: { scale: [0.5, 0.25], translate: [10, 20] },
  objects: {
    countries: {
      type: "GeometryCollection",
      geometries: [
        { type: "Polygon", arcs: [[0, 1]], properties: { id: "A", c: 3 } },
        { type: "MultiPolygon", arcs: [[[~1, 2]], [[3]]], properties: { id: "B", c: 1 } },
        { type: "Point", coordinates: [1, 1] },
      ],
    },
    lakes: { type: "GeometryCollection", geometries: [{ type: "Polygon", arcs: [[3]] }] },
  },
  arcs: [
    [
      [0, 0],
      [0, 4],
    ],
    [
      [0, 4],
      [2, 0],
      [0, -4],
    ],
    [
      [2, 0],
      [-2, 0],
    ],
    [
      [8, 8],
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ],
  ],
} as unknown as Topology;

describe("topologyToGeoJSON", () => {
  it("decodes polygons exactly like topojson-client", () => {
    for (const name of ["countries", "lakes"]) {
      const object = topology.objects[name];
      if (!object) throw new Error(name);
      const expected = feature(topology, object) as unknown as GeoJSON.FeatureCollection;
      const polygons = expected.features.filter((f) => f.geometry?.type.endsWith("Polygon"));
      const actual = topologyToGeoJSON(topology, name);
      expect(actual.features.map((f) => f.geometry)).toEqual(polygons.map((f) => f.geometry));
      expect(actual.features.map((f) => f.properties)).toEqual(polygons.map((f) => f.properties ?? {}));
    }
  });

  it("decodes every object when none is named", () => {
    expect(topologyToGeoJSON(topology).features).toHaveLength(3);
  });
});

describe("topojson protocol", () => {
  it("survives MapLibre's URL normalisation and picks the named object", async () => {
    const file = "https://example.com/epochmap/data/water.json?v=abc";
    const url = new URL(topojsonUrl(file, "lakes")).href; // what MapLibre hands the protocol
    const requested: string[] = [];
    const fetchMock = async (input: RequestInfo | URL) => {
      requested.push(String(input));
      return new Response(JSON.stringify(topology));
    };
    const original = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      const { data } = await loadTopology({ url }, new AbortController());
      expect(requested).toEqual([file]);
      expect((data as GeoJSON.FeatureCollection).features).toHaveLength(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
