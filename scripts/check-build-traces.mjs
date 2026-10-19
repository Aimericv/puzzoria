import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Build must fail before publication if file tracing includes private runtime data.
const root = process.cwd();
const dist = path.resolve(root, process.env.NEXT_TEST_DIST_DIR ?? ".next");
const privateRoots = [".data", ".sites-runtime", "test-results", "playwright-report", "tests", "e2e"].map(name => path.resolve(root, name));
const privateFiles = [process.env.DAILYGRID_DB_PATH, process.env.ACCOUNT_DELETION_LOG].filter(value => value && value !== ":memory:").map(value => path.resolve(root, value));
let checked = 0;
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory() && !["standalone", "cache", "node_modules"].includes(entry.name)) await walk(filename);
    else if (entry.isFile() && entry.name.endsWith(".nft.json")) {
      const trace = JSON.parse(await readFile(filename, "utf8"));
      for (const item of trace.files) {
        const resolved = path.resolve(path.dirname(filename), item);
        const privateDirectory = privateRoots.some(directory => resolved === directory || resolved.startsWith(directory + path.sep));
        const privateEnvironment = path.dirname(resolved) === root && /^\.env(?:$|\.)/.test(path.basename(resolved));
        if (privateDirectory || privateEnvironment || privateFiles.includes(resolved) || /\.(sqlite|sqlite-wal|sqlite-shm)$/i.test(resolved)) throw new Error("Private runtime files in production traces; publication refused.");
      }
      checked++;
    }
  }
}
await walk(dist);
if (!checked) throw new Error("No production traces found; publication refused.");
console.log(`Production traces verified: ${checked}; no private runtime files.`);
