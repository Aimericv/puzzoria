import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";
import { backupSqlite } from "../scripts/backup-sqlite.mjs";
import { closeDatabase } from "../src/lib/server/database";
import { GET } from "../src/app/api/health/route";
let workspace: string;
beforeEach(()=>{
  const root=path.resolve(".sites-runtime");mkdirSync(root,{recursive:true});workspace=mkdtempSync(path.join(root,"docker-storage-"));
  closeDatabase();
});
afterEach(()=>{
  closeDatabase();vi.unstubAllEnvs();
  const root=path.resolve(".sites-runtime")+path.sep;
  if(!workspace.startsWith(root))throw new Error("Unexpected fixture path");
  rmSync(workspace,{recursive:true,force:true});
});
it("backs up committed WAL records while the source is open, with independent, verified snapshots",async()=>{
  const source=path.join(workspace,"source.sqlite"),destination=path.join(workspace,"private-backups");
  const writer=new DatabaseSync(source);
  try{
    writer.exec("PRAGMA journal_mode=WAL; CREATE TABLE fixture(value INTEGER); INSERT INTO fixture VALUES(1)");
    const first=await backupSqlite(source,destination);
    writer.exec("INSERT INTO fixture VALUES(2)");
    const second=await backupSqlite(source,destination);
    expect(first).not.toBe(second);
    for(const [file,count] of [[first,1],[second,2]] as const){
      const copy=new DatabaseSync(file,{readOnly:true});
      try{expect(copy.prepare("SELECT COUNT(*) AS n FROM fixture").get()?.n).toBe(count);expect(copy.prepare("PRAGMA quick_check").get()?.quick_check).toBe("ok");}finally{copy.close();}
    }
    expect(readdirSync(destination).some(f=>f.endsWith(".partial"))).toBe(false);
  }finally{writer.close();}
});
it("never silently creates an empty source database for a missing backup",async()=>{
  await expect(backupSqlite(path.join(workspace,"absent.sqlite"),path.join(workspace,"backups"))).rejects.toThrow();
  expect(readdirSync(workspace)).toEqual([]);
});
it("reports readiness without leaking database details and refuses a corrupt store",async()=>{
  vi.stubEnv("DAILYGRID_DB_PATH",path.join(workspace,"healthy.sqlite"));
  const healthy=GET();expect(healthy.status).toBe(200);expect(await healthy.json()).toEqual({status:"ok"});expect(healthy.headers.get("x-robots-tag")).toBe("noindex");
  closeDatabase();const corrupt=path.join(workspace,"private-path.sqlite");writeFileSync(corrupt,"not a database");vi.stubEnv("DAILYGRID_DB_PATH",corrupt);
  const failed=GET();expect(failed.status).toBe(503);expect(await failed.text()).toBe('{"status":"unavailable"}');
});
