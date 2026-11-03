import Link from "next/link";
import { quizTopics, quizTopicPath } from "@/lib/knowledge-catalog";
import { kt } from "@/lib/knowledge-i18n";
import type { Locale } from "@/lib/types";
import { relatedQuizTopics, themeForTopic, quizThemePath } from "@/lib/quiz-themes";
export function QuizTopics({locale,selected}:{locale:Locale;selected?:string}) {
  const m=kt(locale);
  const current=quizTopics.find(t=>t.id===selected);
  const shown=current?relatedQuizTopics(current.id):quizTopics;
  const theme=current?themeForTopic(current.id):undefined;
  const categories=[...new Set(shown.map(t=>t.category[locale]))];
  return <section className="quiz-topics" aria-label={m.topics}>
    <h2>{current?({en:"More quizzes to try",fr:"D’autres quiz à essayer",es:"Más quizzes para probar",de:"Weitere Quiz zum Ausprobieren"}[locale]):m.topics}</h2>
    {categories.map(category=><div className="quiz-topic-group" key={category}>{!current&&<h3>{category}</h3>}<div className="quiz-topic-grid">{shown.filter(t=>t.category[locale]===category).map(topic=><Link href={quizTopicPath(locale,topic)} key={topic.id} className="quiz-topic-card">
      <span className="quiz-topic-emoji" aria-hidden="true">{topic.emoji}</span>
      <span><small>{topic.category[locale]}</small><strong>{topic.title[locale]}</strong><span>{topic.count} {m.total.toLocaleLowerCase(locale)} · {topic.seconds} s</span></span>
    </Link>)}</div></div>)}
    {theme&&<Link className="quiz-all-link" href={quizThemePath(locale,theme)}>{theme.title[locale]} →</Link>}
    {current&&<Link className="quiz-all-link" href={`/${locale}/quiz`}>{m.topics} →</Link>}
  </section>;
}
