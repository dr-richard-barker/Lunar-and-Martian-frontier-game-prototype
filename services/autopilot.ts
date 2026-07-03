import { GameState, HexData, TerrainType, BuildingType, ResourceKind, CityProduct } from '../types';
import { BUILDINGS, TERRAIN_STYLES } from '../constants';
import {
  getRates, getPowerReport, getHousing, countBuildings, idleWorkers, isWithinReach,
  canBuild, canEnqueue, orderConstruction, enqueueProduct,
} from './simulation';
import { hexDistance } from './hexgrid';

/**
 * Colony autopilot — an AI director that grows the base on its own so the
 * player can sit back and watch. Each sol it makes at most one city order
 * and one construction order, prioritizing survival before industry:
 * power -> water -> oxygen -> food -> housing -> mines/exports.
 */

/** Credits kept in reserve for non-critical construction. */
const CREDIT_FLOOR = 120;

const CENTER = { q: 0, r: 0 };

/** Terrain-occupancy penalty: generic buildings should not squat on mineral tiles. */
function terrainPenalty(terrain: TerrainType, preferred?: TerrainType): number {
  if (preferred && terrain === preferred) return 0;
  if (terrain === TerrainType.REGOLITH) return 1;
  if (terrain === TerrainType.SILICATES) return 2;
  return 4; // ICE / ORES / HE3 — save these for their extractors
}

function openSites(state: GameState): HexData[] {
  return state.board.filter(h =>
    !h.building &&
    !h.construction &&
    TERRAIN_STYLES[h.terrain].buildable &&
    isWithinReach(state.board, h)
  );
}

/** Best site for a building that requires specific terrain. */
function resourceSite(state: GameState, terrain: TerrainType): HexData | null {
  const sites = openSites(state)
    .filter(h => h.terrain === terrain)
    .sort((a, b) => hexDistance(a, CENTER) - hexDistance(b, CENTER));
  return sites[0] ?? null;
}

/** Best site for a generic building — close to the hub, off mineral tiles. */
function genericSite(state: GameState, preferred?: TerrainType): HexData | null {
  const sites = openSites(state).sort((a, b) => {
    const p = terrainPenalty(a.terrain, preferred) - terrainPenalty(b.terrain, preferred);
    if (p !== 0) return p;
    return hexDistance(a, CENTER) - hexDistance(b, CENTER);
  });
  return sites[0] ?? null;
}

/**
 * Pick the serviced open tile closest to any of the given targets — the
 * next maglev track segment on the way there.
 */
function railSiteToward(state: GameState, targets: HexData[]): HexData | null {
  if (targets.length === 0) return null;
  let best: HexData | null = null;
  let bestScore = Infinity;
  for (const site of openSites(state)) {
    for (const target of targets) {
      const score = hexDistance(site, target) * 10 + terrainPenalty(site.terrain);
      if (score < bestScore) { bestScore = score; best = site; }
    }
  }
  return best;
}

/** Claim a resource tile directly, or lay maglev track toward the nearest one. */
function reachFor(
  state: GameState,
  type: BuildingType,
  terrain: TerrainType,
  floor = 0,
  lifeSupport = false,
): GameState | null {
  const site = resourceSite(state, terrain);
  // A target tile is already serviced: build there or save up — never burn
  // materials on track we don't need yet.
  if (site) return tryOrder(state, type, site, floor, lifeSupport);
  const targets = state.board.filter(h =>
    h.terrain === terrain && !h.building && !h.construction && !isWithinReach(state.board, h)
  );
  return tryOrder(state, BuildingType.ROAD, railSiteToward(state, targets), floor, lifeSupport);
}

function hasMine(state: GameState): boolean {
  return state.board.some(h =>
    h.building === BuildingType.MINING_RIG || h.construction?.type === BuildingType.MINING_RIG
  );
}

/** Metal held back for a future mining rig while none exists — avoids the
 * deadlock where every building costs metal but nothing produces it. */
function metalReserve(state: GameState): number {
  return hasMine(state) ? 0 : 12;
}

function tryOrder(
  state: GameState,
  type: BuildingType,
  site: HexData | null,
  floor = 0,
  lifeSupport = false,
): GameState | null {
  if (!site) return null;
  const creditCost = BUILDINGS[type].cost[ResourceKind.CREDITS] ?? 0;
  if (state.resources[ResourceKind.CREDITS] < creditCost + floor) return null;
  // The mining reserve only gates comfort builds — survival and cheap track
  // always outrank saving up for a future rig.
  if (!lifeSupport && type !== BuildingType.MINING_RIG && type !== BuildingType.ROAD) {
    const metalCost = BUILDINGS[type].cost[ResourceKind.METAL] ?? 0;
    if (state.resources[ResourceKind.METAL] < metalCost + metalReserve(state)) return null;
  }
  if (!canBuild(state, site, type).ok) return null;
  return orderConstruction(state, site.id, type);
}

