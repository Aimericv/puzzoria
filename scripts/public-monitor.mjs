import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { alertTransitions, notifyOperations } from "./operations.mjs";
// Run from a DIFFERENT machine: the app-side checker cannot detect loss of its own host.
try {
  const origin = new URL(process.env.PUBLIC_MONITOR_ORIGIN ?? "");
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") throw new Error();
  const directory = process.env.MONITOR_STATE_DIR ?? "/var/lib/puzzoria-monitor";
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, "state.json"); let state = {};
  try { state = JSON.parse(await readFile(filename, "utf8")); } catch { /* First check. */ }
  let unavailable = false;
  try {
    const response = await fetch(new URL("/api/health", origin), { redirect: "error", signal: AbortSignal.timeout(10000) });
    unavailable = !response.ok || (await response.json()).status !== "ok";
  } catch { unavailable = true; }
  const transition = alertTransitions(state, { publicAvailability: unavailable });
  for (const notification of transition.notifications) {
    if (!process.env.OPERATIONS_WEBHOOK_URL) throw new Error();
    await notifyOperations(notification, process.env.OPERATIONS_WEBHOOK_URL);
  }
  const temporary = `${filename}.partial`; await writeFile(temporary, JSON.stringify(transition.state), { mode: 0o600 }); await rename(temporary, filename);
} catch { console.error("Puzzoria external availability monitor failed"); process.exitCode = 1; }
