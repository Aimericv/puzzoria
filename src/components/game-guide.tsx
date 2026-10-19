import type { GameId, Locale } from "@/lib/types";
import { seoCopy } from "@/lib/seo-content";
export function GameGuide({ locale, game }: { locale: Locale; game: GameId }) {
  const copy = seoCopy(locale).games[game];
  return (
    <section className="game-guide" data-seo-guide>
      {copy.sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.text}</p>
        </section>
      ))}
    </section>
  );
}