/** Colony Hub decisions: keep a rover fleet, then import colonists. */
function cityStep(state: GameState): GameState {
  const R = state.resources;

  // Crisis recovery: fly people in only once the colony can actually
  // sustain them — otherwise the shuttle wastes credits on doomed arrivals.
  const crisisRates = getRates(state);
  const shuttleQueued = state.cityQueue.some(q => q.product === CityProduct.COLONIST_SHUTTLE);
  if (
    state.population < 3 &&
    R[ResourceKind.WATER] > 25 && R[ResourceKind.OXYGEN] > 25 && R[ResourceKind.FOOD] > 25 &&
    crisisRates[ResourceKind.FOOD] > 0.4 && crisisRates[ResourceKind.OXYGEN] > 0.4 &&
    R[ResourceKind.CREDITS] >= 400 &&
    !shuttleQueued &&
    canEnqueue(state, CityProduct.COLONIST_SHUTTLE).ok
  ) {
    return enqueueProduct(state, CityProduct.COLONIST_SHUTTLE);
  }
  // Ghost-town escape: with nobody left, machines stockpile supplies but no
  // taxes flow — fly a crew in as soon as the pantry can carry them a while.
  if (
    state.population === 0 &&
    R[ResourceKind.WATER] > 40 && R[ResourceKind.OXYGEN] > 40 && R[ResourceKind.FOOD] > 40 &&
    !shuttleQueued &&
    canEnqueue(state, CityProduct.COLONIST_SHUTTLE).ok
  ) {
    return enqueueProduct(state, CityProduct.COLONIST_SHUTTLE);
  }

  // No new rovers during a life-support crisis — that budget buys survival.
  const suppliesOk =
    R[ResourceKind.FOOD] > 15 && R[ResourceKind.OXYGEN] > 15 && R[ResourceKind.WATER] > 15;
  const queuedRovers = state.cityQueue.filter(q => q.product === CityProduct.WORKER_ROVER).length;
  const targetFleet = countBuildings(state.board) >= 8 ? 3 : 2;
  if (
    suppliesOk &&
    state.units.length + queuedRovers < targetFleet &&
    state.population >= 3 &&
    canEnqueue(state, CityProduct.WORKER_ROVER).ok
  ) {
    return enqueueProduct(state, CityProduct.WORKER_ROVER);
  }

  const rates = getRates(state);
  const lifeSupportHealthy =
    rates[ResourceKind.WATER] > 0.3 &&
    rates[ResourceKind.OXYGEN] > 0.4 &&
    rates[ResourceKind.FOOD] > 0.3;
  if (
    lifeSupportHealthy &&
    state.population + 3 <= getHousing(state.board) &&
    !state.cityQueue.some(q => q.product === CityProduct.COLONIST_SHUTTLE) &&
    state.resources[ResourceKind.CREDITS] > 450 &&
    canEnqueue(state, CityProduct.COLONIST_SHUTTLE).ok
  ) {
    return enqueueProduct(state, CityProduct.COLONIST_SHUTTLE);
  }
  return state;
}

