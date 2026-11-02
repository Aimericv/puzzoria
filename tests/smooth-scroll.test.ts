import { afterEach, expect, it, vi } from "vitest";
import { smoothScrollTo } from "../src/lib/smooth-scroll";

afterEach(()=>vi.unstubAllGlobals());
it("a pointer press cancels scrolling before a result button moves between press and release",()=>{
  const target=new EventTarget(), onEnd=vi.fn(), cancelFrame=vi.fn();
  vi.stubGlobal("window",Object.assign(target,{scrollY:0,innerHeight:800,matchMedia:()=>({matches:false}),scrollTo:vi.fn()}));
  vi.stubGlobal("document",{documentElement:{scrollHeight:2400}});
  vi.stubGlobal("getComputedStyle",()=>({scrollMarginTop:"24px"}));
  vi.stubGlobal("requestAnimationFrame",()=>42);vi.stubGlobal("cancelAnimationFrame",cancelFrame);
  const cancel=smoothScrollTo({getBoundingClientRect:()=>({top:1000})} as HTMLElement,onEnd);
  try {
    target.dispatchEvent(new Event("pointerdown"));
    expect(cancelFrame).toHaveBeenCalledWith(42);expect(onEnd).toHaveBeenCalledOnce();
    target.dispatchEvent(new Event("keydown"));expect(onEnd).toHaveBeenCalledOnce();
  } finally {cancel();}
});
