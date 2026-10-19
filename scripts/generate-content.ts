import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  generateChallenge,
  validateChallenge,
  gameAvailable,
} from "../src/lib/challenges";
import { DAY_MS, utcDay, validDate } from "../src/lib/date";
import { gameIds, locales } from "../src/lib/types";
import { dailyDifficulties, historicalDailyAvailable } from "../src/lib/game-modes";
const start = process.argv[2] ?? utcDay(),
  count = Number(process.argv[3] ?? 7);
if (!validDate(start) || !Number.isInteger(count) || count < 1 || count > 366)
  throw new Error(
    "Usage: npm run content:generate -- YYYY-MM-DD [1..366 days]",
  );
let total = 0;
for (let i = 0; i < count; i++) {
  const date = utcDay(new Date(Date.parse(start) + DAY_MS * i));
  const directory = path.join("content", "daily", date);
  await mkdir(directory, { recursive: true });
  for (const locale of locales)
    for (const game of gameIds.filter((game) => gameAvailable(game, date) && historicalDailyAvailable(game, date)))
      for (const difficulty of game === "sudoku" ||
      game === "mines" ||
      game === "guess"
        ? dailyDifficulties(game, date)
        : (["easy"] as const)) {
        const challenge = generateChallenge(game, locale, date, difficulty);
        validateChallenge(challenge);
        await writeFile(
          path.join(
            directory,
            `${locale}-${game}${game === "sudoku" || game === "mines" || game === "guess" ? `-${difficulty}` : ""}.json`,
          ),
          JSON.stringify(challenge, null, 2) + "\n",
        );
        total++;
      }
}
console.log(`Generated and validated ${total} challenges from ${start}.`);
