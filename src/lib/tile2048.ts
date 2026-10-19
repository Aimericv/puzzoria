import { seededRandom } from "./random";
export const directions = ["left", "right", "up", "down"] as const;
export type Direction = (typeof directions)[number];
export function slide(grid: number[], direction: Direction) {
  const next = [...grid];
  let gain = 0;
  for (let line = 0; line < 4; line++) {
    const indices = Array.from({ length: 4 }, (_, n) =>
      direction === "left"
        ? line * 4 + n
        : direction === "right"
          ? line * 4 + 3 - n
          : direction === "up"
            ? n * 4 + line
            : (3 - n) * 4 + line,
    );
    const values = indices.map((i) => grid[i]).filter(Boolean),
      merged: number[] = [];
    for (let i = 0; i < values.length; i++) {
      if (values[i] === values[i + 1]) {
        const value = values[i] * 2;
        merged.push(value);
        gain += value;
        i++;
      } else merged.push(values[i]);
    }
    indices.forEach((index, n) => {
      next[index] = merged[n] ?? 0;
    });
  }
  return { grid: next, gain, changed: next.some((n, i) => n !== grid[i]) };
}
export function spawn(grid: number[], seed: string) {
  const empty = grid.flatMap((n, i) => (n ? [] : [i])),
    next = [...grid],
    random = seededRandom(seed);
  if (empty.length)
    next[empty[Math.floor(random() * empty.length)]] = random() < 0.9 ? 2 : 4;
  return next;
}
export const tileInitial = (seed: string) =>
  spawn(spawn(Array(16).fill(0), seed + ":first"), seed + ":second");
export const tileOver = (grid: number[]) =>
  directions.every((d) => !slide(grid, d).changed);
