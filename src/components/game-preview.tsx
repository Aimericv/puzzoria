import type { Locale, PublicChallenge } from "@/lib/types";
import { t } from "@/lib/i18n";
import { seoCopy } from "@/lib/seo-content";
import { st } from "@/lib/social-i18n";
import { WordModeLabel } from "./word-mode-label";
import Image from "next/image";
import { mapCopy } from "@/lib/map-i18n";
export function GamePreview({
  challenge,
  locale,
}: {
  challenge: PublicChallenge;
  locale: Locale;
}) {
  const m = t(locale);
  return (
    <div className={`puzzle-preview ${challenge.kind}`} data-game-preview>
      <p role="status">{m.loading}</p>
      {challenge.kind === "quiz" && challenge.format === "map" && <figure className="map-quiz-preview"><Image src="/maps/europe-outline-v1.svg" width={1000} height={760} loading="eager" alt={mapCopy(locale).preview} unoptimized/><figcaption>{mapCopy(locale).sources}</figcaption></figure>}
      {challenge.kind === "ranking" && (
        <div className="blind-item">
          <span>{challenge.items[0].emoji}</span>
          <strong>{challenge.items[0].label[locale]}</strong>
        </div>
      )}
      {challenge.kind === "guess" && (
        <div className="number-preview">1 &lt; ? &lt; 100</div>
      )}
      {challenge.kind === "rather" && (
        <div className="dilemma-options">
          <span>{challenge.questions[0].a[locale]}</span>
          <b>{st(locale).or}</b>
          <span>{challenge.questions[0].b[locale]}</span>
        </div>
      )}
      {challenge.kind === "2048" && (
        <div
          className="classic-board board-tiles"
          style={{ "--board-size": 4 } as React.CSSProperties}
        >
          {challenge.grid.map((n, i) => (
            <span key={i} className={`tile-cell tile-${n}`}>
              {n || ""}
            </span>
          ))}
        </div>
      )}
      {challenge.kind === "mines" && (
        <div className="classic-board-frame">
          <div
            className="classic-board board-mines"
            style={{ "--board-size": challenge.size } as React.CSSProperties}
          >
            {Array.from({ length: challenge.size ** 2 }, (_, i) => (
              <span
                className={`puzzle-cell ${i === challenge.start ? "safe-start" : ""}`}
                key={i}
              >
                {i === challenge.start ? "◎" : ""}
              </span>
            ))}
          </div>
        </div>
      )}
      {challenge.kind === "wordsearch" && (
        <>
          <p>
            {m.theme} · {challenge.theme}
          </p>
          <div
            className="classic-board board-wordsearch"
            style={{ "--board-size": challenge.size } as React.CSSProperties}
          >
            {challenge.grid.map((letter, i) => (
              <span className="puzzle-cell" key={i}>
                {letter}
              </span>
            ))}
          </div>
          <ul className="search-word-list">
            {challenge.words.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </>
      )}
      {challenge.kind === "sudoku" && (
        <div
          className="preview-sudoku"
          role="group"
          aria-label={`${m.sudokuName} · ${m[challenge.difficulty]}`}
        >
          {challenge.grid.map((n, i) => (
            <span
              key={i}
              className={`${i % 9 === 2 || i % 9 === 5 ? "box-right" : ""} ${Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5 ? "box-bottom" : ""}`}
            >
              {n || ""}
            </span>
          ))}
        </div>
      )}
      {challenge.kind === "math" && (
        <>
          <div className="math-target">
            <span>{m.target}</span>
            <strong>{challenge.target}</strong>
          </div>
          <div className="preview-numbers">
            {challenge.numbers.map((n, i) => (
              <span key={i}>{n}</span>
            ))}
          </div>
        </>
      )}
      {(challenge.kind === "word" || challenge.kind === "rareword") && (
        <>
          <WordModeLabel challenge={challenge} locale={locale} />
          <div
            className="preview-word"
            style={{gridTemplateColumns: `repeat(${challenge.length}, 1fr)`}}
            role="group"
            aria-label={`${challenge.length} · ${challenge.attempts}`}
          >
            {Array.from(
              { length: challenge.length * challenge.attempts },
              (_, i) => (
                <span key={i} />
              ),
            )}
          </div>
        </>
      )}
      <noscript>
        <p>{seoCopy(locale).noScript}</p>
      </noscript>
    </div>
  );
}
