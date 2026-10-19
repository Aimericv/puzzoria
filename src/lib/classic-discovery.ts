import type { NewChallenge } from "./types";
import { neighbors } from "./mines";
import type { PuzzleState } from "./new-play";
export function classicDiscovery(c: NewChallenge, state: PuzzleState) {
  if (c.kind === "2048") {
    const largest = Math.max(...state.grid);
    return {
      kind: "classic" as const,
      title: "2048",
      text: {
        fr: `Votre plus grande tuile vaut ${largest}, pour ${state.score} points en ${state.moves} coups. Pour progresser, gardez votre plus grande tuile dans un coin et laissez des cases libres pour préparer les fusions.`,
        en: `Your largest tile is ${largest}, with ${state.score} points in ${state.moves} moves. Keep your largest tile in a corner and leave empty cells to prepare future merges.`,
        es: `Tu ficha mayor es ${largest}, con ${state.score} puntos en ${state.moves} movimientos. Mantén la ficha mayor en una esquina y deja casillas vacías para preparar combinaciones.`,
        de: `Dein größtes Feld ist ${largest}, mit ${state.score} Punkten in ${state.moves} Zügen. Halte die größte Zahl in einer Ecke und bewahre leere Felder für weitere Verschmelzungen.`,
      }[c.locale],
    };
  }
  if (c.kind === "mines") {
    const safe = c.size ** 2 - c.mineCount,
      bombs = new Set(c.mines),
      zero = Array.from({ length: c.size ** 2 }, (_, i) => i).filter(
        (i) =>
          !bombs.has(i) && neighbors(i, c.size).every((n) => !bombs.has(n)),
      ).length;
    return {
      kind: "classic" as const,
      title: `${c.size} × ${c.size}`,
      text: {
        fr: `Cette grille contient ${safe} cases sûres, dont ${zero} zéros. Un zéro garantit que toutes ses cases voisines sont sûres. Si un chiffre possède déjà autant de drapeaux voisins que sa valeur, les autres voisins peuvent être révélés, à condition que les drapeaux soient corrects.`,
        en: `This board contains ${safe} safe cells, including ${zero} zeroes. A zero guarantees its neighbours are safe. If a number already has its full count of neighbouring flags, the remaining neighbours can be revealed, provided those flags are correct.`,
        es: `Este tablero contiene ${safe} casillas seguras, incluidos ${zero} ceros. Un cero garantiza que sus vecinas son seguras. Si un número tiene tantas banderas vecinas como su valor, puedes descubrir las demás vecinas, siempre que las banderas sean correctas.`,
        de: `Dieses Feld enthält ${safe} sichere Zellen, darunter ${zero} Nullen. Eine Null garantiert sichere Nachbarn. Hat eine Zahl bereits genauso viele benachbarte Flaggen wie ihr Wert, kannst du die übrigen Nachbarn aufdecken, sofern die Flaggen richtig gesetzt sind.`,
      }[c.locale],
    };
  }
  const longest = [...c.words].sort((a, b) => b.length - a.length)[0],
    diagonal = c.placements.filter(
      (p) =>
        Math.floor(p.from / c.size) !== Math.floor(p.to / c.size) &&
        p.from % c.size !== p.to % c.size,
    ).length;
  return {
    kind: "classic" as const,
    title: c.theme,
    text: {
      fr: `Vous avez retrouvé ${state.found.length} mots. Le plus long est ${longest} (${longest.length} lettres) ; ${diagonal} mots sont placés en diagonale. Pour la prochaine grille, cherchez d’abord les premières lettres puis vérifiez les huit directions autour d’elles.`,
      en: `You found ${state.found.length} words. The longest is ${longest} (${longest.length} letters); ${diagonal} words are diagonal. On your next board, look for initial letters first, then check the eight directions around them.`,
      es: `Has encontrado ${state.found.length} palabras. La más larga es ${longest} (${longest.length} letras); ${diagonal} palabras están en diagonal. En la próxima cuadrícula, busca primero las letras iniciales y comprueba las ocho direcciones a su alrededor.`,
      de: `Du hast ${state.found.length} Wörter gefunden. Das längste ist ${longest} (${longest.length} Buchstaben); ${diagonal} Wörter verlaufen diagonal. Suche im nächsten Raster zuerst die Anfangsbuchstaben und prüfe dann die acht Richtungen um sie herum.`,
    }[c.locale],
  };
}
