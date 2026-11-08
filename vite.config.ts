/// <reference types="vitest/config" />
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the build works on GitHub Pages under /epochmap/ and on any other host.
  base: "./",
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
