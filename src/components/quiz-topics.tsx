import Link from "next/link";
import { quizTopics, quizTopicPath } from "@/lib/knowledge-catalog";
import { kt } from "@/lib/knowledge-i18n";
import type { Locale } from "@/lib/types";
export function QuizTopics({locale,selected}:{locale:Locale;selected?:string}) {
  const m=kt(locale);
  const current=quizTopics.find(t=>t.id===selected);
  const siblings=current?quizTopics.filter(t=>t.id!==selected&&t.category[locale]===current.category[locale]):[];
  const index=current?quizTopics.filter(t=>t.category[locale]===current.category[locale]).findIndex(t=>t.id===selected):0;
  const shown=current?(siblings.length?[...siblings.slice(index),...siblings.slice(0,index)].slice(0,4):quizTopics.filter(t=>["elements","authors","greek-gods","planets"].includes(t.id))):quizTopics;
  const categories=[...new Set(shown.map(t=>t.category[locale]))];
  return <section className="quiz-topics" aria-label={m.topics}>
    <h2>{current?({en:"More quizzes to try",fr:"D’autres quiz à essayer",es:"Más quizzes para probar",de:"Weitere Quiz zum Ausprobieren"}[locale]):m.topics}</h2>
    {categories.map(category=><div className="quiz-topic-group" key={category}>{!current&&<h3>{category}</h3>}<div className="quiz-topic-grid">{shown.filter(t=>t.category[locale]===category).map(topic=><Link href={quizTopicPath(locale,topic)} key={topic.id} className="quiz-topic-card">
      <span className="quiz-topic-emoji" aria-hidden="true">{topic.emoji}</span>
      <span><small>{topic.category[locale]}</small><strong>{topic.title[locale]}</strong><span>{topic.count} {m.total.toLocaleLowerCase(locale)} · {topic.seconds} s</span></span>
    </Link>)}</div></div>)}
    {current&&<Link className="quiz-all-link" href={`/${locale}/quiz`}>{m.topics} →</Link>}
  </section>;
}
