import { expect, test } from "@playwright/test";
import { kt } from "../src/lib/knowledge-i18n";
import { quizTopic, quizTopicPath } from "../src/lib/knowledge-catalog";
import { quizThemePath, themeForTopic } from "../src/lib/quiz-themes";
import { locales } from "../src/lib/types";

for (const locale of locales) {
  test(`Ligue 1 in ${locale}: club answers, saved progress and correction`, async ({ page }) => {
    const topic = quizTopic("ligue-1-clubs")!, m = kt(locale);
    const path = quizTopicPath(locale, topic);
    await page.goto(quizThemePath(locale, themeForTopic(topic.id)!));
    await page.locator(`.quiz-theme-card[href="${path}"]`).click();
    await expect(page.locator("h1")).toHaveText(topic.title[locale]);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${quizTopicPath(locale, topic)}$`));
    for (const language of [...locales, "x-default"] as const) {
      const target = quizTopicPath(language === "x-default" ? "en" : language, topic);
      await expect(page.locator(`link[rel="alternate"][hreflang="${language}"]`)).toHaveAttribute("href", new RegExp(`${target}$`));
    }
    const game = page.locator('[data-knowledge-game="quiz"]');
    await expect(game.locator('[data-quiz-item]')).toHaveCount(0);
    await game.getByRole("button", { name: m.start, exact: true }).click();
    await expect(game.locator('[data-quiz-item]')).toHaveCount(10);
    const input = game.getByLabel(m.answer, { exact: true });
    // The clue names a player; the expected answer is his club.
    await input.fill("David Beckham");
    await game.getByRole("button", { name: m.submit, exact: true }).click();
    await expect(game.locator('[data-quiz-item].found')).toHaveCount(0);
    await input.fill("PSG");
    await game.getByRole("button", { name: m.submit, exact: true }).click();
    await expect(game.locator('[data-quiz-item].found')).toHaveCount(1);
    await page.reload();
    await expect(game.locator('[data-quiz-item].found')).toHaveCount(1);
    page.once("dialog", dialog => dialog.accept());
    await game.getByRole("button", { name: m.finish, exact: true }).click();
    await expect(game.locator('.completion-panel [data-result-metrics="quiz"]')).toContainText("1/10");
    await expect(game.locator('[data-quiz-item].missed')).toHaveCount(9);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
