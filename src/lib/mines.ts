import { seededRandom, shuffled } from "./random";
import type { Difficulty } from "./types";
export const mineLevels = {
  easy: { size: 9, count: 10 },
  medium: { size: 12, count: 24 },
  hard: { size: 16, count: 50 },
};
export function neighbors(index: number, size: number) {
  const row = Math.floor(index / size),
    col = index % size,
    result: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (
        (dx || dy) &&
        row + dy >= 0 &&
        row + dy < size &&
        col + dx >= 0 &&
        col + dx < size
      )
        result.push((row + dy) * size + col + dx);
  return result;
}
export function reveal(
  index: number,
  size: number,
  mines: number[],
  board: number[],
  flags: number[] = [],
) {
  const next = [...board],
    bombs = new Set(mines),
    flagged = new Set(flags),
    queue = [index];
  while (queue.length) {
    const i = queue.pop()!;
    if (next[i] !== -1 || flagged.has(i)) continue;
    if (bombs.has(i)) {
      next[i] = -2;
      continue;
    }
    const adjacent = neighbors(i, size),
      count = adjacent.filter((n) => bombs.has(n)).length;
    next[i] = count;
    if (!count) queue.push(...adjacent.filter((n) => next[n] === -1));
  }
  return next;
}
// Only boards which this logical solver can finish are offered. No guessed cells.
export function solveMines(size: number, mines: number[], start: number) {
  let board = reveal(start, size, mines, Array(size * size).fill(-1));
  const flags = new Set<number>();
  for (let pass = 0; pass < size * size; pass++) {
    const constraints = board.flatMap((value, i) => {
      if (value < 0) return [];
      const ns = neighbors(i, size),
        cells = ns.filter((n) => board[n] === -1 && !flags.has(n));
      return cells.length
        ? [{ cells, count: value - ns.filter((n) => flags.has(n)).length }]
        : [];
    });
    const safe = new Set<number>(),
      bombs = new Set<number>();
    const deduce = (cells: number[], count: number) => {
      if (count === 0) cells.forEach((i) => safe.add(i));
      else if (count === cells.length) cells.forEach((i) => bombs.add(i));
    };
    for (const a of constraints) {
      deduce(a.cells, a.count);
      for (const b of constraints)
        if (
          a.cells.length < b.cells.length &&
          a.cells.every((i) => b.cells.includes(i))
        )
          deduce(
            b.cells.filter((i) => !a.cells.includes(i)),
            b.count - a.count,
          );
    }
    bombs.forEach((i) => flags.add(i));
    for (const i of safe) board = reveal(i, size, mines, board, [...flags]);
    if (board.filter((n) => n >= 0).length === size * size - mines.length)
      return true;
    if (!safe.size && !bombs.size) return false;
    if (
      !safe.size &&
      bombs.size &&
      constraints.every((c) => c.cells.every((i) => flags.has(i)))
    )
      return false;
  }
  return false;
}
export function generateMines(seed: string, difficulty: Difficulty) {
  const { size, count } = mineLevels[difficulty],
    start = Math.floor(size / 2) * size + Math.floor(size / 2),
    excluded = new Set([start, ...neighbors(start, size)]),
    cells = Array.from({ length: size * size }, (_, i) => i).filter(
      (i) => !excluded.has(i),
    );
  for (let attempt = 0; attempt < 300; attempt++) {
    const mines = shuffled(cells, seededRandom(`${seed}:mines:${attempt}`))
      .slice(0, count)
      .sort((a, b) => a - b);
    if (solveMines(size, mines, start))
      return { size, mineCount: count, start, mines };
  }
  throw new Error("Could not generate a logically solvable minefield");
}
