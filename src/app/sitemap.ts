import { quizTopics, quizTopicPath } from "@/lib/knowledge-catalog";
import { quizThemes, quizThemePath } from "@/lib/quiz-themes";
import { gameAvailable } from "@/lib/challenges";
import type { MetadataRoute } from "next";
import { locales, gameIds, difficulties } from "@/lib/types";
import { archiveDates, utcDay } from "@/lib/date";
import { canonicalGamePath, siteOrigin } from "@/lib/seo";
import { hasDaily, historicalDailyAvailable, dailyDifficulties } from "@/lib/game-modes";
import { publishedWordArticles, articleAlternatives } from "@/lib/server/word-articles";
import { wordArticlePath } from "@/lib/word-article-path";
import { footballProfilePath } from "@/lib/football-profile-path";
import { footballProfiles } from "@/lib/server/football-profiles";
export const dynamic = "force-dynamic";
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  function add(
    paths: Record<string, string>,
    changeFrequency: "daily" | "monthly",
    priority: number,
  ) {
    const languages = Object.fromEntries(
      Object.entries(paths).map(([l, p]) => [l, siteOrigin + p]),
    );
    for (const pathname of Object.values(paths))
      entries.push({
        url: siteOrigin + pathname,
        changeFrequency,
        priority,
        alternates: { languages: { ...languages, "x-default": languages.en } },
      });
  }
  for (const suffix of ["", "/archive", "/privacy"])
    add(
      Object.fromEntries(locales.map((l) => [l, `/${l}${suffix}`])),
      suffix === "/privacy" ? "monthly" : "daily",
      suffix ? 0.5 : 1,
    );
  for (const game of gameIds.filter(game => gameAvailable(game, utcDay())))
    for (const difficulty of game === "mines" ||
    game === "guess"
      ? difficulties
      : [undefined])
      add(
        Object.fromEntries(
          locales.map((l) => [
            l,
            canonicalGamePath(l, game, undefined, difficulty),
          ]),
        ),
        hasDaily(game) ? "daily" : "monthly",
        0.9,
      );
  for (const date of archiveDates())
    for (const game of gameIds.filter(
      (game) =>
        gameAvailable(game, date) && historicalDailyAvailable(game, date),
    ))
      for (const difficulty of game === "sudoku" ||
      game === "mines" ||
      game === "guess"
        ? dailyDifficulties(game, date)
        : [undefined])
        add(
          Object.fromEntries(
            locales.map((l) => [
              l,
              canonicalGamePath(l, game, date, difficulty),
            ]),
          ),
          "monthly",
          0.5,
        );
  if (gameAvailable("quiz",utcDay())) {
    for (const topic of quizTopics) add(Object.fromEntries(locales.map(l=>[l,quizTopicPath(l,topic)])),"monthly",.8);
    for (const theme of quizThemes) add(Object.fromEntries(locales.map(l=>[l,quizThemePath(l,theme)])),"monthly",.8);
  }
  for (const profile of footballProfiles) {
    add(Object.fromEntries(locales.map(locale => [locale, footballProfilePath(locale, profile.slug)])), "monthly", 0.6);
  }
  for (const locale of locales) for (const article of publishedWordArticles(locale)) {
    const languages = Object.fromEntries(Object.entries(articleAlternatives(article)).map(([l, p]) => [l, siteOrigin + p]));
    entries.push({url: siteOrigin + wordArticlePath(locale, article.word), lastModified: article.publicFrom,
      changeFrequency: "monthly", priority: .6,
      alternates: {languages: {...languages, ...(languages.en ? {"x-default": languages.en} : {})}}});
  }
  return entries;
}
