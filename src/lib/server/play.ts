import { generateKnowledge } from "./knowledge-content";
import { replayKnowledge } from "../knowledge-play";
import { knowledgeGame, type KnowledgeAction, type KnowledgeState } from "../knowledge-types";
import { validQuizTopic } from "../knowledge-catalog";
import { randomUUID } from "node:crypto";
import {
  generateChallenge,
  getChallenge,
  publicChallenge,
  validateChallenge,
  gameAvailable,
} from "../challenges";
import { utcDay, publishedDate } from "../date";
import {
  isDifficulty,
  isGameId,
  isLocale,
  type Challenge,
  type Completion,
} from "../types";
import { acceptedWord, normalizeWord, wordFeedback } from "../word";
import { acceptedRareWord, rareEntry } from "../rare-word";
import { validSudoku } from "../sudoku";
import { evaluateExpression } from "../math";
import { database, transaction } from "./database";
import { ApiError, rateLimit } from "./http";
import type { Identity } from "./auth";
import { completionFromRow, saveResult, type ResultRow } from "./results";
import { comparisonStatistics, COMPARISON_MIN_SAMPLES, type Comparison } from "../statistics";
import { starterComparison, starterStatisticsEnabled } from "./starter-statistics";
import { verifiedResultDetails } from "./result-details";
import { replayPuzzle, type PuzzleState, type PuzzleAction } from "../new-play";
import { validSocialCategory } from "../social-categories";
import { replaySocial } from "../social-play";
import type { SocialAction, SocialState } from "../social-types";
import { recordSocialVotes } from "./community";
import { hasDaily, historicalDailyAvailable, dailyDifficulties } from "../game-modes";
import { numberRuleSet } from "../number-duel";

