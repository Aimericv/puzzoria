import { afterEach, expect, it, vi } from "vitest";
import { authoritativeCompletion, prepareCompletedPlay, rememberCompletion, resetPlayClient } from "../src/lib/play-client";
import { readLocal, setStorageUser, writeLocal } from "../src/lib/browser-storage";
import type { Completion, PublicChallenge } from "../src/lib/types";

afterEach(() => {
  resetPlayClient();
  setStorageUser(null);
  vi.unstubAllGlobals();
});

it.each(["same", "account", "guest", "roundtrip", "reset"])("restores completed drafts only for the requesting owner: %s", async (destination) => {
  const challenge: PublicChallenge = {
    kind: "word", id: `word:restore-${destination}`, date: "2026-10-22",
    locale: "fr", length: 5, attempts: 6,
  };
  const completion: Completion = {
    challengeId: challenge.id, game: "word", date: challenge.date, locale: "fr",
    success: true, duration: 30, score: 1, completedAt: "2026-10-22T12:00:00Z",
    provenance: "server", runId: "original-run",
  };
  const disk = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => disk.get(key) ?? null,
    setItem: (key: string, value: string) => disk.set(key, value),
  });
  const events = new EventTarget();
  const changed = vi.fn();
  events.addEventListener("dailygrid:sync", changed);
  vi.stubGlobal("window", events);
  let resolve!: (data: unknown) => void;
  const body = new Promise((done) => { resolve = done; });
  const json = vi.fn(() => body);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json })));
  setStorageUser(`restore-source-${destination}`);
  rememberCompletion(completion);
  const pending = prepareCompletedPlay(challenge);
  await vi.waitFor(() => expect(json).toHaveBeenCalledOnce());
  if (destination !== "same") {
    resetPlayClient();
    if (destination !== "reset") {
      setStorageUser(destination === "guest" ? null : "restore-destination");
      if (destination === "roundtrip") {
        resetPlayClient();
        setStorageUser(`restore-source-${destination}`);
      }
    }
    rememberCompletion({ ...completion, runId: "destination-run" });
    for (const key of ["run", "game", "session"])
      writeLocal(`dailygrid:${key}:${challenge.id}`, { preserved: key });
  }
  changed.mockClear();
  resolve({ runId: completion.runId, result: {
    completion, guesses: ["SALUT"], rows: [["correct"]], success: true, answer: "SALUT",
  } });
  await pending;
  if (destination === "same") {
    expect(JSON.parse(readLocal(`dailygrid:run:${challenge.id}`)!)).toBe("original-run");
    expect(JSON.parse(readLocal(`dailygrid:game:${challenge.id}`)!)).toMatchObject({ complete: true, guesses: ["SALUT"] });
    expect(JSON.parse(readLocal(`dailygrid:session:${challenge.id}`)!)).toMatchObject({ elapsed: 30, completion });
  } else {
    expect(authoritativeCompletion(challenge.id)?.runId).toBe("destination-run");
    for (const key of ["run", "game", "session"])
      expect(JSON.parse(readLocal(`dailygrid:${key}:${challenge.id}`)!)).toEqual({ preserved: key });
    expect(changed).not.toHaveBeenCalled();

    // Discarding an old request must still allow the active profile to restore.
    const freshCompletion = { ...completion, runId: "destination-run" };
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ runId: freshCompletion.runId, result: {
        completion: freshCompletion, guesses: ["MERCI"], rows: [["correct"]],
        success: true, answer: "MERCI",
      } }),
    })));
    await prepareCompletedPlay(challenge);
    expect(JSON.parse(readLocal(`dailygrid:run:${challenge.id}`)!)).toBe("destination-run");
    expect(JSON.parse(readLocal(`dailygrid:game:${challenge.id}`)!)).toMatchObject({ complete: true, guesses: ["MERCI"] });
    expect(JSON.parse(readLocal(`dailygrid:session:${challenge.id}`)!)).toMatchObject({ completion: freshCompletion });
  }
});
