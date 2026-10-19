import type {
  PublicSocialChallenge,
  SocialAction,
  SocialChallenge,
  SocialState,
} from "./social-types";
import { allNumbers, botAction, numberStep, validNumber } from "./number-duel";
export function initialSocial(c: PublicSocialChallenge): SocialState {
  return {
    moves: 0,
    actions: [],
    completed: false,
    success: false,
    score: 0,
    ranking: Array(5).fill(null),
    votes: [],
    yourNumber: null,
    candidates: allNumbers(),
    botCandidates: allNumbers(),
    events: [],
    turns: 0,
    visibleItems: c.kind === "ranking" ? c.items.slice(0, 1) : [],
  };
}
export function replaySocial(c: SocialChallenge, input: unknown): SocialState {
  if (!Array.isArray(input) || input.length > 31) throw new Error("invalid");
  const state = initialSocial(c);
  for (const raw of input) {
    if (!raw || typeof raw !== "object" || state.completed)
      throw new Error("invalid");
    const a = raw as SocialAction;
    if (c.kind === "ranking") {
      if (
        a.kind !== "rank" ||
        !Number.isInteger(a.position) ||
        a.position < 1 ||
        a.position > 5 ||
        state.ranking[a.position - 1] !== null
      )
        throw new Error("invalid");
      state.ranking[a.position - 1] = c.items[state.moves].id;
      state.actions.push({ kind: "rank", position: a.position });
      state.completed = state.moves === 4;
      state.success = state.completed;
      state.visibleItems = c.items.slice(0, Math.min(5, state.moves + 2));
    } else if (c.kind === "rather") {
      if (
        a.kind === "finish" &&
        c.mode === "practice" &&
        state.votes.length > 0
      ) {
        state.completed = true;
        state.success = true;
        state.actions.push({ kind: "finish" });
        state.moves++;
        continue;
      }
      if (a.kind !== "vote" || !["a", "b"].includes(a.choice))
        throw new Error("invalid");
      state.votes.push(a.choice);
      state.actions.push({ kind: "vote", choice: a.choice });
      state.completed = state.votes.length === c.questions.length;
      state.success = state.completed;
    } else {
      if (state.yourNumber === null) {
        if (a.kind !== "secret" || !validNumber(a.value))
          throw new Error("invalid");
        state.yourNumber = a.value;
        state.actions.push({ kind: "secret", value: a.value });
      } else {
        if (c.rules === "higher-lower" && a.kind !== "try")
          throw new Error("invalid");
        const you = numberStep(state.candidates, c.secret, a);
        state.candidates = you.candidates;
        state.events.push({
          actor: "you",
          action: you.action,
          answer: you.answer,
          ...("direction" in you ? { direction: you.direction } : {}),
          eliminated: you.eliminated,
          remaining: you.candidates.length,
        });
        state.actions.push(you.action);
        state.turns++;
        if (you.action.kind !== "question" && you.answer) {
          state.completed = true;
          state.success = true;
        } else {
          const bot = numberStep(
            state.botCandidates,
            state.yourNumber,
            botAction(
              state.botCandidates,
              c.difficulty,
              c.botSeed + ":" + state.turns,
              a.kind === "try",
            ),
          );
          state.botCandidates = bot.candidates;
          state.events.push({
            actor: "bot",
            action: bot.action,
            answer: bot.answer,
            ...("direction" in bot ? { direction: bot.direction } : {}),
            eliminated: bot.eliminated,
            remaining: bot.candidates.length,
          });
          if (bot.action.kind !== "question" && bot.answer)
            state.completed = true;
        }
        if (state.turns >= 30) state.completed = true;
        if (state.completed) {
          state.opponentNumber = c.secret;
          state.score = state.success ? (31 - state.turns) * 30 : 0;
        }
      }
    }
    state.moves++;
  }
  return state;
}
