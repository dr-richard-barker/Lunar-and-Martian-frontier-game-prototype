import { GameState, HexData, TerrainType, BuildingType, ResourceKind, CityProduct, Faction, Archetype, UpgradeType } from '../types';
import { BUILDINGS, TERRAIN_STYLES } from '../constants';
import {
  getRates, getPowerReport, getHousing, countBuildings, countRails, idleWorkers, isWithinReach,
  canBuild, canEnqueue, orderConstruction, enqueueProduct, canUpgrade, applyUpgrade, getActiveSet,
} from './simulation';
import { hexDistance } from './hexgrid';

/**
 * Colony AI director — drives autoplay for the player and every rival
 * faction. Each sol it makes at most one city order and one construction
 * order, prioritizing survival before industry. Archetype personas skew
 * the priorities: traders rush exports, racers sprawl rail and rovers,
 * agrarians overbuild farms and import settlers.
 */

interface Persona {
  fleetFor: (buildings: number) => number;
  he3At: number;
  padAt: number;
  shuttleAt: number;
  expandWhenSitesBelow: number;
  housingCap: number;
  foodTrigger: number;
  /** Extra appetite for laying rail beyond necessity. */
  railLove: boolean;
  /** Preferred module pair (in install order) and the credit comfort level to shop at. */
  upgradePair: [UpgradeType, UpgradeType];
  upgradeAt: number;
}

const PERSONAS: Record<Archetype, Persona> = {
  PIONEERS: {
    fleetFor: b => (b >= 8 ? 3 : 2), he3At: 420, padAt: 900, shuttleAt: 450,
    expandWhenSitesBelow: 2, housingCap: 42, foodTrigger: 0.35, railLove: false,
    upgradePair: [UpgradeType.EFFICIENCY, UpgradeType.OVERCLOCK], upgradeAt: 300,
  },
  TRADERS: {
    fleetFor: b => (b >= 10 ? 3 : 2), he3At: 340, padAt: 650, shuttleAt: 520,
    expandWhenSitesBelow: 2, housingCap: 36, foodTrigger: 0.35, railLove: false,
    upgradePair: [UpgradeType.OVERCLOCK, UpgradeType.AMPLIFIER], upgradeAt: 250,
  },
  RACERS: {
    fleetFor: b => (b >= 6 ? 4 : b >= 3 ? 3 : 2), he3At: 500, padAt: 1000, shuttleAt: 450,
    expandWhenSitesBelow: 5, housingCap: 36, foodTrigger: 0.35, railLove: true,
    upgradePair: [UpgradeType.OVERCLOCK, UpgradeType.EFFICIENCY], upgradeAt: 290,
  },
  AGRARIANS: {
    fleetFor: b => (b >= 8 ? 3 : 2), he3At: 520, padAt: 950, shuttleAt: 380,
    expandWhenSitesBelow: 2, housingCap: 60, foodTrigger: 0.6, railLove: false,
    upgradePair: [UpgradeType.EFFICIENCY, UpgradeType.AMPLIFIER], upgradeAt: 270,
  },
};

/** Credits kept in reserve for non-critical construction. */
const CREDIT_FLOOR = 120;

/** Terrain-occupancy penalty: generic buildings should not squat on mineral tiles. */
function terrainPenalty(terrain: TerrainType, preferred?: TerrainType): number {
  if (preferred && terrain === preferred) return 0;
  if (terrain === TerrainType.REGOLITH) return 1;
  if (terrain === TerrainType.SILICATES) return 2;
  return 4; // ICE / ORES / HE3 — save these for their extractors
}

function hubOf(state: GameState, faction: Faction): HexData {
  return state.board.find(h => h.id === faction.cityHexId)!;
}

function openSites(state: GameState, faction: Faction): HexData[] {
  return state.board.filter(h =>
    !h.building &&
    !h.construction &&
    TERRAIN_STYLES[h.terrain].buildable &&
    isWithinReach(state.board, faction, h)
  );
}

/** Best serviced site for a building that requires specific terrain. */
function resourceSite(state: GameState, faction: Faction, terrain: TerrainType): HexData | null {
  const hub = hubOf(state, faction);
  const sites = openSites(state, faction)
    .filter(h => h.terrain === terrain)
    .sort((a, b) => hexDistance(a, hub) - hexDistance(b, hub));
  return sites[0] ?? null;
}

/** Best serviced site for a generic building — near the hub, off minerals. */
function genericSite(state: GameState, faction: Faction, preferred?: TerrainType): HexData | null {
  const hub = hubOf(state, faction);
  const sites = openSites(state, faction).sort((a, b) => {
    const p = terrainPenalty(a.terrain, preferred) - terrainPenalty(b.terrain, preferred);
    if (p !== 0) return p;
    return hexDistance(a, hub) - hexDistance(b, hub);
  });
  return sites[0] ?? null;
}

