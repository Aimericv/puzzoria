import { evaluateExpression } from "./math";
export type CalculationStep = {
  a: number;
  op: string;
  b: number;
  value: number;
};
function method(expression: string, numbers: number[], target: number) {
  const steps: CalculationStep[] = [];
  const result = evaluateExpression(
    expression,
    numbers,
    target,
    (a, op, b, value) => steps.push({ a, op, b, value }),
  );
  return {
    expression: expression.replace(/\*/g, "×").replace(/\//g, "÷"),
    steps,
    operations: result.operations,
  };
}
const fingerprint = (steps: CalculationStep[]) =>
  steps
    .map(
      ({ a, op, b, value }) =>
        `${op === "+" || op === "*" ? [a, b].sort((x, y) => x - y).join(",") : `${a},${b}`}:${op}:${value}`,
    )
    .sort()
    .join(";");
export function discoverMath(
  numbers: number[],
  target: number,
  reference: string,
  budget = 40000,
) {
  const original = method(reference, numbers, target),
    originalKey = fingerprint(original.steps);
  const maps = Array.from(
    { length: 1 << numbers.length },
    () => new Map<number, { expression: string; operations: number }>(),
  );
  numbers.forEach((number, i) =>
    maps[1 << i].set(number, { expression: String(number), operations: 0 }),
  );
  let spent = 0;
  for (let mask = 1; mask < maps.length; mask++) {
    for (let left = (mask - 1) & mask; left; left = (left - 1) & mask) {
      const right = mask ^ left;
      if (!right || left > right) continue;
      for (const [a, x] of maps[left])
        for (const [b, y] of maps[right]) {
          if (++spent > budget)
            return { ...original, alternative: false, searchLimited: true };
          const candidates: [number, string][] = [
            [a + b, `(${x.expression}+${y.expression})`],
            [a * b, `(${x.expression}*${y.expression})`],
            [a - b, `(${x.expression}-${y.expression})`],
            [b - a, `(${y.expression}-${x.expression})`],
            [a / b, `(${x.expression}/${y.expression})`],
            [b / a, `(${y.expression}/${x.expression})`],
          ];
          for (const [value, expression] of candidates) {
            if (!Number.isSafeInteger(value) || value <= 0 || value > 10000)
              continue;
            const operations = x.operations + y.operations + 1;
            if (
              value === target &&
              fingerprint(method(expression, numbers, target).steps) !==
                originalKey
            )
              return {
                ...method(expression, numbers, target),
                alternative: true,
                searchLimited: false,
              };
            if (
              !maps[mask].has(value) ||
              maps[mask].get(value)!.operations > operations
            )
              maps[mask].set(value, { expression, operations });
          }
        }
    }
  }
  return { ...original, alternative: false, searchLimited: false };
}
