import { test, expect } from "@playwright/test";
import { gamePath } from "../src/lib/i18n";
import { practicePath } from "../src/lib/play-path";
import { devPreviewCopy } from "../src/lib/dev-preview-i18n";
import { resultCopy } from "../src/lib/result-metrics";
import { generateChallenge } from "../src/lib/challenges";
import type { PublicChallenge } from "../src/lib/types";

test("Daily replay replaces an existing Unlimited draft with a fresh seed for every Daily game", async ({page}) => {
  test.setTimeout(90000);
  await page.emulateMedia({reducedMotion:"reduce"});
  for (const game of ["word","rareword","sudoku","math","mines"] as const) {
    const next = game === "rareword" ? "word" : game;
    await page.goto(practicePath("fr",next),{waitUntil:"networkidle"});
    const old = await page.evaluate(() => JSON.parse(localStorage.getItem("dailygrid:preferences:v1")!).last.challengeId);
    await page.goto(gamePath("fr",game),{waitUntil:"networkidle"});
    await page.getByRole("button",{name:devPreviewCopy("fr").finish,exact:true}).click();
    const label = game === "rareword" ? resultCopy("fr").wordPractice : "Rejouer";
    await page.locator(".completion-panel").getByRole("link",{name:label,exact:true}).click();
    await expect(page).toHaveURL(new RegExp(practicePath("fr",next)+"(?:/easy)?$"));
    await expect(page.locator(".completion-panel")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("dailygrid:preferences:v1")!).last.challengeId)).not.toBe(old);
  }
});

test("one-click finish keeps the real Word draft and owned puzzle; Replay starts empty instead of restoring it", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto(practicePath("fr","word"),{waitUntil:"networkidle"});
  const c = await page.evaluate(() => JSON.parse(localStorage.getItem("dailygrid:practice:word:fr:easy")!).challenge as PublicChallenge);
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
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("dailygrid:preferences:v1")!).last.challengeId)).not.toBe(c.id);
});
