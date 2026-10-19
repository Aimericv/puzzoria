import type { Locale } from "./types";
import type { CalculationStep } from "./math-discovery";
import type { SudokuDeduction } from "./sudoku";
export type Discovery =
  | { kind: "classic"; title: string; text: string }
  | {
      kind: "word";
      word: string;
      locale: Locale;
      definition: { text: string; source: string; title: string } | null;
      dictionaryUrl: string;
      distinct: number;
      repeated: string[];
    }
  | {
      kind: "sudoku";
      first: SudokuDeduction | null;
      naked: number;
      hidden: number;
      remaining: number;
      fallback: { index: number; candidates: number[] } | null;
      technique: "advanced" | "hidden" | "naked";
    }
  | {
      kind: "math";
      expression: string;
      steps: CalculationStep[];
      operations: number;
      alternative: boolean;
      searchLimited: boolean;
      target: number;
    };
