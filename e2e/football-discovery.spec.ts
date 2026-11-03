import { expect, test } from "@playwright/test";
import { gamePath } from "../src/lib/i18n";
import { quizTopic, quizTopicPath } from "../src/lib/knowledge-catalog";
import { kt } from "../src/lib/knowledge-i18n";
import { locales } from "../src/lib/types";

test.use({ javaScriptEnabled: false });

test("football discovery links work in both directions without JavaScript", async ({ page }) => {
  const topic = quizTopic("world-cup")!;
  for (const locale of locales) {
    const careerPath = gamePath(locale, "football");
    const topicPath = quizTopicPath(locale, topic);
    expect((await page.goto(careerPath))?.status()).toBe(200);
    const bridge = page.locator("[data-football-discovery]");
    await expect(bridge.getByRole("link")).toHaveText(topic.title[locale]);
    await expect(bridge.getByRole("link")).toHaveAttribute("href", topicPath);
    await bridge.getByRole("link").click();
    expect(new URL(page.url()).pathname).toBe(topicPath);
    await expect(page.locator("h1")).toHaveText(topic.title[locale]);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(new URL(canonical!, page.url()).pathname).toBe(topicPath);
    await expect(bridge.getByRole("link")).toHaveText(kt(locale).footballName);
    await expect(bridge.getByRole("link")).toHaveAttribute("href", careerPath);
    await bridge.getByRole("link").click();
    expect(new URL(page.url()).pathname).toBe(careerPath);
    await expect(page.locator("h1")).toHaveText(kt(locale).footballName);
    await expect(page.locator(".football-timeline")).toHaveCount(0);
  }
});
