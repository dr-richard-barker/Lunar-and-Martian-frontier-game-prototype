import * as THREE from 'three';
import { TerrainType } from '../types';

/**
 * Procedural lunar surface textures, generated at runtime on 2D canvas —
 * photoreal-leaning regolith with impact craters, baked as color + bump
 * maps. Zero downloads: the game stays fully offline.
 */

/** Deterministic RNG so terrain looks the same every session. */
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rand = () => number;

/** Consistent sun azimuth for all baked crater shading. */
const LIGHT_ANGLE = -2.35;

function drawCrater(color: CanvasRenderingContext2D, bump: CanvasRenderingContext2D, cx: number, cy: number, r: number, rand: Rand) {
  // Bowl shadow
  const bowl = color.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
  const depth = 0.3 + rand() * 0.3;
  bowl.addColorStop(0, `rgba(12,14,20,${depth})`);
  bowl.addColorStop(0.55, `rgba(12,14,20,${depth * 0.5})`);
  bowl.addColorStop(0.85, 'rgba(12,14,20,0.05)');
  bowl.addColorStop(1, 'rgba(0,0,0,0)');
  color.fillStyle = bowl;
  color.beginPath();
  color.arc(cx, cy, r, 0, Math.PI * 2);
  color.fill();

  // Rim highlight on the far side of the sun, shadow crescent on the near side
  color.lineCap = 'round';
  color.strokeStyle = `rgba(238,241,248,${0.16 + rand() * 0.14})`;
  color.lineWidth = Math.max(1.2, r * 0.16);
  color.beginPath();
  color.arc(cx, cy, r * 0.94, LIGHT_ANGLE + Math.PI - 1.15, LIGHT_ANGLE + Math.PI + 1.15);
  color.stroke();
  color.strokeStyle = `rgba(0,0,0,${0.12 + rand() * 0.1})`;
  color.lineWidth = Math.max(1.2, r * 0.22);
  color.beginPath();
  color.arc(cx, cy, r * 0.7, LIGHT_ANGLE - 1.0, LIGHT_ANGLE + 1.0);
  color.stroke();

  // Bump: low floor, raised rim
  const pit = bump.createRadialGradient(cx, cy, r * 0.05, cx, cy, r * 0.82);
  pit.addColorStop(0, 'rgba(30,30,30,0.75)');
  pit.addColorStop(0.75, 'rgba(30,30,30,0.25)');
  pit.addColorStop(1, 'rgba(0,0,0,0)');
  bump.fillStyle = pit;
  bump.beginPath();
  bump.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  bump.fill();
  bump.strokeStyle = 'rgba(225,225,225,0.6)';
  bump.lineWidth = Math.max(1.5, r * 0.17);
  bump.beginPath();
  bump.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
  bump.stroke();
}

interface LunarOpts {
  size: number;
  base: string;
  seed: number;
  craters: number;
  craterMin: number;
  craterMax: number;
  /** Optional mineral accent pass drawn before craters. */
  accents?: (ctx: CanvasRenderingContext2D, rand: Rand, size: number) => void;
}

