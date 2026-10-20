import catalog from "../content/rare-words/catalog.json" with {type: "json"};
import {DAY_MS, utcDay} from "../src/lib/date";
import type {Locale} from "../src/lib/types";
import {normalizeWord} from "../src/lib/word-normalization";

// Each article is public after its answer's FIRST Daily day, including repeats.
// This E2E oracle deliberately avoids importing Next.js server modules.
export function articleIsPublished(locale: Locale, answer: string, today = utcDay()) {
  const index = catalog[locale].findIndex(a => normalizeWord(a.word) === normalizeWord(answer));
  if (index < 0) throw new Error("Article missing from the frozen editorial deck");
  return utcDay(new Date(Date.parse(catalog.startsAt) + (index + 1) * DAY_MS)) <= today;
}
