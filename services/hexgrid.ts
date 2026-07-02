import { Coord, HexData, TerrainType } from '../types';

export const HEX_DIRS: Coord[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

export function hexDistance(a: Coord, b: Coord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;
}

export function hexKey(c: Coord): string {
  return `${c.q},${c.r}`;
}

export function boardMap(board: HexData[]): Map<string, HexData> {
  const map = new Map<string, HexData>();
  for (const hex of board) map.set(hexKey(hex), hex);
  return map;
}

export function neighbors(board: HexData[], hex: Coord): HexData[] {
  const map = boardMap(board);
  return HEX_DIRS
    .map(d => map.get(hexKey({ q: hex.q + d.q, r: hex.r + d.r })))
    .filter((h): h is HexData => !!h);
}

/**
 * BFS shortest path over the board, avoiding craters.
 * Returns the list of steps (excluding start, including goal), or null.
 */
export function findPath(board: HexData[], from: Coord, to: Coord): Coord[] | null {
  const map = boardMap(board);
  const goal = map.get(hexKey(to));
  if (!goal || goal.terrain === TerrainType.CRATER) return null;
  if (from.q === to.q && from.r === to.r) return [];

  const cameFrom = new Map<string, string | null>();
  cameFrom.set(hexKey(from), null);
  const queue: Coord[] = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.q === to.q && current.r === to.r) {
      const path: Coord[] = [];
      let key: string | null = hexKey(current);
      while (key && cameFrom.get(key) !== null) {
        const [q, r] = key.split(',').map(Number);
        path.unshift({ q, r });
        key = cameFrom.get(key) ?? null;
      }
      return path;
    }
    for (const d of HEX_DIRS) {
      const next = { q: current.q + d.q, r: current.r + d.r };
      const nk = hexKey(next);
      const hex = map.get(nk);
      if (!hex || hex.terrain === TerrainType.CRATER || cameFrom.has(nk)) continue;
      cameFrom.set(nk, hexKey(current));
      queue.push(next);
    }
  }
  return null;
}
