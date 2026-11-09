<p align="center">
  <img src="public/favicon.svg" width="72" height="72" alt="" />
</p>

<h1 align="center">Epochmap</h1>

<p align="center">
  <b>An interactive atlas of world history.</b><br />
  The political map of the world for every year from 0 to 2026, on a 3D globe.
</p>

<p align="center">
  <a href="https://berkanatik.github.io/epochmap/"><b>Open the live atlas →</b></a>
</p>

<p align="center">
  <a href="https://github.com/BerkanAtik/epochmap/actions/workflows/ci.yml"><img src="https://github.com/BerkanAtik/epochmap/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/code-MIT-e8c98a" alt="Code: MIT" /></a>
  <a href="public/data/LICENSE.md"><img src="https://img.shields.io/badge/data-CC%20BY--NC--SA%204.0-0a1526" alt="Data: CC BY-NC-SA 4.0" /></a>
  <a href="README.tr.md"><img src="https://img.shields.io/badge/Türkçe-README-0a1526" alt="Türkçe README" /></a>
</p>

![The world in 1914 on Epochmap's globe](docs/hero.png)

## Features

- **Every year from 0 to 2026.** Drag the timeline, type a year, or jump straight to the next border change.
- **Play history** at 10, 25 or 50 years a second and watch empires grow, split and disappear.
- **Research-grade borders** from three academic and open datasets, cross-checked and corrected by hand (see [How accurate is it?](#how-accurate-is-it)).
- **A real globe.** NASA's Blue Marble satellite imagery sits under the political map, and coastlines line up with it.
- **Colours that work.** Neighbouring countries never share a colour (0 clashes across 4,600 neighbour pairs), a country keeps its colour through the centuries, and colonies wear their empire's colour.
- **Disputed territories** such as Crimea, Kashmir, Western Sahara and Northern Cyprus are hatched, with a neutral note on who administers and who claims them.
- **Click anything** for its Wikipedia summary, the years it existed and the empire it belonged to.
- **Search** 1,380 polities in English or Turkish with <kbd>Ctrl</kbd> <kbd>K</kbd> / <kbd>⌘</kbd> <kbd>K</kbd>.
- **English and Turkish**, switchable at any time, including the names on the map.
- **Shareable links** that keep the year, the selection, the language and the camera.
- A static site: no backend, no API keys, no tracking.

![The Ottoman Empire in 1453, with the info panel open](docs/detail.png)

## Keyboard shortcuts

| Key                                                                     | Action                        |
| ----------------------------------------------------------------------- | ----------------------------- |
| <kbd>←</kbd> <kbd>→</kbd>                                               | One year back / forward       |
| <kbd>Shift</kbd> + <kbd>←</kbd> <kbd>→</kbd>                            | Ten years back / forward      |
| <kbd>PgUp</kbd> <kbd>PgDn</kbd>                                         | Previous / next border change |
| <kbd>Space</kbd>                                                        | Play / pause                  |
| <kbd>Ctrl</kbd> <kbd>K</kbd>, <kbd>⌘</kbd> <kbd>K</kbd> or <kbd>/</kbd> | Search                        |
| <kbd>Esc</kbd>                                                          | Close the info panel          |

## How accurate is it?

No dataset covers 2,000 years well on its own, so each period uses the best open source for it:

| Years     | Borders                                                                                                                             | Why                                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0–1885    | [Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria) (Seshat Global History Databank, _Scientific Data_ 2025) | Peer-reviewed, about 1,600 polities with year-by-year shapes.                                          |
| 1886–2013 | [CShapes 2.0](https://icr.ethz.ch/data/cshapes/) (ETH Zürich)                                                                       | The political-science standard: legally recognised borders of states _and_ colonies, dated to the day. |
| 2014–2026 | [Natural Earth](https://www.naturalearthdata.com/) 1:10m                                                                            | Detailed present-day borders showing the situation on the ground.                                      |

On top of that, the build:

- **names each year correctly.** For 1886–2013 the name comes from the Cliopatria polity at the same place, so the map shows the Ottoman Empire until 1923 and the Republic of Turkey from 1924. Colonies join their empire.
- **tells states from colonies** with Gleditsch & Ward's list of independent states, so an independent country is never drawn as part of another country's sphere of influence.
- **fixes known errors in the sources.** Examples: Cliopatria kept Constantinople Byzantine until 1467, kept Algeria French until 2023 and tagged the Roman Empire with the Byzantine Empire's Wikidata id. Every correction is listed, with a reason, in [`scripts/sources.ts`](scripts/sources.ts). Running `npm run data -- report` prints the checks that found them.

Borders are still simplified for a world-scale map, and historical boundaries were often fluid or contested. If you spot a mistake, please [open an issue](https://github.com/BerkanAtik/epochmap/issues).

## How it works

**Data pipeline** ([`scripts/build-data.ts`](scripts/build-data.ts)). It downloads every source at a pinned version and merges the three eras into one list of shapes, each valid from one year to another. [mapshaper](https://github.com/mbloch/mapshaper) then:

1. clips historical shapes to the coastline,
2. simplifies them while keeping shared borders identical,
3. finds a label point inside each shape.

Names and Turkish translations come from Wikidata. The years are split into 19 windows of similar size, each stored as TopoJSON so borders shared between neighbours and between years are stored once. The full 2,000 years come to 23 MB.

**Colours.** The build reads which polities share an edge in the topology, weighted by how many years they coexist. It then colours this graph greedily: the most connected polities pick first, and each takes the colour its coloured neighbours use least.

**Rendering** ([`src/components/GlobeMap.tsx`](src/components/GlobeMap.tsx)). MapLibre GL JS 6 draws the globe. The year and the language are MapLibre _global state_. Each shape carries its own year range, and a style filter compares it with the global year, so moving the slider re-filters the map instantly without reloading data. Playback runs at 50 frames a second even at 50 years a second. When the year enters another window, the new window loads into a second layer stack and the two cross-fade.

**Labels without a glyph server.** MapLibre draws text with the page's own fonts when a style has no `glyphs` URL, and reads the weight from the family name. So the variable Fraunces font is registered as "… Semibold" and "… Semibold Italic".

## Tech stack

React 19 with the React Compiler · TypeScript 7 · Vite 8 (Rolldown) · Tailwind CSS 4 · MapLibre GL JS 6 · Motion · Biome · Vitest · GitHub Actions and Pages

## Running locally

You need Node.js 22.12 or newer.

```bash
git clone https://github.com/BerkanAtik/epochmap.git
cd epochmap
npm install
npm run dev
```

| Script          | What it does                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------- |
| `npm run dev`   | Start the dev server                                                                         |
| `npm run build` | Type-check and build the static site into `dist/`                                            |
| `npm test`      | Run the unit tests                                                                           |
| `npm run check` | Lint and format check (Biome)                                                                |
| `npm run data`  | Rebuild `public/data` from the sources (about a minute; add `-- report` for the data checks) |

## Roadmap

- Battles, treaties and capitals from Wikidata, shown on the globe in their year
- Smoother morphing of borders between years
- More interface languages

## Contributing

Issues and pull requests are welcome. Corrections to borders or names usually belong in [`scripts/sources.ts`](scripts/sources.ts). Please run `npm run check`, `npm run typecheck` and `npm test` before opening a pull request.

## License

The code is under the [MIT License](LICENSE). The map data in `public/data` is derived from the sources above and is under [CC BY-NC-SA 4.0](public/data/LICENSE.md), because CShapes requires it. Satellite imagery: NASA Blue Marble via GIBS (public domain). Summaries: Wikipedia (CC BY-SA).
