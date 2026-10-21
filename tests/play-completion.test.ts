import { afterEach, expect, it, vi } from "vitest";
import { authoritativeCompletion, rememberCompletion, rememberRun, resetPlayClient, submitPlay } from "../src/lib/play-client";
import { setStorageUser } from "../src/lib/browser-storage";
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

it("keeps a late submitted completion in the initiating owner's cache", async () => {
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
  await pending;
  expect(authoritativeCompletion(challenge.id)).toEqual(recipient);
  setStorageUser("completion-sender");
  expect(authoritativeCompletion(challenge.id)?.runId).toBe("sender-run");
  setStorageUser(null);
  expect(authoritativeCompletion(challenge.id)).toBeUndefined();
});
