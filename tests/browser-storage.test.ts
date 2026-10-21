import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAccountStorage, localUpdated, readLocal, setStorageUser, writeLocal } from "../src/lib/browser-storage";

const key = "dailygrid:game:storage-regression";
let disk: Record<string, string>;
let failOn: string | undefined;
beforeEach(() => {
  disk = {};
  failOn = undefined;
  setStorageUser(null);
  vi.stubGlobal("localStorage", Object.defineProperties(disk, {
    getItem: { value: (name: string) => disk[name] ?? null },
    setItem: { value: (name: string, value: string) => {
      if (name === failOn) throw new DOMException("Full", "QuotaExceededError");
      disk[name] = value;
    } },
    removeItem: { value: (name: string) => { delete disk[name]; } },
  }));
  vi.stubGlobal("window", { dispatchEvent: vi.fn() });
});
afterEach(() => { setStorageUser(null); vi.unstubAllGlobals(); });

describe("local draft persistence failures", () => {
  it.each([key, `${key}:updated`])("keeps the latest draft and timestamp when %s cannot be written", failingKey => {
    writeLocal(key, { guesses: ["first"] }, { updatedAt: 100 });
    failOn = failingKey;
    expect(writeLocal(key, { guesses: ["first", "second"] }, { updatedAt: 200 })).toBe(false);
    expect(JSON.parse(readLocal(key)!)).toEqual({ guesses: ["first", "second"] });
    expect(localUpdated(key)).toBe(200);

    failOn = undefined;
    expect(writeLocal(key, { guesses: ["recovered"] }, { updatedAt: 300 })).toBe(true);
    // A later cross-tab update must remain visible after persistence recovers.
    disk[key] = JSON.stringify({ guesses: ["other tab"] });
    disk[`${key}:updated`] = "400";
    expect(JSON.parse(readLocal(key)!)).toEqual({ guesses: ["other tab"] });
    expect(localUpdated(key)).toBe(400);
  });

  it("isolates failed account writes from guests and other accounts, and erases the fallback", () => {
    writeLocal(key, "guest", { updatedAt: 100 });
    setStorageUser("storage-a");
    writeLocal(key, "old account draft", { updatedAt: 200 });
    failOn = `dailygrid:account:storage-a:${key}`;
    writeLocal(key, "new account draft", { updatedAt: 300 });
    expect(readLocal(key)).toBe('"new account draft"');
    setStorageUser("storage-b");
    expect(readLocal(key)).toBeNull();
    setStorageUser(null);
    expect(readLocal(key)).toBe('"guest"');
    clearAccountStorage("storage-a");
    setStorageUser("storage-a");
    expect(readLocal(key)).toBeNull();
    expect(localUpdated(key)).toBe(0);
  });
});
