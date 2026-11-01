import { kt } from "./knowledge-i18n";
import type { Locale } from "./types";
import { quizTopicPath, type QuizTopic } from "./knowledge-catalog";
import { siteOrigin } from "./site-origin";
export function knowledgeSeo(locale: Locale) {
  const m = kt(locale);
  return {
    quiz: { title:m.quizSeo, description:m.quizMeta, intro:m.quizIntro, sections:[{title:m.quizName,text:m.quizRules},{title:m.strategy,text:m.quizStrategy},{title:m.saved,text:m.quizSaved}] },
    football: { title:m.footballSeo, description:m.footballMeta, intro:m.footballIntro, sections:[{title:m.footballName,text:m.footballRules},{title:m.strategy,text:m.footballStrategy},{title:m.saved,text:m.footballSaved}] },
  };
}
export function quizTopicStructuredData(locale: Locale, topic: QuizTopic) {
  const url=siteOrigin+quizTopicPath(locale,topic);
  return {"@context":"https://schema.org","@graph":[
    {"@type":"WebPage","@id":url+"#page",url,name:topic.title[locale],description:topic.description[locale],inLanguage:locale,isPartOf:{"@id":siteOrigin+"/#website"}},
    {"@type":"BreadcrumbList",itemListElement:[
      {"@type":"ListItem",position:1,name:"Puzzoria",item:`${siteOrigin}/${locale}`},
      {"@type":"ListItem",position:2,name:kt(locale).quizName,item:`${siteOrigin}/${locale}/quiz`},
      {"@type":"ListItem",position:3,name:topic.title[locale],item:url},
    ]},
  ]};
}
