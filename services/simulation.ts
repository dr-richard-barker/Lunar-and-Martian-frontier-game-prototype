import {
  GameState, HexData, TerrainType, BuildingType, ResourceKind, Stockpile, PowerReport, ColonyEvent,
  Unit, CityProduct, QueueItem, Coord, Faction, NewGameOptions,
} from '../types';
import {
  BUILDINGS, TERRAIN_STYLES, SILICATE_SOLAR_BONUS, COLONIST_NEEDS, COLONIST_TAX,
  GROWTH_TICKS, DECLINE_TICKS, INITIAL_RESOURCES, INITIAL_POPULATION, MILESTONES,
  DICE_TOKEN_POOL, SURGE_MULTIPLIER, MAX_WORKERS, MAX_QUEUE, WORKER_SPEED, RAIL_SPEED,
  CITY_PRODUCTS, FACTION_PRESETS,
} from '../constants';
import { rollEvent } from './events';
import { neighbors, findPath, hexDistance, boardMap, hexKey, HEX_DIRS } from './hexgrid';

const EVENT_AMBIENT_CHANCE = 0.02;
const EVENT_AMBIENT_GAP = 14;
const EVENT_SEVEN_CHANCE = 0.4;
const EVENT_SEVEN_GAP = 8;

/** Hub start positions: corners of a ring, evenly spread per faction count. */
const HUB_CORNERS: Coord[] = [
  { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 },
];
function hubPositions(count: number, radius: number): Coord[] {
  if (count <= 1) return [{ q: 0, r: 0 }];
  const d = radius - 1;
  const picks = count === 2 ? [0, 3] : count === 3 ? [0, 2, 4] : [0, 1, 3, 4];
  return picks.map(i => ({ q: HUB_CORNERS[i].q * d, r: HUB_CORNERS[i].r * d }));
}

export function generateBoard(radius: number, hubs: Coord[]): HexData[] {
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
  const tokens = [...DICE_TOKEN_POOL].sort(() => Math.random() - 0.5);
  let tokenIdx = 0;

  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      const hubIndex = hubs.findIndex(h => h.q === q && h.r === r);
      const nearHub = hubs.some(h => hexDistance({ q, r }, h) <= 1);
      let terrain = hubIndex >= 0
        ? TerrainType.REGOLITH
        : weighted[Math.floor(Math.random() * weighted.length)];
      // Keep every hub's first ring passable and buildable.
      if (nearHub && terrain === TerrainType.CRATER) terrain = TerrainType.REGOLITH;
      const diceValue = terrain === TerrainType.CRATER || hubIndex >= 0
        ? null
        : tokens[(tokenIdx++) % tokens.length];
      hexes.push({
        id: id++,
        q,
        r,
        terrain,
        building: hubIndex >= 0 ? BuildingType.CITY : null,
        owner: hubIndex >= 0 ? hubIndex : null,
        diceValue,
        construction: null,
      });
    }
  }
  return hexes;
}

export function newGame(options: NewGameOptions = { boardRadius: 4, aiCount: 0 }): GameState {
  const factionCount = 1 + Math.max(0, Math.min(3, options.aiCount));
  const radius = options.boardRadius;
  const hubs = hubPositions(factionCount, radius);
  const board = generateBoard(radius, hubs);
  const map = boardMap(board);

  let nextId = 1;
  const factions: Faction[] = hubs.map((hub, i) => {
    const preset = FACTION_PRESETS[i];
    const cityHex = map.get(hexKey(hub))!;
    // First rover starts on a free neighbor of its hub.
    const spawn = neighbors(board, cityHex).find(n => n.terrain !== TerrainType.CRATER) ?? cityHex;
    return {
      id: i,
      name: preset.name,
      color: preset.color,
      archetype: preset.archetype,
      isAI: i > 0,
      cityHexId: cityHex.id,
      resources: { ...INITIAL_RESOURCES },
      population: INITIAL_POPULATION,
      units: [{ id: nextId++, q: spawn.q, r: spawn.r, path: [], targetHexId: null, state: 'idle' as const }],
      cityQueue: [],
      growthProgress: 0,
      declineProgress: 0,
    };
  });

  const rivals = factions.slice(1).map(f => f.name).join(', ');
  return {
    sol: 1,
    boardRadius: radius,
    board,
    factions,
    lastRoll: null,
    logs: [
      '[INIT] Descent complete. Colony Hub online.',
      factionCount > 1
        ? `[SCAN] Rival landings detected: ${rivals}.`
        : '[SYS] One worker rover deployed. Click a tile to expand.',
    ],
    milestones: [],
    lastEventSol: 0,
    nextId,
  };
}

