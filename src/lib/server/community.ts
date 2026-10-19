import { database } from "./database";
import { numberRuleSet } from "../number-duel";
import type {
  Community,
  RankingCommunity,
  SocialChallenge,
  SocialState,
  VoteCommunity,
} from "../social-types";
import { COMPARISON_MIN_SAMPLES } from "../statistics";
import { starterChoices, starterGuess, starterRankings, starterStatisticsEnabled, starterUnusualness } from "./starter-statistics";
export const COMMUNITY_MIN = COMPARISON_MIN_SAMPLES;
type VoteRow = { payload_json: string; owner: string };
const percent = (n: number, total: number) => Math.round((n * 100) / total);
export const rankingCohort = (
  c: Extract<SocialChallenge, { kind: "ranking" }>,
) =>
  c.dataset +
  ":" +
  c.items
    .map((i) => i.id)
    .sort()
    .join(",");
export function recordSocialVotes(
  c: SocialChallenge,
  state: SocialState,
  owner: string,
  runId: string,
) {
  const save = (cohort: string, payload: unknown) =>
    database()
      .prepare("INSERT OR IGNORE INTO community_votes VALUES (?,?,?,?,?,?)")
      .run(
        owner,
        c.kind,
        cohort,
        JSON.stringify(payload),
        runId,
        new Date().toISOString(),
      );
  if (c.friendId) return;
  if (c.kind === "ranking" && state.completed)
    save(rankingCohort(c), state.ranking);
  if (c.kind === "rather")
    state.votes.forEach((vote, i) => save(c.questions[i].id, vote));
}
function votes(kind: string, cohort: string, owner: string): VoteRow[] {
  return database()
    .prepare(
      "SELECT owner,payload_json FROM community_votes WHERE kind=? AND cohort=? AND owner!=? ORDER BY created_at DESC LIMIT 10000",
    )
    .all(kind, cohort, owner) as VoteRow[];
}
export function rankingAggregate(
  rankings: string[][],
  current: string[],
  items: string[],
): RankingCommunity | null {
  const peers = rankings.filter(
    (r) =>
      r.length === 5 &&
      new Set(r).size === 5 &&
      r.every((i) => items.includes(i)),
  );
  if (peers.length < COMMUNITY_MIN) return null;
  const counts = items.map((item) =>
    Array.from(
      { length: 5 },
      (_, pos) => peers.filter((r) => r[pos] === item).length,
    ),
  );
  const frequency = (item: string, pos: number) =>
    counts[items.indexOf(item)][pos];
  const complete = new Map<string, { ranking: string[]; count: number }>();
  for (const r of peers) {
    const key = JSON.stringify(r),
      entry = complete.get(key) ?? { ranking: r, count: 0 };
    entry.count++;
    complete.set(key, entry);
  }
  // Use an actually observed complete ranking; lexical order resolves equally frequent rankings.
  const common = [...complete.entries()].sort(
    (a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]),
  )[0][1].ranking;
  const rarity = (r: string[]) =>
    -r.reduce(
      (n, item, p) =>
        n + Math.log((frequency(item, p) + 1) / (peers.length + 5)),
      0,
    );
  const unusual = percent(
    peers.filter((r) => rarity(r) < rarity(current) - 1e-10).length,
    peers.length,
  );
  const entropy = (item: string) =>
    counts[items.indexOf(item)].reduce(
      (sum, count) =>
        count
          ? sum - (count / peers.length) * Math.log(count / peers.length)
          : sum,
      0,
    );
  const controversial = current.reduce(
    (best, item, p) => (entropy(item) > entropy(current[best]) ? p : best),
    0,
  );
  return {
    kind: "ranking",
    samples: peers.length,
    percentages: current.map((item) =>
      counts[items.indexOf(item)].map((n) => percent(n, peers.length)),
    ),
    common,
    average: items
      .map((item) => ({
        item,
        position:
          counts[items.indexOf(item)].reduce(
            (sum, n, p) => sum + n * (p + 1),
            0,
          ) / peers.length,
      }))
      .sort((a, b) => a.position - b.position || a.item.localeCompare(b.item)),
    matched: current.filter((item, p) => item === common[p]).length,
    unusual,
    swap: percent(
      peers.filter((r) => r.indexOf(current[3]) < r.indexOf(current[0])).length,
      peers.length,
    ),
    controversial,
    hasControversy: entropy(current[controversial]) > 1e-10,
  };
}
export function voteAggregate(
  id: string,
  choices: ("a" | "b")[],
): VoteCommunity | null {
  if (choices.length < COMMUNITY_MIN) return null;
  const aCount = choices.filter((c) => c === "a").length,
    a = percent(aCount, choices.length);
  return {
    id,
    samples: choices.length,
    a,
    b: 100 - a,
    counts: [aCount, choices.length - aCount],
    majority:
      aCount * 2 === choices.length
        ? null
        : aCount * 2 > choices.length
          ? "a"
          : "b",
  };
}
export function socialCommunity(
  c: SocialChallenge,
  state: SocialState,
  owner: string,
): Community {
  if (c.friendId) return null;
  if (c.kind === "ranking") {
    if (!state.completed) return null;
    const observed=rankingAggregate(
      votes(c.kind, rankingCohort(c), owner).map((v) =>
        JSON.parse(v.payload_json),
      ),
      state.ranking as string[],
      c.items.map((i) => i.id),
    );
    if(observed || !starterStatisticsEnabled()) return observed;
    const items=c.items.map(i=>i.id);
    return {...rankingAggregate(starterRankings(items,rankingCohort(c)),state.ranking as string[],items)!,source:"starter"};
  }
  if (c.kind === "rather") {
    const questions: (VoteCommunity|null)[] = c.questions.map((q,i)=>{
      if(i>=state.votes.length) return null;
      const observed=voteAggregate(q.id,votes(c.kind,q.id,owner).map(v=>JSON.parse(v.payload_json)));
      if(observed || !starterStatisticsEnabled()) return observed;
      return {...voteAggregate(q.id,starterChoices(q.id))!,source:"starter"};
    });
    const available = questions.flatMap((q, i) => (q ? [{ q, i }] : [])),
      withMajority = available.filter(({ q }) => q.majority !== null);
    const matched = withMajority.length
      ? percent(
          withMajority.filter(({ q, i }) => q.majority === state.votes[i])
            .length,
          withMajority.length,
        )
      : null;
    const chosenPercent = ({ q, i }: { q: VoteCommunity; i: number }) =>
      q[state.votes[i]];
    const rarest = available.length
      ? [...available].sort((a, b) => chosenPercent(a) - chosenPercent(b))[0].i
      : null;
    const divisive = available.length
      ? [...available].sort(
          (a, b) => Math.abs(a.q.a - 50) - Math.abs(b.q.a - 50),
        )[0].i
      : null;
    // Empirical unusualness needs 20 other owners who answered this exact complete set.
    let unusual: number | null = null,
      samples = 0;
    if (state.completed && available.length === c.questions.length) {
      const byOwner = new Map<string, Map<string, "a" | "b">>();
      for (const q of c.questions)
        for (const row of votes(c.kind, q.id, owner)) {
          const entries = byOwner.get(row.owner) ?? new Map();
          entries.set(q.id, JSON.parse(row.payload_json));
          byOwner.set(row.owner, entries);
        }
      const peers = [...byOwner.values()].filter((map) =>
        c.questions.every((q) => map.has(q.id)),
      );
      samples = peers.length;
      if (samples >= COMMUNITY_MIN) {
        const rarity = (values: ("a" | "b")[]) =>
          -values.reduce(
            (sum, v, i) =>
              sum +
              Math.log(
                (questions[i]!.counts[v === "a" ? 0 : 1] + 1) /
                  (questions[i]!.samples + 2),
              ),
            0,
          );
        unusual = percent(
          peers.filter(
            (map) =>
              rarity(c.questions.map((q) => map.get(q.id)!)) <
              rarity(state.votes) - 1e-10,
          ).length,
          samples,
        );
      }
    }
    let starterSummary=false;
    if(state.completed && available.length===c.questions.length && samples<COMMUNITY_MIN && starterStatisticsEnabled()) {
      ({samples,unusual}=starterUnusualness(questions as VoteCommunity[],state.votes));
      starterSummary=true;
    }
    return {
      kind: "rather",
      questions,
      matched,
      rarest,
      divisive,
      unusual,
      samples,
      ...(starterSummary || questions.some(q=>q?.source==="starter") ? {source:"starter" as const} : {}),
    };
  }
  if (!state.completed) return null;
  const rules = numberRuleSet(state);
  if (rules === "mixed") return null;
  type Row = {
    owner: string;
    attempts: number;
    success: number;
    metadata_json: string;
  };
  const rows = database()
    .prepare(
      `SELECT owner,attempts,success,metadata_json FROM results WHERE game='guess' AND provenance='server' AND owner!=? AND difficulty=? AND mode=? AND (mode!='daily' OR challenge_id=?) AND COALESCE(json_extract(metadata_json,'$.numberRules'),'legacy')=? AND json_extract(metadata_json,'$.comparisonEligible')=1 ORDER BY completed_at DESC LIMIT 10000`,
    )
    .all(owner, c.difficulty, c.mode ?? "daily", c.id, rules) as Row[];
  const peers = new Map<string, Row>();
  for (const row of rows) if (!peers.has(row.owner)) peers.set(row.owner, row);
  const all = [...peers.values()],
    winners = all.filter((r) => r.success && r.attempts);
  if (
    all.length < COMMUNITY_MIN ||
    (state.success && winners.length < COMMUNITY_MIN)
  )
    return all.length<COMMUNITY_MIN && starterStatisticsEnabled() ? starterGuess(c,state) : null;
  return {
    kind: "guess",
    samples: state.success ? winners.length : all.length,
    faster: state.success
      ? percent(
          winners.filter((r) => r.attempts > state.turns).length,
          winners.length,
        )
      : 0,
    fooled: percent(
      all.filter(
        (r) =>
          Number(JSON.parse(r.metadata_json).botTurns) <
          state.events.filter((e) => e.actor === "bot").length,
      ).length,
      all.length,
    ),
  };
}
