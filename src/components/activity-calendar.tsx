"use client";
import { et } from "@/lib/engagement-i18n";
import { activityDays } from "@/lib/engagement";
import { dateLabel } from "@/lib/date";
import type { GameId, Locale } from "@/lib/types";
import { useStats } from "./storage";
export function ActivityCalendar({
  locale,
  today,
  game,
}: {
  locale: Locale;
  today: string;
  game?: GameId;
}) {
  const { completions } = useStats(),
    m = et(locale);
  return (
    <section className="activity-calendar">
      <h2>{m.activity}</h2>
      <p>{m.activityHelp}</p>
      <ol aria-label={m.activity}>
        {activityDays(completions, today, game).map(({ date, played }) => (
          <li key={date} className={played ? "played" : ""}>
            <span
              title={`${dateLabel(date, locale)} · ${played ? m.playedDay : m.noPlay}`}
              aria-label={`${dateLabel(date, locale)} · ${played ? m.playedDay : m.noPlay}`}
            >
              {Number(date.slice(-2))}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
