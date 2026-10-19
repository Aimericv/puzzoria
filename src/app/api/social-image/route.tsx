import { BrandMark } from "@/components/brand-mark";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { identity } from "@/lib/server/auth";
import { ownedRun } from "@/lib/server/play";
import { getRoom } from "@/lib/server/number-rooms";
import { ApiError, apiError, rateLimit, requestAddress } from "@/lib/server/http";
import { socialCommunity } from "@/lib/server/community";
import { socialShareLines } from "@/lib/social-share";
import type { SocialChallenge, SocialState } from "@/lib/social-types";
import { isLocale } from "@/lib/types";
import { st, sf } from "@/lib/social-i18n";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const candidate = request.nextUrl.searchParams.get("locale"),
    locale = candidate && isLocale(candidate) ? candidate : "en";
  let lines: string[], kind: string;
  try {
    rateLimit("social-image-address:"+requestAddress(request),120,60000);
    const who = identity(request);
    rateLimit("social-image:" + who.owner, 60, 60000);

    if (request.nextUrl.searchParams.has("code")) {
      const room = getRoom(request.nextUrl.searchParams.get("code"), who);
      if (!room.completed) throw new ApiError("notFinished", 409);
      const m = st(locale);
      kind = "guess";
      lines = [
        m.guessName,
        room.winner === null
          ? m.draw
          : room.winner === room.you
            ? m.won
            : m.lost,
        m.friends,
        sf(m.turns, {
          n: room.events.filter((e) => e.player === room.you).length,
        }),
        `${m.candidates}: ${room.candidates.length}`,
      ];
    } else {
      const run = ownedRun(request.nextUrl.searchParams.get("runId"), who);
      if (
        !run.response_json ||
        !["ranking", "rather", "guess"].includes(run.game)
      )
        throw new ApiError("notFinished", 409);
      const c = JSON.parse(run.challenge_json) as SocialChallenge,
        state = JSON.parse(run.response_json).state as SocialState;
      kind = c.kind;
      lines = socialShareLines(
        c,
        state,
        socialCommunity(c, state, who.owner),
        locale,
      );
    }
  } catch (e) {
    return apiError(e);
  }
  const color = { ranking: "#784dbe", rather: "#215eda", guess: "#087f75" }[
    kind as "ranking" | "rather" | "guess"
  ];
  const clean = (line: string) =>
    line
      .replaceAll("🟦", "A ")
      .replaceAll("🟥", "B ")
      .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
      .trim();
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#10182c",
          color: "#fff",
          padding: "48px 65px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 27, color: "#a5b8d8" }}>
          <BrandMark size={38}/>
          <span style={{marginLeft:12}}>puzzoria.</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 45,
            fontWeight: 700,
            marginTop: 18,
            marginBottom: 22,
          }}
        >
          {lines[0]}
        </div>
        <div style={{ display: "flex", gap: 38 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 900,
              gap: 9,
            }}
          >
            {lines.slice(1, 8).map((line, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: i < 5 ? color : "#24334e",
                  borderRadius: 12,
                  padding: "8px 16px",
                  fontSize: clean(line).length > 70 ? 17 : 20,
                  minHeight: 43,
                }}
              >
                {kind === "rather" && i === 0 ? (
                  <div style={{ display: "flex", gap: 10 }}>
                    {clean(line)
                      .split(/\s+/)
                      .map((vote, index) => (
                        <div
                          key={index}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 39,
                            height: 39,
                            borderRadius: 8,
                            background: vote === "A" ? "#2c6ceb" : "#c93950",
                            border: "2px solid #ffffff70",
                            fontWeight: 700,
                          }}
                        >
                          {vote}
                        </div>
                      ))}
                  </div>
                ) : (
                  clean(line).slice(0, 102)
                )}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: kind === "rather" ? 44 : 78,
              color: "#fff",
              width: 100,
            }}
          >
            {kind === "ranking" ? "#1" : kind === "rather" ? "A/B" : "?"}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            fontSize: 20,
            color: "#a5b8d8",
          }}
        >
          {st(locale).replay} · Puzzoria
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
