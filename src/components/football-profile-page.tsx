import Link from "next/link";
import { ArrowRight, ChevronLeft, Goal } from "lucide-react";
import { footballProfilePath } from "@/lib/football-profile-path";
import { gamePath } from "@/lib/i18n";
import { kt } from "@/lib/knowledge-i18n";
import { quizThemePath, quizThemes } from "@/lib/quiz-themes";
import { footballProfiles, type FootballProfile } from "@/lib/server/football-profiles";
import { pageMetadata } from "@/lib/seo";
import { locales, type Locale } from "@/lib/types";

const copy = {
  en: { profiles: "Football player careers", title: "Clubs and career", clubs: "Clubs in chronological order", theme: "Football quizzes", play: "Guess the football player", source: "Source", more: "Another player’s career" },
  fr: { profiles: "Parcours de footballeurs", title: "Clubs et carrière", clubs: "Les clubs dans l’ordre chronologique", theme: "Quiz football", play: "Devine le footballeur", source: "Source", more: "Un autre parcours" },
  es: { profiles: "Trayectorias de futbolistas", title: "Clubes y trayectoria", clubs: "Clubes en orden cronológico", theme: "Quizzes de fútbol", play: "Adivina el futbolista", source: "Fuente", more: "La trayectoria de otro jugador" },
  de: { profiles: "Karrieren von Fußballspielern", title: "Vereine und Karriere", clubs: "Vereine in chronologischer Reihenfolge", theme: "Fußball-Quiz", play: "Errate den Fußballspieler", source: "Quelle", more: "Eine weitere Spielerkarriere" },
};

export function footballProfileMetadata(locale: Locale, profile: FootballProfile) {
  const title = `${profile.name} – ${copy[locale].title} | Puzzoria`;
  const meta = pageMetadata(locale, title, profile.description[locale]);
  const canonical = footballProfilePath(locale, profile.slug);
  const languages = Object.fromEntries(locales.map(language => [language, footballProfilePath(language, profile.slug)]));
  return {
    ...meta,
    alternates: { canonical, languages: { ...languages, "x-default": languages.en } },
    openGraph: { ...meta.openGraph, url: canonical },
  };
}

export function FootballProfileLinks({ locale, except }: { locale: Locale; except?: string }) {
  return (
    <section className="quiz-theme-group" id={except ? undefined : "football-profiles"}>
      <h2>{except ? copy[locale].more : copy[locale].profiles}</h2>
      <div className="quiz-topic-grid">
        {footballProfiles.filter(profile => profile.slug !== except).map(profile => (
          <Link key={profile.slug} href={footballProfilePath(locale, profile.slug)} className="quiz-topic-card">
            <Goal size={24} aria-hidden="true" />
            <span><strong>{profile.name}</strong><span>{profile.description[locale]}</span></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function FootballProfilePage({ locale, profile }: { locale: Locale; profile: FootballProfile }) {
  const m = copy[locale];
  const footballTheme = quizThemes.find(theme => theme.id === "football")!;
  const play = gamePath(locale, "football");
  return (
    <article className="word-article-layout football">
      <Link className="back-link" href={quizThemePath(locale, footballTheme)}>
        <ChevronLeft size={17} aria-hidden="true" />{m.theme}
      </Link>
      <header className="word-article-hero">
        <span className="eyebrow"><Goal size={17} aria-hidden="true" />{m.profiles}</span>
        <h1>{profile.name}</h1>
        <p className="word-article-intro">{profile.description[locale]}</p>
      </header>
      <div className="word-article-columns">
        <aside className="word-article-toc">
          <nav aria-label={m.title}>
            <a href="#clubs">{m.clubs}</a>
            {profile.sections.map((section, i) => (
              <a key={i} href={`#career-${i + 1}`}>{section.title[locale]}</a>
            ))}
          </nav>
          <Link className="primary-button" href={play}>{m.play}<ArrowRight size={16} aria-hidden="true" /></Link>
        </aside>
        <div className="word-article-body">
          <section id="clubs">
            <h2>{m.clubs}</h2>
            <ol className="football-timeline">
              {profile.clubs.map(({ club, years, loan }, i) => (
                <li key={i}>
                  <span className="football-stop" aria-hidden="true">{i + 1}</span>
                  <div className="football-club-spell">
                    <div><strong>{club}</strong><span>{years}{loan && <small>{kt(locale).loan}</small>}</span></div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          {profile.sections.map(({ title, body, source }, i) => (
            <section id={`career-${i + 1}`} key={i}>
              <h2>{title[locale]}</h2>
              <p>{body[locale]}</p>
              <small>{m.source} · <a href={source.url}>{source.name}</a></small>
            </section>
          ))}
          <FootballProfileLinks locale={locale} except={profile.slug} />
        </div>
      </div>
    </article>
  );
}