/** The serviced open tile closest to any target — the next rail segment. */
function railSiteToward(state: GameState, faction: Faction, targets: HexData[]): HexData | null {
  if (targets.length === 0) return null;
  let best: HexData | null = null;
  let bestScore = Infinity;
  for (const site of openSites(state, faction)) {
    for (const target of targets) {
      const score = hexDistance(site, target) * 10 + terrainPenalty(site.terrain);
      if (score < bestScore) { bestScore = score; best = site; }
    }
  }
  return best;
}

function hasMine(state: GameState, faction: Faction): boolean {
  return state.board.some(h =>
    h.owner === faction.id &&
    (h.building === BuildingType.MINING_RIG || h.construction?.type === BuildingType.MINING_RIG)
  );
}

/** Metal held back for a future mining rig while none exists — released
 * entirely if rivals have claimed every ore tile (no rig will ever come). */
function metalReserve(state: GameState, faction: Faction): number {
  if (hasMine(state, faction)) return 0;
  const oreAvailable = state.board.some(h =>
    h.terrain === TerrainType.ORES && !h.building && !h.construction
  );
  return oreAvailable ? 12 : 0;
}

function tryOrder(
  state: GameState,
  faction: Faction,
  type: BuildingType,
  site: HexData | null,
  floor = 0,
  lifeSupport = false,
): GameState | null {
  if (!site) return null;
  const creditCost = BUILDINGS[type].cost[ResourceKind.CREDITS] ?? 0;
  if (faction.resources[ResourceKind.CREDITS] < creditCost + floor) return null;
  if (!lifeSupport && type !== BuildingType.MINING_RIG) {
    const metalCost = BUILDINGS[type].cost[ResourceKind.METAL] ?? 0;
    if (faction.resources[ResourceKind.METAL] < metalCost + metalReserve(state, faction)) return null;
  }
  if (!canBuild(state, faction.id, site, type).ok) return null;
  return orderConstruction(state, faction.id, site.id, type);
}

/** Claim a resource tile directly, or lay maglev track toward the nearest one. */
function reachFor(
  state: GameState,
  faction: Faction,
  type: BuildingType,
  terrain: TerrainType,
  floor = 0,
  lifeSupport = false,
): GameState | null {
  const site = resourceSite(state, faction, terrain);
  if (site) return tryOrder(state, faction, type, site, floor, lifeSupport);
  const targets = state.board.filter(h =>
    h.terrain === terrain && !h.building && !h.construction && !isWithinReach(state.board, faction, h)
  );
  return tryOrder(state, faction, BuildingType.ROAD, railSiteToward(state, faction, targets), floor, lifeSupport);
}

/** Colony Hub decisions: crisis shuttles, rover fleet, settler imports. */
function cityStep(state: GameState, faction: Faction, persona: Persona): GameState {
  const R = faction.resources;
  const crisisRates = getRates(state, faction);
  const shuttleQueued = faction.cityQueue.some(q => q.product === CityProduct.COLONIST_SHUTTLE);

  if (
    faction.population < 3 &&
    R[ResourceKind.WATER] > 25 && R[ResourceKind.OXYGEN] > 25 && R[ResourceKind.FOOD] > 25 &&
    crisisRates[ResourceKind.FOOD] > 0.4 && crisisRates[ResourceKind.OXYGEN] > 0.4 &&
    R[ResourceKind.CREDITS] >= 400 &&
    !shuttleQueued &&
    canEnqueue(state, faction.id, CityProduct.COLONIST_SHUTTLE).ok
  ) {
    return enqueueProduct(state, faction.id, CityProduct.COLONIST_SHUTTLE);
  }
  // Deep-pantry rescue: with big stockpiles, arrivals are safe even if the
  // (possibly power-throttled) production rates look weak right now.
  if (
    faction.population < 3 &&
    R[ResourceKind.WATER] > 60 && R[ResourceKind.OXYGEN] > 60 && R[ResourceKind.FOOD] > 60 &&
    R[ResourceKind.CREDITS] >= 400 &&
    !shuttleQueued &&
    canEnqueue(state, faction.id, CityProduct.COLONIST_SHUTTLE).ok
  ) {
    return enqueueProduct(state, faction.id, CityProduct.COLONIST_SHUTTLE);
  }
  if (
    faction.population === 0 &&
    R[ResourceKind.WATER] > 40 && R[ResourceKind.OXYGEN] > 40 && R[ResourceKind.FOOD] > 40 &&
    !shuttleQueued &&
    canEnqueue(state, faction.id, CityProduct.COLONIST_SHUTTLE).ok
  ) {
    return enqueueProduct(state, faction.id, CityProduct.COLONIST_SHUTTLE);
  }

  const suppliesOk =
    R[ResourceKind.FOOD] > 15 && R[ResourceKind.OXYGEN] > 15 && R[ResourceKind.WATER] > 15;
  const queuedRovers = faction.cityQueue.filter(q => q.product === CityProduct.WORKER_ROVER).length;
  const targetFleet = persona.fleetFor(countBuildings(state.board, faction.id));
  if (
    suppliesOk &&
    faction.units.length + queuedRovers < targetFleet &&
    faction.population >= 3 &&
    canEnqueue(state, faction.id, CityProduct.WORKER_ROVER).ok
  ) {
    return enqueueProduct(state, faction.id, CityProduct.WORKER_ROVER);
  }

  const rates = getRates(state, faction);
  const lifeSupportHealthy =
    rates[ResourceKind.WATER] > 0.3 &&
    rates[ResourceKind.OXYGEN] > 0.4 &&
    rates[ResourceKind.FOOD] > 0.3;
  if (
    lifeSupportHealthy &&
    faction.population + 3 <= getHousing(state.board, faction) &&
    !shuttleQueued &&
    R[ResourceKind.CREDITS] > persona.shuttleAt &&
    canEnqueue(state, faction.id, CityProduct.COLONIST_SHUTTLE).ok
  ) {
    return enqueueProduct(state, faction.id, CityProduct.COLONIST_SHUTTLE);
  }
  return state;
}

