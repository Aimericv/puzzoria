import { quizTopics, type Localized } from "./knowledge-catalog";
import type { Locale } from "./types";

const l = (en: string, fr: string, es: string, de: string): Localized => ({ en, fr, es, de });
export const quizThemes = [
  {
    id: "geography", emoji: "🌍",
    slug: l("geography", "geographie", "geografia", "geografie"),
    name: l("Geography", "Géographie", "Geografía", "Geografie"),
    title: l("Geography quizzes: countries, capitals and flags", "Quiz géographie : pays, capitales et drapeaux", "Quizzes de geografía: países, capitales y banderas", "Geografie-Quiz: Länder, Hauptstädte und Flaggen"),
    description: l("Play timed geography quizzes: 195 countries, continents, European capitals, flags and US states. Choose a subject and test your knowledge for free.", "Teste ta géographie avec des quiz chronométrés : 195 pays, continents, capitales d’Europe, drapeaux et États américains. Choisis un sujet et joue gratuitement.", "Juega quizzes de geografía contrarreloj: 195 países, continentes, capitales europeas, banderas y estados de EE. UU. Elige un tema y juega gratis.", "Spiele kostenlose Geografie-Quiz auf Zeit: 195 Länder, Kontinente, europäische Hauptstädte, Flaggen und US-Bundesstaaten. Wähle dein Thema."),
    intro: l("Place countries on the interactive Europe map, practise capitals or recall all 195 countries in a typing quiz. Each format tests a different skill. Every quiz states its scope before the timer starts.", "Place les pays sur la carte interactive d’Europe, révise les capitales ou retrouve les 195 pays dans un quiz de mémoire. Chaque format travaille une compétence différente. Le périmètre est précisé avant le début du chrono.", "Sitúa países en el mapa interactivo de Europa, repasa capitales o recuerda los 195 países en un quiz escrito. Cada formato trabaja una habilidad distinta. Todos explican sus criterios antes de iniciar el reloj.", "Finde Länder auf der interaktiven Europakarte, übe Hauptstädte oder zähle die 195 Länder in einem Schreibquiz auf. Jedes Format trainiert etwas anderes. Der Umfang steht vor dem Start fest."),
    groups: [
      { title: l("Place countries on the map", "Place les pays sur la carte", "Sitúa países en el mapa", "Länder auf der Karte finden"), text: l("Click each requested country to submit your answer immediately. Zoom for small states, then review the corrected map and your score.", "Clique sur chaque pays demandé pour répondre directement. Zoome pour les petits États, puis consulte la carte corrigée et ton score.", "Toca cada país indicado para responder al instante. Amplía para los Estados pequeños y repasa después el mapa corregido y tu puntuación.", "Klicke direkt auf jedes genannte Land, um zu antworten. Zoome für Kleinstaaten hinein und sieh dir danach Kartenauflösung und Punkte an."), topics: ["europe-map"] },
      { title: l("Start small, then try the world", "Un continent, puis le monde", "Un continente, después el mundo", "Vom Kontinent zur ganzen Welt"), text: l("Try a short list first, then combine what you remember in the ten-minute world challenge.", "Essaie une liste courte, puis rassemble tes connaissances dans le défi mondial de dix minutes.", "Prueba una lista corta y reúne lo aprendido en el reto mundial de diez minutos.", "Übe zunächst eine kurze Liste und verbinde dein Wissen danach im zehnminütigen Welt-Quiz."), topics: ["countries-south-america", "countries-oceania", "countries-europe", "countries-africa", "countries-asia", "countries-north-america", "countries-world"] },
      { title: l("Capitals, flags and landmarks", "Capitales, drapeaux et monuments", "Capitales, banderas y monumentos", "Hauptstädte, Flaggen und Sehenswürdigkeiten"), text: l("Switch from recalling names to recognising a clue. The flags quiz contains fifteen flags; the capitals quiz covers twenty European countries.", "Passe des listes de mémoire à la reconnaissance d’un indice. Le quiz de drapeaux propose quinze drapeaux ; celui des capitales couvre vingt pays européens.", "Pasa de recordar listas a reconocer pistas. El quiz de banderas incluye quince banderas; el de capitales, veinte países europeos.", "Wechsle vom Aufzählen zum Erkennen von Hinweisen: fünfzehn Flaggen oder die Hauptstädte von zwanzig europäischen Ländern."), topics: ["europe-capitals", "flags", "landmarks"] },
      { title: l("States, regions and the European Union", "États, régions et Union européenne", "Estados, regiones y Unión Europea", "Bundesstaaten, Regionen und Europäische Union"), text: l("Distinguish a continent from a political union, and a national capital from a state capital. These lists each follow their own stated rules.", "Distingue continent et union politique, capitale nationale et capitale d’État. Chaque liste suit ses propres règles, indiquées sur la page du quiz.", "Distingue continente y unión política, capital nacional y capital de estado. Cada lista sigue las reglas indicadas en su página.", "Unterscheide Kontinent und politischen Zusammenschluss sowie Landes- und Bundesstaatshauptstadt. Jede Liste hat klar benannte Regeln."), topics: ["eu-members", "us-states", "us-state-capitals", "german-states", "french-regions"] },
    ],
    methodTitle: l("How to practise geography", "Comment progresser en géographie", "Cómo mejorar en geografía", "So übst du Geografie"),
    method: l("Work through neighbouring areas in your head instead of jumping randomly between continents. When the timer ends, review the answers you missed and replay the same subject. Your result records answers found and time; replaying does not create a Daily streak.", "Parcours mentalement des zones voisines au lieu de sauter au hasard entre les continents. À la fin du chrono, relis tes oublis et rejoue le même sujet. Le résultat indique les réponses trouvées et le temps ; ces quiz illimités n’alimentent pas une série quotidienne.", "Recorre mentalmente zonas vecinas en vez de saltar entre continentes. Al terminar el tiempo, revisa los olvidos y repite el tema. El resultado muestra respuestas y tiempo; estos quizzes ilimitados no generan una racha diaria.", "Gehe gedanklich benachbarte Gebiete durch, statt zufällig zwischen Kontinenten zu springen. Prüfe danach die fehlenden Antworten und spiele dasselbe Thema erneut. Ergebnisse zeigen Antworten und Zeit; diese unbegrenzten Quiz zählen nicht für eine tägliche Serie."),
  },
  {
    id: "football", emoji: "⚽",
    slug: l("football", "football", "futbol", "fussball"),
    name: l("Football", "Football", "Fútbol", "Fußball"),
    title: l("Football quizzes: clubs, stadiums and champions", "Quiz football : clubs, stades et champions", "Quizzes de fútbol: clubes, estadios y campeones", "Fußball-Quiz: Vereine, Stadien und Sieger"),
    description: l("Test your football knowledge with free timed quizzes on Champions League winners, World Cup champions, stadiums and national teams. Also guess a player by his career.", "Teste ta culture foot : clubs vainqueurs de la Ligue des champions, Coupe du monde, stades et sélections. Quiz gratuits au chrono et joueur à deviner par son parcours.", "Pon a prueba tu fútbol con quizzes gratis de Champions, Mundial, estadios y selecciones. Juega contrarreloj o adivina al futbolista por su trayectoria.", "Teste dein Fußballwissen mit kostenlosen Quiz zu Champions League, Weltmeistern, Stadien und Nationalteams. Oder errate einen Spieler anhand seiner Karriere."),
    intro: l("Find a club from its stadium, recall the champions or match a legend to his national team. Every quiz states its historical cutoff and what an answer represents. Prefer a career puzzle? The separate football game reveals a player's clubs in chronological order.", "Retrouve un club grâce à son stade, cite les champions ou associe une légende à sa sélection. Chaque quiz précise sa période et ce qu’on attend comme réponse. Tu préfères les parcours ? Le jeu de footballeur présente ses clubs dans l’ordre chronologique.", "Encuentra un club por su estadio, recuerda campeones o relaciona leyendas y selecciones. Cada quiz aclara su periodo y el tipo de respuesta. Si prefieres trayectorias, el juego de futbolistas muestra los clubes en orden cronológico.", "Finde Vereine anhand ihrer Stadien, zähle Sieger auf oder ordne Legenden ihren Nationalteams zu. Jeder Quiz nennt Zeitraum und Antworttyp. Im separaten Karrierespiel errätst du einen Spieler anhand seiner chronologisch geordneten Vereine."),
    groups: [
      { title: l("Trophies and winners", "Trophées et palmarès", "Trofeos y campeones", "Titel und Sieger"), text: l("Two different lists: winning clubs in Europe through 2026, and winning national teams at the men's World Cup through 2022. Repeat titles do not create extra answers.", "Deux listes distinctes : clubs champions d’Europe jusqu’en 2026 et sélections championnes du monde masculines jusqu’en 2022. Les titres répétés ne créent pas de réponses supplémentaires.", "Dos listas distintas: clubes campeones de Europa hasta 2026 y selecciones campeonas del Mundial masculino hasta 2022. Repetir título no añade respuestas.", "Zwei verschiedene Listen: Europas Siegervereine bis 2026 und Weltmeisternationen der Männer bis 2022. Mehrere Titel ergeben keine zusätzlichen Antworten."), topics: ["world-cup", "champions-league-winners"] },
      { title: l("Clubs, grounds and international careers", "Clubs, stades et sélections", "Clubes, estadios y selecciones", "Vereine, Stadien und Nationalteams"), text: l("Separate a club's historical home from its current ground, and a player's senior national team from his birthplace.", "Distingue l’enceinte historique d’un club de son stade actuel, et la sélection senior d’un joueur de son lieu de naissance.", "Distingue el estadio histórico del actual y la selección absoluta de un jugador de su lugar de nacimiento.", "Unterscheide historische und heutige Heimstätten sowie A-Nationalteam und Geburtsland eines Spielers."), topics: ["football-stadiums", "football-national-teams"] },
    ],
    methodTitle: l("How to tackle a football quiz", "Comment aborder un quiz de football", "Cómo abordar un quiz de fútbol", "So gehst du Fußball-Quiz an"),
    method: l("Read the clue type before starting: year of first title, stadium or player. Think league by league for clubs and tournament by tournament for national teams. You can type answers in any order; the solutions appear after the game so you can check your gaps.", "Regarde le type d’indice avant de commencer : année du premier titre, stade ou joueur. Pour les clubs, pense championnat par championnat ; pour les sélections, tournoi par tournoi. Réponds dans l’ordre que tu veux, puis consulte les solutions à la fin pour revoir tes oublis.", "Mira el tipo de pista antes de empezar: año del primer título, estadio o jugador. Piensa liga por liga para los clubes y torneo por torneo para las selecciones. Responde en cualquier orden y consulta las soluciones al terminar.", "Achte vor dem Start auf die Hinweise: erstes Titeljahr, Stadion oder Spieler. Denke bei Vereinen Liga für Liga, bei Nationalteams Turnier für Turnier. Antworten sind in beliebiger Reihenfolge möglich; nach dem Spiel kannst du deine Lücken prüfen."),
  },
] as const;

