"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import type { Difficulty, GameId, Locale } from "@/lib/types";
import { liveGame } from "@/lib/live-types";
import { lt } from "@/lib/live-i18n";
import { postJson } from "@/lib/play-client";
import { track } from "@/lib/analytics";
import { ErrorMessage } from "./game-common";
export function LiveInvite({
  game,
  locale,
  difficulty,
}: {
  game: GameId;
  locale: Locale;
  difficulty?: Difficulty;
}) {
  const router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function create() {
    setBusy(true);
    setError("");
    try {
      const room = await postJson("/api/live-rooms", {
        action: "create",
        game: liveGame(game),
        locale,
        difficulty,
      });
      track("friend_invite", { locale, game_id: liveGame(game) });
      router.push(`/${locale}/live/${room.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="secondary-button"
        data-invite-button
        disabled={busy}
        onClick={() => void create()}
      >
        <Users size={17} />
        {lt(locale).invite}
      </button>
      <ErrorMessage error={error} locale={locale} />
    </>
  );
}
