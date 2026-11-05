import { expect, type Page } from "@playwright/test";
import type { PublicChallenge } from "../src/lib/types";

// Navigation/network idle does not wait for React's persistence effects.
// Match storage to the rendered game, so an old draft cannot satisfy readiness.
export async function savedGameId(page: Page) {
  const root = page.locator("[data-game-root]");
  await expect(root).toHaveAttribute("data-challenge-id", /\S+/);
  const id = (await root.getAttribute("data-challenge-id"))!;
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem("dailygrid:preferences:v1") ?? "null")?.last?.challengeId ?? null,
  )).toBe(id);
  return id;
}

export async function savedPracticeChallenge<T extends PublicChallenge = PublicChallenge>(page: Page, key: string): Promise<T> {
  const id = await savedGameId(page);
  expect(id).toMatch(/^practice:/);
  await expect.poll(() => page.evaluate(key =>
    JSON.parse(localStorage.getItem(key) ?? "null")?.challenge?.id ?? null, key,
  )).toBe(id);
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).challenge as T, key);
}
