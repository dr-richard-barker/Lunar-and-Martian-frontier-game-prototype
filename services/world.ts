import { GameState, ColonyEvent } from '../types';
import { tick } from './simulation';
import { autopilotFaction } from './autopilot';

export interface SolResult {
  state: GameState;
  event: ColonyEvent | null;
}

/**
 * Advance the world by one sol: run the simulation for every faction,
 * then let each rival AI place its orders.
 */
export function advanceSol(state: GameState): SolResult {
  const result = tick(state);
  let next = result.state;
  for (const faction of next.factions) {
    if (faction.isAI) next = autopilotFaction(next, faction.id);
  }
  return { state: next, event: result.event };
}
