import { notFound, redirect } from "next/navigation";
import { isGameId, isLocale, isDifficulty } from "@/lib/types";
import { gamePath } from "@/lib/i18n";
import { publishedDate } from "@/lib/date";
import { practicePath } from "@/lib/play-path";
import { canonicalChallengeDate } from "@/lib/seo";
export default async function SharedGame({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; game: string }>;
  searchParams: Promise<{ date?: string; difficulty?: string; mode?: string }>;
}) {
  const { locale, game } = await params,
    { date, difficulty, mode } = await searchParams;
  if (
    !isLocale(locale) ||
    !isGameId(game) ||
    (date && !publishedDate(date)) ||
    (difficulty && !isDifficulty(difficulty))
  )
    notFound();
  if (mode === "practice")
    redirect(
      practicePath(
        locale,
        game,
        (game === "sudoku" || game === "mines") &&
          difficulty &&
          isDifficulty(difficulty)
          ? difficulty
          : undefined,
      ),
    );
  redirect(
    gamePath(
      locale,
      game,
      canonicalChallengeDate(game, date, difficulty),
      game === "sudoku" || game === "mines" ? difficulty : undefined,
    ),
  );
}
