import { expect, test } from "@playwright/test";
import { footballProfilePath } from "../src/lib/football-profile-path";
import { gamePath } from "../src/lib/i18n";
import { quizThemePath, quizThemes } from "../src/lib/quiz-themes";
import { publicSiteConfigured } from "../src/lib/site-origin";
import { locales } from "../src/lib/types";

const players = [
  { slug: "thierry-henry", name: "Thierry Henry", clubs: ["AS Monaco", "Juventus", "Arsenal", "FC Barcelona", "New York Red Bulls", "Arsenal", "New York Red Bulls"] },
  { slug: "miroslav-klose", name: "Miroslav Klose", clubs: ["FC 08 Homburg", "1. FC Kaiserslautern", "Werder Bremen", "Bayern München", "Lazio"] },
];

test("football career profiles are linked, localized and crawlable without JavaScript", async ({ browser, baseURL }, info) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: info.project.use.viewport,
  });
  try {
    const page = await context.newPage();
    const footballTheme = quizThemes.find(theme => theme.id === "football")!;
    const sitemapResponse = await context.request.get("/sitemap.xml");
    expect(sitemapResponse.ok()).toBe(true);
    const sitemap = await sitemapResponse.text();

    for (const locale of locales) {
      const themePath = quizThemePath(locale, footballTheme);
      await page.goto(themePath);
      const profileLinks = page.locator("#football-profiles a");
      await expect(profileLinks).toHaveCount(players.length);
      for (const [index, player] of players.entries()) {
        const path = footballProfilePath(locale, player.slug);
        if (index) await page.goto(themePath);
        await expect(profileLinks.nth(index)).toHaveAttribute("href", path);
        await profileLinks.nth(index).click();
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        await expect(page.locator("h1")).toHaveText(player.name);
        await expect(page.locator("article .football-timeline strong")).toHaveText(player.clubs);
        await expect(page.locator('article section[id^="career-"] a[href^="https://"]')).toHaveCount(4);
        await expect(page.locator("article a.primary-button")).toHaveAttribute("href", gamePath(locale, "football"));
        await expect(page.locator("[data-game-root]")).toHaveCount(0);
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", publicSiteConfigured ? "index, follow" : "noindex, follow");
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${path}$`));
        for (const language of locales) {
          const alternate = footballProfilePath(language, player.slug);
          await expect(page.locator(`link[rel="alternate"][hreflang="${language}"]`)).toHaveAttribute("href", new RegExp(`${alternate}$`));
          await expect(page.locator(`.language-links a[hreflang="${language}"]`)).toHaveAttribute("href", alternate);
        }
        await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", new RegExp(`${footballProfilePath("en", player.slug)}$`));
        expect(sitemap).toContain(`${path}</loc>`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
    // The editorial routes do not publish the private Daily deck or generate arbitrary pages.
    const unpublished = footballProfilePath("fr", "javier-saviola");
    expect((await context.request.get(unpublished)).status()).toBe(404);
    expect(sitemap).not.toContain(unpublished);
  } finally {
    await context.close();
  }
});
