"use client";
import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, CircleHelp } from "lucide-react";
import { validMapGeometry, type MapGeometry } from "@/lib/map-geometry";
import type { KnowledgeAction, KnowledgeState, PublicQuiz } from "@/lib/knowledge-types";
import type { Locale } from "@/lib/types";
import { mapCopy } from "@/lib/map-i18n";
import { kt } from "@/lib/knowledge-i18n";

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
  const m=mapCopy(locale), k=kt(locale), viewport=useRef<HTMLDivElement>(null), groups=useRef(new Map<string,SVGGElement>());
  const [zoom,setZoom]=useState(1), [fit,setFit]=useState(0), [focused,setFocused]=useState<string|null>(null), [reviewed,setReviewed]=useState(0), [inspection,setInspection]=useState<string|null>(null);
  const drag=useRef<{x:number;y:number;left:number;top:number;moved:boolean}|null>(null), suppressClick=useRef(false);
  const index=state.map?.index??0, placements=state.map?.placements??[], last=placements.at(-1), reviewing=!state.completed&&index>reviewed&&!!last;
  useLayoutEffect(()=>{
    const box=viewport.current;if(!box)return;
    const observer=new ResizeObserver(()=>setFit(Math.max(0,Math.min((box.clientWidth-1)/1000,(box.clientHeight-1)/760))));
    observer.observe(box);return()=>observer.disconnect();
  },[asset,started]);
  const resolved=new Map(placements.map(p=>[p.region,p]));
  const solutions=new Map((state.map?.solution??[]).map(p=>[p.region,p.answer]));
  const names=new Map([...placements.map(p=>[p.region,p.answer] as const),...solutions]);
  const ordered=asset?[...asset.regions].sort((a,b)=>a.point[0]-b.point[0]||a.point[1]-b.point[1]):[];
  // Draw enlarged markers last so a neighbouring country's path cannot cover them.
  const painted=asset?[...asset.regions.filter(r=>!r.small),...asset.regions.filter(r=>r.small)]:[];
  function changeZoom(next:number){
    const box=viewport.current;if(!box)return;
    const rect=box.querySelector('svg')?.getBoundingClientRect(), bounds=box.getBoundingClientRect();if(!rect)return;
    const x=(bounds.left+box.clientLeft+box.clientWidth/2-rect.left)/zoom,y=(bounds.top+box.clientTop+box.clientHeight/2-rect.top)/zoom;
    setZoom(next);requestAnimationFrame(()=>{box.scrollLeft=x*next-box.clientWidth/2;box.scrollTop=y*next-box.clientHeight/2;});
  }
  function select(id:string){
    if(suppressClick.current)return;
    if(names.has(id)){setInspection(id);return;}
    if(disabled||reviewing)return;
    setInspection(null);onAction({kind:'place',region:id});
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
  return <section className="map-quiz" data-map-quiz data-map-completed={state.completed}>
    <div className="map-target" aria-live="polite">
      <div>{state.completed?<><h3>{m.ended} · {state.found.length}/{c.items.length}</h3><p>{inspectName??m.inspect}</p></>:reviewing?<><p>{last!.correct?m.correct:m.wrong}</p><h3>{last!.answer}</h3></>:<><small>{index+1}/{c.items.length}</small><h3>{m.find} <strong>{c.items[index]?.prompt}</strong> ?</h3><p>{inspectName??m.select}</p></>}</div>
      {reviewing&&<button type="button" className="primary-button" onClick={()=>{setReviewed(index);setInspection(null);}}>{m.next} →</button>}
    </div>
    <div className="map-toolbar" aria-label={m.zoom}>
      <button type="button" className="secondary-button" aria-label={m.zoomOut} disabled={zoom===1} onClick={()=>changeZoom(Math.max(1,zoom-1))}><Minus size={18}/></button>
      <span>{m.zoom} ×{zoom}</span>
      <button type="button" className="secondary-button" aria-label={m.zoomIn} disabled={zoom===6} onClick={()=>changeZoom(Math.min(6,zoom+1))}><Plus size={18}/></button>
      <button type="button" className="secondary-button map-reset" aria-label={m.reset} onClick={()=>changeZoom(1)}><RotateCcw size={16}/><span>{m.reset}</span></button>
    </div>
    <div className={`map-viewport${zoom>1?' zoomed':''}`} ref={viewport}
      onPointerDown={e=>{suppressClick.current=false;if(e.pointerType==='mouse'&&e.button===0){drag.current={x:e.clientX,y:e.clientY,left:e.currentTarget.scrollLeft,top:e.currentTarget.scrollTop,moved:false};}}}
      onPointerMove={e=>{const d=drag.current;if(!d||e.buttons!==1||zoom===1)return;if(Math.abs(e.clientX-d.x)+Math.abs(e.clientY-d.y)>5)d.moved=true;if(d.moved){e.currentTarget.scrollLeft=d.left-(e.clientX-d.x);e.currentTarget.scrollTop=d.top-(e.clientY-d.y);}}}
      onPointerUp={()=>{suppressClick.current=!!drag.current?.moved;drag.current=null;}} onPointerLeave={()=>{drag.current=null;}}>
      <svg width={fit?1000*fit*zoom:'100%'} height={fit?760*fit*zoom:undefined} viewBox="0 0 1000 760" role="group" aria-label={m.map} className="europe-map">
        <rect width="1000" height="760" className="map-water"/>
        <path d={asset.context} className="map-context" fillRule="evenodd"/>
        {painted.map((r,n)=>{
          const placement=resolved.get(r.id), name=names.get(r.id), revealed=solutions.has(r.id);
          const status=placement?(placement.correct?'correct':'incorrect'):revealed?'incorrect':'';
          return <g key={r.id} data-map-region={r.id} className={`map-region ${status}${reviewing&&last?.region===r.id?' reviewing':''}`}
            role="button" tabIndex={focusId===r.id?0:-1} aria-label={name??m.zone.replace('{n}',String(n+1))} aria-disabled={!name&&(disabled&&!state.completed||reviewing)}
            onFocus={()=>setFocused(r.id)} ref={node=>{if(node)groups.current.set(r.id,node);else groups.current.delete(r.id);}}
            onClick={()=>select(r.id)} onKeyDown={e=>navigate(e,r.id)}>
            <title>{name??m.zone.replace('{n}',String(n+1))}</title><path d={r.path} fillRule="evenodd"/>
            {r.small&&<><circle className="map-small-hit" cx={r.point[0]} cy={r.point[1]} r={zoom>=3?22:10}/><circle className="map-small-marker" cx={r.point[0]} cy={r.point[1]} r={4}/></>}
          </g>;
        })}
        <path d={asset.neutral} className="map-neutral" fillRule="evenodd"/>
      </svg>
    </div>
    <div className="map-actions">
      {!state.completed&&<><button type="button" className="secondary-button" disabled={disabled||reviewing} onClick={()=>onAction({kind:'map-skip'})}>{m.skip}</button><button type="button" className="secondary-button" aria-label={k.finish} disabled={disabled} onClick={()=>{if(window.confirm(k.confirmFinish))onAction({kind:'finish'});}}>{m.finish}</button></>}
      <details className="map-help"><summary aria-label={m.help}><CircleHelp size={16}/><span>{m.help}</span></summary><div className="map-help-body"><p>{m.keyboard}</p><p>{m.pan}</p><p>{m.small}</p><p>{m.skipHelp}</p><p>{m.context}</p><p>{m.inspect}</p><a href="https://www.naturalearthdata.com/about/disputed-boundaries-policy/" target="_blank" rel="noopener noreferrer">{m.sources}</a></div></details>
    </div>
    {state.completed&&<details className="map-review-list"><summary>{m.countryList} · {c.items.length-state.found.length} {m.review.toLocaleLowerCase(locale)}</summary><div>{(state.map?.solution??[]).map(p=><button key={p.region} type="button" className={`secondary-button ${resolved.get(p.region)?.correct?'correct':'incorrect'}`} onClick={()=>{setInspection(p.region);const target=groups.current.get(p.region);target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest',inline:'nearest'});}}>{resolved.get(p.region)?.correct?'✓':'↻'} {p.answer}</button>)}</div></details>}
  </section>;
}
