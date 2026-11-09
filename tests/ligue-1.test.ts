import { expect, it } from "vitest";
import { generateKnowledge } from "../src/lib/server/knowledge-content";
import { replayKnowledge } from "../src/lib/knowledge-play";
import { publicChallenge, validateChallenge } from "../src/lib/challenges";
import { quizTopic, quizTopicPath } from "../src/lib/knowledge-catalog";
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
    expect(JSON.stringify(publicChallenge(c))).not.toMatch(/"answer"|"aliases"/);
    expect(quizTopicPath(locale, quizTopic(c.topic)!)).toContain("quiz/");
    expect(replayKnowledge(c, c.items.map(i => ({ kind: "answer", value: i.answer })))).toMatchObject({ completed: true, success: true, score: 1000 });
    expect(replayKnowledge(c, [{ kind: "answer", value: "PSG" }, { kind: "finish" }])).toMatchObject({ completed: true, success: false, score: 100 });
    expect(replayKnowledge(c, [{ kind: "finish" }])).toMatchObject({ completed: true, success: false, score: 0 });
    expect(replayKnowledge(c, [{ kind: "answer", value: "PSG" }, { kind: "answer", value: "Paris Saint-Germain" }]).found).toHaveLength(1);
    expect(replayKnowledge(c, [{ kind: "answer", value: "David Beckham" }]).found).toHaveLength(0);
  }
});
