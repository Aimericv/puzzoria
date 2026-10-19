import { afterEach, expect, it, vi } from "vitest";
import { reservePlay, resetPlayClient } from "../src/lib/play-client";
import { setStorageUser } from "../src/lib/browser-storage";
import type { PublicChallenge } from "../src/lib/types";
import { readAccountProfile } from "../src/lib/account-client";
afterEach(() => {
  resetPlayClient();
  setStorageUser(null);
  vi.unstubAllGlobals();
});
it("establishes a single guest identity before simultaneous profile consumers can start games", async () => {
  let resolve!: (r: Response) => void;
  const fetch = vi.fn(
    () =>
      new Promise<Response>((r) => {
        resolve = r;
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const first = readAccountProfile<{ user: null }>();
  const second = readAccountProfile<{ user: null }>();
  expect(first).toBe(second);
  expect(fetch).toHaveBeenCalledTimes(1);
  resolve(Response.json({ user: null }));
  expect(await first).toEqual({ user: null });
  expect(await second).toEqual({ user: null });
  const fresh = readAccountProfile<{ user: null }>();
  expect(fetch).toHaveBeenCalledTimes(2);
  resolve(Response.json({ user: null }));
  await fresh;
});
it("shares an initial in-flight reservation so Strict Mode cannot create competing guest cookies", async () => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
  });
  vi.stubGlobal("window", new EventTarget());
  let resolve!: (r: Response) => void;
  const fetch = vi.fn(
    () =>
      new Promise<Response>((r) => {
        resolve = r;
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const c: PublicChallenge = {
    kind: "ranking",
    id: "ranking:reservation-fixture",
    date: "2026-10-03",
    locale: "fr",
    dataset: "fixture",
    category: "food",
    items: [
      {
        id: "pizza",
        emoji: "🍕",
        label: { en: "Pizza", fr: "Pizza", es: "Pizza", de: "Pizza" },
      },
    ],
  };
  const first = reservePlay(c),
    second = reservePlay(c);
  expect(first).toBe(second);
  expect(fetch).toHaveBeenCalledTimes(1);
  resolve(Response.json({ runId: "owned-run", challenge: c, startedAt: null }));
  expect((await first).runId).toBe("owned-run");
  expect((await second).runId).toBe("owned-run");
  expect(storage.get("dailygrid:run:" + c.id)).toBe(
    JSON.stringify("owned-run"),
  );
});
