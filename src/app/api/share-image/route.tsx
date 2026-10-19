import { BrandMark } from "@/components/brand-mark";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { sharedResult } from "@/lib/server/friends";
import { apiError, rateLimit, requestAddress } from "@/lib/server/http";
import { isLocale } from "@/lib/types";
import { et } from "@/lib/engagement-i18n";
import { t } from "@/lib/i18n";
import { gameName } from "@/lib/registry";
import { siteOrigin, publicSiteConfigured } from "@/lib/site-origin";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  let data: ReturnType<typeof sharedResult>;
  try {
    rateLimit("share-image-address:"+requestAddress(request),120,60000);
    data = sharedResult(request.nextUrl.searchParams.get("id"));
  } catch (error) {
    return apiError(error);
  }
  const candidate =
    request.nextUrl.searchParams.get("locale") ?? data.completion.locale;
  const locale = isLocale(candidate) ? candidate : data.completion.locale;
  return renderImage(
    data,
    locale,
    Math.max(
      0,
      Math.min(3600, Math.floor((data.view.expiresAt - Date.now()) / 1000)),
    ),
  );
}
function renderImage(
  { view, rows, completion, challenge }: ReturnType<typeof sharedResult>,
  locale: import("@/lib/types").Locale,
  cacheSeconds: number,
) {
  const m = et(locale),
    colors: Record<string, string> = {
      correct: "#25795b",
      present: "#d1a323",
      absent: "#697387",
    };
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#f7f8fb",
          color: "#172039",
          padding: "60px",
          flexDirection: "column",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 35,
            color: "#2149e7",
            fontWeight: 700,
          }}
        >
          <BrandMark size={38}/>
          <span style={{marginLeft:12}}>puzzoria.</span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 60,
            marginTop: 25,
            alignItems: "center",
            flex: 1,
          }}
        >
          <div style={{ display: "flex", flex: 1, flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 48 }}>
              {gameName(completion.game, locale)}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 65,
                marginTop: 20,
                fontWeight: 700,
              }}
            >
              {(completion.game === "word" || completion.game === "rareword")
                ? `${completion.success ? completion.attempts : "X"}/${completion.maxAttempts ?? 6}`
                : `${completion.score} ${t(locale).score}`}
            </div>
            <div style={{ display: "flex", fontSize: 28, marginTop: 20 }}>
              {Math.floor(completion.duration / 60)}:
              {String(completion.duration % 60).padStart(2, "0")} ·{" "}
              {completion.date}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 32,
                marginTop: 30,
                color: "#2149e7",
              }}
            >
              {m.beatMe}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            {(challenge.kind === "word" || challenge.kind === "rareword") ? (
              rows.map((row, i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  {row.map((state, j) => (
                    <div
                      key={j}
                      style={{
                        display: "flex",
                        width: 48,
                        height: 48,
                        borderRadius: 6,
                        background: colors[state] ?? colors.absent,
                      }}
                    />
                  ))}
                </div>
              ))
            ) : challenge.kind === "sudoku" ? (
              Array.from({ length: 9 }, (_, row) => (
                <div key={row} style={{ display: "flex", gap: 2 }}>
                  {challenge.grid.slice(row * 9, row * 9 + 9).map((n, col) => (
                    <div
                      key={col}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 34,
                        height: 34,
                        fontSize: 22,
                        background: "white",
                        border: "1px solid #d8deea",
                      }}
                    >
                      {n || ""}
                    </div>
                  ))}
                </div>
              ))
            ) : challenge.kind === "math" ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 15,
                }}
              >
                <div style={{ display: "flex", fontSize: 26 }}>
                  {t(locale).target}
                </div>
                <div style={{ display: "flex", fontSize: 76, fontWeight: 700 }}>
                  {challenge.target}
                </div>
                <div style={{ display: "flex", fontSize: 25, gap: 15 }}>
                  {challenge.numbers.map((n, i) => (
                    <span
                      key={i}
                      style={{
                        display: "flex",
                        padding: "10px 12px",
                        border: "1px solid #d8deea",
                        borderRadius: 8,
                        background: "white",
                      }}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Array.from({ length: 4 }, (_, row) => (
                  <div key={row} style={{ display: "flex", gap: 8 }}>
                    {Array.from({ length: 4 }, (_, col) => (
                      <span
                        key={col}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 55,
                          height: 55,
                          fontSize: 26,
                          borderRadius: 8,
                          background: "#e4e9f4",
                        }}
                      >
                        {challenge.kind === "2048"
                          ? challenge.grid[row * 4 + col] || ""
                          : challenge.kind === "wordsearch"
                            ? challenge.grid[row * challenge.size + col]
                            : "□"}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 22, marginTop: 22 }}>
          {m.friendTitle} · {m.playChallenge}
        </div>
        {publicSiteConfigured && (
          <div
            style={{
              display: "flex",
              fontSize: 17,
              marginTop: 12,
              color: "#56647b",
            }}
          >{`${new URL(siteOrigin).hostname}/${locale}/friend/${view.id}`}</div>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": `public, max-age=${cacheSeconds}`,
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
