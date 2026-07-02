import {
  GameState, HexData, TerrainType, BuildingType, ResourceKind, Stockpile, PowerReport, ColonyEvent,
} from '../types';
import {
  BUILDINGS, TERRAIN_STYLES, BOARD_RADIUS, SILICATE_SOLAR_BONUS, COLONIST_NEEDS, COLONIST_TAX,
  GROWTH_TICKS, DECLINE_TICKS, INITIAL_RESOURCES, INITIAL_POPULATION, MILESTONES,
} from '../constants';
import { rollEvent } from './events';

const EVENT_MIN_GAP = 12;      // minimum sols between events
const EVENT_CHANCE = 0.06;     // per-sol chance once past the gap

export function generateBoard(): HexData[] {
  const hexes: HexData[] = [];
  let id = 0;
  const weighted: TerrainType[] = [
    ...Array(34).fill(TerrainType.REGOLITH),
    ...Array(13).fill(TerrainType.ICE),
    ...Array(13).fill(TerrainType.ORES),
    ...Array(11).fill(TerrainType.SILICATES),
    ...Array(7).fill(TerrainType.HE3),
    ...Array(9).fill(TerrainType.CRATER),
  ];

  for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
    for (let r = Math.max(-BOARD_RADIUS, -q - BOARD_RADIUS); r <= Math.min(BOARD_RADIUS, -q + BOARD_RADIUS); r++) {
      const terrain = q === 0 && r === 0
        ? TerrainType.REGOLITH
        : weighted[Math.floor(Math.random() * weighted.length)];
      hexes.push({
        id: id++,
        q,
        r,
        terrain,
        building: q === 0 && r === 0 ? BuildingType.LANDER : null,
      });
    }
  }
  return hexes;
}

export function newGame(colonyName = 'FRONTIER BASE ALPHA'): GameState {
  return {
    colonyName,
    sol: 1,
    resources: { ...INITIAL_RESOURCES },
    population: INITIAL_POPULATION,
    board: generateBoard(),
    logs: ['[INIT] Descent complete. Landing site secured.', '[SYS] Colony management grid online.'],
    milestones: [],
    growthProgress: 0,
    declineProgress: 0,
    lastEventSol: 0,
  };
}

export function getPowerReport(board: HexData[]): PowerReport {
  let generated = 0;
  let consumed = 0;
  for (const hex of board) {
    if (!hex.building) continue;
    let power = BUILDINGS[hex.building].power;
    if (hex.building === BuildingType.SOLAR_ARRAY && hex.terrain === TerrainType.SILICATES) {
      power += SILICATE_SOLAR_BONUS;
    }
    if (power >= 0) generated += power;
    else consumed += -power;
  }
  const factor = consumed > generated ? (consumed > 0 ? generated / consumed : 1) : 1;
  return { generated, consumed, factor };
}

export function getHousing(board: HexData[]): number {
  return board.reduce((sum, hex) => sum + (hex.building ? (BUILDINGS[hex.building].housing ?? 0) : 0), 0);
}

export function countBuildings(board: HexData[]): number {
  return board.filter(h => h.building && h.building !== BuildingType.LANDER).length;
}

/** Net per-sol rate for each resource at current power efficiency — shown in the UI. */
export function getRates(state: GameState): Stockpile {
  const { factor } = getPowerReport(state.board);
  const rates: Stockpile = {
    [ResourceKind.CREDITS]: state.population * COLONIST_TAX,
    [ResourceKind.METAL]: 0,
    [ResourceKind.WATER]: 0,
    [ResourceKind.OXYGEN]: 0,
    [ResourceKind.FOOD]: 0,
  };
  for (const hex of state.board) {
    if (!hex.building) continue;
    const def = BUILDINGS[hex.building];
    for (const [kind, amount] of Object.entries(def.production ?? {})) {
      rates[kind as ResourceKind] += amount * factor;
    }
    for (const [kind, amount] of Object.entries(def.consumption ?? {})) {
      rates[kind as ResourceKind] -= amount * factor;
    }
  }
  for (const [kind, amount] of Object.entries(COLONIST_NEEDS)) {
    rates[kind as ResourceKind] -= amount * state.population;
  }
  return rates;
}

export function canBuild(state: GameState, hex: HexData, type: BuildingType): { ok: boolean; reason?: string } {
  const def = BUILDINGS[type];
  if (!def.buildable) return { ok: false, reason: 'Not constructible' };
  if (hex.building) return { ok: false, reason: 'Tile occupied' };
  if (!TERRAIN_STYLES[hex.terrain].buildable) return { ok: false, reason: 'Craters are unbuildable' };
  if (def.terrain && !def.terrain.includes(hex.terrain)) {
    return { ok: false, reason: `Requires ${def.terrain.map(t => TERRAIN_STYLES[t].label).join(' or ')}` };
  }
  if (def.unique && state.board.some(h => h.building === type)) {
    return { ok: false, reason: 'Already built (one per colony)' };
  }
  for (const [kind, amount] of Object.entries(def.cost)) {
    if (state.resources[kind as ResourceKind] < amount) {
      return { ok: false, reason: `Not enough ${kind.toLowerCase()}` };
    }
  }
  return { ok: true };
}

