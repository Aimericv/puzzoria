import { describe, it, expect } from "vitest";
import {
  wordFeedback,
  normalizeWord,
  acceptedWord,
  dictionaries,
} from "../src/lib/word";
import { evaluateExpression, generateMath } from "../src/lib/math";
import { generateSudoku, solveSudoku, validSudoku } from "../src/lib/sudoku";
import {
  generateChallenge,
  publicChallenge,
  validateChallenge,
} from "../src/lib/challenges";
import { locales, difficulties } from "../src/lib/types";
describe("word engine", () => {
  it("marks exact positions", () =>
    expect(wordFeedback("CRANE", "CRANE")).toEqual(Array(5).fill("correct")));
  it("does not overcount repeated letters", () =>
    expect(wordFeedback("SHEEP", "SLEEP")).toEqual([
      "correct",
      "absent",
      "correct",
      "correct",
      "correct",
    ]));
  it("allocates exact matches before misplaced duplicates", () =>
    expect(wordFeedback("EAGLE", "LEVEL")).toEqual([
      "present",
      "absent",
      "absent",
      "present",
      "present",
    ]));
  it("accepts composed and decomposed accents", () => {
    expect(normalizeWord("éclat")).toBe("ECLAT");
    expect(acceptedWord("E\u0301CLAT", "fr")).toBe(true);
    expect(acceptedWord("ARBOL", "es")).toBe(true);
  });
  it("retains German ß as one letter", () => {
    expect(normalizeWord("süßes")).toBe("SUẞES");
    expect(acceptedWord("sußes", "de")).toBe(true);
  });
  it.each([
    "adule",
    "adulé",
    "outil",
    "ACTIF",
    "avion",
    "BEAUX",
    "aigle",
    "sport",
    "merci",
    "ROSES",
    "lèser",
    "agite",
    "garde",
  ])("accepts the French guess %s", (word) =>
    expect(acceptedWord(word, "fr")).toBe(true),
  );
  it("uses a substantial deduplicated normalized French lexicon", () => {
    expect(dictionaries.fr.allowed.length).toBeGreaterThan(5000);
    expect(new Set(dictionaries.fr.allowed).size).toBe(
      dictionaries.fr.allowed.length,
    );
    expect(
      dictionaries.fr.allowed.every((word) => /^[A-Z]{5}$/.test(word)),
    ).toBe(true);
    expect(dictionaries.fr.answers.length).toBeGreaterThan(800);
  });
  it.each(["en", "es", "de"] as const)(
    "provides substantial valid %s dictionaries and fresh Unlimited answers",
    (locale) => {
      const dictionary = dictionaries[locale];
      expect(dictionary.allowed.length).toBeGreaterThan(4000);
      expect(dictionary.answers.length).toBeGreaterThan(500);
      expect(new Set(dictionary.allowed).size).toBe(dictionary.allowed.length);
      expect(
        dictionary.allowed.every(
          (w) => w === normalizeWord(w) && w.length === 5,
        ),
      ).toBe(true);
      expect(dictionary.answers.every((w) => acceptedWord(w, locale))).toBe(
        true,
      );
      const fresh = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const c = generateChallenge(
          "word",
          locale,
          "2026-10-03",
          "easy",
          `new-pool-${i}`,
        );
        if (c.kind !== "word") throw new Error();
        fresh.add(c.answer);
      }
      expect(fresh.size).toBeGreaterThan(70);
      expect(
        [...fresh].some(
          (w) => !dictionary.legacyAnswers.map(normalizeWord).includes(w),
        ),
      ).toBe(true);
    },
  );
  it.each([
    [
      "en",
      ["TOOLS", "ADULT", "WATER", "HELLO", "THEIR", "ABOUT", "WORDS", "CHAIR"],
    ],
    [
      "es",
      ["COMER", "VIVIR", "FELIZ", "LÁPIZ", "NIÑOS", "CASAS", "MIRAR", "JUGAR"],
    ],
    [
      "de",
      ["TISCH", "STUHL", "BROTE", "SPIEL", "GLÜCK", "DANKE", "STADT", "GROẞE"],
    ],
  ] as const)(
    "accepts common %s words and their normalized spellings",
    (locale, words) => {
      for (const word of words) {
        expect(acceptedWord(word, locale), word).toBe(true);
        expect(acceptedWord(normalizeWord(word), locale), word).toBe(true);
      }
    },
  );
  it.each([
    ["en", "BRAVE", "HOUSE"],
    ["es", "BARCO", "FRESA"],
    ["de", "STEIN", "APFEL"],
  ] as const)(
    "preserves published %s answers across dictionary expansion",
    (locale, todayAnswer, archivedAnswer) => {
      expect(generateChallenge("word", locale, "2026-10-03")).toMatchObject({
        answer: todayAnswer,
      });
      expect(generateChallenge("word", locale, "2026-09-14")).toMatchObject({
        answer: archivedAnswer,
      });
    },
  );
  it("keeps German personal names and excluded answer words out of the new answer pool", () => {
    expect(dictionaries.de.answers).not.toEqual(
      expect.arrayContaining(["MARIA", "PETER"]),
    );
    for (const w of ["MARIA", "PETER", "ARSCH", "NEGER"])
      expect(dictionaries.de.answers).not.toContain(w);
    expect(dictionaries.en.answers).not.toContain("WHORE");
    expect(dictionaries.es.answers).not.toContain("APROX");
  });
  it("normalizes ligatures and all French accents", () => {
    expect(normalizeWord("cœur")).toBe("COEUR");
    expect(acceptedWord("cœur", "fr")).toBe(true);
    expect(wordFeedback("ECLAT", "éclat")).toEqual(Array(5).fill("correct"));
    expect(wordFeedback("FORET", "forêt")).toEqual(Array(5).fill("correct"));
  });
  it("rejects unknown and wrong-length words", () => {
    expect(acceptedWord("ZZZZZ", "fr")).toBe(false);
    expect(acceptedWord("HI", "en")).toBe(false);
    expect(() => wordFeedback("HI", "CRANE")).toThrow();
  });
});
describe("Sudoku", () => {
  for (const difficulty of difficulties)
    it(`generates unique valid ${difficulty} grids`, () => {
      for (let day = 1; day <= 4; day++) {
        const { grid, solution } = generateSudoku(
          `2026-10-${day}:${difficulty}`,
          difficulty,
        );
        expect(validSudoku(solution, true)).toBe(true);
        expect(validSudoku(grid)).toBe(true);
        const solved = solveSudoku(grid);
        expect(solved.count).toBe(1);
        expect(solved.solution).toEqual(solution);
        expect(grid.filter(Boolean).length).toBeLessThanOrEqual(
          { easy: 43, medium: 38, hard: 32 }[difficulty],
        );
      }
    });
  it("rejects conflicting, malformed and noninteger boards", () => {
    const { solution } = generateSudoku("validation", "easy");
    const duplicate = [...solution];
    duplicate[0] = duplicate[1];
    expect(validSudoku(duplicate, true)).toBe(false);
    expect(solveSudoku(duplicate).count).toBe(0);
    expect(validSudoku([1, 2])).toBe(false);
    expect(validSudoku(Array(81).fill(1.5))).toBe(false);
    expect(validSudoku(Array(81).fill(0), true)).toBe(false);
  });
  it("distinguishes a nonunique puzzle", () =>
    expect(solveSudoku(Array(81).fill(0)).count).toBe(2));
});
describe("math engine", () => {
  it("uses precedence and parentheses", () => {
    expect(evaluateExpression("25 * (3 + 2)", [25, 3, 2], 125).score).toBe(
      1000,
    );
    expect(evaluateExpression("25 + 3 * 2", [25, 3, 2], 31).value).toBe(31);
  });
  it("checks duplicate number inventory", () => {
    expect(evaluateExpression("5+5", [5, 5, 10], 10).distance).toBe(0);
    expect(() => evaluateExpression("5+5", [5, 10], 10)).toThrow("numbers");
  });
  it.each([
    "1/0",
    "2/3",
    "2-3",
    "(2+3",
    "2 3",
    "2+",
    "-2+3",
    "2**3",
    "alert(2)",
    "2.3",
    "9999999999999999999999",
  ])("rejects unsafe expression %s", (expression) =>
    expect(() => evaluateExpression(expression, [1, 2, 3], 5)).toThrow(),
  );
  it("scores proximity and efficiency", () => {
    expect(evaluateExpression("25+3", [25, 3], 30)).toMatchObject({
      distance: 2,
      score: 960,
    });
    expect(evaluateExpression("1+2+3+4+5", [1, 2, 3, 4, 5], 15).score).toBe(
      975,
    );
  });
  it("generates reachable reference targets over 200 seeds", () => {
    for (let i = 0; i < 200; i++) {
      const puzzle = generateMath(`day:${i}`);
      expect(
        evaluateExpression(puzzle.reference, puzzle.numbers, puzzle.target)
          .distance,
      ).toBe(0);
    }
  });
});
describe("challenge engine", () => {
  it("keeps historical French answers identical after expanding the dictionary", () => {
    const challenge = generateChallenge("word", "fr", "2026-10-01");
    expect(
      challenge.kind === "word" &&
        dictionaries.fr.legacyAnswers.includes(challenge.answer),
    ).toBe(true);
    // This challenge was published with the original dictionary.
    expect(challenge.kind === "word" && challenge.answer).toBe("FLEUR");
    const future = generateChallenge("word", "fr", "2026-10-03");
    expect(
      future.kind === "word" && dictionaries.fr.answers.includes(future.answer),
    ).toBe(true);
    validateChallenge(future);
  });
  it.each(locales)(
    "generates deterministic language-specific content in %s",
    (locale) => {
      const a = generateChallenge("word", locale, "2026-10-01");
      expect(generateChallenge("word", locale, "2026-10-01")).toEqual(a);
      validateChallenge(a);
      expect(publicChallenge(a)).not.toHaveProperty("answer");
    },
  );
  it("keeps universal grids and number challenges identical across languages", () => {
    for (const game of ["sudoku", "math"] as const) {
      const en = generateChallenge(game, "en", "2026-10-01"),
        fr = generateChallenge(game, "fr", "2026-10-01");
      expect(en.id).toBe(fr.id);
      expect({ ...en, locale: "fr" }).toEqual(fr);
      validateChallenge(en);
      expect(publicChallenge(en)).not.toHaveProperty(
        game === "sudoku" ? "solution" : "reference",
      );
    }
  });
  it("rejects corrupt scheduled content", () => {
    const puzzle = generateChallenge("math", "en", "2026-10-01");
    if (puzzle.kind === "math")
      expect(() =>
        validateChallenge({ ...puzzle, target: puzzle.target + 1 }),
      ).toThrow();
  });
  it("rejects impossible dates", () =>
    expect(() => generateChallenge("word", "en", "2026-02-30")).toThrow());
});
