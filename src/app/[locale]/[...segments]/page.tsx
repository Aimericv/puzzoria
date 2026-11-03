import Link from "next/link";
import { quizTopics, quizTopicPath } from "@/lib/knowledge-catalog";
import { kt } from "@/lib/knowledge-i18n";
import { quizTopicStructuredData } from "@/lib/knowledge-seo";
import { QuizTopics } from "@/components/quiz-topics";
import { notFound, permanentRedirect } from "next/navigation";
import { ChevronLeft, Info, CalendarDays } from "lucide-react";
import {
  difficulties,
  catalogGameIds,
  gameFamily,
  isDifficulty,
  isLocale,
  type Difficulty,
  type GameId,
  type Locale,
} from "@/lib/types";
import { gamePath, t } from "@/lib/i18n";
import { gameFromSlug, gameName, registry } from "@/lib/registry";
import {
  getChallenge,
  generateChallenge,
  publicChallenge,
  gameAvailable,
} from "@/lib/challenges";
import { dateLabel, publishedDate, utcDay } from "@/lib/date";
import { pageMetadata, gameMetadata } from "@/lib/seo";
import { seoCopy } from "@/lib/seo-content";
import { GameGuide } from "@/components/game-guide";
import { StructuredData } from "@/components/structured-data";
import { gameStructuredData } from "@/lib/structured-data";
import { GamePlayer } from "@/components/game-player";
import { GameIcon } from "@/components/cards";
import { PracticePlayer } from "@/components/practice-player";
import { practicePath } from "@/lib/play-path";
import { rt } from "@/lib/retention-i18n";
import { pg } from "@/lib/post-game-i18n";
import { locales } from "@/lib/types";
import {
  hasDaily,
  historicalDailyAvailable,
  dailyGoal,
  unlimitedIntro,
  dailyDifficulties,
} from "@/lib/game-modes";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ locale: string; segments: string[] }> };
function resolve(
  locale: string,
  segments: string[],
): {
  locale: Locale;
  game: GameId;
  date: string;
  difficulty: Difficulty;
  archived: boolean;
  practice: boolean;
  quizCategory?: string;
} | null {
  if (!isLocale(locale)) return null;
  const game = gameFromSlug(segments[0], locale);
  if (!game) return null;
  let date = utcDay(),
    difficulty: Difficulty = "easy",
    archived = false,
    practice = false;
  const remaining = segments.slice(1);
  const topic = game === "quiz" && remaining.length === 1 ? quizTopics.find(t=>t.slug[locale] === remaining[0]) : undefined;
  if (topic) remaining.shift();
  if (remaining[0] === "practice") {
    practice = true;
    remaining.shift();
  }
  if (remaining[0] === "archive") {
    archived = true;
    date = remaining[1];
    remaining.splice(0, 2);
    if (!date || !publishedDate(date)) return null;
  }
  if (remaining.length) {
    if (
      (game !== "sudoku" && game !== "mines" && game !== "guess") ||
      remaining.length !== 1 ||
      !isDifficulty(remaining[0])
    )
      return null;
    difficulty = remaining[0];
  }
  if (!gameAvailable(game, date)) return null;
  if (practice && archived) return null;
  if (archived && !historicalDailyAvailable(game, date)) return null;
  if ((!hasDaily(game) || !historicalDailyAvailable(game,date)) && !archived) practice = true;
  if (game === "sudoku" && archived && !dailyDifficulties(game, date).includes(difficulty)) return null;
  if (game === "sudoku" && !practice && !archived && difficulty !== "easy")
    permanentRedirect(gamePath(locale, "sudoku"));
  return { locale, game, date, difficulty, archived, practice, ...(topic ? {quizCategory:topic.id} : {}) };
}
export async function generateMetadata({ params }: Props) {
  const p = await params,
    r = resolve(p.locale, p.segments);
  if (!r) notFound();
  if (r.quizCategory) {
    const topic=quizTopics.find(t=>t.id===r.quizCategory)!;
    const metadata=pageMetadata(r.locale,`Quiz : ${topic.title[r.locale]} | Puzzoria`,topic.description[r.locale]);
    const languages=Object.fromEntries(locales.map(l=>[l,quizTopicPath(l,topic)]));
    return {...metadata,alternates:{canonical:quizTopicPath(r.locale,topic),languages:{...languages,"x-default":languages.en}},openGraph:{...metadata.openGraph,url:quizTopicPath(r.locale,topic)}};
  }
  if (p.segments[1] === "practice")
    return {
      ...pageMetadata(
        r.locale,
        `${gameName(r.game, r.locale)} · ${rt(r.locale).practice} | Puzzoria`,
        rt(r.locale).practiceIntro,
      ),
      alternates: {
        canonical: practicePath(
          r.locale,
          r.game,
          r.game === "sudoku" || r.game === "mines" || r.game === "guess"
            ? r.difficulty
            : undefined,
        ),
        languages: Object.fromEntries(
          locales.map((l) => [
            l,
            practicePath(
              l,
              r.game,
              r.game === "sudoku" || r.game === "mines" || r.game === "guess"
                ? r.difficulty
                : undefined,
            ),
          ]),
        ),
      },
      robots: { index: false, follow: true },
    };
  return gameMetadata(
    r.locale,
    r.game,
    r.archived ? r.date : undefined,
    r.game === "sudoku" || r.game === "mines" || r.game === "guess"
      ? r.difficulty
      : undefined,
  );
}
export default async function GamePage({ params }: Props) {
  const p = await params,
    r = resolve(p.locale, p.segments);
  if (!r) notFound();
  const { locale, game, date, difficulty, archived, practice } = r,
    m = t(locale),
    meta = registry[game];
  if (game === "rareword" && practice) permanentRedirect(gamePath(locale,"rareword"));
  const challenge = practice
    ? null
    : publicChallenge(await getChallenge(game, locale, date, difficulty));
  if (challenge)
    challenge.mode =
      archived && (date !== utcDay() || !hasDaily(game)) ? "archive" : "daily";
  return (
    <>
      {p.segments[1] !== "practice" && !r.quizCategory && (
        <StructuredData
          value={gameStructuredData(
            locale,
            game,
            archived ? date : undefined,
            game === "sudoku" || game === "mines" || game === "guess"
              ? difficulty
              : undefined,
          )}
        />
      )}
      {r.quizCategory && <StructuredData value={quizTopicStructuredData(locale,quizTopics.find(t=>t.id===r.quizCategory)!)}/>}
      <Link className="back-link" href={`/${locale}`}>
        <ChevronLeft size={17} />
        {m.back}
      </Link>
      <div className={`game-heading ${gameFamily(game)}`}>
        <div className="game-heading-icon">
          <GameIcon game={game} size={27} />
        </div>
        <div>
          <span className="eyebrow">
            {m[meta.category]} ·{" "}
            {practice
              ? rt(locale).practice
              : archived
                ? m.archiveGame
                : pg(locale).daily}
          </span>
          <h1>{r.quizCategory ? quizTopics.find(t=>t.id===r.quizCategory)!.title[locale] : gameName(gameFamily(game), locale)}</h1>
        </div>
        <span className="game-date">
          {practice
            ? rt(locale).practice
            : archived
              ? m.archiveGame
              : pg(locale).daily}
          {!practice && <small>{dateLabel(date, locale)}</small>}
        </span>
      </div>
      {!practice && !archived && game !== "word" && game !== "rareword" && game !== "football" && (
        <p className="daily-challenge-notice" data-daily-challenge>
          {pg(locale).dailyHelp}
        </p>
      )}
      {gameFamily(game) === "word" ? (
        <nav className="mode-nav word-variants" aria-label={m.wordName}>
          <Link className={game === "word" && !practice ? "selected" : ""} aria-current={game === "word" && !practice ? "page" : undefined} href={gamePath(locale, "word")}>
            {pg(locale).wordDaily}
          </Link>
          <Link className={game === "word" && practice ? "selected" : ""} aria-current={game === "word" && practice ? "page" : undefined} href={practicePath(locale, "word")}>
            {rt(locale).practice}
          </Link>
          <Link className={game === "rareword" ? "selected" : ""} aria-current={game === "rareword" ? "page" : undefined} href={gamePath(locale, "rareword")}>
            {m.rarewordName}
          </Link>
        </nav>
      ) : hasDaily(game) && (
        <nav className="mode-nav" aria-label={rt(locale).practice}>
          <Link
            className={!practice ? "selected" : ""}
            href={gamePath(
              locale,
              game,
              undefined,
              game === "sudoku" || game === "mines" || game === "guess"
                ? difficulty
                : undefined,
            )}
          >
            {rt(locale).dailyMode}
          </Link>
          <Link
            className={practice ? "selected" : ""}
            href={practicePath(
              locale,
              game,
              game === "sudoku" || game === "mines" || game === "guess"
                ? difficulty
                : undefined,
            )}
          >
            {rt(locale).practice}
          </Link>
        </nav>
      )}
      {game === "rareword" && (
        <nav className="word-variant-modes" aria-label={m.rarewordName}>
          <Link aria-current={!practice ? "page" : undefined} href={gamePath(locale, "rareword")}>
            {rt(locale).dailyMode}
          </Link>
          <Link aria-current={practice ? "page" : undefined} href={practicePath(locale, "rareword")}>
            {rt(locale).practice}
          </Link>
        </nav>
      )}
      <p className="mode-intro">
        {practice
          ? hasDaily(game)
            ? rt(locale).practiceIntro
            : unlimitedIntro(locale)
          : archived
            ? rt(locale).dailyIntro
            : dailyGoal(game, locale)}
      </p>
      <p className="game-intro">{r.quizCategory ? quizTopics.find(t=>t.id===r.quizCategory)!.description[locale]+" "+kt(locale).topicIntro.replace("{n}",String(quizTopics.find(t=>t.id===r.quizCategory)!.count)).replace("{seconds}",String(quizTopics.find(t=>t.id===r.quizCategory)!.seconds)) : seoCopy(locale).games[game].intro}</p>
      {((game === "sudoku" && (practice || archived && dailyDifficulties(game, date).length > 1)) || game === "mines" || game === "guess") && (
        <nav className="difficulty-nav" aria-label={m.difficulty}>
          {difficulties.map((d) => (
            <Link
              key={d}
              className={d === difficulty ? "selected" : ""}
              href={
                practice && (hasDaily(game) || p.segments[1] === "practice")
                  ? practicePath(locale, game, d)
                  : gamePath(locale, game, archived ? date : undefined, d)
              }
            >
              {m[d]}
            </Link>
          ))}
        </nav>
      )}
      <div className="game-layout">
        <section className={`play-surface ${game}`}>
          {practice ? (
            <PracticePlayer
              game={game}
              locale={locale}
              difficulty={difficulty}
              quizCategory={r.quizCategory}
              preview={publicChallenge(
                generateChallenge(
                  game,
                  locale,
                  date,
                  difficulty,
                  "page-preview-v1",
                  r.quizCategory,
                ),
              )}
            />
          ) : (
            challenge && <GamePlayer challenge={challenge} locale={locale} />
          )}
        </section>
        <aside className="game-sidebar">
          <section className="rules-panel">
            <h2>
              <Info size={17} />
              {m.howTo}
            </h2>
            <p>{m[meta.rules]}</p>
            {(game === "word" || game === "rareword") && (
              <div className="word-legend">
                <span className="correct">A</span>
                <span className="present">B</span>
                <span className="absent">C</span>
              </div>
            )}
            {game === "sudoku" && <p className="note-help">{m.noteHelp}</p>}
            {(game === "word" || game === "rareword") && locale === "fr" && (
              <p className="dictionary-credit">
                Dictionnaire :{" "}
                <a
                  href="https://lexique.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Lexique 3.83
                </a>
                , New &amp; Pallier —{" "}
                <a
                  href="https://creativecommons.org/licenses/by-sa/4.0/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  CC BY-SA 4.0
                </a>
                .
              </p>
            )}
          </section>
          <section className="other-games">
            <h2>{m.day}</h2>
            {catalogGameIds
              .filter((g) => g !== gameFamily(game))
              .map((g) => (
                <Link href={gamePath(locale, g)} key={g}>
                  <span className={`mini-game-icon ${g}`}>
                    <GameIcon game={g} />
                  </span>
                  <span>
                    <strong>{gameName(g, locale)}</strong>
                  </span>
                </Link>
              ))}
          </section>
          {hasDaily(game) && (
            <Link className="sidebar-archive" href={`/${locale}/archive`}>
              <CalendarDays size={18} />
              {m.viewArchive}
            </Link>
          )}
        </aside>
      </div>
      {game === "quiz" && <QuizTopics locale={locale} selected={r.quizCategory}/>}
      <GameGuide locale={locale} game={game} />
    </>
  );
}
