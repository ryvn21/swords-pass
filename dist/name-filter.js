// Names other players see (your online name, previous names, custom blade names) can't be slurs,
// hate symbols or sexual terms. Chat is not filtered. The server applies this too, so a modified
// client can't get round it.
//
// Matching: lowercase, accents stripped, look-alike digits and symbols read as letters (n1gg3r),
// separators ignored (n.i.g), and repeated letters squeezed (niiigger). SUBSTRING terms are caught
// anywhere in the name; WORD terms only as a whole word (so "cocktail", "analyst", "spice" pass).
// SAFE words are taken out first, so "Scunthorpe", "therapist" and "grapes" pass.

const SUBSTRING = [
  // racial and ethnic slurs
  'nigger', 'nigga', 'niggr', 'nigglet', 'negro', 'chink', 'kike', 'wetback', 'beaner', 'gook', 'raghead', 'towelhead', 'sandnig', 'zipperhead', 'spearchucker', 'junglebunny', 'porchmonkey', 'coonass',
  // homophobic and transphobic slurs
  'faggot', 'fagot', 'faggit', 'tranny', 'shemale',
  // disability slurs
  'retard', 'spastic',
  // hate groups and symbols
  'hitler', 'siegheil', 'heilhitler', 'whitepower', 'whitepride', 'kukluxklan', 'kkk', 'holocaust', 'gaschamber', 'killalljews', 'jewkiller',
  // sexual and abuse terms
  'rape', 'rapist', 'molest', 'pedo', 'paedo', 'pedophil', 'paedophil', 'incest', 'bestiality', 'necrophil', 'cunt', 'fuck', 'whore', 'slut', 'jizz', 'blowjob', 'handjob', 'penis', 'vagina', 'pussy', 'porn', 'dildo', 'cumshot', 'creampie', 'gangbang', 'orgasm', 'erection', 'testicle', 'clitoris',
  // self-harm baiting
  'killyourself', 'killurself', 'gokillyourself', 'hangyourself',
];
const WORD = ['nig', 'nigs', 'fag', 'fags', 'spic', 'spics', 'paki', 'pakis', 'coon', 'coons', 'jap', 'japs', 'wop', 'gypo', 'gyppo', 'kys', 'cum', 'cock', 'cocks', 'anal', 'tits', 'twat', 'dick', 'semen', 'sex', 'nonce', 'dyke', 'dykes', 'nazi', 'nazis', 'mong', 'mongs'];
const SAFE = ['scunthorpe', 'penistone', 'grape', 'drape', 'scrape', 'trapeze', 'therapist', 'skyscraper', 'rapeseed', 'parapet', 'nigeria', 'snigger', 'cockatoo', 'cocktail', 'peacock', 'hancock', 'woodcock', 'shuttlecock', 'dickens', 'pedometer', 'pedometre', 'pedal', 'pedantic', 'torpedo', 'speedo', 'montenegro', 'negroni'];

const LEET = {'0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '6': 'g', 'ph': 'f', '()': 'o'};
const squeeze = s => s.replace(/(.)\1+/g, '$1');
const base = s => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const leet = s => s.replace(/ph|\(\)|[0-9!|@$+]/g, c => LEET[c] ?? c);
const strip = (s, words) => words.reduce((t, w) => t.split(w).join(' '), s);

// true when the name contains something we don't allow
export function offensive(name) {
  const raw = base(name); if (!raw.trim()) return false;
  if (/\b(14\s*\/?\s*88|88\s*14)\b/.test(raw)) return true;
  const letters = leet(raw), words = letters.split(/[^a-z]+/).filter(Boolean);
  if (words.some(w => WORD.includes(w) || WORD.includes(squeeze(w)))) return true;
  // whole name run together, safe words removed, checked plain and squeezed
  const safeSqueezed = SAFE.map(squeeze);
  const joined = strip(letters.replace(/[^a-z]+/g, ''), SAFE), squeezed = strip(squeeze(letters.replace(/[^a-z]+/g, '')), safeSqueezed);
  return SUBSTRING.some(t => joined.includes(t) || squeeze(t).length >= 4 && squeezed.includes(squeeze(t)));
}
// the name to show: the original, or the fallback when it isn't allowed
export const allowedName = (name, fallback = 'Swordhand') => offensive(name) ? fallback : name;
