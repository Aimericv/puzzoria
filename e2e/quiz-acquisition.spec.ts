import {expect,test} from "@playwright/test";
import {expandedQuizTopics} from "../src/lib/quiz-expansion";
import {quizTopicPath,quizTopics} from "../src/lib/knowledge-catalog";
import {locales} from "../src/lib/types";
import {kt} from "../src/lib/knowledge-i18n";
import {rt} from "../src/lib/retention-i18n";
import {measurementCopy} from "../src/lib/measurement-i18n";

for(const locale of locales){
 test(`quiz acquisition pages in ${locale}: all new pages have useful server HTML, matching metadata and translated links`,async({browser,baseURL})=>{
  test.setTimeout(180000);
  const context=await browser.newContext({baseURL,javaScriptEnabled:false});const page=await context.newPage();
  try{
   await page.goto(`/${locale}/quiz`);await expect(page.locator('.quiz-topic-card')).toHaveCount(quizTopics.length);
   for(const topic of expandedQuizTopics){
    const response=await page.goto(quizTopicPath(locale,topic));expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(topic.title[locale]);await expect(page).toHaveTitle(new RegExp('Puzzoria'));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',topic.description[locale]);
    await expect(page.locator('[data-quiz-scope]')).toHaveText(topic.scope![locale]);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',new RegExp(quizTopicPath(locale,topic)+'$'));
    for(const other of locales)await expect(page.locator(`link[hreflang="${other}"]`)).toHaveAttribute('href',new RegExp(quizTopicPath(other,topic)+'$'));
    await expect(page.locator('.quiz-topics a[href="/'+locale+'/quiz"]')).toBeVisible();
    expect(await page.locator('.quiz-topics .quiz-topic-card').count()).toBeGreaterThan(0);
   }
  }finally{await context.close();}
 });
 test(`195-country quiz in ${locale}: start, manual answer, reload, finish, share and same-topic replay`,async({page},info)=>{
  const topic=expandedQuizTopics.find(t=>t.id==='countries-world')!,m=kt(locale);
  await page.goto(quizTopicPath(locale,topic));await page.getByRole('button',{name:measurementCopy(locale).decline,exact:true}).click();const game=page.locator('[data-knowledge-game="quiz"]');
  await game.getByRole('button',{name:m.start,exact:true}).click();await expect(game.locator('[data-quiz-item]')).toHaveCount(195);
  await expect(game.locator('.knowledge-form-clock')).toHaveText(/09:\d{2}/);
  const input=game.getByLabel(m.answer,{exact:true});await input.fill('USA');await game.getByRole('button',{name:m.submit,exact:true}).click();
  await expect(game.locator('.knowledge-answer-row.found')).toHaveCount(1);await page.reload();await expect(game.locator('.knowledge-answer-row.found')).toHaveCount(1);
  await game.locator('[data-quiz-item]').last().scrollIntoViewIfNeeded();await expect(input).toBeInViewport();
  await game.locator('.knowledge-scoreboard').scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/quiz-expansion-${locale}-${info.project.name}.png`});
  page.once('dialog',d=>d.accept());await game.getByRole('button',{name:m.finish,exact:true}).click();
  const result=game.locator('.completion-panel');await expect(result).toBeVisible();await expect(result.locator('[data-result-metrics="quiz"]')).toContainText('1/195');
  await result.locator('.share-button').click();await expect(result.locator('.share-text textarea')).toHaveValue(new RegExp(quizTopicPath(locale,topic)));
  const previous=await page.locator('[data-game-root]').getAttribute('data-challenge-id');
  await result.getByRole('button',{name:rt(locale).playAgain,exact:true}).click();await expect(page.locator('[data-game-root]')).not.toHaveAttribute('data-challenge-id',previous!);
  await expect(page).toHaveURL(new RegExp(quizTopicPath(locale,topic)+'$'));await expect(game.locator('.knowledge-start')).toContainText('195');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
