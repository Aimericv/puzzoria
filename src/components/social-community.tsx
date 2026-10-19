"use client";
import type { Locale } from "@/lib/types";
import type {
  Community,
  PublicSocialChallenge,
  SocialState,
  VoteCommunity,
} from "@/lib/social-types";
import { st, sf, type SocialKey } from "@/lib/social-i18n";
import { choiceThemes } from "@/lib/social-share";
import { gameStatisticsCopy } from "@/lib/game-statistics-i18n";
export function VoteReveal({
  result,
  choice,
  locale,
}: {
  result: VoteCommunity | null;
  choice: "a" | "b";
  locale: Locale;
}) {
  const m = st(locale);
  if (!result)
    return (
      <p className="community-wait" role="status">
        {m.waiting}
      </p>
    );
  return (
    <div className="vote-reveal" aria-live="polite">
      <div className="vote-bar" aria-label={`A ${result.a}% · B ${result.b}%`}>
        <span style={{ width: result.a + "%" }} />
        <span style={{ width: result.b + "%" }} />
      </div>
      <div className="vote-percentages">
        <strong>🟦 {result.a}%</strong>
        <strong>🟥 {result.b}%</strong>
      </div>
      <p className="social-reaction">
        {result.majority === null
          ? m.split
          : result.majority === choice
            ? m.majority
            : m.minority}
      </p>
      <p>{sf(m.rare, { n: result[choice] })}</p>
      <small>{sf(m.samples, { n: result.samples })}</small>
    </div>
  );
}
export function CommunityResult({
  challenge: c,
  state,
  community,
  locale,
  showRanking = true,
}: {
  challenge: PublicSocialChallenge;
  state: SocialState;
  community: Community;
  locale: Locale;
  showRanking?: boolean;
}) {
  const m = st(locale);
  if (c.kind === "ranking") {
    const top = state.visibleItems.find((i) => i.id === state.ranking[0])!;
    return (
      <section className="community-result">
        {community?.kind === "ranking" && community.percentages[0][0] < 50 && (
          <p className="social-reaction">
            {sf(m.topDisagreement, {
              item: top.label[locale],
              n: 100 - community.percentages[0][0],
            })}
          </p>
        )}
        {showRanking && <ol className="ranking-result">
          {state.ranking.map((id, i) => {
            const item = state.visibleItems.find((v) => v.id === id)!;
            return (
              <li key={id}>
                <span>
                  {item.emoji} {item.label[locale]}
                </span>
                {community?.kind === "ranking" && (
                  <small>
                    {sf(m.pick, {
                      n: community.percentages[i][i],
                      item: item.label[locale],
                      position: i + 1,
                    })}
                  </small>
                )}
              </li>
            );
          })}
        </ol>}
        <h3>{m.community}</h3>
        {community?.kind === "ranking" ? (
          <>
            <p className="social-reaction">
              {sf(m.matched, { n: community.matched })}
            </p>
            {community.swap >= 50 && <p>{sf(m.swap, { n: community.swap })}</p>}
            {community.unusual >= 50 && (
              <p>{sf(m.unusual, { n: community.unusual })}</p>
            )}
            {community.hasControversy && (
              <p>
                {m.controversial}:{" "}
                {
                  state.visibleItems.find(
                    (i) => i.id === state.ranking[community.controversial],
                  )!.label[locale]
                }{" "}
                · #{community.controversial + 1}
              </p>
            )}
            <details className="community-average">
              <summary>{m.averageRanking}</summary>
              <ol className="average-ranking">
                {(community.average ?? []).map(({ item: id, position }) => (
                  <li key={id}>
                    <span>
                      {
                        state.visibleItems.find((i) => i.id === id)!.label[
                          locale
                        ]
                      }
                    </span>
                    <small>
                      {sf(m.averagePosition, {
                        n: new Intl.NumberFormat(locale, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 2,
                        }).format(position),
                      })}
                    </small>
                  </li>
                ))}
              </ol>
            </details>
            <details>
              <summary>{m.common}</summary>
              <ol>
                {community.common.map((id) => (
                  <li key={id}>
                    {state.visibleItems.find((i) => i.id === id)!.label[locale]}
                  </li>
                ))}
              </ol>
            </details>
            <small>{sf(m.samples, { n: community.samples })}</small>
          </>
        ) : (
          <p className="community-wait">{m.waiting}</p>
        )}
      </section>
    );
  }
  if (c.kind === "rather") {
    const data = community?.kind === "rather" ? community : null;
    return (
      <section className="community-result">
        <p className="social-reaction">
          {m.summary}:{" "}
          {choiceThemes(c, state)
            .map((tag) => m[tag as SocialKey])
            .join(" / ")}
          .
        </p>
        <small>{m.summaryNote}</small>
        <h3>{m.community}</h3>
        {data?.matched !== null && data?.matched !== undefined ? (
          <><p className="comparison-highlight">{sf(m.majorityScore, { n: data.matched })}</p><small>{gameStatisticsCopy(locale).questionsMeasured.replace("{n}",String(data.questions.filter(q=>q?.majority!==null&&q?.majority!==undefined).length))}</small></>
        ) : (
          <p className="community-wait">{m.waiting}</p>
        )}
        {data?.unusual !== null && data?.unusual !== undefined && (
          <p>{sf(m.unusual, { n: data.unusual })}</p>
        )}
        {data?.rarest !== null && data?.rarest !== undefined && (
          <p>
            {m.rarest}:{" "}
            {c.questions[data.rarest][state.votes[data.rarest]][locale]} ·{" "}
            {data.questions[data.rarest]![state.votes[data.rarest]]}%
          </p>
        )}
        {data?.divisive !== null && data?.divisive !== undefined && (
          <p>
            {m.divisive}: {c.questions[data.divisive].a[locale]} · {data.questions[data.divisive]!.a}% /{" "}
            {c.questions[data.divisive].b[locale]} · {data.questions[data.divisive]!.b}%
          </p>
        )}
        <details>
          <summary>{m.ended}</summary>
          {state.votes.map((vote, i) => (
            <div key={i} className="recap-question">
              <p>{c.questions[i][vote][locale]}</p>
              <VoteReveal
                result={data?.questions[i] ?? null}
                choice={vote}
                locale={locale}
              />
            </div>
          ))}
        </details>
      </section>
    );
  }
  return (
    <section className="community-result">
      <h3>{m.community}</h3>
      {community?.kind === "guess" ? (
        <>
          <p className="social-reaction">
            {sf(state.success ? gameStatisticsCopy(locale).fewerProposals : m.fooled, {
              n: state.success ? community.faster : community.fooled,
            })}
          </p>
          <small>{sf(m.samples, { n: community.samples })}</small>
        </>
      ) : (
        <p className="community-wait">{m.waiting}</p>
      )}
    </section>
  );
}
