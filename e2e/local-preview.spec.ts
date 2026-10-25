import { test, expect } from "@playwright/test";
import { gameIds, locales } from "../src/lib/types";
import { gamePath } from "../src/lib/i18n";
import { practicePath } from "../src/lib/play-path";
import { hasWinRate } from "../src/lib/result-metrics";
import { devPreviewCopy } from "../src/lib/dev-preview-i18n";

// Independent contexts and per-game timeouts keep one slow cold route from
// consuming the entire catalogue's timeout and identify the actual failing game.
for (const game of gameIds) {
  test(`local finish preview for ${game} preserves progress`, async ({page}, info) => {
    await page.emulateMedia({reducedMotion: "reduce"});
    await page.goto(practicePath("fr", game), {waitUntil: "networkidle"});
    const finish = page.getByRole("button", {name: devPreviewCopy("fr").finish, exact: true});
    await expect(finish).toBeVisible();
    const before = await page.evaluate(() => localStorage.getItem("dailygrid:stats:v1"));
    const submitted: string[] = [];
    const collect = (request: import("@playwright/test").Request) => {
      if (request.url().endsWith("/api/play") && request.method() === "POST" && request.postDataJSON()?.action === "submit") submitted.push(request.url());
    };
    page.on("request", collect);
    await finish.click();
    await expect(page.locator(".completion-panel")).toBeVisible();
    if (hasWinRate(game) && game !== "math" && game !== "guess") await expect(page.locator("[data-outcome-bar]")).toBeVisible();
    else await expect(page.locator("[data-outcome-bar]")).toHaveCount(0);
    await expect(page.locator("[data-personal-progress]")).toBeVisible();
    await expect(page.locator("[data-local-test] small").first()).toHaveText(devPreviewCopy("fr").local);
    expect(await page.evaluate(() => localStorage.getItem("dailygrid:stats:v1"))).toBe(before);
    expect(submitted).toEqual([]);
    if (game === "word") await page.screenshot({path: info.outputPath("local-finish.png"), fullPage: true});
    await page.getByRole("button", {name: devPreviewCopy("fr").close, exact: true}).click();
    await expect(page.locator(".completion-panel")).toHaveCount(0);
    await expect(finish).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("dailygrid:stats:v1"))).toBe(before);
    page.off("request", collect);
  });
}

test("one Daily Sudoku preserves old archives and three Unlimited levels in every language", async ({page}) => {
  for (const locale of locales) {
    await page.goto(gamePath(locale, "sudoku", undefined, "hard"));
    await expect(page).toHaveURL(new RegExp(`/${locale}/sudoku$`));
    await expect(page.locator(".difficulty-nav")).toHaveCount(0);
    await expect(page.locator(".sudoku-board")).toBeVisible();
    await page.goto(gamePath(locale, "sudoku", "2026-10-01", "hard"));
    await expect(page.locator(".difficulty-nav a")).toHaveCount(3);
    await expect(page.locator(".sudoku-board")).toBeVisible();
    await page.goto(practicePath(locale, "sudoku", "medium"));
    await expect(page.locator(".difficulty-nav a")).toHaveCount(3);
    await expect(page.locator(".sudoku-board")).toBeVisible();
    await page.goto(gamePath(locale, "word"));
    await page.getByRole("button", {name: devPreviewCopy(locale).finish, exact: true}).click();
    await expect(page.locator(".completion-panel")).toBeVisible();
    await expect(page.locator("[data-result-mode]")).not.toContainText(({fr:"Illimité", en:"Unlimited", es:"Ilimitado", de:"Unbegrenzt"})[locale]);
    await expect(page.locator("[data-local-test] small").first()).toHaveText(devPreviewCopy(locale).local);
  }
});
