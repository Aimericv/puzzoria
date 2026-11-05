import { expect, test, type Page } from "@playwright/test";
import { locales, type Completion } from "../src/lib/types";
import { quizTopicPath } from "../src/lib/knowledge-catalog";
import { europeMapTopic } from "../src/lib/map-quiz-catalog";
import { mapCopy } from "../src/lib/map-i18n";
import { kt } from "../src/lib/knowledge-i18n";
import { rt } from "../src/lib/retention-i18n";
import { comparisonStatistics } from "../src/lib/statistics";
import geometry from "../public/maps/europe-v1.json" with { type: "json" };
import countries from "../src/lib/server/data/europe-map.v1.json" with { type: "json" };

const newRun=(page:Page)=>page.waitForResponse(r=>r.url().endsWith('/api/play')&&r.request().method()==='POST'&&r.request().postDataJSON()?.action==='new');
async function expectMapFits(page:Page){
  await expect.poll(()=>page.locator('.knowledge-map-active').evaluate(root=>{
    const r=root.getBoundingClientRect(),box=root.querySelector('.map-viewport')!.getBoundingClientRect(),svg=root.querySelector('.europe-map')!.getBoundingClientRect();
    return {frame:r.top>=-1&&r.bottom<=innerHeight+1,usable:box.height>80&&svg.width>0,wholeMap:svg.left>=box.left-1&&svg.right<=box.right+1&&svg.top>=box.top-1&&svg.bottom<=box.bottom+1};
  })).toEqual({frame:true,usable:true,wholeMap:true});
  for(const selector of ['.knowledge-scoreboard','.map-target','.map-toolbar','.map-actions']){
    const bounds=await page.locator(selector).boundingBox();expect(bounds).not.toBeNull();expect(bounds!.y).toBeGreaterThanOrEqual(-1);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual((await page.evaluate(()=>innerHeight))+1);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
async function tapRegion(page:Page,id:string,touch:boolean){
  const viewport=page.locator('.map-viewport');await viewport.scrollIntoViewIfNeeded();
  const point=geometry.regions.find(r=>r.id===id)!.point;
  // Pan the same native scroll container a player uses; the final selection is a real pointer/touch event.
  await viewport.evaluate((box,p)=>{const svg=box.querySelector('svg')!;const rect=svg.getBoundingClientRect();box.scrollLeft+=(rect.left+p[0]*rect.width/1000)-(box.getBoundingClientRect().left+box.clientWidth/2);box.scrollTop+=(rect.top+p[1]*rect.height/760)-(box.getBoundingClientRect().top+box.clientHeight/2);},point);
  const coordinates=await page.locator('.europe-map').evaluate((svg,p)=>{const r=svg.getBoundingClientRect();return {x:r.left+p[0]*r.width/1000,y:r.top+p[1]*r.height/760};},point);
  if(touch)await page.touchscreen.tap(coordinates.x,coordinates.y);else await page.mouse.click(coordinates.x,coordinates.y);
}

test('Europe map pages have distinct server HTML, accessible preview, reciprocal SEO and sitemap links in four languages',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,javaScriptEnabled:false}),page=await context.newPage();
  try{for(const locale of locales){
    const path=quizTopicPath(locale,europeMapTopic),response=await page.goto(path);expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(europeMapTopic.title[locale]);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',europeMapTopic.description[locale]);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',new RegExp(path+'$'));
    for(const other of locales)await expect(page.locator(`link[hreflang="${other}"]`)).toHaveAttribute('href',new RegExp(quizTopicPath(other,europeMapTopic)+'$'));
    await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute('href',new RegExp(quizTopicPath('en',europeMapTopic)+'$'));
    await expect(page.getByAltText(mapCopy(locale).preview)).toBeVisible();await expect(page.locator('[data-quiz-scope]')).toHaveText(europeMapTopic.scope![locale]);
    expect(await page.content()).not.toContain('"aliases"');
  }
  const sitemap=await(await context.request.get('/sitemap.xml')).text();for(const locale of locales)expect(sitemap).toContain(quizTopicPath(locale,europeMapTopic));
  }finally{await context.close();}
});