export type Run = {
  id: string;
  owner: string;
  user_id: string | null;
  guest_id: string;
  challenge_id: string;
  game: string;
  mode: Completion["mode"];
  challenge_json: string;
  started_at: string | null;
  created_at: string;
  progress_json: string;
  response_json: string | null;
};
type Progress = {
  guesses: string[];
  hints: number;
  errors?: number;
  recovered?: boolean;
  actions?: (PuzzleAction | SocialAction | KnowledgeAction)[];
  state?: PuzzleState | SocialState | KnowledgeState;
};
export function ownedRun(id: unknown, who: Identity): Run {
  if (typeof id !== "string" || id.length > 64) throw new ApiError("invalid");
  const run = database().prepare("SELECT * FROM runs WHERE id=?").get(id) as
    | Run
    | undefined;
  if (
    !run ||
    (who.user ? run.user_id !== who.user.id : run.owner !== who.owner)
  )
    throw new ApiError("unavailable", 404);
  return run;
}
function runPublic(run: Run) {
  const challenge = JSON.parse(run.challenge_json) as Challenge;
  const result = run.response_json ? JSON.parse(run.response_json) : undefined;
  if (result && (challenge.kind === "word" || challenge.kind === "rareword"))
    result.guesses = JSON.parse(run.progress_json).guesses;
  if (result && challenge.kind === "sudoku") result.grid = challenge.solution;
  return {
    runId: run.id,
    challenge: publicChallenge(challenge),
    startedAt: run.started_at,
    serverNow: Date.now(),
    ...(["2048", "mines", "wordsearch", "ranking", "guess", "rather", "quiz", "football"].includes(
      challenge.kind,
    )
      ? { progress: JSON.parse(run.progress_json).state ?? null }
      : {}),
    ...(result ? { result } : {}),
  };
}
export function getRun(id: unknown, who: Identity, live = false) {
  const run = ownedRun(id, who);
  if (JSON.parse(run.challenge_json).roomId && !live) throw new ApiError("forbidden", 403);
  return runPublic(run);
}
export async function createRun(body: Record<string, unknown>, who: Identity) {
  const { game, locale } = body,
    difficulty = body.difficulty ?? "easy",
    date = body.date ?? utcDay();
  if (
    typeof game !== "string" ||
    !isGameId(game) ||
    typeof locale !== "string" ||
    !isLocale(locale) ||
    typeof difficulty !== "string" ||
    !isDifficulty(difficulty) ||
    typeof date !== "string" ||
    !publishedDate(date) ||
    !gameAvailable(game, date)
  )
    throw new ApiError("invalid");
  const mode =
    body.mode === "archive" && date === utcDay() && hasDaily(game)
      ? "daily"
      : (body.mode ?? (date === utcDay() ? "daily" : "archive"));
  if (game === "rareword" && mode === "practice" && utcDay() >= "2026-10-05") throw new ApiError("invalid");
  if (
    !["daily", "archive", "practice"].includes(String(mode)) ||
    (mode === "daily" && (date !== utcDay() || !hasDaily(game))) ||
    (mode === "archive" && !historicalDailyAvailable(game, date)) ||
    (mode === "practice" && date !== utcDay())
  )
    throw new ApiError("invalid");
  if (game === "sudoku" && mode !== "practice" && !dailyDifficulties(game, date).includes(difficulty))
    throw new ApiError("invalid");
  rateLimit(`new-run:${who.owner}`, 120, 60000);
  if (
    (game === "quiz" && body.category !== undefined && (typeof body.category !== "string" || !validQuizTopic(body.category))) ||
    body.category !== undefined &&
    (typeof body.category !== "string" ||
      ((game === "ranking" || game === "rather") &&
        !validSocialCategory(body.category, game)))
  )
    throw new ApiError("invalid");

  const previous = mode === "practice" && knowledgeGame(game) && body.previousRunId ? JSON.parse(ownedRun(body.previousRunId,who).challenge_json) : undefined;
  const challenge =
    mode === "practice"
      ? knowledgeGame(game) ? generateKnowledge(game,locale,date,randomUUID(),typeof body.category === "string" ? body.category : undefined,previous) : generateChallenge(
          game,
          locale,
          date,
          difficulty,
          randomUUID(),
          typeof body.category === "string" ? body.category : undefined,
        )
      : await getChallenge(game, locale, date, difficulty);
  challenge.mode = mode as Completion["mode"];
  if (mode === "practice") validateChallenge(challenge);
  const id = randomUUID(),
    now = new Date().toISOString();
  database()
    .prepare(
      `INSERT OR IGNORE INTO runs(id,owner,user_id,guest_id,challenge_id,game,mode,challenge_json,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      who.owner,
      who.user?.id ?? null,
      who.guestId,
      challenge.id,
      game,
      String(mode),
      JSON.stringify(challenge),
      now,
    );
  const run = database()
    .prepare("SELECT * FROM runs WHERE owner=? AND challenge_id=?")
    .get(who.owner, challenge.id) as Run;
  return runPublic(run);
}
export function beginRun(id: unknown, who: Identity, live = false) {
  const run = ownedRun(id, who);
  if (JSON.parse(run.challenge_json).roomId && !live) throw new ApiError("forbidden", 403);
  database()
    .prepare("UPDATE runs SET started_at=COALESCE(started_at,?) WHERE id=?")
    .run(new Date().toISOString(), run.id);
  return getRun(run.id, who, live);
}
export function validateProof(
  challenge: Challenge,
  body: Record<string, unknown>,
) {
  if (challenge.kind === "quiz" || challenge.kind === "football") {
    try {
      const state = replayKnowledge(challenge, body.actions);
      return {state, success:state.success, completed:state.completed, score:state.score, ...(challenge.kind === "football" ? {attempts:state.guesses.length} : {})};
    } catch { throw new ApiError("invalid"); }
  }
  if (
    challenge.kind === "ranking" ||
    challenge.kind === "rather" ||
    challenge.kind === "guess"
  ) {
    try {
      const state = replaySocial(challenge, body.actions);
      return {
        state,
        success: state.success,
        completed: state.completed,
        score: state.score,
        ...(challenge.kind === "guess" ? { attempts: state.turns } : {}),
      };
    } catch {
      throw new ApiError("invalid");
    }
  }
  if (
    challenge.kind === "2048" ||
    challenge.kind === "mines" ||
    challenge.kind === "wordsearch"
  ) {
    try {
      const state = replayPuzzle(challenge, body.actions, body.bank === true);
      return {
        state,
        success: state.success,
        completed: state.completed,
        score: state.score,
      };
    } catch {
      throw new ApiError("invalid");
    }
  }
  if ((challenge.kind === "word" || challenge.kind === "rareword")) {
    const guesses = body.guesses;
    if (
      !Array.isArray(guesses) ||
      !guesses.length ||
      guesses.length > challenge.attempts ||
      guesses.some(
        (g) =>
          typeof g !== "string" ||
          g.length > 20 ||
          !(challenge.kind === "rareword" ? acceptedRareWord(g, challenge.locale, challenge.length) : acceptedWord(g, challenge.locale)),
      )
    )
      throw new ApiError("invalidWord");
    const normalized = guesses.map((g) => normalizeWord(g));
    const winningIndex = normalized.findIndex(
      (g) => g === normalizeWord(challenge.answer),
    );
    if (winningIndex !== -1 && winningIndex !== guesses.length - 1)
      throw new ApiError("invalid");
    const success = winningIndex !== -1,
      completed = success || guesses.length === challenge.attempts;
    return {
      rows: normalized.map((g) => wordFeedback(g, challenge.answer)),
      guesses: normalized,
      success,
      completed,
      score: success ? (challenge.attempts + 1 - guesses.length) * 100 : 0,
      attempts: guesses.length,
      ...(completed ? { answer: normalizeWord(challenge.answer), ...(challenge.kind === "rareword" ? { discovery: rareEntry(challenge.locale, challenge.answer) } : {}) } : {}),
    };
  }
  if (challenge.kind === "sudoku") {
    const grid = body.grid;
    if (
      !Array.isArray(grid) ||
      !validSudoku(grid, true) ||
      challenge.grid.some((n, i) => n && n !== grid[i])
    )
      throw new ApiError("sudokuInvalid");
    return { success: true, completed: true, score: 1000, grid };
  }
  try {
    if (typeof body.expression !== "string") throw new Error();
    const result = evaluateExpression(
      body.expression,
      challenge.numbers,
      challenge.target,
    );
    return {
      ...result,
      expression: body.expression,
      success: result.distance === 0,
      completed: true,
      reference: challenge.reference,
    };
  } catch {
    throw new ApiError("mathInvalid");
  }
}
export function submitRun(
  id: unknown,
  who: Identity,
  body: Record<string, unknown>,
  live: boolean | number = false,
) {
  rateLimit(`submit:${who.owner}`, 600, 60000);
  try {
    return transaction(() => {
      const run = ownedRun(id, who);
      if (JSON.parse(run.challenge_json).roomId && !live) throw new ApiError("forbidden", 403);
      if (run.response_json) return runPublic(run).result;
      if (!run.started_at) throw new ApiError("notStarted");
      const challenge: Challenge = JSON.parse(run.challenge_json),
        progress: Progress = JSON.parse(run.progress_json);
      if (
        challenge.kind === "2048" ||
        challenge.kind === "mines" ||
        challenge.kind === "wordsearch" ||
        challenge.kind === "ranking" ||
        challenge.kind === "guess" ||
        challenge.kind === "rather" || knowledgeGame(challenge.kind)
      ) {
        const prior = progress.actions ?? [];
        if (knowledgeGame(challenge.kind) && body.step && typeof body.step === "object" && "kind" in body.step && body.step.kind === "answer" && "value" in body.step && typeof body.step.value === "string") body = {...body, step:{kind:"answer",value:body.step.value.trim()}};
        if (body.step !== undefined) {
          if (
            body.sequence === prior.length - 1 &&
            JSON.stringify(body.step) === JSON.stringify(prior.at(-1)) &&
            progress.state
          )
            return {
              state: progress.state,
              completed: false,
              success: progress.state.success,
              score: progress.state.score,
            };
          if (body.sequence !== prior.length) throw new ApiError("invalid");
          body = { ...body, actions: [...prior, body.step] };
        } else if (body.bank === true) {
          if (body.sequence !== prior.length) throw new ApiError("invalid");
          body = { ...body, actions: prior };
        }
      }
      // Arrival time is authoritative: late answers can only close the saved quiz.
      if (challenge.kind === "quiz" && Date.now() >= Date.parse(run.started_at) + challenge.seconds * 1000) {
        body = {...body, actions:[...(progress.actions ?? []), {kind:"finish"}]};
      }
      const result = validateProof(challenge, body);
      if ("state" in result && result.state) {
        const actions = result.state.actions,
          prior = progress.actions ?? [];
        if (
          prior.some(
            (a, i) => JSON.stringify(a) !== JSON.stringify(actions[i]),
          ) ||
          actions.length > prior.length + 1 ||
          actions.length < prior.length
        )
          throw new ApiError("invalid");
        progress.actions = actions;
        progress.state = { ...result.state, actions: [] };
        database()
          .prepare("UPDATE runs SET progress_json=? WHERE id=?")
          .run(JSON.stringify(progress), run.id);
        if (
          challenge.kind === "ranking" ||
          challenge.kind === "rather" ||
          challenge.kind === "guess"
        )
          recordSocialVotes(
            challenge,
            result.state as SocialState,
            who.owner,
            run.id,
          );
      }
      if ((challenge.kind === "word" || challenge.kind === "rareword")) {
        const guesses = (body.guesses as string[]).map(normalizeWord);
        if (
          guesses.length === progress.guesses.length &&
          guesses.every((g, i) => progress.guesses[i] === g)
        )
          return result;
        if (
          progress.guesses.some((g, i) => guesses[i] !== g) ||
          guesses.length !== progress.guesses.length + 1
        ) {
          // One-time recovery of older local games stays personal and is excluded from competition/cohorts.
          if (!progress.guesses.length && guesses.length > 1)
            progress.recovered = true;
          else throw new ApiError("invalid");
        }
        progress.guesses = guesses;
        database()
          .prepare("UPDATE runs SET progress_json=? WHERE id=?")
          .run(JSON.stringify(progress), run.id);
      }
      if (!result.completed)
        return "state" in result && result.state
          ? { ...result, state: { ...result.state, actions: [] } }
          : result;
      const endTime = challenge.kind === "quiz" ? Math.min(Date.now(), Date.parse(run.started_at) + challenge.seconds * 1000) : Date.now();
      const completedAt = new Date(typeof live === "number" ? live : endTime).toISOString(),
        duration = Math.max(
          0,
          Math.floor(
            (Date.parse(completedAt) - Date.parse(run.started_at)) / 1000,
          ),
        );
      const minimum = {
        word: 3,
        rareword: 3,
        sudoku: 30,
        math: 5,
        "2048": 10,
        mines: 5,
        wordsearch: 10,
        ranking: 3,
        rather: 3,
        guess: 5,
        quiz: 3,
        football: 3,
      }[challenge.kind];
      const prior = database()
        .prepare("SELECT id FROM results WHERE owner=? AND challenge_id=?")
        .get(who.owner, challenge.id);
      const eligible =
        !prior &&
        challenge.kind !== "ranking" &&
        challenge.kind !== "rather" &&
        run.mode === "daily" &&
        challenge.date === utcDay(new Date(completedAt)) &&
        utcDay(new Date(run.started_at)) === challenge.date &&
        duration >= minimum &&
        duration <= 86400 &&
        progress.hints === 0 &&
        !progress.recovered;
      const completion: Completion = {
        ...(challenge.kind === "guess" && "state" in result
          ? {
              outcome: result.success
                ? ("win" as const)
                : (result.state as SocialState).events.at(-1)?.action.kind !==
                      "question" &&
                    (result.state as SocialState).events.at(-1)?.answer
                  ? ("loss" as const)
                  : ("draw" as const),
              numberRules: numberRuleSet(result.state as SocialState),
            }
          : {}),
        ...((challenge.kind === "word" || challenge.kind === "rareword") ? { wordLength: challenge.length, maxAttempts: challenge.attempts } : {}),
        ...verifiedResultDetails(challenge, result),
        ...((challenge.kind === "quiz" || challenge.kind === "football") ? {knowledgeSet:challenge.cohortKey} : {}),
        challengeId: challenge.id,
        game: challenge.kind,
        mode: run.mode,
        locale: challenge.locale,
        date: challenge.date,
        ...(challenge.kind === "sudoku" ||
        challenge.kind === "mines" ||
        challenge.kind === "guess"
          ? { difficulty: challenge.difficulty }
          : {}),
        startedAt: run.started_at,
        completedAt,
        duration,
        success: result.success,
        score: result.score,
        attempts: "attempts" in result ? result.attempts : undefined,
        errors: progress.errors ?? 0,
        provenance: "server",
        eligible,
        runId: run.id,
        friendId: challenge.friendId,
        roomId: challenge.roomId,
        relatedContentId: challenge.relatedContentId,
        learnMoreUrl: challenge.learnMoreUrl,
      };
      // Fast practice games are real personal results, but not comparison samples.
      const metadata = {
        details: verifiedResultDetails(challenge, result),
        ...((challenge.kind === "quiz" || challenge.kind === "football") ? {knowledgeSet:challenge.cohortKey} : {}),
        ...(completion.wordLength ? { wordLength: completion.wordLength, maxAttempts: completion.maxAttempts } : {}),
        ...(completion.outcome ? { outcome: completion.outcome } : {}),
        ...(challenge.kind === "guess" && "state" in result
          ? {
              botTurns: (result.state as SocialState).events.filter(
                (e) => e.actor === "bot",
              ).length,
              numberRules: completion.numberRules,
            }
          : {}),
        ...(challenge.friendId ? { friendId: challenge.friendId } : {}),
        ...(challenge.roomId ? { roomId: challenge.roomId } : {}),
        hints: progress.hints,
        recovered: !!progress.recovered,
        comparisonEligible:
          duration >= minimum &&
          duration <= 86400 &&
          progress.hints === 0 &&
          !progress.recovered &&
          !challenge.friendId,
        ...(challenge.relatedContentId
          ? { relatedContentId: challenge.relatedContentId }
          : {}),
        ...(challenge.learnMoreUrl
          ? { learnMoreUrl: challenge.learnMoreUrl }
          : {}),
      };
      saveResult(run.id, who, completion, metadata);
      const response = {
        ...result,
        ...("state" in result && result.state
          ? { state: { ...result.state, actions: [] } }
          : {}),
        completion,
      };
      database()
        .prepare("UPDATE runs SET response_json=? WHERE id=?")
        .run(JSON.stringify(response), run.id);
      return response;
    });
  } catch (error) {
    if (
      error instanceof ApiError &&
      ["invalidWord", "sudokuInvalid", "mathInvalid"].includes(error.code)
    ) {
      const run = ownedRun(id, who);
      database()
        .prepare(
          `UPDATE runs SET progress_json=json_set(progress_json,'$.errors',COALESCE(json_extract(progress_json,'$.errors'),0)+1) WHERE id=? AND response_json IS NULL`,
        )
        .run(run.id);
    }
    throw error;
  }
}
export function compareRun(id: unknown, who: Identity): Comparison | null {
  const run = ownedRun(id, who);
  const current = database()
    .prepare("SELECT * FROM results WHERE id=? AND provenance='server'")
    .get(run.id) as ResultRow | undefined;
  if (["ranking", "rather", "guess"].includes(run.game)) return null;
  if (!current) return null;
  const metadata=JSON.parse(current.metadata_json);
  if(metadata.friendId || (!metadata.comparisonEligible && !starterStatisticsEnabled())) return null;
  const rows = database()
    .prepare(
      `SELECT * FROM results WHERE game=? AND mode=? AND provenance='server'
    AND (game NOT IN ('word','rareword','wordsearch') OR locale=?) AND COALESCE(difficulty,'')=COALESCE(?,'')
    AND (mode!='daily' OR challenge_id=?) AND id!=? AND owner!=?
    AND (game!='rareword' OR (json_extract(metadata_json,'$.wordLength')=? AND json_extract(metadata_json,'$.maxAttempts')=?))
    AND (game NOT IN ('quiz','football') OR json_extract(metadata_json,'$.knowledgeSet')=?)
    AND json_extract(metadata_json,'$.comparisonEligible')=1 ORDER BY completed_at DESC LIMIT 10000`,
    )
    .all(
      current.game,
      current.mode,
      current.locale,
      current.difficulty ?? null,
      current.challenge_id,
      current.id,
      current.owner,
      JSON.parse(current.metadata_json).wordLength ?? null,
      JSON.parse(current.metadata_json).maxAttempts ?? null,
      metadata.knowledgeSet ?? null,
    ) as ResultRow[];
  // Each other account/device contributes its latest qualifying result once.
  const peers = new Map<string, ResultRow>();
  for (const row of rows) if (!peers.has(row.owner)) peers.set(row.owner, row);
  if(peers.size<COMPARISON_MIN_SAMPLES && starterStatisticsEnabled()) return starterComparison(completionFromRow(current));
  if(!metadata.comparisonEligible) return null;
  return comparisonStatistics(
    [...peers.values()].map(completionFromRow),
    completionFromRow(current),
  );
}

// Lightweight entitlement boundary; no ad provider, reward or unlock system is installed.
export function canUseHint(run: Run) {
  const progress: Progress = JSON.parse(run.progress_json);
  return (
    run.mode === "practice" &&
    !run.response_json &&
    !!run.started_at &&
    progress.hints < 1
  );
}
export function requestHint(id: unknown, who: Identity) {
  rateLimit(`hint:${who.owner}`, 20, 60000);
  return transaction(() => {
    const run = ownedRun(id, who);
    if (!canUseHint(run)) throw new ApiError("hintUnavailable", 409);
    const c: Challenge = JSON.parse(run.challenge_json),
      progress: Progress = JSON.parse(run.progress_json);
    progress.hints++;
    database()
      .prepare("UPDATE runs SET progress_json=? WHERE id=?")
      .run(JSON.stringify(progress), run.id);
    if (c.kind === "word")
      return { kind: c.kind, index: 0, letter: normalizeWord(c.answer)[0] };
    if (c.kind === "sudoku") {
      const index = c.grid.findIndex((n) => n === 0);
      return { kind: c.kind, index, value: c.solution[index] };
    }
    if (c.kind === "math") return { kind: c.kind, expression: c.reference };
    throw new ApiError("hintUnavailable", 409);
  });
}
