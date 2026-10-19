import { parseFragment } from "parse5";
import type { Locale } from "../types";
import { normalizeWord } from "../word-normalization";
import { database } from "./database";
type Node = {
  nodeName: string;
  tagName?: string;
  value?: string;
  childNodes?: Node[];
};
export type Definition = { text: string; source: string; title: string };
function text(node: Node): string {
  if (["script", "style", "sup", "ul", "ol", "dl"].includes(node.tagName ?? ""))
    return "";
  return node.value ?? (node.childNodes ?? []).map(text).join("");
}
export function extractDefinition(html: string, locale: Locale): string | null {
  let active = false,
    germanMeaning = false,
    found: string | null = null;
  const language = {
    en: "English",
    fr: "Français",
    es: "Español",
    de: "Deutsch",
  }[locale];
  function visit(node: Node, parent?: Node) {
    if (found) return;
    if (node.tagName === "h2") {
      active = text(node).includes(language);
      germanMeaning = false;
    }
    if (
      active &&
      locale === "de" &&
      node.tagName === "p" &&
      text(node).includes("Bedeutungen:")
    )
      germanMeaning = true;
    const isDefinition =
      active &&
      ((node.tagName === "li" && parent?.tagName === "ol") ||
        (node.tagName === "dd" &&
          parent?.tagName === "dl" &&
          ((locale === "de" && germanMeaning) ||
            (locale === "es" &&
              (parent.childNodes ?? []).some(
                (sibling) =>
                  sibling.tagName === "dt" && /^\s*\d/.test(text(sibling)),
              )))));
    if (isDefinition) {
      const value = text(node)
        .replace(/^\s*\[\d+\]\s*/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (value.length >= 8 && value.length <= 2000) {
        const words = value.split(/\s+/);
        found = words.slice(0, 25).join(" ") + (words.length > 25 ? "…" : "");
        return;
      }
    }
    for (const child of node.childNodes ?? []) visit(child, node);
  }
  visit(parseFragment(html) as Node);
  return found;
}
async function wiki(locale: Locale, query: Record<string, string>) {
  const url = new URL(`https://${locale}.wiktionary.org/w/api.php`);
  for (const [key, value] of Object.entries({ format: "json", ...query }))
    url.searchParams.set(key, value);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(2500),
    redirect: "error",
    headers: {
      "User-Agent": `Puzzoria/1.0 (${process.env.NEXT_PUBLIC_SITE_URL ?? "local word-game development"})`,
    },
  });
  if (!response.ok || !response.body) throw new Error("dictionaryUnavailable");
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 500000) {
      await reader.cancel();
      throw new Error("dictionaryTooLarge");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
const pending = new Map<string, Promise<Definition | null>>();
export async function definitionFor(
  word: string,
  locale: Locale,
): Promise<Definition | null> {
  const normalized = normalizeWord(word),
    key = `${locale}:${normalized}`;
  const cached = database()
    .prepare(
      "SELECT value_json,fetched_at FROM word_definitions WHERE locale=? AND word=?",
    )
    .get(locale, normalized) as
    | { value_json: string; fetched_at: number }
    | undefined;
  if (
    cached &&
    cached.fetched_at >
      Date.now() - (cached.value_json === "null" ? 3600000 : 30 * 86400000)
  )
    return JSON.parse(cached.value_json);
  if (pending.has(key)) return pending.get(key)!;
  const load = (async () => {
    let result: Definition | null = null;
    try {
      const lower = word.toLocaleLowerCase(locale);
      const titles = [
        locale === "de"
          ? lower.charAt(0).toLocaleUpperCase(locale) + lower.slice(1)
          : lower,
      ];
      const lookup = async (title: string) => {
        const data = await wiki(locale, {
          action: "parse",
          page: title,
          prop: "text",
          redirects: "1",
          disablelimitreport: "1",
          disableeditsection: "1",
        });
        const html = data.parse?.text?.["*"];
        const value =
          typeof html === "string" ? extractDefinition(html, locale) : null;
        const actual = data.parse?.title;
        if (
          value &&
          typeof actual === "string" &&
          normalizeWord(actual) === normalized
        )
          return {
            text: value,
            title: actual,
            source: `https://${locale}.wiktionary.org/wiki/${encodeURIComponent(actual)}`,
          };
        return null;
      };
      result = await lookup(titles[0]);
      if (!result) {
        const search = await wiki(locale, {
          action: "query",
          list: "search",
          srsearch: `intitle:${titles[0]}`,
          srlimit: "5",
        });
        const match = (search.query?.search ?? []).find(
          (item: { title?: unknown }) =>
            typeof item.title === "string" &&
            normalizeWord(item.title) === normalized &&
            item.title !== titles[0],
        );
        if (match) result = await lookup(match.title);
      }
    } catch {
      /* Dictionary outages never block the game or invent a definition. */
    }
    database()
      .prepare(
        "INSERT INTO word_definitions VALUES (?,?,?,?) ON CONFLICT(locale,word) DO UPDATE SET value_json=excluded.value_json,fetched_at=excluded.fetched_at",
      )
      .run(locale, normalized, JSON.stringify(result), Date.now());
    return result;
  })();
  pending.set(key, load);
  try {
    return await load;
  } finally {
    pending.delete(key);
  }
}
