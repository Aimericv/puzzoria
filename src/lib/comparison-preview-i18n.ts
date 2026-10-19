import type { Locale } from "./types";
const rows = {
  en: { title: "Comparison preview", pending: "Comparisons unlock with at least 20 other qualifying players.", players: "Players" },
  fr: { title: "Aperçu des comparaisons", pending: "Comparaisons disponibles dès 20 autres joueurs admissibles.", players: "Joueurs" },
  es: { title: "Vista previa de las comparaciones", pending: "Comparaciones disponibles con al menos otros 20 jugadores válidos.", players: "Jugadores" },
  de: { title: "Vorschau der Vergleiche", pending: "Vergleiche erscheinen ab 20 weiteren geeigneten Spielern.", players: "Spieler" },
};
export const comparisonPreviewCopy = (locale: Locale) => rows[locale];
