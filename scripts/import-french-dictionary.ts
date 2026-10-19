import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { normalizeWord } from "../src/lib/word-normalization";

const sourceUrl = "https://lexique.org/databases/Lexique383/Lexique383.tsv";
const localSource = process.argv[2];
const source = localSource
  ? await readFile(localSource, "utf8")
  : await (async () => {
      const response = await fetch(sourceUrl, {
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok)
        throw new Error(`Lexique download failed: ${response.status}`);
      return response.text();
    })();
const previous = JSON.parse(
  await readFile("content/dictionaries/fr.json", "utf8"),
);
const legacyAnswers: string[] = previous.legacyAnswers ?? previous.answers;
const lines = source.trim().split(/\r?\n/);
const header = lines.shift()!.split("\t");
const column = Object.fromEntries(header.map((name, index) => [name, index]));
for (const required of ["ortho", "islem", "cgram", "freqfilms2", "freqlivres"])
  if (column[required] === undefined)
    throw new Error(`Missing Lexique column: ${required}`);
const allowed = new Set<string>(
  [...legacyAnswers, ...previous.allowed]
    .map(normalizeWord)
    .filter((w) => /^[A-Z]{5}$/.test(w)),
);
const answers = new Set<string>(legacyAnswers.map(normalizeWord));
// Broader guesses include conjugations/plurals; daily answers favor frequent lemmas.
const excludedAnswers = new Set([
  "BAISE",
  "BITES",
  "CONNE",
  "NEGRE",
  "NEGRO",
  "PUTES",
  "NAZIE",
  "NAZIS",
]);
for (const line of lines) {
  const cells = line.split("\t"),
    word = normalizeWord(cells[column.ortho]);
  if (!/^[A-Z]{5}$/.test(word)) continue;
  allowed.add(word);
  if (
    cells[column.islem] === "1" &&
    ["NOM", "ADJ", "VER", "ADV"].includes(cells[column.cgram]) &&
    Math.max(
      Number(cells[column.freqfilms2]),
      Number(cells[column.freqlivres]),
    ) >= 5 &&
    !excludedAnswers.has(word)
  )
    answers.add(word);
}
if (allowed.size < 4000 || !allowed.has("ADULE") || !allowed.has("OUTIL"))
  throw new Error("Incomplete French dictionary");
const dictionary = {
  answers: [...answers].sort(),
  allowed: [...allowed].sort(),
  legacyAnswers,
  answersFrom: "2026-10-03",
  source: {
    name: "Lexique 3.83",
    authors: "Boris New & Christophe Pallier et al.",
    url: sourceUrl,
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    sha256: createHash("sha256").update(source).digest("hex"),
    modifications:
      "Five-letter ASCII-normalized words; merged with original curated entries; frequent-lemma answer selection.",
  },
};
await mkdir("content/dictionaries", { recursive: true });
await writeFile(
  "content/dictionaries/fr.json",
  JSON.stringify(dictionary, null, 2) + "\n",
);
console.log(
  `French dictionary: ${dictionary.allowed.length} accepted guesses, ${dictionary.answers.length} daily answers. Historical answers unchanged before ${dictionary.answersFrom}.`,
);
