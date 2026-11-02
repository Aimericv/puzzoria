import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { validateChallenge } from "../src/lib/challenges";
import { isDifficulty, isGameId, isLocale, locales } from "../src/lib/types";
import { wordArticles } from "../src/lib/server/word-articles";
const root = path.join(process.cwd(), "content", "daily");
let count = 0;
const {validateKnowledgeContent} = await import("../src/lib/server/knowledge-content");
validateKnowledgeContent();
console.log("Validated multilingual quizzes and football careers.");
for (const directory of await readdir(root, { withFileTypes: true }))
  if (directory.isDirectory()) {
    for (const file of await readdir(path.join(root, directory.name)))
      if (file.endsWith(".json")) {
        const challenge = JSON.parse(
          await readFile(path.join(root, directory.name, file), "utf8"),
        );
        if (
          !isLocale(challenge.locale) ||
          !isGameId(challenge.kind) ||
          challenge.date !== directory.name ||
          (challenge.kind === "sudoku" && !isDifficulty(challenge.difficulty))
        )
          throw new Error(`Invalid metadata: ${file}`);
        validateChallenge(challenge);
        count++;
      }
  }
console.log(`Validated ${count} scheduled challenges.`);
let articleCount = 0;
for (const locale of locales) {
  const seen = new Set<string>();
  for (const a of wordArticles(locale)) {
    const text = [a.concept, a.pronunciation, a.grammar, a.etymology, a.nuance, a.anecdote, ...a.definition, ...a.examples, ...a.related];
    if (seen.has(a.slug) || text.some(value => !value.trim()) || a.definition.length < 2 || a.examples.length < 2 || a.related.length < 2 || !a.sources.length || a.sources.some(url => new URL(url).protocol !== "https:")) throw new Error(`Incomplete word article: ${locale}/${a.slug}`);
    seen.add(a.slug); articleCount++;
  }
}
console.log(`Validated ${articleCount} multilingual word articles.`);
