import { test, expect } from "@playwright/test";
import { locales, type Completion } from "../src/lib/types";
import { quizTopics, quizTopicPath } from "../src/lib/knowledge-catalog";
import { kt } from "../src/lib/knowledge-i18n";
import { knowledgeStatisticsCopy } from "../src/lib/knowledge-statistics-i18n";
import { measurementCopy } from "../src/lib/measurement-i18n";
import { comparisonStatistics } from "../src/lib/statistics";
import { generateKnowledge } from "../src/lib/server/knowledge-content";
import type { QuizChallenge } from "../src/lib/knowledge-types";
import { devPreviewCopy } from "../src/lib/dev-preview-i18n";
import { practicePath } from "../src/lib/play-path";

for (const locale of locales) {
  test(`perfect quiz in ${locale}: speed, perfect share and personal time record survive reload`, async ({ page }, info) => {
    // UI-only peer fixture; the current game is completed through its real server proof.
    // Cohort selection, thresholds, strict ties and observed samples are covered in unit tests.
    await page.route(/\/api\/play\?comparison=1&runId=/, async route => {
      const url = new URL(route.request().url());url.searchParams.delete("comparison");
      const response = await page.request.get(url.toString()), run = await response.json();
      const current: Completion = run.result?.completion;
      expect(current?.success).toBe(true);
      const samples = Array.from({ length: 40 }, (_, i) => ({ ...current, runId: `fixture-${i}`, duration: i < 20 ? current.duration + 30 : 60, success: i < 20, score: i < 20 ? 1000 : 500, answersFound: i < 20 ? 8 : 4 }));
      await route.fulfill({ json: { comparison: comparisonStatistics(samples, current) } });
    });
    const topic = quizTopics.find(t => t.id === "planets")!, m = kt(locale), labels = knowledgeStatisticsCopy(locale);
    await page.goto(quizTopicPath(locale, topic));
    await page.getByRole("button", { name: measurementCopy(locale).decline, exact: true }).click();
    const game = page.locator('[data-knowledge-game="quiz"]');
    await game.getByRole("button", { name: m.start, exact: true }).click();
    const source = generateKnowledge("quiz", locale, "2026-11-03", "test", "planets") as QuizChallenge;
    for (let i = 0; i < source.items.length; i++) {
      await game.getByLabel(m.answer, { exact: true }).fill(source.items[i].answer);
      await expect(game.locator('.knowledge-answer-row.found')).toHaveCount(i + 1);
    }
    const compare = page.locator('[data-game-comparison="quiz"]');
    await expect(compare).toContainText(labels.perfect);await expect(compare).toContainText(labels.perfectSpeed.replace("{n}", "100"));
    await expect(compare).not.toContainText(m.better.split("{n}")[0]);
    await expect(compare.locator('[data-quiz-answer-comparison]')).toContainText('6/8');
    await expect(compare.locator('[data-quiz-perfect-share]')).toContainText('50');
    await expect(page.locator('[data-quiz-time-record]')).not.toContainText('—');
    await compare.scrollIntoViewIfNeeded();await page.screenshot({ path: `test-results/quiz-statistics-${locale}-${info.project.name}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload();await expect(compare).toContainText(labels.perfect);await expect(page.locator('[data-quiz-time-record]')).not.toContainText('—');
  });
}

test('knowledge local previews use the same coherent comparison UI in every locale', async ({ page }, info) => {
  test.setTimeout(120000);
  for (const locale of locales) for (const game of ["quiz", "football"] as const) {
    await page.goto(game === "quiz" ? quizTopicPath(locale, quizTopics.find(t => t.id === "countries-world")!) : practicePath(locale, game));
    if (await page.locator('.measurement-notice').isVisible()) await page.locator('.measurement-notice').getByRole('button', { name: measurementCopy(locale).decline, exact: true }).click();
    const before = await page.evaluate(() => localStorage.getItem('dailygrid:stats:v1'));
    await page.getByRole('button', { name: devPreviewCopy(locale).finish, exact: true }).click();
    const p = page.locator(`[data-game-comparison="${game}"]`), m = knowledgeStatisticsCopy(locale);
    await expect(p.locator('[data-knowledge-speed]')).toBeVisible();
    if (game === "quiz") {
      await expect(p).toContainText(m.perfect);await expect(p).not.toContainText(kt(locale).better.split('{n}')[0]);await expect(p).toContainText(m.perfectMedian);
    } else {
      await expect(p).toContainText(m.firstGuess);await expect(p.locator('[data-attempt-distribution]')).toBeVisible();await expect(p).toContainText(m.footballSpeed.split('{n}')[0]);
    }
    await p.scrollIntoViewIfNeeded();
    if (locale === "fr") await page.screenshot({ path: `test-results/${game}-statistics-preview-${info.project.name}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('dailygrid:stats:v1'))).toBe(before);
  }
});
