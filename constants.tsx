import { TerrainType, BuildingType, BuildingDef, ResourceKind, Stockpile } from './types';

export const HEX_RADIUS = 60;
export const BOARD_RADIUS = 4;

/** Milliseconds per simulation tick (one "sol") at 1x speed. */
export const TICK_MS = 1800;

export const SAVE_KEY = 'lunar-frontier-save-v1';

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
  [BuildingType.LANDER]: {
    name: 'Landing Site',
    icon: '🚀',
    description: 'Your original descent vehicle. Provides emergency power and cramped crew quarters.',
    cost: {},
    power: 6,
    housing: 4,
    buildable: false,
  },
  [BuildingType.SOLAR_ARRAY]: {
    name: 'Solar Array',
    icon: '🔆',
    description: 'Photovoltaic farm. Generates 5 MW — 8 MW on reflective silicate flats.',
    cost: { [ResourceKind.METAL]: 10, [ResourceKind.CREDITS]: 50 },
    power: 5,
    buildable: true,
  },
  [BuildingType.HABITAT]: {
    name: 'Habitat Dome',
    icon: '🏠',
    description: 'Pressurized living dome. Houses 6 colonists.',
    cost: { [ResourceKind.METAL]: 25, [ResourceKind.CREDITS]: 120 },
    power: -2,
    housing: 6,
    buildable: true,
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
  },
  [BuildingType.GREENHOUSE]: {
    name: 'Greenhouse',
    icon: '🌱',
    description: 'Hydroponic farm dome. Grows food and releases a little oxygen.',
    cost: { [ResourceKind.METAL]: 20, [ResourceKind.CREDITS]: 140 },
    power: -3,
    consumption: { [ResourceKind.WATER]: 0.8 },
    production: { [ResourceKind.FOOD]: 1.4, [ResourceKind.OXYGEN]: 0.2 },
    buildable: true,
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
  [ResourceKind.WATER]: 25,
  [ResourceKind.OXYGEN]: 25,
  [ResourceKind.FOOD]: 25,
};

export const INITIAL_POPULATION = 4;

export const MILESTONES: { id: string; test: (pop: number, buildings: number) => boolean; message: string }[] = [
  { id: 'pop10', test: (pop) => pop >= 10, message: 'Milestone: 10 colonists. The frontier is taking root.' },
  { id: 'pop25', test: (pop) => pop >= 25, message: 'Milestone: 25 colonists. Official settlement status granted.' },
  { id: 'pop50', test: (pop) => pop >= 50, message: 'Milestone: 50 colonists. You are now a lunar city.' },
  { id: 'build10', test: (_pop, b) => b >= 10, message: 'Milestone: 10 structures online. Industrial backbone established.' },
  { id: 'build20', test: (_pop, b) => b >= 20, message: 'Milestone: 20 structures online. The grid glows from orbit.' },
];
