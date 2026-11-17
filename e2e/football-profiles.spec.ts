import { expect, test } from "@playwright/test";
import { footballProfilePath } from "../src/lib/football-profile-path";
import { gamePath } from "../src/lib/i18n";
import { quizThemePath, quizThemes } from "../src/lib/quiz-themes";
import { publicSiteConfigured, siteOrigin } from "../src/lib/site-origin";
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
    isMobile: info.project.use.isMobile,
    hasTouch: info.project.use.hasTouch,
  });
  try {
    const page = await context.newPage();
    if (info.project.use.isMobile) await page.setViewportSize({ width: 320, height: 568 });
    const footballTheme = quizThemes.find(theme => theme.id === "football")!;
    const sitemapResponse = await context.request.get("/sitemap.xml");
    expect(sitemapResponse.ok()).toBe(true);
    const sitemap = await sitemapResponse.text();
    const descriptions = new Set<string>();

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
        await expect(page).toHaveTitle(new RegExp(`^${player.name} – .+ \\| Puzzoria$`));
        const description = page.locator('meta[name="description"]');
        await expect(description).toHaveAttribute("content", new RegExp(player.name));
        descriptions.add((await description.getAttribute("content"))!);
        await expect(page.locator("#clubs").getByRole("list").getByRole("listitem").locator("strong")).toHaveText(player.clubs);
        await expect(page.locator('article section[id^="career-"] a[href^="https://"]')).toHaveCount(5);
        await expect(page.locator("article img")).toHaveCount(0);
        await expect(page.locator("article a.primary-button")).toHaveAttribute("href", gamePath(locale, "football"));
        await expect(page.locator("article a.back-link")).toHaveAttribute("href", themePath);
        const other = players.find(candidate => candidate.slug !== player.slug)!;
        await expect(page.locator("article .quiz-topic-card")).toHaveAttribute("href", footballProfilePath(locale, other.slug));
        await expect(page.locator("[data-game-root]")).toHaveCount(0);
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", publicSiteConfigured ? "index, follow" : "noindex, follow");
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", siteOrigin + path);
        const sitemapEntry = sitemap.split("<url>").find(entry => entry.includes(`<loc>${siteOrigin + path}</loc>`));
        expect(sitemapEntry).toBeDefined();
        for (const language of locales) {
          const alternate = footballProfilePath(language, player.slug);
          await expect(page.locator(`link[rel="alternate"][hreflang="${language}"]`)).toHaveAttribute("href", siteOrigin + alternate);
          await expect(page.locator(`.language-links a[hreflang="${language}"]`)).toHaveAttribute("href", alternate);
          expect(sitemapEntry).toContain(`hreflang="${language}" href="${siteOrigin + alternate}"`);
        }
        const english = siteOrigin + footballProfilePath("en", player.slug);
        await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", english);
        expect(sitemapEntry).toContain(`hreflang="x-default" href="${english}"`);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
    expect(descriptions.size).toBe(locales.length * players.length);
    // The editorial routes do not publish the private Daily deck or generate arbitrary pages.
    const unpublished = footballProfilePath("fr", "javier-saviola");
    expect((await context.request.get(unpublished)).status()).toBe(404);
    expect(sitemap).not.toContain(unpublished);
  } finally {
    await context.close();
  }
});
