import { GameState } from '../types';
import { SAVE_KEY } from '../constants';

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.board || typeof parsed.sol !== 'number') return null;
    if (!Array.isArray(parsed.factions) || parsed.factions.length === 0) return null;
    if (typeof parsed.boardRadius !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
