import { expect, test } from "@playwright/test";

for (const game of ["word", "sudoku"] as const) {
  test(`${game} shortcuts leave cookie-dialog keys and the underlying draft alone`, async ({ page }) => {
    await page.goto(`/en/${game}`);
    const board = page.locator(game === "word" ? ".word-board" : ".sudoku-board");
    const entry = game === "word"
      ? board
      : board.locator(".sudoku-cell.entered").first();
    if (game === "word") await expect(board).toHaveAttribute("aria-busy", "false");
    else await expect(entry).toBeEnabled();
    await entry.focus();
    await page.keyboard.press(game === "word" ? "a" : "1");
    if (game === "word") await expect(board.locator(".word-row").first()).toHaveText("A");
    else await expect(entry).toHaveText("1");
    const before = await board.innerHTML();

    await page.locator("footer").getByRole("button", { name: "Cookie preferences" }).click();
    const dialog = page.getByRole("dialog", { name: "Cookie preferences" });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole("button", { name: "Close", exact: true });
    await close.focus();
    const keys = game === "word"
      ? ["b", "ArrowLeft", "Home", "End", "Backspace", "Delete"]
      : ["n", "2", "ArrowRight", "Backspace", "Control+z"];
    for (const key of keys) {
      await page.keyboard.press(key);
      await expect(close).toBeFocused();
      expect(await board.innerHTML()).toBe(before);
      if (game === "sudoku")
        await expect(page.locator(".sudoku-options button").first()).toHaveAttribute("aria-pressed", "false");
    }

    // Native button activation must still close the dialog, then game keys resume.
    await page.keyboard.press("Enter");
    await expect(dialog).not.toBeVisible();
    await entry.focus();
    await page.keyboard.press(game === "word" ? "b" : "Backspace");
    if (game === "word") await expect(board.locator(".word-row").first()).toHaveText("AB");
    else await expect(entry).not.toHaveText("1");
  });
}
