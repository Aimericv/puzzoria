import path from "node:path";
import { recordOperationError } from "../../../scripts/operational-errors.mjs";
export function recordServerError() {
  if (process.env.NODE_ENV !== "production") return;
  // Production monitoring uses the explicitly provisioned private DB volume.
  // A static fallback path is treated as an asset by instrumentation tracing.
  const source = process.env.DAILYGRID_DB_PATH;
  if (!source || source === ":memory:") return;
  const directory = path.dirname(path.resolve(/* turbopackIgnore: true */ source));
  recordOperationError(path.join(directory, "operations"));
}
