import { test, expect } from "@playwright/test";
import { rareWordCopy } from "../src/lib/rare-word-i18n";
import { gamePath } from "../src/lib/i18n";
import { siteAnalyticsCopy } from "../src/lib/site-analytics-i18n";
import { isWebKitFetchDiagnostic, recordUnhandledRejections, unhandledRejections } from "./browser-errors";
test("internal analytics require the configured account, filter real starts and export only aggregates",async({page,browser,browserName},info)=>{
  await recordUnhandledRejections(page);
  const errors:string[]=[];page.on("pageerror",e=>{if(!isWebKitFetchDiagnostic(e,browserName))errors.push(e.message);});
  const denied=await page.request.get("/api/admin/analytics");expect(denied.status()).toBe(403);
  const blocked=await page.goto("/fr/admin/analytics");expect(blocked?.status()).toBe(404);
  const username={desktop:"measure_desktop",mobile:"measure_mobile",android:"measure_android","iphone-webkit":"measure_webkit"}[info.project.name];
  if(!username)throw new Error("Unsupported test profile");
  const login=await page.request.post("/api/account",{data:{action:"login",username,password:"Measurement-Test-2026!"}});expect(login.ok()).toBe(true);
  const guest=await browser.newContext({baseURL:"http://127.0.0.1:3100"});
  try{
    const created=await guest.request.post("/api/play",{data:{action:"new",game:"wordsearch",locale:"es",mode:"practice",difficulty:"easy"}});expect(created.ok()).toBe(true);
    const run=await created.json();
    expect((await guest.request.post("/api/play",{data:{action:"start",runId:run.runId}})).ok()).toBe(true);
    for(const locale of ["fr","en","es","de"] as const){
      const response=await page.goto(`/${locale}/admin/analytics?days=7&game=wordsearch&locale=es&mode=practice`);expect(response?.status()).toBe(200);
      const m=siteAnalyticsCopy(locale);await expect(page.getByRole("heading",{name:m.title,exact:true})).toBeVisible();
      await expect(page.getByRole("link",{name:m.exportAnalysis,exact:true})).toHaveAttribute("href",/days=7.*game=wordsearch.*locale=es.*mode=practice.*format=json/);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content",/noindex/);
      await expect(page.locator(".internal-analytics > .analytics-metrics")).toContainText(m.starts);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    }
    const counts=await page.request.get("/api/admin/analytics?days=7&game=wordsearch&locale=es&mode=practice");const data=await counts.json();expect(data.totals.starts).toBeGreaterThanOrEqual(1);expect(data.signups).toBeNull();
    expect(JSON.stringify(data)).not.toContain(username);expect(JSON.stringify(data)).not.toContain("dailygrid-session");
    await page.goto("/fr/admin/analytics");
    await page.getByRole("combobox",{name:"Jeu",exact:true}).selectOption("wordsearch");await page.getByRole("combobox",{name:"Langue de la partie",exact:true}).selectOption("es");await page.getByRole("combobox",{name:"Mode",exact:true}).selectOption("practice");
    await page.getByRole("button",{name:"Appliquer",exact:true}).click();await expect(page).toHaveURL(/game=wordsearch.*locale=es.*mode=practice/);
    const downloadPromise=page.waitForEvent("download");await page.getByRole("link",{name:"Télécharger le CSV",exact:true}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toMatch(/^analytics-.*\.csv$/);
    const reportDownloadPromise=page.waitForEvent("download");await page.getByRole("link",{name:siteAnalyticsCopy("fr").exportAnalysis,exact:true}).click();
    const reportDownload=await reportDownloadPromise;expect(reportDownload.suggestedFilename()).toMatch(/^puzzoria-analytics-.*\.json$/);
    const reportResponse=await page.request.get(await page.getByRole("link",{name:siteAnalyticsCopy("fr").exportAnalysis,exact:true}).getAttribute("href")??"");
    const report=await reportResponse.json();expect(report.filters).toMatchObject({game:"wordsearch",puzzleLocale:"es",mode:"practice"});
    expect(report.schemaVersion).toBe(1);expect(report.report.official.totals.starts).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(report)).not.toContain(username);
    await page.screenshot({path:`test-results/analytics-${info.project.name}.png`,fullPage:true});
  }finally{await guest.close();}
  for(const locale of ["fr","en","es","de"] as const){await page.goto(gamePath(locale,"word"));await expect(page.locator(".word-variants")).toContainText(rareWordCopy(locale).rarewordName);}
  expect(errors).toEqual([]);
  expect(await unhandledRejections(page)).toEqual([]);
});
