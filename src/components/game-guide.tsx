import Link from "next/link";
import type { GameId, Locale } from "@/lib/types";
import { seoCopy } from "@/lib/seo-content";
import { publishedWordArticles } from "@/lib/server/word-articles";
import { wordArticleCopy } from "@/lib/word-article-i18n";
import { wordArticlePath } from "@/lib/word-article-path";
export function GameGuide({ locale, game }: { locale: Locale; game: GameId }) {
  const copy = seoCopy(locale).games[game];
  const articles = game === "rareword" ? publishedWordArticles(locale) : [];
  const articleCopy = wordArticleCopy(locale);
  return (
    <section className="game-guide" data-seo-guide>
      {copy.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.text}</p>
        </section>
      ))}
      {articles.length > 0 && (
        <section data-published-word-articles>
          <h2>{articleCopy.collection}</h2>
          <p>{articleCopy.publishedIntro}</p>
          <ul>
            {articles.map((article) => (
              <li key={article.slug}>
                <Link href={wordArticlePath(locale, article.word)}>
                  {articleCopy.title.replace("{word}", article.word)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