test('active map fits small desktops, phones and landscape without page scrolling; zoom dragging never answers',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>localStorage.setItem('puzzoria:measurement-choice','no'));
  const created=newRun(page);await page.goto(quizTopicPath('de',europeMapTopic));const run=await(await created).json();
  await page.getByRole('button',{name:kt('de').start,exact:true}).click();await expect(page.locator('[data-map-region]')).toHaveCount(44);
  for(const size of [{width:1366,height:768},{width:1280,height:600},{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(size);await expectMapFits(page);
    await page.screenshot({path:`test-results/map-fit-${size.width}x${size.height}-${info.project.name}.png`});
  }
  if(info.project.name==='desktop'){
    await page.getByRole('button',{name:mapCopy('de').zoomIn,exact:true}).click();
    const box=(await page.locator('.map-viewport').boundingBox())!;
    await page.mouse.move(box.x+box.width*.6,box.y+box.height*.6);await page.mouse.down();await page.mouse.move(box.x+box.width*.3,box.y+box.height*.3,{steps:10});await page.mouse.up();
    const owned=await(await page.request.get(`/api/play?runId=${run.runId}`)).json();expect(owned.startedAt).toBeTruthy();expect(owned.progress).toBeNull();expect(owned.result).toBeUndefined();
    const first=countries.find(c=>c.name.de===run.challenge.items[0].prompt)!;await tapRegion(page,first.region,false);await expect(page.locator('.map-target')).toContainText(mapCopy('de').correct);
  }
});

