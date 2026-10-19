import { st, sf, type SocialKey } from "./social-i18n";
import type { Locale } from "./types";
import type {
  Community,
  PublicSocialChallenge,
  SocialState,
} from "./social-types";
export function choiceThemes(
  c: Extract<PublicSocialChallenge, { kind: "rather" }>,
  state: SocialState,
) {
  const counts = new Map<string, number>();
  state.votes.forEach((vote, i) => {
    const tag = c.questions[i].tags[vote === "a" ? 0 : 1];
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  });
  const best = Math.max(0, ...counts.values());
  return [...counts].filter(([, count]) => count === best).map(([tag]) => tag);
}
export function socialShareLines(
  c: PublicSocialChallenge,
  state: SocialState,
  community: Community,
  locale: Locale,
): string[] {
  const m = st(locale);
  if (c.kind === "ranking")
    return [
      m.rankingName,
      ...state.ranking.map((id, i) => {
        const item = state.visibleItems.find((item) => item.id === id)!;
        return `${i + 1}. ${item.label[locale]}`;
      }),
      ...(community?.kind === "ranking"
        ? [
            sf(m.matched, { n: community.matched }),
            ...(community.unusual >= 50
              ? [sf(m.unusual, { n: community.unusual })]
              : []),
          ]
        : []),
    ];
  if (c.kind === "rather")
    return [
      m.ratherName,
      state.votes.map((v) => (v === "a" ? "🟦" : "🟥")).join(""),
      `${m.summary}: ${choiceThemes(c, state)
        .map((tag) => m[tag as SocialKey])
        .join(" / ")}`,
      ...(community?.kind === "rather" && community.matched !== null
        ? [sf(m.majorityScore, { n: community.matched })]
        : []),
      ...state.votes.slice(0, 3).map((v, i) => c.questions[i][v][locale]),
    ];
  return [
    m.guessName,
    state.success
      ? m.won
      : state.events.at(-1)?.action.kind !== "question" &&
          state.events.at(-1)?.answer
        ? m.lost
        : m.draw,
    sf(m.turns, { n: state.turns }),
    c.id.startsWith("duel:") ? m.friends : `${m.bot} · ${m[c.difficulty]}`,
    ...(community?.kind === "guess" && state.success
      ? [sf(m.faster, { n: community.faster })]
      : []),
  ];
}
