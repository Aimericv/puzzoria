import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { accountDataCopy } from "../src/lib/account-data-i18n";
import { rt } from "../src/lib/retention-i18n";
import { measurementCopy } from "../src/lib/measurement-i18n";
import { legalCopy } from "../src/lib/legal-i18n";

test("account erasure protects credentials, guest progress and other open tabs", async ({ page, context }, info) => {
  const octet = { desktop: 31, mobile: 32, android: 33, "iphone-webkit": 34 }[info.project.name] ?? 35;
  const headers = { "X-Forwarded-For": `198.18.2.${octet}` }, username = `erase_${randomUUID().slice(0, 8)}`, password = "browser private export erase passphrase";
  await page.setExtraHTTPHeaders(headers);
  const signup = await page.request.post("/api/account", { headers, data: { action: "signup", username, password } }); expect(signup.status()).toBe(200);
  const { user } = await signup.json();
  await page.goto("/fr/account");
  if (await page.locator(".measurement-notice").isVisible()) await page.getByRole("button", { name: measurementCopy("fr").decline, exact: true }).click();
  for (const locale of ["fr", "en", "es", "de"] as const) {
    await page.goto(`/${locale}/account`); const settings = page.locator("[data-account-data]"); await expect(settings).toBeVisible(); await settings.locator("summary").click();
    await expect(settings.getByRole("button", { name: accountDataCopy(locale).remove, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.goto("/fr/account"); const m = accountDataCopy("fr"), settings = page.locator("[data-account-data]"); await settings.locator("summary").click();
  await page.evaluate(id => { localStorage.setItem("dailygrid:preferences:qa", '"guest-kept"'); localStorage.setItem(`dailygrid:account:${id}:dailygrid:preferences:qa`, '"account-removed"'); }, user.id);
  const remove = settings.locator("form"); await remove.locator('[name="confirmUsername"]').fill(username); await remove.locator('[name="password"]').fill("incorrect private passphrase"); await remove.getByRole("button", { name: m.remove, exact: true }).click(); await expect(settings.getByRole("alert")).toHaveText(rt("fr").credentialsInvalid);
  const other = await context.newPage(); await other.goto("/en/account"); await expect(other.locator("[data-account-data]")).toBeVisible();
  await remove.locator('[name="password"]').fill(password); await remove.getByRole("button", { name: m.remove, exact: true }).click();
  await expect(settings).toBeHidden(); await expect(other.locator("[data-account-data]")).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("dailygrid:preferences:qa"))).toBe('"guest-kept"');
  expect(await page.evaluate(id => Object.keys(localStorage).filter(key => key.startsWith(`dailygrid:account:${id}:`)), user.id)).toEqual([]);
  expect((await (await page.request.get("/api/account")).json()).user).toBeNull();
  await page.reload(); await expect(page.locator("[data-account-data]")).toBeHidden(); await other.close();
});

test("privacy describes retention, optional measurement and data rights in all four languages", async ({ page }) => {
  for (const locale of ["fr", "en", "es", "de"] as const) {
    await page.goto(`/${locale}/privacy`); const m = legalCopy(locale);
    for (const key of ["publisher", "purposes", "measure", "retention", "rights"] as const) await expect(page.getByRole("heading", { name: m[key], exact: true })).toBeVisible();
    await expect(page.locator(".legal-sections")).toContainText("390"); await expect(page.locator(".legal-sections")).toContainText("14");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
