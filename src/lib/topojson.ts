import { addProtocol, importScriptInWorkers } from "maplibre-gl";
import { loadTopology, PROTOCOL } from "./topojson-protocol.mjs";
// Emitted as a separate, content-hashed file that MapLibre's workers import as it is.
import protocolScript from "./topojson-protocol.mjs?url";

let registration: Promise<void> | null = null;

/**
 * Teaches MapLibre to load "topojson://" URLs: in its workers, where the heavy decoding belongs,
 * and on the page, which workers fall back to if they couldn't load the script.
 */
export function registerTopoJsonProtocol(): Promise<void> {
  registration ??= (async () => {
    addProtocol(PROTOCOL, loadTopology);
    try {
      await importScriptInWorkers(new URL(protocolScript, document.baseURI).href);
    } catch (error) {
      // Borders still load, decoded on the page instead.
      console.warn("TopoJSON decoding falls back to the page:", error);
    }
  })();
  return registration;
}
