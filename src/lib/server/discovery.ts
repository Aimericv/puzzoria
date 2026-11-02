import { ownedRun } from "./play";
import { ApiError, rateLimit } from "./http";
import type { Identity } from "./auth";
import type { Challenge } from "../types";
import type { Discovery } from "../discovery-types";
import { analyzeSudoku } from "../sudoku";
import { discoverMath } from "../math-discovery";
import { normalizeWord } from "../word-normalization";
import { definitionFor } from "./definitions";
import { classicDiscovery } from "../classic-discovery";
export async function discoverRun(
  runId: unknown,
  who: Identity,
): Promise<Discovery> {
  const run = ownedRun(runId, who);
  if (!run.response_json) throw new ApiError("notFinished", 409);
  rateLimit(`discovery:${who.owner}`, 120, 60000);
  const challenge = JSON.parse(run.challenge_json) as Challenge;
  if (
    challenge.kind === "quiz" || challenge.kind === "football" ||
    challenge.kind === "ranking" ||
    challenge.kind === "rather" ||
    challenge.kind === "guess"
  )
    throw new ApiError("unavailable", 404);
  if (
    challenge.kind === "2048" ||
    challenge.kind === "mines" ||
    challenge.kind === "wordsearch"
  ) {
    return classicDiscovery(challenge, JSON.parse(run.response_json).state);
  }
  if (challenge.kind === "sudoku")
    return { kind: "sudoku", ...analyzeSudoku(challenge.grid) };
  if (challenge.kind === "math")
    return {
      kind: "math",
      target: challenge.target,
      ...discoverMath(challenge.numbers, challenge.target, challenge.reference),
    };
  const word = normalizeWord(challenge.answer),
    letters = [...word];
  return {
    kind: "word",
    word,
    locale: challenge.locale,
    definition: await definitionFor(challenge.answer, challenge.locale),
    dictionaryUrl: `https://${challenge.locale}.wiktionary.org/wiki/${encodeURIComponent(challenge.answer.toLocaleLowerCase(challenge.locale))}`,
    distinct: new Set(letters).size,
    repeated: [
      ...new Set(letters.filter((letter, i) => letters.indexOf(letter) !== i)),
    ],
  };
}