export function build(state: GameState, hexId: number, type: BuildingType): GameState {
  const hex = state.board.find(h => h.id === hexId);
  if (!hex) return state;
  const check = canBuild(state, hex, type);
  if (!check.ok) return state;

  const def = BUILDINGS[type];
  const resources = { ...state.resources };
  for (const [kind, amount] of Object.entries(def.cost)) {
    resources[kind as ResourceKind] -= amount;
  }
  return {
    ...state,
    resources,
    board: state.board.map(h => h.id === hexId ? { ...h, building: type } : h),
    logs: appendLog(state.logs, `${def.name} constructed in sector ${hexId}.`),
  };
}

export function demolish(state: GameState, hexId: number): GameState {
  const hex = state.board.find(h => h.id === hexId);
  if (!hex || !hex.building || hex.building === BuildingType.LANDER) return state;
  const def = BUILDINGS[hex.building];
  const resources = { ...state.resources };
  // Refund half the metal cost as salvage.
  const metalCost = def.cost[ResourceKind.METAL] ?? 0;
  resources[ResourceKind.METAL] += Math.floor(metalCost / 2);
  return {
    ...state,
    resources,
    board: state.board.map(h => h.id === hexId ? { ...h, building: null } : h),
    logs: appendLog(state.logs, `${def.name} demolished. Salvaged ${Math.floor(metalCost / 2)} metal.`),
  };
}

function appendLog(logs: string[], message: string): string[] {
  return [...logs, message].slice(-30);
}

export interface TickResult {
  state: GameState;
  event: ColonyEvent | null;
}

/** Advance the simulation by one sol. Pure — returns a new state. */
export function tick(state: GameState): TickResult {
  const { factor } = getPowerReport(state.board);
  const resources = { ...state.resources };
  let logs = state.logs;

  // Building production and consumption, throttled by power availability.
  for (const hex of state.board) {
    if (!hex.building) continue;
    const def = BUILDINGS[hex.building];
    // A converter only runs if its inputs are available.
    let inputScale = factor;
    for (const [kind, amount] of Object.entries(def.consumption ?? {})) {
      const available = resources[kind as ResourceKind];
      const needed = amount * factor;
      if (needed > 0) inputScale = Math.min(inputScale, factor * Math.min(1, available / needed));
    }
    for (const [kind, amount] of Object.entries(def.consumption ?? {})) {
      resources[kind as ResourceKind] = Math.max(0, resources[kind as ResourceKind] - amount * inputScale);
    }
    for (const [kind, amount] of Object.entries(def.production ?? {})) {
      resources[kind as ResourceKind] += amount * inputScale;
    }
  }

  // Colonist consumption and tax income.
  resources[ResourceKind.CREDITS] += state.population * COLONIST_TAX;
  let shortage = false;
  for (const [kind, amount] of Object.entries(COLONIST_NEEDS)) {
    const need = amount * state.population;
    const key = kind as ResourceKind;
    if (resources[key] < need) shortage = true;
    resources[key] = Math.max(0, resources[key] - need);
  }

  // Population dynamics.
  let population = state.population;
  let growthProgress = state.growthProgress;
  let declineProgress = state.declineProgress;
  const housing = getHousing(state.board);

  if (shortage) {
    growthProgress = 0;
    declineProgress += 1;
    if (declineProgress >= DECLINE_TICKS && population > 0) {
      population -= 1;
      declineProgress = 0;
      logs = appendLog(logs, '⚠ Life support shortage — a colonist has perished.');
    } else {
      logs = appendLog(logs, '⚠ Life support reserves critical!');
    }
  } else {
    declineProgress = 0;
    const surplus =
      resources[ResourceKind.FOOD] > 5 &&
      resources[ResourceKind.WATER] > 5 &&
      resources[ResourceKind.OXYGEN] > 5;
    if (surplus && population < housing) {
      growthProgress += 1;
      if (growthProgress >= GROWTH_TICKS) {
        population += 1;
        growthProgress = 0;
        logs = appendLog(logs, `A new colonist has arrived. Population: ${population}.`);
      }
    } else {
      growthProgress = 0;
    }
  }

  if (factor < 1) {
    logs = state.sol % 5 === 0 ? appendLog(logs, '⚠ Power grid overloaded — production throttled.') : logs;
  }

  // Milestones.
  const milestones = [...state.milestones];
  const buildingCount = countBuildings(state.board);
  for (const m of MILESTONES) {
    if (!milestones.includes(m.id) && m.test(population, buildingCount)) {
      milestones.push(m.id);
      logs = appendLog(logs, `★ ${m.message}`);
    }
  }

  // Random events.
  let event: ColonyEvent | null = null;
  let lastEventSol = state.lastEventSol;
  if (state.sol - lastEventSol >= EVENT_MIN_GAP && Math.random() < EVENT_CHANCE) {
    event = rollEvent();
    lastEventSol = state.sol;
    for (const [kind, amount] of Object.entries(event.impact ?? {})) {
      const key = kind as ResourceKind;
      resources[key] = Math.max(0, resources[key] + amount);
    }
    logs = appendLog(logs, `⚡ EVENT: ${event.title} — ${event.effect}`);
  }

  return {
    state: {
      ...state,
      sol: state.sol + 1,
      resources,
      population,
      growthProgress,
      declineProgress,
      lastEventSol,
      logs,
      milestones,
    },
    event,
  };
}
