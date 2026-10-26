import { test, expect } from "@playwright/test";
import { gameIds, catalogGameIds, locales } from "../src/lib/types";
import { gamePath, t } from "../src/lib/i18n";
import { hasDaily, dailyGoal } from "../src/lib/game-modes";
import { rt } from "../src/lib/retention-i18n";

test("Word variants share one catalogue entry and daily modes agree across languages and APIs", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  for (const locale of locales) {
    await page.goto(`/${locale}`);
    for (const game of catalogGameIds) {
      const card = page.locator(".game-card").filter({has: page.locator(`a.card-play[href="${gamePath(locale, game)}"]`)});
      await expect(card.locator(".daily-tag")).toHaveText(
        hasDaily(game) ? t(locale).today : rt(locale).practice,
      );
      await expect(card.locator(".card-play")).toHaveAttribute(
        "href",
        gamePath(locale, game),
      );
      await expect(card.locator(".card-practice")).toHaveCount(
        (hasDaily(game) ? 1 : 0) + (game === "word" ? 1 : 0),
      );
      if (hasDaily(game))
        await expect(card.locator("p")).toHaveText(dailyGoal(game, locale)!);
    }
    await expect(page.locator(`.card-play[href="${gamePath(locale, "rareword")}"]`)).toHaveCount(0);
    await expect(page.locator(`.game-card.word a[href="${gamePath(locale, "rareword")}"]`)).toHaveText(`${t(locale).rarewordName} →`);
    await expect(page.locator(".ad-slot")).toHaveCount(0);
    for (const game of gameIds) {
      await page.goto(gamePath(locale, game));
      if (hasDaily(game)) {
        await expect(page.locator(".mode-nav")).toBeVisible();
        await expect(page.locator(".mode-intro")).toHaveText(
          dailyGoal(game, locale)!,
        );
      } else {
        await expect(page.locator(".game-date")).toHaveText(
          rt(locale).practice,
        );
        await expect(page.locator(".mode-nav")).toHaveCount(0);
        await expect(page.locator(".sidebar-archive")).toHaveCount(0);
        await expect
          .poll(() =>
            page.evaluate(
              ({ game, locale }) => {
                const entries = Object.keys(localStorage).filter(
                  (k) =>
                    k.includes(`practice:${game}:${locale}:`) &&
                    !k.endsWith(":updated"),
                );
                return entries.some((k) => {
                  try {
                    const value = JSON.parse(localStorage.getItem(k)!);
                    return value.runId && value.challenge?.mode === "practice";
                  } catch {
                    return false;
                  }
                });
              },
              { game, locale },
            ),
          )
          .toBe(true);
        await expect(
          page.locator(".play-surface [data-game-preview]"),
        ).toHaveCount(0);
      }
      // Positive mode/content checks above confirm the new page is ready before absence checks.
      await expect(page.locator(".ad-slot")).toHaveCount(0);
    }
  }
  for (const game of gameIds.filter((game) => !hasDaily(game))) {
    const response = await request.post("/api/play", {
      data: { action: "new", game, locale: "fr", mode: "daily" },
    });
    expect(response.status()).toBe(400);
    expect((await request.get(`/api/challenges/fr/${game}`)).status()).toBe(
      404,
    );
    const shared = await request.get(`/fr/play/${game}?date=2026-10-04`, {
      maxRedirects: 0,
    });
    expect(shared.status()).toBe(307);
    expect(shared.headers().location).toBe(gamePath("fr", game, "2026-10-04"));
  }
  await page.goto("/fr/archive");
  for (const game of gameIds.filter((game) => !hasDaily(game)))
    await expect(page.locator(`.archive-game[class~="${game}"]`)).toHaveCount(
      0,
    );
  await page.goto("/fr/leaderboards");
  const options = await page
    .locator(".leaderboard-filters select")
    .first()
    .locator("option")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("value")));
  expect(options).toEqual(gameIds.filter(hasDaily));
});
