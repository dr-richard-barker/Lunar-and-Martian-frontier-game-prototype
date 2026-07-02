export enum TerrainType {
  REGOLITH = 'REGOLITH',   // Open plains — general construction
  ICE = 'ICE',             // Subsurface ice deposit — water extraction
  ORES = 'ORES',           // Metal-rich rock — mining
  SILICATES = 'SILICATES', // Reflective flats — boosts solar arrays
  HE3 = 'HE3',             // Helium-3 rich regolith — high-value export
  CRATER = 'CRATER'        // Impact crater — unbuildable, impassable
}

export enum BuildingType {
  CITY = 'CITY',
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

export interface HexData {
  id: number;
  q: number;
  r: number;
  terrain: TerrainType;
  building: BuildingType | null;
  /** Catan-style yield token (2-12, never 7). Null on craters. */
  diceValue: number | null;
  construction: Construction | null;
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
  /** Only one may exist in the colony. */
  unique?: boolean;
  /** Whether the player can construct it (the CITY cannot be built). */
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

export interface GameState {
  colonyName: string;
  sol: number;
  resources: Stockpile;
  population: number;
  board: HexData[];
  units: Unit[];
  cityQueue: QueueItem[];
  lastRoll: DiceRoll | null;
  logs: string[];
  milestones: string[];
  /** Internal counters for population growth/decline. */
  growthProgress: number;
  declineProgress: number;
  lastEventSol: number;
  /** Monotonic id source for units and queue items. */
  nextId: number;
}

export interface PowerReport {
  generated: number;
  consumed: number;
  /** 0..1 efficiency applied to production when under-powered. */
  factor: number;
}
