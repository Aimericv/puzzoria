import { afterEach, expect, it, vi } from "vitest";
import { beginPlay, rememberRun, reservePlay, resetPlayClient } from "../src/lib/play-client";
import { readLocal, setStorageUser } from "../src/lib/browser-storage";
import type { PublicChallenge } from "../src/lib/types";

afterEach(() => {
  resetPlayClient();
  setStorageUser(null);
  vi.unstubAllGlobals();
});

it.each(
  ["switch", "reset", "return"].flatMap((transition) =>
    ["reserve-new", "begin-new", "reserve-missing", "begin-missing", "reserve-read", "begin-start"].map((scenario) => ({ transition, scenario })),
  ),
)(
  "discards late $scenario responses after $transition without writing or retrying",
  async ({ scenario, transition }) => {
    const disk = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => disk.get(key) ?? null,
      setItem: (key: string, value: string) => disk.set(key, value),
    });
    vi.stubGlobal("window", new EventTarget());
    const challenge: PublicChallenge = {
      kind: "word", id: `word:owner-change-${scenario}`, date: "2026-10-23",
      locale: "fr", length: 5, attempts: 6,
    };
    setStorageUser("origin");
    if (!scenario.endsWith("new")) rememberRun(challenge, "old-run");
    let release!: (response: Response) => void;
    const fetch = vi.fn(() => Promise.resolve(Response.json({ runId: "unexpected-run", challenge, startedAt: null })));
    fetch.mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve; }));
    vi.stubGlobal("fetch", fetch);
    const pending = scenario.startsWith("reserve") ? reservePlay(challenge) : beginPlay(challenge);
    const rejected = expect(pending).rejects.toThrow("unavailable");
    resetPlayClient();
    if (transition !== "reset") setStorageUser("destination");
    if (transition === "return") {
      resetPlayClient();
      setStorageUser("origin");
    }
    rememberRun(challenge, "destination-run");
    if (scenario === "reserve-missing") release(Response.json({}, { status: 404 }));
    else if (scenario === "begin-missing") release(Response.json({ error: "unavailable" }, { status: 404 }));
    else release(Response.json({ runId: "origin-run", challenge, startedAt: null }));
    await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(readLocal(`dailygrid:run:${challenge.id}`)!)).toBe("destination-run");
    fetch.mockImplementation(async () => Response.json({ runId: "destination-run", challenge, startedAt: null }));
    const fresh = scenario.startsWith("reserve") ? reservePlay(challenge) : beginPlay(challenge);
    expect((await fresh).runId).toBe("destination-run");
    expect(fetch).toHaveBeenCalledTimes(2);
  },
);

it.each([reservePlay, beginPlay])("preserves creation and deduplication for an unchanged owner (%s)", async (play) => {
  const disk = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => disk.get(key) ?? null,
    setItem: (key: string, value: string) => disk.set(key, value),
  });
  vi.stubGlobal("window", new EventTarget());
  setStorageUser("stable");
  const challenge: PublicChallenge = {
    kind: "word", id: `word:stable-${play.name}`, date: "2026-10-23",
    locale: "fr", length: 5, attempts: 6,
  };
  const fetch = vi.fn(async () => Response.json({ runId: "stable-run", challenge, startedAt: null }));
  vi.stubGlobal("fetch", fetch);
  const pending = play(challenge);
  expect(play(challenge)).toBe(pending);
  expect((await pending).runId).toBe("stable-run");
  expect(JSON.parse(readLocal(`dailygrid:run:${challenge.id}`)!)).toBe("stable-run");
  expect(fetch).toHaveBeenCalledTimes(play === beginPlay ? 2 : 1);
});

it.each(
  ["reserve", "begin"].flatMap((operation) =>
    ["daily", "friend", "room"].flatMap((route) =>
      ["fetch", "json"].map((delay) => ({ operation, route, delay })),
    ),
  ),
)("keeps the new $operation promise while obsolete $route $delay work settles", async ({ operation, route, delay }) => {
  const disk = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => disk.get(key) ?? null,
    setItem: (key: string, value: string) => disk.set(key, value),
  });
  vi.stubGlobal("window", new EventTarget());
  setStorageUser("concurrent-owner");
  const challenge: PublicChallenge = {
    kind: "word", id: `word:concurrent-${operation}-${route}-${delay}`,
    date: "2026-10-24", locale: "fr", length: 5, attempts: 6,
    ...(route === "friend" ? { friendId: "private-invitation", mode: "practice" as const } : {}),
    ...(route === "room" ? { roomId: "private-room", mode: "practice" as const } : {}),
  };
  const play = operation === "reserve" ? reservePlay : beginPlay;
  const payload = (runId: string) => ({ runId, challenge, startedAt: null });
  let releaseOld!: () => void;
  let jsonStarted!: () => void;
  const readingJson = new Promise<void>((resolve) => { jsonStarted = resolve; });
  let releaseCurrent!: (response: Response) => void;
  const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json(payload("current-run")));
  fetch.mockImplementationOnce(() => {
    if (delay === "fetch") return new Promise<Response>((resolve) => {
      releaseOld = () => resolve(Response.json(payload("obsolete-run")));
    });
    return Promise.resolve({
      ok: true,
      json: () => {
        jsonStarted();
        return new Promise((resolve) => { releaseOld = () => resolve(payload("obsolete-run")); });
      },
    } as Response);
  });
  fetch.mockImplementationOnce(() => new Promise<Response>((resolve) => { releaseCurrent = resolve; }));
  vi.stubGlobal("fetch", fetch);
  const obsolete = play(challenge);
  const rejected = expect(obsolete).rejects.toThrow("unavailable");
  if (delay === "json") await readingJson;
  resetPlayClient();
  // Same owner and challenge: both generations address the same cache entry.
  const current = play(challenge);
  expect(play(challenge)).toBe(current);
  expect(fetch).toHaveBeenCalledTimes(2);
  releaseOld();
  await rejected;
  // Let finally/catch cleanup finish before asking for the in-flight work again.
  await Promise.resolve();
  expect(play(challenge)).toBe(current);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(readLocal(`dailygrid:run:${challenge.id}`)).toBeNull();
  releaseCurrent(Response.json(payload("current-run")));
  expect((await current).runId).toBe("current-run");
  const startsRun = operation === "begin" && route !== "room";
  expect(fetch).toHaveBeenCalledTimes(startsRun ? 3 : 2);
  expect(fetch.mock.calls[0]?.[0]).toBe(route === "room" ? "/api/live-rooms" : route === "friend" ? "/api/friends" : "/api/play");
  if (route !== "room") {
    expect(JSON.parse(readLocal(`dailygrid:run:${challenge.id}`)!)).toBe("current-run");
  }
  if (startsRun) {
    expect(play(challenge)).toBe(current);
    expect(fetch).toHaveBeenCalledTimes(3);
  } else {
    // Reservations expire after settlement, so a subsequent read must be fresh.
    await Promise.resolve();
    const next = play(challenge);
    expect(next).not.toBe(current);
    expect((await next).runId).toBe("current-run");
    expect(fetch).toHaveBeenCalledTimes(3);
  }
});
