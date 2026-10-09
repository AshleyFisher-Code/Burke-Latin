// Word bank. Every stage stays in the bank all year (cumulative).
// To add a stage: append its words with stage: N, and add its grammar skills in gen.js.

export const fold = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
export const letters = s => fold(s).toLowerCase().replace(/[^a-z]/g, '');

function enPlural(en) {
  if (/(^|\s)woman$/.test(en)) return en.replace(/woman$/, 'women');
  if (/(^|\s)man$/.test(en)) return en.replace(/man$/, 'men');
  if (/person$/.test(en)) return en.replace(/person$/, 'people');
  if (/[^aeiou]y$/.test(en)) return en.slice(0, -1) + 'ies';
  if (/(s|x|ch|sh)$/.test(en)) return en + 'es';
  return en + 's';
}

export const WORDS = [];
const N = (stage, lemma, gen, g, show, mean, hook, x = {}) => {
  const pl = x.pl !== undefined ? x.pl : (gen === 'ae' ? lemma.slice(0, -1) + 'ae' : (lemma.endsWith('us') ? lemma.slice(0, -2) : lemma) + 'ī');
  WORDS.push({ id: letters(lemma), stage, lemma, kind: 'n', gen, g, show, mean, hook: hook || null, pl,
    enPl: x.noPlural ? [] : mean.map(enPlural), person: !!x.person, trap: !!x.trap,
    entry: `${lemma} -${gen === 'i' ? 'ī' : 'ae'} ${g}` });
};
const A = (stage, lemma, show, mean, hook, x = {}) => {
  const stem = lemma === 'alter' ? 'alter' : lemma.slice(0, -2);
  const forms = { m: { sg: lemma, pl: stem + 'ī' }, f: { sg: stem + 'a', pl: stem + 'ae' } };
  WORDS.push({ id: letters(lemma), stage, lemma, kind: 'a', show, mean, hook: hook || null, rest: x.rest || null, near: x.near || null,
    forms, phrase: x.phrase !== false, entry: x.rest ? `${lemma}, ${x.rest}` : `${lemma} -a -um` });
};
const V = (stage, lemma, pair, num, show, mean, base, prog, wrongNum, hook) => {
  WORDS.push({ id: letters(lemma), stage, lemma, kind: 'v', pair, num, show, mean, base, prog, wrongNum, hook: hook || null,
    entry: num === 'sg' ? `${lemma}/${pair}` : `${pair}/${lemma}` });
};
const X = (stage, lemma, show, mean, hook, x = {}) => {
  WORDS.push({ id: letters(lemma), stage, lemma, kind: 'x', show, mean, hook: hook || null, forms: x.forms || null, entry: lemma });
};

/* ---------------- Stage 1 ---------------- */
N(1, 'amica', 'ae', 'f', 'friend (female)', ['friend', 'female friend'], 'amicable = friendly', { person: true });
N(1, 'amicus', 'i', 'm', 'friend (male)', ['friend', 'male friend'], 'amicable = friendly', { person: true });
N(1, 'cibus', 'i', 'm', 'food', ['food'], null, { pl: null, noPlural: true });
N(1, 'discipula', 'ae', 'f', 'student (female)', ['student', 'female student', 'pupil'], 'a disciple is a student', { person: true });
N(1, 'discipulus', 'i', 'm', 'student (male)', ['student', 'male student', 'pupil'], 'a disciple is a student', { person: true });
N(1, 'equus', 'i', 'm', 'horse', ['horse'], 'equestrian = horse riding');
N(1, 'femina', 'ae', 'f', 'woman', ['woman', 'lady'], 'feminine', { person: true });
N(1, 'magistra', 'ae', 'f', 'teacher (female)', ['teacher', 'female teacher'], 'magistra → mistress (an old word for teacher)', { person: true });
N(1, 'porta', 'ae', 'f', 'gate', ['gate'], 'a portal is a gateway');
N(1, 'puella', 'ae', 'f', 'girl', ['girl'], null, { person: true });
N(1, 'Roma', 'ae', 'f', 'Rome', ['rome'], null, { pl: null, noPlural: true });
N(1, 'puer', 'i', 'm', 'boy', ['boy'], 'puerile = childish', { person: true });
N(1, 'villa', 'ae', 'f', 'summer house / villa', ['summer house', 'villa', 'house', 'country house'], null);
N(1, 'via', 'ae', 'f', 'road', ['road', 'street', 'way'], 'you travel "via" a road');
N(1, 'vir', 'i', 'm', 'man', ['man'], null, { person: true });
A(1, 'bonus', 'good', ['good'], 'a bonus is something good');
A(1, 'defessus', 'tired', ['tired', 'exhausted', 'weary', 'worn out'], null);
A(1, 'laetus', 'happy', ['happy', 'glad', 'joyful', 'cheerful'], 'laetus has an e. latus (no e) means wide');
A(1, 'latus', 'wide', ['wide', 'broad'], 'latitude lines run wide across a map. laetus (with an e) is happy');
A(1, 'longus', 'long', ['long'], null);
A(1, 'magnus', 'big / great', ['big', 'great', 'large'], 'magnify = make bigger');
A(1, 'malus', 'bad', ['bad', 'evil'], 'malicious = bad on purpose');
A(1, 'parvus', 'small', ['small', 'little', 'tiny'], null);
A(1, 'Romanus', 'Roman', ['roman'], null);
X(1, 'et', 'and', ['and'], 'et cetera = "and the rest"');
X(1, 'ita vero', 'yes', ['yes'], null);
X(1, 'minime', 'no', ['no', 'not at all'], 'minimum = the least, so "no"');
X(1, 'sed', 'but', ['but'], null);
X(1, 'aut', 'or', ['or'], null);

