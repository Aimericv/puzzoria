import { seededRandom, shuffled } from "./random";
import type { Locale } from "./types";
const themes: Record<Locale, { theme: string; words: string[] }[]> = {
  fr: [
    {
      theme: "Animaux",
      words: [
        "RENARD",
        "LAPIN",
        "TIGRE",
        "LOUTRE",
        "PANDA",
        "ZEBRE",
        "HIBOU",
        "BALEINE",
      ],
    },
    {
      theme: "Nature",
      words: [
        "FORET",
        "RIVIERE",
        "FLEUR",
        "FEUILLE",
        "MONTAGNE",
        "PLUIE",
        "SOLEIL",
        "ROCHER",
      ],
    },
    {
      theme: "Cuisine",
      words: [
        "TOMATE",
        "CAROTTE",
        "FROMAGE",
        "POIVRE",
        "OLIVE",
        "POMME",
        "FARINE",
        "CITRON",
      ],
    },
    {
      theme: "Espace",
      words: [
        "PLANETE",
        "ETOILE",
        "COMETE",
        "GALAXIE",
        "LUNE",
        "FUSEE",
        "SATURNE",
        "ORBITE",
      ],
    },
  ],
  en: [
    {
      theme: "Animals",
      words: [
        "FOX",
        "RABBIT",
        "TIGER",
        "OTTER",
        "PANDA",
        "ZEBRA",
        "OWL",
        "WHALE",
      ],
    },
    {
      theme: "Nature",
      words: [
        "FOREST",
        "RIVER",
        "FLOWER",
        "LEAF",
        "MOUNTAIN",
        "RAIN",
        "SUN",
        "ROCK",
      ],
    },
    {
      theme: "Kitchen",
      words: [
        "TOMATO",
        "CARROT",
        "CHEESE",
        "PEPPER",
        "OLIVE",
        "APPLE",
        "FLOUR",
        "LEMON",
      ],
    },
    {
      theme: "Space",
      words: [
        "PLANET",
        "STAR",
        "COMET",
        "GALAXY",
        "MOON",
        "ROCKET",
        "SATURN",
        "ORBIT",
      ],
    },
  ],
  es: [
    {
      theme: "Animales",
      words: [
        "ZORRO",
        "CONEJO",
        "TIGRE",
        "NUTRIA",
        "PANDA",
        "CEBRA",
        "BUHO",
        "BALLENA",
      ],
    },
    {
      theme: "Naturaleza",
      words: [
        "BOSQUE",
        "RIO",
        "FLOR",
        "HOJA",
        "MONTANA",
        "LLUVIA",
        "SOL",
        "ROCA",
      ],
    },
    {
      theme: "Cocina",
      words: [
        "TOMATE",
        "ZANAHORIA",
        "QUESO",
        "PIMIENTA",
        "ACEITUNA",
        "MANZANA",
        "HARINA",
        "LIMON",
      ],
    },
    {
      theme: "Espacio",
      words: [
        "PLANETA",
        "ESTRELLA",
        "COMETA",
        "GALAXIA",
        "LUNA",
        "COHETE",
        "SATURNO",
        "ORBITA",
      ],
    },
  ],
  de: [
    {
      theme: "Tiere",
      words: [
        "FUCHS",
        "HASE",
        "TIGER",
        "OTTER",
        "PANDA",
        "ZEBRA",
        "EULE",
        "WAL",
      ],
    },
    {
      theme: "Natur",
      words: [
        "WALD",
        "FLUSS",
        "BLUME",
        "BLATT",
        "BERG",
        "REGEN",
        "SONNE",
        "FELS",
      ],
    },
    {
      theme: "Küche",
      words: [
        "TOMATE",
        "KAROTTE",
        "KAESE",
        "PFEFFER",
        "OLIVE",
        "APFEL",
        "MEHL",
        "ZITRONE",
      ],
    },
    {
      theme: "Weltraum",
      words: [
        "PLANET",
        "STERN",
        "KOMET",
        "GALAXIE",
        "MOND",
        "RAKETE",
        "SATURN",
        "UMLAUF",
      ],
    },
  ],
};
export function searchPath(from: number, to: number, size: number): number[] {
  if (
    ![from, to].every((i) => Number.isInteger(i) && i >= 0 && i < size * size)
  )
    return [];
  const dr = Math.floor(to / size) - Math.floor(from / size),
    dc = (to % size) - (from % size);
  if (dr && dc && Math.abs(dr) !== Math.abs(dc)) return [];
  return Array.from(
    { length: Math.max(Math.abs(dr), Math.abs(dc)) + 1 },
    (_, i) => from + i * (Math.sign(dr) * size + Math.sign(dc)),
  );
}
export function generateSearch(seed: string, locale: Locale) {
  const random = seededRandom(seed + ":search"),
    date = seed.match(/^wordsearch:(\d{4}-\d{2}-\d{2}):/)?.[1],
    themeIndex = date
      ? Math.floor(Date.parse(date) / 86400000) % themes[locale].length
      : Math.floor(random() * themes[locale].length),
    choice = themes[locale][themeIndex],
    size = 12;
  const grid: string[] = Array(size * size).fill(""),
    placements: { from: number; to: number }[] = [];
  for (const word of [...choice.words].sort((a, b) => b.length - a.length)) {
    const candidates = shuffled(
      Array.from({ length: size * size }, (_, i) => i),
      random,
    );
    let placed = false;
    for (const from of candidates) {
      for (const [dr, dc] of shuffled(
        [
          [-1, -1],
          [-1, 0],
          [-1, 1],
          [0, -1],
          [0, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ],
        random,
      )) {
        const row = Math.floor(from / size) + dr * (word.length - 1),
          col = (from % size) + dc * (word.length - 1);
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        const to = row * size + col,
          cells = searchPath(from, to, size);
        if (cells.every((i, n) => !grid[i] || grid[i] === word[n])) {
          cells.forEach((i, n) => {
            grid[i] = word[n];
          });
          placements[choice.words.indexOf(word)] = { from, to };
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) throw new Error("Word search placement failed");
  }
  grid.forEach((letter, i) => {
    if (!letter)
      grid[i] = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(random() * 26)];
  });
  return {
    size,
    grid,
    theme: choice.theme,
    words: [...choice.words],
    placements,
  };
}
