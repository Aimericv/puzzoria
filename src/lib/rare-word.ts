import catalog from "../../content/rare-words/catalog.json" with { type: "json" };
import guesses from "../../content/rare-words/guesses.json" with { type: "json" };
import type { Locale, RareWordDiscovery } from "./types";
import { normalizeWord } from "./word-normalization";
import { DAY_MS } from "./date";
import { seededRandom } from "./random";
export const RARE_WORD_FROM = catalog.startsAt;
const allowed = Object.fromEntries(Object.entries(guesses).map(([locale, words]) => [locale, new Set(words as string[])])) as Record<Locale, Set<string>>;
export function rareEntry(locale: Locale, answer: string): RareWordDiscovery {
  const entry = catalog[locale].find(e => normalizeWord(e.word) === normalizeWord(answer));
  if (!entry) throw new Error("Unknown unusual word");
  return entry;
}
export function rareWordFor(locale: Locale, date: string, seed?: string) {
  const words = catalog[locale];
  const day = Math.floor((Date.parse(date) - Date.parse(RARE_WORD_FROM)) / DAY_MS);
  if (!seed && day < 0) throw new Error("Unpublished unusual word");
  return words[seed ? Math.floor(seededRandom(seed)() * words.length) : day % words.length];
}
export function acceptedRareWord(value: string, locale: Locale, length: number) {
  const word = normalizeWord(value);
  return word.length === length && (allowed[locale].has(word) || catalog[locale].some(e => normalizeWord(e.word) === word));
}