for(const locale of locales)test(`Europe map in ${locale}: direct keyboard/touch answers, correction, resume, score, speed, sharing and replay`,async({page},info)=>{
  test.setTimeout(120000);await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>localStorage.setItem('puzzoria:measurement-choice','no'));
  // Presentation peers only; current placements always go through the real owned server proof.
  await page.route(/\/api\/play\?comparison=1&runId=/,async route=>{
    const url=new URL(route.request().url());url.searchParams.delete('comparison');const owned=await(await page.request.get(url.toString())).json(),current:Completion=owned.result.completion;
    const peers=Array.from({length:40},(_,i)=>({...current,runId:`peer-${i}`,duration:current.duration+60,success:i<20,answersFound:i<20?44:22,score:i<20?1000:500,mapErrors:i<20?0:22}));
    await route.fulfill({json:{comparison:comparisonStatistics(peers,current)}});
  });
  const m=mapCopy(locale),k=kt(locale),path=quizTopicPath(locale,europeMapTopic),created=newRun(page);
  await page.goto(path);let run=await(await created).json();const game=page.locator('[data-knowledge-game="quiz"]');
  await game.getByRole('button',{name:k.start,exact:true}).click();await expect(page.locator('[data-map-region]')).toHaveCount(44);await expect(game.locator('.knowledge-answer-form')).toHaveCount(0);
  await expect(page.getByRole('button',{name:m.confirm,exact:true})).toHaveCount(0);
  await expectMapFits(page);
  await page.screenshot({path:`test-results/map-active-${locale}-${info.project.name}.png`});
  let placements=0;page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/api/play')&&request.postDataJSON()?.step?.kind==='place')placements++;});
  const region=(prompt:string)=>countries.find(c=>c.name[locale]===prompt)!.region;
  const first=region(run.challenge.items[0].prompt);
  await page.locator(`[data-map-region="${first}"]`).focus();await page.keyboard.press('Enter');
  await expect(page.locator('.map-target')).toContainText(m.correct);await expect(game.locator('.knowledge-scoreboard')).toContainText('1/44');
  await expectMapFits(page);
  await page.keyboard.press('Enter');await page.keyboard.press('Space');expect(placements).toBe(1);
  await page.getByRole('button',{name:`${m.next} →`,exact:true}).click();
  const second=region(run.challenge.items[1].prompt),wrong=countries.find(c=>c.region!==first&&c.region!==second)!.region;
  await tapRegion(page,wrong,info.project.name!=='desktop');
  await expect(page.locator('.map-target')).toContainText(m.wrong);await expect(page.locator('.map-target h3')).toHaveText(run.challenge.items[1].prompt);
  await expectMapFits(page);
  await page.getByRole('button',{name:`${m.next} →`,exact:true}).click();await page.getByRole('button',{name:m.skip,exact:true}).click();
  await page.reload();await expect(page.getByRole('button',{name:k.start,exact:true})).toHaveCount(0);await page.getByRole('button',{name:`${m.next} →`,exact:true}).click();
  await expect(page.locator('.map-target strong')).toHaveText(run.challenge.items[3].prompt);
  page.once('dialog',d=>d.accept());await game.getByRole('button',{name:k.finish,exact:true}).click();
  await expect(page.locator('.completion-panel')).toBeVisible();await expect(page.locator('[data-result-metrics="quiz"]')).toContainText('1/44');
  await expect(page.locator(`[data-result-metric="${m.errors}"] strong`)).toHaveText('1');
  await expect(page.locator('[data-knowledge-speed]')).toHaveCount(0);await expect(page.locator('[data-map-region]')).toHaveCount(44);
  const nextRun=newRun(page),previousId=run.challenge.id;
  await page.getByRole('button',{name:rt(locale).playAgain,exact:true}).click();run=await(await nextRun).json();
  expect(run.challenge.id).not.toBe(previousId);await expect(page).toHaveURL(new RegExp(path+'$'));await game.getByRole('button',{name:k.start,exact:true}).click();await expect(game.locator('.knowledge-scoreboard')).toContainText('0/44');
  for(let sequence=0;sequence<44;sequence++){
    const response=await page.request.post('/api/play',{data:{action:'submit',runId:run.runId,sequence,step:{kind:'place',region:region(run.challenge.items[sequence].prompt)}}});expect(response.ok(),await response.text()).toBe(true);
  }
  await page.reload();const compare=page.locator('[data-game-comparison="quiz"]');await expect(compare).toContainText(m.perfect);
  await expect(page.locator('[data-result-metrics="quiz"]')).toContainText('44/44');await expect(compare.locator('[data-knowledge-speed]')).toBeVisible();
  await expect(page.locator('[data-quiz-time-record]')).not.toContainText('—');
  await page.locator('.completion-panel .share-button').click();await expect(page.locator('.share-text textarea')).toHaveValue(new RegExp(path));
  await compare.scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/map-results-${locale}-${info.project.name}.png`});
  await page.locator('.map-review-list summary').click();await expect(page.locator('.map-review-list button')).toHaveCount(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('small states support zoom and precise touch selection, and asset failure never starts the timer',async({page},info)=>{
  test.setTimeout(90000);await page.addInitScript(()=>localStorage.setItem('puzzoria:measurement-choice','no'));
  let fail=true;await page.route('**/maps/europe-v1.json',route=>fail?route.fulfill({status:503,body:'unavailable'}):route.continue());
  const created=newRun(page);await page.goto(quizTopicPath('fr',europeMapTopic));const run=await(await created).json(),m=mapCopy('fr'),k=kt('fr');
  await expect(page.getByRole('button',{name:k.start,exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:m.retry,exact:true})).toBeVisible();
  expect((await(await page.request.get(`/api/play?runId=${run.runId}`)).json()).startedAt).toBeNull();
  fail=false;await page.getByRole('button',{name:m.retry,exact:true}).click();await page.getByRole('button',{name:k.start,exact:true}).click();
  const vatican=countries.find(c=>c.iso==='VA')!,index=run.challenge.items.findIndex((i:{prompt:string})=>i.prompt===vatican.name.fr);
  for(let sequence=0;sequence<index;sequence++){const response=await page.request.post('/api/play',{data:{action:'submit',runId:run.runId,sequence,step:{kind:'map-skip'}}});expect(response.ok()).toBe(true);}
  await page.reload();if(index>0)await page.getByRole('button',{name:`${m.next} →`,exact:true}).click();
  await expect(page.locator('.map-target strong')).toHaveText(vatican.name.fr);
  await page.locator('.map-viewport').scrollIntoViewIfNeeded();
  // Enlarged targets must stay above neighbouring polygons (notably Andorra/France).
  for(const small of geometry.regions.filter(r=>r.small)){
    const hit=await page.locator('.europe-map').evaluate((svg,p)=>{
      const r=svg.getBoundingClientRect();return document.elementFromPoint(r.left+(p[0]+8)*r.width/1000,r.top+p[1]*r.height/760)?.closest('[data-map-region]')?.getAttribute('data-map-region');
    },small.point);
    expect(hit).toBe(small.id);
  }
  await page.screenshot({path:`test-results/map-board-${info.project.name}.png`});
  for(let i=0;i<3;i++)await page.getByRole('button',{name:m.zoomIn,exact:true}).click();
  await tapRegion(page,vatican.region,info.project.name!=='desktop');
  await expect(page.locator('.map-target')).toContainText(index===43?m.ended:m.correct);
  await page.locator('.map-viewport').scrollIntoViewIfNeeded();await page.screenshot({path:`test-results/map-zoom-${info.project.name}.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const startedAt=(await(await page.request.get(`/api/play?runId=${run.runId}`)).json()).startedAt;
  fail=true;await page.reload();await expect(page.locator('.map-load-error')).toContainText(m.failedActive);
  expect((await(await page.request.get(`/api/play?runId=${run.runId}`)).json()).startedAt).toBe(startedAt);
  fail=false;await page.getByRole('button',{name:m.retry,exact:true}).click();await expect(page.locator('[data-map-region]')).toHaveCount(44);
});
