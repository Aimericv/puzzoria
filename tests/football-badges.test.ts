import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { clubBadge } from "../src/lib/football-badges";

it("resolves audited local club crests without active or external SVG content",()=>{
  const manifest=JSON.parse(readFileSync("content/football-badges.sources.json","utf8")) as {assets:{club:string;file:string;sha256:string}[]};
  expect(manifest.assets.length).toBeGreaterThan(50);
  for(const asset of manifest.assets) {
    expect(clubBadge(asset.club)).toBe(`/club-badges/${asset.file}`);
    expect(asset.file).toMatch(/^[a-z0-9-]+\.svg$/);
    const bytes=readFileSync(`public/club-badges/${asset.file}`),svg=bytes.toString("utf8");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
    expect(svg).toContain("<svg");
    expect(svg).not.toMatch(/<(?:script|foreignObject)\b|\bon\w+\s*=|(?:href|src)=["']https?:|<!ENTITY|@import/i);
  }
  expect(clubBadge("An unknown club")).toBeUndefined();
});
