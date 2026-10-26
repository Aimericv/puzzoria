import { afterEach, expect, it, vi } from "vitest";
import { beginPlay, rememberRun, resetPlayClient } from "../src/lib/play-client";
import { setStorageUser } from "../src/lib/browser-storage";
import type { PublicChallenge } from "../src/lib/types";

afterEach(() => {
  resetPlayClient();
  setStorageUser(null);
  vi.unstubAllGlobals();
});

it.each([false, true])("isolates started runs by owner with storage unavailable=%s", async (unavailable) => {
  const disk = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => {
      if (unavailable) throw new DOMException("Blocked", "SecurityError");
      return disk.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (unavailable) throw new DOMException("Blocked", "SecurityError");
      disk.set(key, value);
    },
  });
  vi.stubGlobal("window", new EventTarget());
  const challenge: PublicChallenge = {
    kind: "word", id: `word:start-owner-${unavailable}`, date: "2026-10-21",
    locale: "fr", length: 5, attempts: 6,
  };
  const fetch = vi.fn(async (_url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    expect(body.action).toBe("start");
    return Response.json({ runId: body.runId, challenge, startedAt: "2026-10-21T12:00:00Z" });
  });
  vi.stubGlobal("fetch", fetch);

  setStorageUser(null);
  rememberRun(challenge, "guest-run");
  const guest = beginPlay(challenge);
  expect(beginPlay(challenge)).toBe(guest);
  expect((await guest).runId).toBe("guest-run");

  for (const owner of ["start-a", "start-b"]) {
    setStorageUser(owner);
    rememberRun(challenge, `${owner}-run`);
    const started = beginPlay(challenge);
    expect(beginPlay(challenge)).toBe(started);
    expect((await started).runId).toBe(`${owner}-run`);
  }

  setStorageUser(null);
  expect(beginPlay(challenge)).toBe(guest);
  expect(fetch).toHaveBeenCalledTimes(3);
});
