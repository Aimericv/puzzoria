import type { Locale } from "./types";
const en = {
  rarewordName: "Unusual word of the day", rarewordCategory: "Discovery",
  rarewordDesc: "A surprising word every day. Discover its meaning after playing.",
  rarewordRules: "Guess a 7–10 letter word. You get 8 attempts for shorter words and 10 for longer ones. Accents are normalised. Its meaning and origin are revealed after your game.",
  dailyLabel: "Unusual word of the day", definition: "What does it mean?", origin: "Origin", example: "Try it in a sentence", source: "Dictionary source",
  inputLabel: "Word with {n} letters", wordLengthError: "Enter {n} letters.",
  learn: "A new word to take with you", format: "{n} letters · {attempts} attempts",
  dailyGoal: "Discover today’s unusual word and learn its story.",
};
type Copy = Record<keyof typeof en, string>;
const rows: Record<Locale, Copy> = {
  en,
  fr: { rarewordName: "Mot insolite du jour", rarewordCategory: "Découverte", rarewordDesc: "Un mot surprenant chaque jour. Découvre son sens après la partie.", rarewordRules: "Trouve un mot de 7 à 10 lettres. Tu as 8 essais pour les mots courts, 10 pour les plus longs. Les accents sont normalisés. Son sens et son origine sont révélés après la partie.", dailyLabel: "Mot insolite du jour", definition: "Qu’est-ce que ça veut dire ?", origin: "Origine", example: "Pour l’utiliser", source: "Source lexicographique", inputLabel: "Mot de {n} lettres", wordLengthError: "Saisis {n} lettres.", learn: "Un nouveau mot à emporter", format: "{n} lettres · {attempts} essais", dailyGoal: "Découvre le mot insolite du jour et son histoire." },
  es: { rarewordName: "Palabra curiosa del día", rarewordCategory: "Descubrimiento", rarewordDesc: "Una palabra sorprendente cada día. Descubre su significado al terminar.", rarewordRules: "Adivina una palabra de 7 a 10 letras. Tienes 8 intentos para las cortas y 10 para las más largas. Se normalizan las tildes. Descubrirás su significado y origen al terminar.", dailyLabel: "Palabra curiosa del día", definition: "¿Qué significa?", origin: "Origen", example: "Úsala en una frase", source: "Fuente del diccionario", inputLabel: "Palabra de {n} letras", wordLengthError: "Escribe {n} letras.", learn: "Una nueva palabra para recordar", format: "{n} letras · {attempts} intentos", dailyGoal: "Descubre la palabra curiosa del día y su historia." },
  de: { rarewordName: "Wortentdeckung des Tages", rarewordCategory: "Entdeckung", rarewordDesc: "Jeden Tag ein ungewöhnliches Wort. Entdecke danach seine Bedeutung.", rarewordRules: "Finde ein Wort mit 7–10 Buchstaben. Du hast 8 Versuche für kürzere und 10 für längere Wörter. Akzente werden normalisiert. Bedeutung und Herkunft erscheinen nach der Partie.", dailyLabel: "Wortentdeckung des Tages", definition: "Was bedeutet es?", origin: "Herkunft", example: "Ein Satz zum Merken", source: "Wörterbuchquelle", inputLabel: "Wort mit {n} Buchstaben", wordLengthError: "Gib {n} Buchstaben ein.", learn: "Ein neues Wort zum Mitnehmen", format: "{n} Buchstaben · {attempts} Versuche", dailyGoal: "Entdecke das ungewöhnliche Wort des Tages und seine Geschichte." },
};
export const rareWordCopy = (locale: Locale) => rows[locale];
