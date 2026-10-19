import { notifyOperations } from "./operations.mjs";
try {
  if (!process.env.OPERATIONS_WEBHOOK_URL) throw new Error();
  await notifyOperations({ name: "offsite-backup", status: "alert" }, process.env.OPERATIONS_WEBHOOK_URL);
} catch { console.error("Puzzoria operational notification failed"); process.exitCode = 1; }
