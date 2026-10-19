import {test,expect} from "@playwright/test";
import {measurementCopy} from "../src/lib/measurement-i18n";
import {isWebKitFetchDiagnostic,recordUnhandledRejections,unhandledRejections} from "./browser-errors";
import {resultCopy} from "../src/lib/result-metrics";
import {devPreviewCopy} from "../src/lib/dev-preview-i18n";
test("Puzzoria branding and optional internal measurement work across navigation and privacy choices",async({page,browserName},info)=>{
 await recordUnhandledRejections(page,false);
 const batches:{events:{name:string;path:string}[];choice:string}[]=[];
 page.on("request",request=>{if(request.url().endsWith("/api/measurement")&&request.method()==="POST")try{batches.push(request.postDataJSON());}catch{/* Ignore unrelated requests. */}});
 const errors:string[]=[];page.on("pageerror",e=>{if(!isWebKitFetchDiagnostic(e,browserName))errors.push(e.message);});
 await page.goto("/fr");await expect(page.locator(".brand")).toHaveText("puzzoria.");await expect(page.locator(".brand svg")).toBeVisible();
 await expect(page.locator(".measurement-notice")).toBeVisible();
 await page.getByRole("button",{name:measurementCopy("fr").accept,exact:true}).click();
 await expect(page.locator(".measurement-notice")).toBeHidden();
 await expect.poll(()=>batches.some(b=>b.choice==="yes"&&b.events.some(e=>e.name==="page_view"&&e.path==="/fr"))).toBe(true);
 await page.getByRole("link",{name:"Mes stats",exact:true}).click();
 await expect.poll(()=>batches.some(b=>b.events.some(e=>e.path==="/fr/stats"))).toBe(true);
 await page.goto("/fr/privacy");await page.getByRole("button",{name:measurementCopy("fr").decline,exact:true}).click();
 await expect(page.locator(".measurement-settings")).toContainText(measurementCopy("fr").disabled);
 const before=batches.filter(b=>b.choice==="yes").length;await page.goto("/en");await page.waitForTimeout(500);expect(batches.filter(b=>b.choice==="yes").length).toBe(before);
 for(const locale of ["fr","en","es","de"] as const){await page.goto(`/${locale}/privacy`);await expect(page.getByRole("heading",{name:measurementCopy(locale).settings})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
 await page.goto("/fr");await page.screenshot({path:`test-results/puzzoria-${info.project.name}.png`,fullPage:true});expect(errors).toEqual([]);expect(await unhandledRejections(page)).toEqual([]);
});
test("active play is accepted by the server after Start and stops in the local completion preview",async({page})=>{
 await page.addInitScript(()=>localStorage.setItem("puzzoria:measurement-choice","yes"));
 const active:{accepted:number}[]=[];
 page.on("response",response=>{if(response.url().endsWith("/api/measurement")){const body=response.request().postDataJSON();if(body.events?.some((e:{name:string})=>e.name==="active_time"))void response.json().then(data=>active.push(data)).catch(()=>{});}});
 await page.goto("/fr/mots-meles");
 await page.bringToFront();
 await expect(page.locator("[data-game-root]")).toHaveAttribute("data-measurement-playing","false");
 await page.getByRole("button",{name:resultCopy("fr").start,exact:true}).click();
 await expect(page.locator("[data-game-root]")).toHaveAttribute("data-measurement-playing","true");
 await expect.poll(()=>page.evaluate(()=>document.hasFocus())).toBe(true);
 await expect.poll(()=>active.some(r=>r.accepted>0),{timeout:20000}).toBe(true);
 await page.getByRole("button",{name:devPreviewCopy("fr").finish,exact:true}).click();
 await expect(page.locator("[data-game-root]")).toHaveAttribute("data-measurement-playing","false");
 const count=active.length;await page.waitForTimeout(16000);expect(active.length).toBe(count);
});
