import { parse } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";
import { isPublicSiteOrigin, resolveSiteOrigin } from "../src/lib/site-origin";
import { gamePath } from "../src/lib/i18n";
import { locales, gameIds } from "../src/lib/types";

type Node = DefaultTreeAdapterMap["node"];
export function checkPublicHtml(html: string, url: string, expectedAlternates: Record<string, string>, indexable = true) {
  const elements: { name: string; attrs: Record<string, string> }[] = [];
  function visit(node: Node) {
    if ("tagName" in node) elements.push({ name: node.tagName, attrs: Object.fromEntries(node.attrs.map(a => [a.name, a.value])) });
    if ("childNodes" in node) node.childNodes.forEach(visit);
  }
  visit(parse(html));
  const errors: string[] = [], canonical = elements.filter(e => e.name === "link" && e.attrs.rel === "canonical");
  if (canonical.length !== 1 || canonical[0].attrs.href !== url) errors.push("canonical");
  for (const [language, href] of Object.entries(expectedAlternates)) {
    const matches = elements.filter(e => e.name === "link" && e.attrs.rel === "alternate" && e.attrs.hreflang === language);
    if (matches.length !== 1 || matches[0].attrs.href !== href) errors.push(`hreflang:${language}`);
  }
  const noindex = elements.some(e => e.name === "meta" && ["robots", "googlebot"].includes(e.attrs.name) && /noindex/i.test(e.attrs.content));
  if (indexable === noindex) errors.push("indexation");
  if (!elements.some(e => e.name === "title")) errors.push("title");
  if (!elements.some(e => e.name === "meta" && e.attrs.name === "description" && e.attrs.content?.trim())) errors.push("description");
  return errors;
}

async function main() {
  const origin = resolveSiteOrigin(process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL);
  if (!isPublicSiteOrigin(origin)) throw new Error("Le contrôle public exige le véritable domaine HTTPS.");
  let checked = 0;
  async function get(path: string) {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(15000), redirect: "error" });
    if (!response.ok) throw new Error(`Réponse ${response.status} sur ${path}`);
    return response;
  }
  for (const locale of locales) {
    for (const game of [undefined, ...gameIds]) {
      const path = game ? gamePath(locale, game) : `/${locale}`;
      const response = await get(path), html = await response.text();
      const alternates = Object.fromEntries(locales.map(l => [l, origin + (game ? gamePath(l, game) : `/${l}`)]));
      const errors = checkPublicHtml(html, origin + path, { ...alternates, "x-default": alternates.en });
      if (/noindex/i.test(response.headers.get("x-robots-tag") ?? "")) errors.push("X-Robots-Tag");
      if (!/private/.test(response.headers.get("cache-control") ?? "") || !/no-store/.test(response.headers.get("cache-control") ?? "")) errors.push("cache HTML");
      const csp = response.headers.get("content-security-policy") ?? "";
      if (!/nonce-/.test(csp) || /script-src[^;]*unsafe-(inline|eval)/.test(csp)) errors.push("CSP");
      if (errors.length) throw new Error(`${path} : ${errors.join(", ")}`);
      checked++;
    }
    for (const path of [`/${locale}/account`, `/${locale}/stats`, gamePath(locale, "word") + "/practice"]) {
      const response = await get(path), html = await response.text();
      if (checkPublicHtml(html, origin + path, {}, false).includes("indexation")) throw new Error(`${path} doit rester non indexable`);
    }
  }
  const robots = await (await get("/robots.txt")).text();
  if (/Disallow:\s*\/\s*$/im.test(robots) || !robots.includes(`${origin}/sitemap.xml`)) throw new Error("robots.txt bloque le site ou ne référence pas son sitemap");
  const sitemap = await (await get("/sitemap.xml")).text();
  if (!sitemap.includes(origin) || /localhost|127\.0\.0\.1/.test(sitemap)) throw new Error("Origine du sitemap invalide");
  if ((await (await get("/api/health")).json()).status !== "ok") throw new Error("Service indisponible");
  console.log(`Contrôle public réussi : ${checked} pages, quatre langues, canonical/hreflang, indexation, protections, sitemap et disponibilité. Search Console et appareils physiques restent à vérifier.`);
}
if (process.argv[1]?.endsWith("check-public-site.ts")) main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
