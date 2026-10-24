import { afterEach, expect, it, vi } from "vitest";
import { authoritativeCompletion, beginPlay, rememberCompletion, rememberRun, resetPlayClient, submitPlay } from "../src/lib/play-client";
import { readLocal, setStorageUser, writeLocal } from "../src/lib/browser-storage";
import type { Completion, PublicChallenge } from "../src/lib/types";

const challenge: PublicChallenge = {
  kind: "word", id: "word:completion-owner", date: "2026-10-21",
  locale: "fr", length: 5, attempts: 6,
};
const completion = (runId: string): Completion => ({
  challengeId: challenge.id, game: "word", date: challenge.date, locale: "fr",
  success: true, duration: 30, score: 1, completedAt: "2026-10-21T12:00:00Z",
  provenance: "server", runId,
});
afterEach(() => {
  resetPlayClient();
  setStorageUser(null);
  vi.unstubAllGlobals();
});

it("isolates remembered completions between guest and accounts", () => {
  for (const owner of [null, "completion-a", "completion-b"]) {
    setStorageUser(owner);
    expect(authoritativeCompletion(challenge.id)).toBeUndefined();
    rememberCompletion(completion(owner ?? "guest"));
  }
  for (const owner of [null, "completion-a", "completion-b"]) {
    setStorageUser(owner);
    expect(authoritativeCompletion(challenge.id)?.runId).toBe(owner ?? "guest");
    rememberCompletion({ ...completion("imported"), provenance: "imported" });
    expect(authoritativeCompletion(challenge.id)?.runId).toBe(owner ?? "guest");
  }
});

it("discards a late submitted completion after the client cache is reset", async () => {
  const disk = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => disk.get(key) ?? null,
    setItem: (key: string, value: string) => disk.set(key, value),
  });
  vi.stubGlobal("window", new EventTarget());
  let resolve!: (response: Response) => void;
  const submitted = new Promise<Response>((done) => { resolve = done; });
  const fetch = vi.fn(async (_url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    if (body.action === "start") return Response.json({ runId: body.runId, challenge });
    expect(body.action).toBe("submit");
    return submitted;
  });
  vi.stubGlobal("fetch", fetch);
  setStorageUser("completion-sender");
  rememberRun(challenge, "sender-run");
  const pending = submitPlay(challenge, { guesses: [] });
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  // Profile changes clear caches, but cannot cancel an already pending response.
  resetPlayClient();
  setStorageUser("completion-recipient");
  const recipient = completion("recipient-run");
  rememberCompletion(recipient);
  resolve(Response.json({ completion: completion("sender-run") }));
  await expect(pending).rejects.toThrow("unavailable");
  expect(authoritativeCompletion(challenge.id)).toEqual(recipient);
  setStorageUser("completion-sender");
  expect(authoritativeCompletion(challenge.id)).toBeUndefined();
  setStorageUser(null);
  expect(authoritativeCompletion(challenge.id)).toBeUndefined();
});

