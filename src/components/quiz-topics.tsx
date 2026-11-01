import Link from "next/link";
import { quizTopics, quizTopicPath } from "@/lib/knowledge-catalog";
import { kt } from "@/lib/knowledge-i18n";
import type { Locale } from "@/lib/types";
export function QuizTopics({locale,selected}:{locale:Locale;selected?:string}) {
  const m=kt(locale);
  return <section className="quiz-topics" aria-label={m.topics}>
    <h2>{m.topics}</h2>
    <div className="quiz-topic-grid">{quizTopics.map(topic=><Link href={quizTopicPath(locale,topic)} key={topic.id} className={`quiz-topic-card${selected===topic.id?" selected":""}`} aria-current={selected===topic.id?"page":undefined}>
      <span className="quiz-topic-emoji" aria-hidden="true">{topic.emoji}</span>
      <span><small>{topic.category[locale]}</small><strong>{topic.title[locale]}</strong><span>{topic.count} {m.total.toLocaleLowerCase(locale)} · {topic.seconds} s</span></span>
    </Link>)}</div>
  </section>;
}
