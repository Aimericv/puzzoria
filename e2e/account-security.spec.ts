import {test,expect} from "@playwright/test";
import {randomUUID} from "node:crypto";
import {accountSecurityCopy} from "../src/lib/account-security-i18n";
import {measurementCopy} from "../src/lib/measurement-i18n";
import {cookieCopy} from "../src/lib/cookie-i18n";
import {resultCopy} from "../src/lib/result-metrics";
import {devPreviewCopy} from "../src/lib/dev-preview-i18n";
import {practicePath} from "../src/lib/play-path";
import {recordUnhandledRejections,unhandledRejections} from "./browser-errors";

test("password change and sign-out-all revoke other devices with a simple account interface in four languages",async({page,browser},info)=>{
 await recordUnhandledRejections(page);
 // A separate simulated address keeps this additional signup from consuming the existing suite's five/hour quota.
 const octet={desktop:21,mobile:22,android:23,"iphone-webkit":24}[info.project.name] ?? 25;
 await page.setExtraHTTPHeaders({"X-Forwarded-For":`198.18.1.${octet}`});
 const username=`secure_${randomUUID().slice(0,8)}`,password="browser original safe passphrase",replacement="browser changed safe passphrase";
 const signup=await page.request.post("/api/account",{headers:{"X-Forwarded-For":`198.18.1.${octet}`},data:{action:"signup",username,password}});expect(signup.status()).toBe(200);
 const other=await browser.newContext({extraHTTPHeaders:{"X-Forwarded-For":"198.51.100.90"}});
 try{
   expect((await other.request.post("http://127.0.0.1:3100/api/account",{data:{action:"login",username,password}})).status()).toBe(200);
   for(const locale of ["fr","en","es","de"] as const){
     await page.goto(`/${locale}/account`);const settings=page.locator("[data-account-security]");await expect(settings.getByText(accountSecurityCopy(locale).securityTitle,{exact:true})).toBeVisible();await settings.locator("summary").click();await expect(settings.getByRole("button",{name:accountSecurityCopy(locale).changePassword,exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
   }
   await page.goto("/fr/account");const m=accountSecurityCopy("fr"),settings=page.locator("[data-account-security]");await settings.locator("summary").click();
   const form=settings.locator("form").first();await form.locator('[name="password"]').fill(password);await form.locator('[name="newPassword"]').fill("password123456");await form.locator('[name="confirmPassword"]').fill("password123456");await form.getByRole("button",{name:m.changePassword,exact:true}).click();await expect(page.locator(".account-card p[role=alert]")).toHaveText(m.passwordWeak);
   await form.locator('[name="newPassword"]').fill(replacement);await form.locator('[name="confirmPassword"]').fill(replacement);await form.getByRole("button",{name:m.changePassword,exact:true}).click();await expect(page.getByRole("status")).toHaveText(m.passwordChanged);
   expect((await (await other.request.get("http://127.0.0.1:3100/api/account")).json()).user).toBeNull();
   expect((await other.request.post("http://127.0.0.1:3100/api/account",{data:{action:"login",username,password}})).status()).toBe(401);
   expect((await other.request.post("http://127.0.0.1:3100/api/account",{data:{action:"login",username,password:replacement}})).status()).toBe(200);
   const logout=settings.locator("form").nth(1);await logout.locator('[name="password"]').fill(replacement);await logout.getByRole("button",{name:m.logoutAll,exact:true}).click();await expect(settings).toBeHidden();
   expect((await (await other.request.get("http://127.0.0.1:3100/api/account")).json()).user).toBeNull();expect(await unhandledRejections(page)).toEqual([]);
 }finally{await other.close();}
});

test("cookie choices remain accessible and CSP uses fresh nonces without breaking navigation",async({page},info)=>{
 await recordUnhandledRejections(page,false);
 const response=await page.goto("/fr");expect(response?.headers()["x-frame-options"]).toBe("DENY");expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
 const csp=response?.headers()["content-security-policy"]??"";expect(csp).toContain("frame-ancestors 'none'");const nonce=csp.match(/'nonce-([^']+)'/)?.[1];expect(nonce).toBeTruthy();
 expect(await page.locator('script[src]').first().evaluate(node=>(node as HTMLScriptElement).nonce)).toBe(nonce);
 await page.getByRole("button",{name:cookieCopy("fr").customize,exact:true}).click();const dialog=page.getByRole("dialog",{name:measurementCopy("fr").settings});await expect(dialog).toBeVisible();await expect(dialog).toContainText(cookieCopy("fr").necessary);
 await dialog.getByRole("button",{name:measurementCopy("fr").decline,exact:true}).click();await dialog.getByRole("button",{name:cookieCopy("fr").close,exact:true}).click();await expect(page.locator(".measurement-notice")).toBeHidden();
 for(const locale of ["fr","en","es","de"] as const){await page.goto(`/${locale}`);await page.locator(".site-footer").getByRole("button",{name:measurementCopy(locale).settings,exact:true}).click();const modal=page.getByRole("dialog");await expect(modal).toContainText(cookieCopy(locale).adsHelp);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await modal.getByRole("button",{name:cookieCopy(locale).close,exact:true}).click();}
 await page.locator(".site-footer").getByRole("button",{name:measurementCopy("de").settings,exact:true}).click();await page.screenshot({path:`test-results/cookies-${info.project.name}.png`});await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toBeHidden();expect(await unhandledRejections(page)).toEqual([]);
});

test("math completion names personal and community exact-target rates and displays the actual calculation",async({page})=>{
 await recordUnhandledRejections(page);
 for(const locale of ["fr","en","es","de"] as const){
   await page.goto(practicePath(locale,"math"));await page.getByRole("button",{name:devPreviewCopy(locale).finish,exact:true}).click();const panel=page.locator(".completion-panel");await expect(panel).toBeVisible();await expect(panel).toContainText(resultCopy(locale).exactPersonal);await expect(panel).toContainText(resultCopy(locale).exactCommunity);await expect(panel.locator("[data-math-result]")).toContainText(resultCopy(locale).operations);
   expect(await panel.locator("[data-math-result] dd").nth(1).textContent()).toBe("0");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
 expect(await unhandledRejections(page)).toEqual([]);
});
