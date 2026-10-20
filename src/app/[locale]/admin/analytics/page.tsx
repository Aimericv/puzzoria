import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { notFound } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { isLocale, gameIds } from "@/lib/types";
import { t } from "@/lib/i18n";
import { rt } from "@/lib/retention-i18n";
import { registry } from "@/lib/registry";
import { siteAnalyticsCopy } from "@/lib/site-analytics-i18n";
import { analyticsFilters, requireAnalyticsAdmin, siteAnalytics } from "@/lib/server/site-analytics";
import { productAnalytics } from "@/lib/server/product-analytics";
import { ProductAnalyticsPanel } from "@/components/product-analytics-panel";
import { measurementCopy } from "@/lib/measurement-i18n";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{locale:string}> }) {
  const {locale}=await params;
  return {title:isLocale(locale)?siteAnalyticsCopy(locale).title:"Analytics",robots:{index:false,follow:false}};
}
export default async function Analytics({ params, searchParams }: {params:Promise<{locale:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {locale}=await params;
  if(!isLocale(locale))notFound();
  const cookieStore=await cookies();
  const query=new URLSearchParams();
  for(const [k,v] of Object.entries(await searchParams))if(typeof v==="string")query.set(k,v);
  let data;
  try{
    requireAnalyticsAdmin(new NextRequest("http://internal.local",{headers:{cookie:cookieStore.toString()}}));
    data=siteAnalytics(analyticsFilters(query));
  }catch{notFound();}
  const m=siteAnalyticsCopy(locale), common=t(locale), modes=rt(locale), fmt=new Intl.NumberFormat(locale);
  const product=productAnalytics(data.filters);
  const percent=(n:number,total:number)=>total?`${fmt.format(Math.round(n*1000/total)/10)} %`:"—";
  const stats=[
    [m.players,data.totals.players],[m.starts,data.totals.starts],[m.finishes,data.totals.finishes],
    [m.finishRate,percent(data.totals.finishes,data.totals.starts)],
    ...(data.signups===null?[]:[[m.signups,data.signups]]),[m.pending,data.totals.pending],[m.dormant,data.totals.dormant],
  ];
  const exportQuery=new URLSearchParams(query);exportQuery.set("format","csv");
  const analysisQuery=new URLSearchParams(query);analysisQuery.set("format","json");
  return <div className="internal-analytics">
    <span className="eyebrow"><BarChart3 size={16}/>{m.title}</span><h1>{m.title}</h1>
    <p className="page-intro">{m.intro}</p><p>{data.from} → {data.to} · UTC</p>
    <form className="analytics-filters">
      <label>{m.period}<select name="days" defaultValue={data.filters.days}>{[7,30,90].map(n=><option key={n} value={n}>{n} {m.days}</option>)}</select></label>
      <label>{m.game}<select name="game" defaultValue={data.filters.game??""}><option value="">{m.all}</option>{gameIds.map(g=><option key={g} value={g}>{common[registry[g].name]}</option>)}</select></label>
      <label>{m.language}<select name="locale" defaultValue={data.filters.locale??""}><option value="">{m.all}</option>{["en","fr","es","de"].map(l=><option key={l} value={l}>{l.toUpperCase()}</option>)}</select></label>
      <label>{measurementCopy(locale).interfaceLanguage}<select name="interface_locale" defaultValue={data.filters.interfaceLocale??""}><option value="">{m.all}</option>{["en","fr","es","de"].map(l=><option key={l} value={l}>{l.toUpperCase()}</option>)}</select></label>
      <label>{m.mode}<select name="mode" defaultValue={data.filters.mode??""}><option value="">{m.all}</option><option value="daily">{modes.dailyMode}</option><option value="practice">{modes.practice}</option><option value="archive">{modes.archiveMode}</option></select></label>
      <button className="primary-button" type="submit">{m.apply}</button><a className="secondary-button" download href={`/api/admin/analytics?${analysisQuery}`}>{m.exportAnalysis}</a><a className="secondary-button" download href={`/api/admin/analytics?${exportQuery}`}>{m.export}</a>
    </form>
    <dl className="analytics-metrics">{stats.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{typeof value==="number"?fmt.format(value):value}</dd></div>)}</dl>
    <p className="analytics-note">{m.scope}</p>
    <ProductAnalyticsPanel data={product} locale={locale}/>
    <a className="secondary-button" download href={`/api/admin/analytics?${exportQuery}&dataset=visits`}>{m.export} · {measurementCopy(locale).telemetry}</a>
    <section><h2>{m.retention} · {measurementCopy(locale).returnsAny}</h2><div className="analytics-retention">{(["d1","d7","d30"] as const).map(key=>{const r=data.retention[key],label=key==="d30"?measurementCopy(locale).d30:m[key];return <div key={key}><h3>{label}</h3><strong>{r.percent===null?"—":`${fmt.format(r.percent)} %`}</strong><p>{r.percent===null?m.unavailable:`${fmt.format(r.returned)} ${m.returned} / ${fmt.format(r.mature)} ${m.mature}`}</p><div className="analytics-bar" role="img" aria-label={`${label}: ${r.percent??"—"}%`}><span style={{width:`${r.percent??0}%`}}/></div></div>;})}</div><p className="analytics-note">{m.returns}</p></section>
    <section><h2>{m.games}</h2>{!data.games.length?<p>{m.empty}</p>:<div className="analytics-table"><table><thead><tr>{[m.game,m.players,m.starts,m.finishes,m.finishRate].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{data.games.map(r=><tr key={r.game}><th scope="row">{common[registry[r.game].name]}</th><td>{fmt.format(r.players)}</td><td>{fmt.format(r.starts)}</td><td>{fmt.format(r.finishes)}</td><td>{percent(r.finishes,r.starts)}</td></tr>)}</tbody></table></div>}</section>
    <section><h2>{m.daily}</h2><div className="analytics-table"><table><thead><tr>{[m.date,m.players,m.starts,m.finishes].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{data.daily.map(r=><tr key={r.day}><th scope="row">{r.day}</th><td>{fmt.format(r.players)}</td><td>{fmt.format(r.starts)}</td><td>{fmt.format(r.finishes)}</td></tr>)}</tbody></table></div></section>
    <p className="analytics-note">{m.limits}</p><p className="analytics-note">{m.privacy}</p>
  </div>;
}
