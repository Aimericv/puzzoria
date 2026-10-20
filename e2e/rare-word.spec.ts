import { expect, test, type Page } from "@playwright/test";
import { generateChallenge } from "../src/lib/challenges";
import { utcDay } from "../src/lib/date";
import { gamePath, t } from "../src/lib/i18n";
import { normalizeWord } from "../src/lib/word-normalization";
import { rareWordCopy } from "../src/lib/rare-word-i18n";
import { practicePath } from "../src/lib/play-path";
import type { Locale, PublicChallenge } from "../src/lib/types";
import { comparisonPreviewCopy } from "../src/lib/comparison-preview-i18n";
import { wordArticlePath } from "../src/lib/word-article-path";
import { wordArticleCopy } from "../src/lib/word-article-i18n";
import { articleIsPublished } from "./word-article-publication";

async function guess(page: Page, word: string, locale: Locale) {
  const enter = page.getByRole("button",{name:t(locale).enter,exact:true});
  await expect(enter).toBeEnabled();
  await page.locator(".word-board").focus();
  await page.keyboard.type(normalizeWord(word));
  await enter.click();
}

test("Unusual Word plays in all four languages, reveals knowledge only after completion and restores the result", async ({page, browser},info) => {
  test.setTimeout(120000);
  for(const locale of ["fr","en","es","de"] as const) {
    await page.goto(gamePath(locale,"word"));
    await expect(page.locator('.word-variants [aria-current="page"]')).toHaveText(
      ({fr:"Mot du jour",en:"Daily word",es:"Palabra del día",de:"Wort des Tages"})[locale],
    );
    await page.locator(`.word-variants a[href="${gamePath(locale,"rareword")}"]`).click();
    await expect(page).toHaveURL(new RegExp(gamePath(locale,"rareword") + "$"));
    const c = generateChallenge("rareword",locale,utcDay());
    if(c.kind !== "rareword") throw new Error();
    await expect(page.locator(".word-board")).toBeVisible();
    await expect(page.locator(".game-heading h1")).toHaveText(t(locale).wordName);
    await expect(page.locator(".word-variants a")).toHaveCount(3);
    await expect(page.locator('.word-variants [aria-current="page"]')).toHaveText(t(locale).rarewordName);
    await expect(page.locator('[data-word-mode="daily"]')).toContainText(rareWordCopy(locale).dailyLabel);
    await expect(page.locator(".word-row")).toHaveCount(c.attempts);
    await expect(page.locator(".word-row").first().locator(".letter-tile")).toHaveCount(c.length);
    await expect(page.locator("[data-word-discovery]")).toHaveCount(0);
    await expect(page.locator(".completion-panel")).toHaveCount(0);
    const publicData = await (await page.request.get(`/api/challenges/${locale}/rareword?date=${utcDay()}`)).json();
    expect(publicData).not.toHaveProperty("answer");expect(publicData).not.toHaveProperty("discovery");
    await guess(page,c.answer,locale);
    await expect(page.locator(".completion-panel")).toBeVisible();
    await expect(page.locator(".completion-metrics")).toContainText(`1/${c.attempts}`);
    await expect(page.locator("[data-word-discovery] h3")).toHaveText(c.answer);
    await expect(page.locator("[data-word-discovery] dl > div")).toHaveCount(3);
    await expect(page.locator(".game-error")).toHaveCount(0);
    const progress = await page.evaluate(() => JSON.parse(localStorage.getItem("dailygrid:stats:v1") ?? "[]"));
    expect(progress.find((r: {game:string;locale:string}) => r.game === "rareword" && r.locale === locale)).toMatchObject({mode:"daily",wordLength:c.length,maxAttempts:c.attempts});
    await page.reload();
    await expect(page.locator("[data-word-discovery] h3")).toHaveText(c.answer);
    await expect(page.locator(".touch-keyboard")).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href",new RegExp(gamePath(locale,"rareword") + "$"));
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if(locale === "fr") await page.screenshot({path:info.outputPath("rare-word-result.png"),fullPage:true});
    await page.getByRole("link", {name:wordArticleCopy(locale).read}).click();
    await expect(page).toHaveURL(new RegExp(wordArticlePath(locale,c.answer) + "\\?runId="));
    await expect(page.locator("[data-word-article] h1")).toHaveText(c.answer);
    await expect(page.locator(".word-article-body section")).toHaveCount(6);
    await expect(page.locator(".pronunciation-value")).not.toBeEmpty();
    await expect(page.locator("#examples blockquote")).toHaveCount(2);
    await expect(page.locator(".word-article-sources a").first()).toHaveAttribute("href",/^https:\/\//);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href",new RegExp(wordArticlePath(locale,c.answer) + "$"));
    // A repeated Daily answer can already have a public article. Ownership only
    // keeps an article private before its original publication date.
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(articleIsPublished(locale, c.answer) ? 0 : 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if(locale === "fr") await page.screenshot({path:info.outputPath("word-article.png"),fullPage:true});
    if(locale === "fr") {
      const noScript = await browser.newContext({javaScriptEnabled:false, storageState:await page.context().storageState()});
      const document = await noScript.newPage();
      const response = await document.goto(page.url());
      expect(response?.status()).toBe(200);
      await expect(document.locator(".word-article-body section")).toHaveCount(6);
      await noScript.close();
    }
  }
});

test("Unusual Word has one daily word, redirects Unlimited, preserves drafts and reveals an explanation on a loss", async ({page}) => {
  await page.goto(practicePath("fr","rareword"));
  await expect(page.locator(".touch-keyboard")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(gamePath("fr","rareword") + "$"));
  const c = generateChallenge("rareword","fr",utcDay());
  if(c.kind !== "rareword") throw new Error();
  const guesses: Record<number,string[]> = {7:["MAISONS","JARDINS"],8:["VOITURES","MONTAGNE"],9:["CHAUSSURE","MERVEILLE"],10:["GALIMATIAS","ANACOLUTHE"]};
  const wrong = guesses[c.length].find(word => word !== normalizeWord(c.answer))!;
  await page.locator(".word-board").focus();await page.keyboard.type(wrong.slice(0,3));
  await expect(page.locator(".word-row").first()).toHaveText(wrong.slice(0,3));
  await page.reload();
  await expect(page.locator(".word-row").first()).toHaveText(wrong.slice(0,3));
  await page.locator(".word-board").focus();await page.keyboard.press("Home");
  for(let n=0;n<3;n++) await page.keyboard.press("Delete");
  for(let n=0;n<c.attempts;n++) { await guess(page,wrong,"fr"); await expect(page.locator(".word-row").nth(n)).toHaveText(wrong); }
  await expect(page.locator(".completion-panel")).toBeVisible();
  await expect(page.locator("[data-word-discovery] h3")).toHaveText(c.answer);
  await expect(page.locator("[data-result-mode]")).toContainText(rareWordCopy("fr").dailyLabel);
  await expect(page.locator("[data-comparison-preview]")).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content",/noindex/);
  const results = await page.evaluate(() => JSON.parse(localStorage.getItem("dailygrid:stats:v1") ?? "[]"));
  expect(results).toHaveLength(1);expect(results[0]).toMatchObject({game:"rareword",mode:"daily",success:false});
});

test("results scroll into view, keep Word metrics on one row, and compare before personal progress on mobile", async ({page},info) => {
  await page.setViewportSize({width:320,height:780});
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto(practicePath("fr","word"));
  await expect(page.locator(".touch-keyboard")).toBeVisible();
  const c = await page.evaluate(() => JSON.parse(localStorage.getItem("dailygrid:practice:word:fr:easy")!).challenge as PublicChallenge);
  const full = generateChallenge("word","fr",c.date,"easy",c.id.split(":")[2]);
  if(full.kind !== "word") throw new Error();
  await guess(page,full.answer,"fr");
  const result = page.locator(".completion-panel");
  await expect(result).toBeFocused();
  await expect.poll(async () => (await result.boundingBox())!.y).toBeGreaterThanOrEqual(0);
  expect((await result.boundingBox())!.y).toBeLessThan(50);
  await expect(page.locator("[data-comparison-preview]")).toContainText(comparisonPreviewCopy("fr").title);
  await expect(page.locator("[data-comparison-preview]")).not.toContainText("Exemple");
  await expect(page.locator("[data-comparison-preview]")).not.toContainText("%");
  await expect(page.locator("[data-outcome-bar]")).toHaveCount(0);
  const values = await page.locator(".completion-metrics > span > strong").evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().y));
  expect(Math.max(...values)-Math.min(...values)).toBeLessThan(2);
  const comparison = (await page.locator("[data-comparison-preview]").boundingBox())!;
  const progress = (await page.locator("[data-personal-progress]").boundingBox())!;
  expect(progress.y).toBeGreaterThanOrEqual(comparison.y+comparison.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath("word-result-320.png"),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  const left = (await page.locator("[data-comparison-preview]").boundingBox())!;
  const right = (await page.locator("[data-personal-progress]").boundingBox())!;
  expect(Math.abs(left.y-right.y)).toBeLessThan(2);expect(right.x).toBeGreaterThan(left.x);
  expect(Math.abs(left.height-right.height)).toBeLessThan(2);
  expect(Math.abs(left.width-right.width)).toBeLessThan(2);
  await expect(page.locator(".progress-details")).not.toHaveAttribute("open", "");
  await page.locator(".progress-details summary").click();
  await expect(page.locator(".personal-history")).toBeVisible();
  const expandedLeft = (await page.locator("[data-comparison-preview]").boundingBox())!;
  const expandedRight = (await page.locator("[data-personal-progress]").boundingBox())!;
  expect(Math.abs(expandedLeft.height-expandedRight.height)).toBeLessThan(2);
  await page.locator(".progress-details summary").click();
  await page.screenshot({path:info.outputPath("word-result-balanced-desktop.png"),fullPage:true});
  await page.setViewportSize({width:320,height:780});
  await page.getByRole("button", {name:"Rejouer", exact:true}).click();
  await expect(page.locator(".completion-panel")).toHaveCount(0);
  await expect(page.locator(".word-board")).toBeFocused();
  await expect.poll(async () => (await page.locator("[data-word-mode]").boundingBox())!.y).toBeGreaterThanOrEqual(0);
  expect((await page.locator("[data-word-mode]").boundingBox())!.y).toBeLessThan(50);
  const fresh = await page.evaluate(() => JSON.parse(localStorage.getItem("dailygrid:practice:word:fr:easy")!).challenge.id);
  expect(fresh).not.toBe(c.id);
});
