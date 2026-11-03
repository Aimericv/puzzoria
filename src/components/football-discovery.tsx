import Link from "next/link";
import { gamePath } from "@/lib/i18n";
import { quizTopic, quizTopicPath } from "@/lib/knowledge-catalog";
import { kt } from "@/lib/knowledge-i18n";
import type { GameId, Locale } from "@/lib/types";

const copy = {
  en: {
    title: "More football challenges",
    nations: "Switch from club careers to national teams: find the eight countries that won the men’s World Cup from 1930 to 2022 in 60 seconds.",
    players: "Prefer recognising players? Follow a retired footballer’s clubs in chronological order and find their name in six guesses, with no time limit in solo play.",
  },
  fr: {
    title: "D’autres défis de football",
    nations: "Passe des carrières en club aux sélections : retrouve en 60 secondes les huit pays vainqueurs du Mondial masculin de 1930 à 2022.",
    players: "Tu préfères reconnaître les joueurs ? Suis les clubs d’un footballeur retraité dans l’ordre chronologique et retrouve son nom en six essais, sans limite de temps en solo.",
  },
  es: {
    title: "Más retos de fútbol",
    nations: "Pasa de las carreras en clubes a las selecciones: encuentra en 60 segundos los ocho países campeones del Mundial masculino de 1930 a 2022.",
    players: "¿Prefieres reconocer jugadores? Sigue los clubes de un futbolista retirado en orden cronológico y encuentra su nombre en seis intentos, sin límite de tiempo en solitario.",
  },
  de: {
    title: "Weitere Fußballrätsel",
    nations: "Wechsle von Vereinskarrieren zu Nationalteams: Finde in 60 Sekunden die acht Länder, die von 1930 bis 2022 die Weltmeisterschaft der Männer gewonnen haben.",
    players: "Erkennst du lieber Spieler? Folge den Vereinen eines ehemaligen Fußballspielers in zeitlicher Reihenfolge und finde seinen Namen in sechs Versuchen, im Solospiel ohne Zeitlimit.",
  },
};

export function FootballDiscovery({ locale, game, quizCategory }: {
  locale: Locale;
  game: GameId;
  quizCategory?: string;
}) {
  const topic = quizTopic("world-cup");
  if (!topic || (game !== "football" && (game !== "quiz" || quizCategory !== topic.id))) return null;
  const m = copy[locale];
  const fromCareer = game === "football";
  return (
    <section className="game-guide" data-football-discovery>
      <h2>{m.title}</h2>
      <p>{fromCareer ? m.nations : m.players}</p>
      <p>
        <Link href={fromCareer ? quizTopicPath(locale, topic) : gamePath(locale, "football")}>
          {fromCareer ? topic.title[locale] : kt(locale).footballName}
        </Link>
      </p>
    </section>
  );
}
