import { generateKnowledge } from "./server/knowledge-content";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  Challenge,
  Difficulty,
  GameId,
  Locale,
  PublicChallenge,
} from "./types";
import { validDate, DAY_MS } from "./date";
import { dictionaries, normalizeWord } from "./word";
import { seededRandom, shuffled } from "./random";
import {
  generateSudoku,
  generateRatedSudoku,
  solveSudoku,
  validSudoku,
} from "./sudoku";
import { evaluateExpression, generateMath, generateVariedMath } from "./math";
import { tileInitial } from "./tile2048";
import { generateMines, solveMines } from "./mines";
import { generateSearch, searchPath } from "./wordsearch";
import { generateSocial } from "./social-data";
import { rareWordFor, rareEntry, RARE_WORD_FROM } from "./rare-word";
export const NEW_GAMES_FROM = "2026-10-03";
export const gameAvailable = (game: GameId, date: string) =>
  game === "quiz" || game === "football" ? date >= "2026-11-01" : game === "rareword" ? date >= RARE_WORD_FROM : !["2048", "mines", "wordsearch", "ranking", "guess", "rather"].includes(
    game,
  ) || date >= NEW_GAMES_FROM;
export const ENGAGEMENT_CONTENT_FROM = "2026-10-04";
export function generateChallenge(
  game: GameId,
  locale: Locale,
  date: string,
  difficulty: Difficulty = "easy",
  practiceSeed?: string,
  category?: string,
): Challenge {
  if (!validDate(date)) throw new Error("Invalid date");
  if (game === "quiz" || game === "football") {
    if (!practiceSeed) throw new Error("Knowledge games are Practice-only");
    return generateKnowledge(game, locale, date, practiceSeed, category);
  }
  if (game === "ranking" || game === "rather" || game === "guess")
    return generateSocial(
      game,
      locale,
      date,
      difficulty,
      practiceSeed,
      category,
    );
  const improved = !!practiceSeed || date >= ENGAGEMENT_CONTENT_FROM;
  // Universal games share their puzzle across languages. Words use independent dictionaries and seeds.
  const id = practiceSeed
    ? `practice:${game}:${practiceSeed}:${game === "word" || game === "rareword" || game === "wordsearch" ? locale : "universal"}${game === "sudoku" || game === "mines" ? `:${difficulty}` : ""}`
    : `${game}:${date}:${game === "word" || game === "rareword" || game === "wordsearch" ? locale : "universal"}${game === "sudoku" || game === "mines" ? `:${difficulty}` : ""}`;
  const base = {
    id,
    date,
    locale,
    ...(practiceSeed ? { mode: "practice" as const } : {}),
  };
  if (game === "rareword") {
    const answer = rareWordFor(locale, date, practiceSeed).word;
    const length = normalizeWord(answer).length;
    return { ...base, kind: "rareword", answer, length, attempts: length <= 8 ? 8 : 10 };
  }
  if (game === "2048")
    return {
      ...base,
      kind: "2048",
      grid: tileInitial(id),
      spawnSeed: id + ":spawns-v1",
      moveLimit: practiceSeed ? null : 100,
    };
  if (game === "mines")
    return {
      ...base,
      kind: "mines",
      difficulty,
      ...generateMines(id, difficulty),
    };
  if (game === "wordsearch")
    return { ...base, kind: "wordsearch", ...generateSearch(id, locale) };
  if (game === "word") {
    const dictionary = dictionaries[locale];
    const source =
      !practiceSeed && date < dictionary.answersFrom
        ? dictionary.legacyAnswers
        : dictionary.answers;
    const words = source.filter((w) => normalizeWord(w).length === 5);
    const day = Math.floor(
        (Date.parse(date) - Date.parse(ENGAGEMENT_CONTENT_FROM)) / DAY_MS,
      ),
      cycle = Math.floor(day / words.length);
    const deck =
      improved && !practiceSeed
        ? shuffled(words, seededRandom(`word-deck-v2:${locale}:${cycle}`))
        : words;
    if (
      improved &&
      !practiceSeed &&
      cycle > 0 &&
      deck[0] ===
        shuffled(words, seededRandom(`word-deck-v2:${locale}:${cycle - 1}`)).at(
          -1,
        )
    )
      [deck[0], deck[1]] = [deck[1], deck[0]];
    const answer =
      improved && !practiceSeed
        ? deck[day % words.length]
        : words[Math.floor(seededRandom(id)() * words.length)];
    return { ...base, kind: "word", length: 5, attempts: 6, answer };
  }
  if (game === "sudoku")
    return {
      ...base,
      kind: "sudoku",
      difficulty,
      ...(improved
        ? generateRatedSudoku(id, difficulty)
        : generateSudoku(id, difficulty)),
    };
  return {
    ...base,
    kind: "math",
    ...(improved ? generateVariedMath(id) : generateMath(id)),
  };
}
export function validateChallenge(challenge: Challenge): void {
  if (!validDate(challenge.date) || !challenge.id)
    throw new Error("Invalid challenge metadata");
  if (challenge.kind === "quiz") {
    if (challenge.items.length < 5 || challenge.items.length > 100 || new Set(challenge.items.map(i=>i.id)).size !== challenge.items.length || !Number.isInteger(challenge.seconds) || challenge.seconds < 30 || challenge.seconds > 600 || challenge.items.some(i=>!i.answer || !i.prompt || !i.aliases.length)) throw new Error("Invalid quiz");
  } else if (challenge.kind === "football") {
    if (!challenge.answer || challenge.clubs.length < 2 || challenge.attempts !== 6 || !challenge.sources.length) throw new Error("Invalid football career");
  } else if (challenge.kind === "ranking") {
    if (
      challenge.items.length !== 5 ||
      new Set(challenge.items.map((i) => i.id)).size !== 5
    )
      throw new Error("Invalid ranking");
  } else if (challenge.kind === "rather") {
    if (
      challenge.questions.length < 5 ||
      challenge.questions.length > 10 ||
      new Set(challenge.questions.map((q) => q.id)).size !==
        challenge.questions.length
    )
      throw new Error("Invalid dilemmas");
  } else if (challenge.kind === "guess") {
    if (
      !Number.isInteger(challenge.secret) ||
      challenge.secret < 1 ||
      challenge.secret > 100 ||
      !challenge.botSeed
    )
      throw new Error("Invalid number duel");
  } else if (challenge.kind === "rareword") {
    rareEntry(challenge.locale, challenge.answer);
    if (challenge.length < 7 || challenge.length > 10 || normalizeWord(challenge.answer).length !== challenge.length || challenge.attempts !== (challenge.length <= 8 ? 8 : 10)) throw new Error("Invalid unusual word");
  } else if (challenge.kind === "word") {
    if (
      !dictionaries[challenge.locale].answers.some(
        (answer) => normalizeWord(answer) === normalizeWord(challenge.answer),
      ) ||
      normalizeWord(challenge.answer).length !== 5 ||
      challenge.attempts !== 6 ||
      challenge.length !== 5
    )
      throw new Error("Invalid word");
  } else if (challenge.kind === "sudoku") {
    const solved = solveSudoku(challenge.grid);
    if (
      solved.count !== 1 ||
      !validSudoku(challenge.solution, true) ||
      challenge.grid.some((n, i) => n && n !== challenge.solution[i]) ||
      solved.solution?.some((n, i) => n !== challenge.solution[i])
    )
      throw new Error("Invalid Sudoku");
  } else if (challenge.kind === "2048") {
    if (
      challenge.grid.length !== 16 ||
      challenge.grid.filter(Boolean).length !== 2 ||
      challenge.grid.some((n) => ![0, 2, 4].includes(n)) ||
      !challenge.spawnSeed ||
      ![null, 100].includes(challenge.moveLimit)
    )
      throw new Error("Invalid 2048");
  } else if (challenge.kind === "mines") {
    if (
      new Set(challenge.mines).size !== challenge.mineCount ||
      challenge.mines.some(
        (i) => !Number.isInteger(i) || i < 0 || i >= challenge.size ** 2,
      ) ||
      challenge.mines.includes(challenge.start) ||
      !solveMines(challenge.size, challenge.mines, challenge.start)
    )
      throw new Error("Invalid minefield");
  } else if (challenge.kind === "wordsearch") {
    if (
      challenge.grid.length !== challenge.size ** 2 ||
      challenge.grid.some((c) => !/^[A-Z]$/.test(c)) ||
      challenge.words.length !== 8 ||
      new Set(challenge.words).size !== 8 ||
      challenge.placements.length !== 8 ||
      challenge.words.some(
        (w, i) =>
          searchPath(
            challenge.placements[i].from,
            challenge.placements[i].to,
            challenge.size,
          )
            .map((n) => challenge.grid[n])
            .join("") !== w,
      )
    )
      throw new Error("Invalid word search");
  } else if (
    evaluateExpression(challenge.reference, challenge.numbers, challenge.target)
      .distance !== 0
  )
    throw new Error("Invalid math reference");
}
export async function getChallenge(
  game: GameId,
  locale: Locale,
  date: string,
  difficulty: Difficulty = "easy",
): Promise<Challenge> {
  const filename = path.join(
    process.cwd(),
    "content",
    "daily",
    date,
    `${locale}-${game}${game === "sudoku" || game === "mines" || game === "guess" ? `-${difficulty}` : ""}.json`,
  );
  try {
    const scheduled: Challenge = JSON.parse(await readFile(filename, "utf8"));
    if (
      scheduled.kind !== game ||
      scheduled.locale !== locale ||
      scheduled.date !== date ||
      ((scheduled.kind === "sudoku" ||
        scheduled.kind === "mines" ||
        scheduled.kind === "guess") &&
        scheduled.difficulty !== difficulty)
    )
      throw new Error("Mismatched scheduled content");
    validateChallenge(scheduled);
    return scheduled;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return generateChallenge(game, locale, date, difficulty);
}
export function publicChallenge(c: Challenge): PublicChallenge {
  if (c.kind === "quiz") return {...c, items:c.items.map(({id,prompt})=>({id,prompt}))};
  if (c.kind === "football") {
    const {answer,aliases,sources,...publicData}=c;
    void answer; void aliases; void sources;
    return publicData;
  }
  if (c.kind === "ranking") return { ...c, items: c.items.slice(0, 1) };
  if (c.kind === "rather") return c;
  if (c.kind === "guess") {
    const { secret, botSeed, ...rest } = c;
    void secret;
    void botSeed;
    return rest;
  }
  if (c.kind === "2048") {
    const { spawnSeed: _secret, ...rest } = c;
    void _secret;
    return rest;
  }
  if (c.kind === "mines") {
    const { mines: _secret, ...rest } = c;
    void _secret;
    return rest;
  }
  if (c.kind === "wordsearch") {
    const { placements: _secret, ...rest } = c;
    void _secret;
    return rest;
  }
  if (c.kind === "word" || c.kind === "rareword") {
    const { answer: _answer, ...rest } = c;
    void _answer;
    return rest;
  }
  if (c.kind === "sudoku") {
    const { solution: _solution, ...rest } = c;
    void _solution;
    return rest;
  }
  const { reference: _reference, ...rest } = c;
  void _reference;
  return rest;
}
