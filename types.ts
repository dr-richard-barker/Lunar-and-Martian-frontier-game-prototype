export enum TerrainType {
  REGOLITH = 'REGOLITH',   // Open plains — general construction
  ICE = 'ICE',             // Subsurface ice deposit — water extraction
  ORES = 'ORES',           // Metal-rich rock — mining
  SILICATES = 'SILICATES', // Reflective flats — boosts solar arrays
  HE3 = 'HE3',             // Helium-3 rich regolith — high-value export
  CRATER = 'CRATER',       // Impact crater — unbuildable, impassable
  CANYON = 'CANYON',       // Mars: Valles Marineris — unbuildable, impassable chasm
  OLYMPUS = 'OLYMPUS'      // Mars: Olympus Mons — unbuildable, impassable shield volcano
}

export type World = 'MOON' | 'MARS';

export enum BuildingType {
  CITY = 'CITY',
  ROAD = 'ROAD',
  SOLAR_ARRAY = 'SOLAR_ARRAY',
  HABITAT = 'HABITAT',
  ICE_EXTRACTOR = 'ICE_EXTRACTOR',
  OXYGENATOR = 'OXYGENATOR',
  GREENHOUSE = 'GREENHOUSE',
  MINING_RIG = 'MINING_RIG',
  HE3_EXTRACTOR = 'HE3_EXTRACTOR',
  LAUNCH_PAD = 'LAUNCH_PAD'
}

export enum ResourceKind {
  CREDITS = 'CREDITS',
  METAL = 'METAL',
  WATER = 'WATER',
  OXYGEN = 'OXYGEN',
  FOOD = 'FOOD'
}

export type Stockpile = Record<ResourceKind, number>;

export interface Coord {
  q: number;
  r: number;
}

export type UnitState = 'idle' | 'moving' | 'constructing';

export interface Unit {
  id: number;
  q: number;
  r: number;
  /** Remaining steps to walk (excluding current position). */
  path: Coord[];
  /** Hex this unit is assigned to construct on, if any. */
  targetHexId: number | null;
  state: UnitState;
}

export enum CityProduct {
  WORKER_ROVER = 'WORKER_ROVER',
  COLONIST_SHUTTLE = 'COLONIST_SHUTTLE'
}

export interface QueueItem {
  id: number;
  product: CityProduct;
  remaining: number;
}

export interface Construction {
  type: BuildingType;
  remaining: number;
  total: number;
}

export enum UpgradeType {
  OVERCLOCK = 'OVERCLOCK',
  EFFICIENCY = 'EFFICIENCY',
  AMPLIFIER = 'AMPLIFIER'
}

export interface UpgradeDef {
  name: string;
  icon: string;
  description: string;
  cost: Partial<Stockpile>;
}

export interface HexData {
  id: number;
  q: number;
  r: number;
  terrain: TerrainType;
  building: BuildingType | null;
  /** Faction that owns the building/construction on this tile, if any. */
  owner: number | null;
  /** Catan-style yield token (2-12, never 7). Null on craters and hubs. */
  diceValue: number | null;
  construction: Construction | null;
  /** Installed building upgrades (max 2 of the 3 available). */
  upgrades: UpgradeType[];
}

export type Archetype = 'PIONEERS' | 'TRADERS' | 'RACERS' | 'AGRARIANS';

export interface Faction {
  id: number;
  name: string;
  /** Primary identity color (hex string) painted on structures, rails, rovers. */
  color: string;
  archetype: Archetype;
  isAI: boolean;
  cityHexId: number;
  resources: Stockpile;
  population: number;
  units: Unit[];
  cityQueue: QueueItem[];
  growthProgress: number;
  declineProgress: number;
}

export interface BuildingDef {
  name: string;
  icon: string;
  description: string;
  cost: Partial<Stockpile>;
  /** Net power in MW: positive = generates, negative = consumes. */
  power: number;
  housing?: number;
  /** Resources produced per sol (tick). */
  production?: Partial<Stockpile>;
  /** Resources consumed per sol (tick). */
  consumption?: Partial<Stockpile>;
  /** Terrain this building requires. Undefined = any buildable terrain. */
  terrain?: TerrainType[];
  /** Only one may exist per faction. */
  unique?: boolean;
  /** Whether it can be constructed (the CITY cannot be built). */
  buildable: boolean;
  /** Sols of on-site work a rover needs to finish it. */
  buildSols: number;
}

export interface CityProductDef {
  name: string;
  icon: string;
  description: string;
  cost: Partial<Stockpile>;
  buildSols: number;
  /** Colonists consumed to crew the unit on completion. */
  popCost?: number;
  /** Colonists delivered on completion. */
  popGain?: number;
}

export interface ColonyEvent {
  title: string;
  description: string;
  effect: string;
  impact?: Partial<Stockpile>;
}

export interface DiceRoll {
  d1: number;
  d2: number;
}

/** One dashboard sample per faction: population, structures, credits,
 * life-support reserve (min of water/oxygen/food stocks). */
export interface HistorySample {
  sol: number;
  f: { p: number; b: number; c: number; s: number }[];
}

export interface GameState {
  sol: number;
  world: World;
  boardRadius: number;
  board: HexData[];
  factions: Faction[];
  lastRoll: DiceRoll | null;
  logs: string[];
  milestones: string[];
  lastEventSol: number;
  /** Rolling time series for the performance dashboard. */
  history: HistorySample[];
  /** Monotonic id source for units and queue items across all factions. */
  nextId: number;
}

export interface PowerReport {
  generated: number;
  consumed: number;
  /** 0..1 efficiency applied to production when under-powered. */
  factor: number;
}

export interface NewGameOptions {
  boardRadius: number;
  aiCount: number;
  world: World;
}

export type VisualStyle = 'NEON' | 'NASA';
