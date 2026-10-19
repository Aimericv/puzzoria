import type { Locale } from "./types";
import { nt } from "./new-games-i18n";
const titles: Record<Locale, string[]> = {
  fr: [
    "2048 gratuit en ligne : jeu classique illimité",
    "Démineur gratuit : grilles logiques à trois niveaux",
    "Mots mêlés gratuits en ligne : grilles à thème",
  ],
  en: [
    "Free 2048 online: unlimited classic game",
    "Free Minesweeper: logical puzzles at three levels",
    "Free word search online: unlimited themed puzzles",
  ],
  es: [
    "2048 gratis en línea: juego clásico sin límite",
    "Buscaminas gratis: tableros lógicos de tres niveles",
    "Sopa de letras gratis: cuadrículas temáticas",
  ],
  de: [
    "2048 kostenlos online: unbegrenzt klassisch spielen",
    "Minesweeper kostenlos: logische Rätsel in drei Stufen",
    "Wortsuche kostenlos: unbegrenzte Themenrätsel",
  ],
};
const detail: Record<Locale, string[][]> = {
  fr: [
    [
      "Fusionner les tuiles",
      "Une tuile peut fusionner une seule fois pendant un déplacement. Le score augmente de la valeur de chaque fusion. Un mouvement qui ne change rien ne consomme aucun coup. La partie se termine quand aucun déplacement n’est possible.",
      "2048 classique sans limite de coups",
      "Chaque nouvelle partie propose un nouveau départ. Jouez sans limite de coups, essayez d’atteindre 2048 et continuez ensuite si vous le souhaitez. Vous pouvez terminer pour enregistrer votre score et suivre votre record personnel.",
      "Une stratégie pour progresser",
      "Conservez votre plus grande tuile dans un coin et rangez les autres par taille. Évitez de remplir les seize cases : laisser de l’espace permet de préparer les fusions. Les flèches du clavier, les boutons de direction et les gestes tactiles sont disponibles.",
    ],
    [
      "Comprendre les chiffres",
      "Chaque chiffre compte les mines dans les huit cases voisines, diagonales comprises. Un zéro ouvre les cases sûres autour de lui. Pour gagner, il faut révéler toutes les cases sans mine ; les drapeaux sont des repères et ne suffisent pas à valider une victoire.",
      "Un départ sûr, sans deviner",
      "La première case est imposée et entourée de cases sans mine. Un solveur vérifie que la grille peut se terminer par déductions, avec les chiffres visibles et les relations entre groupes de cases. Le puzzle et le départ sont identiques pour un défi entre amis.",
      "Choisir sa difficulté",
      "Facile : 9 × 9 cases et 10 mines. Moyen : 12 × 12 et 24 mines. Difficile : 16 × 16 et 50 mines. Sur téléphone, utilisez le mode Drapeau ; les grandes grilles défilent dans leur cadre. Le clavier permet aussi de déplacer le curseur, de révéler et de poser un drapeau.",
    ],
    [
      "Huit mots autour d’un thème",
      "Les thèmes comprennent les animaux, la nature, la cuisine et l’espace. Chaque grille contient huit mots sélectionnés pour sa langue, et non une traduction automatique d’un puzzle anglais. Les mots de la liste sont tous présents dans les douze lignes et douze colonnes.",
      "Chercher dans les huit directions",
      "Un mot peut être horizontal, vertical ou diagonal, à l’endroit ou à l’envers. Glissez entre ses deux extrémités, ou sélectionnez-les avec deux touches. Au clavier, déplacez le curseur avec les flèches puis appuyez sur Entrée au début et à la fin du mot.",
      "Accents et progression",
      "Les grilles utilisent des lettres majuscules sans accent pour faciliter la sélection. En allemand, les trémas sont écrits AE, OE ou UE. Les mots trouvés restent marqués et sont sauvegardés. Générez une nouvelle grille à thème quand vous voulez, sans limite de parties.",
    ],
  ],
  en: [
    [
      "Merge equal tiles",
      "A tile merges only once in a move. Each merge adds its new value to your score. Moves that leave the board unchanged do not count. The game ends when none of the four directions can change the board.",
      "Classic 2048 without a move limit",
      "Each new game has a fresh starting board. Play without a move limit, try to reach 2048 and keep playing afterwards if you like. Finish to save your score and track your personal best.",
      "Build a stronger board",
      "Keep the largest tile in a corner and arrange nearby tiles in descending order. Preserve empty cells so you have room to prepare merges. Use keyboard arrows, direction buttons or touch swipes.",
    ],
    [
      "Read the neighbouring numbers",
      "Each number counts mines in the eight neighbouring cells, including diagonals. A zero opens nearby safe cells. Reveal every cell without a mine to win; flags are reminders and do not establish a victory by themselves.",
      "Safe start, logical solution",
      "The highlighted first cell and its neighbours contain no mines. A solver checks that the board can be completed through deductions from visible numbers and relationships between groups of cells. Friend challenges share both the minefield and the starting cell.",
      "Three board sizes",
      "Easy has 9 × 9 cells and 10 mines, medium 12 × 12 and 24 mines, hard 16 × 16 and 50 mines. On mobile use Flag mode; large boards scroll inside their frame. Keyboard navigation, reveal and flag controls are also available.",
    ],
    [
      "Eight words on a theme",
      "Themes include animals, nature, food and space. Each language has its own curated word lists rather than an automatically translated English puzzle. All eight listed words are placed inside a twelve-by-twelve grid.",
      "Search in eight directions",
      "Words run horizontally, vertically or diagonally, forwards or backwards. Drag between the two endpoints or tap them separately. On a keyboard, move with the arrows and press Enter at the beginning and end of a word.",
      "Letters and saved progress",
      "Grids use uppercase letters without accents. German umlauts are written AE, OE or UE. Found words remain highlighted and your progress is saved. Generate a fresh themed grid whenever you like, with no limit on the number of games.",
    ],
  ],
  es: [
    [
      "Combinar fichas iguales",
      "Una ficha se combina una sola vez por movimiento. Cada combinación suma su nuevo valor a la puntuación. Un movimiento que no cambia el tablero no cuenta. La partida termina cuando ninguna dirección permite mover fichas.",
      "2048 clásico sin límite de movimientos",
      "Cada partida empieza con un tablero nuevo. Juega sin límite de movimientos, intenta alcanzar 2048 y sigue si quieres. Termina para guardar la puntuación y seguir tu récord personal.",
      "Preparar mejores combinaciones",
      "Mantén la ficha mayor en una esquina y ordena las cercanas de mayor a menor. Conserva casillas vacías para preparar combinaciones. Usa flechas del teclado, botones de dirección o gestos táctiles.",
    ],
    [
      "Leer los números",
      "Cada número cuenta las minas en las ocho casillas vecinas, incluidas las diagonales. Un cero abre las casillas seguras cercanas. Descubre todas las casillas sin mina para ganar; las banderas son recordatorios y no validan una victoria por sí solas.",
      "Inicio seguro y solución lógica",
      "La primera casilla resaltada y sus vecinas no contienen minas. Un solucionador comprueba que el tablero se puede completar mediante deducciones basadas en números visibles y grupos de casillas. Los retos entre amigos comparten tablero y casilla inicial.",
      "Tres tamaños de tablero",
      "Fácil: 9 × 9 casillas y 10 minas. Medio: 12 × 12 y 24 minas. Difícil: 16 × 16 y 50 minas. En móvil usa el modo Bandera; los tableros grandes se desplazan dentro de su marco. También puedes navegar, descubrir y marcar con el teclado.",
    ],
    [
      "Ocho palabras de un tema",
      "Los temas incluyen animales, naturaleza, cocina y espacio. Cada idioma tiene listas seleccionadas, sin traducir automáticamente una cuadrícula inglesa. Las ocho palabras se encuentran dentro de una cuadrícula de doce filas y doce columnas.",
      "Buscar en ocho direcciones",
      "Las palabras aparecen en horizontal, vertical o diagonal, hacia delante o hacia atrás. Arrastra entre los extremos o tócalos por separado. Con el teclado, mueve el cursor con las flechas y pulsa Intro al principio y al final de una palabra.",
      "Letras y progreso guardado",
      "Las letras son mayúsculas sin tilde. En alemán, las diéresis se escriben AE, OE o UE. Las palabras encontradas quedan resaltadas y el progreso se guarda. Genera otra cuadrícula temática cuando quieras, sin límite de partidas.",
    ],
  ],
  de: [
    [
      "Gleiche Zahlen verbinden",
      "Ein Feld verschmilzt höchstens einmal pro Zug. Jede Verschmelzung addiert ihren neuen Wert zur Punktzahl. Züge ohne Änderung zählen nicht. Das Spiel endet, wenn keine der vier Richtungen mehr eine Änderung ermöglicht.",
      "Klassisches 2048 ohne Zuglimit",
      "Jede neue Runde beginnt mit einem neuen Spielfeld. Spiele ohne Zuglimit, erreiche 2048 und spiele auf Wunsch weiter. Beende die Runde, um deine Punkte zu speichern und deinen persönlichen Rekord zu verfolgen.",
      "Das Spielfeld ordnen",
      "Halte die größte Zahl in einer Ecke und ordne benachbarte Zahlen absteigend. Bewahre leere Felder, um weitere Verschmelzungen vorzubereiten. Nutze Pfeiltasten, Richtungsschaltflächen oder Wischgesten.",
    ],
    [
      "Die Zahlen verstehen",
      "Jede Zahl zählt Minen in den acht Nachbarfeldern, einschließlich der Diagonalen. Eine Null öffnet benachbarte sichere Felder. Decke alle Felder ohne Mine auf, um zu gewinnen. Flaggen dienen als Merkhilfe und reichen allein nicht zum Gewinnen.",
      "Sicherer Start und logische Lösung",
      "Das erste markierte Feld und seine Nachbarn sind minenfrei. Ein Löser prüft, ob sich das Feld durch sichtbare Zahlen und Beziehungen zwischen Feldgruppen vollständig logisch lösen lässt. Freundesaufgaben teilen sowohl Minenfeld als auch Startfeld.",
      "Drei Spielfeldgrößen",
      "Leicht: 9 × 9 Felder und 10 Minen. Mittel: 12 × 12 und 24 Minen. Schwer: 16 × 16 und 50 Minen. Auf dem Handy hilft der Flaggenmodus; große Felder lassen sich innerhalb ihres Rahmens verschieben. Navigation, Aufdecken und Markieren sind auch mit der Tastatur möglich.",
    ],
    [
      "Acht Wörter zu einem Thema",
      "Die Themen umfassen Tiere, Natur, Küche und Weltraum. Jede Sprache hat eigene ausgewählte Wortlisten statt automatisch übersetzter englischer Rätsel. Alle acht Wörter befinden sich im Raster mit zwölf Zeilen und zwölf Spalten.",
      "In acht Richtungen suchen",
      "Wörter verlaufen waagerecht, senkrecht oder diagonal, vorwärts und rückwärts. Ziehe zwischen den Endpunkten oder tippe sie einzeln an. Mit der Tastatur bewegst du den Cursor per Pfeiltaste und bestätigst Anfang und Ende mit Eingabe.",
      "Buchstaben und gespeicherter Fortschritt",
      "Das Raster verwendet Großbuchstaben ohne Akzente. Umlaute werden AE, OE oder UE geschrieben. Gefundene Wörter bleiben markiert und dein Fortschritt wird gespeichert. Erstelle jederzeit ein neues Themenrätsel, ohne Begrenzung der Rundenzahl.",
    ],
  ],
};
export function newGamesSeo(locale: Locale) {
  const m = nt(locale),
    keys = ["2048", "mines", "wordsearch"] as const;
  return Object.fromEntries(
    keys.map((key, i) => [
      key,
      {
        title: titles[locale][i],
        description:
          [m.tileDesc, m.minesDesc, m.searchDesc][i] +
          " " +
          (key === "mines"
            ? {
                fr: "Gratuit, sans inscription, sur mobile et ordinateur. Défi quotidien, jeu illimité et sauvegarde.",
                en: "Free, no signup needed, on mobile and desktop. Daily puzzles, unlimited play and saved progress.",
                es: "Gratis, sin registro, en móvil y ordenador. Retos diarios, juego sin límite y progreso guardado.",
                de: "Kostenlos ohne Anmeldung, auf Handy und Computer. Tagesaufgaben, unbegrenztes Spielen und gespeicherter Fortschritt.",
              }
            : {
                fr: "Gratuit, sans inscription, sur mobile et ordinateur. Jeu illimité et sauvegarde.",
                en: "Free, no signup needed, on mobile and desktop. Unlimited play and saved progress.",
                es: "Gratis, sin registro, en móvil y ordenador. Juego sin límite y progreso guardado.",
                de: "Kostenlos ohne Anmeldung, auf Handy und Computer. Unbegrenztes Spielen und gespeicherter Fortschritt.",
              })[locale],
        intro: [m.tileRules, m.minesRules, m.searchRules][i],
        sections: [0, 2, 4].map((n) => ({
          title: detail[locale][i][n],
          text: detail[locale][i][n + 1],
        })),
      },
    ]),
  ) as Record<
    (typeof keys)[number],
    {
      title: string;
      description: string;
      intro: string;
      sections: { title: string; text: string }[];
    }
  >;
}
