/// <reference types="vitest/config" />
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * A short hash of everything in public/data. Data URLs carry it, so a page never mixes files
 * from two data builds (GitHub Pages caches files for 10 minutes, and window names change).
 */
function dataVersion(dir = "public/data"): string {
  const hash = createHash("sha1");
  const walk = (folder: string) => {
    for (const name of readdirSync(folder).sort()) {
      const path = join(folder, name);
      if (statSync(path).isDirectory()) walk(path);
      else hash.update(name).update(readFileSync(path));
    }
  };
  if (existsSync(dir)) walk(dir);
  return hash.digest("hex").slice(0, 10);
}

export default defineConfig({
  // Relative base so the build works on GitHub Pages under /epochmap/ and on any other host.
  base: "./",
  define: { __DATA_VERSION__: JSON.stringify(dataVersion()) },
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  build: {
    target: "es2023",
    // MapLibre alone is ~1 MB minified; it gets its own long-cached chunk.
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: "maplibre", test: /node_modules[\\/]maplibre-gl/ }],
        },
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
