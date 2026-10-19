# Word dictionaries

## French

`fr.json` uses Lexique 3.83 by Boris New, Christophe Pallier and collaborators, together with Puzzoria's original curated entries.

- Source dataset: https://lexique.org/databases/Lexique383/Lexique383.tsv
- Documentation and attribution: https://github.com/chrplr/openlexicon/blob/master/datasets-info/Lexique383/README-Lexique.md
- License: Creative Commons Attribution–ShareAlike 4.0 International (CC BY-SA 4.0).
- Full license text: [LICENSE-Lexique.txt](LICENSE-Lexique.txt).
- The derived French dictionary is distributed under CC BY-SA 4.0. This notice covers the dictionary data, independently of the application's code.

Changes: accents removed, Œ expanded to OE, five-letter A–Z words retained and deduplicated. Inflections and plurals are allowed as guesses. Daily answers favor frequent lemmas (frequency >= 5 per million in books or subtitles; noun, adjective, verb or adverb), merged with the original curated answers. A small editorial exclusion list applies only to automatic daily-answer selection. The source SHA-256 and origin are recorded in `fr.json`.

There are 5,037 accepted French guesses and 849 candidate daily answers. The original 40 answers and their order are retained as `legacyAnswers` for challenges before 2026-10-03, so historical challenges and ongoing games keep the same answer. Already-scheduled files retain priority regardless of date.

Regenerate with `npm run dictionary:import:fr`, or supply a downloaded TSV path with `npm run dictionary:import:fr -- path/to/Lexique383.tsv`. Commit the resulting dictionary; there is no runtime download or dependency on the Lexique website.

## English, Spanish and German

The three dictionaries now combine their original entries with Hunspell dictionary roots and spellchecked inflections from **wordfreq 3.1.1**. The importer filters to five normalized letters, deduplicates accent variants, and selects common dictionary headwords (Zipf frequency >= 3.5) as answers. German `ß` remains one letter; ordinary German compound-capable noun stems are distinguished from personal names for answer selection. A small answer exclusion list removes selected abusive terms, names and abbreviations. These heuristics do not replace native editorial review.

| Language | Accepted guesses | Answer candidates |
| -------- | ---------------: | ----------------: |
| English  |            6,355 |             1,219 |
| Spanish  |            6,863 |             1,003 |
| German   |            4,123 |               590 |

Hunspell sources are pinned to [wooorm/dictionaries revision 8cfea406](https://github.com/wooorm/dictionaries/tree/8cfea406b505e4d7df52d5a19bce525df98c54ab/dictionaries). Each JSON includes source URLs and SHA-256 checksums. English uses SCOWL/en_US, Kevin Atkinson and contributors (MIT/BSD notices in [LICENSE-Hunspell-en.txt](LICENSE-Hunspell-en.txt)); Spanish uses Santiago Bosio and RLA-ES contributors (GPL-3.0-or-later option, [notice](LICENSE-Hunspell-es.txt)); German uses igerman98 by Björn Jacke (GPL-2.0/GPL-3.0 options, [notice](LICENSE-Hunspell-de.txt)).

Frequency data: [wordfreq](https://github.com/rspeer/wordfreq/tree/v3.1.1), Robyn Speer, under CC BY-SA 4.0. Its corpus includes Google Books Ngrams, Wikipedia, Leeds Internet Corpus, ParaCrawl, OpenSubtitles and the freely available SUBTLEX data by Marc Brysbaert and collaborators. The upstream attribution and redistribution notices are retained in [LICENSE-wordfreq-data.txt](LICENSE-wordfreq-data.txt). The English derived data is distributed under CC BY-SA 4.0 (full text already supplied in [LICENSE-Lexique.txt](LICENSE-Lexique.txt)); the Spanish/German combined adaptations use GPL-3.0, with the [full GPL text](LICENSE-GPL-3.0.txt). These data notices are distinct from the application's code.

Regenerate from the repository root:

```powershell
python -m pip install --target .sites-runtime/dictionary-tools wordfreq==3.1.1 spylls==0.1.7
python scripts/import-international-dictionaries.py
```

Python and the import packages are development tools only, kept in the ignored `.sites-runtime` directory. Gameplay dictionaries use committed JSON and need no Python runtime. The import script itself is included as the modification source. Historical answer arrays and ordering remain in `legacyAnswers`. Existing EN/ES/DE daily answers are preserved through **3 October 2026**; the expanded daily pool activates on 4 October. Unlimited uses the expanded pool immediately. Scheduled challenge files continue to take priority.

## Optional definitions after a completed game

Definitions are separate from accepted guesses and answer selection. The server requests a short localized excerpt from the Wiktionary API, parses it to plain text with parse5 8.0.1 (MIT), and caches it. The UI links the exact entry and credits Wiktionary contributors under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), marking the excerpt as such. Excerpts are at most 25 words. No definition is supplied when the service or the matching language entry is unavailable. Dictionary outages never affect validation or completion. This runtime lookup is documented in the privacy pages; no player identity, browser address or guess is sent to Wiktionary. See [the implementation and limits](../../docs/ENGAGEMENT.fr.md).
