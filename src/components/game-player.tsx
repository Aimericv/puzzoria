"use client";
import { useEffect, useRef, useState } from "react";
import { scheduleGameScroll } from "@/lib/replay-scroll";
import { DevFinish } from "./dev-finish";
import type { Locale, PublicChallenge } from "@/lib/types";
import { WordGame } from "./word-game";
import { SudokuGame } from "./sudoku-game";
import { MathGame } from "./math-game";
import { ClassicGame } from "./classic-games";
import { SocialGame } from "./social-game";
import { useAccount } from "./account-provider";
import { GamePreview } from "./game-preview";
import { readPreferences } from "./preferences";
import { writeLocal } from "@/lib/browser-storage";
import { PREFERENCES_KEY } from "@/lib/engagement";
import { prepareCompletedPlay } from "@/lib/play-client";
import { LiveInvite } from "./live-invite";
export function GamePlayer({
  challenge,
  locale,
  ratherOffset = 0,
  scrollOnReady = false,
}: {
  challenge: PublicChallenge;
  locale: Locale;
  ratherOffset?: number;
  scrollOnReady?: boolean;
}) {
  const account = useAccount();
  useEffect(() => {
    if (account.ready && !challenge.roomId)
      writeLocal(PREFERENCES_KEY, {
        ...readPreferences(),
        last: {
          game: challenge.kind,
          mode: challenge.mode ?? "daily",
          locale: challenge.locale,
          date: challenge.date,
          challengeId: challenge.id,
          ...(challenge.kind === "sudoku" ||
          challenge.kind === "mines" ||
          challenge.kind === "guess"
            ? { difficulty: challenge.difficulty }
            : {}),
          ...(challenge.friendId ? { friendId: challenge.friendId } : {}),
        },
      });
  }, [account.ready, account.user?.id, challenge]);
  const key = `${account.user?.id ?? "guest"}:${challenge.id}`;
  const [prepared, setPrepared] = useState("");
  const rootRef = useRef<HTMLDivElement>(null), lastScroll = useRef("");
  useEffect(() => {
    if (!scrollOnReady || !account.ready || prepared !== key || lastScroll.current === key) return;
    if (rootRef.current) return scheduleGameScroll(rootRef.current, () => {lastScroll.current = key;});
  }, [scrollOnReady, account.ready, prepared, key]);
  useEffect(() => {
    if (!account.ready) return;
    let current = true;
    void prepareCompletedPlay(challenge)
      .catch(() => {})
      .finally(() => {
        if (current) setPrepared(key);
      });
    return () => {
      current = false;
    };
  }, [account.ready, key, challenge]);
  if (!account.ready || prepared !== key)
    return <GamePreview challenge={challenge} locale={locale} />;
  return (
    <div key={account.user?.id ?? "guest"} ref={rootRef} data-game-root data-challenge-id={challenge.id} tabIndex={-1}>
      {!challenge.roomId && <div className="live-entry"><LiveInvite game={challenge.kind} locale={locale} difficulty={"difficulty" in challenge ? challenge.difficulty : undefined}/></div>}
      {challenge.roomId ? <Player challenge={challenge} locale={locale} ratherOffset={ratherOffset}/> : <DevFinish key={challenge.id} challenge={challenge} locale={locale}><Player
        challenge={challenge}
        locale={locale}
        ratherOffset={ratherOffset}
      /></DevFinish>}
    </div>
  );
}
function Player({
  challenge,
  locale,
  ratherOffset,
}: {
  challenge: PublicChallenge;
  locale: Locale;
  ratherOffset: number;
}) {
  switch (challenge.kind) {
    case "ranking":
    case "rather":
    case "guess":
      return (
        <SocialGame
          key={challenge.id}
          challenge={challenge}
          locale={locale}
          ratherOffset={ratherOffset}
        />
      );
    case "2048":
    case "mines":
    case "wordsearch":
      return (
        <ClassicGame key={challenge.id} challenge={challenge} locale={locale} />
      );
    case "rareword":
    case "word":
      return (
        <WordGame key={challenge.id} challenge={challenge} locale={locale} />
      );
    case "sudoku":
      return (
        <SudokuGame key={challenge.id} challenge={challenge} locale={locale} />
      );
    case "math":
      return (
        <MathGame key={challenge.id} challenge={challenge} locale={locale} />
      );
  }
}
