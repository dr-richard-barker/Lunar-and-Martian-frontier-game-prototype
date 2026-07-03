import {
  GameState, HexData, TerrainType, BuildingType, ResourceKind, Stockpile, PowerReport, ColonyEvent,
  Unit, CityProduct, QueueItem, Coord,
} from '../types';
import {
  BUILDINGS, TERRAIN_STYLES, BOARD_RADIUS, SILICATE_SOLAR_BONUS, COLONIST_NEEDS, COLONIST_TAX,
  GROWTH_TICKS, DECLINE_TICKS, INITIAL_RESOURCES, INITIAL_POPULATION, MILESTONES,
  DICE_TOKEN_POOL, SURGE_MULTIPLIER, MAX_WORKERS, MAX_QUEUE, WORKER_SPEED, RAIL_SPEED, CITY_PRODUCTS,
} from '../constants';
import { rollEvent } from './events';
import { neighbors, findPath, hexDistance, boardMap, hexKey, HEX_DIRS } from './hexgrid';

const EVENT_AMBIENT_CHANCE = 0.02;
const EVENT_AMBIENT_GAP = 14;
const EVENT_SEVEN_CHANCE = 0.4;
const EVENT_SEVEN_GAP = 8;

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
  const tokens = [...DICE_TOKEN_POOL].sort(() => Math.random() - 0.5);
  let tokenIdx = 0;

  for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
    for (let r = Math.max(-BOARD_RADIUS, -q - BOARD_RADIUS); r <= Math.min(BOARD_RADIUS, -q + BOARD_RADIUS); r++) {
      const isCenter = q === 0 && r === 0;
      const nearCenter = hexDistance({ q, r }, { q: 0, r: 0 }) <= 1;
      let terrain = isCenter
        ? TerrainType.REGOLITH
        : weighted[Math.floor(Math.random() * weighted.length)];
      // Keep the city's first ring passable and buildable.
      if (nearCenter && terrain === TerrainType.CRATER) terrain = TerrainType.REGOLITH;
      const diceValue = terrain === TerrainType.CRATER || isCenter
        ? null
        : tokens[(tokenIdx++) % tokens.length];
      hexes.push({
        id: id++,
        q,
        r,
        terrain,
        building: isCenter ? BuildingType.CITY : null,
        diceValue,
        construction: null,
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
    units: [{ id: 1, q: 0, r: 1, path: [], targetHexId: null, state: 'idle' }],
    cityQueue: [],
    lastRoll: null,
    logs: ['[INIT] Descent complete. Colony Hub online.', '[SYS] One worker rover deployed. Click a tile to expand.'],
    milestones: [],
    growthProgress: 0,
    declineProgress: 0,
    lastEventSol: 0,
    nextId: 2,
  };
}

/**
 * The maglev network and everything it services. Returns the ids of all
 * OPERATIONAL hexes: the Hub, every track segment connected to it, and
 * every building adjacent to the Hub or a connected track. Buildings cut
 * off from the network are offline — they produce, consume, and house
 * nothing until reconnected.
 */
export function getActiveSet(board: HexData[]): Set<number> {
  const active = new Set<number>();
  const city = board.find(h => h.building === BuildingType.CITY);
  if (!city) return active;
  active.add(city.id);

  const map = boardMap(board);
  const queue: HexData[] = [city];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const dir of HEX_DIRS) {
      const next = map.get(hexKey({ q: current.q + dir.q, r: current.r + dir.r }));
      if (next && next.building === BuildingType.ROAD && !active.has(next.id)) {
        active.add(next.id);
        queue.push(next);
      }
    }
  }

  for (const hex of board) {
    if (!hex.building || active.has(hex.id)) continue;
    const served = neighbors(board, hex).some(n =>
      n.building === BuildingType.CITY || (n.building === BuildingType.ROAD && active.has(n.id))
    );
    if (served) active.add(hex.id);
  }
  return active;
}

