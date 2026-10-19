import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));
import { readFile } from "node:fs/promises";
import { generateChallenge, getChallenge } from "../src/lib/challenges";
const read = vi.mocked(readFile);
beforeEach(() => { read.mockReset(); });
describe("scheduled challenge selection", () => {
  it("uses planned editorial content before the deterministic fallback", async () => {
    const scheduled = {
      ...generateChallenge("word", "en", "2026-10-01"),
      answer: "CRANE",
    };
    read.mockResolvedValue(JSON.stringify(scheduled));
    expect(await getChallenge("word", "en", "2026-10-01")).toEqual(scheduled);
  });
  it("uses the deterministic generator only when a file is absent", async () => {
    read.mockRejectedValue(
      Object.assign(new Error("missing"), { code: "ENOENT" }),
    );
    expect(await getChallenge("math", "fr", "2026-10-01")).toEqual(
      generateChallenge("math", "fr", "2026-10-01"),
    );
  });
  it("does not silently replace malformed planned files", async () => {
    read.mockResolvedValue("{bad json");
    await expect(getChallenge("word", "en", "2026-10-01")).rejects.toThrow();
  });
  it("rejects a planned file for another locale or date", async () => {
    read.mockResolvedValue(
      JSON.stringify(generateChallenge("word", "de", "2026-10-01")),
    );
    await expect(getChallenge("word", "en", "2026-10-01")).rejects.toThrow(
      "Mismatched",
    );
  });
  it("surfaces infrastructure failures instead of switching puzzles", async () => {
    read.mockRejectedValue(
      Object.assign(new Error("permission denied"), { code: "EACCES" }),
    );
    await expect(getChallenge("word", "en", "2026-10-01")).rejects.toThrow(
      "permission denied",
    );
  });
});
