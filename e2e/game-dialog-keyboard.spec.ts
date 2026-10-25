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

test("Sudoku shortcuts respect links and editable focus, then resume on game tools", async ({ page }) => {
  await page.goto("/en/sudoku");
  const board = page.locator(".sudoku-board");
  const entry = board.locator(".sudoku-cell.entered").first();
  await expect(entry).toBeEnabled();
  await entry.focus();
  await page.keyboard.press("1");
  await expect(entry).toHaveText("1");
  const before = await board.innerHTML();
  const notes = page.locator(".sudoku-options button").first();
  const brand = page.locator('header a[href="/en"]').first();
  await brand.focus();
  for (const key of ["2", "n", "ArrowRight", "Backspace", "Control+z"]) {
    await page.keyboard.press(key);
    expect(await board.innerHTML()).toBe(before);
    await expect(notes).toHaveAttribute("aria-pressed", "false");
    await expect(brand).toBeFocused();
  }

  // A temporary editor exercises nested editable targets without adding product UI.
  await page.evaluate(() => {
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    editor.id = "keyboard-test-editor";
    editor.innerHTML = '<span tabindex="0">draft</span>';
    document.body.append(editor);
  });
  const editable = page.locator("#keyboard-test-editor span");
  await editable.focus();
  await page.keyboard.press("2");
  await page.keyboard.press("n");
  expect(await board.innerHTML()).toBe(before);
  await expect(notes).toHaveAttribute("aria-pressed", "false");
  await page.locator("#keyboard-test-editor").evaluate((editor) => editor.remove());

  await notes.focus();
  await page.keyboard.press("n");
  await expect(notes).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("n");
  await expect(notes).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Backspace");
  await expect(entry).not.toHaveText("1");
  await entry.focus();
  await page.keyboard.press("3");
  await expect(entry).toHaveText("3");
});


test("Sudoku arrows preserve rows and columns at edges and move accessible focus", async ({ page }) => {
  await page.goto("/en/sudoku");
  const board = page.locator(".sudoku-board");
  const cells = board.locator(".sudoku-cell");
  await expect(cells.first()).toBeEnabled();
  const draft = await cells.allTextContents();
  const cases = [
    { from: 9, key: "ArrowLeft", to: 9 },
    { from: 17, key: "ArrowRight", to: 17 },
    { from: 4, key: "ArrowUp", to: 4 },
    { from: 76, key: "ArrowDown", to: 76 },
    { from: 40, key: "ArrowLeft", to: 39 },
    { from: 40, key: "ArrowRight", to: 41 },
    { from: 40, key: "ArrowUp", to: 31 },
    { from: 40, key: "ArrowDown", to: 49 },
  ];
  for (const { from, key, to } of cases) {
    await cells.nth(from).click();
    await expect(cells.nth(from)).toBeFocused();
    await page.keyboard.press(key);
    await expect(cells.nth(to)).toBeFocused();
    await expect(cells.nth(to)).toHaveAttribute("aria-pressed", "true");
    await expect(cells.nth(to)).toHaveAttribute("tabindex", "0");
    await expect(board.locator('.sudoku-cell[tabindex="0"]')).toHaveCount(1);
    await expect(board.locator('.sudoku-cell[aria-pressed="true"]')).toHaveCount(1);
    expect(await cells.allTextContents()).toEqual(draft);
  }
});


for (const game of ["word", "sudoku"] as const) {
  test(`${game} leaves Alt shortcuts to the browser and preserves normal editing`, async ({ page }) => {
    await page.goto(`/en/${game}`);
    const board = page.locator(game === "word" ? ".word-board" : ".sudoku-board");
    const entry = game === "word" ? board : board.locator(".sudoku-cell.entered").first();
    if (game === "word") await expect(board).toHaveAttribute("aria-busy", "false");
    else await expect(entry).toBeEnabled();
    await entry.focus();
    await page.keyboard.press(game === "word" ? "a" : "1");
    if (game === "word") await expect(board.locator(".word-row").first()).toHaveText("A");
    else await expect(entry).toHaveText("1");
    const before = await board.innerHTML();
    const keys = game === "word"
      ? ["b", "ArrowLeft", "ArrowRight", "Home", "End", "Backspace", "Delete", "Enter"]
      : ["2", "n", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Backspace", "Delete", "0", "z"];
    for (const key of keys) {
      // Synthetic events exercise the game listener without triggering browser navigation.
      // dispatchEvent returns false if a listener cancels the shortcut.
      const uncancelled = await entry.evaluate((element, key) => element.dispatchEvent(
        new KeyboardEvent("keydown", { key, altKey: true, ctrlKey: key === "z", bubbles: true, cancelable: true }),
      ), key);
      expect(uncancelled).toBe(true);
      expect(await board.innerHTML()).toBe(before);
      await expect(entry).toBeFocused();
      if (game === "sudoku")
        await expect(page.locator(".sudoku-options button").first()).toHaveAttribute("aria-pressed", "false");
    }
    await page.keyboard.press(game === "word" ? "b" : "2");
    if (game === "word") await expect(board.locator(".word-row").first()).toHaveText("AB");
    else {
      await expect(entry).toHaveText("2");
      await page.keyboard.press("Control+z");
      await expect(entry).toHaveText("1");
    }
  });
}
