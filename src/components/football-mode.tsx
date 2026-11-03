"use client";
import { useEffect, useState } from "react";
import { CalendarDays, Clock3, Goal } from "lucide-react";
import { footballDailyCopy } from "@/lib/football-daily-i18n";
import { gamePath } from "@/lib/i18n";
import { DAY_MS } from "@/lib/date";
import type { Locale } from "@/lib/types";
import type { PublicFootball } from "@/lib/knowledge-types";

export function FootballMode({challenge:c,locale,serverOffset=0}:{challenge:PublicFootball;locale:Locale;serverOffset?:number}) {
  const m=footballDailyCopy(locale),daily=c.mode!=="practice",[left,setLeft]=useState<number|null>(null);
  useEffect(()=>{
    if(c.mode!=="daily")return;
    const tick=()=>setLeft(Math.max(0,Math.ceil((Date.parse(c.date)+DAY_MS-Date.now()-serverOffset)/1000)));
    tick();const timer=setInterval(tick,1000);return ()=>clearInterval(timer);
  },[c.mode,c.date,serverOffset]);
  if(c.roomId)return null;
  return <section className="football-mode" data-football-mode={daily?"daily":"practice"} aria-label={daily?m.name:m.unlimited}>
    <strong>{daily?<CalendarDays size={18}/>:<Goal size={18}/>} {daily?m.name:m.unlimited}</strong>
    <p>{daily?m.help:m.unlimitedHelp}</p>
    {c.mode==="daily"&&(left===0?<div className="football-new-day"><span>{m.available}</span><a href={gamePath(locale,"football")}>{m.open} →</a></div>:<div className="football-daily-clock"><Clock3 size={15}/><span>{m.next}</span><b>{left===null?"—:—:—":new Date(left*1000).toISOString().slice(11,19)}</b></div>)}
  </section>;
}
