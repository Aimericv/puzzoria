import type { GameId, Locale } from "./types";
import { smoothScrollTo } from "./smooth-scroll";
const key = "dailygrid:replay-intent";
let releaseSpace: (() => void) | undefined;
// Removing a tall result would otherwise clamp scrollY before the new grid loads.
export function preserveReplaySpace() {
  if (releaseSpace) return;
  const previous = document.body.style.minHeight;
  const anchor = document.documentElement.style.overflowAnchor;
  document.documentElement.style.overflowAnchor = "none";
  document.body.style.minHeight = `${document.documentElement.scrollHeight}px`;
  const timer = window.setTimeout(releaseReplaySpace, 10000);
  releaseSpace = () => {
    window.clearTimeout(timer);
    document.body.style.minHeight = previous;
    document.documentElement.style.overflowAnchor = anchor;
    releaseSpace = undefined;
  };
}
export function releaseReplaySpace() {releaseSpace?.();}
export function requestReplay(game: GameId, locale: Locale) {
  preserveReplaySpace();
  try { sessionStorage.setItem(key, `${game}:${locale}`); } catch { /* In-page replays still scroll. */ }
}
export function consumeReplay(game: GameId, locale: Locale) {
  try {
    if (sessionStorage.getItem(key) !== `${game}:${locale}`) return false;
    sessionStorage.removeItem(key);
    return true;
  } catch { return false; }
}
export function scrollToGame(root: HTMLElement) {
  const board = root.querySelector<HTMLElement>(".word-board, .sudoku-board, .classic-board, .social-game") ?? root;
  const focus = board.querySelector<HTMLElement>(".sudoku-cell.selected") ?? board;
  focus.focus({preventScroll: true});
  const target = root.querySelector<HTMLElement>("[data-word-mode]") ?? board;
  return smoothScrollTo(target, releaseReplaySpace);
}
export function scheduleGameScroll(root: HTMLElement, onScrolled = () => {}) {
  let frame: number | null = null;
  let cancelScroll: (() => void) | undefined;
  const ready = () => root.querySelector(".word-board[aria-busy='true'], .sudoku-board[aria-busy='true']") === null;
  const observer = new MutationObserver(attempt);
  function attempt() {
    if (frame !== null || !ready()) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (!ready()) return;
      observer.disconnect();
      cancelScroll = scrollToGame(root);
      onScrolled();
    });
  }
  observer.observe(root, {subtree: true, childList: true, attributes: true, attributeFilter: ["aria-busy"]});
  attempt();
  return () => {
    observer.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
    cancelScroll?.();
  };
}
