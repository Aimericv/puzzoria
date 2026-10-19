import type { PublicChallenge } from "./types";
export type FriendScore = {
  success: boolean;
  score: number;
  duration: number;
  attempts?: number;
};
export type FriendView = {
  id: string;
  challenge: PublicChallenge;
  host: FriendScore;
  you: FriendScore | null;
  isHost: boolean;
  expiresAt: number;
  peers: FriendScore[];
};
export function friendWinner(
  game: PublicChallenge["kind"],
  host: FriendScore,
  you: FriendScore,
): "you" | "friend" | "draw" {
  if (game === "2048" && you.score !== host.score)
    return you.score > host.score ? "you" : "friend";
  if (you.success !== host.success) return you.success ? "you" : "friend";
  if ((game === "word" || game === "rareword") && you.success && you.attempts !== host.attempts)
    return (you.attempts ?? 6) < (host.attempts ?? 6) ? "you" : "friend";
  if ((game === "math" || game === "2048") && you.score !== host.score)
    return you.score > host.score ? "you" : "friend";
  return you.duration === host.duration
    ? "draw"
    : you.duration < host.duration
      ? "you"
      : "friend";
}
