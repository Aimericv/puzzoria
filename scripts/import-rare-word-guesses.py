"""Development-only import of 7–10-letter guesses; existing Wordle data is untouched."""
import csv, json, re, sys, unicodedata
from pathlib import Path
root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / '.sites-runtime/dictionary-tools'))
from spylls.hunspell import Dictionary
from wordfreq import iter_wordlist
def normal(word):
    word = word.replace('œ', 'oe').replace('Œ', 'OE').replace('ß', 'ẞ')
    return ''.join(c for c in unicodedata.normalize('NFD', word) if not unicodedata.combining(c)).upper()
data = {}
with (root / '.sites-runtime/Lexique383.tsv').open(encoding='utf8') as f:
    data['fr'] = sorted({normal(row['ortho']) for row in csv.DictReader(f, delimiter='\t') if re.fullmatch('[A-Z]{7,10}', normal(row['ortho']))})
for locale in ['en', 'es', 'de']:
    spell = Dictionary.from_files(str(root / '.sites-runtime/dictionary-sources' / locale / 'index'))
    words = {entry.stem for entry in spell.dic.words} | set(iter_wordlist(locale))
    pattern = '[A-Zẞ]{7,10}' if locale == 'de' else '[A-Z]{7,10}'
    data[locale] = sorted({normal(word) for word in words if re.fullmatch(pattern, normal(word)) and (spell.lookup(word) or (locale == 'de' and spell.lookup(word.capitalize())))})
    print(locale, len(data[locale]))
for locale, entries in data.items():
    if len(entries) < 5000: raise ValueError('Incomplete long-word dictionary: ' + locale)
(root / 'content/rare-words/guesses.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print('fr', len(data['fr']))
