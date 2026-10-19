import { difficulties, type Difficulty, type GameId, type Locale } from "./types";
import { rareWordCopy } from "./rare-word-i18n";

export const dailyGameIds = ["word", "rareword", "sudoku", "math", "mines"] as const;
export const SINGLE_SUDOKU_FROM = "2026-10-05";
export const dailyDifficulties = (game: GameId, date: string): readonly Difficulty[] =>
  game === "sudoku" ? date < SINGLE_SUDOKU_FROM ? difficulties : ["easy"] :
    game === "mines" || game === "guess" ? difficulties : ["easy"];
export const hasDaily = (game: GameId) =>
  (dailyGameIds as readonly GameId[]).includes(game);

// Keep already published puzzles accessible by their historical URLs.
export const DAILY_REMOVED_FROM = "2026-10-05";
export const historicalDailyAvailable = (game: GameId, date: string) =>
  hasDaily(game) || date < DAILY_REMOVED_FROM;

const goals: Record<Locale, Record<(typeof dailyGameIds)[number], string>> = {
  fr: {
    rareword: rareWordCopy("fr").dailyGoal,
    word: "Trouve le mot du jour en un minimum d’essais.",
    mines: "Termine la grille du jour le plus vite possible.",
    math: "Atteins la cible du jour plus vite que les autres.",
    sudoku: "Résous le Sudoku du jour et compare ton temps.",
  },
  en: {
    rareword: rareWordCopy("en").dailyGoal,
    word: "Find today’s word in as few guesses as possible.",
    mines: "Clear today’s board as quickly as possible.",
    math: "Reach today’s target faster than the other players.",
    sudoku: "Solve today’s Sudoku and compare your time.",
  },
  es: {
    rareword: rareWordCopy("es").dailyGoal,
    word: "Encuentra la palabra del día con el menor número de intentos.",
    mines: "Completa el tablero del día lo más rápido posible.",
    math: "Alcanza la cifra del día más rápido que los demás.",
    sudoku: "Resuelve el sudoku del día y compara tu tiempo.",
  },
  de: {
    rareword: rareWordCopy("de").dailyGoal,
    word: "Finde das Wort des Tages mit möglichst wenigen Versuchen.",
    mines: "Löse das Spielfeld des Tages so schnell wie möglich.",
    math: "Erreiche die Zielzahl des Tages schneller als die anderen.",
    sudoku: "Löse das Sudoku des Tages und vergleiche deine Zeit.",
  },
};
export const dailyGoal = (game: GameId, locale: Locale) =>
  hasDaily(game)
    ? goals[locale][game as (typeof dailyGameIds)[number]]
    : undefined;

export const unlimitedIntro = (locale: Locale) =>
  ({
    fr: "Joue autant de parties que tu veux. Tes parties et tes records sont sauvegardés.",
    en: "Play as many games as you like. Your progress and personal records are saved.",
    es: "Juega tantas partidas como quieras. Tu progreso y tus récords se guardan.",
    de: "Spiele so viele Runden, wie du möchtest. Dein Fortschritt und deine Rekorde werden gespeichert.",
  })[locale];