/** Construction decisions, in survival-first priority order. */
function buildStep(state: GameState, faction: Faction, persona: Persona): GameState {
  if (idleWorkers(faction).length === 0) return state;

  const rates = getRates(state, faction);
  const power = getPowerReport(state.board, faction);
  const housing = getHousing(state.board, faction);
  const R = faction.resources;
  const pending = (type: BuildingType) =>
    state.board.some(h => h.owner === faction.id && h.construction?.type === type);

  // 1. Power — everything else throttles without it. An actively overloaded
  // grid is a survival emergency and bypasses the mining metal reserve.
  if ((power.factor < 1 || power.generated - power.consumed < 3) && !pending(BuildingType.SOLAR_ARRAY)) {
    const next = tryOrder(
      state, faction, BuildingType.SOLAR_ARRAY,
      genericSite(state, faction, TerrainType.SILICATES),
      0, power.factor < 1,
    );
    if (next) return next;
  }
  // 1b. Metal emergency.
  if (!hasMine(state, faction) && R[ResourceKind.METAL] < 18) {
    const next = reachFor(state, faction, BuildingType.MINING_RIG, TerrainType.ORES, 0, true);
    if (next) return next;
  }

  // Deadline-aware life support.
  const pop = Math.max(faction.population, 4);
  const low = (kind: ResourceKind, trigger = 0.35) =>
    rates[kind] <= trigger || (R[kind] < pop * 5 && rates[kind] < 0.5);
  const deadline = (kind: ResourceKind) =>
    rates[kind] >= 0 ? Infinity : R[kind] / -rates[kind];
  const canSpendWater = rates[ResourceKind.WATER] > 0.1 || R[ResourceKind.WATER] > 60;

  const lifeTasks: { kind: ResourceKind; trigger?: number; act: () => GameState | null }[] = [
    {
      kind: ResourceKind.WATER,
      act: () => pending(BuildingType.ICE_EXTRACTOR)
        ? null
        : reachFor(state, faction, BuildingType.ICE_EXTRACTOR, TerrainType.ICE, 0, true),
    },
    {
      kind: ResourceKind.OXYGEN,
      act: () => !pending(BuildingType.OXYGENATOR) && (canSpendWater || R[ResourceKind.OXYGEN] < 18)
        ? tryOrder(state, faction, BuildingType.OXYGENATOR, genericSite(state, faction), 0, true)
        : null,
    },
    {
      kind: ResourceKind.FOOD,
      trigger: persona.foodTrigger,
      act: () => !pending(BuildingType.GREENHOUSE) && (canSpendWater || R[ResourceKind.FOOD] < 18)
        ? tryOrder(state, faction, BuildingType.GREENHOUSE, genericSite(state, faction), 0, true)
        : null,
    },
  ];
  const due = lifeTasks
    .filter(t => low(t.kind, t.trigger))
    .sort((a, b) => deadline(a.kind) - deadline(b.kind));
  for (const task of due) {
    const next = task.act();
    if (next) return next;
  }

  // Housing once life support holds.
  const lifeOk =
    rates[ResourceKind.WATER] > 0.15 &&
    rates[ResourceKind.OXYGEN] > 0.15 &&
    rates[ResourceKind.FOOD] > 0.15;
  if (lifeOk && faction.population >= housing - 1 && !pending(BuildingType.HABITAT)) {
    const next = tryOrder(state, faction, BuildingType.HABITAT, genericSite(state, faction), CREDIT_FLOOR);
    if (next) return next;
  }

  // Industry & exports.
  if ((!hasMine(state, faction) || rates[ResourceKind.METAL] < 1.5) && R[ResourceKind.CREDITS] > 320) {
    const next = reachFor(state, faction, BuildingType.MINING_RIG, TerrainType.ORES, 150);
    if (next) return next;
  }
  if (R[ResourceKind.CREDITS] > persona.he3At && !pending(BuildingType.HE3_EXTRACTOR)) {
    const next = reachFor(state, faction, BuildingType.HE3_EXTRACTOR, TerrainType.HE3, 80);
    if (next) return next;
  }
  if (R[ResourceKind.CREDITS] > persona.padAt) {
    const next = tryOrder(state, faction, BuildingType.LAUNCH_PAD, genericSite(state, faction), CREDIT_FLOOR);
    if (next) return next;
  }

  // Prosperity fallback.
  if (R[ResourceKind.CREDITS] > 700 && housing < persona.housingCap && !pending(BuildingType.HABITAT)) {
    const next = tryOrder(state, faction, BuildingType.HABITAT, genericSite(state, faction), CREDIT_FLOOR);
    if (next) return next;
  }

  // Racers: lay rail for the joy of it (and the speed).
  if (persona.railLove && R[ResourceKind.CREDITS] > 300 && R[ResourceKind.METAL] > 30 &&
    countRails(state.board, faction.id) < countBuildings(state.board, faction.id) * 2 + 4) {
    const frontier = state.board.filter(h =>
      !h.building && !h.construction && TERRAIN_STYLES[h.terrain].buildable &&
      !isWithinReach(state.board, faction, h)
    );
    const next = tryOrder(state, faction, BuildingType.ROAD, railSiteToward(state, faction, frontier));
    if (next) return next;
  }

  // Running out of serviced land — extend the network outward.
  if (openSites(state, faction).length < persona.expandWhenSitesBelow) {
    const frontier = state.board.filter(h =>
      !h.building && !h.construction && TERRAIN_STYLES[h.terrain].buildable &&
      !isWithinReach(state.board, faction, h)
    );
    const next = tryOrder(state, faction, BuildingType.ROAD, railSiteToward(state, faction, frontier));
    if (next) return next;
  }
  return state;
}

