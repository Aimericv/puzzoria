import path from "node:path";
import { spawn } from "node:child_process";
import { NextRequest } from "next/server";
import { authenticate } from "../src/lib/server/auth.ts";
import { closeDatabase } from "../src/lib/server/database.ts";
const filename = path.resolve(process.env.DAILYGRID_DB_PATH ?? "");
if (!filename.startsWith(path.resolve(".sites-runtime") + path.sep) || !path.basename(filename).startsWith("e2e-")) throw new Error("E2E requires an isolated database");
const admins = process.env.ANALYTICS_ADMIN_USERNAMES ?? "";
// Public signup cannot claim configured admin names. Seed fixture accounts before enabling the allowlist.
process.env.ANALYTICS_ADMIN_USERNAMES = "";
try {
  for (const username of admins.split(",").filter(Boolean)) await authenticate(new NextRequest("http://127.0.0.1:3100/api/account"), { username, password: "Measurement-Test-2026!" }, true);
} finally { closeDatabase(); process.env.ANALYTICS_ADMIN_USERNAMES = admins; }
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], { stdio: "inherit", env: process.env });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("error", () => process.exit(1)); child.on("exit", code => process.exit(code ?? 1));
