import { seededRandom, shuffled } from "./random";
import type { Difficulty } from "./types";
export function candidates(grid: number[], index: number): number[] {
  const row = Math.floor(index / 9),
    col = index % 9;
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
    (n) =>
      !grid.some(
        (v, i) =>
          v === n &&
          (Math.floor(i / 9) === row ||
            i % 9 === col ||
            (Math.floor(i / 27) === Math.floor(row / 3) &&
              Math.floor((i % 9) / 3) === Math.floor(col / 3))),
      ),
  );
}
export function validSudoku(grid: number[], complete = false): boolean {
  if (
    grid.length !== 81 ||
    grid.some((n) => !Number.isInteger(n) || n < (complete ? 1 : 0) || n > 9)
  )
    return false;
  return grid.every((n, i) => {
    if (!n) return true;
    const copy = [...grid];
    copy[i] = 0;
    return candidates(copy, i).includes(n);
  });
}
export function solveSudoku(
  grid: number[],
  limit = 2,
): { count: number; solution: number[] | null } {
  if (!validSudoku(grid)) return { count: 0, solution: null };
  let count = 0;
  let solution: number[] | null = null;
  const board = [...grid];
  function visit() {
    if (count >= limit) return;
    let best = -1,
      options: number[] = [];
    for (let i = 0; i < 81; i++)
      if (!board[i]) {
        const available = candidates(board, i);
        if (!available.length) return;
        if (best === -1 || available.length < options.length) {
          best = i;
          options = available;
          if (options.length === 1) break;
        }
      }
    if (best === -1) {
      count++;
      solution = [...board];
      return;
    }
    for (const n of options) {
      board[best] = n;
      visit();
      board[best] = 0;
      if (count >= limit) return;
    }
  }
  visit();
  return { count, solution };
}
export function generateSudoku(seed: string, difficulty: Difficulty) {
  const random = seededRandom(seed);
  const groups = () =>
    shuffled([0, 1, 2], random).flatMap((g) =>
      shuffled([0, 1, 2], random).map((i) => g * 3 + i),
    );
  const rows = groups(),
    cols = groups(),
    digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], random);
  const solution = rows.flatMap((r) =>
    cols.map((c) => digits[(r * 3 + Math.floor(r / 3) + c) % 9]),
  );
  const grid = [...solution];
  const clues = { easy: 43, medium: 34, hard: 27 }[difficulty];
  for (const i of shuffled(
    Array.from({ length: 81 }, (_, j) => j),
    random,
  )) {
    if (grid.filter(Boolean).length <= clues) break;
    const value = grid[i];
    grid[i] = 0;
    if (solveSudoku(grid).count !== 1) grid[i] = value;
  }
  return { grid, solution };
}
export type SudokuDeduction = {
  kind: "naked" | "hidden";
  index: number;
  digit: number;
  candidates: number[];
  unit?: "row" | "column" | "box";
};
export function findDeduction(grid: number[]): SudokuDeduction | null {
  if (!validSudoku(grid)) return null;
  const options = grid.map((n, i) => (n ? [] : candidates(grid, i)));
  const single = options.findIndex((values) => values.length === 1);
  if (single !== -1)
    return {
      kind: "naked",
      index: single,
      digit: options[single][0],
      candidates: options[single],
    };
  for (const unit of ["row", "column", "box"] as const)
    for (let group = 0; group < 9; group++) {
      const cells = Array.from({ length: 81 }, (_, i) => i).filter((i) =>
        unit === "row"
          ? Math.floor(i / 9) === group
          : unit === "column"
            ? i % 9 === group
            : Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3) === group,
      );
      for (let digit = 1; digit <= 9; digit++) {
        if (cells.some((i) => grid[i] === digit)) continue;
        const matches = cells.filter((i) => options[i].includes(digit));
        if (matches.length === 1)
          return {
            kind: "hidden",
            index: matches[0],
            digit,
            candidates: options[matches[0]],
            unit,
          };
      }
    }
  return null;
}
export function analyzeSudoku(grid: number[]) {
  const board = [...grid];
  let naked = 0,
    hidden = 0;
  const first = findDeduction(board);
  for (let i = 0; i < 81; i++) {
    const step = findDeduction(board);
    if (!step) break;
    board[step.index] = step.digit;
    if (step.kind === "naked") naked++;
    else hidden++;
  }
  const remaining = board.filter((n) => !n).length;
  const fallback = grid.findIndex((n) => !n);
  return {
    first,
    naked,
    hidden,
    remaining,
    fallback:
      fallback === -1
        ? null
        : { index: fallback, candidates: candidates(grid, fallback) },
    technique: remaining
      ? ("advanced" as const)
      : hidden
        ? ("hidden" as const)
        : ("naked" as const),
  };
}
export function generateRatedSudoku(seed: string, difficulty: Difficulty) {
  let best = generateSudoku(`${seed}:technique-v2:0`, difficulty),
    distance = Infinity;
  for (let attempt = 0; attempt < 8; attempt++) {
    const puzzle = attempt
      ? generateSudoku(`${seed}:technique-v2:${attempt}`, difficulty)
      : best;
    const analysis = analyzeSudoku(puzzle.grid);
    const score =
      difficulty === "easy"
        ? analysis.remaining * 100 + analysis.hidden
        : difficulty === "medium"
          ? analysis.remaining * 100 + (analysis.hidden ? 0 : 10)
          : analysis.remaining
            ? 0
            : 100 - analysis.hidden;
    if (score < distance) {
      best = puzzle;
      distance = score;
    }
    if (score === 0) break;
  }
  return best;
}