/**
 * A faction's maglev network and everything it services: its Hub, every
 * OWN track segment connected to it, and every OWN building adjacent to
 * the Hub or a connected track. Anything cut off is offline.
 */
export function getActiveSet(board: HexData[], faction: Faction): Set<number> {
  const active = new Set<number>();
  const city = board.find(h => h.id === faction.cityHexId);
  if (!city || city.building !== BuildingType.CITY) return active;
  active.add(city.id);

  const map = boardMap(board);
  const queue: HexData[] = [city];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const dir of HEX_DIRS) {
      const next = map.get(hexKey({ q: current.q + dir.q, r: current.r + dir.r }));
      if (next && next.owner === faction.id && next.building === BuildingType.ROAD && !active.has(next.id)) {
        active.add(next.id);
        queue.push(next);
      }
    }
  }

  for (const hex of board) {
    if (!hex.building || hex.owner !== faction.id || active.has(hex.id)) continue;
    const served = neighbors(board, hex).some(n =>
      n.owner === faction.id &&
      (n.id === faction.cityHexId || (n.building === BuildingType.ROAD && active.has(n.id)))
    );
    if (served) active.add(hex.id);
  }
  return active;
}

/** Union of every faction's active set — for rendering offline states. */
export function getAllActiveIds(state: GameState): Set<number> {
  const all = new Set<number>();
  for (const faction of state.factions) {
    for (const id of getActiveSet(state.board, faction)) all.add(id);
  }
  return all;
}

