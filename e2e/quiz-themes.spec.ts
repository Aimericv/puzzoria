import { test, expect } from "@playwright/test";
import { locales } from "../src/lib/types";
import { quizThemes, themeTopicIds, quizThemePath } from "../src/lib/quiz-themes";
import { quizTopics, quizTopicPath } from "../src/lib/knowledge-catalog";
import { quizEditorial } from "../src/lib/quiz-editorial";
import { measurementCopy } from "../src/lib/measurement-i18n";
import { kt } from "../src/lib/knowledge-i18n";

for(const locale of locales){
  test(`theme collections in ${locale}: crawlable, reciprocal, accessible without JavaScript and no game created`,async({browser,baseURL})=>{
    test.setTimeout(120000);
    const context=await browser.newContext({baseURL,javaScriptEnabled:false}),page=await context.newPage();
    try{
      await page.goto(`/${locale}/quiz`);
      for(const theme of quizThemes)await expect(page.locator(`.quiz-theme-nav a[href="${quizThemePath(locale,theme)}"]`)).toBeVisible();
      for(const theme of quizThemes){
        const response=await page.goto(quizThemePath(locale,theme));expect(response?.status()).toBe(200);
        await expect(page.locator('h1')).toHaveText(theme.title[locale]);await expect(page).toHaveTitle(theme.title[locale]+" | Puzzoria");
        await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',theme.description[locale]);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',new RegExp(quizThemePath(locale,theme)+'$'));
        for(const other of locales)await expect(page.locator(`link[hreflang="${other}"]`)).toHaveAttribute('href',new RegExp(quizThemePath(other,theme)+'$'));
        await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute('href',new RegExp(quizThemePath("en",theme)+'$'));
        await expect(page.locator('[data-game-root]')).toHaveCount(0);
        await expect(page.locator('[data-quiz-quick-start]')).toBeInViewport();
        await expect(page.locator('.quiz-theme-card')).toHaveCount(themeTopicIds(theme).length);
        for(const id of themeTopicIds(theme))await expect(page.locator(`.quiz-theme-card[href="${quizTopicPath(locale,quizTopics.find(t=>t.id===id)!)}"]`)).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      }
      for(const id of ["eu-members","football-stadiums"]){
        await page.goto(quizTopicPath(locale,quizTopics.find(t=>t.id===id)!));
        await expect(page.locator('[data-quiz-editorial]')).toContainText(quizEditorial[id].method[locale]);
        await expect(page.locator('[data-quiz-editorial] a').first()).toHaveAttribute('href',quizEditorial[id].sources[0].url);
        await expect(page.locator('.quiz-topics .quiz-topic-card').first()).toHaveAttribute('href',quizTopicPath(locale,quizTopics.find(t=>t.id===(id==="eu-members"?"countries-europe":"champions-league-winners"))!));
      }
      const sitemap=await (await context.request.get('/sitemap.xml')).text();for(const theme of quizThemes)for(const l of locales)expect(sitemap).toContain(quizThemePath(l,theme));
    }finally{await context.close();}
  });
}
test('theme to quiz journey: clear Play, editorial visible, timer and manual answer intact',async({page},info)=>{
  const theme=quizThemes[0];await page.goto(quizThemePath('fr',theme));
  await page.getByRole('button',{name:measurementCopy('fr').decline,exact:true}).click();
  await page.screenshot({path:`test-results/quiz-theme-${info.project.name}.png`,fullPage:true});
  await page.goto(quizThemePath('fr',quizThemes[1]));await page.screenshot({path:`test-results/quiz-theme-football-${info.project.name}.png`,fullPage:true});
  await page.goto(quizThemePath('fr',theme));
  const topic=quizTopics.find(t=>t.id==='eu-members')!;
  await page.locator(`.quiz-theme-card[href="${quizTopicPath('fr',topic)}"]`).click();
  const game=page.locator('[data-knowledge-game="quiz"]');await game.getByRole('button',{name:kt('fr').start,exact:true}).click();
  await expect(game.locator('[data-quiz-item]')).toHaveCount(27);
  await game.getByLabel(kt('fr').answer,{exact:true}).fill('France');await game.getByRole('button',{name:kt('fr').submit,exact:true}).click();await expect(game.locator('.knowledge-answer-row.found')).toHaveCount(1);
  await page.locator('[data-quiz-editorial]').scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/quiz-editorial-${info.project.name}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
