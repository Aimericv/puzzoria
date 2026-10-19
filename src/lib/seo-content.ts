import { rareWordSeo } from "./rare-word-seo";
import { newGamesSeo } from "./new-games-seo";
import { socialSeo } from "./social-seo";
import type { GameId, Locale } from "./types";
type GameCopy = {
  title: string;
  description: string;
  intro: string;
  sections: { title: string; text: string }[];
};
type SeoCopy = {
  homeTitle: string;
  homeDescription: string;
  homeHeading: string;
  homeBody: string;
  languages: string;
  noScript: string;
  games: Record<Extract<GameId, "word" | "sudoku" | "math">, GameCopy>;
};
const content: Record<Locale, SeoCopy> = {
  fr: {
    homeTitle: "Jeux de réflexion gratuits : Wordle, sudoku, 2048 | Puzzoria",
    homeDescription:
      "Wordle, sudoku, 2048, démineur, mots mêlés et calcul mental gratuits. Sans inscription, avec défis quotidiens, mode illimité et sauvegarde.",
    homeHeading: "Des jeux de réflexion gratuits, à votre rythme",
    homeBody:
      "Choisissez Wordle, sudoku, calcul mental, 2048, démineur ou mots mêlés. Un nouveau défi paraît chaque jour à minuit UTC ; le mode Illimité permet de rejouer autant que vous voulez. Vous pouvez jouer sans compte et retrouver vos parties sur cet appareil. Un compte facultatif permet de les reprendre sur un autre appareil.",
    languages: "Jouer dans une autre langue",
    noScript:
      "Activez JavaScript pour saisir vos réponses et sauvegarder la partie. Les règles et le défi restent consultables ci-dessous.",
    games: {
      word: {
        title: "Wordle français gratuit : le mot du jour de 5 lettres",
        description:
          "Trouvez un mot français de cinq lettres en six essais. Jouez gratuitement, sans inscription, avec les accents normalisés, un clavier tactile et un mode illimité.",
        intro:
          "Le Mot est un jeu de lettres au format Wordle : un mot français de cinq lettres, six essais et des couleurs pour guider vos propositions. Saisissez directement dans la grille, au clavier ou sur les touches à l'écran.",
        sections: [
          {
            title: "Comprendre les couleurs et les lettres répétées",
            text: "Le vert indique une lettre bien placée ; le jaune, une lettre présente ailleurs ; le gris, une lettre absente des positions encore disponibles. Un mot peut contenir deux fois la même lettre. Si votre proposition comporte deux E et qu'un seul reçoit du vert ou du jaune, le second E ne prouve pas qu'il existe une autre occurrence dans la réponse.",
          },
          {
            title: "Accents et mots acceptés",
            text: "É, È et Ê comptent comme E ; Ç comme C. Les propositions sont vérifiées dans un dictionnaire comprenant des mots courants et des formes conjuguées, comme ADULE. OUTIL est également accepté. Les mots à deviner sont sélectionnés séparément, en privilégiant les formes fréquentes. Cliquez sur une case de la ligne active pour corriger une lettre.",
          },
          {
            title: "Mot du jour, illimité et sauvegarde",
            text: "Le mot quotidien change à minuit UTC. Pour une nouvelle partie immédiate, choisissez Illimité ; les archives permettent de jouer les jours précédents. Ces modes conservent des historiques séparés. Vos essais sont sauvegardés sur cet appareil ; un compte facultatif permet la reprise sur un autre appareil.",
          },
        ],
      },
      sudoku: {
        title: "Sudoku quotidien gratuit et grilles illimitées",
        description:
          "Une grille de sudoku du jour identique pour tous, à solution unique. Jouez aussi en illimité à trois niveaux, avec notes et sauvegarde, sans inscription.",
        intro:
          "Résolvez une seule grille quotidienne commune à tous, renouvelée à minuit UTC. Pour continuer, le mode Illimité propose les niveaux facile, moyen et difficile. Chaque grille possède une solution unique vérifiée, avec notes, annulation et sauvegarde.",
        sections: [
          {
            title: "Les règles du sudoku",
            text: "Complétez la grille de 9 × 9 cases avec les chiffres de 1 à 9. Chaque ligne, chaque colonne et chaque carré de 3 × 3 doit contenir chaque chiffre une seule fois. Les chiffres donnés au départ ne peuvent pas être modifiés. Sélectionnez une case vide, puis utilisez les touches à l'écran ou votre clavier.",
          },
          {
            title: "Commencer avec les candidats",
            text: "Pour une case vide, retirez les chiffres déjà présents dans sa ligne, sa colonne et son carré. Si un seul candidat reste, vous pouvez le placer. Le mode Notes permet de conserver plusieurs possibilités sans remplir la case. L'affichage facultatif des conflits aide à repérer une répétition ; l'absence de conflit ne garantit pas que toute la grille est correcte.",
          },
          {
            title: "Choisir un niveau et reprendre sa grille",
            text: "Les niveaux changent les grilles et la quantité de chiffres initiaux ; ils ne constituent pas une mesure précise des techniques nécessaires. Le Quotidien propose une seule grille commune à tous. Les trois niveaux sont disponibles en Illimité. Le mode Illimité propose de nouvelles grilles, et les archives donnent accès aux jours précédents. Les notes et saisies sont sauvegardées. Le chronomètre peut être mis en pause.",
          },
        ],
      },
      math: {
        title: "Jeu de calcul mental gratuit : six nombres, une cible",
        description:
          "Atteignez une cible avec six nombres, les quatre opérations et des parenthèses. Un défi de calcul gratuit et atteignable, quotidien ou illimité, sans inscription.",
        intro:
          "Le Compte est un jeu de calcul mental : combinez les six nombres proposés pour vous rapprocher d'une cible. Chaque défi possède au moins une expression qui atteint exactement cette cible.",
        sections: [
          {
            title: "Les opérations autorisées",
            text: "Utilisez l'addition, la soustraction, la multiplication, la division et les parenthèses. Chaque nombre proposé est utilisable au maximum une fois ; deux nombres identiques sont deux occurrences distinctes. Vous n'êtes pas obligé de tous les utiliser. Chaque résultat intermédiaire doit être un entier strictement positif : une division avec reste, zéro ou un résultat négatif est refusé.",
          },
          {
            title: "Construire et vérifier son calcul",
            text: "Commencez par chercher un produit proche de la cible, puis ajustez avec une addition ou une soustraction. Les parenthèses permettent de choisir l'ordre des opérations. Vous pouvez cliquer sur les nombres et les opérateurs ou écrire l'expression. Vérifier le calcul affiche sa valeur et le score prévu ; Terminer le défi enregistre le résultat final.",
          },
          {
            title: "Score et nouvelles parties",
            text: "Le score part de 1 000 points, retire 20 points par unité d'écart avec la cible et 25 points par opération au-delà de trois. Il ne descend pas sous zéro. Après la fin de partie, une expression de référence est disponible ; elle n'est pas forcément la plus courte. Jouez au défi quotidien, en Illimité ou dans les archives, avec une progression sauvegardée.",
          },
        ],
      },
    },
  },
  en: {
    homeTitle: "Free puzzle games: Wordle, Sudoku and 2048 | Puzzoria",
    homeDescription:
      "Play Wordle, Sudoku, 2048, Minesweeper, word search and number puzzles for free. No signup needed, with daily challenges, unlimited play and saved progress.",
    homeHeading: "Free brain puzzles, at your own pace",
    homeBody:
      "Choose Wordle, Sudoku, numbers, 2048, Minesweeper or word search. New daily puzzles arrive at midnight UTC, while Unlimited lets you play again whenever you like. Play without an account and keep your progress on this device. An optional account lets you continue on another device.",
    languages: "Play in another language",
    noScript:
      "Enable JavaScript to enter answers and save your game. You can still read the rules and view the puzzle below.",
    games: {
      word: {
        title: "Free daily word game: a five-letter Wordle-style puzzle",
        description:
          "Guess the five-letter English word in six attempts. Play free without an account, with an on-screen keyboard, saved guesses and unlimited practice.",
        intro:
          "Word is a Wordle-style puzzle with a five-letter English answer, six guesses and coloured feedback. Type directly into the grid or use the on-screen keyboard.",
        sections: [
          {
            title: "Colours and repeated letters",
            text: "Green means the letter is in the right position, yellow means it belongs elsewhere, and grey means it does not fill any remaining position. The answer can repeat a letter. If you guess two Es but only one receives green or yellow, the second E does not establish that the answer contains another E.",
          },
          {
            title: "Words and editing your guess",
            text: "Your guesses are checked against a dictionary that includes common words and inflected forms. Possible answers use a separate selection that favours frequent words. Accents are normalised to plain letters. Click a square in the current row to replace a letter, or use the arrow keys, Backspace and Delete to edit before submitting.",
          },
          {
            title: "Daily, Unlimited and saved progress",
            text: "The daily answer changes at midnight UTC. Choose Unlimited for a new puzzle immediately, or the archive for a previous date. These modes keep separate histories. Your guesses are saved on this device, and an optional account lets you continue on another device.",
          },
        ],
      },
      sudoku: {
        title: "Free daily Sudoku and unlimited puzzles",
        description:
          "One daily Sudoku shared by everyone, with a unique solution. Play unlimited puzzles at three levels, with pencil notes and saved progress. No signup needed.",
        intro:
          "Solve one daily grid shared by everyone, refreshed at midnight UTC. Keep playing in Unlimited with easy, medium and hard levels. Every grid has a verified unique solution, pencil notes, undo and saved progress.",
        sections: [
          {
            title: "Sudoku rules",
            text: "Fill the 9 × 9 grid with digits from 1 to 9. Each row, column and 3 × 3 box must contain every digit exactly once. Starting clues cannot be changed. Select an empty square and enter a digit using the on-screen keys or your keyboard.",
          },
          {
            title: "Find candidates before guessing",
            text: "For an empty square, remove the digits already present in its row, column and box. If one candidate remains, it can be placed. Notes let you keep several possibilities without filling the square. Optional conflict highlighting can reveal repeated digits; having no highlighted conflict does not prove that the completed grid is correct.",
          },
          {
            title: "Levels and saved puzzles",
            text: "Levels use different grids and amounts of starting clues; they are not a precise rating of required solving techniques. Daily has one shared puzzle for everyone. The three levels are available in Unlimited. Unlimited generates fresh grids, and the archive offers earlier days. Entries and notes are saved, and you can pause the timer.",
          },
        ],
      },
      math: {
        title: "Free number puzzle: six numbers, one target",
        description:
          "Reach a target using six numbers, arithmetic and parentheses. Free daily and unlimited maths puzzles with a reachable target and no account required.",
        intro:
          "Numbers is an arithmetic puzzle: combine the six supplied numbers to reach a target. Every generated puzzle has at least one expression that reaches that target exactly.",
        sections: [
          {
            title: "Allowed operations",
            text: "Use addition, subtraction, multiplication, division and parentheses. Each supplied number can be used at most once; repeated values count as separate occurrences. You do not have to use all six. Every intermediate result must be a positive whole number: a remainder, zero or a negative result is rejected.",
          },
          {
            title: "Build and check an expression",
            text: "Look for a product near the target, then adjust it with addition or subtraction. Parentheses let you choose the order of operations. Click the numbers and operators or type an expression. Checking shows its value and estimated score; finishing the puzzle saves your final result.",
          },
          {
            title: "Scoring and another puzzle",
            text: "The score starts at 1,000 points, subtracts 20 per unit away from the target and 25 per operation beyond three, with a minimum of zero. A reference expression becomes available after finishing, although it may not be the shortest solution. Play Daily, Unlimited or an archived puzzle and keep your saved progress.",
          },
        ],
      },
    },
  },
  es: {
    homeTitle: "Juegos gratis: Wordle, sudoku y 2048 | Puzzoria",
    homeDescription:
      "Juega a Wordle, sudoku, 2048, buscaminas, sopa de letras y cálculo. Gratis y sin registro, con retos diarios, modo ilimitado y progreso guardado.",
    homeHeading: "Juegos de lógica gratuitos, a tu ritmo",
    homeBody:
      "Elige Wordle, sudoku, cálculo, 2048, buscaminas o sopa de letras. Los retos diarios cambian a medianoche UTC; el modo Ilimitado permite volver a jugar cuando quieras. Puedes jugar sin cuenta y guardar el progreso en este dispositivo. Una cuenta opcional permite continuar en otro dispositivo.",
    languages: "Jugar en otro idioma",
    noScript:
      "Activa JavaScript para introducir respuestas y guardar la partida. Puedes consultar las reglas y el reto a continuación.",
    games: {
      word: {
        title: "Wordle en español gratis: palabra diaria de cinco letras",
        description:
          "Adivina una palabra de cinco letras en seis intentos. Juego gratis sin registro, con teclado en pantalla, letras sin tildes, progreso guardado y modo ilimitado.",
        intro:
          "Palabra es un juego de tipo Wordle: una palabra española de cinco letras, seis intentos y colores que orientan tus propuestas. Escribe directamente en las casillas o utiliza el teclado en pantalla.",
        sections: [
          {
            title: "Colores y letras repetidas",
            text: "El verde señala una letra bien colocada; el amarillo, una letra que está en otra posición; el gris, una letra que no ocupa ninguna posición restante. La solución puede repetir letras. Si propones dos E y solo una aparece verde o amarilla, la segunda no confirma que exista otra E en la respuesta.",
          },
          {
            title: "Tildes, palabras y correcciones",
            text: "Las letras acentuadas se normalizan a su forma simple. El diccionario de propuestas incluye palabras frecuentes y formas flexionadas; las respuestas pertenecen a otra selección que prioriza palabras comunes. Haz clic en una casilla de la fila actual para reemplazar una letra o utiliza las flechas y las teclas de borrado antes de validar.",
          },
          {
            title: "Reto diario y modo ilimitado",
            text: "La palabra diaria cambia a medianoche UTC. El modo Ilimitado ofrece otra partida inmediatamente y el archivo permite jugar fechas anteriores. Estos modos tienen historiales separados. Los intentos se guardan en este dispositivo; con una cuenta opcional puedes continuar en otro.",
          },
        ],
      },
      sudoku: {
        title: "Sudoku diario gratis y cuadrículas ilimitadas",
        description:
          "Un sudoku diario igual para todos, con solución única. Juega también sin límite en tres niveles, con notas y progreso guardado, sin registro.",
        intro:
          "Resuelve una única cuadrícula diaria compartida por todos, que cambia a medianoche UTC. Continúa en el modo ilimitado con niveles fácil, medio y difícil. Cada cuadrícula tiene una solución única verificada, notas, deshacer y progreso guardado.",
        sections: [
          {
            title: "Reglas del sudoku",
            text: "Completa la cuadrícula de 9 × 9 con los números del 1 al 9. Cada fila, columna y bloque de 3 × 3 debe contener cada número una sola vez. Las pistas iniciales no se pueden cambiar. Selecciona una casilla vacía y escribe un número con tu teclado o con los botones en pantalla.",
          },
          {
            title: "Encontrar candidatos",
            text: "Para una casilla vacía, descarta los números que ya aparecen en su fila, columna y bloque. Si queda un solo candidato, puedes colocarlo. Las notas guardan varias posibilidades sin completar la casilla. El aviso opcional de conflictos detecta repeticiones; que no haya conflictos visibles no garantiza que toda la cuadrícula sea correcta.",
          },
          {
            title: "Niveles y partidas guardadas",
            text: "Los niveles usan cuadrículas y cantidades de pistas diferentes; no son una clasificación exacta de las técnicas necesarias. El modo diario ofrece una única cuadrícula compartida. Los tres niveles están disponibles en Ilimitado. Ilimitado genera nuevas cuadrículas y el archivo ofrece días anteriores. Se guardan las entradas y notas, y puedes pausar el cronómetro.",
          },
        ],
      },
      math: {
        title: "Juego de cálculo gratis: seis números y una cifra objetivo",
        description:
          "Alcanza una cifra con seis números, las cuatro operaciones y paréntesis. Retos de cálculo diarios e ilimitados con objetivo alcanzable, gratis y sin cuenta.",
        intro:
          "Números es un juego de cálculo: combina los seis números disponibles para alcanzar una cifra objetivo. Cada reto generado tiene al menos una expresión que llega exactamente a esa cifra.",
        sections: [
          {
            title: "Operaciones permitidas",
            text: "Utiliza suma, resta, multiplicación, división y paréntesis. Cada número disponible puede utilizarse como máximo una vez; dos valores iguales cuentan como dos apariciones distintas. No necesitas usar los seis. Todos los resultados intermedios deben ser enteros positivos: se rechazan las divisiones con resto, el cero y los resultados negativos.",
          },
          {
            title: "Construir y comprobar el cálculo",
            text: "Busca un producto cercano al objetivo y ajústalo con una suma o resta. Los paréntesis permiten elegir el orden de las operaciones. Puedes pulsar los números y operadores o escribir la expresión. Comprobar muestra su valor y puntuación prevista; terminar guarda el resultado final.",
          },
          {
            title: "Puntuación y nuevas partidas",
            text: "La puntuación parte de 1.000 puntos, resta 20 por unidad de distancia al objetivo y 25 por operación a partir de la cuarta, sin bajar de cero. Al terminar se muestra una expresión de referencia, que no siempre es la más corta. Puedes jugar el reto diario, en Ilimitado o en el archivo, con progreso guardado.",
          },
        ],
      },
    },
  },
  de: {
    homeTitle: "Kostenlose Rätsel: Wordle, Sudoku und 2048 | Puzzoria",
    homeDescription:
      "Wordle, Sudoku, 2048, Minesweeper, Wortsuche und Rechnen kostenlos. Ohne Anmeldung, mit Tagesrätseln, unbegrenztem Spielen und gespeichertem Fortschritt.",
    homeHeading: "Kostenlose Denkspiele in deinem Tempo",
    homeBody:
      "Wähle Wordle, Sudoku, Rechenrätsel, 2048, Minesweeper oder Wortsuche. Neue Tagesrätsel erscheinen um Mitternacht UTC; im Modus Unbegrenzt kannst du jederzeit weiterspielen. Ohne Konto bleibt dein Fortschritt auf diesem Gerät gespeichert. Ein optionales Konto ermöglicht die Fortsetzung auf einem anderen Gerät.",
    languages: "In einer anderen Sprache spielen",
    noScript:
      "Aktiviere JavaScript, um Antworten einzugeben und das Spiel zu speichern. Regeln und Rätsel kannst du unten weiterhin ansehen.",
    games: {
      word: {
        title: "Wordle auf Deutsch: kostenloses Wortspiel mit fünf Buchstaben",
        description:
          "Errate ein deutsches Wort mit fünf Buchstaben in sechs Versuchen. Kostenlos ohne Anmeldung, mit Bildschirmtastatur, gespeicherten Versuchen und unbegrenzten Rätseln.",
        intro:
          "Wort ist ein Rätsel im Wordle-Format: ein deutsches Wort mit fünf Buchstaben, sechs Versuche und farbige Hinweise. Schreibe direkt in die Felder oder nutze die Bildschirmtastatur.",
        sections: [
          {
            title: "Farben und wiederholte Buchstaben",
            text: "Grün bedeutet die richtige Position, Gelb eine andere Position und Grau, dass der Buchstabe keine verbleibende Stelle belegt. Ein Wort kann einen Buchstaben mehrfach enthalten. Wenn du zwei E eingibst, aber nur eines grün oder gelb wird, weist das zweite E nicht auf ein weiteres Vorkommen in der Lösung hin.",
          },
          {
            title: "Schreibweise und Eingaben ändern",
            text: "Akzente und Umlaute werden auf ihren Grundbuchstaben reduziert: Ä zählt als A, Ö als O und Ü als U. ß bleibt ein einzelner Buchstabe. Das Wörterbuch für Vorschläge enthält auch gebeugte Formen; die möglichen Lösungen stammen aus einer separaten Auswahl häufiger Wörter. Klicke auf ein Feld der aktiven Zeile, um einen Buchstaben zu ersetzen.",
          },
          {
            title: "Tagesrätsel und unbegrenztes Spielen",
            text: "Das Tageswort wechselt um Mitternacht UTC. Unbegrenzt startet sofort ein neues Rätsel; im Archiv findest du vergangene Tage. Diese Modi haben getrennte Verläufe. Deine Versuche werden auf diesem Gerät gespeichert. Mit einem optionalen Konto kannst du auf einem anderen Gerät weiterspielen.",
          },
        ],
      },
      sudoku: {
        title: "Sudoku kostenlos: Tagesrätsel und unbegrenzte Spiele",
        description:
          "Ein tägliches Sudoku für alle mit eindeutiger Lösung. Spiele unbegrenzt in drei Stufen, mit Notizen und gespeichertem Fortschritt. Ohne Anmeldung.",
        intro:
          "Löse ein tägliches Sudoku, das für alle gleich ist und um Mitternacht UTC wechselt. Spiele anschließend unbegrenzt auf leichter, mittlerer oder schwerer Stufe. Jede Lösung wird auf Eindeutigkeit geprüft; Notizen, Rückgängig und gespeicherter Fortschritt sind verfügbar.",
        sections: [
          {
            title: "Sudoku-Regeln",
            text: "Fülle das 9 × 9-Gitter mit den Ziffern 1 bis 9. Jede Zeile, Spalte und jeder 3 × 3-Block muss jede Ziffer genau einmal enthalten. Vorgegebene Zahlen bleiben unverändert. Wähle ein leeres Feld und gib eine Zahl über die Bildschirmtasten oder deine Tastatur ein.",
          },
          {
            title: "Kandidaten finden",
            text: "Streiche für ein leeres Feld die Zahlen, die bereits in seiner Zeile, Spalte und seinem Block stehen. Bleibt genau ein Kandidat, kannst du ihn einsetzen. Notizen halten mehrere Möglichkeiten fest, ohne das Feld auszufüllen. Die optionale Konfliktanzeige erkennt Wiederholungen; fehlende Konflikte beweisen noch keine korrekte Gesamtlösung.",
          },
          {
            title: "Stufen und gespeicherte Spiele",
            text: "Die Stufen verwenden unterschiedliche Gitter und Anzahlen vorgegebener Zahlen; sie bewerten die benötigten Lösungstechniken nicht genau. Das Tagesrätsel ist ein einziges gemeinsames Gitter. Die drei Stufen gibt es im unbegrenzten Modus. Unbegrenzt erzeugt neue Gitter, das Archiv bietet frühere Tage. Eingaben und Notizen werden gespeichert, und die Uhr lässt sich pausieren.",
          },
        ],
      },
      math: {
        title: "Kostenloses Rechenrätsel: sechs Zahlen, eine Zielzahl",
        description:
          "Erreiche eine Zielzahl mit sechs Zahlen, den Grundrechenarten und Klammern. Kostenlose Tagesrätsel und unbegrenzte Aufgaben mit erreichbarem Ziel, ohne Anmeldung.",
        intro:
          "Zahlen ist ein Rechenrätsel: Kombiniere die sechs vorgegebenen Zahlen, um eine Zielzahl zu erreichen. Für jedes erzeugte Rätsel existiert mindestens ein Ausdruck, der diese Zielzahl genau trifft.",
        sections: [
          {
            title: "Erlaubte Rechenoperationen",
            text: "Nutze Addition, Subtraktion, Multiplikation, Division und Klammern. Jede vorgegebene Zahl darf höchstens einmal verwendet werden; gleiche Werte zählen als getrennte Vorkommen. Du musst nicht alle sechs verwenden. Jedes Zwischenergebnis muss eine positive ganze Zahl sein: Divisionen mit Rest, null und negative Ergebnisse werden abgelehnt.",
          },
          {
            title: "Einen Ausdruck aufbauen und prüfen",
            text: "Suche ein Produkt nahe der Zielzahl und passe es durch Addition oder Subtraktion an. Klammern bestimmen die Reihenfolge der Rechnung. Klicke auf Zahlen und Operatoren oder tippe einen Ausdruck. Prüfen zeigt Wert und voraussichtliche Punkte; beim Abschließen wird das endgültige Ergebnis gespeichert.",
          },
          {
            title: "Punkte und weitere Rätsel",
            text: "Die Wertung beginnt bei 1.000 Punkten. Pro Einheit Abstand zur Zielzahl werden 20 Punkte und pro Rechenschritt nach dem dritten 25 Punkte abgezogen, jedoch nicht unter null. Nach Abschluss erscheint ein Beispielausdruck, der nicht immer die kürzeste Lösung ist. Spiele täglich, unbegrenzt oder im Archiv mit gespeichertem Fortschritt.",
          },
        ],
      },
    },
  },
};
export const seoCopy = (locale: Locale) => ({
  ...content[locale],
  homeDescription: {
    fr: "Jeux gratuits : Wordle, sudoku, 2048, démineur, mots mêlés, classement à l’aveugle et Tu préfères. Défis quotidiens, illimités et entre amis.",
    en: "Free Wordle, Sudoku, 2048, Minesweeper, word search, Blind Ranking and Would You Rather. Daily challenges, unlimited play and games with friends.",
    es: "Wordle, sudoku, 2048, buscaminas, sopa de letras, ranking a ciegas y dilemas gratis. Retos diarios, ilimitados y juegos con amigos.",
    de: "Kostenlos: Wordle, Sudoku, 2048, Minesweeper, Wortsuche, Blind Ranking und Dilemmas. Tägliche Aufgaben, unbegrenztes Spielen und Duelle mit Freunden.",
  }[locale],
  homeBody:
    {
      fr: "Les défis quotidiens de Wordle, Mot insolite du jour, Sudoku, Calcul et Démineur changent à minuit UTC. Le Mot insolite propose une seule découverte par jour ; les autres jeux permettent de rejouer en illimité. 2048, Mots mêlés et les jeux sociaux s’ouvrent directement dans ce mode. Joue sans compte et retrouve ta progression sur cet appareil, ou crée un compte facultatif pour reprendre sur un autre appareil.",
      en: "Daily Wordle, Unusual word of the day, Sudoku, Numbers and Minesweeper puzzles change at midnight UTC. The unusual word offers one discovery per day; the other games offer unlimited play. 2048, word search and social games open directly in that mode. Play without an account and keep your progress on this device, or create an optional account to continue on another device.",
      es: "Los retos diarios de Wordle, Palabra curiosa del día, sudoku, cálculo y buscaminas cambian a medianoche UTC. La palabra curiosa ofrece un descubrimiento al día; los demás juegos permiten jugar sin límite. 2048, sopa de letras y los juegos sociales se abren directamente en ese modo. Juega sin cuenta y guarda tu progreso en este dispositivo, o crea una cuenta opcional para continuar en otro.",
      de: "Die Tagesaufgaben von Wordle, Wortentdeckung des Tages, Sudoku, Zahlen und Minesweeper wechseln um Mitternacht UTC. Die Wortentdeckung bietet eine Entdeckung pro Tag; die anderen Spiele sind unbegrenzt spielbar. 2048, Wortsuche und soziale Spiele öffnen direkt diesen Modus. Spiele ohne Konto und speichere deinen Fortschritt auf diesem Gerät, oder erstelle ein optionales Konto für andere Geräte.",
    }[locale] +
    " " +
    {
      fr: "Essaie aussi le classement à l’aveugle, les dilemmes Tu préfères et Devine le nombre contre un bot ou un ami. Les réactions communautaires utilisent exclusivement des réponses enregistrées.",
      en: "Also try Blind Ranking, Would You Rather and Guess the Number against a bot or friend. Community reactions use only real stored answers.",
      es: "Prueba también ranking a ciegas, ¿Qué prefieres? y Adivina el número contra un bot o un amigo. Las reacciones usan respuestas reales guardadas.",
      de: "Probiere auch Blind Ranking, Dilemmas und Errate die Zahl gegen Bot oder Freunde. Community-Reaktionen verwenden ausschließlich echte gespeicherte Antworten.",
    }[locale],
  games: {
    ...content[locale].games,
    ...newGamesSeo(locale),
    ...socialSeo(locale),
    ...rareWordSeo(locale),
  },
});