export function getPowerReport(board: HexData[], faction: Faction): PowerReport {
  const active = getActiveSet(board, faction);
  let generated = 0;
  let consumed = 0;
  for (const hex of board) {
    if (!hex.building || hex.owner !== faction.id || !active.has(hex.id)) continue;
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

export function getHousing(board: HexData[], faction: Faction): number {
  const active = getActiveSet(board, faction);
  return board.reduce((sum, hex) =>
    sum + (hex.building && hex.owner === faction.id && active.has(hex.id)
      ? (BUILDINGS[hex.building].housing ?? 0)
      : 0), 0);
}

/** A faction's structures excluding its Hub and track segments. */
export function countBuildings(board: HexData[], factionId: number): number {
  return board.filter(h =>
    h.owner === factionId && h.building &&
    h.building !== BuildingType.CITY && h.building !== BuildingType.ROAD
  ).length;
}

export function countRails(board: HexData[], factionId: number): number {
  return board.filter(h => h.owner === factionId && h.building === BuildingType.ROAD).length;
}

export function idleWorkers(faction: Faction): Unit[] {
  return faction.units.filter(u => u.state === 'idle');
}

/** Net per-sol rate for each resource at current power efficiency. */
export function getRates(state: GameState, faction: Faction): Stockpile {
  const { factor } = getPowerReport(state.board, faction);
  const active = getActiveSet(state.board, faction);
  const rates: Stockpile = {
    [ResourceKind.CREDITS]: faction.population * COLONIST_TAX,
    [ResourceKind.METAL]: 0,
    [ResourceKind.WATER]: 0,
    [ResourceKind.OXYGEN]: 0,
    [ResourceKind.FOOD]: 0,
  };
  for (const hex of state.board) {
    if (!hex.building || hex.owner !== faction.id || !active.has(hex.id)) continue;
    const def = BUILDINGS[hex.building];
    for (const [kind, amount] of Object.entries(def.production ?? {})) {
      rates[kind as ResourceKind] += amount * factor;
    }
    for (const [kind, amount] of Object.entries(def.consumption ?? {})) {
      rates[kind as ResourceKind] -= amount * factor;
    }
  }
  for (const [kind, amount] of Object.entries(COLONIST_NEEDS)) {
    rates[kind as ResourceKind] -= amount * faction.population;
  }
  return rates;
}

/** A hex is serviced for a faction when it touches that faction's Hub or a
 * connected own track — the placement requirement for every structure. */
export function isWithinReach(board: HexData[], faction: Faction, hex: HexData): boolean {
  const active = getActiveSet(board, faction);
  return neighbors(board, hex).some(n =>
    n.owner === faction.id &&
    (n.id === faction.cityHexId || (n.building === BuildingType.ROAD && active.has(n.id)))
  );
}

export function canBuild(state: GameState, factionId: number, hex: HexData, type: BuildingType): { ok: boolean; reason?: string } {
  const faction = state.factions[factionId];
  const def = BUILDINGS[type];
  if (!def.buildable) return { ok: false, reason: 'Not constructible' };
  if (hex.building || hex.construction) {
    return {
      ok: false,
      reason: hex.owner !== null && hex.owner !== factionId
        ? `Claimed by ${state.factions[hex.owner]?.name ?? 'a rival'}`
        : 'Tile occupied',
    };
  }
  if (!TERRAIN_STYLES[hex.terrain].buildable) return { ok: false, reason: 'Craters are unbuildable' };
  if (!isWithinReach(state.board, faction, hex)) {
    return { ok: false, reason: 'Off your maglev network — extend track from your Colony Hub first' };
  }
  if (def.terrain && !def.terrain.includes(hex.terrain)) {
    return { ok: false, reason: `Requires ${def.terrain.map(t => TERRAIN_STYLES[t].label).join(' or ')}` };
  }
  if (def.unique && state.board.some(h =>
    h.owner === factionId && (h.building === type || h.construction?.type === type))) {
    return { ok: false, reason: 'Already built or underway (one per colony)' };
  }
  for (const [kind, amount] of Object.entries(def.cost)) {
    if (faction.resources[kind as ResourceKind] < amount) {
      return { ok: false, reason: `Not enough ${kind.toLowerCase()}` };
    }
  }
  if (idleWorkers(faction).length === 0) {
    return { ok: false, reason: 'No idle worker rover — build one at the Colony Hub' };
  }
  return { ok: true };
}

function updateFaction(state: GameState, factionId: number, patch: Partial<Faction>): GameState {
  return {
    ...state,
    factions: state.factions.map(f => f.id === factionId ? { ...f, ...patch } : f),
  };
}

/**
 * Order a construction for a faction: pays the cost, claims the tile, and
 * dispatches the faction's nearest idle rover.
 */
export function orderConstruction(state: GameState, factionId: number, hexId: number, type: BuildingType): GameState {
  const hex = state.board.find(h => h.id === hexId);
  const faction = state.factions[factionId];
  if (!hex || !faction) return state;
  const check = canBuild(state, factionId, hex, type);
  if (!check.ok) return state;

  const idle = idleWorkers(faction)
    .sort((a, b) => hexDistance(a, hex) - hexDistance(b, hex));
  let worker: Unit | null = null;
  let path: Coord[] | null = null;
  for (const candidate of idle) {
    path = findPath(state.board, candidate, hex);
    if (path !== null) { worker = candidate; break; }
  }
  if (!worker || path === null) {
    return faction.isAI ? state : { ...state, logs: appendLog(state.logs, '⚠ No rover can reach that sector.') };
  }

  const def = BUILDINGS[type];
  const resources = { ...faction.resources };
  for (const [kind, amount] of Object.entries(def.cost)) {
    resources[kind as ResourceKind] -= amount;
  }
  const next = updateFaction(state, factionId, {
    resources,
    units: faction.units.map(u => u.id === worker!.id
      ? { ...u, path: path!, targetHexId: hexId, state: path!.length === 0 ? 'constructing' as const : 'moving' as const }
      : u),
  });
  return {
    ...next,
    board: state.board.map(h => h.id === hexId
      ? { ...h, owner: factionId, construction: { type, remaining: def.buildSols, total: def.buildSols } }
      : h),
    logs: faction.isAI
      ? state.logs
      : appendLog(state.logs, `Rover dispatched: ${def.name} site marked in sector ${hexId}.`),
  };
}

/** Demolish a finished building, or cancel an in-progress construction (own only). */
export function demolish(state: GameState, factionId: number, hexId: number): GameState {
  const hex = state.board.find(h => h.id === hexId);
  const faction = state.factions[factionId];
  if (!hex || !faction || hex.owner !== factionId) return state;

  if (hex.construction) {
    const def = BUILDINGS[hex.construction.type];
    const resources = { ...faction.resources };
    for (const [kind, amount] of Object.entries(def.cost)) {
      resources[kind as ResourceKind] += Math.floor(amount / 2);
    }
    const next = updateFaction(state, factionId, {
      resources,
      units: faction.units.map(u => u.targetHexId === hexId
        ? { ...u, path: [], targetHexId: null, state: 'idle' as const }
        : u),
    });
    return {
      ...next,
      board: state.board.map(h => h.id === hexId ? { ...h, construction: null, owner: null } : h),
      logs: appendLog(state.logs, `${def.name} construction cancelled. Half the materials recovered.`),
    };
  }

  if (!hex.building || hex.building === BuildingType.CITY) return state;
  const def = BUILDINGS[hex.building];
  const resources = { ...faction.resources };
  const metalCost = def.cost[ResourceKind.METAL] ?? 0;
  resources[ResourceKind.METAL] += Math.floor(metalCost / 2);
  const next = updateFaction(state, factionId, { resources });
  return {
    ...next,
    board: state.board.map(h => h.id === hexId ? { ...h, building: null, owner: null } : h),
    logs: appendLog(state.logs, `${def.name} demolished. Salvaged ${Math.floor(metalCost / 2)} metal.`),
  };
}

export function canEnqueue(state: GameState, factionId: number, product: CityProduct): { ok: boolean; reason?: string } {
  const faction = state.factions[factionId];
  const def = CITY_PRODUCTS[product];
  if (faction.cityQueue.length >= MAX_QUEUE) return { ok: false, reason: 'Production queue full' };
  if (product === CityProduct.WORKER_ROVER) {
    const queued = faction.cityQueue.filter(q => q.product === CityProduct.WORKER_ROVER).length;
    if (faction.units.length + queued >= MAX_WORKERS) {
      return { ok: false, reason: `Rover fleet at maximum (${MAX_WORKERS})` };
    }
  }
  for (const [kind, amount] of Object.entries(def.cost)) {
    if (faction.resources[kind as ResourceKind] < amount) {
      return { ok: false, reason: `Not enough ${kind.toLowerCase()}` };
    }
  }
  return { ok: true };
}

export function enqueueProduct(state: GameState, factionId: number, product: CityProduct): GameState {
  const check = canEnqueue(state, factionId, product);
  if (!check.ok) return state;
  const faction = state.factions[factionId];
  const def = CITY_PRODUCTS[product];
  const resources = { ...faction.resources };
  for (const [kind, amount] of Object.entries(def.cost)) {
    resources[kind as ResourceKind] -= amount;
  }
  const item: QueueItem = { id: state.nextId, product, remaining: def.buildSols };
  const next = updateFaction(state, factionId, {
    resources,
    cityQueue: [...faction.cityQueue, item],
  });
  return {
    ...next,
    nextId: state.nextId + 1,
    logs: faction.isAI ? state.logs : appendLog(state.logs, `${def.name} added to Colony Hub production.`),
  };
}

export function cancelQueueItem(state: GameState, factionId: number, itemId: number): GameState {
  const faction = state.factions[factionId];
  const item = faction.cityQueue.find(q => q.id === itemId);
  if (!item) return state;
  const def = CITY_PRODUCTS[item.product];
  const resources = { ...faction.resources };
  for (const [kind, amount] of Object.entries(def.cost)) {
    resources[kind as ResourceKind] += amount;
  }
  const next = updateFaction(state, factionId, {
    resources,
    cityQueue: faction.cityQueue.filter(q => q.id !== itemId),
  });
  return {
    ...next,
    logs: faction.isAI ? state.logs : appendLog(state.logs, `${def.name} order cancelled and refunded.`),
  };
}

function appendLog(logs: string[], message: string): string[] {
  return [...logs, message].slice(-30);
}

export interface TickResult {
  state: GameState;
  event: ColonyEvent | null;
}

/** Advance the simulation by one sol for every faction. Pure. */
export function tick(state: GameState): TickResult {
  let logs = state.logs;
  let board = state.board;
  let nextId = state.nextId;

  // --- Catan-style dice roll (global) ---
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const roll = d1 + d2;

  // --- Random events (global, hit every faction equally) ---
  let event: ColonyEvent | null = null;
  let lastEventSol = state.lastEventSol;
  const sevenTriggers = roll === 7 && state.sol - lastEventSol >= EVENT_SEVEN_GAP && Math.random() < EVENT_SEVEN_CHANCE;
  const ambientTriggers = state.sol - lastEventSol >= EVENT_AMBIENT_GAP && Math.random() < EVENT_AMBIENT_CHANCE;
  if (sevenTriggers || ambientTriggers) {
    event = rollEvent();
    lastEventSol = state.sol;
    logs = appendLog(logs, `⚡ EVENT: ${event.title} — ${event.effect}`);
  }

  const moveMap = boardMap(board);
  const factions: Faction[] = [];

  for (const original of state.factions) {
    const faction: Faction = {
      ...original,
      resources: { ...original.resources },
      units: original.units.map(u => ({ ...u })),
      cityQueue: original.cityQueue.map(q => ({ ...q })),
    };
    const isPlayer = !faction.isAI;
    const resources = faction.resources;

    // Event impact
    if (event) {
      for (const [kind, amount] of Object.entries(event.impact ?? {})) {
        const key = kind as ResourceKind;
        resources[key] = Math.max(0, resources[key] + amount);
      }
    }

    const active = getActiveSet(board, faction);
    const { factor } = getPowerReport(board, faction);

    // Production & consumption (own, online buildings only)
    for (const hex of board) {
      if (!hex.building || hex.owner !== faction.id || !active.has(hex.id)) continue;
      const def = BUILDINGS[hex.building];
      const surge = hex.diceValue === roll ? SURGE_MULTIPLIER : 1;
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
        resources[kind as ResourceKind] += amount * inputScale * surge;
      }
    }

    // Colonists: taxes and needs
    resources[ResourceKind.CREDITS] += faction.population * COLONIST_TAX;
    let shortage = false;
    for (const [kind, amount] of Object.entries(COLONIST_NEEDS)) {
      const need = amount * faction.population;
      const key = kind as ResourceKind;
      if (resources[key] < need) shortage = true;
      resources[key] = Math.max(0, resources[key] - need);
    }

    // Population dynamics
    const housing = getHousing(board, faction);
    if (shortage) {
      faction.growthProgress = 0;
      faction.declineProgress += 1;
      if (faction.declineProgress >= DECLINE_TICKS && faction.population > 0) {
        faction.population -= 1;
        faction.declineProgress = 0;
        if (isPlayer) logs = appendLog(logs, '⚠ Life support shortage — a colonist has perished.');
      } else if (isPlayer) {
        logs = appendLog(logs, '⚠ Life support reserves critical!');
      }
    } else {
      faction.declineProgress = 0;
      const surplus =
        resources[ResourceKind.FOOD] > 5 &&
        resources[ResourceKind.WATER] > 5 &&
        resources[ResourceKind.OXYGEN] > 5;
      if (surplus && faction.population < housing) {
        faction.growthProgress += 1;
        if (faction.growthProgress >= GROWTH_TICKS) {
          faction.population += 1;
          faction.growthProgress = 0;
          if (isPlayer) logs = appendLog(logs, `A new colonist has arrived. Population: ${faction.population}.`);
        }
      } else {
        faction.growthProgress = 0;
      }
    }

    if (isPlayer && factor < 1 && state.sol % 5 === 0) {
      logs = appendLog(logs, '⚠ Power grid overloaded — production throttled.');
    }

    // City production queue
    if (faction.cityQueue.length > 0) {
      const head = { ...faction.cityQueue[0], remaining: faction.cityQueue[0].remaining - 1 };
      if (head.remaining <= 0) {
        const def = CITY_PRODUCTS[head.product];
        const cityHex = board.find(h => h.id === faction.cityHexId)!;
        if (head.product === CityProduct.WORKER_ROVER) {
          if (faction.population <= (def.popCost ?? 0)) {
            faction.cityQueue = [{ ...head, remaining: 1 }, ...faction.cityQueue.slice(1)];
            if (isPlayer && state.sol % 4 === 0) logs = appendLog(logs, '⚠ Rover ready but no colonist free to crew it.');
          } else {
            faction.population -= def.popCost ?? 0;
            faction.units = [...faction.units, { id: nextId++, q: cityHex.q, r: cityHex.r, path: [], targetHexId: null, state: 'idle' }];
            faction.cityQueue = faction.cityQueue.slice(1);
            if (isPlayer) logs = appendLog(logs, `🚜 Worker Rover rolls off the assembly line. Fleet: ${faction.units.length}.`);
          }
        } else {
          faction.population += def.popGain ?? 0;
          faction.cityQueue = faction.cityQueue.slice(1);
          if (isPlayer) logs = appendLog(logs, `👨‍🚀 Shuttle touchdown! ${def.popGain} colonists join the frontier.`);
        }
      } else {
        faction.cityQueue = [head, ...faction.cityQueue.slice(1)];
      }
    }

    // Rover movement
    faction.units = faction.units.map(unit => {
      if (unit.state !== 'moving') return unit;
      const path = [...unit.path];
      let { q, r } = unit;
      const lookahead = path.slice(0, RAIL_SPEED);
      const onRails = lookahead.length === RAIL_SPEED && lookahead.every(c => {
        const h = moveMap.get(hexKey(c));
        return h && (h.building === BuildingType.ROAD || h.building === BuildingType.CITY);
      });
      const speed = onRails ? RAIL_SPEED : WORKER_SPEED;
      for (let step = 0; step < speed && path.length > 0; step++) {
        const next = path.shift()!;
        q = next.q; r = next.r;
      }
      if (path.length === 0) {
        return { ...unit, q, r, path, state: unit.targetHexId !== null ? 'constructing' as const : 'idle' as const };
      }
      return { ...unit, q, r, path };
    });

    // Construction progress
    for (const unit of faction.units) {
      if (unit.state !== 'constructing' || unit.targetHexId === null) continue;
      const hex = board.find(h => h.id === unit.targetHexId);
      if (!hex || !hex.construction || hex.owner !== faction.id) {
        faction.units = faction.units.map(u => u.id === unit.id ? { ...u, targetHexId: null, state: 'idle' as const } : u);
        continue;
      }
      const remaining = hex.construction.remaining - 1;
      if (remaining <= 0) {
        const builtType = hex.construction.type;
        board = board.map(h => h.id === hex.id ? { ...h, building: builtType, construction: null } : h);
        const spot = neighbors(board, hex).find(n => n.terrain !== TerrainType.CRATER && !n.building);
        faction.units = faction.units.map(u => u.id === unit.id
          ? { ...u, q: spot?.q ?? u.q, r: spot?.r ?? u.r, targetHexId: null, state: 'idle' as const }
          : u);
        logs = appendLog(logs, isPlayer
          ? `✅ ${BUILDINGS[builtType].name} completed in sector ${hex.id}.`
          : `⚑ ${faction.name}: ${BUILDINGS[builtType].name} completed.`);
      } else {
        board = board.map(h => h.id === hex.id
          ? { ...h, construction: { ...h.construction!, remaining } }
          : h);
      }
    }

    factions.push(faction);
  }

  // Apply event impacts to nobody twice; milestones are player-only.
  const milestones = [...state.milestones];
  const player = factions[0];
  const playerBuildings = countBuildings(board, 0);
  for (const m of MILESTONES) {
    if (!milestones.includes(m.id) && m.test(player.population, playerBuildings)) {
      milestones.push(m.id);
      logs = appendLog(logs, `★ ${m.message}`);
    }
  }

  return {
    state: {
      ...state,
      sol: state.sol + 1,
      board,
      factions,
      lastRoll: { d1, d2 },
      lastEventSol,
      logs,
      milestones,
      nextId,
    },
    event,
  };
}
