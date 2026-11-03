import type { Locale } from "./types";
const en = {
  name: "Footballer of the day", goal: "Find today’s harder footballer in as few guesses as possible.",
  help: "A harder career, the same for everyone. Six guesses. A new player at 00:00 UTC.",
  ready: "Today’s career is a tougher one. Press Start to reveal the clubs. You have six guesses.",
  unlimited: "Unlimited football", unlimitedHelp: "Recognisable players, a new career on every replay. Play as often as you like.",
  next: "Next footballer in", available: "A new footballer is ready!", open: "Play today’s footballer",
  seoTitle: "Guess the football player by their clubs — daily & unlimited quiz",
  seoDescription: "Find the harder footballer of the day in six guesses, or play unlimited career quizzes. Clubs in chronological order, loans included. Free, without signup.",
  intro: "One harder footballer awaits everyone each day. Identify the retired player from their clubs in chronological order in six guesses. Then switch to unlimited for more recognisable careers and a fresh player on every replay.",
};
type Copy = { [K in keyof typeof en]: string };
const fr: Copy = {
  name: "Footballeur du jour", goal: "Trouve le footballeur du jour, plus difficile, en un minimum d’essais.",
  help: "Un parcours plus difficile, identique pour tous. Six essais. Nouveau joueur à 00 h UTC.",
  ready: "Le parcours du jour est plus difficile. Appuie sur Commencer pour révéler les clubs. Tu as six essais.",
  unlimited: "Football illimité", unlimitedHelp: "Des joueurs plus connus, un nouveau parcours à chaque partie. Joue autant que tu veux.",
  next: "Prochain footballeur dans", available: "Un nouveau footballeur est disponible !", open: "Jouer au footballeur du jour",
  seoTitle: "Devine le footballeur par ses clubs — quiz du jour et illimité",
  seoDescription: "Trouve le footballeur du jour, plus difficile, en six essais ou joue en illimité. Clubs dans l’ordre chronologique, prêts inclus. Gratuit et sans inscription.",
  intro: "Chaque jour, un footballeur plus difficile attend tous les joueurs. Retrouve ce joueur retraité grâce à ses clubs dans l’ordre chronologique, en six essais. Passe ensuite en illimité pour des parcours plus accessibles et un nouveau joueur à chaque partie.",
};
const es: Copy = {
  name: "Futbolista del día", goal: "Adivina al futbolista del día, más difícil, con el menor número de intentos.",
  help: "Una carrera más difícil, idéntica para todos. Seis intentos. Nuevo jugador a las 00:00 UTC.",
  ready: "La carrera de hoy es más difícil. Pulsa Empezar para descubrir los clubes. Tienes seis intentos.",
  unlimited: "Fútbol ilimitado", unlimitedHelp: "Jugadores más conocidos y una nueva carrera en cada partida. Juega cuanto quieras.",
  next: "Próximo futbolista en", available: "¡Hay un nuevo futbolista disponible!", open: "Jugar al futbolista del día",
  seoTitle: "Adivina el futbolista por sus clubes: quiz diario e ilimitado",
  seoDescription: "Adivina al futbolista del día, más difícil, en seis intentos o juega sin límite. Clubes en orden cronológico, cesiones incluidas. Gratis y sin registro.",
  intro: "Cada día, todos los jugadores tienen un futbolista más difícil por descubrir. Identifica al jugador retirado por sus clubes en orden cronológico en seis intentos. Después, juega sin límite con carreras más conocidas y un nuevo jugador en cada partida.",
};
const de: Copy = {
  name: "Fußballspieler des Tages", goal: "Errate den schwierigeren Fußballspieler des Tages mit möglichst wenigen Versuchen.",
  help: "Eine schwierigere Karriere, für alle gleich. Sechs Versuche. Neuer Spieler um 00:00 UTC.",
  ready: "Die heutige Karriere ist schwieriger. Drücke Starten, um die Vereine zu sehen. Du hast sechs Versuche.",
  unlimited: "Fußball unbegrenzt", unlimitedHelp: "Bekanntere Spieler und bei jeder Runde eine neue Karriere. Spiele so oft du möchtest.",
  next: "Nächster Fußballspieler in", available: "Ein neuer Fußballspieler ist bereit!", open: "Heutigen Fußballspieler erraten",
  seoTitle: "Fußballspieler an Vereinen erraten – tägliches und unbegrenztes Quiz",
  seoDescription: "Errate den schwierigeren Fußballspieler des Tages in sechs Versuchen oder spiele unbegrenzt. Vereine in zeitlicher Reihenfolge, mit Leihen. Kostenlos und ohne Konto.",
  intro: "Jeden Tag wartet ein schwierigerer Fußballspieler auf alle. Erkenne den ehemaligen Spieler in sechs Versuchen an seinen Vereinen in zeitlicher Reihenfolge. Danach kannst du unbegrenzt bekanntere Karrieren mit einem neuen Spieler pro Runde spielen.",
};
export const footballDailyCopy = (locale: Locale): Copy => ({ en, fr, es, de })[locale];
