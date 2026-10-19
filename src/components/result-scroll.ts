"use client";
import { useEffect, useRef } from "react";
import { smoothScrollTo } from "@/lib/smooth-scroll";
// A result is focused once per mounted game; asynchronous statistics must not move it again.
export function useResultScroll(complete = true) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!complete) return;
    let cancel: (() => void) | undefined;
    const frame = requestAnimationFrame(() => {
      ref.current?.focus({preventScroll: true});
      if (ref.current) cancel = smoothScrollTo(ref.current);
    });
    return () => {cancelAnimationFrame(frame); cancel?.();};
  }, [complete]);
  return ref;
}
