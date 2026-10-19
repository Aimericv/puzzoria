import {test,expect} from "@playwright/test";
import {practicePath} from "../src/lib/play-path";
import {gameStatisticsCopy} from "../src/lib/game-statistics-i18n";
import {devPreviewCopy} from "../src/lib/dev-preview-i18n";
import {t} from "../src/lib/i18n";
import type {MathChallenge} from "../src/lib/types";
import {measurementCopy} from "../src/lib/measurement-i18n";

test("game statistics show calculation precision, tile records and proposal counts in four languages",async({page},info)=>{
 test.setTimeout(120000); // Sixteen distinct game/locale previews, including WebKit.
 for(const locale of ["fr","en","es","de"] as const){
  const m=gameStatisticsCopy(locale);
  for(const game of ["math","2048","guess","wordsearch"] as const){
   await page.goto(practicePath(locale,game));
   if(await page.locator(".measurement-notice").isVisible())await page.locator(".measurement-notice").getByRole("button",{name:measurementCopy(locale).decline,exact:true}).click();
   await page.getByRole("button",{name:devPreviewCopy(locale).finish,exact:true}).click();
   const panel=page.locator(".completion-panel"), metrics=panel.locator(`[data-result-metrics="${game}"]`);
   await expect(metrics).toBeVisible();
   if(game==="math"){
    await expect(metrics.locator("span").filter({hasText:m.gap}).locator("strong")).toHaveText("0");
    await expect(metrics).toContainText(m.target);await expect(metrics).toContainText(m.value);
    await expect(panel.locator("[data-personal-record]")).toContainText(m.exactRecord);
    await expect(panel.locator(".comparison-highlight")).toContainText(m.exactSpeed.split("{n}")[0]);
    await expect(panel.locator(".comparison-details")).not.toHaveAttribute("open","");
   }else if(game==="2048"){
    await expect(metrics).toContainText(m.largestTile);await expect(metrics).toContainText("2048");await expect(metrics).toContainText(m.moves);await expect(metrics).not.toContainText(t(locale).timer);
   }else if(game==="guess"){
    await expect(metrics).toContainText(m.yourGuesses);await expect(metrics).toContainText(m.botGuesses);await expect(metrics).not.toContainText(t(locale).timer);
   }else{
    await expect(metrics).toContainText(m.wordsFound);await expect(panel.locator("[data-outcome-bar]")).toHaveCount(0);
   }
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(locale==="fr"&&game==="math")await page.screenshot({path:info.outputPath("calculation-result.png"),fullPage:true});
  }
 }
});

test("an approximate calculation shows its actual distance and precision comparison after reload",async({page})=>{
 const m=gameStatisticsCopy("fr");
 // Presentation fixture only; authoritative cohort/threshold calculations are unit-tested.
 await page.route(/\/api\/play\?comparison=1&runId=/,route=>route.fulfill({json:{comparison:{samples:25,successes:20,successRate:80,averageTime:100,medianTime:80,fasterThanPercent:null,betterScoreThanPercent:null,averageAttempts:null,fewerAttemptsThanAverage:null,commonAttempts:[],closerThanPercent:64,precisionSamples:25}}}));
 await page.goto(practicePath("fr","math"));
 await expect(page.locator("#math-expression")).toBeEnabled();
 const c=await page.evaluate(()=>JSON.parse(localStorage.getItem("dailygrid:practice:math:fr:easy")!).challenge as MathChallenge);
 const value=c.numbers.find(n=>n!==c.target)!;
 await page.locator("#math-expression").fill(String(value));
 await page.getByRole("button",{name:t("fr").submit,exact:true}).click();
 for(let i=0;i<2;i++){
  const panel=page.locator(".completion-panel"),metrics=panel.locator('[data-result-metrics="math"]');
  await expect(metrics.locator("span").filter({hasText:m.gap}).locator("strong")).toHaveText(String(Math.abs(c.target-value)));
  await expect(panel.locator(".comparison-highlight")).toHaveText(m.precision.replace("{n}","64"));
  await expect(panel.locator("[data-personal-record]")).toContainText(m.bestGap);
  if(i===0)await page.reload();
 }
});
