"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, Flame } from "lucide-react";
import { BrandMark } from "./brand-mark";
import type { Locale } from "@/lib/types";
import { locales } from "@/lib/types";
import { languageNames, t } from "@/lib/i18n";
import { localizedPath } from "@/lib/locale-path";
import { useStats } from "./storage";
import { streaks } from "@/lib/stats";
import { track } from "@/lib/analytics";
import { rt } from "@/lib/retention-i18n";
import { articleSection } from "@/lib/word-article-path";
export function Header({ locale }: { locale: Locale }) {
  const m = t(locale),
    pathname = usePathname();
  const { completions } = useStats();
  const streak = streaks(completions).current;
  function changeLocale(next: Locale) {
    document.cookie = `dailygrid-locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
    try {
      localStorage.setItem("dailygrid:locale", next);
    } catch {
      /* The preference cookie still works when browser storage is blocked. */
    }
    track("locale", { locale: next });
    window.location.assign(
      localizedPath(pathname, locale, next) + (pathname.split("/")[2] === articleSection[locale] ? "" : window.location.search),
    );
  }
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href={`/${locale}`} className="brand" aria-label="Puzzoria">
          <span className="brand-icon">
            <BrandMark />
          </span>
          puzz<span className="brand-light">oria</span>
          <span className="brand-period">.</span>
        </Link>
        <nav aria-label={m.completeLabel}>
          {[
            ["", m.games],
            ["/archive", m.archive],
            ["/stats", m.stats],
            ["/leaderboards", rt(locale).leaderboards],
            ["/account", rt(locale).account],
          ].map(([path, label]) => (
            <Link
              key={path}
              className={
                pathname === `/${locale}${path}`
                  ? "nav-link active"
                  : "nav-link"
              }
              href={`/${locale}${path}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-tools">
          <span className="header-streak" title={m.currentStreak}>
            <Flame size={19} />
            {streak}
          </span>
          <label className="locale-picker">
            <Globe size={17} />
            <select
              aria-label={languageNames[locale]}
              value={locale}
              onChange={(e) => changeLocale(e.target.value as Locale)}
            >
              {locales.map((l) => (
                <option key={l} value={l}>
                  {languageNames[l]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
