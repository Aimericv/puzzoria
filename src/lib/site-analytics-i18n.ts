import type { Locale } from "./types";
const en = {
  title: "Internal analytics", intro: "Verified game activity, measured directly on this server.",
  exportAnalysis: "Download full report (JSON)",
  period: "Period", days: "days", game: "Game", language: "Game language", mode: "Mode", all: "All", apply: "Apply", export: "Download CSV",
  players: "Active players", starts: "Games started", finishes: "Games finished", pending: "Unfinished · under 48 hours", dormant: "Unfinished · at least 48 hours", finishRate: "Completion rate", signups: "New accounts",
  daily: "Activity by UTC day", games: "Activity by game", date: "Date", retention: "Player retention", d1: "Return on day 1", d7: "Return on day 7", returned: "returned", mature: "fully observed players", unavailable: "Not enough observation time", empty: "No games started in this period.",
  scope: "The completion rate describes games started in the selected period, including later finishes. Unfinished games can still be resumed; they are not confirmed abandonments.",
  limits: "A player is a registered account or a guest device, not a unique person. Clearing cookies or changing devices can create another guest. Administrator accounts are excluded. Language is the puzzle language, not necessarily the interface language.",
  returns: "Day 1/day 7/day 30 measure a start or a verified finish on that exact UTC day after the first observed game activity in the selected scope. Only fully elapsed return days enter the denominator. A page visit alone is not a return to play; private number rooms contribute verified finishes.",
  privacy: "Private aggregate game records and optional internal visit measurement. Imported results and local previews are excluded. No external analytics provider.",
  privacyPublic: "The operator can view aggregate game activity. Optional internal measurement also records visits, arrival sources, active playing time, replays and navigation between games, only when you allow it. Hashed device/account identifiers connect sessions; no advertising provider or external analytics service is connected. Use the preferences below to change your choice.",
};
type Copy = Record<keyof typeof en, string>;
const copy: Record<Locale, Copy> = {
  en,
  fr: {
    title: "Statistiques internes", intro: "L’activité des parties vérifiées, mesurée directement sur ce serveur.",
    exportAnalysis: "Télécharger le rapport complet (JSON)",
    period: "Période", days: "jours", game: "Jeu", language: "Langue de la partie", mode: "Mode", all: "Tous", apply: "Appliquer", export: "Télécharger le CSV",
    players: "Joueurs actifs", starts: "Parties commencées", finishes: "Parties terminées", pending: "Sans fin · moins de 48 h", dormant: "Sans fin · au moins 48 h", finishRate: "Taux de fin de partie", signups: "Nouveaux comptes",
    daily: "Activité par jour UTC", games: "Activité par jeu", date: "Date", retention: "Retour des joueurs", d1: "Retour à J+1", d7: "Retour à J+7", returned: "revenus", mature: "joueurs entièrement observés", unavailable: "Pas encore assez de recul", empty: "Aucune partie commencée sur cette période.",
    scope: "Le taux de fin porte sur les parties commencées pendant la période sélectionnée, y compris leurs fins ultérieures. Les parties sans fin peuvent encore être reprises ; ce ne sont pas des abandons confirmés.",
    limits: "Un joueur désigne un compte ou un appareil invité, pas une personne unique. Effacer les cookies ou changer d’appareil peut créer un nouvel invité. Les comptes administrateurs sont exclus. La langue est celle du puzzle, pas forcément celle de l’interface.",
  returns: "J+1/J+7/J+30 mesurent un début ou une fin vérifiée au jour UTC précis après la première activité de jeu observée dans le périmètre. Seuls les jours de retour entièrement écoulés entrent au dénominateur. Une visite seule ne compte pas comme retour pour jouer ; les duels privés contribuent lors d’une fin vérifiée.",
  privacy: "Statistiques privées issues des parties et mesure facultative des visites. Imports et aperçus locaux exclus. Aucun fournisseur externe.",
  privacyPublic: "L’exploitant consulte l’activité agrégée des parties. Une mesure interne facultative enregistre aussi visites, sources d’arrivée, temps actif, replays et passages entre jeux, seulement si tu l’autorises. Des identifiants d’appareil/compte hachés relient les sessions. Aucun fournisseur publicitaire ni service externe de mesure n’est connecté. Modifie ton choix ci-dessous.",
  },
  es: {
    title: "Estadísticas internas", intro: "Actividad de partidas verificadas, medida directamente en este servidor.",
    exportAnalysis: "Descargar informe completo (JSON)",
    period: "Periodo", days: "días", game: "Juego", language: "Idioma de la partida", mode: "Modo", all: "Todos", apply: "Aplicar", export: "Descargar CSV",
    players: "Jugadores activos", starts: "Partidas iniciadas", finishes: "Partidas terminadas", pending: "Sin terminar · menos de 48 h", dormant: "Sin terminar · al menos 48 h", finishRate: "Tasa de finalización", signups: "Cuentas nuevas",
    daily: "Actividad por día UTC", games: "Actividad por juego", date: "Fecha", retention: "Retorno de jugadores", d1: "Retorno el día 1", d7: "Retorno el día 7", returned: "volvieron", mature: "jugadores con observación completa", unavailable: "Aún falta tiempo de observación", empty: "No se iniciaron partidas en este periodo.",
    scope: "La tasa describe las partidas iniciadas en el periodo seleccionado, incluidas las finalizaciones posteriores. Las partidas sin terminar aún pueden reanudarse; no son abandonos confirmados.",
    limits: "Un jugador es una cuenta o un dispositivo invitado, no una persona única. Borrar cookies o cambiar de dispositivo puede crear otro invitado. Se excluyen las cuentas administradoras. El idioma es el del puzzle, no necesariamente el de la interfaz.",
  returns: "Los días 1, 7 y 30 miden un inicio o una finalización verificada en ese día UTC exacto tras la primera actividad de juego observada en el ámbito. Solo se incluyen días completamente transcurridos. Una visita sola no es un retorno a jugar; las salas privadas aportan finalizaciones verificadas.",
  privacy: "Registros privados agregados y medición interna opcional de visitas. Se excluyen importaciones y vistas de prueba. Sin proveedor externo.",
  privacyPublic: "El operador consulta la actividad agregada de las partidas. La medición interna opcional registra visitas, origen, tiempo activo, repeticiones y cambios de juego, solo si lo permites. Identificadores de dispositivo/cuenta cifrados con hash relacionan sesiones. No hay proveedor publicitario ni servicio externo de análisis. Puedes cambiar tu elección abajo.",
  },
  de: {
    title: "Interne Statistik", intro: "Verifizierte Spielaktivität, direkt auf diesem Server gemessen.",
    exportAnalysis: "Vollständigen Bericht herunterladen (JSON)",
    period: "Zeitraum", days: "Tage", game: "Spiel", language: "Rätselsprache", mode: "Modus", all: "Alle", apply: "Anwenden", export: "CSV herunterladen",
    players: "Aktive Spieler", starts: "Begonnene Spiele", finishes: "Beendete Spiele", pending: "Unbeendet · unter 48 Stunden", dormant: "Unbeendet · mindestens 48 Stunden", finishRate: "Abschlussquote", signups: "Neue Konten",
    daily: "Aktivität nach UTC-Tag", games: "Aktivität nach Spiel", date: "Datum", retention: "Rückkehr der Spieler", d1: "Rückkehr an Tag 1", d7: "Rückkehr an Tag 7", returned: "zurückgekehrt", mature: "vollständig beobachtete Spieler", unavailable: "Noch nicht genug Beobachtungszeit", empty: "In diesem Zeitraum wurden keine Spiele begonnen.",
    scope: "Die Quote bezieht sich auf Spiele, die im gewählten Zeitraum begonnen wurden, einschließlich späterer Abschlüsse. Unbeendete Spiele können noch fortgesetzt werden; sie sind keine bestätigten Abbrüche.",
    limits: "Ein Spieler ist ein Konto oder ein Gastgerät, keine eindeutige Person. Gelöschte Cookies oder ein Gerätewechsel können einen weiteren Gast erzeugen. Administratorkonten sind ausgeschlossen. Die Sprache gehört zum Rätsel, nicht unbedingt zur Oberfläche.",
  returns: "Tag 1, 7 und 30 messen einen Start oder verifizierten Abschluss genau an diesem UTC-Tag nach der ersten beobachteten Spielaktivität im gewählten Bereich. Nur vollständig vergangene Tage zählen. Ein Seitenbesuch allein ist keine Rückkehr zum Spielen; private Zahlenräume tragen verifizierte Abschlüsse bei.",
  privacy: "Private aggregierte Spielaufzeichnungen und optionale interne Besuchsmessung. Importe und lokale Vorschauen sind ausgeschlossen. Kein externer Anbieter.",
  privacyPublic: "Der Betreiber sieht zusammengefasste Spielaktivität. Die optionale interne Messung erfasst Besuche, Herkunft, aktive Spielzeit, erneutes Spielen und Spielwechsel nur mit deiner Zustimmung. Gehashte Geräte-/Kontokennungen verbinden Sitzungen. Kein Werbeanbieter oder externer Analysedienst ist verbunden. Ändere deine Wahl unten.",
  },
};
export const siteAnalyticsCopy = (locale: Locale) => copy[locale];