export function getPowerReport(board: HexData[]): PowerReport {
  const active = getActiveSet(board);
  let generated = 0;
  let consumed = 0;
  for (const hex of board) {
    if (!hex.building || !active.has(hex.id)) continue;
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
  const active = getActiveSet(board);
  return board.reduce((sum, hex) =>
    sum + (hex.building && active.has(hex.id) ? (BUILDINGS[hex.building].housing ?? 0) : 0), 0);
}

/** Structures excluding the Hub and track segments. */
export function countBuildings(board: HexData[]): number {
  return board.filter(h =>
    h.building && h.building !== BuildingType.CITY && h.building !== BuildingType.ROAD
  ).length;
}

export function idleWorkers(units: Unit[]): Unit[] {
  return units.filter(u => u.state === 'idle');
}

/** Net per-sol rate for each resource at current power efficiency — shown in the UI. */
export function getRates(state: GameState): Stockpile {
  const { factor } = getPowerReport(state.board);
  const active = getActiveSet(state.board);
  const rates: Stockpile = {
    [ResourceKind.CREDITS]: state.population * COLONIST_TAX,
    [ResourceKind.METAL]: 0,
    [ResourceKind.WATER]: 0,
    [ResourceKind.OXYGEN]: 0,
    [ResourceKind.FOOD]: 0,
  };
  for (const hex of state.board) {
    if (!hex.building || !active.has(hex.id)) continue;
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

/**
 * A hex is serviced when it touches the Hub or a connected maglev track —
 * the placement requirement for every structure, tracks included.
 */
export function isWithinReach(board: HexData[], hex: HexData): boolean {
  const active = getActiveSet(board);
  return neighbors(board, hex).some(n =>
    n.building === BuildingType.CITY || (n.building === BuildingType.ROAD && active.has(n.id))
  );
}

export function canBuild(state: GameState, hex: HexData, type: BuildingType): { ok: boolean; reason?: string } {
  const def = BUILDINGS[type];
  if (!def.buildable) return { ok: false, reason: 'Not constructible' };
  if (hex.building) return { ok: false, reason: 'Tile occupied' };
  if (hex.construction) return { ok: false, reason: 'Construction already underway' };
  if (!TERRAIN_STYLES[hex.terrain].buildable) return { ok: false, reason: 'Craters are unbuildable' };
  if (!isWithinReach(state.board, hex)) {
    return { ok: false, reason: 'Off the maglev network — extend track from the Colony Hub first' };
  }
  if (def.terrain && !def.terrain.includes(hex.terrain)) {
    return { ok: false, reason: `Requires ${def.terrain.map(t => TERRAIN_STYLES[t].label).join(' or ')}` };
  }
  if (def.unique && state.board.some(h => h.building === type || h.construction?.type === type)) {
    return { ok: false, reason: 'Already built or underway (one per colony)' };
  }
  for (const [kind, amount] of Object.entries(def.cost)) {
    if (state.resources[kind as ResourceKind] < amount) {
      return { ok: false, reason: `Not enough ${kind.toLowerCase()}` };
    }
  }
  if (idleWorkers(state.units).length === 0) {
    return { ok: false, reason: 'No idle worker rover — build one at the Colony Hub' };
  }
  return { ok: true };
}

/**
 * Order a construction: pays the cost, marks the site, and dispatches the
 * nearest idle worker rover to build it.
 */
export function orderConstruction(state: GameState, hexId: number, type: BuildingType): GameState {
  const hex = state.board.find(h => h.id === hexId);
  if (!hex) return state;
  const check = canBuild(state, hex, type);
  if (!check.ok) return state;

  const idle = idleWorkers(state.units)
    .sort((a, b) => hexDistance(a, hex) - hexDistance(b, hex));
  let worker: Unit | null = null;
  let path: Coord[] | null = null;
  for (const candidate of idle) {
    path = findPath(state.board, candidate, hex);
    if (path !== null) { worker = candidate; break; }
  }
  if (!worker || path === null) {
    return { ...state, logs: appendLog(state.logs, '⚠ No rover can reach that sector.') };
  }

  const def = BUILDINGS[type];
  const resources = { ...state.resources };
  for (const [kind, amount] of Object.entries(def.cost)) {
    resources[kind as ResourceKind] -= amount;
  }
  return {
    ...state,
    resources,
    board: state.board.map(h => h.id === hexId
      ? { ...h, construction: { type, remaining: def.buildSols, total: def.buildSols } }
      : h),
    units: state.units.map(u => u.id === worker!.id
      ? { ...u, path: path!, targetHexId: hexId, state: path!.length === 0 ? 'constructing' as const : 'moving' as const }
      : u),
    logs: appendLog(state.logs, `Rover dispatched: ${def.name} site marked in sector ${hexId}.`),
  };
}

/** Demolish a finished building, or cancel an in-progress construction. */
export function demolish(state: GameState, hexId: number): GameState {
  const hex = state.board.find(h => h.id === hexId);
  if (!hex) return state;

  if (hex.construction) {
    const def = BUILDINGS[hex.construction.type];
    const resources = { ...state.resources };
    for (const [kind, amount] of Object.entries(def.cost)) {
      resources[kind as ResourceKind] += Math.floor(amount / 2);
    }
    return {
      ...state,
      resources,
      board: state.board.map(h => h.id === hexId ? { ...h, construction: null } : h),
      units: state.units.map(u => u.targetHexId === hexId
        ? { ...u, path: [], targetHexId: null, state: 'idle' as const }
        : u),
      logs: appendLog(state.logs, `${def.name} construction cancelled. Half the materials recovered.`),
    };
  }

  if (!hex.building || hex.building === BuildingType.CITY) return state;
  const def = BUILDINGS[hex.building];
  const resources = { ...state.resources };
  const metalCost = def.cost[ResourceKind.METAL] ?? 0;
  resources[ResourceKind.METAL] += Math.floor(metalCost / 2);
  return {
    ...state,
    resources,
    board: state.board.map(h => h.id === hexId ? { ...h, building: null } : h),
    logs: appendLog(state.logs, `${def.name} demolished. Salvaged ${Math.floor(metalCost / 2)} metal.`),
  };
}

export function canEnqueue(state: GameState, product: CityProduct): { ok: boolean; reason?: string } {
  const def = CITY_PRODUCTS[product];
  if (state.cityQueue.length >= MAX_QUEUE) return { ok: false, reason: 'Production queue full' };
  if (product === CityProduct.WORKER_ROVER) {
    const queued = state.cityQueue.filter(q => q.product === CityProduct.WORKER_ROVER).length;
    if (state.units.length + queued >= MAX_WORKERS) {
      return { ok: false, reason: `Rover fleet at maximum (${MAX_WORKERS})` };
    }
  }
  for (const [kind, amount] of Object.entries(def.cost)) {
    if (state.resources[kind as ResourceKind] < amount) {
      return { ok: false, reason: `Not enough ${kind.toLowerCase()}` };
    }
  }
  return { ok: true };
}

export function enqueueProduct(state: GameState, product: CityProduct): GameState {
  const check = canEnqueue(state, product);
  if (!check.ok) return state;
  const def = CITY_PRODUCTS[product];
  const resources = { ...state.resources };
  for (const [kind, amount] of Object.entries(def.cost)) {
    resources[kind as ResourceKind] -= amount;
  }
  const item: QueueItem = { id: state.nextId, product, remaining: def.buildSols };
  return {
    ...state,
    resources,
    cityQueue: [...state.cityQueue, item],
    nextId: state.nextId + 1,
    logs: appendLog(state.logs, `${def.name} added to Colony Hub production.`),
  };
}

export function cancelQueueItem(state: GameState, itemId: number): GameState {
  const item = state.cityQueue.find(q => q.id === itemId);
  if (!item) return state;
  const def = CITY_PRODUCTS[item.product];
  const resources = { ...state.resources };
  for (const [kind, amount] of Object.entries(def.cost)) {
    resources[kind as ResourceKind] += amount;
  }
  return {
    ...state,
    resources,
    cityQueue: state.cityQueue.filter(q => q.id !== itemId),
    logs: appendLog(state.logs, `${def.name} order cancelled and refunded.`),
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

  // --- Catan-style dice roll ---
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const roll = d1 + d2;

  // --- Building production and consumption (offline structures are inert) ---
  const activeSet = getActiveSet(state.board);
  for (const hex of state.board) {
    if (!hex.building || !activeSet.has(hex.id)) continue;
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

  // --- Colonist consumption and tax income ---
  resources[ResourceKind.CREDITS] += state.population * COLONIST_TAX;
  let shortage = false;
  for (const [kind, amount] of Object.entries(COLONIST_NEEDS)) {
    const need = amount * state.population;
    const key = kind as ResourceKind;
    if (resources[key] < need) shortage = true;
    resources[key] = Math.max(0, resources[key] - need);
  }

  // --- Population dynamics ---
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

  if (factor < 1 && state.sol % 5 === 0) {
    logs = appendLog(logs, '⚠ Power grid overloaded — production throttled.');
  }

  // --- City production queue ---
  let cityQueue = state.cityQueue;
  let units = state.units;
  let nextId = state.nextId;
  if (cityQueue.length > 0) {
    const head = { ...cityQueue[0], remaining: cityQueue[0].remaining - 1 };
    if (head.remaining <= 0) {
      const def = CITY_PRODUCTS[head.product];
      if (head.product === CityProduct.WORKER_ROVER) {
        if (population <= (def.popCost ?? 0)) {
          // Not enough colonists to crew the rover — stall until there are.
          cityQueue = [{ ...head, remaining: 1 }, ...cityQueue.slice(1)];
          if (state.sol % 4 === 0) logs = appendLog(logs, '⚠ Rover ready but no colonist free to crew it.');
        } else {
          population -= def.popCost ?? 0;
          units = [...units, { id: nextId, q: 0, r: 0, path: [], targetHexId: null, state: 'idle' }];
          nextId += 1;
          cityQueue = cityQueue.slice(1);
          logs = appendLog(logs, `🚜 Worker Rover rolls off the assembly line. Fleet: ${units.length}.`);
        }
      } else {
        population += def.popGain ?? 0;
        cityQueue = cityQueue.slice(1);
        logs = appendLog(logs, `👨‍🚀 Shuttle touchdown! ${def.popGain} colonists join the frontier.`);
      }
    } else {
      cityQueue = [head, ...cityQueue.slice(1)];
    }
  }

  // --- Worker movement & construction ---
  let board = state.board;
  const moveMap = boardMap(board);
  units = units.map(unit => {
    if (unit.state === 'moving') {
      const path = [...unit.path];
      let { q, r } = unit;
      // Maglev boost: a full stretch of track ahead lets the rover ride rails.
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
    }
    return unit;
  });

  for (const unit of units) {
    if (unit.state !== 'constructing' || unit.targetHexId === null) continue;
    const hex = board.find(h => h.id === unit.targetHexId);
    if (!hex || !hex.construction) {
      units = units.map(u => u.id === unit.id ? { ...u, targetHexId: null, state: 'idle' as const } : u);
      continue;
    }
    const remaining = hex.construction.remaining - 1;
    if (remaining <= 0) {
      const builtType = hex.construction.type;
      board = board.map(h => h.id === hex.id ? { ...h, building: builtType, construction: null } : h);
      // Step the rover off the finished site if a free neighbor exists.
      const spot = neighbors(board, hex).find(n => n.terrain !== TerrainType.CRATER && !n.building);
      units = units.map(u => u.id === unit.id
        ? { ...u, q: spot?.q ?? u.q, r: spot?.r ?? u.r, targetHexId: null, state: 'idle' as const }
        : u);
      logs = appendLog(logs, `✅ ${BUILDINGS[builtType].name} completed in sector ${hex.id}.`);
    } else {
      board = board.map(h => h.id === hex.id
        ? { ...h, construction: { ...h.construction!, remaining } }
        : h);
    }
  }

  // --- Milestones ---
  const milestones = [...state.milestones];
  const buildingCount = countBuildings(board);
  for (const m of MILESTONES) {
    if (!milestones.includes(m.id) && m.test(population, buildingCount)) {
      milestones.push(m.id);
      logs = appendLog(logs, `★ ${m.message}`);
    }
  }

  // --- Events: a roll of 7 courts disaster (or fortune) ---
  let event: ColonyEvent | null = null;
  let lastEventSol = state.lastEventSol;
  const sevenTriggers = roll === 7 && state.sol - lastEventSol >= EVENT_SEVEN_GAP && Math.random() < EVENT_SEVEN_CHANCE;
  const ambientTriggers = state.sol - lastEventSol >= EVENT_AMBIENT_GAP && Math.random() < EVENT_AMBIENT_CHANCE;
  if (sevenTriggers || ambientTriggers) {
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
      board,
      units,
      cityQueue,
      lastRoll: { d1, d2 },
      growthProgress,
      declineProgress,
      lastEventSol,
      logs,
      milestones,
      nextId,
    },
    event,
  };
}
