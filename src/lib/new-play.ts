import type { NewChallenge, PublicChallenge } from "./types";
import { directions, slide, spawn, tileOver, type Direction } from "./tile2048";
import { reveal } from "./mines";
import { searchPath } from "./wordsearch";
export type PuzzleAction =
  | { kind: "move"; direction: Direction }
  | { kind: "reveal" | "flag"; index: number }
  | { kind: "select"; from: number; to: number };
export type PuzzleState = {
  grid: number[];
  flags: number[];
  found: string[];
  paths: number[][];
  score: number;
  moves: number;
  actions: PuzzleAction[];
  completed: boolean;
  success: boolean;
  mines?: number[];
};
export type PublicNewChallenge = Extract<
  PublicChallenge,
  { kind: "2048" | "mines" | "wordsearch" }
>;
export function initialPuzzle(c: PublicNewChallenge): PuzzleState {
  return {
    grid:
      c.kind === "2048"
        ? [...c.grid]
        : c.kind === "mines"
          ? Array(c.size * c.size).fill(-1)
          : [],
    flags: [],
    found: [],
    paths: [],
    score: 0,
    moves: 0,
    actions: [],
    completed: false,
    success: false,
  };
}
export function replayPuzzle(
  c: NewChallenge,
  input: unknown,
  bank = false,
): PuzzleState {
  if (!Array.isArray(input) || input.length > 10000) throw new Error("invalid");
  const state = initialPuzzle(c);
  for (const raw of input) {
    if (!raw || typeof raw !== "object" || state.completed)
      throw new Error("invalid");
    const a = raw as PuzzleAction;
    if (c.kind === "2048") {
      if (a.kind !== "move" || !directions.includes(a.direction))
        throw new Error("invalid");
      const next = slide(state.grid, a.direction);
      if (!next.changed) throw new Error("invalid");
      state.grid = spawn(next.grid, `${c.spawnSeed}:${state.moves}`);
      state.score += next.gain;
      state.moves++;
      state.completed =
        tileOver(state.grid) ||
        (c.moveLimit !== null && state.moves >= c.moveLimit);
      state.success =
        c.moveLimit !== null
          ? state.moves >= c.moveLimit
          : Math.max(...state.grid) >= 2048;
    } else if (c.kind === "mines") {
      if (
        (a.kind !== "reveal" && a.kind !== "flag") ||
        !Number.isInteger(a.index) ||
        a.index < 0 ||
        a.index >= c.size * c.size
      )
        throw new Error("invalid");
      if (!state.moves && (a.kind !== "reveal" || a.index !== c.start))
        throw new Error("invalid");
      if (state.grid[a.index] !== -1) throw new Error("invalid");
      if (a.kind === "flag") {
        if (state.flags.includes(a.index))
          state.flags = state.flags.filter((i) => i !== a.index);
        else {
          if (state.flags.length >= c.mineCount) throw new Error("invalid");
          state.flags.push(a.index);
        }
      } else {
        if (state.flags.includes(a.index)) throw new Error("invalid");
        state.grid = reveal(a.index, c.size, c.mines, state.grid, state.flags);
      }
      state.moves++;
      state.success =
        state.grid.filter((n) => n >= 0).length ===
        c.size * c.size - c.mineCount;
      state.completed = state.success || state.grid.includes(-2);
      state.score = state.success ? 1000 : 0;
      if (state.completed) state.mines = [...c.mines];
    } else {
      if (a.kind !== "select") throw new Error("invalid");
      const cells = searchPath(a.from, a.to, c.size),
        text = cells.map((i) => c.grid[i]).join(""),
        reversed = [...text].reverse().join(""),
        word = c.words.find((w) => w === text || w === reversed);
      if (!word || state.found.includes(word)) throw new Error("invalid");
      state.found.push(word);
      state.paths.push(cells);
      state.moves++;
      state.completed = state.found.length === c.words.length;
      state.success = state.completed;
      state.score = state.completed ? 1000 : 0;
    }
    // Canonicalise actions: extra client properties never enter progress or snapshots.
    state.actions.push(
      a.kind === "move"
        ? { kind: a.kind, direction: a.direction }
        : a.kind === "select"
          ? { kind: a.kind, from: a.from, to: a.to }
          : { kind: a.kind, index: a.index },
    );
  }
  if (bank) {
    if (c.kind !== "2048" || c.moveLimit !== null || !state.moves)
      throw new Error("invalid");
    state.completed = true;
    state.success = Math.max(...state.grid) >= 2048;
  }
  return state;
}
