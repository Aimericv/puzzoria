import { gamePath } from "./i18n";
import type { Difficulty, GameId, Locale } from "./types";
export const practicePath = (
  locale: Locale,
  game: GameId,
  difficulty?: Difficulty,
) =>
  `${gamePath(locale, game)}/practice${(game === "sudoku" || game === "mines" || game === "guess") && difficulty ? `/${difficulty}` : ""}`;
