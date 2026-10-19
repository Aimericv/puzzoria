import { mkdir, writeFile, access } from "node:fs/promises";
import { generateChallenge, validateChallenge } from "../src/lib/challenges";
import { locales } from "../src/lib/types";
import { RARE_WORD_FROM } from "../src/lib/rare-word";
import { DAY_MS } from "../src/lib/date";
// Pin the first editorial deck. Never overwrite a published puzzle.
for (let day = 0; day < 8; day++) {
  const date = new Date(Date.parse(RARE_WORD_FROM) + day * DAY_MS).toISOString().slice(0,10);
  await mkdir(`content/daily/${date}`, {recursive:true});
  for (const locale of locales) {
    const filename = `content/daily/${date}/${locale}-rareword.json`;
    try { await access(filename); continue; } catch { /* New publication only. */ }
    const challenge = generateChallenge("rareword", locale, date);
    validateChallenge(challenge);
    await writeFile(filename, JSON.stringify(challenge, null, 2) + "\n", {flag:"wx"});
  }
}
console.log("Pinned the first eight unusual words in each language.");
