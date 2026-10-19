import Link from "next/link";
import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import { notFound } from "next/navigation";
import { BookOpen, ChevronLeft, ArrowRight, Sparkles } from "lucide-react";
import { identity } from "@/lib/server/auth";
import { findWordArticle, canReadWordArticle, publishedWordArticles, articleAlternatives } from "@/lib/server/word-articles";
import { isLocale, type Locale } from "@/lib/types";
import { wordArticleCopy } from "@/lib/word-article-i18n";
import { wordArticlePath } from "@/lib/word-article-path";
import { utcDay } from "@/lib/date";
import { pageMetadata, siteOrigin } from "@/lib/seo";
import { gamePath } from "@/lib/i18n";
import { isLoopback } from "@/lib/local-preview";
import { StructuredData } from "./structured-data";
import { cache } from "react";

export type WordArticleProps = {params: Promise<{locale: string; word: string}>; searchParams: Promise<{runId?: string; preview?: string}>};
const load = cache(async (locale: string, word: string, runId?: string, preview?: string) => {
  if (!isLocale(locale)) notFound();
  const article = findWordArticle(locale, word);
  if (!article) notFound();
  const published = article.publicFrom <= utcDay();
  if (!published) {
    const host = (await headers()).get("host") ?? "";
    let localPreview = false;
    if (process.env.NODE_ENV === "development" && preview === "1") {
      try {localPreview = isLoopback(new URL(`http://${host}`).hostname);} catch { /* Invalid hosts cannot unlock a preview. */ }
    }
    const request = new NextRequest(siteOrigin, {headers: {cookie: (await cookies()).toString()}});
    if (!localPreview && !canReadWordArticle(article, runId, identity(request))) notFound();
  }
  return {article, locale, published};
});

export async function wordArticleMetadata(props: WordArticleProps, expected: Locale) {
  const p = await props.params, q = await props.searchParams;
  if (p.locale !== expected) notFound();
  const {article, locale, published} = await load(p.locale, p.word, q.runId, q.preview);
  const m = wordArticleCopy(locale), path = wordArticlePath(locale, article.word);
  const metadata = pageMetadata(locale, `${m.title.replace("{word}", article.word)} | Puzzoria`, article.definition[0], path.slice(locale.length + 1));
  const alternatives = published ? articleAlternatives(article) : {};
  return {...metadata, alternates: {canonical: path, ...(published ? {languages: {...alternatives, ...(alternatives.en ? {"x-default": alternatives.en} : {})}} : {})},
    robots: published ? undefined : {index: false, follow: false},
    openGraph: {...metadata.openGraph, type: "article" as const}};
}

export async function WordArticlePage(props: WordArticleProps & {expected: Locale}) {
  const p = await props.params, q = await props.searchParams;
  if (p.locale !== props.expected) notFound();
  const {article: a, locale, published} = await load(p.locale, p.word, q.runId, q.preview), m = wordArticleCopy(locale);
  const path = wordArticlePath(locale, a.word);
  const sections = [["meaning", m.definition], ["pronunciation", m.pronunciation], ["origin", m.origin], ["examples", m.examples], ["related", m.related], ["anecdote", m.anecdote]];
  const related = publishedWordArticles(locale).filter(other => other.slug !== a.slug).slice(-3);
  return <div className="word-article-layout" data-word-article>
    {published && <StructuredData value={{"@context":"https://schema.org", "@type":"Article", headline:m.title.replace("{word}", a.word), inLanguage:locale, description:a.definition[0], mainEntityOfPage:siteOrigin + path, datePublished:a.publicFrom, author:{"@type":"Organization", name:"Puzzoria"}}} />}
    <Link className="back-link" href={gamePath(locale, "rareword")}><ChevronLeft size={17}/>{m.back}</Link>
    <header className="word-article-hero">
      <span className="eyebrow"><BookOpen size={16}/>{m.collection}</span>
      <h1>{a.word}</h1><p className="word-article-grammar">{a.grammar}</p>
      <p className="word-article-intro">{a.summary}</p>
    </header>
    <div className="word-article-columns">
      <aside className="word-article-toc"><p>{m.contents}</p><nav>{sections.map(([id, title], i) => <a key={id} href={`#${id}`}><span>0{i + 1}</span>{title}</a>)}</nav><Link className="primary-button" href={gamePath(locale, "rareword")}>{m.play}<ArrowRight size={16}/></Link></aside>
      <article className="word-article-body">
        <section id="meaning"><h2>{m.definition}</h2>{a.definition.map(text => <p key={text}>{text}</p>)}</section>
        <section id="pronunciation" className="word-pronunciation"><h2>{m.pronunciation}</h2><p className="pronunciation-value">{a.pronunciation}</p><small>{m.pronunciationNote}</small></section>
        <section id="origin"><h2>{m.origin}</h2><p>{a.etymology}</p></section>
        <section id="examples"><h2>{m.examples}</h2>{a.examples.map(text => <blockquote key={text}>{text}</blockquote>)}<small>{m.original}</small></section>
        <section id="related"><h2>{m.related}</h2><ul className="related-word-tags">{a.related.map(word => <li key={word}>{word}</li>)}</ul><p>{a.nuance}</p></section>
        <section id="anecdote" className="word-anecdote"><Sparkles size={22}/><h2>{m.anecdote}</h2><p>{a.anecdote}</p></section>
        <footer className="word-article-sources"><h2>{m.sources}</h2><ul>{a.sources.map(url => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{new URL(url).hostname.replace(/^www\./, "")} · {a.word} ↗</a></li>)}</ul></footer>
      </article>
    </div>
    {related.length > 0 && <section className="word-article-related"><h2>{m.more}</h2><div>{related.map(other => <Link key={other.slug} href={wordArticlePath(locale, other.word)}><strong>{other.word}</strong><span>{other.definition[0]}</span><ArrowRight size={18}/></Link>)}</div></section>}
  </div>;
}
