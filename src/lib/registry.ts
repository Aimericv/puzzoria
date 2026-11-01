import type { GameId, Locale } from "./types";
import { t, slugs } from "./i18n";
export const registry: Record<
  GameId,
  {
    category:
      | "wordCategory"
      | "rarewordCategory"
      | "sudokuCategory"
      | "mathCategory"
      | "tileCategory"
      | "minesCategory"
      | "searchCategory"
      | "rankingCategory"
      | "guessCategory"
      | "ratherCategory"
      | "quizCategory"
      | "footballCategory";
    // Knowledge games share the same catalogue contract as existing adapters.
    name:
      | "rarewordName"
      | "wordName"
      | "sudokuName"
      | "mathName"
      | "tileName"
      | "minesName"
      | "searchName"
      | "rankingName"
      | "guessName"
      | "ratherName"
      | "quizName"
      | "footballName";
    description:
      | "rarewordDesc"
      | "wordDesc"
      | "sudokuDesc"
      | "mathDesc"
      | "tileDesc"
      | "minesDesc"
      | "searchDesc"
      | "rankingDesc"
      | "guessDesc"
      | "ratherDesc"
      | "quizDesc"
      | "footballDesc";
    rules:
      | "rarewordRules"
      | "wordRules"
      | "sudokuRules"
      | "mathRules"
      | "tileRules"
      | "minesRules"
      | "searchRules"
      | "rankingRules"
      | "guessRules"
      | "ratherRules"
      | "quizRules"
      | "footballRules";
    minutes: string;
    locales: readonly Locale[];
    color: string;
  }
> = {
  quiz: { name:"quizName", description:"quizDesc", category:"quizCategory", rules:"quizRules", minutes:"1–3", locales:["en","fr","es","de"], color:"quiz" },
  football: { name:"footballName", description:"footballDesc", category:"footballCategory", rules:"footballRules", minutes:"1–3", locales:["en","fr","es","de"], color:"football" },
  rareword: { name: "rarewordName", description: "rarewordDesc", category: "rarewordCategory", rules: "rarewordRules", minutes: "3–8", locales: ["en", "fr", "es", "de"], color: "word" },
  ranking: {
    name: "rankingName",
    description: "rankingDesc",
    category: "rankingCategory",
    rules: "rankingRules",
    minutes: "1–3",
    locales: ["en", "fr", "es", "de"],
    color: "ranking",
  },
  guess: {
    name: "guessName",
    description: "guessDesc",
    category: "guessCategory",
    rules: "guessRules",
    minutes: "3–8",
    locales: ["en", "fr", "es", "de"],
    color: "guess",
  },
  rather: {
    name: "ratherName",
    description: "ratherDesc",
    category: "ratherCategory",
    rules: "ratherRules",
    minutes: "2–5",
    locales: ["en", "fr", "es", "de"],
    color: "rather",
  },
  "2048": {
    name: "tileName",
    description: "tileDesc",
    category: "tileCategory",
    rules: "tileRules",
    minutes: "5–15",
    locales: ["en", "fr", "es", "de"],
    color: "tiles",
  },
  mines: {
    name: "minesName",
    description: "minesDesc",
    category: "minesCategory",
    rules: "minesRules",
    minutes: "3–10",
    locales: ["en", "fr", "es", "de"],
    color: "mines",
  },
  wordsearch: {
    name: "searchName",
    description: "searchDesc",
    category: "searchCategory",
    rules: "searchRules",
    minutes: "3–8",
    locales: ["en", "fr", "es", "de"],
    color: "wordsearch",
  },
  word: {
    name: "wordName",
    description: "wordDesc",
    category: "wordCategory",
    rules: "wordRules",
    minutes: "3–5",
    locales: ["en", "fr", "es", "de"],
    color: "word",
  },
  sudoku: {
    name: "sudokuName",
    description: "sudokuDesc",
    category: "sudokuCategory",
    rules: "sudokuRules",
    minutes: "5–15",
    locales: ["en", "fr", "es", "de"],
    color: "sudoku",
  },
  math: {
    name: "mathName",
    description: "mathDesc",
    category: "mathCategory",
    rules: "mathRules",
    minutes: "3–8",
    locales: ["en", "fr", "es", "de"],
    color: "math",
  },
};
export const gameName = (game: GameId, locale: Locale) =>
  t(locale)[registry[game].name];
export function gameFromSlug(slug: string, locale: Locale): GameId | undefined {
  return (Object.keys(registry) as GameId[]).find(
    (id) => slugs[locale][id] === slug,
  );
}
