import { seededRandom } from "./random";
import type { Difficulty } from "./types";
import type { NumberAction, NumberDirection, Predicate } from "./social-types";
export const allNumbers = () => Array.from({ length: 100 }, (_, i) => i + 1);
export const validNumber = (n: unknown): n is number =>
  Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 100;
export const numberRuleSet = (state: { events: { action: NumberAction }[] }) =>
  state.events.some((event) => event.action.kind === "try")
    ? state.events.every((event) => event.action.kind === "try")
      ? "higher-lower"
      : "mixed"
    : "legacy";
export function validPredicate(v: unknown): v is Predicate {
  if (!v || typeof v !== "object" || !("kind" in v)) return false;
  const p = v as Predicate;
  return (
    p.kind === "even" ||
    (["above", "below"].includes(p.kind) &&
      "value" in p &&
      validNumber(p.value)) ||
    (p.kind === "multiple" &&
      Number.isInteger(p.value) &&
      p.value >= 2 &&
      p.value <= 10)
  );
}
export function matches(n: number, p: Predicate) {
  if (p.kind === "even") return n % 2 === 0;
  return p.kind === "above"
    ? n > p.value
    : p.kind === "below"
      ? n < p.value
      : n % p.value === 0;
}
export function numberStep(candidates: number[], secret: number, raw: unknown) {
  if (!raw || typeof raw !== "object") throw new Error("invalid");
  const action = raw as NumberAction;
  if (action.kind === "try") {
    if (!validNumber(action.value)) throw new Error("invalid");
    const direction: NumberDirection =
      secret === action.value
        ? "found"
        : secret > action.value
          ? "higher"
          : "lower";
    const next = candidates.filter((n) =>
      direction === "found"
        ? n === action.value
        : direction === "higher"
          ? n > action.value
          : n < action.value,
    );
    return {
      action: { kind: "try" as const, value: action.value },
      answer: direction === "found",
      direction,
      candidates: next,
      eliminated: candidates.length - next.length,
    };
  }
  if (action.kind === "guess") {
    if (!validNumber(action.value) || !candidates.includes(action.value))
      throw new Error("invalid");
    const answer = secret === action.value;
    const next = answer
      ? [secret]
      : candidates.filter((n) => n !== action.value);
    return {
      action: { kind: "guess" as const, value: action.value },
      answer,
      candidates: next,
      eliminated: candidates.length - next.length,
    };
  }
  if (action.kind !== "question" || !validPredicate(action.predicate))
    throw new Error("invalid");
  const yes = candidates.filter((n) => matches(n, action.predicate));
  if (!yes.length || yes.length === candidates.length)
    throw new Error("invalid");
  const answer = matches(secret, action.predicate),
    next = candidates.filter((n) => matches(n, action.predicate) === answer);
  const predicate: Predicate =
    action.predicate.kind === "even"
      ? { kind: "even" }
      : { kind: action.predicate.kind, value: action.predicate.value };
  return {
    action: { kind: "question" as const, predicate },
    answer,
    candidates: next,
    eliminated: candidates.length - next.length,
  };
}
export function botAction(
  candidates: number[],
  difficulty: Difficulty,
  seed: string,
  simple = false,
): NumberAction {
  const random = seededRandom(seed);
  if (simple) {
    const last = candidates.length - 1;
    const index =
      difficulty === "hard"
        ? Math.floor(last / 2)
        : difficulty === "medium"
          ? Math.floor(last / 4) +
            Math.floor(
              random() *
                (Math.floor((last * 3) / 4) - Math.floor(last / 4) + 1),
            )
          : Math.floor(random() * candidates.length);
    return { kind: "try", value: candidates[index] };
  }
  const guessAt = { easy: 12, medium: 4, hard: 1 }[difficulty];
  if (candidates.length <= guessAt)
    return {
      kind: "guess",
      value: candidates[Math.floor(random() * candidates.length)],
    };
  const predicates: Predicate[] = [];
  for (let value = 1; value < 100; value++) {
    if (difficulty !== "easy" || value % 20 === 0)
      predicates.push({ kind: "above", value });
  }
  if (difficulty === "hard") {
    predicates.push({ kind: "even" });
    for (let value = 2; value <= 10; value++)
      predicates.push({ kind: "multiple", value });
  }
  const usable = predicates
    .map((p) => ({ p, yes: candidates.filter((n) => matches(n, p)).length }))
    .filter((p) => p.yes > 0 && p.yes < candidates.length);
  if (!usable.length)
    return {
      kind: "guess",
      value: candidates[Math.floor(random() * candidates.length)],
    };
  usable.sort(
    (a, b) =>
      Math.abs(a.yes - candidates.length / 2) -
      Math.abs(b.yes - candidates.length / 2),
  );
  return {
    kind: "question",
    predicate:
      difficulty === "easy"
        ? usable[Math.floor(random() * usable.length)].p
        : usable[0].p,
  };
}
