import { expect, it } from "vitest";
import { quizTopics } from "../src/lib/knowledge-catalog";
import { quizThemes, themeTopicIds, themeForTopic, quizThemePath, resolveQuizTheme, relatedQuizTopics } from "../src/lib/quiz-themes";
import { quizEditorial } from "../src/lib/quiz-editorial";
import { locales } from "../src/lib/types";
import { localizedPath } from "../src/lib/locale-path";
import { measurementPage } from "../src/lib/measurement";
import { quizThemeMetadata, quizThemeStructuredData, quizTopicStructuredData } from "../src/lib/knowledge-seo";
import { quizAcquisitionReport } from "../src/lib/quiz-acquisition";

it("covers each geography and football topic once with complete translations and no route collision", () => {
  for (const theme of quizThemes) {
    const ids=themeTopicIds(theme);
    expect(new Set(ids).size).toBe(ids.length);
    const category=theme.id==="football"?"Football":"Geography";
    expect([...ids].sort()).toEqual(quizTopics.filter(t=>t.category.en===category).map(t=>t.id).sort());
    for (const locale of locales) {
      expect(quizTopics.some(t=>t.slug[locale]===theme.slug[locale])).toBe(false);
      expect(theme.title[locale]).toBeTruthy();expect(theme.description[locale].length).toBeGreaterThan(90);
      expect(theme.intro[locale].length).toBeGreaterThan(150);
      for(const group of theme.groups){expect(group.title[locale]).toBeTruthy();expect(group.text[locale]).toBeTruthy();}
      const path=quizThemePath(locale,theme);
      expect(resolveQuizTheme(locale,path.split('/').slice(2))).toBe(theme);
      expect(resolveQuizTheme(locale,["quiz",theme.slug[locale],"practice"])).toBeUndefined();
      expect(resolveQuizTheme(locale,["quiz",theme.slug[locale],"secret"])).toBeUndefined();
      for(const next of locales)expect(localizedPath(path,locale,next)).toBe(quizThemePath(next,theme));
    }
  }
});
it("prioritises semantic neighbours without self-links, duplicate targets or missing catalogue subjects",()=>{
  expect(relatedQuizTopics("eu-members").slice(0,2).map(t=>t.id)).toEqual(["countries-europe","europe-capitals"]);
  expect(relatedQuizTopics("us-state-capitals")[0].id).toBe("us-states");
  expect(relatedQuizTopics("world-cup")[0].id).toBe("football-national-teams");
  for(const topic of quizTopics){const ids=relatedQuizTopics(topic.id).map(t=>t.id);expect(ids).toHaveLength(4);expect(new Set(ids).size).toBe(4);expect(ids).not.toContain(topic.id);}
});
it("gives themed collection pages reciprocal metadata and a structured list matching their actual topics",()=>{
  for(const theme of quizThemes)for(const locale of locales){
    const meta=quizThemeMetadata(locale,theme),data=quizThemeStructuredData(locale,theme);
    expect(meta.alternates.canonical).toBe(quizThemePath(locale,theme));
    for(const other of locales)expect(meta.alternates.languages[other]).toBe(quizThemePath(other,theme));
    expect(meta.alternates.languages["x-default"]).toBe(quizThemePath("en",theme));
    const collection=data["@graph"][0];expect(collection["@type"]).toBe("CollectionPage");
    expect(collection.mainEntity?.itemListElement).toHaveLength(themeTopicIds(theme).length);
  }
  for(const topic of quizTopics){const data=quizTopicStructuredData("fr",topic),theme=themeForTopic(topic.id);const crumbs=data["@graph"][1].itemListElement!;
    expect(crumbs).toHaveLength(theme?4:3);expect(crumbs.map(c=>c.position)).toEqual(theme?[1,2,3,4]:[1,2,3]);
  }
});
it("supplies original topic-specific methods, boundaries and primary references in every language",()=>{
  expect(Object.keys(quizEditorial)).toHaveLength(12);
  for(const [id,guide] of Object.entries(quizEditorial)){
    expect(quizTopics.some(t=>t.id===id)).toBe(true);expect(guide.sources.length).toBeGreaterThan(0);
    for(const source of guide.sources)expect(new URL(source.url).protocol).toBe("https:");
    for(const locale of locales){expect(guide.method[locale].length).toBeGreaterThan(140);expect(guide.pitfall[locale].length).toBeGreaterThan(140);}
  }
});
it("keeps only recognised thematic routes in optional measurement, without treating a directory as a game",()=>{
  for(const theme of quizThemes)for(const locale of locales){const path=quizThemePath(locale,theme);expect(measurementPage(path+"?private=answer")).toEqual({page:path,locale});}
  expect(measurementPage("/fr/quiz/unpublished-private-input")).toMatchObject({page:"/fr/quiz"});
  expect(measurementPage("/fr/quiz/geographie/private-answer")).toMatchObject({page:"/fr/quiz"});
});
it("adds eight theme rows to the acquisition export without inventing unavailable Google results or summing players",()=>{
  const report=quizAcquisitionReport({status:"available",breakdowns:{page:{rows:[{key:"https://puzzoria.com/fr/quiz/geographie",impressions:30,clicks:2,position:18}]},query:{rows:[{key:"secret query"}]}}},{schema:"puzzoria.analytics",report:{product:{quizTopics:[]}}});
  expect(report.rows).toHaveLength(100);expect(report.themes).toHaveLength(8);
  expect(report.themes.find(r=>r.locale==="fr"&&r.theme==="geography")?.google).toEqual({impressions:30,clicks:2,position:18,rowReturned:true});
  expect(report.themes.find(r=>r.locale==="de")?.google).toEqual({impressions:null,clicks:null,position:null,rowReturned:false});
  expect(JSON.stringify(report)).not.toContain("secret query");expect(report.themes.every(t=>!("players" in t))).toBe(true);
});
