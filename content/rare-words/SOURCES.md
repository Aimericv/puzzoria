# Unusual Word data

`catalog.json` contains Puzzoria's original concise explanations and example sentences for 32 words (8 per language). Each entry links to a lexicographic source: the Académie française/CNRTL, Merriam-Webster, the RAE or Duden. Explanations are paraphrased; examples are written for this game. The source link is shown after completion, alongside the explanation on our page.

The first deck starts on **2026-10-04**. Its order is frozen: do not edit, remove or reorder its answers, or append answers to this version. Published challenge files take precedence. To expand daily answers, introduce a new dated deck while retaining this version for historical generation; never change a word already published. From 2026-10-05, the variant offers one Daily word per language and no new Practice runs; legacy owned Practice runs remain readable. Its `/practice` aliases redirect to Daily, and its completion action offers classic Wordle Practice instead. This is an initial collection, not an inexhaustible editorial catalogue.

`guesses.json` is a separate 7–10 letter dictionary. It does not alter classic Wordle's answers or dictionaries. It normalises accents, expands Œ, retains German ẞ as one letter and deduplicates words. Counts: FR **68,999**, EN **44,235**, ES **93,752**, DE **93,226**. Curated answers are also accepted.

Source datasets and licenses are the same as the [classic dictionaries](../dictionaries/SOURCES.md): Lexique 3.83 (Boris New, Christophe Pallier et al.), Hunspell dictionaries pinned to wooorm/dictionaries revision 8cfea406b505e4d7df52d5a19bce525df98c54ab, and spellchecked wordfreq 3.1.1 entries (Robyn Speer). Full attribution and license notices remain in `content/dictionaries/`:

- [Lexique / CC BY-SA 4.0](../dictionaries/LICENSE-Lexique.txt)
- [English Hunspell](../dictionaries/LICENSE-Hunspell-en.txt)
- [Spanish Hunspell](../dictionaries/LICENSE-Hunspell-es.txt)
- [German Hunspell](../dictionaries/LICENSE-Hunspell-de.txt)
- [wordfreq data attribution](../dictionaries/LICENSE-wordfreq-data.txt)
- [GPL 3.0](../dictionaries/LICENSE-GPL-3.0.txt)

Derived FR/EN data: CC BY-SA 4.0. Combined ES/DE adaptations: GPL 3.0, as explained in the original notices. Data licenses are distinct from the application's code.

Regeneration (development only): `python scripts/import-rare-word-guesses.py`. Uses the existing ignored `.sites-runtime` source caches and Python import tools; runtime reads committed JSON without downloads or Python. Pin the initial deck with `npx tsx scripts/schedule-rare-words.ts` (existing files are never overwritten).

## Detailed articles

`articles.json` adds 32 original, sourced articles without changing the frozen answers or concise explanations in `catalog.json`. Every entry includes a fuller meaning, pronunciation, etymology, two original examples, related words with distinctions, and an anecdote. Sources are linked individually: Larousse and the Académie française, Merriam-Webster, RAE/ASALE (including the DPD for oxímoron), and Duden. Etymologies and usage facts are paraphrased rather than copied. IPA and simplified pronunciation guides are identified on the page; pronunciations vary by accent. An uncertain origin, such as galimatias, is explicitly left uncertain.

The articles have stable, native-language paths: `/fr/mots/[word]`, `/en/words/[word]`, `/es/palabras/[word]`, `/de/woerter/[word]`. A player who completes the matching word, successfully or unsuccessfully, can open its article through their owned server run. A current/future Daily article is otherwise unavailable and noindex. Each article becomes public at 00:00 UTC after the first scheduled day of its word. The sitemap and related-word links include only published entries. Hreflang connects published articles describing the same concept; an English x-default is provided when that equivalent exists. There are no invented translations or public previews of future answers. Local test previews use a development-only loopback gate, which is disabled in production.

Keep the initial deck order and these publication dates stable when adding future dated decks. `npm run content:validate` checks article coverage and required fields alongside scheduled puzzles.
