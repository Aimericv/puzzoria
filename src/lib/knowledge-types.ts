import type { ChallengeContext, Locale } from "./types";

type Base = ChallengeContext & { id: string; date: string; locale: Locale; cohortKey: string };
export type QuizItem = { id: string; prompt: string; answer: string; aliases: string[] };
export type QuizChallenge = Base & { kind: "quiz"; topic: string; title: string; seconds: number; items: QuizItem[] };
export type ClubSpell = { club: string; years: string; loan?: boolean };
export type FootballChallenge = Base & { kind: "football"; clubs: ClubSpell[]; answer: string; aliases: string[]; attempts: number; sources: string[] };
export type KnowledgeChallenge = QuizChallenge | FootballChallenge;
export type PublicQuiz = Omit<QuizChallenge, "items"> & { items: Pick<QuizItem, "id" | "prompt">[] };
export type PublicFootball = Omit<FootballChallenge, "answer" | "aliases" | "sources">;
export type PublicKnowledge = PublicQuiz | PublicFootball;
export type KnowledgeAction = { kind: "answer"; value: string } | { kind: "finish" };
export type KnowledgeState = {
  actions: KnowledgeAction[];
  sequence: number;
  found: { id: string; answer: string }[];
  guesses: string[];
  feedback: "correct" | "duplicate" | "unknown" | null;
  completed: boolean;
  success: boolean;
  score: number;
  reveal?: { id: string; answer: string }[];
  answer?: string;
  sources?: string[];
};
export const initialKnowledge = (): KnowledgeState => ({ actions: [], sequence: 0, found: [], guesses: [], feedback: null, completed: false, success: false, score: 0 });
export const knowledgeGame = (kind: string): kind is "quiz" | "football" => kind === "quiz" || kind === "football";
export const normalizeAnswer = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/ß/g, "ss").replace(/[^\p{L}\p{N}]/gu, "");
