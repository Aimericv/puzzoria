import type { Completion, Locale } from "./types";
import { utcDay } from "./date";
import { rareWordCopy } from "./rare-word-i18n";

const en = {
  wordDaily: "Daily word",
  daily: "Daily challenge",
  dailyHelp:
    "The same puzzle for everyone today · a new challenge at 00:00 UTC.",
  dailyDone: "Daily challenge completed. Play again starts an Unlimited game.",
  practice: "Unlimited result",
  archive: "Archive result",
  friend: "Friend challenge result",
  personalStats: "Your statistics · this game and mode",
  communityPending:
    "Your personal statistics are available now. Community comparisons need this result and at least 20 other players' results to qualify. Early players can return here to see them too.",
  communityUnavailable:
    "Community comparisons are temporarily unavailable. Your game is saved and you can keep playing.",
  invalidAction:
    "This move could not be accepted. The saved game has been restored; try again.",
  numberLocked:
    "Your secret number was already locked in this saved game. Start a new game to choose another one.",
};
type Copy = Record<keyof typeof en, string>;
const rows: Record<Locale, Copy> = {
  en,
  fr: {
    wordDaily: "Mot du jour",
    daily: "Défi du jour",
    dailyHelp: "Le même défi pour tous aujourd’hui · nouveau défi à 00 h UTC.",
    dailyDone: "Défi du jour terminé. Rejouer lance une partie en Illimité.",
    practice: "Résultat en Illimité",
    archive: "Résultat des archives",
    friend: "Résultat du défi entre amis",
    personalStats: "Tes statistiques · ce jeu et ce mode",
    communityPending:
      "Tes statistiques personnelles sont déjà disponibles. Les comparaisons nécessitent que ce résultat et ceux d’au moins 20 autres joueurs soient admissibles. Les premiers joueurs peuvent aussi revenir ici pour les consulter.",
    communityUnavailable:
      "Les comparaisons communautaires sont temporairement indisponibles. Ta partie est sauvegardée et tu peux continuer à jouer.",
    invalidAction:
      "Ce coup n’a pas pu être accepté. La partie sauvegardée a été restaurée ; réessaie.",
    numberLocked:
      "Ton nombre secret était déjà verrouillé dans cette partie sauvegardée. Lance une nouvelle partie pour en choisir un autre.",
  },
  es: {
    wordDaily: "Palabra del día",
    daily: "Reto del día",
    dailyHelp: "El mismo reto para todos hoy · un nuevo reto a las 00:00 UTC.",
    dailyDone:
      "Reto del día completado. Volver a jugar inicia una partida ilimitada.",
    practice: "Resultado ilimitado",
    archive: "Resultado del archivo",
    friend: "Resultado del reto entre amigos",
    personalStats: "Tus estadísticas · este juego y modo",
    communityPending:
      "Tus estadísticas personales ya están disponibles. Las comparaciones requieren que este resultado y los de al menos otros 20 jugadores sean válidos. Los primeros jugadores también pueden volver aquí para consultarlas.",
    communityUnavailable:
      "Las comparaciones de la comunidad no están disponibles temporalmente. Tu partida está guardada y puedes seguir jugando.",
    invalidAction:
      "No se ha podido aceptar esta jugada. Se ha restaurado la partida guardada; inténtalo de nuevo.",
    numberLocked:
      "Tu número secreto ya estaba bloqueado en esta partida guardada. Inicia una nueva partida para elegir otro.",
  },
  de: {
    wordDaily: "Wort des Tages",
    daily: "Tagesaufgabe",
    dailyHelp:
      "Heute dieselbe Aufgabe für alle · eine neue Aufgabe um 00:00 UTC.",
    dailyDone:
      "Tagesaufgabe abgeschlossen. Erneut spielen startet eine unbegrenzte Partie.",
    practice: "Ergebnis im unbegrenzten Modus",
    archive: "Archivergebnis",
    friend: "Ergebnis der Freundesaufgabe",
    personalStats: "Deine Statistik · dieses Spiel und dieser Modus",
    communityPending:
      "Deine persönliche Statistik ist bereits verfügbar. Vergleiche benötigen dieses Ergebnis und gültige Ergebnisse von mindestens 20 anderen Spielern. Auch die ersten Spieler können später hier ihre Vergleiche ansehen.",
    communityUnavailable:
      "Community-Vergleiche sind vorübergehend nicht verfügbar. Deine Partie ist gespeichert und du kannst weiterspielen.",
    invalidAction:
      "Dieser Zug konnte nicht angenommen werden. Die gespeicherte Partie wurde wiederhergestellt; versuche es erneut.",
    numberLocked:
      "Deine Geheimzahl war in dieser gespeicherten Partie bereits festgelegt. Starte eine neue Partie, um eine andere zu wählen.",
  },
};
export const pg = (locale: Locale) => rows[locale];
export function resultModeLabel(completion: Completion, locale: Locale) {
  const m = pg(locale);
  return completion.friendId
    ? m.friend
    : completion.mode === "practice"
      ? m.practice
      : completion.mode === "archive" || completion.date !== utcDay()
        ? m.archive
        : completion.game === "rareword" ? rareWordCopy(locale).dailyLabel : m.daily;
}
