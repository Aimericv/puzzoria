import { expect, test } from "@playwright/test";
import { generateChallenge } from "../src/lib/challenges";
import { utcDay } from "../src/lib/date";
import { et } from "../src/lib/engagement-i18n";
import { gamePath, t } from "../src/lib/i18n";

for (const locale of ["en", "fr", "es", "de"] as const) {
  test(`invitation copy failure selects the link and allows a keyboard retry (${locale})`, async ({ page }) => {
    const puzzle = generateChallenge("math", locale, utcDay());
    if (puzzle.kind !== "math") throw new Error("Expected Numbers puzzle");
    await page.goto(gamePath(locale, "math"), { waitUntil: "networkidle" });
    await expect(page.locator(".math-numbers button").first()).toBeEnabled();
    await page.locator("#math-expression").fill(puzzle.reference);
    await page.locator(".finish-math").click();
    await expect(page.locator(".completion-panel")).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => { throw new DOMException("denied", "NotAllowedError"); } },
      });
    });
    await page.getByRole("button", { name: et(locale).shareImage, exact: true }).click();
    const section = page.locator("[data-invitation-actions]");
    const input = section.locator(".invitation-link input");
    await expect(input).toBeVisible();
    const link = await input.inputValue();
    expect(new URL(link).pathname).toMatch(new RegExp(`^/${locale}/friend/[^/]+$`));
    const copy = section.getByRole("button", { name: et(locale).copyLink, exact: true });
    await copy.click();
    await expect(section.getByRole("status")).toHaveText(et(locale).copyFailed);
    await expect(input).toBeFocused();
    expect(await input.evaluate((node: HTMLInputElement) => [node.selectionStart, node.selectionEnd])).toEqual([0, link.length]);
    await expect(input).toHaveAttribute("readonly", "");
    // Return to the copy button by keyboard and verify a successful retry.
    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => { document.documentElement.dataset.invitationCopy = text; } },
    }));
    await page.keyboard.press("Tab");
    await expect(copy).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(section.getByRole("status")).toHaveText(t(locale).copied);
    await expect(copy).toBeFocused();
    await expect(page.locator("html")).toHaveAttribute("data-invitation-copy", link);
    await expect(input).toHaveValue(link);
  });
}
