import type { ChallengeContext, Difficulty, Locale } from "./types";
export const socialIds = ["ranking", "guess", "rather"] as const;
export type SocialId = (typeof socialIds)[number];
export type LocalText = Record<Locale, string>;
export type RankedItem = { id: string; label: LocalText; emoji: string };
export type Dilemma = {
  id: string;
  category: string;
  a: LocalText;
  b: LocalText;
  tags: [string, string];
};
type Base = { id: string; date: string; locale: Locale } & ChallengeContext;
export type RankingChallenge = Base & {
  kind: "ranking";
  dataset: string;
  category: string;
  items: RankedItem[];
};
export type RatherChallenge = Base & {
  kind: "rather";
  questions: Dilemma[];
  category: string;
};
export type GuessChallenge = Base & {
  kind: "guess";
  difficulty: Difficulty;
  secret: number;
  botSeed: string;
  rules?: "higher-lower";
};
export type SocialChallenge =
  | RankingChallenge
  | RatherChallenge
  | GuessChallenge;
export type PublicSocialChallenge =
  | RankingChallenge
  | RatherChallenge
  | Omit<GuessChallenge, "secret" | "botSeed">;
export type Predicate =
  | { kind: "above" | "below" | "multiple"; value: number }
  | { kind: "even" };
export type NumberAction =
  | { kind: "question"; predicate: Predicate }
  | { kind: "guess" | "try"; value: number };
export type NumberDirection = "higher" | "lower" | "found";
export type SocialAction =
  | { kind: "rank"; position: number }
  | { kind: "vote"; choice: "a" | "b" }
  | { kind: "finish" }
  | { kind: "secret"; value: number }
  | NumberAction;
export type NumberEvent = {
  actor: "you" | "bot";
  action: NumberAction;
  answer: boolean;
  direction?: NumberDirection;
  eliminated: number;
  remaining: number;
};
export type SocialState = {
  moves: number;
  actions: SocialAction[];
  completed: boolean;
  success: boolean;
  score: number;
  ranking: (string | null)[];
  votes: ("a" | "b")[];
  yourNumber: number | null;
  candidates: number[];
  botCandidates: number[];
  events: NumberEvent[];
  turns: number;
  opponentNumber?: number;
  visibleItems: RankedItem[];
};
export type RankingCommunity = {
  source?: "starter";
  kind: "ranking";
  samples: number;
  percentages: number[][];
  common: string[];
  average: { item: string; position: number }[];
  matched: number;
  unusual: number;
  swap: number;
  controversial: number;
  hasControversy: boolean;
};
export type VoteCommunity = {
  source?: "starter";
  id: string;
  samples: number;
  a: number;
  b: number;
  counts: [number, number];
  majority: "a" | "b" | null;
};
export type RatherCommunity = {
  source?: "starter";
  kind: "rather";
  questions: (VoteCommunity | null)[];
  matched: number | null;
  rarest: number | null;
  divisive: number | null;
  unusual: number | null;
  samples: number;
};
export type GuessCommunity = {
  source?: "starter";
  kind: "guess";
  samples: number;
  faster: number;
  fooled: number;
};
export type Community =
  | RankingCommunity
  | RatherCommunity
  | GuessCommunity
  | null;
