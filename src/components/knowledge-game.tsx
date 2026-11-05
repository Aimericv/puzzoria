"use client";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock3, Goal, Send, Timer } from "lucide-react";
import { kt } from "@/lib/knowledge-i18n";
import { FootballCareer } from "./football-career";
import { FootballMode } from "./football-mode";
import { footballDailyCopy } from "@/lib/football-daily-i18n";
import { practicePath } from "@/lib/play-path";
import { gamePath } from "@/lib/i18n";
import { quizTopic, quizTopicPath } from "@/lib/knowledge-catalog";
import { initialKnowledge, normalizeAnswer, type KnowledgeAction, type KnowledgeState, type PublicKnowledge } from "@/lib/knowledge-types";
import type { Locale } from "@/lib/types";
import { beginPlay, rememberCompletion, reservePlay, submitPlay } from "@/lib/play-client";
import { useGameSession, clockText, useStoredState } from "./storage";
import { CompletionPanel, ErrorMessage, SaveNotice } from "./game-common";
import { useLocalPreview } from "./local-preview-context";
import { MapQuiz, useMapGeometry } from "./map-quiz";
import { mapCopy } from "@/lib/map-i18n";
import { smoothScrollTo } from "@/lib/smooth-scroll";

const validDraft = (v: unknown): v is {result: KnowledgeState | null} => !!v && typeof v === "object" && "result" in v && (v.result === null || typeof v.result === "object");
export function KnowledgeGame({challenge:c,locale}:{challenge:PublicKnowledge;locale:Locale}) {
  const map=c.kind==="quiz"&&c.format==="map", mapText=mapCopy(locale), geometry=useMapGeometry(map?c.mapId:undefined);
  const m=kt(locale), session=useGameSession(c,locale), sessionRef=useRef(session), preview=useLocalPreview();
  const draft=useStoredState<{result:KnowledgeState|null}>(`dailygrid:game:${c.id}`,{result:null},validDraft), {setValue:setDraft}=draft;
  const [state,setState]=useState<KnowledgeState>(initialKnowledge), [loaded,setLoaded]=useState(false), [startedAt,setStartedAt]=useState<string|null>(c.roomStartedAt??null), [now,setNow]=useState(0), [input,setInput]=useState(""), [busy,setBusy]=useState(false), [error,setError]=useState("");
  const current=useRef(state), locked=useRef(false), inputRef=useRef<HTMLInputElement>(null), offset=useRef(0), lastAuto=useRef("");
  const [serverOffset,setServerOffset]=useState(0);
  const mapRoot=useRef<HTMLDivElement>(null), scrolledMap=useRef('');
  useEffect(()=>{
    if(!map||!loaded||!startedAt||!geometry.asset||state.completed||preview)return;
    const root=mapRoot.current;if(!root)return;
    let cancel:(()=>void)|undefined;
    const frame=requestAnimationFrame(()=>{if(scrolledMap.current!==c.id){scrolledMap.current=c.id;root.focus({preventScroll:true});cancel=smoothScrollTo(root);}});
    const resized=()=>{const box=root.getBoundingClientRect();if(root.contains(document.activeElement)||box.bottom>0&&box.top<window.innerHeight)root.scrollIntoView({block:'start',behavior:'instant'});};
    window.addEventListener('resize',resized);
    return()=>{cancelAnimationFrame(frame);cancel?.();window.removeEventListener('resize',resized);};
  },[map,loaded,startedAt,geometry.asset,state.completed,c.id,preview]);
  useEffect(()=>{sessionRef.current=session;});
  const accept=useCallback((data:Awaited<ReturnType<typeof reservePlay>>)=>{
    const result=(data.result?.state??data.progress??initialKnowledge()) as KnowledgeState;
    current.current=result; setState(result); setDraft({result});
    if (data.serverNow) {offset.current=data.serverNow-Date.now();setServerOffset(offset.current);}
    if (data.startedAt || c.roomStartedAt) setStartedAt(data.startedAt??c.roomStartedAt!);
    if (data.result?.completion) {rememberCompletion(data.result.completion); sessionRef.current.finish(data.result.completion.success,data.result.completion.score,data.result.completion.attempts);}
    else if(data.startedAt || c.roomStartedAt) sessionRef.current.setValue(s=>({...s,started:true,paused:false}));
    setNow(Date.now()+offset.current);
  },[c.roomStartedAt,setDraft]);
  useEffect(()=>{
    let active=true;
    void reservePlay(c).then(data=>{if(active){accept(data);setLoaded(true);}}).catch(()=>{if(active)setError("networkError");});
    return ()=>{active=false;};
  },[c,accept]);
  useEffect(()=>{
    if (!startedAt || state.completed || preview) return;
    const timer=setInterval(()=>setNow(Date.now()+offset.current),250);
    return ()=>clearInterval(timer);
  },[startedAt,state.completed,preview]);
  const act=useCallback(async(step:KnowledgeAction)=>{
    if(locked.current || preview || !loaded || !sessionRef.current.ready || !startedAt || current.current.completed) return;
    if(step.kind==="answer" && (!normalizeAnswer(step.value) || step.value.length>100)) return;
    if(step.kind==="answer" && c.kind==="football" && current.current.guesses.some(g=>normalizeAnswer(g)===normalizeAnswer(step.value))) {setState(s=>({...s,feedback:"duplicate"}));return;}
    locked.current=true;setBusy(true);setError("");
    try {
      const data=await submitPlay(c,{step,sequence:current.current.sequence});
      const next=data.state as KnowledgeState;
      current.current=next;setState(next);setDraft({result:next});
      if(step.kind==="answer" && (c.kind==="football" || next.feedback==="correct" || next.feedback==="duplicate") && inputRef.current?.value===step.value) {setInput("");lastAuto.current="";}
      if(data.completion) sessionRef.current.finish(next.success,next.score,c.kind==="football"?next.guesses.length:undefined);
    } catch(e) {
      setError(e instanceof Error?e.message:"networkError");
      try { accept(await reservePlay(c)); } catch { /* Keep the owned draft until a retry succeeds. */ }
    } finally {locked.current=false;setBusy(false);inputRef.current?.focus({preventScroll:true});}
  },[c,preview,loaded,startedAt,setDraft,accept,setError]);
  const seconds=c.kind==="quiz"&&startedAt ? Math.max(0,Math.ceil((Date.parse(startedAt)+c.seconds*1000-now)/1000)) : null;
  useEffect(()=>{
    if(seconds===0 && !state.completed && !busy && !error) void act({kind:"finish"});
  },[seconds,state.completed,busy,error,act]);
  useEffect(()=>{
    if(c.kind!=="quiz" || !startedAt || state.completed || !input.trim() || busy || error) return;
    const timer=setTimeout(()=>{if(lastAuto.current!==input){lastAuto.current=input;void act({kind:"answer",value:input});}},650);
    return ()=>clearTimeout(timer);
  },[c.kind,startedAt,state.completed,input,busy,error,act]);
  async function start(){
    if(locked.current || !loaded || !sessionRef.current.ready) return;
    locked.current=true;setBusy(true);setError("");
    try {const data=await beginPlay(c);accept(data);sessionRef.current.start();requestAnimationFrame(()=>inputRef.current?.focus({preventScroll:true}));}
    catch{setError("networkError");}finally{locked.current=false;setBusy(false);}
  }
  const shown=preview?.knowledgeState??state, completion=preview?.completion??session.session.completion, started=!!startedAt||!!preview;
  const disabled=busy||!loaded||!draft.ready||!session.ready||shown.completed||!started||seconds===0;
  const title=c.kind==="quiz"?c.title:m.footballName;
  const numbered=c.kind==="quiz"&&!map&&c.items.every(item=>/^\d+$/.test(item.prompt));
  const longAnswers=c.kind==="quiz"&&c.items.length>16;
  return <div ref={mapRoot} tabIndex={map?-1:undefined} className={`knowledge-game knowledge-${c.kind}${map?` knowledge-map${started&&!shown.completed?' knowledge-map-active':''}`:c.kind==="quiz"?" knowledge-text-quiz":""}`} data-knowledge-game={c.kind}>
    {c.kind==="football"&&<FootballMode challenge={c} locale={locale} serverOffset={serverOffset}/>}
    <header className="knowledge-heading"><span className="knowledge-mark" aria-hidden="true">{c.kind==="quiz"?<Timer size={27}/>:<Goal size={27}/>}</span><div><small>{c.kind==="quiz"?m.theme:m.footballCategory}</small><h2>{title}</h2></div></header>
    {!started ? <div className="knowledge-start"><p>{map?mapText.ready:c.kind==="quiz"?m.readyQuiz:c.mode!=="practice"?footballDailyCopy(locale).ready:m.readyFootball}</p>{c.kind==="quiz"&&<p className="knowledge-format"><strong>{c.items.length}</strong> {m.total.toLocaleLowerCase(locale)} <span>·</span> <Clock3 size={17}/> {clockText(c.seconds)}</p>}<button type="button" className="primary-button" disabled={!loaded||busy||!session.ready||!draft.ready||map&&!geometry.asset} onClick={()=>void start()}>{loaded?m.start:m.loading}</button></div> : <>
      <div className="knowledge-scoreboard">
        {c.kind==="quiz"?<><div><span>{map?mapText.score:m.found}</span><strong>{shown.found.length}<small>/{c.items.length}</small></strong></div><div className={seconds!==null&&seconds<=15&&!shown.completed?"urgent":""}><span>{m.remaining}</span><strong>{clockText(shown.completed&&completion?Math.max(0,c.seconds-completion.duration):seconds??c.seconds)}</strong></div></>:<><div><span>{m.attempts}</span><strong>{shown.guesses.length}<small>/{c.attempts}</small></strong></div><div><span>{m.career}</span><strong>{c.clubs.length} <Goal size={20}/></strong></div></>}
      </div>
      {c.kind==="quiz"&&<div className="knowledge-progress" role="progressbar" aria-label={map?mapText.progress:m.found} aria-valuenow={map?shown.map?.index??0:shown.found.length} aria-valuemin={0} aria-valuemax={c.items.length}><span style={{width:`${(map?shown.map?.index??0:shown.found.length)*100/c.items.length}%`}}/></div>}
      {!shown.completed&&!map&&<form className="knowledge-answer-form" onSubmit={e=>{e.preventDefault();lastAuto.current=input;void act({kind:"answer",value:input});}}>
        {c.kind==="quiz"&&<span className={`knowledge-form-clock${seconds!==null&&seconds<=15?" urgent":""}`} aria-label={m.remaining}><Clock3 size={15}/>{clockText(seconds??c.seconds)}</span>}
        <label htmlFor={`knowledge-answer-${c.id}`}>{c.kind==="quiz"?m.answer:m.player}</label><div><input id={`knowledge-answer-${c.id}`} ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} maxLength={100} autoComplete="off" autoCapitalize="words" spellCheck={false} readOnly={busy} disabled={!started} enterKeyHint="go"/><button className="primary-button" disabled={disabled||!input.trim()}><Send size={17}/>{m.submit}</button></div>
        <p className={`knowledge-feedback ${shown.feedback??""}`} role="status">{shown.feedback?m[shown.feedback]:"\u00a0"}</p>
      </form>}
      {c.kind==="quiz"?!map&&<div className={`knowledge-answer-grid${numbered?" numbered-answers":""}${longAnswers?" long-answer-list":""}`} aria-label={m.solution} role={longAnswers?"region":undefined} tabIndex={longAnswers?0:undefined}>{c.items.map(item=>{
        const found=shown.found.find(a=>a.id===item.id),answer=found?.answer??shown.reveal?.find(a=>a.id===item.id)?.answer;
        const flag=c.topic==="flags"?[...item.prompt].map(v=>String.fromCharCode(v.codePointAt(0)!-0x1f1e6+97)).join(""):null;
        return <div key={item.id} className={`knowledge-answer-row${found?" found":shown.completed?" missed":""}`} data-quiz-item={item.id}><span className="knowledge-clue">{flag?<Image src={`/flags/${flag}.svg`} width={44} height={30} alt={`${m.quizCategory} ${Number(item.id)+1}`} unoptimized/>:item.prompt}</span><span>{answer??"—"}</span>{found&&<Check size={15} aria-hidden="true"/>}</div>;
      })}</div>:<><FootballCareer clubs={c.clubs} locale={locale}/>{!!shown.guesses.length&&<ol className="football-guesses" aria-label={m.attempts}>{shown.guesses.map((guess,i)=><li key={i} className={shown.success&&i===shown.guesses.length-1?"correct":""}>{i+1}. {guess}{shown.success&&i===shown.guesses.length-1?" ✓":" ✕"}</li>)}</ol>}</>}
      {!shown.completed&&!map&&<button type="button" className="knowledge-give-up" disabled={disabled} onClick={()=>{if(window.confirm(m.confirmFinish))void act({kind:"finish"});}}>{m.finish}</button>}
    </>}
    {map&&<>
      {geometry.error&&<div role="alert" className="map-load-error"><p>{started?mapText.failedActive:mapText.failed}</p><button type="button" className="secondary-button" onClick={geometry.reload}>{mapText.retry}</button></div>}
      {!geometry.asset&&!geometry.error&&<p role="status">{mapText.loading}</p>}
      <MapQuiz challenge={c} state={shown} locale={locale} asset={geometry.asset} started={started} disabled={disabled} onAction={step=>void act(step)}/>
    </>}
    <ErrorMessage error={error} locale={locale}/>{error&&<button className="secondary-button" onClick={()=>{setError("");void reservePlay(c).then(data=>{accept(data);setLoaded(true);}).catch(()=>setError("networkError"));}}>{m.retry}</button>}
    <p className="knowledge-help">{c.kind==="quiz"?m.timeHelp:m.footballHelp}</p><SaveNotice locale={locale} saved={draft.saved}/>
    {completion&&<CompletionPanel completion={completion} locale={locale} title={map?(shown.success?mapText.perfect:mapText.ended):c.kind==="quiz"?(shown.success?m.complete:m.ended):(shown.success?m.solved:m.missed)} sharePath={c.kind==="quiz"?quizTopicPath(locale,quizTopic(c.topic)!):c.mode==="practice"?practicePath(locale,"football"):gamePath(locale,"football",c.date)} shareLines={[
      `Puzzoria · ${c.kind==="quiz"?m.quizName:m.footballName}`,
      ...(c.kind==="football"?[c.mode==="practice"?footballDailyCopy(locale).unlimited:`${footballDailyCopy(locale).name} · ${c.date}`]:[]),
      c.kind==="quiz"?c.title:c.clubs.map(s=>s.club).join(" → "),
      c.kind==="quiz"?`${shown.found.length}/${c.items.length} · ${clockText(completion.duration)}`:`${shown.success?"✅":"❌"} ${shown.success?shown.guesses.length:"X"}/${c.attempts}`,
      c.kind==="quiz"?m.shareQuiz:m.shareFootball,
    ]} revealContent={c.kind==="football"&&shown.answer&&<div className="football-reveal"><Goal size={27}/><strong>{shown.answer}</strong>{!!shown.sources?.length&&<details><summary>{m.source}</summary><ul>{shown.sources.map((source,i)=><li key={source}><a href={source} target="_blank" rel="noopener noreferrer">{m.source} {i+1} · {new URL(source).hostname}</a></li>)}</ul></details>}</div>}/>}
  </div>;
}
