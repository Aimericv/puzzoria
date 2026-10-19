// Accents do not add keyboard keys. Keep German ß as one letter; expand Œ to OE.
export function normalizeWord(word: string): string {
  return word
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/gi, "oe")
    .replace(/ß/g, "ẞ")
    .toUpperCase();
}
