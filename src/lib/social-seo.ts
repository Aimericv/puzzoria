import type { Locale } from "./types";
import { st } from "./social-i18n";
const detail = {
  en: [
    [
      "Free Blind Ranking: unlimited rankings and real results",
      "Rank five surprises from 1 to 5, one reveal at a time. Play as often as you like and compare with real community picks. No signup needed.",
      "Blind choices, fixed positions",
      "Choose a free position before the next item appears. Place your favourite at number one. A previous choice cannot be edited; the full list appears only after your fifth pick.",
      "Real community comparisons",
      "Percentages use one stored ranking per other account or device for this exact dataset. At least 20 are required. The collective ranking is the most frequently submitted complete list; unusualness compares how often each placement was chosen.",
      "Choose a category and play again",
      "Food, countries to visit, gaming, movies, animals and everyday favourites form the first categories. Each game draws five items from a pool of twenty in your chosen category. Play again to discover another selection and compare the same five items with real community rankings.",
    ],
    [
      "Guess the Number online: bot and two-player duels",
      "Choose your secret number from 1 to 100. Guess higher or lower against three bot levels or invite a friend with a private code.",
      "Higher or lower, one number at a time",
      "Enter a number of your choice. + means the secret is higher; − means it is lower. No number is prefilled and no calculated range is shown. Against the bot, the first correct guess wins.",
      "Three bot strategies",
      "Easy guesses randomly among the remaining numbers. Medium favours the middle area. Hard halves the search range each turn. Records and real community comparisons use the same difficulty and rules.",
      "Play with a friend on another device",
      "Create a private room and share its link. Each player chooses a secret number and confirms they are ready. After a shared countdown, guess simultaneously with automatically verified higher/lower answers. A correct answer wins over an unfinished search, then fewer guesses and the earlier finish break ties. Each player has five minutes and up to 30 guesses. Reopen the link to resume.",
    ],
    [
      "Would You Rather: unlimited dilemmas and real votes",
      "Choose between two options, then reveal real community results. Unlimited dilemmas about life, money, gaming and funny choices.",
      "Vote before seeing the result",
      "Every dilemma offers two choices. Your vote is locked before any community percentages become visible. You decide when to move to the next question, with no timer forcing your choice.",
      "Majority, rare choices and close votes",
      "Results are based on stored votes from other accounts or devices, counted once per question. Percentages require at least 20 other responses. Ties have no majority; the closest split in your set is highlighted.",
      "A playful recap you can share",
      "Your final recap groups the preference themes attached to your answers. It is a summary of this round, not a personality assessment. Download a share card or send a text result and play another set.",
    ],
  ],
  fr: [
    [
      "Classement à l’aveugle gratuit : jeu illimité et vrais résultats",
      "Classe cinq surprises de 1 à 5, une révélation à la fois. Jeu illimité et comparaison avec les vrais choix de la communauté.",
      "Des choix à l’aveugle, des places verrouillées",
      "Choisis une place libre avant de découvrir le prochain élément. Le n° 1 est ton préféré. Aucun choix précédent ne peut être modifié ; la liste complète apparaît après ton cinquième choix.",
      "De vraies comparaisons communautaires",
      "Les pourcentages utilisent un classement enregistré par autre compte ou appareil pour cette liste exacte. Il en faut au moins 20. Le classement collectif est la liste complète la plus souvent proposée ; l’atypicité compare la fréquence de chaque placement.",
      "Choisir une catégorie et rejouer",
      "Cuisine, pays à visiter, jeux vidéo, films, animaux et plaisirs du quotidien composent les premières catégories. Chaque partie tire cinq éléments parmi vingt dans la catégorie choisie. Rejoue pour découvrir une nouvelle sélection et comparer ces mêmes cinq éléments aux classements de la communauté.",
    ],
    [
      "Devine le nombre : bot et duel entre amis en ligne",
      "Choisis ton nombre secret de 1 à 100. Joue au plus ou moins contre trois niveaux de bot ou invite un ami avec un code privé.",
      "Plus ou moins, un nombre à la fois",
      "Entre le nombre de ton choix. + signifie que le nombre caché est plus grand ; −, qu’il est plus petit. Aucun nombre prérempli ni plage calculée. Contre le bot, le premier qui trouve gagne.",
      "Trois stratégies de bot",
      "Facile propose au hasard parmi les nombres encore possibles. Moyen vise la zone centrale. Difficile coupe la zone de recherche en deux à chaque tour. Les records et comparaisons réelles distinguent les niveaux et les règles.",
      "Un duel sur deux appareils",
      "Crée un salon privé et partage son lien. Chacun choisit son nombre secret et confirme être prêt. Après un décompte commun, proposez vos nombres simultanément ; les réponses plus ou moins sont vérifiées automatiquement. Une réussite prime sur une recherche inachevée, puis le nombre d’essais et l’instant de fin départagent les joueurs. Chacun dispose de cinq minutes et de 30 essais maximum. Rouvre le lien pour reprendre.",
    ],
    [
      "Tu préfères : dilemmes gratuits et vrais votes",
      "Choisis entre deux options puis découvre les vrais résultats communautaires. Dilemmes illimités sur la vie, l’argent et les jeux vidéo.",
      "Voter avant de voir les résultats",
      "Chaque dilemme propose deux options. Ton vote est verrouillé avant l’affichage des pourcentages communautaires. Tu décides quand passer à la question suivante, sans chronomètre qui impose une réponse.",
      "Majorité, choix rares et votes partagés",
      "Les résultats utilisent les votes enregistrés des autres comptes ou appareils, comptés une fois par question. Il faut au moins 20 autres réponses. Une égalité n’a pas de majorité ; le dilemme le plus partagé de ta série est mis en avant.",
      "Un résumé ludique à partager",
      "Le bilan regroupe les thèmes de préférence associés à tes réponses. Il résume cette série et ne constitue pas une évaluation de personnalité. Télécharge une carte ou partage ton résultat en texte, puis essaie d’autres dilemmes.",
    ],
  ],
  es: [
    [
      "Ranking a ciegas gratis: ilimitado y con resultados reales",
      "Ordena cinco sorpresas del 1 al 5, una cada vez. Juega sin límite y compara con elecciones reales de la comunidad.",
      "Decisiones ciegas, puestos bloqueados",
      "Elige un puesto libre antes de descubrir el siguiente elemento. El número 1 es tu favorito. No puedes cambiar los anteriores; la lista completa se muestra tras la quinta elección.",
      "Comparaciones con respuestas reales",
      "Los porcentajes cuentan un ranking por otra cuenta o dispositivo para la misma lista. Se necesitan al menos 20. El ranking colectivo es la lista completa más frecuente; la rareza compara la frecuencia de cada elección.",
      "Elegir categoría y volver a jugar",
      "Comida, países, videojuegos, películas, animales y preferencias cotidianas son las primeras categorías. Cada partida elige cinco elementos de un grupo de veinte de la categoría elegida. Vuelve a jugar para descubrir otra selección y compararla con rankings reales de esos mismos cinco elementos.",
    ],
    [
      "Adivina el número: bot y duelo con amigos",
      "Elige tu número secreto del 1 al 100. Juega a mayor o menor contra tres niveles de bot o invita a un amigo con un código privado.",
      "Mayor o menor, un número cada vez",
      "Introduce el número que elijas. + indica que el secreto es mayor; − indica que es menor. No se rellenan números ni se muestra un rango calculado. Contra el bot, gana quien acierte primero.",
      "Tres estrategias de bot",
      "Fácil prueba al azar entre los números posibles. Medio prefiere la zona central. Difícil divide la zona por la mitad cada turno. Los récords y las comparaciones reales distinguen dificultad y reglas.",
      "Jugar desde dos dispositivos",
      "Crea una sala privada y comparte su enlace. Cada jugador elige un número secreto y confirma que está listo. Tras una cuenta atrás común, proponed números simultáneamente; las respuestas de mayor o menor se verifican automáticamente. Acertar prima sobre una búsqueda sin terminar; después deciden el menor número de intentos y el instante de finalización. Cada jugador dispone de cinco minutos y hasta 30 intentos. Abre el enlace para continuar.",
    ],
    [
      "¿Qué prefieres? Dilemas ilimitados y votos reales",
      "Elige entre dos opciones y descubre los votos reales de la comunidad. Dilemas ilimitados sobre vida, dinero y videojuegos.",
      "Votar antes de ver el resultado",
      "Cada dilema tiene dos opciones. El voto se bloquea antes de mostrar porcentajes comunitarios. Avanza a la siguiente pregunta cuando quieras, sin un temporizador que fuerce tu decisión.",
      "Mayorías, elecciones raras y empates",
      "Los resultados usan votos guardados de otras cuentas o dispositivos, una vez por pregunta. Se necesitan al menos 20 respuestas ajenas. Un empate no tiene mayoría; se destaca la pregunta más dividida de tu serie.",
      "Un resumen divertido para compartir",
      "El resumen agrupa los temas asociados a tus respuestas. Describe esta ronda, no evalúa tu personalidad. Descarga una tarjeta o comparte el resultado en texto y prueba otros dilemas.",
    ],
  ],
  de: [
    [
      "Blind Ranking kostenlos: unbegrenzt und mit echten Ergebnissen",
      "Ordne fünf Überraschungen einzeln auf die Plätze 1 bis 5. Spiele so oft du möchtest und vergleiche echte Community-Entscheidungen.",
      "Blind entscheiden, Plätze festlegen",
      "Wähle einen freien Platz, bevor das nächste Element erscheint. Platz 1 ist dein Favorit. Frühere Entscheidungen bleiben fest; die gesamte Liste erscheint erst nach der fünften Wahl.",
      "Vergleich mit echten Antworten",
      "Pro anderem Konto oder Gerät zählt eine Rangliste für genau diese Auswahl. Mindestens 20 sind nötig. Die gemeinsame Rangliste ist die am häufigsten abgegebene vollständige Liste; Ungewöhnlichkeit vergleicht die Häufigkeit jeder Platzierung.",
      "Kategorie wählen und erneut spielen",
      "Essen, Reiseziele, Gaming, Filme, Tiere und Alltagsfavoriten bilden die ersten Kategorien. Jede Runde zieht fünf von zwanzig Elementen deiner Kategorie. Spiele erneut und vergleiche Ranglisten mit genau denselben fünf Elementen.",
    ],
    [
      "Errate die Zahl: Bot und Duell mit Freunden",
      "Wähle deine geheime Zahl von 1 bis 100. Spiele größer oder kleiner gegen drei Bot-Stufen oder lade Freunde mit einem privaten Code ein.",
      "Größer oder kleiner, eine Zahl pro Zug",
      "Gib deine eigene Zahl ein. + bedeutet, die geheime Zahl ist größer; − bedeutet, sie ist kleiner. Keine vorausgefüllte Zahl und kein berechneter Bereich. Gegen den Bot gewinnt, wer zuerst trifft.",
      "Drei Bot-Strategien",
      "Leicht rät zufällig unter den möglichen Zahlen. Mittel bevorzugt den mittleren Bereich. Schwer halbiert den Suchbereich pro Zug. Rekorde und echte Vergleiche unterscheiden Stufen und Regeln.",
      "Auf zwei Geräten spielen",
      "Erstelle einen privaten Raum und teile den Link. Beide wählen ihre geheime Zahl und bestätigen ihre Bereitschaft. Nach einem gemeinsamen Countdown ratet ihr gleichzeitig; Größer-oder-kleiner-Antworten werden automatisch geprüft. Eine gefundene Zahl schlägt eine unvollendete Suche; danach entscheiden weniger Versuche und der frühere Abschluss. Beide haben fünf Minuten und höchstens 30 Versuche. Öffne den Link erneut, um fortzusetzen.",
    ],
    [
      "Was wäre dir lieber? Unbegrenzte Dilemmas und echte Stimmen",
      "Wähle zwischen zwei Optionen und entdecke echte Community-Ergebnisse. Unbegrenzte Fragen zu Alltag, Geld und Gaming.",
      "Erst abstimmen, dann Ergebnisse sehen",
      "Jedes Dilemma hat zwei Optionen. Deine Stimme steht fest, bevor Community-Prozente erscheinen. Du entscheidest ohne Zeitdruck, wann du zur nächsten Frage gehst.",
      "Mehrheiten, seltene Entscheidungen und Gleichstand",
      "Ergebnisse verwenden gespeicherte Stimmen anderer Konten oder Geräte, einmal pro Frage. Mindestens 20 fremde Antworten sind nötig. Bei Gleichstand gibt es keine Mehrheit; die knappste Frage deiner Runde wird hervorgehoben.",
      "Spielerische Zusammenfassung zum Teilen",
      "Die Zusammenfassung gruppiert Themen deiner Antworten. Sie beschreibt diese Runde und bewertet nicht deine Persönlichkeit. Lade eine Ergebniskarte herunter oder teile einen Text und spiele weitere Fragen.",
    ],
  ],
} as const;
export function socialSeo(locale: Locale) {
  const m = st(locale);
  const make = (i: number, intro: string) => {
    const d = detail[locale][i];
    return {
      title: d[0],
      description: d[1],
      intro,
      sections: [2, 4, 6].map((n) => ({ title: d[n], text: d[n + 1] })),
    };
  };
  return {
    ranking: make(0, m.rankingDesc),
    guess: make(1, m.guessDesc),
    rather: make(2, m.ratherDesc),
  };
}
