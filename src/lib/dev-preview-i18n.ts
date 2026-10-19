import type { Locale } from "./types";
const rows = {
  fr: {finish: "Terminer en un clic (test local)", local: "Aperçu local · aucune partie enregistrée", close: "Retour à la grille", error: "Aperçu indisponible. Réessaie."},
  en: {finish: "Finish in one click (local test)", local: "Local preview · no game recorded", close: "Back to the board", error: "Preview unavailable. Try again."},
  es: {finish: "Terminar en un clic (prueba local)", local: "Vista previa local · no se guarda la partida", close: "Volver al tablero", error: "Vista previa no disponible. Inténtalo de nuevo."},
  de: {finish: "Mit einem Klick beenden (lokaler Test)", local: "Lokale Vorschau · kein Ergebnis gespeichert", close: "Zurück zum Spielfeld", error: "Vorschau nicht verfügbar. Erneut versuchen."},
};
export const devPreviewCopy = (locale: Locale) => rows[locale];
