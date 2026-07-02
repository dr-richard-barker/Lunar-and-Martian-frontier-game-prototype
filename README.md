# Lunar & Martian Frontier

A standalone sandbox colony-building game — SimCity on the Moon. Build a self-sustaining
lunar settlement on a 3D hexagonal grid: generate power, extract water ice, grow food,
mine metal, export helium-3, and keep your colonists breathing.

Runs entirely in the browser with **no API keys, no external services, and no network
dependencies** — everything (events, simulation, flavor text) is generated locally.

## How to Play

- **Click a tile** to open the build menu for that sector. Terrain matters:
  - 🌑 **Regolith plains** — general construction
  - ❄️ **Ice deposits** — required for Ice Extractors (water)
  - 🌋 **Ore veins** — required for Mining Rigs (metal)
  - 💎 **Silicate flats** — Solar Arrays produce bonus power here
  - ⚡ **Helium-3 fields** — required for He-3 Extractors (credits)
  - ☄️ **Craters** — unbuildable
- **Drag** to orbit the camera, **scroll** to zoom.
- **Keep the loop alive**: colonists consume food, water, and oxygen every sol and pay
  taxes in return. Ice Extractors make water; Oxygenators and Greenhouses turn water
  into air and food. Habitats add housing — population grows while supplies hold.
- **Watch the power grid**: if consumption exceeds generation, every building is
  throttled. Build more Solar Arrays.
- **Random events** — solar flares, meteorite showers, supply capsules — strike from
  time to time. The frontier is not gentle.
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
