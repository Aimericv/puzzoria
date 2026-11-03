import { kt } from "./knowledge-i18n";
import type { Locale } from "./types";
import { quizTopicPath, type QuizTopic } from "./knowledge-catalog";
import { siteOrigin } from "./site-origin";
import { footballDailyCopy } from "./football-daily-i18n";
import { quizThemePath, themeTopicIds, themeForTopic, type QuizTheme } from "./quiz-themes";
import { quizTopics } from "./knowledge-catalog";
import { locales } from "./types";
import { pageMetadata } from "./seo";
export function quizThemeMetadata(locale: Locale, theme: QuizTheme) {
  const metadata = pageMetadata(locale, `${theme.title[locale]} | Puzzoria`, theme.description[locale]);
  const languages = Object.fromEntries(locales.map(l => [l, quizThemePath(l, theme)])) as Record<Locale, string>;
  return { ...metadata, alternates: { canonical: quizThemePath(locale, theme), languages: { ...languages, "x-default": languages.en } }, openGraph: { ...metadata.openGraph, url: quizThemePath(locale, theme) } };
}
export function quizThemeStructuredData(locale: Locale, theme: QuizTheme) {
  const url = siteOrigin + quizThemePath(locale, theme);
  return { "@context": "https://schema.org", "@graph": [
    { "@type": "CollectionPage", "@id": url + "#page", url, name: theme.title[locale], description: theme.description[locale], inLanguage: locale, isPartOf: { "@id": siteOrigin + "/#website" }, mainEntity: { "@type": "ItemList", itemListElement: themeTopicIds(theme).map((id, i) => {
      const topic = quizTopics.find(t => t.id === id)!;
      return { "@type": "ListItem", position: i + 1, name: topic.title[locale], url: siteOrigin + quizTopicPath(locale, topic) };
    }) } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Puzzoria", item: `${siteOrigin}/${locale}` },
      { "@type": "ListItem", position: 2, name: kt(locale).quizName, item: `${siteOrigin}/${locale}/quiz` },
      { "@type": "ListItem", position: 3, name: theme.name[locale], item: url },
    ] },
  ] };
}
export function knowledgeSeo(locale: Locale) {
  const m = kt(locale);
  return {
    quiz: { title:m.quizSeo, description:m.quizMeta, intro:m.quizIntro, sections:[{title:m.quizName,text:m.quizRules},{title:m.strategy,text:m.quizStrategy},{title:m.saved,text:m.quizSaved}] },
    football: { title:footballDailyCopy(locale).seoTitle, description:footballDailyCopy(locale).seoDescription, intro:footballDailyCopy(locale).intro, sections:[{title:m.footballName,text:m.footballRules},{title:m.strategy,text:m.footballStrategy},{title:m.saved,text:m.footballSaved}] },
  };
}
export function quizTopicStructuredData(locale: Locale, topic: QuizTopic) {
  const url=siteOrigin+quizTopicPath(locale,topic);
  const theme=themeForTopic(topic.id);
  return {"@context":"https://schema.org","@graph":[
    {"@type":"WebPage","@id":url+"#page",url,name:topic.title[locale],description:topic.description[locale],inLanguage:locale,isPartOf:{"@id":siteOrigin+"/#website"}},
    {"@type":"BreadcrumbList",itemListElement:[
      {"@type":"ListItem",position:1,name:"Puzzoria",item:`${siteOrigin}/${locale}`},
      {"@type":"ListItem",position:2,name:kt(locale).quizName,item:`${siteOrigin}/${locale}/quiz`},
      ...(theme?[{"@type":"ListItem",position:3,name:theme.name[locale],item:siteOrigin+quizThemePath(locale,theme)}]:[]),
      {"@type":"ListItem",position:theme?4:3,name:topic.title[locale],item:url},
    ]},
  ]};
}
