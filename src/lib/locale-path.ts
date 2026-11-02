import { quizTopics, quizTopicPath } from "./knowledge-catalog";
import { slugs } from "./i18n";
import type { GameId, Locale } from "./types";
import { articleSection } from "./word-article-path";

export function localizedPath(pathname: string, current: Locale, next: Locale) {
  const parts = pathname.split("/");
  if (parts[2] === articleSection[current]) return `/${next}/${slugs[next].rareword}`;
  if (parts[2] === "quiz" && parts[3]) {
    const topic=quizTopics.find(t=>t.slug[current]===parts[3]);
    if (topic) return quizTopicPath(next,topic);
  }
  parts[1] = next;
  const game = (Object.keys(slugs[current]) as GameId[]).find(
    (key) => slugs[current][key] === parts[2],
  );
  if (game) parts[2] = slugs[next][game];
  return parts.join("/");
}