/** Construction decisions, in survival-first priority order. */
function buildStep(state: GameState): GameState {
  if (idleWorkers(state.units).length === 0) return state;

  const rates = getRates(state);
  const power = getPowerReport(state.board);
  const housing = getHousing(state.board);
  const R = state.resources;
  // Rates only improve when a build completes — never double-order a type
  // that is already under construction, that just burns the budget twice.
  const pending = (type: BuildingType) => state.board.some(h => h.construction?.type === type);

  // 1. Power — everything else throttles without it.
  if ((power.factor < 1 || power.generated - power.consumed < 3) && !pending(BuildingType.SOLAR_ARRAY)) {
    const next = tryOrder(state, BuildingType.SOLAR_ARRAY, genericSite(state, TerrainType.SILICATES));
    if (next) return next;
  }
  // 1b. Metal emergency — only ahead of life support when the stock is too
  // low to build life support anyway (their kits need ~15-20 metal each).
  if (!hasMine(state) && R[ResourceKind.METAL] < 18) {
    const next = reachFor(state, BuildingType.MINING_RIG, TerrainType.ORES, 0, true);
    if (next) return next;
  }
  // 2-4. Life support: water feeds oxygen and food, so secure it first —
  // expanding toward ice with stepping stones if none is in reach yet.
  // A supply is "low" when its flow is negative-ish, or its stock is thin
  // while the flow is too weak to refill it. A positive, recovering flow
  // must NOT trigger another build — that overinvestment starves the rest.
  const pop = Math.max(state.population, 4);
  const low = (kind: ResourceKind) =>
    rates[kind] <= 0.35 || (R[kind] < pop * 5 && rates[kind] < 0.5);
  /** Sols until the stockpile empties at the current burn rate. */
  const deadline = (kind: ResourceKind) =>
    rates[kind] >= 0 ? Infinity : R[kind] / -rates[kind];

  // Water consumers wait for positive water flow — unless their own stock is
  // critical, in which case survival triage overrides conservation.
  const canSpendWater = rates[ResourceKind.WATER] > 0.1 || R[ResourceKind.WATER] > 60;

  // Deadline-aware life support: address whichever supply empties soonest.
  // (Fixed water-first ordering dies when ice is several stepping stones
  // away but the oxygen tank has the nearest empty date.)
  const lifeTasks: { kind: ResourceKind; act: () => GameState | null }[] = [
    {
      kind: ResourceKind.WATER,
      act: () => pending(BuildingType.ICE_EXTRACTOR)
        ? null
        : reachFor(state, BuildingType.ICE_EXTRACTOR, TerrainType.ICE, 0, true),
    },
    {
      kind: ResourceKind.OXYGEN,
      act: () => !pending(BuildingType.OXYGENATOR) && (canSpendWater || R[ResourceKind.OXYGEN] < 18)
        ? tryOrder(state, BuildingType.OXYGENATOR, genericSite(state), 0, true)
        : null,
    },
    {
      kind: ResourceKind.FOOD,
      act: () => !pending(BuildingType.GREENHOUSE) && (canSpendWater || R[ResourceKind.FOOD] < 18)
        ? tryOrder(state, BuildingType.GREENHOUSE, genericSite(state), 0, true)
        : null,
    },
  ];
  const due = lifeTasks
    .filter(t => low(t.kind))
    .sort((a, b) => deadline(a.kind) - deadline(b.kind));
  for (const task of due) {
    const next = task.act();
    if (next) return next;
  }
  // 5. Housing ahead of demand — but only once life support actually holds,
  // so early credits go to survival instead of empty domes.
  const lifeOk =
    rates[ResourceKind.WATER] > 0.15 &&
    rates[ResourceKind.OXYGEN] > 0.15 &&
    rates[ResourceKind.FOOD] > 0.15;
  if (lifeOk && state.population >= housing - 1 && !pending(BuildingType.HABITAT)) {
    const next = tryOrder(state, BuildingType.HABITAT, genericSite(state), CREDIT_FLOOR);
    if (next) return next;
  }
  // 6-8. Industry and exports once life support holds. The credit gate keeps
  // a greenhouse's worth of budget (140cr) in reserve at all times.
  if ((!hasMine(state) || rates[ResourceKind.METAL] < 1.5) && R[ResourceKind.CREDITS] > 320) {
    const next = reachFor(state, BuildingType.MINING_RIG, TerrainType.ORES, 150);
    if (next) return next;
  }
  if (R[ResourceKind.CREDITS] > 420 && !pending(BuildingType.HE3_EXTRACTOR)) {
    const next = reachFor(state, BuildingType.HE3_EXTRACTOR, TerrainType.HE3, 80);
    if (next) return next;
  }
  if (R[ResourceKind.CREDITS] > 900) {
    const next = tryOrder(state, BuildingType.LAUNCH_PAD, genericSite(state), CREDIT_FLOOR);
    if (next) return next;
  }
  // 9. Prosperity fallback — keep the city growing.
  if (R[ResourceKind.CREDITS] > 700 && housing < 42 && !pending(BuildingType.HABITAT)) {
    const next = tryOrder(state, BuildingType.HABITAT, genericSite(state), CREDIT_FLOOR);
    if (next) return next;
  }
  // 10. Running out of serviced land — extend the maglev network outward.
  if (openSites(state).length < 2) {
    const frontier = state.board.filter(h =>
      !h.building && !h.construction &&
      TERRAIN_STYLES[h.terrain].buildable &&
      !isWithinReach(state.board, h)
    );
    const next = tryOrder(state, BuildingType.ROAD, railSiteToward(state, frontier));
    if (next) return next;
  }
  return state;
}

/** One autopilot pass. Call once per sol after the simulation tick. */
export function autopilotAct(state: GameState): GameState {
  return buildStep(cityStep(state));
}
