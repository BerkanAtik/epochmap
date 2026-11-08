import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "maplibre-gl/dist/maplibre-gl.css";
import "./index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { lang } from "./lib/i18n";

document.documentElement.lang = lang;

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
