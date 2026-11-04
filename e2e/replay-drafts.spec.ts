import { test, expect, type Page } from "@playwright/test";
import { gamePath } from "../src/lib/i18n";
import { practicePath } from "../src/lib/play-path";
import { devPreviewCopy } from "../src/lib/dev-preview-i18n";
import { resultCopy } from "../src/lib/result-metrics";
import { generateChallenge } from "../src/lib/challenges";
import type { PublicChallenge } from "../src/lib/types";
import { savedGameId, savedPracticeChallenge } from "./saved-play";

async function savedPractice(page: Page) {
  const root=page.locator("[data-game-root]");
  await expect(root).toHaveAttribute("data-challenge-id",/^practice:/);
  return savedGameId(page);
}

test("Daily replay replaces an existing Unlimited draft with a fresh seed for every Daily game", async ({page}) => {
  test.setTimeout(90000);
  await page.emulateMedia({reducedMotion:"reduce"});
  for (const game of ["word","rareword","sudoku","math","mines"] as const) {
    const next = game === "rareword" ? "word" : game;
    await page.goto(practicePath("fr",next));
    const old = await savedPractice(page);
    await page.goto(gamePath("fr",game));
    await page.getByRole("button",{name:devPreviewCopy("fr").finish,exact:true}).click();
    const label = game === "rareword" ? resultCopy("fr").wordPractice : "Rejouer";
    await page.locator(".completion-panel").getByRole("link",{name:label,exact:true}).click();
    await expect(page).toHaveURL(new RegExp(practicePath("fr",next)+"(?:/easy)?$"));
    await expect(page.locator(".completion-panel")).toHaveCount(0);
    await expect(page.locator("[data-game-root]")).toHaveAttribute("data-challenge-id",/^practice:/);
    await expect(page.locator("[data-game-root]")).not.toHaveAttribute("data-challenge-id",old);
    expect(await savedPractice(page)).not.toBe(old);
  }
});

test("one-click finish keeps the real Word draft and owned puzzle; Replay starts empty instead of restoring it", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto(practicePath("fr","word"));
  await savedPractice(page);
  const c = await savedPracticeChallenge<PublicChallenge>(page,"dailygrid:practice:word:fr:easy");
  const full = generateChallenge("word","fr",c.date,"easy",c.id.split(":")[2]);
  if (full.kind !== "word") throw new Error();
  const wrong = full.answer === "OUTIL" ? "AIMER" : "OUTIL";
  await page.locator(".word-board").focus(); await page.keyboard.type(wrong);
  await page.getByRole("button",{name:"Valider",exact:true}).click();
  await expect(page.locator(".word-row").first()).toHaveText(wrong);
  await expect(page.getByRole("button",{name:"Valider",exact:true})).toBeEnabled();
  await page.locator(".word-board").focus(); await page.keyboard.type("AMI");
  await expect(page.locator(".word-row").nth(1)).toHaveText("AMI");
  const draftKey = `dailygrid:game:${c.id}`;
  const before = await page.evaluate(key => localStorage.getItem(key),draftKey);
  const request = page.waitForRequest(r => r.url().includes("/api/dev-preview?"));
  await page.getByRole("button",{name:devPreviewCopy("fr").finish,exact:true}).click();
  const runId = new URL((await request).url()).searchParams.get("runId")!;
  await expect(page.locator(".completion-panel")).toBeVisible();
  await expect(page.locator(".word-row").first()).toHaveText(wrong);
  await expect(page.locator(".word-row").nth(1)).toHaveText(full.answer);
  expect(await page.evaluate(key => localStorage.getItem(key),draftKey)).toBe(before);
  const serverRun = await page.request.get(`/api/play?runId=${encodeURIComponent(runId)}`);
  expect(serverRun.ok()).toBe(true); expect((await serverRun.json()).result).toBeUndefined();
  await page.getByRole("button",{name:devPreviewCopy("fr").close,exact:true}).click();
  await expect(page.locator(".word-row").nth(1)).toHaveText("AMI");
  await page.getByRole("button",{name:devPreviewCopy("fr").finish,exact:true}).click();
  await page.locator(".completion-panel").getByRole("button",{name:"Rejouer",exact:true}).click();
  await expect(page.locator(".completion-panel")).toHaveCount(0);
  await expect(page.locator(".word-row").first()).toHaveText("");
  expect(await savedPractice(page)).not.toBe(c.id);
});
