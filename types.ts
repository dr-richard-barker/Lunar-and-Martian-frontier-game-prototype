
export enum ResourceType {
  REGOLITH = 'REGOLITH', // For building concrete/infrastructure
  ICE = 'ICE',           // Water and fuel
  HE3 = 'HE3',           // Energy / High value
  SILICATES = 'SILICATES', // Tech components
  ORES = 'ORES',         // Metals
  DESERT = 'DESERT'      // No resource (Crater)
}

export interface Player {
  id: string;
  name: string;
  color: string;
  resources: Record<ResourceType, number>;
  score: number;
}

export interface HexData {
  id: number;
  q: number;
  r: number;
  type: ResourceType;
  value: number; // Dice roll value
}

export interface GameState {
  players: Player[];
  currentPlayerIndex: number;
  board: HexData[];
  turn: number;
  lastDiceRoll: number | null;
  logs: string[];
}
