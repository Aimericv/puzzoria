"use client";
import Image from "next/image";
import { useState } from "react";
import { clubBadge } from "@/lib/football-badges";
import { kt } from "@/lib/knowledge-i18n";
import type { ClubSpell } from "@/lib/knowledge-types";
import type { Locale } from "@/lib/types";

export function FootballCareer({clubs,locale}:{clubs:ClubSpell[];locale:Locale}) {
  const m=kt(locale),[names,setNames]=useState(false),[failed,setFailed]=useState<string[]>([]);
  return <div className="football-career">
    <button type="button" className="football-name-toggle" aria-pressed={names} onClick={()=>setNames(value=>!value)}>{names?m.hideClubNames:m.showClubNames}</button>
    <ol className="football-timeline" aria-label={m.career}>{clubs.map((spell,i)=>{
      const badge=failed.includes(spell.club)?undefined:clubBadge(spell.club);
      return <li key={i} data-club={spell.club}>
        <span className="football-stop">{i+1}</span>
        <div className="football-club-spell">
          {badge&&<Image className="football-club-badge" src={badge} width={72} height={72} alt={spell.club} title={spell.club} loading="eager" onError={()=>setFailed(previous=>previous.includes(spell.club)?previous:[...previous,spell.club])}/>}
          <div><strong className={badge&&!names?"football-club-name-hidden":undefined}>{spell.club}</strong><span>{spell.years}{spell.loan&&<small>{m.loan}</small>}</span></div>
        </div>
      </li>;
    })}</ol>
  </div>;
}
