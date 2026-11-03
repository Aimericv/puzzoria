import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Sparkles } from "lucide-react";
import { isLocale, catalogGameIds } from "@/lib/types";
import {
  getChallenge,
  generateChallenge,
  publicChallenge,
  gameAvailable,
} from "@/lib/challenges";
import { hasDaily, historicalDailyAvailable } from "@/lib/game-modes";
import { dateLabel, utcDay } from "@/lib/date";
import { t } from "@/lib/i18n";
import { homeMetadata } from "@/lib/seo";
import { GameCards } from "@/components/cards";
import { DailyProgress } from "@/components/progress";
import { ActivityCalendar } from "@/components/activity-calendar";
import { seoCopy } from "@/lib/seo-content";
import { StructuredData } from "@/components/structured-data";
import { homeStructuredData } from "@/lib/structured-data";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return homeMetadata(locale);
}
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const m = t(locale),
    today = utcDay();
  const challenges = await Promise.all(
    catalogGameIds.filter(game => gameAvailable(game, today)).map(async (game) =>
      publicChallenge(
        hasDaily(game) && historicalDailyAvailable(game,today)
          ? await getChallenge(game, locale, today)
          : generateChallenge(game, locale, today, "easy", "home-preview-v1"),
      ),
    ),
  );
  return (
    <>
      <StructuredData value={homeStructuredData(locale, challenges.map(c => c.kind))} />
      <section className="home-heading">
        <div>
          <span className="eyebrow">
            <Sparkles size={15} />
            {m.daily}
          </span>
          <h1>{m.headline}</h1>
          <p>{m.intro}</p>
        </div>
        <div className="date-stamp">
          <CalendarDays size={18} />
          <span>{dateLabel(today, locale)}</span>
        </div>
      </section>
      <div className="collection-heading">
        <h2>{m.day}</h2>
        <span>01 — {String(challenges.length).padStart(2,"0")}</span>
      </div>
      <GameCards locale={locale} challenges={challenges} />
      <DailyProgress locale={locale} today={today} />
      <ActivityCalendar locale={locale} today={today} />
      <div className="archive-teaser">
        <CalendarDays size={21} />
        <Link href={`/${locale}/archive`}>{m.viewArchive}</Link>
        <span>{m.announcement}</span>
      </div>
      <section className="home-explainer">
        <h2>{seoCopy(locale).homeHeading}</h2>
        <p>{seoCopy(locale).homeBody}</p>
      </section>
    </>
  );
}
