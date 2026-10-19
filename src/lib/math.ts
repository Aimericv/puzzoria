import { seededRandom } from "./random";
export type MathResult = {
  value: number;
  used: number[];
  operations: number;
  score: number;
  distance: number;
};
export function evaluateExpression(
  expression: string,
  numbers: number[],
  target: number,
  onOperation?: (a: number, operator: string, b: number, value: number) => void,
): MathResult {
  if (expression.length > 160 || !/^[\d\s()+*/×÷−-]+$/.test(expression))
    throw new Error("invalid");
  const input = expression
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-");
  const tokens = input.match(/\d+|[()+*/-]/g) ?? [];
  let index = 0,
    operations = 0;
  const used: number[] = [];
  function apply(a: number, op: string, b: number): number {
    const value =
      op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : a / b;
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error("integer");
    operations++;
    onOperation?.(a, op, b, value);
    return value;
  }
  function factor(): number {
    const token = tokens[index++];
    if (token === "(") {
      const value = sum();
      if (tokens[index++] !== ")") throw new Error("parentheses");
      return value;
    }
    if (!token || !/^\d+$/.test(token)) throw new Error("invalid");
    const value = Number(token);
    used.push(value);
    return value;
  }
  function product(): number {
    let value = factor();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const op = tokens[index++];
      value = apply(value, op, factor());
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const op = tokens[index++];
      value = apply(value, op, product());
    }
    return value;
  }
  const value = sum();
  if (index !== tokens.length || !used.length) throw new Error("invalid");
  const available = [...numbers];
  for (const n of used) {
    const i = available.indexOf(n);
    if (i === -1) throw new Error("numbers");
    available.splice(i, 1);
  }
  const distance = Math.abs(target - value);
  const score = Math.max(
    0,
    1000 - distance * 20 - Math.max(0, operations - 3) * 25,
  );
  return { value, used, operations, distance, score };
}
export function generateMath(seed: string) {
  const random = seededRandom(seed);
  const pick = (max: number) => 1 + Math.floor(random() * max);
  const a = [25, 50, 75, 100][Math.floor(random() * 4)],
    b = pick(9) + 1,
    c = pick(9),
    d = pick(9);
  const numbers = [a, b, c, d, pick(9), pick(9)];
  const reference = `(${a} × ${b}) + (${c} × ${d})`;
  return { numbers, target: a * b + c * d, reference };
}
export function generateVariedMath(seed: string) {
  const random = seededRandom(`${seed}:variety-v2`),
    pick = () => 1 + Math.floor(random() * 9);
  const a = [25, 50, 75, 100][Math.floor(random() * 4)],
    b = pick() + 1,
    c = pick(),
    d = pick();
  const mode = Math.floor(random() * 6),
    divisor = [5, 25][Math.floor(random() * 2)];
  const numbers = [a, mode === 5 ? divisor : b, c, d, pick(), pick()];
  const references = [
    `(${a} × ${b}) + ${c} + ${d}`,
    `(${a} + ${b}) × (${c} + ${d})`,
    `(${a} × ${b}) - ${c}`,
    `(${a} + ${c}) × ${b} - ${d}`,
    `${a} × (${b} + ${c}) + ${d}`,
    `(${a} ÷ ${divisor}) × (${c} + ${d})`,
  ];
  const reference = references[mode],
    target = evaluateExpression(reference, numbers, 0).value;
  return { numbers, reference, target };
}
