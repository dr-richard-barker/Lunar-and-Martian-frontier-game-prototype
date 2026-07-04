# Lunar & Martian Frontier

A standalone sandbox colony-building game that blends **SimCity**, **Settlers of
Catan**, and **Civilization** — on the Moon. Grow a settlement outward from your
Colony Hub on a 3D hexagonal board with CSS-3D buildings, dice-driven resource
surges, and worker rovers that physically drive out and construct everything.

Runs entirely in the browser with **no API keys, no external services, and no network
dependencies** — everything (events, simulation, flavor text) is generated locally.

## ▶️ Play Online

**https://dr-richard-barker.github.io/Lunar-and-Martian-frontier-game-prototype/**

The site is published automatically with GitHub Pages — every push to `main`
rebuilds and redeploys the game (see [Deploying](#deploying-the-website) below).
Best played on a desktop browser with a mouse.

## How to Play

- **⚔️ Rival colonies** — up to three AI factions land alongside you, each building
  its own city, rail network, and rover fleet in its own colors: the gold
  **Meridian Trade Guild** (traders — rush He-3 exports), the crimson **Helios
  Racing Syndicate** (racers — sprawling rail and big fleets), and the green
  **Verdant Order** (agrarians — greenhouses and population booms). A scoreboard
  tracks every colony; 🚀 NEW COLONY opens an expedition dialog to pick the map
  size (61 / 91 / 127 tiles) and how many rivals land.

- **The Colony Hub (Civ-style)** — click the central city to open its production
  panel. Train **Worker Rovers** (each crewed by a colonist) and charter
  **Colonist Shuttles** from Earth. Production takes sols and runs as a queue.
- **Worker Rovers** — nothing builds itself. When you order a structure, the nearest
  idle rover drives across the hexes (around craters) and erects it over several sols.
- **Catan-style yields** — every tile carries a number token (2–12, red 6/8). Two dice
  roll each sol; tiles matching the roll **surge and yield double**. A roll of 7
  courts a colony event: solar flares, meteorite showers, supply capsules...
- **Maglev network (Catan roads)** — structures only operate **next to the
  Colony Hub or a connected 🛤️ Maglev Track**. Lay cheap track segments outward
  to reach the ice, ore, and helium-3 your economy needs; cut the line and
  everything downstream goes OFFLINE. Rovers ride the rails at higher speed.
- **SimCity survival loop** — colonists consume food, water, and oxygen every sol and
  pay taxes. Ice Extractors make water; Oxygenators and Greenhouses turn it into air
  and food; Habitats add housing. If demand outstrips the power grid, everything
  throttles — build more Solar Arrays (they shine on 💎 silicate flats).
- **Terrain** — 🌑 regolith (open construction), ❄️ ice deposits, 🌋 ore veins,
  💎 silicate flats, ⚡ helium-3 fields, ☄️ craters (unbuildable and impassable).
- **Camera** — drag to orbit, scroll to zoom.
- **🤖 Autoplay** — hit AUTOPLAY and watch the base build itself: an AI director
  prioritizes power, water, oxygen, food, housing, then industry, dispatches
  rovers, and orders shuttles while the camera slowly orbits the colony.
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

The production bundle in `dist/` is fully static and uses relative asset paths —
host it on any web server (GitHub Pages, Netlify, a USB stick...), in any
subdirectory, or even open it from disk.

## Deploying the Website

The repo ships with a GitHub Actions workflow
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) that builds the
game and publishes it to **GitHub Pages** on every push to `main`.

One-time setup (repo admin):

1. Open **Settings → Pages** on GitHub.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or run the *Deploy to GitHub Pages* workflow manually from
   the **Actions** tab).

The game goes live at
`https://<your-username>.github.io/Lunar-and-Martian-frontier-game-prototype/`
about a minute later. No secrets, tokens, or environment variables are needed —
the build is fully self-contained.

### Hosting anywhere else

Because the build is static with relative paths, any host works:

```bash
npm run build   # then upload the contents of dist/
```

- **Netlify / Vercel / Cloudflare Pages**: point the build command at
  `npm run build` and the output directory at `dist`.
- **Any web server**: copy `dist/` into the web root (or any subfolder).

## Tech

React 19 + TypeScript + Vite + Tailwind CSS 4. The 3D board is pure CSS 3D transforms —
no WebGL, no game engine. Originally prototyped in Google AI Studio; the Gemini API
dependency has been removed and replaced with local content tables.
