import type { Challenge, ResultDetails } from "../types";
import type { PuzzleState } from "../new-play";
import type { SocialState } from "../social-types";

// Call only after validateProof: these values never come from browser summaries.
export function verifiedResultDetails(c: Challenge, result: Record<string, unknown>): ResultDetails {
  if (c.kind === "quiz") return {answersFound:(result.state as import("../knowledge-types").KnowledgeState).found.length, answersTotal:c.items.length};
  if (c.kind === "math") return {mathTarget:c.target, mathValue:result.value as number, mathDistance:result.distance as number, operations:result.operations as number};
  if (c.kind === "2048") {
    const state=result.state as PuzzleState;
    return {largestTile:Math.max(...state.grid),moves:state.moves};
  }
  if (c.kind === "wordsearch") return {wordsFound:(result.state as PuzzleState).found.length,wordsTotal:c.words.length};
  if (c.kind === "guess") return {botAttempts:(result.state as SocialState).events.filter(e=>e.actor==="bot").length};
  if (c.kind === "rather") return {choicesCount:(result.state as SocialState).votes.length};
  if (c.kind === "ranking") return {choicesCount:5};
  return {};
}
