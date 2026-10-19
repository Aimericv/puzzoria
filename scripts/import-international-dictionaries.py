"""Build EN/ES/DE game data; import tools never run in the web application.

python -m pip install --target .sites-runtime/dictionary-tools wordfreq==3.1.1 spylls==0.1.7
python scripts/import-international-dictionaries.py
"""

from pathlib import Path
import hashlib
import json
import re
import sys
import unicodedata
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".sites-runtime/dictionary-tools"))
from spylls.hunspell import Dictionary
from wordfreq import iter_wordlist, zipf_frequency

REVISION = "8cfea406b505e4d7df52d5a19bce525df98c54ab"
SOURCE = f"https://raw.githubusercontent.com/wooorm/dictionaries/{REVISION}/dictionaries"
CACHE = ROOT / ".sites-runtime/dictionary-sources"
# Existing published days (including today) must retain their original answers.
ANSWERS_FROM = "2026-10-04"
EXCLUDED = {
    "en": {"BITCH", "CUNTS", "DICKS", "FUCKS", "NAZIS", "NEGRO", "NIGGA", "SLUTS", "WHORE"},
    "es": {"APOLO", "APROX", "BELEN", "COJON", "FOLLA", "JESUS", "MARIA", "NAZIS", "PUTAS", "PUTOS", "POLLA"},
    "de": {"ARSCH", "FOTZE", "NAZIS", "NEGER", "NUTTE", "PENIS"},
}


def normalize(word):
    word = word.strip().replace("œ", "oe").replace("Œ", "OE").replace("ß", "ẞ")
    return "".join(c for c in unicodedata.normalize("NFD", word) if not unicodedata.combining(c)).upper()


def download(url, path):
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url, timeout=60) as response:
            path.write_bytes(response.read())
    return path.read_bytes()


for locale in ("en", "es", "de"):
    target = ROOT / f"content/dictionaries/{locale}.json"
    previous = json.loads(target.read_text(encoding="utf8"))
    legacy = previous.get("legacyAnswers", previous["answers"])
    files = {}
    for filename in ("index.aff", "index.dic", "license"):
        files[filename] = download(f"{SOURCE}/{locale}/{filename}", CACHE / locale / filename)
    spell = Dictionary.from_files(str(CACHE / locale / "index"))
    pattern = "[A-Zẞ]{5}" if locale == "de" else "[A-Z]{5}"
    allowed = {normalize(w) for w in previous["allowed"] + legacy if re.fullmatch(pattern, normalize(w))}
    answers = {normalize(w) for w in legacy}
    # Dictionary roots include rare valid words; usage data also supplies inflections.
    candidates = set(iter_wordlist(locale)) | {entry.stem for entry in spell.dic.words}
    for original in sorted(candidates):
        word = normalize(original)
        if not re.fullmatch("[A-Zẞ]{5}" if locale == "de" else "[A-Z]{5}", word):
            continue
        if not (spell.lookup(original) or (locale == "de" and spell.lookup(original.capitalize()))):
            continue
        allowed.add(word)
        if zipf_frequency(original, locale) < 3.5:
            continue
        # Daily/practice answers are common dictionary headwords, not arbitrary names.
        stems = spell.dic.index.get(original, [])
        if locale == "de":
            stems = stems + spell.dic.index.get(original.capitalize(), [])
        if locale == "de":
            # igerman98 marks ordinary compound-capable noun stems with j.
            # Names such as Maria/Peter are dictionary entries too, but not answers.
            headword = any(
                (entry.stem.islower() and "o" not in entry.flags and "h" not in entry.flags)
                or (entry.stem[0].isupper() and "j" in entry.flags)
                for entry in stems
            )
        else:
            headword = any(entry.stem == original and entry.stem.islower() for entry in stems)
        if headword and word not in EXCLUDED[locale]:
            answers.add(word)
    if len(allowed) < 1500 or len(answers) < 400:
        raise RuntimeError(f"Incomplete {locale} data: {len(allowed)} guesses, {len(answers)} answers")
    result = {
        "answers": sorted(answers),
        "allowed": sorted(allowed),
        "legacyAnswers": legacy,
        "answersFrom": previous.get("answersFrom", ANSWERS_FROM),
        "source": {
            "name": f"Hunspell {locale} via wooorm/dictionaries + wordfreq 3.1.1",
            "revision": REVISION,
            "url": f"https://github.com/wooorm/dictionaries/tree/{REVISION}/dictionaries/{locale}",
            "frequencyUrl": "https://github.com/rspeer/wordfreq/tree/v3.1.1",
            "license": "CC-BY-SA-4.0" if locale == "en" else "GPL-3.0-only",
            "sha256": {name: hashlib.sha256(data).hexdigest() for name, data in files.items()},
            "modifications": "Five-letter accent-normalized dictionary roots and spellchecked frequency tokens; common headwords for answers; original entries and published answers preserved.",
        },
    }
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    (ROOT / f"content/dictionaries/LICENSE-Hunspell-{locale}.txt").write_bytes(files["license"])
    print(f"{locale}: {len(allowed)} accepted guesses, {len(answers)} answers", flush=True)
