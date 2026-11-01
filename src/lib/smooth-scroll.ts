// A predictable easing curve shared by results and replay; user input cancels it.
let cancelCurrent: (() => void) | undefined;
export function smoothScrollTo(element: HTMLElement, onEnd = () => {}) {
  cancelCurrent?.();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.scrollIntoView({block: "start", behavior: "instant"});
    onEnd();
    return () => {};
  }
  const from = window.scrollY;
  const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const to = Math.max(0, Math.min(maximum, from + element.getBoundingClientRect().top - margin));
  const distance = to - from, duration = Math.min(950, Math.max(500, Math.abs(distance) * .35));
  let frame = 0, start: number | undefined;
  let finished = false;
  const cancel = () => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    window.removeEventListener("wheel", cancel);
    window.removeEventListener("touchstart", cancel);
    window.removeEventListener("pointerdown", cancel);
    window.removeEventListener("keydown", cancel);
    if (cancelCurrent === cancel) cancelCurrent = undefined;
    onEnd();
  };
  const tick = (now: number) => {
    start ??= now;
    const progress = Math.min(1, (now - start) / duration);
    const eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
    window.scrollTo({top: from + distance * eased, behavior: "instant"});
    if (progress < 1) frame = requestAnimationFrame(tick);
    else cancel();
  };
  cancelCurrent = cancel;
  window.addEventListener("wheel", cancel, {passive: true});
  window.addEventListener("touchstart", cancel, {passive: true});
  window.addEventListener("pointerdown", cancel, {passive: true});
  window.addEventListener("keydown", cancel);
  frame = requestAnimationFrame(tick);
  return cancel;
}
