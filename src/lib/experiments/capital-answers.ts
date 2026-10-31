/** Research prototype only. No factual corpus, application imports or run proofs. */
export const capitalLocales = ["en", "fr", "es", "de"] as const;
export type CapitalLocale = (typeof capitalLocales)[number];

export interface CapitalEntry {
  id: string;
  names: Record<CapitalLocale, {
    country: string;
    capital: string;
    aliases: readonly string[];
  }>;
}

const maxNameLength = 128;

/** Accents and scripts are preserved; accentless spellings need explicit aliases. */
export function normalizeCapitalAnswer(value: unknown): string | null {
  if (typeof value !== "string" || value.length > maxNameLength) return null;
  // Reject controls (including tabs/newlines), invisible formatting and lone surrogates.
  if (/[\p{Cc}\p{Cf}\p{Cs}]/u.test(value)) return null;
  const normalized = value.normalize("NFC").toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2010\u2011]/g, "-")
    .replace(/\p{Zs}+/gu, " ").trim().normalize("NFC");
  if (!/\p{L}/u.test(normalized) || !/^[\p{L}\p{M} .'-]+$/u.test(normalized)) return null;
  return normalized;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Snapshot accepted spellings; reject ambiguous corpora rather than choosing a winner.
 * Metadata/source licensing is an editorial prerequisite outside this synthetic prototype.
 */
export function compileCapitalAnswers(entries: unknown): {
  accepts: (id: string, locale: CapitalLocale, answer: unknown) => boolean;
} {
  if (!Array.isArray(entries) || entries.length < 5 || entries.length > 256) {
    throw new Error("Expected 5–256 capital entries");
  }
  const byId = new Map<string, Map<CapitalLocale, Set<string>>>();
  const owners = new Map<CapitalLocale, Map<string, string>>(
    capitalLocales.map((locale) => [locale, new Map()]),
  );
  for (const entry of entries) {
    if (!record(entry) || typeof entry.id !== "string" ||
        !/^[a-z][a-z0-9-]{0,63}$/.test(entry.id) || byId.has(entry.id) || !record(entry.names)) {
      throw new Error("Invalid or duplicate capital entry");
    }
    const localized = new Map<CapitalLocale, Set<string>>();
    for (const locale of capitalLocales) {
      const names = entry.names[locale];
      if (!record(names) || normalizeCapitalAnswer(names.country) === null ||
          !Array.isArray(names.aliases) || names.aliases.length > 32) {
        throw new Error("Missing or invalid localized capital names");
      }
      const spellings = new Set<string>();
      for (const raw of [names.capital, ...names.aliases]) {
        const spelling = normalizeCapitalAnswer(raw);
        if (spelling === null) throw new Error("Invalid capital spelling");
        const owner = owners.get(locale)!.get(spelling);
        if (owner !== undefined && owner !== entry.id) {
          throw new Error(`Ambiguous capital spelling in ${locale}`);
        }
        owners.get(locale)!.set(spelling, entry.id);
        spellings.add(spelling);
      }
      localized.set(locale, spellings);
    }
    byId.set(entry.id, localized);
  }
  return {
    accepts(id, locale, answer) {
      const spelling = normalizeCapitalAnswer(answer);
      return spelling !== null && (byId.get(id)?.get(locale)?.has(spelling) ?? false);
    },
  };
}
