"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, MapPin } from "lucide-react";
import { validMapGeometry, type MapGeometry } from "@/lib/map-geometry";
import type { KnowledgeAction, KnowledgeState, PublicQuiz } from "@/lib/knowledge-types";
import type { Locale } from "@/lib/types";
import { mapCopy } from "@/lib/map-i18n";

const cache = new Map<string, MapGeometry>();
export function useMapGeometry(id: string | undefined) {
  const [asset, setAsset] = useState<MapGeometry | null>(()=>id?cache.get(id)??null:null), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  useEffect(()=>{
    if (!id) return;
    const cached=cache.get(id);if(cached)return;
    let active=true;
    void fetch(`/maps/${id}.json`).then(async r=>{if(!r.ok)throw Error();const text=await r.text();if(text.length>500000)throw Error();const data:unknown=JSON.parse(text);if(!validMapGeometry(data))throw Error();cache.set(id,data);if(active){setAsset(data);setError(false);}}).catch(()=>{if(active)setError(true);});
    return()=>{active=false;};
  },[id,retry]);
  return { asset, error, reload: ()=>{setError(false);setRetry(n=>n+1);} };
}

export function MapQuiz({ challenge:c, state, locale, asset, started, disabled, onAction }: { challenge:PublicQuiz; state:KnowledgeState; locale:Locale; asset:MapGeometry|null; started:boolean; disabled:boolean; onAction:(action:KnowledgeAction)=>void }) {
  const m=mapCopy(locale), viewport=useRef<HTMLDivElement>(null), groups=useRef(new Map<string,SVGGElement>());
  const [zoom,setZoom]=useState(1), [selection,setSelection]=useState<{sequence:number;id:string}|null>(null), [focused,setFocused]=useState<string|null>(null), [reviewed,setReviewed]=useState(0), [inspection,setInspection]=useState<string|null>(null);
  const drag=useRef<{x:number;y:number;left:number;top:number;moved:boolean}|null>(null), suppressClick=useRef(false);
  const index=state.map?.index??0, placements=state.map?.placements??[], last=placements.at(-1), reviewing=!state.completed&&index>reviewed&&!!last;
  const chosen=selection?.sequence===state.sequence?selection.id:null;
  const resolved=new Map(placements.map(p=>[p.region,p]));
  const solutions=new Map((state.map?.solution??[]).map(p=>[p.region,p.answer]));
  const names=new Map([...placements.map(p=>[p.region,p.answer] as const),...solutions]);
  const ordered=asset?[...asset.regions].sort((a,b)=>a.point[0]-b.point[0]||a.point[1]-b.point[1]):[];
  // Draw enlarged markers last so a neighbouring country's path cannot cover them.
  const painted=asset?[...asset.regions.filter(r=>!r.small),...asset.regions.filter(r=>r.small)]:[];
  function changeZoom(next:number){
    const box=viewport.current;if(!box)return;
    const x=(box.scrollLeft+box.clientWidth/2)/zoom,y=(box.scrollTop+box.clientHeight/2)/zoom;
    setZoom(next);requestAnimationFrame(()=>{box.scrollLeft=x*next-box.clientWidth/2;box.scrollTop=y*next-box.clientHeight/2;});
  }
  function select(id:string){
    if(suppressClick.current)return;
    if(names.has(id)){setInspection(id);return;}
    if(disabled||reviewing)return;
    setSelection({sequence:state.sequence,id});setInspection(null);
  }
  function navigate(event:React.KeyboardEvent<SVGGElement>,id:string){
    const i=ordered.findIndex(r=>r.id===id);let next:number;
    if(event.key==='Home')next=0;else if(event.key==='End')next=ordered.length-1;
    else if(['ArrowRight','ArrowDown'].includes(event.key))next=(i+1)%ordered.length;
    else if(['ArrowLeft','ArrowUp'].includes(event.key))next=(i+ordered.length-1)%ordered.length;
    else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!event.repeat)select(id);return;}else return;
    event.preventDefault();const target=groups.current.get(ordered[next].id);target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  if(!started)return <figure className="map-quiz-preview"><Image src="/maps/europe-outline-v1.svg" width={1000} height={760} loading="eager" alt={m.preview} unoptimized/><figcaption>{m.sources}</figcaption></figure>;
  if(!asset)return <p role="status">{m.loading}</p>;
  const focusId=focused??ordered[0]?.id, inspectName=inspection?names.get(inspection):undefined;
  return <section className="map-quiz" data-map-quiz>
    <div className="map-target" aria-live="polite">
      {state.completed?<h3>{m.ended} · {state.found.length}/{c.items.length}</h3>:reviewing?<><p>{last!.correct?m.correct:m.wrong}</p><h3>{last!.answer}</h3><button type="button" className="primary-button" onClick={()=>setReviewed(index)}>{m.next} →</button></>:<><small>{index+1}/{c.items.length}</small><h3>{m.find} <strong>{c.items[index]?.prompt}</strong> ?</h3><p>{chosen?m.selected:m.select}</p></>}
    </div>
    <div className="map-toolbar" aria-label={m.zoom}>
      <button type="button" className="secondary-button" aria-label={m.zoomOut} disabled={zoom===1} onClick={()=>changeZoom(Math.max(1,zoom-1))}><Minus size={18}/></button>
      <span>{m.zoom} ×{zoom}</span>
      <button type="button" className="secondary-button" aria-label={m.zoomIn} disabled={zoom===6} onClick={()=>changeZoom(Math.min(6,zoom+1))}><Plus size={18}/></button>
      <button type="button" className="secondary-button" onClick={()=>changeZoom(1)}><RotateCcw size={16}/>{m.reset}</button>
    </div>
    <p className="map-pan-help">{m.pan}</p>
    <div className={`map-viewport${zoom>1?' zoomed':''}`} ref={viewport}
      onPointerDown={e=>{if(e.pointerType==='mouse'&&e.button===0){suppressClick.current=false;drag.current={x:e.clientX,y:e.clientY,left:e.currentTarget.scrollLeft,top:e.currentTarget.scrollTop,moved:false};}}}
      onPointerMove={e=>{const d=drag.current;if(!d||e.buttons!==1||zoom===1)return;if(Math.abs(e.clientX-d.x)+Math.abs(e.clientY-d.y)>5)d.moved=true;if(d.moved){e.currentTarget.scrollLeft=d.left-(e.clientX-d.x);e.currentTarget.scrollTop=d.top-(e.clientY-d.y);}}}
      onPointerUp={()=>{suppressClick.current=!!drag.current?.moved;drag.current=null;}} onPointerLeave={()=>{drag.current=null;}}>
      <svg width={`${zoom*100}%`} viewBox="0 0 1000 760" role="group" aria-label={m.map} className="europe-map" onClick={e=>{if((e.target as Element).closest('[data-map-region]')===null)setSelection(null);}}>
        <rect width="1000" height="760" className="map-water"/>
        <path d={asset.context} className="map-context" fillRule="evenodd"/>
        {painted.map((r,n)=>{
          const placement=resolved.get(r.id), name=names.get(r.id), selected=chosen===r.id, revealed=solutions.has(r.id);
          const status=placement?(placement.correct?'correct':'incorrect'):revealed?'incorrect':'';
          return <g key={r.id} data-map-region={r.id} className={`map-region ${status}${selected?' selected':''}${reviewing&&last?.region===r.id?' reviewing':''}`}
            role="button" tabIndex={focusId===r.id?0:-1} aria-label={name??m.zone.replace('{n}',String(n+1))} aria-pressed={selected} aria-disabled={!name&&(disabled&&!state.completed||reviewing)}
            onFocus={()=>setFocused(r.id)} ref={node=>{if(node)groups.current.set(r.id,node);else groups.current.delete(r.id);}}
            onClick={()=>select(r.id)} onKeyDown={e=>navigate(e,r.id)}>
            <title>{name??m.zone.replace('{n}',String(n+1))}</title><path d={r.path} fillRule="evenodd"/>
            {r.small&&<><circle className="map-small-hit" cx={r.point[0]} cy={r.point[1]} r={zoom>=3?22:10}/><circle className="map-small-marker" cx={r.point[0]} cy={r.point[1]} r={4}/></>}
          </g>;
        })}
        <path d={asset.neutral} className="map-neutral" fillRule="evenodd"/>
      </svg>
    </div>
    {names.size>0&&<p className="map-inspection" role="status">{inspectName??m.inspect}</p>}
    {!state.completed&&!reviewing&&<div className="map-confirm-actions"><button type="button" className="primary-button" disabled={disabled||!chosen} onClick={()=>{if(chosen)onAction({kind:'place',region:chosen});}}><MapPin size={18}/>{m.confirm}</button><button type="button" className="secondary-button" disabled={disabled} onClick={()=>onAction({kind:'map-skip'})}>{m.skip}</button><small>{m.skipHelp}</small></div>}
    <details className="map-help"><summary>{m.small}</summary><p>{m.keyboard}</p><p>{m.context}</p><a href="https://www.naturalearthdata.com/about/disputed-boundaries-policy/" target="_blank" rel="noopener noreferrer">{m.sources}</a></details>
    {state.completed&&<details className="map-review-list"><summary>{m.countryList} · {c.items.length-state.found.length} {m.review.toLocaleLowerCase(locale)}</summary><div>{(state.map?.solution??[]).map(p=><button key={p.region} type="button" className={`secondary-button ${resolved.get(p.region)?.correct?'correct':'incorrect'}`} onClick={()=>{setInspection(p.region);const target=groups.current.get(p.region);target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest',inline:'nearest'});}}>{resolved.get(p.region)?.correct?'✓':'↻'} {p.answer}</button>)}</div></details>}
  </section>;
}
