import { BrandMark } from "@/components/brand-mark";
import { ImageResponse } from "next/og";
import { catalogGameIds, isLocale } from "@/lib/types";
import { gameName } from "@/lib/registry";
import { seoCopy } from "@/lib/seo-content";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response(null, { status: 404 });
  const colors = {
    word: "#337a62",
    rareword: "#5369a0",
    sudoku: "#3266aa",
    math: "#ad7040",
    "2048": "#986125",
    mines: "#426f82",
    wordsearch: "#8055ac",
    ranking: "#784dbe",
    guess: "#087f75",
    rather: "#215eda",
  };
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#f7f8fb",
          padding: "38px 60px",
          color: "#223047",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 40,
            fontWeight: 700,
            color: "#3266aa",
          }}
        >
          <BrandMark size={38}/>
          <span style={{marginLeft:12}}>puzzoria.</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 22,
            fontSize: 46,
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          {seoCopy(locale).homeHeading}
        </div>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 28 }}
        >
          {catalogGameIds.map((game) => (
            <div
              key={game}
              style={{
                display: "flex",
                flexDirection: "column",
                width: 348,
                padding: "10px 16px",
                background: "white",
                borderRadius: 18,
                border: "1px solid #e1e6ee",
                color: colors[game],
              }}
            >
              <div style={{ display: "flex", fontSize: 17, marginBottom: 5 }}>
                {game === "word"
                  ? "A B C"
                  : game === "sudoku"
                    ? "1 2 3"
                    : game === "math"
                      ? "6 + 9"
                      : game === "2048"
                        ? "2 · 4 · 8 · 16"
                        : game === "mines"
                          ? "1 · 2 · 1"
                          : "A B C D"}
              </div>
              <div style={{ display: "flex", fontSize: 24, fontWeight: 700 }}>
                {gameName(game, locale)}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=86400",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
