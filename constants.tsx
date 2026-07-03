import {
  TerrainType, BuildingType, BuildingDef, ResourceKind, Stockpile, CityProduct, CityProductDef,
} from './types';

export const HEX_RADIUS = 60;
export const BOARD_RADIUS = 4;

/** Milliseconds per simulation tick (one "sol") at 1x speed. */
export const TICK_MS = 1800;

export const SAVE_KEY = 'lunar-frontier-save-v2';

/** Catan-style token pool, cycled over the board's non-crater tiles. */
export const DICE_TOKEN_POOL = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

/** Production multiplier when the sol's dice roll matches a tile's token. */
export const SURGE_MULTIPLIER = 2;

export const MAX_WORKERS = 5;
export const MAX_QUEUE = 4;
/** Hexes a worker rover travels per sol. */
export const WORKER_SPEED = 2;

export const TERRAIN_STYLES: Record<TerrainType, { color: string; icon: string; label: string; buildable: boolean }> = {
  [TerrainType.REGOLITH]: { color: '#64748b', icon: '🌑', label: 'Regolith Plain', buildable: true },
  [TerrainType.ICE]: { color: '#0ea5e9', icon: '❄️', label: 'Ice Deposit', buildable: true },
  [TerrainType.ORES]: { color: '#b45309', icon: '🌋', label: 'Ore Vein', buildable: true },
  [TerrainType.SILICATES]: { color: '#f59e0b', icon: '💎', label: 'Silicate Flats', buildable: true },
  [TerrainType.HE3]: { color: '#8b5cf6', icon: '⚡', label: 'Helium-3 Field', buildable: true },
  [TerrainType.CRATER]: { color: '#1e293b', icon: '☄️', label: 'Impact Crater', buildable: false },
};

export const RESOURCE_STYLES: Record<ResourceKind, { icon: string; label: string; color: string }> = {
  [ResourceKind.CREDITS]: { icon: '💰', label: 'Credits', color: '#facc15' },
  [ResourceKind.METAL]: { icon: '🔩', label: 'Metal', color: '#94a3b8' },
  [ResourceKind.WATER]: { icon: '💧', label: 'Water', color: '#38bdf8' },
  [ResourceKind.OXYGEN]: { icon: '💨', label: 'Oxygen', color: '#5eead4' },
  [ResourceKind.FOOD]: { icon: '🌾', label: 'Food', color: '#a3e635' },
};

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  [BuildingType.CITY]: {
    name: 'Colony Hub',
    icon: '🏛️',
    description: 'The beating heart of the frontier. Trains worker rovers, requests shuttles from Earth, and its recyclers eke out a trickle of metal and oxygen.',
    cost: {},
    power: 8,
    housing: 6,
    production: { [ResourceKind.METAL]: 0.25, [ResourceKind.OXYGEN]: 0.5 },
    buildable: false,
    buildSols: 0,
  },
  [BuildingType.SOLAR_ARRAY]: {
    name: 'Solar Array',
    icon: '🔆',
    description: 'Photovoltaic farm. Generates 5 MW — 8 MW on reflective silicate flats.',
    cost: { [ResourceKind.METAL]: 10, [ResourceKind.CREDITS]: 50 },
    power: 5,
    buildable: true,
    buildSols: 2,
  },
  [BuildingType.HABITAT]: {
    name: 'Habitat Dome',
    icon: '🏠',
    description: 'Pressurized living dome. Houses 6 colonists.',
    cost: { [ResourceKind.METAL]: 25, [ResourceKind.CREDITS]: 120 },
    power: -2,
    housing: 6,
    buildable: true,
    buildSols: 3,
  },
  [BuildingType.ICE_EXTRACTOR]: {
    name: 'Ice Extractor',
    icon: '🧊',
    description: 'Drills subsurface ice and melts it into water. Requires an ice deposit.',
    cost: { [ResourceKind.METAL]: 15, [ResourceKind.CREDITS]: 80 },
    power: -3,
    production: { [ResourceKind.WATER]: 2 },
    terrain: [TerrainType.ICE],
    buildable: true,
    buildSols: 3,
  },
  [BuildingType.OXYGENATOR]: {
    name: 'Oxygenator',
    icon: '💨',
    description: 'Electrolyzes water into breathable oxygen.',
    cost: { [ResourceKind.METAL]: 15, [ResourceKind.CREDITS]: 100 },
    power: -4,
    consumption: { [ResourceKind.WATER]: 0.5 },
    production: { [ResourceKind.OXYGEN]: 1.6 },
    buildable: true,
    buildSols: 3,
  },
  [BuildingType.GREENHOUSE]: {
    name: 'Greenhouse',
    icon: '🌱',
    description: 'Hydroponic farm dome. Grows food and releases a little oxygen.',
    cost: { [ResourceKind.METAL]: 15, [ResourceKind.CREDITS]: 140 },
    power: -3,
    consumption: { [ResourceKind.WATER]: 0.8 },
    production: { [ResourceKind.FOOD]: 1.4, [ResourceKind.OXYGEN]: 0.2 },
    buildable: true,
    buildSols: 3,
  },
  [BuildingType.MINING_RIG]: {
    name: 'Mining Rig',
    icon: '⛏️',
    description: 'Autonomous excavator. Extracts metal from ore veins.',
    cost: { [ResourceKind.METAL]: 10, [ResourceKind.CREDITS]: 160 },
    power: -4,
    production: { [ResourceKind.METAL]: 1.2 },
    terrain: [TerrainType.ORES],
    buildable: true,
    buildSols: 4,
  },
  [BuildingType.HE3_EXTRACTOR]: {
    name: 'He-3 Extractor',
    icon: '⚡',
    description: 'Harvests helium-3 for export to Earth fusion markets. Requires a helium-3 field.',
    cost: { [ResourceKind.METAL]: 35, [ResourceKind.CREDITS]: 320 },
    power: -6,
    production: { [ResourceKind.CREDITS]: 6 },
    terrain: [TerrainType.HE3],
    buildable: true,
    buildSols: 5,
  },
  [BuildingType.LAUNCH_PAD]: {
    name: 'Launch Pad',
    icon: '🛰️',
    description: 'Orbital cargo link. Sells surplus goods to Earth every sol. One per colony.',
    cost: { [ResourceKind.METAL]: 60, [ResourceKind.CREDITS]: 500 },
    power: -5,
    production: { [ResourceKind.CREDITS]: 3 },
    unique: true,
    buildable: true,
    buildSols: 6,
  },
};

