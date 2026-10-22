"use client";
import type { Completion, PublicChallenge } from "./types";
import { readLocal, writeLocal, activeUser, storageKey } from "./browser-storage";
type RunResponse = {
  runId: string;
  challenge: PublicChallenge;
  startedAt: string | null;
  result?: Record<string, unknown>;
  progress?:
    | import("./new-play").PuzzleState
    | import("./social-types").SocialState
    | null;
};
const reservations = new Map<string, ReturnType<typeof reserveInner>>();
export function reservePlay(challenge: PublicChallenge) {
  const key = `${activeUser() ?? "guest"}:${challenge.id}`,
    existing = reservations.get(key);
  if (existing) return existing;
  const pending = reserveInner(challenge);
  reservations.set(key, pending);
  pending
    .finally(() => {
      if (reservations.get(key) === pending) reservations.delete(key);
    })
    .catch(() => {});
  return pending;
}
async function reserveInner(challenge: PublicChallenge): Promise<
  RunResponse & {
    result?: Record<string, unknown> & {
      completion?: Completion;
      state?:
        | import("./new-play").PuzzleState
        | import("./social-types").SocialState;
    };
  }
> {
  if (challenge.roomId) return await postJson("/api/live-rooms", { action: "run", code: challenge.roomId }) as unknown as RunResponse;
  let id: string | null = null;
  try {
    id = JSON.parse(readLocal(`dailygrid:run:${challenge.id}`) ?? "null");
  } catch {
    /* Replace invalid cache. */
  }
  if (id) {
    const response = await fetch(`/api/play?runId=${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (response.ok) return response.json();
    if (response.status !== 404) throw new Error("networkError");
  }
  if (challenge.mode === "practice" && !challenge.friendId)
    throw new Error("unavailable");
  const data = await postJson(
    challenge.friendId ? "/api/friends" : "/api/play",
    challenge.friendId
      ? { action: "join", id: challenge.friendId }
      : {
          action: "new",
          game: challenge.kind,
          locale: challenge.locale,
          date: challenge.date,
          mode: challenge.mode ?? "daily",
          ...("difficulty" in challenge
            ? { difficulty: challenge.difficulty }
            : {}),
        },
  );
  if ((data.challenge as PublicChallenge)?.id !== challenge.id)
    throw new Error("unavailable");
  rememberRun(challenge, data.runId as string);
  return data as unknown as RunResponse;
}
const starts = new Map<string, Promise<RunResponse>>();
const results = new Map<string, Completion>();
const completionKey = (id: string) => storageKey(`dailygrid:completion:${id}`);
export async function postJson(
  url: string,
  body: unknown,
  options: { keepalive?: boolean } = {},
): Promise<Record<string, unknown>> {
  const requestedAt=performance.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: options.keepalive,
    });
  } catch {
    void import("@/components/measurement-provider").then(({reportRequestFailure})=>reportRequestFailure(0,performance.now()-requestedAt)).catch(()=>{});
    throw new Error("networkError");
  }
  const value = await response.json();
  if (!response.ok) {
    void import("@/components/measurement-provider").then(({reportRequestFailure})=>reportRequestFailure(response.status,performance.now()-requestedAt)).catch(()=>{});
    throw new Error(
      response.status >= 500 ? "networkError" : (value.error ?? "networkError"),
    );
  }
  return value;
}
export function rememberRun(challenge: PublicChallenge, runId: string) {
  writeLocal(`dailygrid:run:${challenge.id}`, runId);
}
export function beginPlay(challenge: PublicChallenge): Promise<RunResponse> {
  if (challenge.roomId) return reservePlay(challenge);
  const key = challenge.id;
  // The same Daily challenge can be played by different owners in one tab.
  const ownerKey = storageKey(`dailygrid:run:${key}`);
  const existing = starts.get(ownerKey);
  if (existing) return existing;
  const promise = (async () => {
    let runId: string | undefined;
    try {
      runId =
        JSON.parse(readLocal(`dailygrid:run:${key}`) ?? "null") ?? undefined;
    } catch {
      /* Invalid local cache is replaced. */
    }
    const create = async () => {
      const created = challenge.friendId
        ? await postJson("/api/friends", {
            action: "join",
            id: challenge.friendId,
          })
        : await postJson("/api/play", {
            action: "new",
            game: challenge.kind,
            locale: challenge.locale,
            date: challenge.date,
            mode: challenge.mode ?? "daily",
            ...(challenge.kind === "sudoku" ||
            challenge.kind === "mines" ||
            challenge.kind === "guess"
              ? { difficulty: challenge.difficulty }
              : {}),
          });
      if (
        challenge.friendId &&
        (created.challenge as PublicChallenge)?.id !== key
      )
        throw new Error("unavailable");
      runId = created.runId as string;
      rememberRun(challenge, runId);
    };
    if (typeof runId !== "string" || !runId) await create();
    try {
      return (await postJson("/api/play", {
        action: "start",
        runId,
      })) as unknown as RunResponse;
    } catch (error) {
      // Signup can claim a guest run while its original draft remains locally.
      // Daily/archive challenges keep the same content when a new owner resumes.
      if (
        !(error instanceof Error) ||
        error.message !== "unavailable" ||
        (challenge.mode === "practice" && !challenge.friendId)
      )
        throw error;
      await create();
      return (await postJson("/api/play", {
        action: "start",
        runId,
      })) as unknown as RunResponse;
    }
  })();
  starts.set(ownerKey, promise);
  promise.catch(() => {
    if (starts.get(ownerKey) === promise) starts.delete(ownerKey);
  });
  return promise;
}
export async function submitPlay(
  challenge: PublicChallenge,
  body: Record<string, unknown>,
) {
  // Capture before any request: the active account may change while submitting.
  const ownerKey = completionKey(challenge.id);
  const run = await beginPlay(challenge);
  const result = await postJson(challenge.roomId ? "/api/live-rooms" : "/api/play", {
    ...body,
    action: "submit",
    runId: run.runId,
    ...(challenge.roomId ? { code: challenge.roomId } : {}),
  });
  if (result.completion)
    results.set(ownerKey, result.completion as Completion);
  return result;
}
export const authoritativeCompletion = (id: string) => results.get(completionKey(id));
export function rememberCompletion(completion: Completion) {
  if (completion.provenance === "server")
    results.set(completionKey(completion.challengeId), completion);
}
export async function prepareCompletedPlay(challenge: PublicChallenge) {
  const ownerKey = completionKey(challenge.id);
  let completion = authoritativeCompletion(challenge.id);
  let game: Record<string, unknown> | null = null,
    session: Record<string, unknown> | null = null;
  try {
    if (!completion) {
      const records = JSON.parse(readLocal("dailygrid:stats:v1") ?? "[]");
      if (Array.isArray(records))
        completion = records.find(
          (c) => c?.challengeId === challenge.id && c.provenance === "server",
        );
    }
    game = JSON.parse(readLocal(`dailygrid:game:${challenge.id}`) ?? "null");
    session = JSON.parse(
      readLocal(`dailygrid:session:${challenge.id}`) ?? "null",
    );
  } catch {
    /* Canonical server data replaces an unreadable completed draft. */
  }
  if (!completion?.runId) return;
  const localCompletion = session?.completion as Completion | null | undefined;
  const gameReady =
    (challenge.kind === "word" || challenge.kind === "rareword")
      ? game?.complete === true &&
        Array.isArray(game.guesses) &&
        Array.isArray(game.rows) &&
        game.guesses.length === game.rows.length
      : challenge.kind === "sudoku"
        ? Array.isArray(game?.grid) && game.grid.length === 81
        : !!game?.result;
  if (gameReady && localCompletion?.runId === completion.runId) return;
  const response = await fetch(
    challenge.roomId ? `/api/live-rooms?code=${encodeURIComponent(challenge.roomId)}&runId=${encodeURIComponent(completion.runId)}` : `/api/play?runId=${encodeURIComponent(completion.runId)}`,
    { cache: "no-store" },
  );
  if (!response.ok) return;
  const data = await response.json(),
    result = data.result;
  // Restoration is optional: discard a late response after a profile switch
  // rather than writing its draft or emitting sync events for the new owner.
  if (completionKey(challenge.id) !== ownerKey) return;
  if (!result?.completion) return;
  rememberCompletion(result.completion);
  rememberRun(challenge, data.runId);
  if ((challenge.kind === "word" || challenge.kind === "rareword"))
    writeLocal(`dailygrid:game:${challenge.id}`, {
      input: "",
      guesses: result.guesses,
      rows: result.rows,
      complete: true,
      success: result.success,
      answer: result.answer ?? "",
      discovery: result.discovery,
    });
  else if (challenge.kind === "sudoku")
    writeLocal(`dailygrid:game:${challenge.id}`, {
      grid: result.grid,
      notes: Array.from({ length: 81 }, () => []),
      selected: 0,
      noteMode: false,
      errors: false,
      history: [],
    });
  else if (challenge.kind === "math")
    writeLocal(`dailygrid:game:${challenge.id}`, {
      expression: result.expression ?? game?.expression ?? "",
      result,
    });
  else writeLocal(`dailygrid:game:${challenge.id}`, { result: result.state });
  writeLocal(`dailygrid:session:${challenge.id}`, {
    elapsed:
      typeof session?.elapsed === "number"
        ? session.elapsed
        : result.completion.duration,
    started: true,
    paused: false,
    completion: result.completion,
  });
}
export function resetPlayClient() {
  reservations.clear();
  starts.clear();
  results.clear();
}
export async function requestHint(challenge: PublicChallenge) {
  const run = await beginPlay(challenge);
  return postJson("/api/play", { action: "hint", runId: run.runId });
}
