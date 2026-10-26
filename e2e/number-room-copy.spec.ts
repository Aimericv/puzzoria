import { expect, test } from "@playwright/test";
import { et } from "../src/lib/engagement-i18n";
import { t } from "../src/lib/i18n";
import { st } from "../src/lib/social-i18n";

for (const locale of ["en", "fr", "es", "de"] as const) {
  test(`historical number room offers manual copy and keyboard retry (${locale})`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const response = await page.request.post("/api/number-rooms", {
      data: { action: "create", locale },
    });
    expect(response.ok()).toBeTruthy();
    const { code } = await response.json();
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    await page.goto(`/${locale}/number-room/${code}`);
    const room = page.locator(".number-room");
    await expect(room.locator(".room-code strong")).toHaveText(code);
    const input = room.getByRole("textbox", { name: et(locale).invitation, exact: true });
    const copy = room.getByRole("button", { name: st(locale).link, exact: true });
    const link = new URL(`/${locale}/number-room/${code}`, page.url()).href;
    await expect(input).toHaveValue(link);
    await expect(input).toHaveAttribute("readonly", "");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    for (const failure of ["denied", "unavailable"] as const) {
      await page.evaluate((mode) => {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: mode === "unavailable" ? undefined : {
            writeText: async () => { throw new DOMException("denied", "NotAllowedError"); },
          },
        });
      }, failure);
      await copy.click();
      await expect(room.getByRole("status")).toHaveText(et(locale).copyFailed);
      await expect(input).toBeFocused();
      expect(await input.evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd])).toEqual([0, link.length]);
      await expect(input).toHaveValue(link);
    }

    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => { document.documentElement.dataset.roomCopy = text; } },
    }));
    await page.keyboard.press("Tab");
    await expect(copy).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(room.getByRole("status")).toHaveText(t(locale).copied);
    await expect(page.locator("html")).toHaveAttribute("data-room-copy", link);
    await expect(copy).toBeFocused();
    await expect(input).toHaveValue(link);
    await expect(room.locator(".room-code strong")).toHaveText(code);
  });
}
