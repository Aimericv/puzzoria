export const locales = ["en", "fr", "es", "de"] as const;
export type Locale = (typeof locales)[number];
export const gameIds = [
  "word",
  "rareword",
  "sudoku",
  "math",
  "2048",
  "mines",
  "wordsearch",
  "ranking",
  "guess",
  "rather",
  "quiz",
  "football",
] as const;
export type GameId = (typeof gameIds)[number];
// Word variants keep independent run IDs and records, but share one catalogue entry.
export const catalogGameIds = gameIds.filter((game) => game !== "rareword");
export const gameFamily = (game: GameId) => game === "rareword" ? "word" : game;
export const difficulties = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof difficulties)[number];
export type LetterState = "correct" | "present" | "absent";
export type PlayMode = "daily" | "practice" | "archive";
export type ChallengeContext = {
  roomId?: string;
  roomStartedAt?: string;
  friendId?: string;
  mode?: PlayMode;
  relatedContentId?: string;
  learnMoreUrl?: string;
};
export type WordChallenge = {
  kind: "word";
  id: string;
  date: string;
  locale: Locale;
  length: number;
  attempts: number;
  answer: string;
} & ChallengeContext;
export type SudokuChallenge = {
  kind: "sudoku";
  id: string;
  date: string;
  locale: Locale;
  difficulty: Difficulty;
  grid: number[];
  solution: number[];
} & ChallengeContext;
export type RareWordChallenge = Omit<WordChallenge, "kind"> & { kind: "rareword" };
export type RareWordDiscovery = { word: string; definition: string; origin: string; example: string; source: string };
export type MathChallenge = {
  kind: "math";
  id: string;
  date: string;
  locale: Locale;
  numbers: number[];
  target: number;
  reference: string;
} & ChallengeContext;
export type TileChallenge = {
  kind: "2048";
  id: string;
  date: string;
  locale: Locale;
  grid: number[];
  spawnSeed: string;
  moveLimit: number | null;
} & ChallengeContext;
export type MinesChallenge = {
  kind: "mines";
  id: string;
  date: string;
  locale: Locale;
  difficulty: Difficulty;
  size: number;
  mineCount: number;
  start: number;
  mines: number[];
} & ChallengeContext;
export type SearchChallenge = {
  kind: "wordsearch";
  id: string;
  date: string;
  locale: Locale;
  size: number;
  grid: string[];
  theme: string;
  words: string[];
  placements: { from: number; to: number }[];
} & ChallengeContext;
export type NewChallenge = TileChallenge | MinesChallenge | SearchChallenge;
export type Challenge =
  | WordChallenge
  | RareWordChallenge
  | SudokuChallenge
  | MathChallenge
  | NewChallenge
  | import("./knowledge-types").KnowledgeChallenge
  | import("./social-types").SocialChallenge;
export type PublicChallenge =
  | Omit<WordChallenge, "answer">
  | Omit<RareWordChallenge, "answer">
  | Omit<SudokuChallenge, "solution">
  | Omit<MathChallenge, "reference">
  | Omit<TileChallenge, "spawnSeed">
  | Omit<MinesChallenge, "mines">
  | Omit<SearchChallenge, "placements">
  | import("./knowledge-types").PublicKnowledge
  | import("./social-types").PublicSocialChallenge;
export type ResultDetails = {
  mathTarget?: number;
  mathValue?: number;
  mathDistance?: number;
  operations?: number;
  largestTile?: number;
  moves?: number;
  wordsFound?: number;
  wordsTotal?: number;
  botAttempts?: number;
  choicesCount?: number;
  answersFound?: number;
  answersTotal?: number;
};
export type Completion = ResultDetails & {
  knowledgeSet?: string;
  roomId?: string;
  wordLength?: number;
  maxAttempts?: number;
  numberRules?: "higher-lower" | "legacy" | "mixed";
  outcome?: "win" | "loss" | "draw";
  friendId?: string;
  challengeId: string;
  game: GameId;
  date: string;
  locale: Locale;
  success: boolean;
  duration: number;
  score: number;
  attempts?: number;
  completedAt: string;
  mode?: PlayMode;
  difficulty?: Difficulty;
  runId?: string;
  startedAt?: string;
  errors?: number;
  provenance?: "server" | "imported";
  eligible?: boolean;
  relatedContentId?: string;
  learnMoreUrl?: string;
};
export const isLocale = (v: string): v is Locale =>
  locales.includes(v as Locale);
export const isGameId = (v: string): v is GameId =>
  gameIds.includes(v as GameId);
export const isDifficulty = (v: string): v is Difficulty =>
  difficulties.includes(v as Difficulty);
