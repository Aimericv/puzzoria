import { test, expect } from "@playwright/test";
import { gameIds, type PublicChallenge } from "../src/lib/types";
import { hasDaily } from "../src/lib/game-modes";
import { t, gamePath } from "../src/lib/i18n";
import { practicePath } from "../src/lib/play-path";
import { resultCopy, hasWinRate } from "../src/lib/result-metrics";
import { devPreviewCopy } from "../src/lib/dev-preview-i18n";
import { generateChallenge } from "../src/lib/challenges";
import { gameName } from "../src/lib/registry";
import { rt } from "../src/lib/retention-i18n";
import { savedGameId, savedPracticeChallenge } from "./saved-play";

test("all result screens share the same actions, preserve boards and replay a fresh Unlimited game", async ({page}, info) => {
  test.setTimeout(150000); await page.emulateMedia({reducedMotion:"reduce"});
  for (const game of gameIds) {
    await page.goto(hasDaily(game) ? gamePath("fr",game) : practicePath("fr",game));
    const old = await savedGameId(page);
    const before = await page.evaluate(() => localStorage.getItem("dailygrid:stats:v1"));
    await page.getByRole("button",{name:devPreviewCopy("fr").finish,exact:true}).click();
    const panel = page.locator(".completion-panel"); await expect(panel).toBeVisible(); await expect(panel).toBeFocused();
    await expect(panel.locator(".result-utility-actions .share-button")).toBeEnabled();
    await expect(panel.locator(".result-utility-actions a")).toHaveAttribute("href","/fr/stats");
    await page.evaluate(() => {
      Object.defineProperty(navigator,"share",{configurable:true,value:undefined});
      Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async(text:string)=>{document.documentElement.dataset.previewShare=text;}}});
    });
    await panel.locator(".share-button").click();
    const shared = await page.locator("html").getAttribute("data-preview-share");
    expect(shared).toContain(devPreviewCopy("fr").local);
    expect(shared).toContain(["ranking","rather","guess","quiz","football"].includes(game) ? gamePath("fr",game) : `/play/${game}?`);
    await expect(panel.locator(".share-button")).toBeEnabled();
    if (["ranking","rather"].includes(game)) await expect(page.locator("[data-finished-board]")).toBeVisible();
    if (game === "guess") await expect(page.locator(".number-arena")).toBeVisible();
    if (game === "word" || game === "rareword") await expect(page.locator(".word-board")).toBeVisible();
    if (game === "sudoku") {await expect(page.locator(".sudoku-board")).toBeVisible(); expect(await page.locator(".sudoku-cell").allTextContents()).not.toContain("");}
    if (["2048","mines","wordsearch"].includes(game)) await expect(page.locator(".classic-board")).toBeVisible();
    if (!hasWinRate(game)) {await expect(panel.locator("[data-outcome-bar]")).toHaveCount(0); await expect(panel.locator(".personal-summary")).not.toContainText(t("fr").winRate);}
    expect(await page.evaluate(() => localStorage.getItem("dailygrid:stats:v1"))).toBe(before);
    if (["mines","ranking","rather"].includes(game)) await page.screenshot({path:info.outputPath(`result-${game}.png`),fullPage:true});
    if (game === "rareword") await page.getByRole("link",{name:resultCopy("fr").wordPractice}).click();
    else if (game === "rather") await panel.locator(".result-play-actions .primary-button").click();
    else await panel.getByRole(hasDaily(game) ? "link" : "button",{name:"Rejouer",exact:true}).click();
    const next = game === "rareword" ? "word" : game;
    await expect(page).toHaveURL(new RegExp(practicePath("fr",next) + "(?:/easy)?$"));
    await expect(page.locator(".completion-panel")).toHaveCount(0);
    await expect(page.locator("[data-game-root]")).toHaveAttribute("data-challenge-id",/^practice:/);
    await expect(page.locator("[data-game-root]")).not.toHaveAttribute("data-challenge-id",old);
    expect(await savedGameId(page)).not.toBe(old);
  }
});

test("word-search grid stays masked and timer starts only on Start, including after reload", async ({page}) => {
  await page.goto(practicePath("fr","wordsearch"));
  const key = "dailygrid:practice:wordsearch:fr:easy";
  const c = await savedPracticeChallenge<PublicChallenge>(page,key);
  await expect(page.locator(".board-wordsearch")).toHaveAttribute("data-locked","true");
  await expect(page.locator(".classic-status strong").first()).toHaveText("00:00");
  const saved = await page.evaluate(c => JSON.parse(localStorage.getItem(`dailygrid:session:${c.id}`) ?? "null"),c);
  expect(saved?.started ?? false).toBe(false);
  await page.getByRole("button",{name:resultCopy("fr").start,exact:true}).click();
  await expect(page.locator(".board-wordsearch")).not.toHaveAttribute("data-locked","true");
  await expect.poll(() => page.locator(".classic-status strong").first().innerText()).not.toBe("00:00");
  await page.reload(); await expect(page.locator(".wordsearch-start")).toHaveCount(0);
  const full = generateChallenge("wordsearch","fr",c.date,"easy",c.id.split(":")[2]);
  if (full.kind !== "wordsearch") throw new Error();
  for (const p of full.placements) {
    await page.locator(`[data-puzzle-cell="${p.from}"]`).click(); await page.locator(`[data-puzzle-cell="${p.to}"]`).click();
    await expect(page.locator(".classic-game")).toHaveAttribute("aria-busy","false");
  }
  await expect(page.locator(".completion-panel")).toBeVisible();
  await expect(page.locator(".board-wordsearch")).toBeVisible();
  await expect(page.locator(".personal-summary")).not.toContainText(t("fr").winRate);
  await page.getByRole("link",{name:rt("fr").viewStats,exact:true}).click();
  await page.locator(".mode-nav").getByRole("button",{name:rt("fr").practice,exact:true}).click();
  const stats = page.locator(".stats-game-grid article").filter({has:page.getByRole("heading",{name:gameName("wordsearch","fr"),exact:true})});
  await expect(stats).not.toContainText(t("fr").winRate);
  await expect(stats).not.toContainText(rt("fr").bestScore);
  await expect(stats).toContainText(rt("fr").averageTime);
});
