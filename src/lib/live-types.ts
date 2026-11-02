import type {
  Completion,
  Difficulty,
  GameId,
  Locale,
  PublicChallenge,
} from "./types";
import type { RankedItem } from "./social-types";
export const liveGames = [
  "word",
  "sudoku",
  "math",
  "2048",
  "mines",
  "wordsearch",
  "guess",
  "ranking",
  "rather",
  "quiz",
  "football",
] as const;
export type LiveGame = (typeof liveGames)[number];
export const liveGame = (game: GameId): LiveGame =>
  game === "rareword" ? "word" : game;
export const opinionGame = (game: string) =>
  game === "ranking" || game === "rather";
export type LivePlayer = {
  name: string;
  ready: boolean;
  online: boolean;
  finished: boolean;
  forfeit: boolean;
  progress: number;
  total: number;
  score: number;
  attempts: number;
  distance: number | null;
  duration: number | null;
  rematch: boolean;
  secretReady: boolean;
};
export type LiveView = {
  code: string;
  game: LiveGame;
  locale: Locale;
  difficulty: Difficulty;
  category: string;
  round: number;
  you: number;
  phase: "lobby" | "countdown" | "playing" | "finished";
  serverNow: number;
  startAt: number | null;
  endAt: number | null;
  resolvedAt: number | null;
  players: LivePlayer[];
  winner: number | null;
  reason: "completed" | "timeout" | "forfeit" | null;
  challenge?: PublicChallenge;
  runId?: string;
  completion?: Completion;
  wordAnswer?: string;
  footballAnswer?: string;
  footballSources?: string[];
  quizAnswers?: {prompt: string; answer: string}[];
  rankingItems?: RankedItem[];
  choices?: { ranking: (string | null)[]; votes: ("a" | "b")[] }[];
  ownSecret?: number | null;
  opponentSecret?: number | null;
  guesses?: { value: number; direction: "higher" | "lower" | "found" }[];
};
