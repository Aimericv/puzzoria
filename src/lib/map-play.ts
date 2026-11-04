import { initialKnowledge, type KnowledgeState, type QuizChallenge } from "./knowledge-types";

// Called only for the new map format. All historical text-quiz replay stays unchanged.
export function replayMapQuiz(c: QuizChallenge, input: unknown): KnowledgeState {
  if (c.mapId !== "europe-v1" || !Array.isArray(input) || input.length > 501) throw Error("invalid");
  const state = initialKnowledge(), map = { index: 0, placements: [] } as NonNullable<KnowledgeState["map"]>;
  state.map = map;
  const regions = new Set(c.items.map(item => item.answer));
  for (const step of input) {
    if (state.completed || !step || typeof step !== "object") throw Error("invalid");
    if (step.kind === "finish") {
      state.actions.push({ kind: "finish" });state.completed = true;
    } else if (step.kind === "map-skip" || step.kind === "place" && typeof step.region === "string" && regions.has(step.region)) {
      const item = c.items[map.index];if (!item) throw Error("invalid");
      const chosen = step.kind === "place" ? step.region : null, correct = chosen === item.answer;
      state.actions.push(chosen === null ? { kind: "map-skip" } : { kind: "place", region: chosen });
      map.placements.push({ id: item.id, region: item.answer, chosen, correct, answer: item.prompt });
      if (correct) state.found.push({ id: item.id, answer: item.prompt });
      state.feedback = correct ? "correct" : "unknown";
      map.index++;state.completed = map.index === c.items.length;
    } else throw Error("invalid");
    state.sequence++;
    state.success = state.found.length === c.items.length;
    state.score = Math.round(state.found.length * 1000 / c.items.length);
  }
  if (state.completed) {
    state.reveal = c.items.map(item => ({ id: item.id, answer: item.prompt }));
    map.solution = c.items.map(item => ({ region: item.answer, answer: item.prompt }));
  }
  return state;
}
