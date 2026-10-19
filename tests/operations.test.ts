import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile, utimes, readdir, symlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { alertTransitions, rotateBackups, operationsTick } from "../scripts/operations.mjs";
import { database, closeDatabase } from "../src/lib/server/database";
import { recordOperationError, recentOperationErrors } from "../scripts/operational-errors.mjs";
import { checkPublicHtml } from "../scripts/check-public-site";
import { missingLegalDetails } from "../src/lib/server/legal";
import { recordServerError } from "../src/lib/server/operational-errors";
let directory: string;
beforeEach(async () => { await mkdir(".sites-runtime", { recursive: true }); directory = await mkdtemp(path.resolve(".sites-runtime/operations-")); });
afterEach(async () => { closeDatabase(); vi.unstubAllEnvs(); if (!directory.startsWith(path.resolve(".sites-runtime") + path.sep)) throw new Error(); await rm(directory, { recursive: true, force: true }); });
it("writes production error timestamps only beside the explicitly configured private database", async () => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("DAILYGRID_DB_PATH", undefined);
  recordServerError(); expect(await readdir(directory)).toEqual([]);
  vi.stubEnv("DAILYGRID_DB_PATH", path.join(directory, "private.sqlite"));
  recordServerError(); expect(await recentOperationErrors(path.join(directory, "operations"))).toBe(1);
  vi.stubEnv("NODE_ENV", "development"); recordServerError();
  expect(await recentOperationErrors(path.join(directory, "operations"))).toBe(1);
});
it("rotates only expired regular backups and preserves journals, unrelated files and recent backups", async () => {
  const now = Date.now(), old = `dailygrid-2026-01-01T00-00-00-000Z-${randomUUID()}.sqlite`, recent = `dailygrid-2026-10-06T00-00-00-000Z-${randomUUID()}.sqlite`;
  for (const file of [old, recent, "account-deletions.jsonl", "private.sqlite", "partial.sqlite.partial"]) await writeFile(path.join(directory, file), "fixture");
  await utimes(path.join(directory, old), new Date(now - 15 * 86400000), new Date(now - 15 * 86400000));
  expect(await rotateBackups(directory, now)).toBe(1);
  expect(await readdir(directory)).toEqual(expect.arrayContaining([recent, "account-deletions.jsonl", "private.sqlite", "partial.sqlite.partial"]));
});
it("does not follow directory symlinks during backup rotation", async () => {
  const target = path.join(directory, "keep"), backups = path.join(directory, "backups"); await mkdir(target); await mkdir(backups);
  const name = `dailygrid-2026-01-01T00-00-00-000Z-${randomUUID()}.sqlite`; await symlink(target, path.join(backups, name), "junction");
  expect(await rotateBackups(backups)).toBe(0); expect(await readdir(backups)).toEqual([name]);
});
it("alerts on transitions, avoids spam, reminds hourly and announces recovery", () => {
  const first = alertTransitions({}, { availability: true, disk: false }, 1000);
  expect(first.notifications).toEqual([{ name: "availability", status: "alert" }]);
  expect(alertTransitions(first.state, { availability: true }, 2000).notifications).toEqual([]);
  expect(alertTransitions(first.state, { availability: true }, 3601000).notifications).toHaveLength(1);
  expect(alertTransitions(first.state, { availability: false }, 3000).notifications).toEqual([{ name: "availability", status: "recovered" }]);
});
it("counts operational errors using timestamps only and expires old logs", async () => {
  const now = Date.now(); recordOperationError(directory, now - 1000); recordOperationError(directory, now - 600000); recordOperationError(directory, now - 9 * 86400000);
  expect(await recentOperationErrors(directory, now)).toBe(1); expect((await readdir(directory)).length).toBe(1);
});
it("requires publication identity/contact configuration instead of invented legal details", () => {
  expect(missingLegalDetails({})).toHaveLength(7);
  expect(missingLegalDetails({ LEGAL_PUBLISHER_NAME: "Fixture publisher", LEGAL_PUBLISHER_ADDRESS: "Fixture address", LEGAL_PUBLISHER_COUNTRY: "France", LEGAL_CONTACT_EMAIL: "invalid", LEGAL_HOST_NAME: "Fixture host", LEGAL_HOST_ADDRESS: "Fixture host address", LEGAL_STORAGE_REGION: "EU" })).toEqual(["email"]);
});
it("detects incorrect canonical/hreflang and unintended production noindex", () => {
  const html = '<html><head><title>Puzzoria</title><meta name="description" content="Play"><meta name="robots" content="index,follow"><link rel="canonical" href="https://puzzoria.test/fr"><link rel="alternate" hreflang="en" href="https://puzzoria.test/en"></head></html>';
  expect(checkPublicHtml(html, "https://puzzoria.test/fr", { en: "https://puzzoria.test/en" })).toEqual([]);
  expect(checkPublicHtml(html.replace("index,follow", "noindex"), "https://puzzoria.test/fr", { en: "https://wrong.test/en" })).toEqual(["hreflang:en", "indexation"]);
});
it("backs up once per day, purges expired measurement without visits and records a health outage", async () => {
  const source = path.join(directory, "source.sqlite"), backups = path.join(directory, "backups"), now = Date.now();
  closeDatabase(); vi.stubEnv("DAILYGRID_DB_PATH", source);
  const db = database();
  db.prepare("INSERT INTO measurement_sessions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run("session", "owner", "device", now, now, "/en", "en", "desktop", "direct", null, null, null, null);
  for (const [id, days] of [["old", 91], ["recent", 89]] as const) db.prepare("INSERT INTO measurement_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id, "session", "page_view", now - days * 86400000, "/en", null, null, "en", null, null, null, 0, null);
  let healthy = true;
  const server = createServer((_, response) => { response.writeHead(healthy ? 200 : 503, { "content-type": "application/json" }); response.end(JSON.stringify({ status: healthy ? "ok" : "unavailable" })); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); if (!address || typeof address === "string") throw new Error();
    const config = { source, directory: backups, healthUrl: `http://127.0.0.1:${address.port}/api/health`, minimumFreeBytes: 0, webhook: "" };
    const first = await operationsTick(config, {}, now);
    expect(first.lastBackup).toBe(now); expect(db.prepare("SELECT id FROM measurement_events").all()).toEqual([expect.objectContaining({ id: "recent" })]);
    await operationsTick(config, first, now + 60000); expect((await readdir(backups)).filter(name => name.endsWith(".sqlite"))).toHaveLength(1);
    healthy = false; const failed = await operationsTick(config, first, now + 120000); expect(failed.alerts?.availability.active).toBe(true); expect(failed.lastBackup).toBe(now);
    healthy = true; const recovered = await operationsTick(config, failed, now + 180000); expect(recovered.alerts?.availability.active).toBe(false);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
it("cleans abandoned partial backups after a day while preserving unrelated partial files", async () => {
  const now = Date.now(), name = `dailygrid-2026-01-01T00-00-00-000Z-${randomUUID()}.sqlite.partial`;
  await writeFile(path.join(directory, name), "private partial"); await writeFile(path.join(directory, "keep.partial"), "unrelated");
  await utimes(path.join(directory, name), new Date(now - 2 * 86400000), new Date(now - 2 * 86400000));
  expect(await rotateBackups(directory, now)).toBe(1); expect(await readdir(directory)).toEqual(["keep.partial"]);
});