// Consumers apply both intermediate state and completed results after submitPlay.
it.each(["response", "json"])("does not deliver late progress to a draft consumer (%s)", async (delay) => {
  vi.stubGlobal("window", new EventTarget());
  setStorageUser(`progress-origin-${delay}`);
  rememberRun(challenge, "progress-run");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let reading = false;
  const fetch = vi.fn(async (_url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    if (body.action === "start") return Response.json({ runId: body.runId, challenge });
    reading = true;
    if (delay === "response") await gate;
    return { ok: true, json: async () => {
      if (delay === "json") await gate;
      return { state: { moves: 1 } };
    } } as Response;
  });
  vi.stubGlobal("fetch", fetch);
  writeLocal(`dailygrid:game:${challenge.id}`, { moves: 0 });
  const applyDraft = vi.fn((data: Record<string, unknown>) => {
    writeLocal(`dailygrid:game:${challenge.id}`, data.state);
  });
  const pending = submitPlay(challenge, { step: { kind: "move" } }).then(applyDraft);
  const rejected = expect(pending).rejects.toThrow("unavailable");
  await vi.waitFor(() => expect(reading).toBe(true));
  resetPlayClient();
  setStorageUser(`progress-destination-${delay}`);
  writeLocal(`dailygrid:game:${challenge.id}`, { moves: 7 });
  release();
  await rejected;
  expect(applyDraft).not.toHaveBeenCalled();
  expect(JSON.parse(readLocal(`dailygrid:game:${challenge.id}`)!)).toEqual({ moves: 7 });
  setStorageUser(`progress-origin-${delay}`);
  expect(JSON.parse(readLocal(`dailygrid:game:${challenge.id}`)!)).toEqual({ moves: 0 });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it.each(["switch", "roundtrip", "reset"])("does not submit a cached started run after invalidation in the await gap (%s)", async (cycle) => {
  vi.stubGlobal("window", new EventTarget());
  setStorageUser("submit-gap-origin");
  rememberRun(challenge, "gap-run");
  const fetch = vi.fn(async () => Response.json({ runId: "gap-run", challenge }));
  vi.stubGlobal("fetch", fetch);
  await beginPlay(challenge);
  const pending = submitPlay(challenge, { guesses: [] });
  const rejected = expect(pending).rejects.toThrow("unavailable");
  resetPlayClient();
  if (cycle !== "reset") setStorageUser("submit-gap-destination");
  if (cycle === "roundtrip") {
    resetPlayClient();
    setStorageUser("submit-gap-origin");
  }
  await rejected;
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("delivers progress and completion normally for an unchanged owner", async () => {
  vi.stubGlobal("window", new EventTarget());
  setStorageUser("submit-stable");
  rememberRun(challenge, "stable-run");
  const result = { state: { moves: 1 }, completion: completion("stable-run") };
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) =>
    Response.json(JSON.parse(String(options.body)).action === "start"
      ? { runId: "stable-run", challenge } : result)));
  expect(await submitPlay(challenge, { guesses: [] })).toEqual(result);
  expect(authoritativeCompletion(challenge.id)).toEqual(result.completion);
});


it.each(["roundtrip", "reset"])("discards a submission from a previous client generation (%s)", async (cycle) => {
  vi.stubGlobal("window", new EventTarget());
  const owner = `submit-generation-${cycle}`;
  setStorageUser(owner);
  rememberRun(challenge, "old-run");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let submitting = false;
  const fetch = vi.fn(async (_url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    if (body.action === "start") return Response.json({ runId: body.runId, challenge });
    submitting = true;
    await gate;
    return Response.json({ state: { moves: 1 }, completion: completion("old-run") });
  });
  vi.stubGlobal("fetch", fetch);
  const consumer = vi.fn((data: Record<string, unknown>) => writeLocal(`dailygrid:game:${challenge.id}`, data.state));
  const pending = submitPlay(challenge, { guesses: [] }).then(consumer);
  // Attach a handler before releasing the deferred request.
  const settled = pending.then(() => null, (error: Error) => error.message);
  await vi.waitFor(() => expect(submitting).toBe(true));
  resetPlayClient();
  if (cycle === "roundtrip") {
    setStorageUser(`${owner}-other`);
    resetPlayClient();
    setStorageUser(owner);
  }
  const recent = completion("recent-run");
  rememberCompletion(recent);
  rememberRun(challenge, "recent-run");
  writeLocal(`dailygrid:game:${challenge.id}`, { moves: 7 });
  release();
  expect(await settled).toBe("unavailable");
  expect(consumer).not.toHaveBeenCalled();
  expect(authoritativeCompletion(challenge.id)).toEqual(recent);
  expect(JSON.parse(readLocal(`dailygrid:run:${challenge.id}`)!)).toBe("recent-run");
  expect(JSON.parse(readLocal(`dailygrid:game:${challenge.id}`)!)).toEqual({ moves: 7 });
  // A fresh operation in the active generation still succeeds.
  expect((await submitPlay(challenge, { guesses: [] })).state).toEqual({ moves: 1 });
});
