import Link from "next/link";
import { quizTopics, quizTopicPath } from "@/lib/knowledge-catalog";
import { quizThemes, quizThemePath, type QuizTheme } from "@/lib/quiz-themes";
import { quizEditorial, quizEditorialLabels } from "@/lib/quiz-editorial";
import { kt } from "@/lib/knowledge-i18n";
import { gamePath } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import { StructuredData } from "./structured-data";
import { quizThemeStructuredData } from "@/lib/knowledge-seo";

const copy = {
  en: { themes: "Explore by subject", all: "All timed quizzes", play: "Play", career: "Guess the football player", careerText: "One harder player each day, plus unlimited career puzzles. Find the player in six guesses from his clubs in chronological order." },
  fr: { themes: "Explorer par thème", all: "Tous les quiz chrono", play: "Jouer", career: "Devine le footballeur", careerText: "Un joueur plus difficile chaque jour et des parcours en illimité. Retrouve le joueur en six essais grâce à ses clubs dans l’ordre chronologique." },
  es: { themes: "Explorar por tema", all: "Todos los quizzes contrarreloj", play: "Jugar", career: "Adivina el futbolista", careerText: "Un jugador más difícil cada día y trayectorias ilimitadas. Descubre al jugador en seis intentos por sus clubes en orden cronológico." },
  de: { themes: "Nach Thema entdecken", all: "Alle Quiz auf Zeit", play: "Spielen", career: "Errate den Fußballspieler", careerText: "Jeden Tag ein schwierigerer Spieler und unbegrenzte Karriererätsel. Errate den Spieler in sechs Versuchen anhand seiner chronologischen Vereinsstationen." },
};

export function QuizThemeNav({ locale, selected }: { locale: Locale; selected?: string }) {
  return <nav className="quiz-theme-nav" aria-label={copy[locale].themes}>
    <Link href={`/${locale}/quiz`}>{copy[locale].all}</Link>
    {quizThemes.map(theme => <Link key={theme.id} href={quizThemePath(locale, theme)} aria-current={selected === theme.id ? "page" : undefined}>{theme.emoji} {theme.name[locale]}</Link>)}
  </nav>;
}

export function QuizThemePage({ locale, theme }: { locale: Locale; theme: QuizTheme }) {
  const m = copy[locale];
  const first = quizTopics.find(t => t.id === theme.groups[0].topics[0])!;
  return <>
    <StructuredData value={quizThemeStructuredData(locale, theme)} />
    <QuizThemeNav locale={locale} selected={theme.id} />
    <header className={`quiz-theme-heading ${theme.id}`}>
      <span className="quiz-theme-symbol" aria-hidden="true">{theme.emoji}</span>
      <div><h1>{theme.title[locale]}</h1><p>{theme.description[locale]}</p><Link className="quiz-theme-play quiz-quick-start" data-quiz-quick-start href={quizTopicPath(locale, first)}>{m.play} · {first.title[locale]} →</Link></div>
    </header>
    <p className="quiz-theme-intro">{theme.intro[locale]}</p>
    <nav className="quiz-theme-sections" aria-label={m.themes}>{theme.groups.map((group, i) => <a key={i} href={`#quiz-group-${i}`}>{group.title[locale]}</a>)}</nav>
    {theme.groups.map((group, i) => <section className="quiz-theme-group" id={`quiz-group-${i}`} key={i}>
      <h2>{group.title[locale]}</h2><p>{group.text[locale]}</p>
      <div className="quiz-topic-grid">{group.topics.map(id => {
        const topic = quizTopics.find(t => t.id === id)!;
        return <Link key={id} href={quizTopicPath(locale, topic)} className="quiz-topic-card quiz-theme-card">
          <span className="quiz-topic-emoji" aria-hidden="true">{topic.emoji}</span>
          <span><strong>{topic.title[locale]}</strong><span>{topic.description[locale]}</span><span>{topic.count} {kt(locale).total.toLocaleLowerCase(locale)} · {topic.seconds} s</span><b className="quiz-theme-play">{m.play} →</b></span>
        </Link>;
      })}</div>
    </section>)}
    {theme.id === "football" && <section className="quiz-career-link"><h2>{m.career}</h2><p>{m.careerText}</p><Link className="primary-button" href={gamePath(locale, "football")}>{m.play} →</Link></section>}
    <section className="quiz-editorial"><h2>{theme.methodTitle[locale]}</h2><p>{theme.method[locale]}</p></section>
    <QuizThemeNav locale={locale} selected={theme.id} />
  </>;
}

export function QuizEditorial({ locale, topicId }: { locale: Locale; topicId: string }) {
  const guide = quizEditorial[topicId];
  if (!guide) return null;
  return <section className="quiz-editorial" data-quiz-editorial>
    <div><h2>{quizEditorialLabels.method[locale]}</h2><p>{guide.method[locale]}</p></div>
    <div><h2>{quizEditorialLabels.pitfall[locale]}</h2><p>{guide.pitfall[locale]}</p></div>
    <div className="quiz-editorial-sources"><h3>{quizEditorialLabels.sources[locale]}</h3><ul>{guide.sources.map(source => <li key={source.url}><a href={source.url} rel="noopener noreferrer" target="_blank">{source.name}</a></li>)}</ul></div>
  </section>;
}
