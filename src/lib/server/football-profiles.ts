import { languages, type Localized } from "../knowledge-catalog";
import { footballProfileSection } from "../football-profile-path";
import type { Locale } from "../types";
import { footballPlayers } from "./knowledge-content";

type ProfileSection = {
  title: Localized;
  body: Localized;
  source: { name: string; url: string };
};

type ProfileEditorial = {
  playerId: string;
  slug: string;
  description: Localized;
  sections: readonly ProfileSection[];
};

// Editorial allowlist. The Daily deck is deliberately not a source of public profiles.
const editorial: readonly ProfileEditorial[] = [
  {
    playerId: "henry",
    slug: "thierry-henry",
    description: languages(
      "Thierry Henry’s clubs in order, from Monaco to New York, with his Arsenal return, Barcelona treble and France career.",
      "Les clubs de Thierry Henry dans l’ordre, de Monaco à New York, avec son retour à Arsenal, le triplé du Barça et son parcours en Bleu.",
      "Los clubes de Thierry Henry en orden, de Mónaco a Nueva York, con su regreso al Arsenal, el triplete del Barça y su etapa con Francia.",
      "Thierry Henrys Vereine im Überblick, von Monaco bis New York, mit Arsenal-Rückkehr, Barça-Triple und seiner Laufbahn für Frankreich.",
    ),
    sections: [
      {
        title: languages("From Monaco to the France team", "De Monaco aux Bleus", "De Mónaco a la selección francesa", "Von Monaco zur französischen Nationalelf"),
        body: languages(
          "Henry came through at Monaco and was still at the club when France won the 1998 World Cup. He scored in the opening match against South Africa and played in several games before the final. His short spell at Juventus came the following year. He went on to win Euro 2000 and finished his France career with 51 goals in 123 appearances.",
          "Henry se révèle à Monaco, dont il porte encore les couleurs lors du Mondial 1998. Il marque dès le premier match des Bleus contre l’Afrique du Sud et joue plusieurs rencontres du tournoi. Son bref passage à la Juventus intervient l’année suivante. Il remporte ensuite l’Euro 2000 et termine sa carrière internationale avec 51 buts en 123 sélections.",
          "Henry se dio a conocer en el Mónaco y todavía jugaba allí cuando Francia ganó el Mundial de 1998. Marcó en el estreno ante Sudáfrica y disputó varios encuentros del torneo. Su breve paso por la Juventus llegó al año siguiente. Después ganó la Eurocopa de 2000 y cerró su etapa con Francia con 51 goles en 123 partidos.",
          "Henry schaffte in Monaco den Durchbruch. Als Frankreich 1998 Weltmeister wurde, stand er noch dort unter Vertrag. Gleich im Auftaktspiel gegen Südafrika traf er und kam im Turnier mehrfach zum Einsatz. Im folgenden Jahr spielte er kurz für Juventus. Mit Frankreich gewann er auch die EM 2000 und erzielte insgesamt 51 Tore in 123 Länderspielen.",
        ),
        source: { name: "Fédération française de football", url: "https://www.fff.fr/equipe-nationale/joueur/9809-henry-thierry/fiche.html" },
      },
      {
        title: languages("Arsenal and the unbeaten season", "Arsenal et la saison sans défaite", "El Arsenal de la temporada invicta", "Arsenals Saison ohne Niederlage"),
        body: languages(
          "Arsène Wenger brought Henry to Arsenal in 1999. It took eight games before he scored, but he ended his first season with 26 goals. His long first spell also included the 2003/04 league title, when Arsenal went unbeaten across the entire Premier League season. That context makes the brief 2012 return easier to place in the timeline.",
          "Arsène Wenger fait venir Henry à Arsenal en 1999. Le Français reste muet lors de ses huit premiers matches, puis termine sa première saison avec 26 buts. Il participe au titre de 2003-2004, remporté sans perdre un seul match de Premier League. Ce premier passage de huit ans explique la place à part de son retour, beaucoup plus court, en 2012.",
          "Arsène Wenger llevó a Henry al Arsenal en 1999. El francés tardó ocho partidos en marcar, pero cerró su primera campaña con 26 goles. En la temporada 2003/04, los londinenses se proclamaron campeones sin perder un solo encuentro de la Premier League. Aquellos ocho años dan contexto al breve regreso del delantero en 2012.",
          "Arsène Wenger holte Henry 1999 zu Arsenal. In seinen ersten acht Spielen blieb der Franzose ohne Treffer, am Ende seiner Debütsaison standen 26 Tore. In der Meistersaison 2003/04 blieb Arsenal in der gesamten Premier League ungeschlagen. Auf diesen ersten, acht Jahre langen Abschnitt folgte 2012 ein wesentlich kürzeres Wiedersehen.",
        ),
        source: { name: "Arsenal FC · The Wenger Years", url: "https://www.arsenal.com/feature/the-wenger-years-a05Ex7F5N6vd" },
      },
      {
        title: languages("The treble in Barcelona", "Le triplé avec le Barça", "El triplete con el Barça", "Das Triple mit Barcelona"),
        body: languages(
          "Barcelona signed Henry from Arsenal in 2007. In his second season the club won La Liga, the Copa del Rey and the Champions League. His two goals in the 6–2 win at Real Madrid offer a concrete snapshot of that campaign. By the summer of 2010, the next club in his career was in Major League Soccer.",
          "Henry rejoint Barcelone en 2007. Dès sa deuxième saison, le club remporte le championnat, la Coupe du Roi et la Ligue des champions. Son doublé lors du 6–2 au Santiago Bernabéu reste un repère de cette campagne. L’été 2010 marque un nouveau changement de championnat, cette fois vers la MLS.",
          "Henry fichó por el Barcelona en 2007. En su segunda temporada, el equipo ganó la Liga, la Copa del Rey y la Liga de Campeones. El francés marcó dos goles en el 6–2 del Santiago Bernabéu, uno de los partidos que mejor sitúan aquella campaña. En el verano de 2010 cambió de campeonato y se marchó a la MLS.",
          "2007 wechselte Henry nach Barcelona. Schon in seiner zweiten Saison gewann der Klub die spanische Meisterschaft, den Pokal und die Champions League. Henrys zwei Treffer beim 6:2 im Santiago Bernabéu stehen für diese Spielzeit. Im Sommer 2010 führte ihn der nächste Vereinswechsel in die Major League Soccer.",
        ),
        source: { name: "FC Barcelona · 2007–2010", url: "https://www.fcbarcelona.com/en/news/755613/ten-years-since-the-arrival-of-thierry-henry-at-fc-barcelona" },
      },
      {
        title: languages("New York and the 2012 loan", "New York et le prêt de 2012", "Nueva York y la cesión de 2012", "New York und die Leihe 2012"),
        body: languages(
          "Henry signed for the New York Red Bulls in July 2010. During the MLS off-season he returned to Arsenal for a short loan, which is why Arsenal appears a second time in his career. He then resumed his New York spell and helped the club win the 2013 Supporters’ Shield. His last MLS season was 2014.",
          "Henry signe aux New York Red Bulls en juillet 2010. Durant l’intersaison de MLS, il revient brièvement à Arsenal en prêt. C’est ce détour qui explique la deuxième apparition du club londonien dans la chronologie. De retour à New York, il contribue au Supporters’ Shield de 2013 et dispute sa dernière saison de MLS en 2014.",
          "Henry firmó por los New York Red Bulls en julio de 2010. Durante el parón de la MLS volvió cedido al Arsenal por un breve periodo. De ahí que el club londinense aparezca dos veces en su trayectoria. Ya de vuelta en Nueva York, contribuyó al Supporters’ Shield de 2013 y disputó su última temporada en la MLS en 2014.",
          "Im Juli 2010 unterschrieb Henry bei den New York Red Bulls. Während der MLS-Pause kehrte er für eine kurze Leihe zu Arsenal zurück. Daher taucht der Londoner Klub zweimal in seiner Laufbahn auf. Anschließend spielte Henry wieder in New York, gewann mit dem Team 2013 den Supporters’ Shield und bestritt 2014 seine letzte MLS-Saison.",
        ),
        source: { name: "New York Red Bulls · 2010–2014", url: "https://www.newyorkredbulls.com/players/thierry-henry/" },
      },
    ],
  },
  {
    playerId: "klose",
    slug: "miroslav-klose",
    description: languages(
      "Miroslav Klose’s career in order, from Homburg to Lazio via Kaiserslautern, Bremen and Bayern, plus his 16 World Cup goals.",
      "Les clubs de Miroslav Klose, de Homburg à la Lazio via Kaiserslautern, Brême et le Bayern, et ses 16 buts en Coupe du monde.",
      "Los clubes de Miroslav Klose, del Homburg a la Lazio pasando por Kaiserslautern, Bremen y Bayern, y sus 16 goles en Mundiales.",
      "Miroslav Kloses Vereine von Homburg bis Lazio über Kaiserslautern, Werder und Bayern sowie seine 16 WM-Tore im Überblick.",
    ),
    sections: [
      {
        title: languages("From Homburg to the Bundesliga", "De Homburg à la Bundesliga", "Del Homburg a la Bundesliga", "Von Homburg in die Bundesliga"),
        body: languages(
          "Klose’s route to the top ran through lower-division football. After Homburg, he joined Kaiserslautern and played for the reserves before breaking into the first team. His first Bundesliga goal came against Werder Bremen at the age of 22. The opposition is a useful detail to remember, because Bremen was also his next club.",
          "Klose passe par les divisions inférieures avant de jouer en Bundesliga. Après Homburg, il rejoint Kaiserslautern et évolue d’abord en réserve avant de s’imposer en équipe première. À 22 ans, il marque son premier but dans l’élite contre le Werder Brême, le club qui l’accueille ensuite.",
          "El camino de Klose hacia la élite pasó por las categorías inferiores. Tras jugar en el Homburg, llegó al Kaiserslautern y pasó por su filial antes de consolidarse en el primer equipo. Marcó su primer gol en la Bundesliga a los 22 años ante el Werder Bremen, que acabaría siendo su siguiente club.",
          "Kloses Weg in die Bundesliga führte durch die unteren Ligen. Nach seiner Zeit in Homburg spielte er zunächst für die Reserve des 1. FC Kaiserslautern, bevor er in die erste Mannschaft aufrückte. Mit 22 erzielte er sein erstes Bundesligator ausgerechnet gegen Werder Bremen, seinen späteren Verein.",
        ),
        source: { name: "Bundesliga · Kaiserslautern, Werder, Bayern", url: "https://www.bundesliga.com/en/bundesliga/news/miroslav-klose-germany-fifa-world-cup-legend-bayern-munich-lazio-werder-bremen-17848/" },
      },
      {
        title: languages("A scoring peak at Werder", "Ses 25 buts avec le Werder", "Los 25 goles con el Werder", "25 Tore für Werder"),
        body: languages(
          "The highest-scoring Bundesliga season of Klose’s career came at Werder Bremen. His 25 league goals in 2005/06 earned him the scoring title. He moved to Bayern Munich in 2007 and won two league and cup doubles there. The two clubs mark different peaks in the timeline: an individual scoring title in Bremen and domestic doubles in Munich.",
          "C’est au Werder Brême que Klose signe sa saison la plus prolifique en Bundesliga. Avec 25 buts en 2005-2006, il finit meilleur buteur du championnat. Il rejoint le Bayern Munich en 2007 et y remporte deux doublés championnat-coupe. Brême correspond donc à son sommet individuel en championnat et Munich à ses doublés nationaux.",
          "Klose firmó su mejor campaña goleadora en la Bundesliga con el Werder Bremen. Sus 25 tantos en la temporada 2005/06 le valieron el título de máximo goleador. En 2007 pasó al Bayern de Múnich, donde ganó dos dobletes de liga y copa. Bremen marca su pico goleador en liga y Múnich, sus dobletes nacionales.",
          "Seine beste Bundesligasaison als Torschütze hatte Klose bei Werder Bremen. Mit 25 Treffern wurde er 2005/06 Torschützenkönig. 2007 wechselte er zum FC Bayern, mit dem er zweimal Meisterschaft und DFB-Pokal in derselben Saison gewann. Bremen steht in seiner Laufbahn für die Torjägerkrone, München für die beiden Doubles.",
        ),
        source: { name: "Bundesliga · Torjägerkanone", url: "https://www.bundesliga.com/en/bundesliga/news/miroslav-klose-germany-fifa-world-cup-legend-bayern-munich-lazio-werder-bremen-17848/" },
      },
      {
        title: languages("Five seasons with Lazio", "Cinq saisons à la Lazio", "Cinco temporadas en la Lazio", "Fünf Spielzeiten bei Lazio"),
        body: languages(
          "Klose left Bayern for Lazio in 2011. His only senior club spell outside Germany brought an Italian Cup in 2013. He was a Lazio player when Germany won the 2014 World Cup, and his club career continued in Rome after he retired from international football. He finished playing in 2016.",
          "En 2011, Klose quitte le Bayern pour la Lazio. Son seul passage en équipe première hors d’Allemagne lui apporte une Coupe d’Italie en 2013. Il joue toujours à Rome quand l’Allemagne remporte le Mondial 2014. Sa retraite internationale ne marque donc pas la fin de sa carrière en club, qu’il poursuit jusqu’en 2016.",
          "Klose dejó el Bayern por la Lazio en 2011. En su única etapa con un primer equipo fuera de Alemania conquistó la Copa de Italia de 2013. Todavía jugaba en Roma cuando Alemania ganó el Mundial de 2014. Tras despedirse de la selección continuó en la Lazio hasta el final de su carrera en 2016.",
          "2011 wechselte Klose vom FC Bayern zu Lazio Rom. Bei seiner einzigen Station im Ausland gewann er 2013 den italienischen Pokal. Beim WM-Titel 2014 stand er bei Lazio unter Vertrag. Nach dem Abschied aus der Nationalmannschaft spielte er in Rom weiter, bis er 2016 seine Laufbahn als Spieler beendete.",
        ),
        source: { name: "FIFA · Lazio und Karriereende", url: "https://inside.fifa.com/de/news/wm-rekordtorschutze-klose-beendet-karriere-2847438" },
      },
      {
        title: languages("Sixteen goals across four World Cups", "Seize buts en quatre Coupes du monde", "Dieciséis goles en cuatro Mundiales", "16 Tore bei vier Weltmeisterschaften"),
        body: languages(
          "Klose scored five times at the 2002 World Cup and five more at the 2006 edition, when he won the Golden Boot. Four goals in 2010 took his total to 14. His 16th came in the 7–1 semi-final against Brazil in 2014. Germany went on to win the title, the last tournament of his international playing career.",
          "Klose marque cinq fois au Mondial 2002, puis cinq fois en 2006, où il reçoit le Soulier d’or. Ses quatre buts de 2010 portent son total à 14. Le seizième arrive en demi-finale en 2014, lors du 7–1 contre le Brésil. L’Allemagne remporte ensuite le titre, pour le dernier tournoi de sa carrière en sélection.",
          "Klose marcó cinco goles en el Mundial de 2002 y otros cinco en el de 2006, en el que ganó la Bota de Oro. Con cuatro más en 2010 llegó a 14. El decimosexto llegó en la semifinal de 2014, en el 7–1 ante Brasil. Alemania terminó campeona en el último torneo de Klose con su selección.",
          "Bei den Weltmeisterschaften 2002 und 2006 erzielte Klose jeweils fünf Tore. 2006 reichte das zum Goldenen Schuh. Vier weitere Treffer 2010 brachten ihn auf 14. Sein 16. WM-Tor fiel 2014 beim 7:1 im Halbfinale gegen Brasilien. In seinem letzten Turnier für die Nationalelf wurde er anschließend Weltmeister.",
        ),
        source: { name: "FIFA · 16 World Cup goals", url: "https://www.fifa.com/en/articles/watch-miroslav-klose-goals-record" },
      },
    ],
  },
];

export const footballProfiles = editorial.map(profile => {
  const player = footballPlayers.find(entry => entry.id === profile.playerId);
  if (!player) throw new Error(`Unknown Practice footballer: ${profile.playerId}`);
  return {
    slug: profile.slug,
    name: player.name,
    clubs: player.clubs,
    description: profile.description,
    sections: profile.sections,
  };
});

export type FootballProfile = (typeof footballProfiles)[number];

export function resolveFootballProfile(locale: Locale, segments: readonly string[]) {
  if (segments.length !== 2 || segments[0] !== footballProfileSection[locale]) return undefined;
  return footballProfiles.find(profile => profile.slug === segments[1]);
}
