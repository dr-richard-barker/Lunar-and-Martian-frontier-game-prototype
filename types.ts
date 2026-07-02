export enum TerrainType {
  REGOLITH = 'REGOLITH',   // Open plains — general construction
  ICE = 'ICE',             // Subsurface ice deposit — water extraction
  ORES = 'ORES',           // Metal-rich rock — mining
  SILICATES = 'SILICATES', // Reflective flats — boosts solar arrays
  HE3 = 'HE3',             // Helium-3 rich regolith — high-value export
  CRATER = 'CRATER'        // Impact crater — unbuildable
}

export enum BuildingType {
  LANDER = 'LANDER',
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

export interface HexData {
  id: number;
  q: number;
  r: number;
  terrain: TerrainType;
  building: BuildingType | null;
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
  /** Whether the player can construct it (LANDER cannot be built). */
  buildable: boolean;
}

export interface ColonyEvent {
  title: string;
  description: string;
  effect: string;
  impact?: Partial<Stockpile>;
}

export interface GameState {
  colonyName: string;
  sol: number;
  resources: Stockpile;
  population: number;
  board: HexData[];
  logs: string[];
  milestones: string[];
  /** Internal counters for population growth/decline. */
  growthProgress: number;
  declineProgress: number;
  lastEventSol: number;
}

export interface PowerReport {
  generated: number;
  consumed: number;
  /** 0..1 efficiency applied to production when under-powered. */
  factor: number;
}
