import { describe, expect, it } from "vitest";
import {
  compileCapitalAnswers,
  normalizeCapitalAnswer,
  type CapitalEntry,
} from "../src/lib/experiments/capital-answers";

// Invented labels: mechanism fixtures, not a factual or publishable geography corpus.
function corpus(): CapitalEntry[] {
  return ["alpha", "beta", "gamma", "delta", "epsilon"].map((id) => {
    const names = () => ({ country: `Pays ${id}`, capital: `Cité ${id}`, aliases: [] });
    return { id, names: { en: names(), fr: names(), es: names(), de: names() } };
  });
}

describe("capital answer research normalization", () => {
  it.each([
    ["  CITÉ\u00a0  ALPHA ", "cité alpha"],
    ["Cite\u0301 Alpha", "cité alpha"],
    ["L’Alpha‐Nord", "l'alpha-nord"],
    ["L‘Alpha‑Nord", "l'alpha-nord"],
    ["東京", "東京"],
    ["مدينة", "مدينة"],
    ["Straße", "straße"],
  ])("normalizes %s without discarding the script", (input, expected) => {
    expect(normalizeCapitalAnswer(input)).toBe(expected);
    expect(normalizeCapitalAnswer(expected)).toBe(expected);
  });

  it.each([null, undefined, 42, {}, [], "", "  ", "---", "a\nb", "a\tb",
    "a\u0000b", "a\u200bb", "a\u202eb", "a\ud800b", "a\u2028b", "<alpha>",
    "alpha1", "a".repeat(129)])("rejects invalid input %j", (input) => {
    expect(normalizeCapitalAnswer(input)).toBeNull();
  });

  it("bounds input before normalization and preserves distinctions requiring editorial aliases", () => {
    expect(normalizeCapitalAnswer("a".repeat(128))).toHaveLength(128);
    for (const [a, b] of [["cité", "cite"], ["peña", "pena"], ["straße", "strasse"],
      ["alpha-nord", "alpha nord"], ["alpha–nord", "alpha-nord"], ["Ａlpha", "Alpha"],
      ["alpha", "аlpha"]]) {
      expect(normalizeCapitalAnswer(a)).not.toBe(normalizeCapitalAnswer(b));
    }
  });
});

describe("synthetic capital corpus", () => {
  it("matches only the requested country and language, with explicit exonyms/accents", () => {
    const entries = corpus();
    entries[0].names.fr.aliases = ["Ville Alpha", "Cite Alpha"];
    const matcher = compileCapitalAnswers(entries);
    expect(matcher.accepts("alpha", "fr", " VILLE ALPHA ")).toBe(true);
    expect(matcher.accepts("alpha", "fr", "cite alpha")).toBe(true);
    expect(matcher.accepts("alpha", "en", "Ville Alpha")).toBe(false);
    expect(matcher.accepts("alpha", "en", "cite alpha")).toBe(false);
    expect(matcher.accepts("beta", "fr", "Ville Alpha")).toBe(false);
    expect(matcher.accepts("missing", "fr", "Cité Alpha")).toBe(false);
    expect(matcher.accepts("alpha", "fr", { score: 5 })).toBe(false);
    expect(matcher.accepts("alpha", "fr", "Cité Alph")).toBe(false);
  });

  it("deduplicates equivalent aliases and snapshots the corpus", () => {
    const entries = corpus();
    entries[0].names.fr.aliases = ["CITÉ ALPHA", "Cite\u0301 Alpha"];
    const matcher = compileCapitalAnswers(entries);
    entries[0].names.fr.aliases = [...entries[0].names.fr.aliases, "Autre Ville"];
    entries[0].names.fr.capital = "Autre Ville";
    entries.length = 0;
    expect(matcher.accepts("alpha", "fr", "Cité Alpha")).toBe(true);
    expect(matcher.accepts("alpha", "fr", "Autre Ville")).toBe(false);
  });

  it.each(["capital", "alias"])("rejects cross-country %s collisions after normalization", (kind) => {
    const entries = corpus();
    if (kind === "capital") entries[1].names.fr.capital = "CITE\u0301 ALPHA";
    else entries[1].names.fr.aliases = [" Cité   Alpha "];
    expect(() => compileCapitalAnswers(entries)).toThrow("Ambiguous");
  });

  it("allows the same spelling in different locale tables", () => {
    const entries = corpus();
    entries[1].names.fr.aliases = ["Foreign Name"];
    entries[0].names.en.aliases = ["Foreign Name"];
    expect(compileCapitalAnswers(entries).accepts("alpha", "en", "Foreign Name")).toBe(true);
  });

  it.each([
    (entries: CapitalEntry[]) => { entries[1].id = entries[0].id; },
    (entries: CapitalEntry[]) => { entries[0].id = "../alpha"; },
    (entries: CapitalEntry[]) => { Reflect.deleteProperty(entries[0].names, "de"); },
    (entries: CapitalEntry[]) => { entries[0].names.fr.country = ""; },
    (entries: CapitalEntry[]) => { entries[0].names.fr.capital = ""; },
    (entries: CapitalEntry[]) => { entries[0].names.fr.aliases = [""]; },
    (entries: CapitalEntry[]) => { entries[0].names.fr.aliases = Array(33).fill("Ville"); },
  ])("rejects malformed corpus case %#", (mutate) => {
    const entries = corpus();
    mutate(entries);
    expect(() => compileCapitalAnswers(entries)).toThrow();
  });

  it.each([null, {}, [], Array(4).fill(null), Array(257).fill(null), Array(5).fill(null)])(
    "rejects invalid corpus size or shape %#", (entries) => {
      expect(() => compileCapitalAnswers(entries)).toThrow();
    },
  );
});
