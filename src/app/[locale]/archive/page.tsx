import { gameAvailable } from "@/lib/challenges";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { isLocale } from "@/lib/types";
import { dailyGameIds } from "@/lib/game-modes";
import { archiveDates, dateLabel, challengeNumber } from "@/lib/date";
import { t, gamePath } from "@/lib/i18n";
import { gameName } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";
import { GameIcon } from "@/components/cards";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMetadata(
    locale,
    `${t(locale).archive} | Puzzoria`,
    t(locale).archiveIntro,
    "/archive",
  );
}
export default async function Archive({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = t(locale),
    dates = archiveDates();
  return (
    <>
      <span className="eyebrow">
        <CalendarDays size={16} />
        {m.archive}
      </span>
      <h1>{m.archiveTitle}</h1>
      <p className="page-intro limited">{m.archiveIntro}</p>
      <div className="archive-list">
        {dates.length ? (
          dates.map((date) => (
            <article className="archive-row" key={date}>
              <div>
                <small>#{String(challengeNumber(date)).padStart(3, "0")}</small>
                <h2>{dateLabel(date, locale)}</h2>
              </div>
              <div className="archive-games">
                {dailyGameIds
                  .filter((game) => gameAvailable(game, date))
                  .map((game) => (
                    <Link
                      key={game}
                      className={`archive-game ${game}`}
                      href={gamePath(locale, game, date)}
                    >
                      <GameIcon game={game} size={17} />
                      {gameName(game, locale)}
                    </Link>
                  ))}
              </div>
            </article>
          ))
        ) : (
          <p>{m.noArchive}</p>
        )}
      </div>
    </>
  );
}
