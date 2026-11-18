import { expect, it } from "vitest";
import { generateKnowledge } from "../src/lib/server/knowledge-content";
import { replayKnowledge } from "../src/lib/knowledge-play";
import { publicChallenge, validateChallenge } from "../src/lib/challenges";
import { quizTopic, quizTopicPath } from "../src/lib/knowledge-catalog";
import { themeForTopic } from "../src/lib/quiz-themes";
import { siteOrigin } from "../src/lib/seo";
import sitemap from "../src/app/sitemap";
import { locales } from "../src/lib/types";
import type { QuizChallenge } from "../src/lib/knowledge-types";

it("plays the historical Ligue 1 subject in four languages with private answers and isolated cohorts", () => {
  for (const locale of locales) {
    const c = generateKnowledge("quiz", locale, "2026-11-09", "test", "ligue-1-clubs") as QuizChallenge;
    validateChallenge(c);
    expect(c.items).toHaveLength(10);
    expect(c.seconds).toBe(120);
    expect(c.cohortKey).toBe(`quiz:ligue-1-clubs:v1:${locale}`);
    expect(new Set(c.items.map(i => i.answer)).size).toBe(10);
    expect(new Set(c.items.map(i => i.prompt)).size).toBe(10);
    expect(JSON.stringify(publicChallenge(c))).not.toMatch(/"answer"|"aliases"/);
    expect(quizTopicPath(locale, quizTopic(c.topic)!)).toContain("quiz/");
    expect(replayKnowledge(c, c.items.map(i => ({ kind: "answer", value: i.answer })))).toMatchObject({ completed: true, success: true, score: 1000 });
    expect(replayKnowledge(c, [{ kind: "answer", value: "PSG" }, { kind: "finish" }])).toMatchObject({ completed: true, success: false, score: 100 });
    expect(replayKnowledge(c, [{ kind: "finish" }])).toMatchObject({ completed: true, success: false, score: 0 });
    expect(replayKnowledge(c, [{ kind: "answer", value: "PSG" }, { kind: "answer", value: "Paris Saint-Germain" }]).found).toHaveLength(1);
    expect(replayKnowledge(c, [{ kind: "answer", value: "David Beckham" }]).found).toHaveLength(0);
    expect(replayKnowledge(c, [{ kind: "answer", value: "st etienne" }]).found[0]?.answer).toBe("AS Saint-Étienne");
  }
});

it("lists four canonical Ligue 1 pages with matching alternates and a Football theme", () => {
  const topic = quizTopic("ligue-1-clubs")!;
  const entries = sitemap();
  const paths = Object.fromEntries(locales.map(locale => [locale, quizTopicPath(locale, topic)]));
  const localized = { ...paths, "x-default": paths.en };
  const absolute = Object.fromEntries(Object.entries(localized).map(([locale, path]) => [locale, siteOrigin + path]));
  expect(themeForTopic(topic.id)?.id).toBe("football");
  for (const locale of locales) {
    expect(entries.filter(entry => entry.url === siteOrigin + paths[locale])).toEqual([
      expect.objectContaining({ alternates: { languages: absolute } }),
    ]);
  }
});