/** Install the persona's preferred modules on production buildings, one per sol. */
function upgradeStep(state: GameState, faction: Faction, persona: Persona): GameState {
  if (faction.resources[ResourceKind.CREDITS] < persona.upgradeAt) return state;
  // Never shop for modules during a population crisis — that budget is the
  // rescue shuttle's.
  if (faction.population < 4) return state;
  const vitals = getRates(state, faction);
  if (vitals[ResourceKind.FOOD] < 0 || vitals[ResourceKind.OXYGEN] < 0 || vitals[ResourceKind.WATER] < 0) return state;
  const active = getActiveSet(state.board, faction);
  // Upgrade the most valuable producers first: He-3, then mines, then the rest.
  const priority = (h: HexData) =>
    h.building === BuildingType.HE3_EXTRACTOR ? 0 :
    h.building === BuildingType.MINING_RIG ? 1 :
    h.building === BuildingType.LAUNCH_PAD ? 2 : 3;
  const candidates = state.board
    .filter(h =>
      h.owner === faction.id && h.building && active.has(h.id) &&
      h.building !== BuildingType.ROAD && h.building !== BuildingType.CITY &&
      BUILDINGS[h.building].production &&
      (h.upgrades?.length ?? 0) < persona.upgradePair.length &&
      persona.upgradePair.some(u => !(h.upgrades ?? []).includes(u))
    )
    .sort((a, b) => priority(a) - priority(b) || (a.upgrades?.length ?? 0) - (b.upgrades?.length ?? 0));
  for (const hex of candidates) {
    for (const upgrade of persona.upgradePair) {
      if ((hex.upgrades ?? []).includes(upgrade)) continue;
      if (canUpgrade(state, faction.id, hex, upgrade).ok) {
        return applyUpgrade(state, faction.id, hex.id, upgrade);
      }
    }
  }
  return state;
}

/** One autopilot pass for a faction. Call once per sol after tick(). */
export function autopilotFaction(state: GameState, factionId: number): GameState {
  const faction = state.factions[factionId];
  if (!faction) return state;
  const persona = PERSONAS[faction.archetype];
  let next = cityStep(state, faction, persona);
  next = buildStep(next, next.factions[factionId], persona);
  next = upgradeStep(next, next.factions[factionId], persona);
  return next;
}

/** Player autoplay (faction 0). */
export function autopilotAct(state: GameState): GameState {
  return autopilotFaction(state, 0);
}
