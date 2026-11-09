import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { AddProtocolAction } from "maplibre-gl";

export declare const PROTOCOL: string;
export declare function topojsonUrl(fileUrl: string, objectName?: string): string;
export declare function topologyToGeoJSON(
  topology: unknown,
  objectName?: string,
): FeatureCollection<Polygon | MultiPolygon, Record<string, unknown>>;
export declare const loadTopology: AddProtocolAction;