/* ---------------- Stage 2 ---------------- */
N(2, 'ager', 'i', 'm', 'field', ['field'], 'agriculture = field work', { pl: 'agrī' });
N(2, 'agricola', 'ae', 'm', 'farmer', ['farmer'], 'agri + cola = field worker', { trap: true, person: true });
N(2, 'familia', 'ae', 'f', 'family', ['family'], null);
N(2, 'hortus', 'i', 'm', 'garden', ['garden'], 'horticulture = gardening');
N(2, 'magister', 'i', 'm', 'teacher (male)', ['teacher', 'male teacher'], 'magister → master', { pl: 'magistrī', person: true });
N(2, 'nauta', 'ae', 'm', 'sailor', ['sailor'], 'nautical = about sailing', { trap: true, person: true });
N(2, 'poeta', 'ae', 'm', 'poet', ['poet'], null, { trap: true, person: true });
N(2, 'servus', 'i', 'm', 'servant / enslaved man', ['servant', 'enslaved man', 'enslaved person', 'slave'], 'a servant serves', { person: true });
A(2, 'alter', 'another', ['another', 'the other', 'other'], 'alternate = another one', { rest: 'altera, alterum', phrase: false });
A(2, 'iratus', 'angry', ['angry', 'mad', 'furious'], 'irate = angry');
A(2, 'molestus', 'annoying', ['annoying', 'troublesome', 'bothersome'], 'a molestus person is a pest');
A(2, 'multus', 'much / many', ['much', 'many', 'a lot of', 'a lot', 'lots of'], 'multi = many');
A(2, 'solus', 'alone / lonely', ['alone', 'lonely'], 'a solo is done alone');
A(2, 'vicinus', 'neighboring', ['neighboring', 'neighbouring', 'nearby'], 'vicinity = the area nearby',
  { near: { neighbor: 'Close, but vicinus is an adjective: neighboring.', neighbour: 'Close, but vicinus is an adjective: neighboring.' } });
V(2, 'est', 'sunt', 'sg', 'is', ['is'], 'are', null, ['are'], 'est = is (Spanish es, French est)');
V(2, 'habitat', 'habitant', 'sg', 'lives', ['lives', 'dwells', 'lives in', 'is living'], 'live', 'living', ['live', 'dwell'], 'a habitat is where an animal lives');
V(2, 'legit', 'legunt', 'sg', 'reads', ['reads', 'is reading'], 'read', 'reading', ['read'], 'legible = easy to read');
V(2, 'sedet', 'sedent', 'sg', 'sits', ['sits', 'is sitting', 'sits down'], 'sit', 'sitting', ['sit'], 'sedentary = sitting a lot');
V(2, 'scribit', 'scribunt', 'sg', 'writes', ['writes', 'is writing'], 'write', 'writing', ['write'], 'a scribe writes');
V(2, 'sunt', 'est', 'pl', 'are', ['are'], 'are', null, ['is'], null);
X(2, 'cur', 'why?', ['why'], 'curious people ask why');
X(2, 'etiam', 'also', ['also', 'too'], 'et + iam. Don\'t mix it up with iam (now)');
X(2, 'iam', 'now', ['now', 'already'], 'iam hides inside etiam, but alone it means now');
X(2, 'non', 'not', ['not'], 'non- means not (nonstop)');
X(2, 'quī/quae', 'who (always subject)', ['who'], 'quī/quae is always the subject', { forms: ['quī', 'quae'] });
X(2, 'quod', 'because', ['because'], null);
X(2, 'quoque', 'also', ['also', 'too'], 'quoque and etiam both mean also');
X(2, 'statim', 'immediately', ['immediately', 'at once', 'right away', 'instantly'], 'a doctor yelling "stat!" means immediately');
X(2, 'subito', 'suddenly', ['suddenly', 'all of a sudden'], 'subito sounds like sudden');
X(2, 'ubi', 'where / when', ['where', 'when'], 'ubiquitous = found everywhere');

export const W = Object.fromEntries(WORDS.map(w => [w.id, w]));
export const STAGES = [...new Set(WORDS.map(w => w.stage))].sort((a, b) => a - b);
export const MAX_STAGE = Math.max(...STAGES);
export const STAGE_NAMES = { 1: 'Stage 1 · Nouns & adjectives', 2: 'Stage 2 · Simple sentences' };