export const CITY_PRODUCTS: Record<CityProduct, CityProductDef> = {
  [CityProduct.WORKER_ROVER]: {
    name: 'Worker Rover',
    icon: '🚜',
    description: 'A crewed construction rover. Drives to build sites and erects structures. Crewing it costs 1 colonist.',
    cost: { [ResourceKind.METAL]: 25, [ResourceKind.CREDITS]: 100 },
    buildSols: 4,
    popCost: 1,
  },
  [CityProduct.COLONIST_SHUTTLE]: {
    name: 'Colonist Shuttle',
    icon: '👨‍🚀',
    description: 'Charter a shuttle from Earth. Delivers 3 eager colonists to the frontier.',
    cost: { [ResourceKind.CREDITS]: 300 },
    buildSols: 8,
    popGain: 3,
  },
};

/** Bonus power for solar arrays placed on silicate flats. */
export const SILICATE_SOLAR_BONUS = 3;

/** Per-colonist consumption each sol. */
export const COLONIST_NEEDS: Partial<Stockpile> = {
  [ResourceKind.FOOD]: 0.2,
  [ResourceKind.WATER]: 0.15,
  [ResourceKind.OXYGEN]: 0.25,
};

/** Tax income per colonist each sol. */
export const COLONIST_TAX = 0.6;

/** Ticks of sustained surplus needed for a new colonist to arrive. */
export const GROWTH_TICKS = 5;

/** Ticks of total shortage before a colonist is lost. */
export const DECLINE_TICKS = 3;

export const INITIAL_RESOURCES: Stockpile = {
  [ResourceKind.CREDITS]: 600,
  [ResourceKind.METAL]: 60,
  [ResourceKind.WATER]: 50,
  [ResourceKind.OXYGEN]: 40,
  [ResourceKind.FOOD]: 50,
};

export const INITIAL_POPULATION = 5;

export const MILESTONES: { id: string; test: (pop: number, buildings: number) => boolean; message: string }[] = [
  { id: 'pop10', test: (pop) => pop >= 10, message: 'Milestone: 10 colonists. The frontier is taking root.' },
  { id: 'pop25', test: (pop) => pop >= 25, message: 'Milestone: 25 colonists. Official settlement status granted.' },
  { id: 'pop50', test: (pop) => pop >= 50, message: 'Milestone: 50 colonists. You are now a lunar city.' },
  { id: 'build10', test: (_pop, b) => b >= 10, message: 'Milestone: 10 structures online. Industrial backbone established.' },
  { id: 'build20', test: (_pop, b) => b >= 20, message: 'Milestone: 20 structures online. The grid glows from orbit.' },
];
