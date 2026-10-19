import catalog from "../../content/social/catalog.v1.json" with { type: "json" };
import dailySchedule from "../../content/social/daily.json" with { type: "json" };
import pools from "../../content/social/ranking-pools.v2.json" with { type: "json" };
import newDilemmas from "../../content/social/dilemmas.v2.json" with { type: "json" };
import { validDate } from "./date";
import { validSocialCategory } from "./social-categories";
import { seededRandom, shuffled } from "./random";
import type {
  Dilemma,
  LocalText,
  RankedItem,
  SocialChallenge,
} from "./social-types";
import type { Difficulty, Locale } from "./types";
const text = (v: string[]): LocalText => ({
  en: v[0],
  fr: v[1],
  es: v[2],
  de: v[3],
});
export const rankingDatasets = catalog.rankings.map((d) => ({
  id: d.id,
  category: d.category,
  availableFrom: (d as { from?: string }).from ?? "2026-10-03",
  items: d.items.map(
    (i): RankedItem => ({ id: i[0], emoji: i[1], label: text(i.slice(2)) }),
  ),
}));
export const dilemmas: Dilemma[] = [...catalog.dilemmas, ...newDilemmas].map(
  (row) => ({
    id: row[0] as string,
    category: row[1] as string,
    tags: [row[2] as string, row[3] as string],
    a: text(row[4] as string[]),
    b: text(row[5] as string[]),
  }),
);
export const rankingPools = pools.map((d) => ({
  id: d.id,
  category: d.category,
  availableFrom: d.from,
  items: d.items.map(
    (i): RankedItem => ({ id: i[0], emoji: i[1], label: text(i.slice(2)) }),
  ),
}));
const questionFrom = new Map(
  [...catalog.dilemmas, ...newDilemmas].map((row) => [
    row[0] as string,
    typeof row[6] === "string" ? row[6] : "2026-10-03",
  ]),
);
type Schedule = Record<string, { ranking?: string; rather?: string[] }>;
export function validateSocialCatalog() {
  if (
    new Set([...rankingDatasets, ...rankingPools].map((d) => d.id)).size !==
    rankingDatasets.length + rankingPools.length
  )
    throw new Error("Duplicate ranking dataset ID");
  for (const d of rankingPools) {
    if (
      !validDate(d.availableFrom) ||
      !validSocialCategory(d.category, "ranking") ||
      d.items.length < 10 ||
      new Set(d.items.map((i) => i.id)).size !== d.items.length ||
      d.items.some((i) =>
        Object.values(i.label).some((t) => !t || t.length > 90),
      )
    )
      throw new Error("Invalid ranking pool");
  }
  for (const d of rankingDatasets)
    if (!validDate(d.availableFrom))
      throw new Error("Invalid dataset publication date");
  for (const date of questionFrom.values())
    if (!validDate(date)) throw new Error("Invalid dilemma publication date");
  for (const list of [rankingDatasets, dilemmas])
    if (new Set(list.map((d) => d.id)).size !== list.length)
      throw new Error("Duplicate dataset ID");
  for (const d of rankingDatasets) {
    if (!validSocialCategory(d.category, "ranking"))
      throw new Error("Unknown ranking category");
    if (d.items.length !== 5 || new Set(d.items.map((i) => i.id)).size !== 5)
      throw new Error("Five unique ranking items required");
    for (const item of d.items)
      if (Object.values(item.label).some((t) => !t || t.length > 90))
        throw new Error("Invalid localized item");
  }
  for (const q of dilemmas)
    if (
      [...Object.values(q.a), ...Object.values(q.b)].some(
        (t) => !t || t.length > 180,
      )
    )
      throw new Error("Invalid localized dilemma");
  for (const q of dilemmas)
    if (!validSocialCategory(q.category, "rather"))
      throw new Error("Unknown dilemma category");
  for (const [date, selection] of Object.entries(dailySchedule as Schedule)) {
    if (!validDate(date) || date < "2026-10-03")
      throw new Error("Invalid daily social date");
    if (
      selection.ranking &&
      !rankingDatasets.some(
        (d) => d.id === selection.ranking && d.availableFrom <= date,
      )
    )
      throw new Error("Unknown scheduled ranking");
    if (
      selection.rather &&
      (selection.rather.length !== 10 ||
        new Set(selection.rather).size !== 10 ||
        selection.rather.some(
          (id) =>
            !dilemmas.some((q) => q.id === id && questionFrom.get(id)! <= date),
        ))
    )
      throw new Error("Invalid scheduled dilemma set");
  }
}
export function generateSocial(
  kind: SocialChallenge["kind"],
  locale: Locale,
  date: string,
  difficulty: Difficulty,
  practiceSeed?: string,
  category?: string,
): SocialChallenge {
  const id = practiceSeed
    ? `practice:${kind}:${practiceSeed}:universal${kind === "guess" ? ":" + difficulty : ""}`
    : `${kind}:${date}:universal${kind === "guess" ? ":" + difficulty : ""}`;
  const base = {
      id,
      date,
      locale,
      ...(practiceSeed ? { mode: "practice" as const } : {}),
    },
    random = seededRandom(id);
  if (kind === "guess")
    return {
      ...base,
      kind,
      difficulty,
      secret: 1 + Math.floor(random() * 100),
      botSeed: id + ":bot-v1",
      ...(practiceSeed ? { rules: "higher-lower" as const } : {}),
    };
  if (kind === "ranking") {
    const eligible = [
        ...rankingDatasets.filter((d) => d.availableFrom <= date),
        ...rankingPools.filter(
          (d) => !!practiceSeed || d.availableFrom <= date,
        ),
      ],
      scheduled = !practiceSeed
        ? (dailySchedule as Schedule)[date]?.ranking
        : undefined;
    const pool =
      practiceSeed && category && category !== "all"
        ? rankingPools.filter((d) => d.category === category)
        : practiceSeed
          ? rankingPools
          : !scheduled && rankingPools.some((d) => d.availableFrom <= date)
            ? rankingPools.filter((d) => d.availableFrom <= date)
            : eligible;
    if (!pool.length) throw new Error("invalid");
    const dataset = scheduled
      ? pool.find((d) => d.id === scheduled)!
      : pool[Math.floor(random() * pool.length)];
    if (!dataset) throw new Error("Invalid scheduled ranking");
    return {
      ...base,
      kind,
      dataset: dataset.id,
      category: dataset.category,
      items: shuffled(dataset.items, random).slice(0, 5),
    };
  }
  const eligible = dilemmas.filter(
      (q) => !!practiceSeed || questionFrom.get(q.id)! <= date,
    ),
    scheduled = !practiceSeed
      ? (dailySchedule as Schedule)[date]?.rather
      : undefined;
  const pool =
    practiceSeed && category && category !== "all"
      ? eligible.filter((q) => q.category === category)
      : eligible;
  if (pool.length < 5) throw new Error("invalid");
  return {
    ...base,
    kind,
    category: practiceSeed ? (category ?? "all") : "all",
    questions: scheduled
      ? scheduled.map((id) => eligible.find((q) => q.id === id)!)
      : shuffled(pool, random).slice(0, Math.min(10, pool.length)),
  };
}
