"use client";
import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { setAnalyticsAdapter } from "@/lib/analytics";
import { measurementEvents, measurementPage, type MeasurementEvent, type MeasurementName } from "@/lib/measurement";
import { measurementCopy } from "@/lib/measurement-i18n";
import type { Locale } from "@/lib/types";
import { useAccount } from "./account-provider";
import { cookieCopy } from "@/lib/cookie-i18n";
import { consumeCookieSettingsRequest } from "@/lib/cookie-settings";
const choiceKey="puzzoria:measurement-choice";
let emit:((event:MeasurementEvent)=>void)|undefined;
let preference:"yes"|"no"|undefined;
// Called only from real provider callbacks during a future, explicitly enabled integration.
export function measureAdEvent(name:Extract<MeasurementName,`ad_${string}`|`video_${string}`>,impressionId:string) {
  const page=measurementPage(location.pathname);
  if(page)emit?.({id:crypto.randomUUID(),name,path:location.pathname,locale:page.locale,impression_id:impressionId,challenge_id:document.querySelector<HTMLElement>("[data-game-root]")?.dataset.challengeId});
}
export function reportRequestFailure(status:number,latency:number) {
  const page=measurementPage(location.pathname);
  if(page) emit?.({id:crypto.randomUUID(),name:"client_error",path:location.pathname,locale:page.locale,status,latency});
}
function signal() {return navigator.doNotTrack === "1" || (navigator as Navigator & {globalPrivacyControl?:boolean}).globalPrivacyControl === true;}
function choose(value:"yes"|"no") {
  preference=value;
  try{localStorage.setItem(choiceKey,value);}catch{/* The choice still lasts for this page. */}
  window.dispatchEvent(new CustomEvent("puzzoria:measurement-choice",{detail:value}));
  if(value==="no") void fetch("/api/measurement",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({choice:"no",events:[]}),keepalive:true}).catch(()=>{});
}
export function MeasurementPreferences({locale}:{locale:Locale}) {
  const [choice,setChoice]=useState<string>(),m=measurementCopy(locale);
  useEffect(()=>{const update=()=>setChoice(signal()?"no":preference ?? localStorage.getItem(choiceKey) ?? undefined);try{update();}catch{setChoice(preference);}window.addEventListener("puzzoria:measurement-choice",update);return()=>window.removeEventListener("puzzoria:measurement-choice",update);},[]);
  return <section className="measurement-settings"><h2>{m.settings}</h2><p>{choice==="yes"?m.enabled:m.disabled}</p><p>{m.details}</p><div className="measurement-actions"><button className="secondary-button" disabled={(choice==="no"&&signalSafe()) || choice==="yes"} onClick={()=>choose("yes")}>{m.accept}</button><button className="secondary-button" disabled={choice==="no"} onClick={()=>choose("no")}>{m.decline}</button></div></section>;
}
function signalSafe(){return typeof navigator!=="undefined" && signal();}
export function MeasurementProvider({locale}:{locale:Locale}) {
  const pathname=usePathname(),account=useAccount(),[show,setShow]=useState(false),[settings,setSettings]=useState(false),m=measurementCopy(locale),c=cookieCopy(locale),dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const open=()=>{consumeCookieSettingsRequest();setSettings(true);};window.addEventListener("puzzoria:cookie-settings",open);if(consumeCookieSettingsRequest())open();return()=>window.removeEventListener("puzzoria:cookie-settings",open);},[]);
  useEffect(()=>{if(settings)dialog.current?.showModal();else dialog.current?.close();},[settings]);
  useEffect(()=>{
    // Let the account bootstrap settle its guest cookie before optional collection.
    // Otherwise two first requests can mint competing device identities.
    if(!account.ready)return;
    let allowed=false,disposed=false,sending=false,queue:MeasurementEvent[]=[],lastInteraction=Date.now(),lastTick=Date.now(),lastPage="";
    const enqueue=(e:MeasurementEvent)=>{if(allowed && !document.querySelector('[data-local-preview="true"]') && measurementPage(e.path)){queue.push(e);if(queue.length>100)queue.shift();}};
    emit=enqueue;
    const pageView=()=>{const page=measurementPage(location.pathname);if(page && allowed && location.pathname!==lastPage){lastPage=location.pathname;enqueue({id:crypto.randomUUID(),name:"page_view",path:location.pathname,locale:page.locale});void flush();}};
    const flush=async(keepalive=false)=>{
      if(sending || !allowed || !queue.length)return;
      sending=true;const batch=queue.splice(0,30),params=new URLSearchParams(location.search);
      try{
        const response=await fetch("/api/measurement",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({choice:"yes",events:batch,referrer:document.referrer,source:params.get("utm_source"),medium:params.get("utm_medium"),campaign:params.get("utm_campaign")}),keepalive});
        if(response.ok)await response.json();
        else if(response.status!==400 && response.status!==403) queue.unshift(...batch);
      }catch{if(!disposed && allowed)queue.unshift(...batch);}finally{sending=false;}
    };
    const update=()=>{
      let stored:string|null=null;try{stored=localStorage.getItem(choiceKey);}catch{/* No durable choice when storage is blocked. */}
      allowed=!signal() && (preference ?? stored)==="yes";
      setShow(!signal() && !(preference ?? stored));
      if(!allowed){queue=[];lastPage="";}else pageView();
    };
    update();
    const storage=(event:StorageEvent)=>{if(event.key===choiceKey){preference=undefined;update();}};
    window.addEventListener("storage",storage);
    const interaction=()=>{lastInteraction=Date.now();};
    const tick=()=>{
      const now=Date.now(),root=document.querySelector<HTMLElement>('[data-game-root]');
      if(allowed && document.visibilityState==="visible" && document.hasFocus() && now-lastInteraction<120000 && root?.dataset.measurementPlaying==="true"){
        const page=measurementPage(location.pathname);
        if(page)enqueue({id:crypto.randomUUID(),name:"active_time",path:location.pathname,locale:page.locale,challenge_id:root.dataset.challengeId,seconds:Math.min(15,(now-lastTick)/1000)});
      }
      lastTick=now;void flush();
    };
    const hide=()=>{if(document.visibilityState==="hidden"){void flush(true);lastTick=Date.now();}else{lastTick=Date.now();interaction();}};
    const pagehide=()=>{void flush(true);};
    const route=()=>{lastInteraction=Date.now();lastTick=Date.now();pageView();};
    const timer=setInterval(tick,15000);
    for(const event of ["pointerdown","keydown","touchstart"] as const)window.addEventListener(event,interaction,{passive:true});
    document.addEventListener("visibilitychange",hide);window.addEventListener("pagehide",pagehide);window.addEventListener("puzzoria:measurement-choice",update);window.addEventListener("puzzoria:measurement-page",route);
    setAnalyticsAdapter((name,p)=>{const page=measurementPage(location.pathname);if(page && (measurementEvents as readonly string[]).includes(name))enqueue({id:crypto.randomUUID(),name:name as MeasurementName,path:location.pathname,locale:page.locale,challenge_id:p.challenge_id,method:p.method});});
    return()=>{disposed=true;void flush(true);clearInterval(timer);emit=undefined;setAnalyticsAdapter(undefined);window.removeEventListener("storage",storage);for(const event of ["pointerdown","keydown","touchstart"] as const)window.removeEventListener(event,interaction);document.removeEventListener("visibilitychange",hide);window.removeEventListener("pagehide",pagehide);window.removeEventListener("puzzoria:measurement-choice",update);window.removeEventListener("puzzoria:measurement-page",route);};
  },[account.ready]);
  useEffect(()=>{window.dispatchEvent(new CustomEvent("puzzoria:measurement-page"));},[pathname]);
  return <>
    {show && !settings && !pathname.includes("/admin/") && <aside className="measurement-notice" aria-label={m.settings}><div><strong>{c.title}</strong><p>{m.explain} <Link href={`/${locale}/privacy`}>{m.settings}</Link></p></div><div className="measurement-actions"><button className="secondary-button" onClick={()=>choose("yes")}>{m.accept}</button><button className="secondary-button" onClick={()=>choose("no")}>{m.decline}</button><button className="text-button" onClick={()=>setSettings(true)}>{c.customize}</button></div></aside>}
    <dialog className="cookie-dialog" ref={dialog} aria-label={m.settings} onCancel={()=>setSettings(false)} onClose={()=>{if(!dialog.current?.open)setSettings(false);}}>
      {settings && <>
      <button className="text-button cookie-close" onClick={()=>setSettings(false)}>{c.close}</button>
      <p><strong>{c.necessary}</strong></p><p>{c.necessaryHelp}</p>
      <MeasurementPreferences locale={locale}/>
      <p><strong>{c.ads}</strong></p><p>{c.adsHelp}</p>
      <Link href={`/${locale}/privacy`} onClick={()=>setSettings(false)}>{m.settings}</Link>
      </>}
    </dialog>
  </>;
}
