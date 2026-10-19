import type { Completion } from "./types";
import type { NumberAction, NumberDirection } from "./social-types";
export type RoomEvent = {
  player: number;
  action: NumberAction;
  answer: boolean;
  direction?: NumberDirection;
  eliminated: number;
  remaining: number;
};
export type RoomView = {
  rules?: "higher-lower";
  code: string;
  sequence: number;
  you: number;
  ready: boolean[];
  number: number | null;
  turn: number;
  completed: boolean;
  winner: number | null;
  candidates: number[];
  opponentCandidates: number[];
  events: RoomEvent[];
  expiresAt: number;
  numbers?: number[];
  completion?: Completion;
};
