import { execFileSync } from "node:child_process";
const raw = process.env.NEXT_PUBLIC_SITE_URL;
if (!raw) throw new Error("NEXT_PUBLIC_SITE_URL must be set before building the image.");
const url = new URL(raw);
if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Use a bare site origin without credentials, path or query.");
const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
if (loopback && ["http:", "https:"].includes(url.protocol)) {
  console.log("Docker local preview: loopback origin stays noindex.");
} else {
  if (url.protocol !== "https:") throw new Error("A public deployment requires HTTPS.");
  // Run the project's existing public SEO gate with exactly the image's build origin.
  execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/check-seo.ts"], { stdio: "inherit" });
}
