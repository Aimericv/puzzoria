import type { Locale } from "./types";
const rows = {
  fr: { won: "Réussites", lost: "Échecs", faster: "🔥 Plus rapide que {n} % des joueurs ayant réussi", score: "🏆 Meilleur score que {n} % des joueurs", split: "Comment les autres s’en sont sortis" },
  en: { won: "Wins", lost: "Losses", faster: "🔥 Faster than {n}% of players who won", score: "🏆 Higher score than {n}% of players", split: "How other players did" },
  es: { won: "Victorias", lost: "Derrotas", faster: "🔥 Más rápido que el {n}% de quienes ganaron", score: "🏆 Mejor puntuación que el {n}% de jugadores", split: "Así les fue a los demás" },
  de: { won: "Gewonnen", lost: "Verloren", faster: "🔥 Schneller als {n}% der erfolgreichen Spieler", score: "🏆 Höhere Punktzahl als {n}% der Spieler", split: "So haben die anderen abgeschnitten" },
};
export const comparisonCopy = (locale: Locale) => rows[locale];
