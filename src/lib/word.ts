import en from "../../content/dictionaries/en.json" with { type: "json" };
import fr from "../../content/dictionaries/fr.json" with { type: "json" };
import es from "../../content/dictionaries/es.json" with { type: "json" };
import de from "../../content/dictionaries/de.json" with { type: "json" };
import type { LetterState, Locale } from "./types";
import { normalizeWord } from "./word-normalization";
export { normalizeWord } from "./word-normalization";
export const dictionaries = { en, fr, es, de };
const accepted = Object.fromEntries(
  Object.entries(dictionaries).map(([locale, dictionary]) => [
    locale,
    new Set(
      [...dictionary.answers, ...dictionary.allowed]
        .map(normalizeWord)
        .filter((word) => word.length === 5),
    ),
  ]),
) as Record<Locale, Set<string>>;
export function acceptedWord(guess: string, locale: Locale): boolean {
  const normalized = normalizeWord(guess);
  return normalized.length === 5 && accepted[locale].has(normalized);
}
export function wordFeedback(guess: string, answer: string): LetterState[] {
  const g = normalizeWord(guess),
    a = normalizeWord(answer);
  if (g.length !== a.length) throw new Error("Invalid length");
  const result: LetterState[] = Array(g.length).fill("absent");
  const remaining = [...a];
  for (let i = 0; i < g.length; i++)
    if (g[i] === a[i]) {
      result[i] = "correct";
      remaining[i] = "";
    }
  for (let i = 0; i < g.length; i++)
    if (result[i] !== "correct") {
      const index = remaining.indexOf(g[i]);
      if (index !== -1) {
        result[i] = "present";
        remaining[index] = "";
      }
    }
  return result;
}