export type QuizTheme = typeof quizThemes[number];
export const quizThemePath = (locale: Locale, theme: QuizTheme) => `/${locale}/quiz/${theme.slug[locale]}`;
export function resolveQuizTheme(locale: Locale, segments: readonly string[]) {
  return segments.length === 2 && segments[0] === "quiz" ? quizThemes.find(theme => theme.slug[locale] === segments[1]) : undefined;
}
export const themeTopicIds = (theme: QuizTheme): readonly string[] => theme.groups.flatMap(group => [...group.topics]);
export const themeForTopic = (id: string) => quizThemes.find(theme => themeTopicIds(theme).includes(id));

// Editorial neighbours follow the task a player has just practised, not catalogue order.
const related: Record<string, string[]> = {
  "countries-world": ["countries-europe", "countries-africa", "countries-asia", "flags"],
  "countries-europe": ["europe-map", "europe-capitals", "eu-members", "countries-world"],
  "europe-map": ["countries-europe", "europe-capitals", "eu-members", "flags"],
  "europe-capitals": ["countries-europe", "eu-members", "us-state-capitals", "landmarks"],
  "eu-members": ["countries-europe", "europe-capitals", "german-states", "french-regions"],
  "countries-africa": ["countries-asia", "countries-world", "flags", "landmarks"],
  "countries-asia": ["countries-oceania", "countries-africa", "countries-world", "flags"],
  "countries-north-america": ["us-states", "us-state-capitals", "countries-south-america", "countries-world"],
  "countries-south-america": ["countries-north-america", "countries-oceania", "countries-world", "flags"],
  "countries-oceania": ["countries-asia", "countries-south-america", "countries-world", "flags"],
  "us-states": ["us-state-capitals", "countries-north-america", "german-states", "french-regions"],
  "us-state-capitals": ["us-states", "europe-capitals", "countries-north-america", "german-states"],
  "german-states": ["eu-members", "countries-europe", "french-regions", "us-states"],
  "french-regions": ["eu-members", "countries-europe", "german-states", "landmarks"],
  "flags": ["countries-world", "countries-europe", "europe-capitals", "landmarks"],
  "landmarks": ["countries-world", "europe-capitals", "flags", "french-regions"],
  "world-cup": ["football-national-teams", "champions-league-winners", "football-stadiums", "countries-world"],
  "champions-league-winners": ["football-stadiums", "world-cup", "football-national-teams", "countries-europe"],
  "football-stadiums": ["champions-league-winners", "football-national-teams", "world-cup", "landmarks"],
  "football-national-teams": ["world-cup", "football-stadiums", "champions-league-winners", "countries-world"],
};
export function relatedQuizTopics(id: string) {
  const ids = related[id] ?? ["general-knowledge", "elements", "authors", "greek-gods", "planets"].filter(other => other !== id).slice(0, 4);
  return ids.flatMap(other => { const topic = quizTopics.find(t => t.id === other); return topic ? [topic] : []; });
}
