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
