import { spawn } from "node:child_process";
// Playwright enables colors for workers; an inherited NO_COLOR contradicts that setting.
const env = { ...process.env };
delete env.NO_COLOR;
const child = spawn(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
  { stdio: "inherit", env },
);
child.on("exit", (code) => process.exit(code ?? 1));
