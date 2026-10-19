"use client";
import Link from "next/link";
import {
  Check,
  BookOpen,
  Hash,
  Sigma,
  Star,
  Grid2X2,
  Bomb,
  Search,
  ListOrdered,
  MessagesSquare,
  CircleHelp,
} from "lucide-react";
import type { GameId, Locale, PublicChallenge } from "@/lib/types";
import { gameFamily } from "@/lib/types";
import { gamePath, t } from "@/lib/i18n";
import { registry } from "@/lib/registry";
import { useStats } from "./storage";
import { practicePath } from "@/lib/play-path";
import { rt } from "@/lib/retention-i18n";
import { et } from "@/lib/engagement-i18n";
import { visitPath } from "@/lib/engagement";
import { usePreferences } from "./preferences";
import { hasDaily, dailyGoal } from "@/lib/game-modes";
export function GameIcon({ game, size = 20 }: { game: GameId; size?: number }) {
  const Icon = {
    word: BookOpen,
    rareword: BookOpen,
    sudoku: Hash,
    math: Sigma,
    "2048": Grid2X2,
    mines: Bomb,
    wordsearch: Search,
    ranking: ListOrdered,
    guess: CircleHelp,
    rather: MessagesSquare,
  }[game];
  return <Icon size={size} />;
}
export function GameCards({
  locale,
  challenges,
}: {
  locale: Locale;
  challenges: PublicChallenge[];
}) {
  const m = t(locale),
    { completions } = useStats();
  const { value, update } = usePreferences(),
    e = et(locale),
    favorite = value.favorite ? gameFamily(value.favorite) : null;
  const ordered = [...challenges].sort(
    (a, b) =>
      Number(b.kind === favorite) - Number(a.kind === favorite),
  );
  return (
    <>
      {value.last &&
        !completions.some((c) => c.challengeId === value.last?.challengeId) && (
          <Link className="resume-game" href={visitPath(value.last, locale)}>
            {e.resume} · {t(locale)[registry[gameFamily(value.last.game)].name]}
            {value.last.game === "rareword" && ` · ${m.rarewordName}`}
          </Link>
        )}
      <div className="game-cards">
        {ordered.map((c) => {
          const game = registry[c.kind],
            done = completions.some((x) => x.challengeId === c.id);
          return (
            <article className={`game-card ${game.color}`} key={c.id}>
              <div className="card-top">
                <span className="category">
                  <GameIcon game={c.kind} size={16} />
                  {m[game.category]}
                </span>
                <span className="daily-tag">
                  {hasDaily(c.kind) ? m.today : rt(locale).practice}
                </span>
                <button
                  className="favorite-button"
                  aria-label={`${e.favorite} · ${m[game.name]}`}
                  aria-pressed={favorite === c.kind}
                  onClick={() =>
                    update({
                      ...value,
                      favorite: favorite === c.kind ? null : c.kind,
                    })
                  }
                >
                  <Star
                    size={19}
                    fill={favorite === c.kind ? "currentColor" : "none"}
                  />
                </button>
              </div>
              <div className="game-preview" aria-hidden="true">
                {(c.kind === "word" || c.kind === "rareword") ? (
                  <div className="word-preview">
                    {(locale === "fr"
                      ? "JOUER"
                      : locale === "es"
                        ? "JUGAR"
                        : locale === "de"
                          ? "SPIEL"
                          : "DAILY"
                    )
                      .split("")
                      .map((letter, i) => (
                        <span
                          className={
                            i === 1 ? "yellow" : i === 3 ? "muted" : "green"
                          }
                          key={i}
                        >
                          {letter}
                        </span>
                      ))}
                  </div>
                ) : c.kind === "sudoku" ? (
                  <div className="sudoku-preview">
                    {c.grid.slice(0, 9).map((n, i) => (
                      <span key={i}>{n || <i />}</span>
                    ))}
                  </div>
                ) : c.kind === "math" ? (
                  <div className="math-preview">
                    <span>{c.numbers[0]}</span>
                    <b>+</b>
                    <span>{c.numbers[1]}</span>
                    <b>=</b>
                    <span className="question">?</span>
                  </div>
                ) : c.kind === "2048" ? (
                  <div className="tile-preview">
                    {[2, 4, 8, 16].map((n) => (
                      <span className={`tile-${n}`} key={n}>
                        {n}
                      </span>
                    ))}
                  </div>
                ) : c.kind === "mines" ? (
                  <div className="mine-preview">
                    {["", "", "", "", "1", "⚑", "", "", ""].map((n, i) => (
                      <span key={i}>{n}</span>
                    ))}
                  </div>
                ) : c.kind === "wordsearch" ? (
                  <div className="search-preview">
                    {c.words[0]
                      .split("")
                      .slice(0, 6)
                      .map((letter, i) => (
                        <span key={i}>{letter}</span>
                      ))}
                  </div>
                ) : c.kind === "ranking" ? (
                  <div className="social-card-preview">
                    <span>🥇</span>
                    <strong>1 · ? · 3 · ? · 5</strong>
                  </div>
                ) : c.kind === "guess" ? (
                  <div className="social-card-preview">
                    <span>🤖</span>
                    <strong>1 &lt; ? &lt; 100</strong>
                  </div>
                ) : (
                  <div className="social-card-preview">
                    <span>🟦 ⚡ 🟥</span>
                    <strong>A / B</strong>
                  </div>
                )}
              </div>
              <h2>
                {m[game.name]}
                <span className="card-number">
                  0{challenges.indexOf(c) + 1}
                </span>
              </h2>
              <p>{dailyGoal(c.kind, locale) ?? m[game.description]}</p>
              <div className="card-bottom">
                <div className="card-actions">
                  <Link href={gamePath(locale, c.kind)} className="card-play">
                    {done && hasDaily(c.kind) ? (
                      <>
                        <Check size={17} />
                        {m.completed}
                      </>
                    ) : (
                      m.play
                    )}
                  </Link>
                  {hasDaily(c.kind) && (
                    <div className="card-variants">
                    <Link
                      className="card-practice"
                      href={practicePath(locale, c.kind)}
                    >
                      {rt(locale).practice} →
                    </Link>
                    {c.kind === "word" && (
                      <Link className="card-practice card-word-variant" href={gamePath(locale, "rareword")}>
                        {m.rarewordName} →
                      </Link>
                    )}
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
