"use client";
import { Flame, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/types";
import { t } from "@/lib/i18n";
import { streaks } from "@/lib/stats";
import { utcDay } from "@/lib/date";
import { useStats, clockText } from "./storage";
export function DailyProgress({
  locale,
  today,
}: {
  locale: Locale;
  today: string;
}) {
  const m = t(locale),
    { completions } = useStats();
  const streak = streaks(completions, today);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      if (utcDay(now) !== today) {
        window.location.reload();
        return;
      }
      setLeft(
        Math.ceil(
          (Date.parse(`${today}T00:00:00Z`) + 86400000 - now.getTime()) / 1000,
        ),
      );
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [today]);
  return (
    <section className="daily-progress" aria-label={m.yourProgress}>
      <div className="progress-streak">
        <span className="fire-circle">
          <Flame size={22} />
        </span>
        <div>
          <strong>
            {streak.current} <span>{m.streak}</span>
          </strong>
          <small>{m.dailyOnly}</small>
        </div>
      </div>
      <div className="countdown">
        <Clock3 size={18} />
        <div>
          <small>{m.newIn}</small>
          <strong>
            {left === null
              ? "—:—:—"
              : `${String(Math.floor(left / 3600)).padStart(2, "0")}:${clockText(left % 3600)}`}
          </strong>
        </div>
      </div>
    </section>
  );
}
