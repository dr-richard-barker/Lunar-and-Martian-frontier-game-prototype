# Lunar & Martian Frontier

A standalone sandbox colony-building game that blends **SimCity**, **Settlers of
Catan**, and **Civilization** — on the Moon. Grow a settlement outward from your
Colony Hub on a 3D hexagonal board with CSS-3D buildings, dice-driven resource
surges, and worker rovers that physically drive out and construct everything.

Runs entirely in the browser with **no API keys, no external services, and no network
dependencies** — everything (events, simulation, flavor text) is generated locally.

## How to Play

- **The Colony Hub (Civ-style)** — click the central city to open its production
  panel. Train **Worker Rovers** (each crewed by a colonist) and charter
  **Colonist Shuttles** from Earth. Production takes sols and runs as a queue.
- **Worker Rovers** — nothing builds itself. When you order a structure, the nearest
  idle rover drives across the hexes (around craters) and erects it over several sols.
- **Catan-style yields** — every tile carries a number token (2–12, red 6/8). Two dice
  roll each sol; tiles matching the roll **surge and yield double**. A roll of 7
  courts a colony event: solar flares, meteorite showers, supply capsules...
- **Settlement growth** — you can only build **adjacent to your existing colony**.
  Expand ring by ring toward the ice, ore, and helium-3 your economy needs.
- **SimCity survival loop** — colonists consume food, water, and oxygen every sol and
  pay taxes. Ice Extractors make water; Oxygenators and Greenhouses turn it into air
  and food; Habitats add housing. If demand outstrips the power grid, everything
  throttles — build more Solar Arrays (they shine on 💎 silicate flats).
- **Terrain** — 🌑 regolith (open construction), ❄️ ice deposits, 🌋 ore veins,
  💎 silicate flats, ⚡ helium-3 fields, ☄️ craters (unbuildable and impassable).
- **Camera** — drag to orbit, scroll to zoom.
- The game **autosaves** to your browser (localStorage). Use 💾 SAVE anytime, or
  🚀 NEW COLONY to start over. Time controls: pause, 1×, 2×, 4×.

## Run Locally

**Prerequisites:** Node.js 18+

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Build for Production

```bash
npm run build
npm run preview
```

The production bundle in `dist/` is fully static — host it on any web server
(GitHub Pages, Netlify, a USB stick...).

## Tech

React 19 + TypeScript + Vite + Tailwind CSS 4. The 3D board is pure CSS 3D transforms —
no WebGL, no game engine. Originally prototyped in Google AI Studio; the Gemini API
dependency has been removed and replaced with local content tables.