function lunarMaps({ size, base, seed, craters, craterMin, craterMax, accents }: LunarOpts) {
  const rand = mulberry32(seed);
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = size;
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = bumpCanvas.height = size;
  const c = colorCanvas.getContext('2d')!;
  const b = bumpCanvas.getContext('2d')!;

  c.fillStyle = base;
  c.fillRect(0, 0, size, size);
  b.fillStyle = '#808080';
  b.fillRect(0, 0, size, size);

  // Large-scale albedo mottling
  for (let i = 0; i < 42; i++) {
    const x = rand() * size, y = rand() * size, r = size * (0.06 + rand() * 0.16);
    const dark = rand() > 0.5;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, dark ? `rgba(10,12,18,${0.05 + rand() * 0.08})` : `rgba(240,242,248,${0.03 + rand() * 0.06})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  accents?.(c, rand, size);

  // Impact craters (drawn small-over-large for realistic layering)
  for (let i = 0; i < craters; i++) {
    const t = rand();
    const r = size * (craterMin + (craterMax - craterMin) * t * t);
    drawCrater(c, b, rand() * size, rand() * size, r, rand);
  }

  // Regolith grain speckle
  for (let i = 0; i < size * 14; i++) {
    const x = rand() * size, y = rand() * size, s = rand() < 0.85 ? 1 : 2;
    const bright = rand() > 0.5;
    c.fillStyle = bright
      ? `rgba(238,241,248,${0.04 + rand() * 0.1})`
      : `rgba(8,10,16,${0.05 + rand() * 0.12})`;
    c.fillRect(x, y, s, s);
    b.fillStyle = bright ? 'rgba(210,210,210,0.35)' : 'rgba(60,60,60,0.35)';
    b.fillRect(x, y, s, s);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  const bump = new THREE.CanvasTexture(bumpCanvas);
  map.anisotropy = 8;
  bump.anisotropy = 4;
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bump };
}

// --- Mineral accent passes ---

const iceAccents = (c: CanvasRenderingContext2D, rand: Rand, size: number) => {
  for (let i = 0; i < 15; i++) {
    const x = rand() * size, y = rand() * size, r = size * (0.04 + rand() * 0.1);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(224,242,254,${0.25 + rand() * 0.3})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  c.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    c.strokeStyle = `rgba(240,249,255,${0.18 + rand() * 0.2})`;
    c.lineWidth = 1 + rand() * 2;
    const x = rand() * size, y = rand() * size, a = rand() * Math.PI, l = size * (0.1 + rand() * 0.2);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }
};

const oreAccents = (c: CanvasRenderingContext2D, rand: Rand, size: number) => {
  c.lineCap = 'round';
  for (let i = 0; i < 11; i++) {
    let x = rand() * size, y = rand() * size;
    let a = rand() * Math.PI * 2;
    c.strokeStyle = `rgba(214,93,32,${0.3 + rand() * 0.3})`;
    c.lineWidth = 1.5 + rand() * 2.5;
    c.beginPath();
    c.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      a += (rand() - 0.5) * 1.4;
      x += Math.cos(a) * size * 0.05;
      y += Math.sin(a) * size * 0.05;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  for (let i = 0; i < 26; i++) {
    const x = rand() * size, y = rand() * size, r = 1.5 + rand() * 3.5;
    c.fillStyle = `rgba(249,115,22,${0.25 + rand() * 0.35})`;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  }
};

const silicateAccents = (c: CanvasRenderingContext2D, rand: Rand, size: number) => {
  for (let i = 0; i < 300; i++) {
    const x = rand() * size, y = rand() * size;
    c.fillStyle = `rgba(253,230,138,${0.12 + rand() * 0.3})`;
    c.fillRect(x, y, 1 + rand() * 1.6, 1 + rand() * 1.6);
  }
  for (let i = 0; i < 8; i++) {
    const x = rand() * size, y = rand() * size, r = size * (0.05 + rand() * 0.08);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(250,204,21,${0.1 + rand() * 0.12})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
};

const he3Accents = (c: CanvasRenderingContext2D, rand: Rand, size: number) => {
  c.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    let x = rand() * size, y = rand() * size;
    let a = rand() * Math.PI * 2;
    c.strokeStyle = `rgba(167,139,250,${0.28 + rand() * 0.3})`;
    c.lineWidth = 1.5 + rand() * 2;
    c.beginPath();
    c.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      a += (rand() - 0.5) * 1.1;
      x += Math.cos(a) * size * 0.045;
      y += Math.sin(a) * size * 0.045;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const x = rand() * size, y = rand() * size, r = size * (0.03 + rand() * 0.07);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(217,70,239,${0.12 + rand() * 0.15})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
};

// --- Terrain material factory ---

/** Realistic regolith base tones (UI accent colors stay in TERRAIN_STYLES). */
const TERRAIN_SURFACE_3D: Record<TerrainType, {
  base: string; side: string; rough: number; metal: number;
  craters: number; accents?: LunarOpts['accents'];
}> = {
  [TerrainType.REGOLITH]: { base: '#8b8e96', side: '#565962', rough: 0.95, metal: 0.02, craters: 26 },
  [TerrainType.ICE]: { base: '#a8c4d6', side: '#5f7889', rough: 0.45, metal: 0.05, craters: 16, accents: iceAccents },
  [TerrainType.ORES]: { base: '#7d5843', side: '#4a3428', rough: 0.85, metal: 0.15, craters: 20, accents: oreAccents },
  [TerrainType.SILICATES]: { base: '#a8946e', side: '#645741', rough: 0.7, metal: 0.3, craters: 18, accents: silicateAccents },
  [TerrainType.HE3]: { base: '#6b6178', side: '#413a4c', rough: 0.85, metal: 0.1, craters: 20, accents: he3Accents },
  [TerrainType.CRATER]: { base: '#4e5058', side: '#2e3038', rough: 0.98, metal: 0, craters: 46 },
};

export type TileMaterials = [THREE.Material, THREE.Material, THREE.Material]; // [side, top, bottom]

/** Two texture variants per terrain; combined with per-tile 60-degree
 * rotations this gives ~12 distinct-looking surfaces per type. */
export function buildTerrainMaterials(): Record<TerrainType, TileMaterials[]> {
  const bottom = new THREE.MeshStandardMaterial({ color: '#14181f', roughness: 1 });
  const out = {} as Record<TerrainType, TileMaterials[]>;
  (Object.keys(TERRAIN_SURFACE_3D) as TerrainType[]).forEach((terrain, ti) => {
    const cfg = TERRAIN_SURFACE_3D[terrain];
    const side = new THREE.MeshStandardMaterial({ color: cfg.side, roughness: 0.9, metalness: 0.05, flatShading: true });
    out[terrain] = [0, 1].map(variant => {
      const { map, bump } = lunarMaps({
        size: 512,
        base: cfg.base,
        seed: 1337 + ti * 97 + variant * 31,
        craters: cfg.craters,
        craterMin: 0.015,
        craterMax: 0.11,
        accents: cfg.accents,
      });
      const top = new THREE.MeshStandardMaterial({
        map,
        bumpMap: bump,
        bumpScale: 0.5,
        roughness: cfg.rough,
        metalness: cfg.metal,
      });
      return [side, top, bottom] as TileMaterials;
    });
  });
  return out;
}

/** The big photoreal moon disc the board floats over. */
export function buildMoonFloorMaterial(): THREE.MeshStandardMaterial {
  const size = 1024;
  const rand = mulberry32(20260703);
  const { map, bump } = lunarMaps({
    size,
    base: '#75777e',
    seed: 424242,
    craters: 120,
    craterMin: 0.006,
    craterMax: 0.075,
    accents: (c) => {
      // Lunar maria — vast dark basalt plains
      for (let i = 0; i < 7; i++) {
        const x = rand() * size, y = rand() * size, r = size * (0.12 + rand() * 0.22);
        const g = c.createRadialGradient(x, y, r * 0.2, x, y, r);
        g.addColorStop(0, `rgba(38,40,48,${0.3 + rand() * 0.2})`);
        g.addColorStop(0.7, `rgba(38,40,48,${0.15 + rand() * 0.1})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // A couple of bright ray systems
      for (let i = 0; i < 2; i++) {
        const x = rand() * size, y = rand() * size;
        for (let ray = 0; ray < 9; ray++) {
          const a = rand() * Math.PI * 2, l = size * (0.1 + rand() * 0.2);
          c.strokeStyle = `rgba(235,238,245,${0.05 + rand() * 0.07})`;
          c.lineWidth = 2 + rand() * 5;
          c.beginPath();
          c.moveTo(x, y);
          c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
          c.stroke();
        }
      }
    },
  });
  return new THREE.MeshStandardMaterial({
    map,
    bumpMap: bump,
    bumpScale: 0.8,
    roughness: 0.97,
    metalness: 0,
  });
}
