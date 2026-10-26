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
  const accStem = gen === 'ae' ? lemma.slice(0, -1) : (pl ? pl.slice(0, -1) : (lemma.endsWith('us') ? lemma.slice(0, -2) : lemma));
  const acc = gen === 'ae' ? { sg: accStem + 'am', pl: accStem + 'as' } : { sg: accStem + 'um', pl: accStem + 'os' };
  const abl = gen === 'ae' ? { sg: accStem + 'ā', pl: accStem + 'īs' } : { sg: accStem + 'ō', pl: accStem + 'īs' };
  const gen8 = gen === 'ae' ? { sg: accStem + 'ae', pl: accStem + 'ārum' } : { sg: accStem + 'ī', pl: accStem + 'ōrum' };
  const dat9 = gen === 'ae' ? { sg: accStem + 'ae', pl: accStem + 'īs' } : { sg: accStem + 'ō', pl: accStem + 'īs' };
  WORDS.push({ id: letters(lemma), stage, lemma, kind: 'n', gen, g, show, mean, hook: hook || null, pl, acc, abl, gen8, dat9,
    enPl: x.noPlural ? [] : (x.enPl || mean.map(enPlural)), person: !!x.person, animal: !!x.animal, abstract: !!x.abstract, trap: !!x.trap,
    entry: x.entry || `${lemma} -${gen === 'i' ? 'ī' : 'ae'} ${g}` });
};
const A = (stage, lemma, show, mean, hook, x = {}) => {
  const stem = x.stem || (lemma === 'alter' ? 'alter' : lemma.slice(0, -2));
  const forms = { m: { sg: lemma, pl: stem + 'ī' }, f: { sg: stem + 'a', pl: stem + 'ae' } };
  const acc = { m: { sg: stem + 'um', pl: stem + 'os' }, f: { sg: stem + 'am', pl: stem + 'as' } };
  const abl = { m: { sg: stem + 'ō', pl: stem + 'īs' }, f: { sg: stem + 'ā', pl: stem + 'īs' } };
  const gen8 = { m: { sg: stem + 'ī', pl: stem + 'ōrum' }, f: { sg: stem + 'ae', pl: stem + 'ārum' } };
  const dat9 = { m: { sg: stem + 'ō', pl: stem + 'īs' }, f: { sg: stem + 'ae', pl: stem + 'īs' } };
  WORDS.push({ id: letters(lemma), stage, lemma, kind: 'a', show, mean, hook: hook || null, rest: x.rest || null, near: x.near || null, restOk: x.restOk || null,
    forms, acc, abl, gen8, dat9, poss: x.poss || null, phrase: x.phrase !== false, grammar: x.grammar !== false, entry: x.entry || (x.rest ? `${lemma}, ${x.rest}` : `${lemma} -a -um`) });
};
const V = (stage, lemma, pair, num, show, mean, base, prog, wrongNum, hook) => {
  WORDS.push({ id: letters(lemma), stage, lemma, kind: 'v', pair, num, show, mean, base, prog, wrongNum, hook: hook || null,
    entry: num === 'sg' ? `${lemma}/${pair}` : `${pair}/${lemma}` });
};
const X = (stage, lemma, show, mean, hook, x = {}) => {
  WORDS.push({ id: letters(lemma), stage, lemma, kind: 'x', show, mean, hook: hook || null, forms: x.forms || null, entry: lemma });
};

// 3rd declension noun: dictionary entry gives the genitive (frater, fratris m). Middle stuff is tapped.
const N3 = (stage, lemma, genForm, g, show, mean, x = {}) => {
  const st = genForm.slice(0, -2), gpl = st + (x.ium ? 'ium' : 'um');
  WORDS.push({ id: letters(lemma), stage, lemma, kind: 'n', decl: 3, gen: '3', genForm, g, show, mean, hook: x.hook || null, stem3: st,
    pl: st + 'es', acc: { sg: st + 'em', pl: st + 'es' }, abl: { sg: st + 'e', pl: st + 'ibus' }, gen8: { sg: genForm, pl: gpl }, dat9: { sg: st + 'i', pl: st + 'ibus' },
    enPl: x.enPl || mean.map(enPlural), person: !!x.person, abstract: !!x.abstract, noAdj: !!x.noAdj, noGrammar: true, g3: !x.skip3,
    entry: `${lemma}, ${genForm} ${g}${x.note ? ' ' + x.note : ''}` });
};
// Dictionary-form verb (from Stage 3): amo, amāre. Conjugation comes from the infinitive.
// en: English for sentences: [{sg, pl, ing}] (only for verbs the grammar drills use so far).
const conjOf = inf => { const t = inf.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); if (/^(esse|posse)$/.test(t)) return 'irr';
  return /āre$/.test(inf) ? 1 : /ēre$/.test(inf) ? 2 : /īre$/.test(inf) ? 4 : /ere$/.test(inf) ? 3 : /are$/.test(t) ? 1 : 'irr'; };
const VD = (stage, lemma, inf, entry, show, mean, x = {}) => {
  if (x == null || typeof x === 'string') x = { hook: x || null };
  WORDS.push({ id: letters(lemma), stage, lemma, kind: 'vb', inf, conj: conjOf(inf), show, mean, hook: x.hook || null, entry,
    tr: x.tr ?? null, en: x.en || null, noNeg: !!x.noNeg, objs: x.objs || null, dat: !!x.dat, infChoices: x.infChoices || null });
};
// Preposition: meaning + which case it takes (tapped).
const P = (stage, lemma, takes, show, mean, x = {}) => {
  WORDS.push({ id: x.id || letters(lemma), stage, lemma, kind: 'p', takes, show, mean, hook: x.hook || null, entry: `${lemma} (+${takes})`, forms: x.forms || null });
};
const again = (stage, lemma) => { const w = WORDS.find(z => z.lemma === lemma); w.alsoIn = (w.alsoIn || []).concat(stage); };

/* ---------------- Stage 1 ---------------- */
N(1, 'amica', 'ae', 'f', 'friend (female)', ['friend', 'female friend'], 'amicable = friendly', { person: true });
N(1, 'amicus', 'i', 'm', 'friend (male)', ['friend', 'male friend'], 'amicable = friendly', { person: true });
N(1, 'cibus', 'i', 'm', 'food', ['food'], null, { pl: null, noPlural: true });
N(1, 'discipula', 'ae', 'f', 'student (female)', ['student', 'female student', 'pupil'], 'a disciple is a student', { person: true });
N(1, 'discipulus', 'i', 'm', 'student (male)', ['student', 'male student', 'pupil'], 'a disciple is a student', { person: true });
N(1, 'equus', 'i', 'm', 'horse', ['horse'], 'equestrian = horse riding', { animal: true });
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
A(2, 'solus', 'alone / lonely', ['lonely', 'alone'], 'a solo is done alone');
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

/* ---------------- Stage 3 ---------------- */
// Words and meanings exactly as printed on Ms Matey's sheets.
N(3, 'lupus', 'i', 'm', 'wolf', ['wolf'], null, { animal: true, enPl: ['wolves'] });
N(3, 'ramus', 'i', 'm', 'branch', ['branch'], null);
N(3, 'rivus', 'i', 'm', 'stream', ['stream', 'river', 'creek', 'brook'], null);
N(3, 'schola', 'ae', 'f', 'school', ['school'], null);
N(3, 'silva', 'ae', 'f', 'forest', ['forest', 'woods'], null, { enPl: ['forests'] });
N(3, 'vilicus', 'i', 'm', 'farm manager', ['farm manager', 'manager', 'overseer', 'farm overseer'], null, { person: true });
A(3, 'aureus', 'golden', ['golden', 'gold'], null);
A(3, 'calidus', 'hot', ['hot', 'warm'], null);
A(3, 'frigidus', 'cold', ['cold', 'chilly', 'freezing'], null);
A(3, 'ignavus', 'lazy', ['lazy'], null);
A(3, 'infirmus', 'weak/sick', ['weak', 'sick', 'ill', 'weak/sick'], null);
// English past tense (for the imperfect: jumped / was jumping / used to jump)
const PAST = { love: 'loved', like: 'liked', walk: 'walked', hear: 'heard', 'listen to': 'listened to', run: 'ran', have: 'had', own: 'owned', live: 'lived', sit: 'sat',
  scare: 'scared', frighten: 'frightened', terrify: 'terrified', fear: 'feared', annoy: 'annoyed', bother: 'bothered', see: 'saw', watch: 'watched',
  appear: 'appeared', 'show up': 'showed up', fall: 'fell', 'fall down': 'fell down', shout: 'shouted', yell: 'yelled', teach: 'taught', hurry: 'hurried', rush: 'rushed',
  laugh: 'laughed', smile: 'smiled', call: 'called', summon: 'summoned', praise: 'praised', work: 'worked', remain: 'remained', stay: 'stayed', speak: 'spoke', say: 'said',
  talk: 'talked', know: 'knew', stand: 'stood', think: 'thought', 'eat dinner': 'ate dinner', dine: 'dined', 'have dinner': 'had dinner', sleep: 'slept', sail: 'sailed',
  play: 'played', tell: 'told', narrate: 'narrated', carry: 'carried', bring: 'brought', fight: 'fought', write: 'wrote',
  'call together': 'called together', gather: 'gathered', lead: 'led', guide: 'guided', wander: 'wandered', roam: 'roamed', cry: 'cried', weep: 'wept',
  read: 'read', put: 'put', place: 'placed', try: 'tried', test: 'tested',
  give: 'gave', order: 'ordered', command: 'commanded', entrust: 'entrusted', 'hand over': 'handed over', show: 'showed', announce: 'announced', report: 'reported',
  rest: 'rested', 'stay awake': 'stayed awake', 'keep watch': 'kept watch',
  open: 'opened', cook: 'cooked', rejoice: 'rejoiced', 'be glad': 'were glad', move: 'moved', 'drive off': 'drove off', 'drive away': 'drove away', repel: 'repelled',
  'push back': 'pushed back', reply: 'replied', answer: 'answered', respond: 'responded', ask: 'asked', deliver: 'delivered',
  prepare: 'prepared', 'get ready': 'got ready', hold: 'held', keep: 'kept', save: 'saved', protect: 'protected', come: 'came', arrive: 'arrived' };
const E = (sg, pl, ing) => ({ sg, pl, ing, past: PAST[pl] || null });
VD(3, 'amo', 'amāre', 'amo, amāre', 'to love', ['to love', 'to like'], { tr: 'any', en: [E('loves', 'love', 'loving'), E('likes', 'like', 'liking')] });
VD(3, 'ambulo', 'ambulāre', 'ambulo, ambulāre', 'to walk', ['to walk'], { tr: false, en: [E('walks', 'walk', 'walking')] });
VD(3, 'audio', 'audīre', 'audio, audīre', 'to hear', ['to hear', 'to listen to', 'to listen'], { tr: 'anim', en: [E('hears', 'hear', 'hearing'), E('listens to', 'listen to', 'listening to')] });
VD(3, 'curro', 'currere', 'curro, currere', 'to run', ['to run'], { tr: false, en: [E('runs', 'run', 'running')] });
VD(3, 'habeo', 'habēre', 'habeo, habēre', 'to have', ['to have', 'to hold', 'to own'], { tr: 'have', en: [E('has', 'have', null), E('owns', 'own', null)] });
VD(3, 'habito', 'habitāre', 'habito, habitāre', 'to live', ['to live', 'to dwell', 'to live in'], { tr: false, en: [E('lives', 'live', 'living')] });
VD(3, 'sedeo', 'sedēre', 'sedeo, sedēre', 'to sit', ['to sit'], { tr: false, en: [E('sits', 'sit', 'sitting')] });
VD(3, 'terreo', 'terrēre', 'terreo, terrēre', 'to scare', ['to scare', 'to frighten', 'to terrify'], { tr: 'anim', en: [E('scares', 'scare', 'scaring'), E('frightens', 'frighten', 'frightening'), E('terrifies', 'terrify', 'terrifying')] });
VD(3, 'timeo', 'timēre', 'timeo, timēre', 'to be afraid, to fear', ['to be afraid', 'to fear', 'to be afraid of', 'to be scared'], { tr: 'anim', en: [E('fears', 'fear', 'fearing'), E('is afraid of', 'are afraid of', null), E('is scared of', 'are scared of', null)] });
VD(3, 'vexo', 'vexāre', 'vexo, vexāre', 'to annoy', ['to annoy', 'to bother', 'to irritate', 'to harass'], { tr: 'anim', en: [E('annoys', 'annoy', 'annoying'), E('bothers', 'bother', 'bothering')] });
VD(3, 'video', 'vidēre', 'video, vidēre', 'to see', ['to see', 'to look at', 'to watch'], { tr: 'any', en: [E('sees', 'see', 'seeing'), E('watches', 'watch', 'watching')] });
X(3, 'hodie', 'today', ['today'], 'hodie sounds like "ho, today!"');
X(3, 'ibi', 'there', ['there'], null);
X(3, 'nonnumquam', 'sometimes', ['sometimes'], 'non + numquam = not never = sometimes');
X(3, 'numquam', 'never', ['never'], null);
X(3, 'semper', 'always', ['always', 'forever'], 'semper fidelis = always faithful');
again(3, 'subito');
X(3, 'tandem', 'finally', ['finally', 'at last', 'at length'], 'a tandem bike: finally someone to ride with');
again(3, 'quī/quae');

/* ---------------- Stage 4 ---------------- */
N(4, 'ancilla', 'ae', 'f', 'enslaved woman', ['enslaved woman', 'servant', 'slave woman', 'maid', 'female servant', 'slave'], null, { person: true });
N(4, 'aqua', 'ae', 'f', 'water', ['water'], 'aquarium = water tank', {});
N(4, 'dea', 'ae', 'f', 'goddess', ['goddess'], null, { person: true });
N(4, 'deus', 'i', 'm', 'god', ['god'], 'deity', { person: true, entry: 'deus ī m' });
N(4, 'ira', 'ae', 'f', 'anger', ['anger', 'rage', 'wrath'], 'irate = angry', { abstract: true });
N(4, 'pecunia', 'ae', 'f', 'money', ['money', 'cash'], 'pecuniary = about money', { abstract: true });
A(4, 'inimicus', 'unfriendly/ hostile', ['unfriendly', 'hostile', 'enemy'], 'in + amicus = not friendly');
A(4, 'occupatus', 'busy', ['busy', 'occupied'], 'occupied = busy');
A(4, 'perterritus', 'terrified/ scared', ['terrified', 'scared', 'frightened', 'very scared', 'afraid'], null);
A(4, 'tardus', 'slow', ['slow', 'late'], 'tardy = late');
A(4, 'temerarius', 'rash/ reckless', ['rash', 'reckless', 'bold', 'daring'], null);
VD(4, 'appereo', 'apparēre', 'appereo, apparēre', 'to appear', ['to appear', 'to show up'], { tr: false, en: [E('appears', 'appear', 'appearing'), E('shows up', 'show up', 'showing up')] });
VD(4, 'cado', 'cadere', 'cado, cadere', 'to fall', ['to fall', 'to fall down'], { tr: false, en: [E('falls', 'fall', 'falling'), E('falls down', 'fall down', 'falling down')] });
VD(4, 'clamo', 'clamāre', 'clamo, clamāre', 'to shout', ['to shout', 'to yell', 'to call out', 'to cry out'], { tr: false, en: [E('shouts', 'shout', 'shouting'), E('yells', 'yell', 'yelling')] });
VD(4, 'doceo', 'docēre', 'doceo, docēre', 'to teach', ['to teach'], { tr: 'anim', en: [E('teaches', 'teach', 'teaching')] });
VD(4, 'festino', 'festināre', 'festino, festināre', 'to hurry', ['to hurry', 'to rush', 'to hasten'], { tr: false, en: [E('hurries', 'hurry', 'hurrying'), E('rushes', 'rush', 'rushing')] });
VD(4, 'rideo', 'ridēre', 'rideo, ridēre', 'to laugh', ['to laugh', 'to smile', 'to laugh at'], { hook: 'ridiculous', tr: false, en: [E('laughs', 'laugh', 'laughing'), E('smiles', 'smile', 'smiling')] });
VD(4, 'taceo', 'tacēre', 'taceo, tacēre', 'to be quiet', ['to be quiet', 'to be silent', 'quiet', 'silent'], { tr: false, en: [E('is quiet', 'are quiet', null), E('is silent', 'are silent', null)] });
VD(4, 'voco', 'vocāre', 'voco, vocāre', 'to call', ['to call', 'to call for', 'to summon'], { tr: 'anim', en: [E('calls', 'call', 'calling'), E('summons', 'summon', 'summoning')] });
X(4, 'eos/eas', 'them (always acc.)', ['them'], null, { forms: ['eos', 'eas'] });
X(4, 'eum', 'him (always acc.)', ['him'], null);
X(4, 'eam', 'her (always acc.)', ['her'], null);
X(4, 'nunc', 'now', ['now'], null);
X(4, 'quamquam', 'although', ['although', 'even though', 'though'], null);
X(4, 'tum', 'then', ['then', 'next'], null);
X(4, 'ego', 'I (always nom.)', ['i', 'me'], 'ego = I, me, myself');
X(4, 'tu', 'You (sg. always nom.)', ['you'], null);
X(4, 'nos', 'We (always nom.)', ['we', 'us'], null);
X(4, 'vos', 'You (pl. always nom.)', ['you', 'you all', "y'all", 'you guys'], null);

/* ---------------- Stage 5 ---------------- */
N(5, 'barbarus', 'i', 'm', 'foreigner', ['foreigner', 'barbarian'], null, { person: true });
N(5, 'fossa', 'ae', 'f', 'ditch', ['ditch', 'trench'], null);
N(5, 'insula', 'ae', 'f', 'island', ['island', 'apartment building'], 'insulate = make an island', {});
N(5, 'regina', 'ae', 'f', 'queen', ['queen'], 'regal = royal', { person: true });
N(5, 'terra', 'ae', 'f', 'land/ground', ['land', 'ground', 'earth'], 'terrain', {});
VD(5, 'cogito', 'cogitāre', 'cogito, cogitāre, cogitavī, cogitatus (or -āre, -avī, -atus)', 'to think', ['to think', 'to consider'], { tr: false, en: [E('thinks', 'think', 'thinking')] });
VD(5, 'laudo', 'laudāre', 'laudo, -āre, -avī, -atus', 'to praise', ['to praise'], { hook: 'applaud', tr: 'anim', en: [E('praises', 'praise', 'praising')] });
VD(5, 'laboro', 'laborāre', 'laboro, -āre, -avī, -atus', 'to work', ['to work'], { hook: 'labor = work', tr: false, en: [E('works', 'work', 'working')] });
VD(5, 'maneo', 'manēre', 'maneo, manēre, mansi, mansurus', 'to remain', ['to remain', 'to stay'], { tr: false, en: [E('remains', 'remain', 'remaining'), E('stays', 'stay', 'staying')] });
VD(5, 'nescio', 'nescīre', 'nescio, nescīre, nescivī, nescitus (or -īre, -ivī, -itus)', 'to not know', ['to not know', 'not to know', "to not know", "don't know"], { tr: 'any', noNeg: true, en: [{ sg: 'does not know', pl: 'do not know', ing: null, fixed: true }] });
VD(5, 'dico', 'dicere', 'dico, dicere, dixi, dictus', 'to speak/ say', ['to speak', 'to say', 'to tell'], { hook: 'dictate', tr: false, en: [E('speaks', 'speak', 'speaking'), E('says', 'say', 'saying'), E('talks', 'talk', 'talking')] });
VD(5, 'scio', 'scīre', 'scio, -īre, -ivī, -itus', 'to know', ['to know'], { hook: 'science = knowing', tr: 'any', en: [E('knows', 'know', null)] });
VD(5, 'sto', 'stāre', 'sto, stāre, steti, status', 'to stand', ['to stand'], { hook: 'statue = something standing', tr: false, en: [E('stands', 'stand', 'standing')] });
P(5, 'a/ab', 'ablative', 'away from (+ablative)', ['away from', 'from', 'by'], { forms: ['a', 'ab'] });
P(5, 'ad', 'accusative', 'to/towards/at (+accusative)', ['to', 'towards', 'toward', 'at']);
P(5, 'circum', 'accusative', 'around (+accusative)', ['around'], { hook: 'circumference' });
P(5, 'cum', 'ablative', 'with (+ablative)', ['with']);
P(5, 'de', 'ablative', 'about (+ablative)', ['about', 'concerning', 'down from', 'from']);
P(5, 'e/ex', 'ablative', 'out of (+ablative)', ['out of', 'from', 'out from'], { forms: ['e', 'ex'], hook: 'exit' });
P(5, 'in + ablative', 'ablative', 'in/on (+ablative)', ['in', 'on'], { id: 'inabl' });
P(5, 'in + accusative', 'accusative', 'into/onto (+accusative)', ['into', 'onto'], { id: 'inacc' });
P(5, 'pro', 'ablative', 'for (+ablative)', ['for', 'in front of', 'on behalf of'], { hook: 'a pro-Burke vote = for Burke' });
P(5, 'prope', 'accusative', 'near (+accusative)', ['near', 'close to', 'nearby'], { hook: 'propinquity = nearness' });
P(5, 'sine', 'ablative', 'without (+ablative)', ['without'], { hook: 'sine = without; a sinecure is a job without work' });
P(5, 'trans', 'accusative', 'across (+accusative)', ['across', 'over'], { hook: 'transatlantic = across the Atlantic' });

/* ---------------- Stage 6 ---------------- */
N(6, 'causa', 'ae', 'f', 'cause, reason', ['cause', 'reason'], null, { abstract: true });
N(6, 'culpa', 'ae', 'f', 'blame', ['blame', 'fault', 'guilt'], 'culprit', { abstract: true, entry: 'culpa - ae f' });
N(6, 'dominus', 'i', 'm', 'master', ['master', 'lord', 'owner'], 'dominate', { person: true });
N(6, 'filia', 'ae', 'f', 'daughter', ['daughter'], 'filial = like a son or daughter', { person: true });
N(6, 'filius', 'i', 'm', 'son', ['son'], null, { person: true });
N(6, 'nuntius', 'i', 'm', 'messenger', ['messenger', 'message', 'news'], 'a papal nuncio carries messages', { person: true });
N(6, 'socius', 'i', 'm', 'ally', ['ally', 'companion', 'partner', 'comrade'], 'social', { person: true });
A(6, 'sollicitus', 'worried, anxious', ['worried', 'anxious', 'nervous'], 'solicitous = anxious to help');
A(6, 'salvus', 'safe, unharmed', ['safe', 'unharmed'], 'salvage = save');
A(6, 'scelestus', 'wicked', ['wicked', 'evil', 'villainous'], null);
A(6, 'praeclarus', 'famous', ['famous', 'well known', 'distinguished', 'renowned', 'famed'], 'prae + clarus = very bright');
VD(6, 'ceno', 'cenāre', 'ceno, -āre, -avī, -atus', 'to eat dinner', ['to eat dinner', 'to dine', 'to have dinner', 'eat dinner'], { tr: false, en: [E('eats dinner', 'eat dinner', 'eating dinner'), E('dines', 'dine', 'dining'), E('has dinner', 'have dinner', 'having dinner')] });
VD(6, 'dormio', 'dormīre', 'dormio -īre, -ivī, -itus', 'to sleep', ['to sleep'], { hook: 'dormitory = where you sleep', tr: false, en: [E('sleeps', 'sleep', 'sleeping')] });
VD(6, 'navigo', 'navigāre', 'navigo -āre, -avī, -atus', 'to sail', ['to sail', 'to navigate'], { hook: 'navigate', tr: false, en: [E('sails', 'sail', 'sailing')] });
VD(6, 'paro', 'parāre', 'paro -āre, -avī, -atus', 'to prepare', ['to prepare', 'to get ready', 'to make ready'], { hook: 'prepare', tr: 'thing', en: [E('prepares', 'prepare', 'preparing'), E('gets ready', 'get ready', 'getting ready')], dat: true });
VD(6, 'teneo', 'tenēre', 'teneo, tenēre, tenuī, tentus', 'to hold', ['to hold', 'to keep', 'to have'], { hook: 'tenacious', tr: 'thing', en: [E('holds', 'hold', 'holding'), E('keeps', 'keep', 'keeping')] });
VD(6, 'servo', 'servāre', 'servo, -āre, -avī, -atus', 'to save', ['to save', 'to keep', 'to protect', 'to preserve'], { hook: 'preserve', tr: 'anim', en: [E('saves', 'save', 'saving'), E('protects', 'protect', 'protecting')] });
VD(6, 'venio', 'venīre', 'venio, venīre, venī, ventus', 'to come', ['to come', 'to arrive'], { hook: 'venue = where people come', tr: false, en: [E('comes', 'come', 'coming'), E('arrives', 'arrive', 'arriving')] });
X(6, 'heri', 'yesterday', ['yesterday'], null);
X(6, 'diu', 'for a long time', ['for a long time', 'a long time', 'long'], null);
X(6, 'furtim', 'stealthily', ['stealthily', 'secretly', 'sneakily', 'quietly'], 'furtive = sneaky');
X(6, 'paulisper', 'for a short time', ['for a short time', 'a short time', 'for a little while', 'briefly', 'for a while'], null);
X(6, '-ne', 'attached to the first word of a sentence makes a question', ['makes a question', 'question', 'question mark', 'asks a question', 'turns it into a question', 'makes it a question', 'it makes a question'], null);
X(6, '-que', 'and (attached to the end of a word)', ['and'], null);

/* ---------------- Stage 7 ---------------- */
N(7, 'area', 'ae', 'f', 'area, place, open space', ['area', 'place', 'open space', 'space'], null);
N(7, 'cena', 'ae', 'f', 'dinner', ['dinner', 'meal', 'supper'], null);
N(7, 'fabula', 'ae', 'f', 'story', ['story', 'tale', 'play'], 'fable');
N(7, 'ianua', 'ae', 'f', 'door', ['door'], 'January = the door to the year');
N(7, 'iocus', 'i', 'm', 'joke', ['joke'], 'jocular = joking', { entry: 'iocus -i m' });
N(7, 'rusticus', 'i', 'm', 'peasant', ['peasant', 'farmer', 'country person', 'rustic'], 'rustic = from the country', { person: true });
N(7, 'vita', 'ae', 'f', 'life', ['life'], 'vital', { abstract: true });
A(7, 'novus', 'new', ['new'], 'novel = new');
A(7, 'primus', 'first', ['first'], 'primary');
A(7, 'secundus', 'second', ['second'], null);
A(7, 'tertius', 'third', ['third'], null);
X(7, 'accidit', 'it happens', ['it happens', 'happens', 'it happened'], 'accident = something that happens');
VD(7, 'ludo', 'ludere', 'ludo, ludere, lusī, lusus', 'to play', ['to play'], { hook: 'ludicrous', tr: false, en: [E('plays', 'play', 'playing')] });
VD(7, 'narro', 'narrāre', 'narro, -āre, -avī, -atus', 'to tell (a story)', ['to tell', 'to tell a story', 'to narrate', 'to tell (a story)'], { hook: 'narrate', tr: 'thing', en: [E('tells', 'tell', 'telling'), E('narrates', 'narrate', 'narrating')], objs: ['fabula', 'iocus'], dat: true });
VD(7, 'porto', 'portāre', 'porto -āre, -avī, -atus', 'to carry', ['to carry', 'to bring'], { hook: 'portable', tr: 'thing', en: [E('carries', 'carry', 'carrying'), E('brings', 'bring', 'bringing')], objs: ['cena', 'cibus', 'pecunia', 'aqua', 'ramus', 'tunica', 'epistula', 'copia'], dat: true });
VD(7, 'possum', 'posse', 'possum, posse, potui, X', 'to be able', ['to be able', 'can', 'to be able to', 'able'], { hook: 'possible', infChoices: ['posse', 'possumāre', 'possumere', 'potēre'] });
VD(7, 'pugno', 'pugnāre', 'pugno -āre, -avī, -atus', 'to fight', ['to fight'], { hook: 'pugnacious = likes to fight', tr: false, en: [E('fights', 'fight', 'fighting')] });
X(7, 'necesse est', 'it is necessary', ['it is necessary', 'necessary', 'it is needed', 'it is essential'], null);
VD(7, 'scribo', 'scribere', 'scribo, scribere, scripsi, scriptus', 'to write', ['to write'], { hook: 'scribble', tr: 'thing', en: [E('writes', 'write', 'writing')], objs: ['fabula', 'epistula'] });
VD(7, 'sum', 'esse', 'sum, esse, fui, futurus', 'to be', ['to be', 'be', 'i am', 'am'], { infChoices: ['esse', 'sumāre', 'sumere', 'sumēre'] });
X(7, 'igitur', 'therefore', ['therefore', 'so', 'thus'], null);
X(7, 'lente', 'slowly', ['slowly'], 'lento = slow in music');
X(7, 'mox', 'soon', ['soon'], null);

/* ---------------- Stage 8 ---------------- */
N(8, 'avia', 'ae', 'f', 'grandmother', ['grandmother', 'grandma'], null, { person: true });
N(8, 'avus', 'i', 'm', 'grandfather', ['grandfather', 'grandpa'], null, { person: true });
N(8, 'copia', 'ae', 'f', 'supply', ['supply', 'abundance', 'plenty'], 'copious = plenty', { abstract: true });
N(8, 'coquus', 'i', 'm', 'cook', ['cook', 'chef'], null, { person: true });
WORDS.push({ id: 'liberi', stage: 8, lemma: 'liberī', kind: 'n', gen: 'orum', g: 'm/f', show: 'children', mean: ['children', 'kids'], hook: null, pl: null, acc: null,
  enPl: [], person: true, noGrammar: true, plOnly: true, mid: ['orummf', 'orumfm', 'orum', 'mforum'], midShow: '-ōrum m/f', entry: 'liberī -ōrum m/f' });
N(8, 'memoria', 'ae', 'f', 'memory', ['memory'], null, { abstract: true });
N(8, 'murus', 'i', 'm', 'wall', ['wall'], 'mural = painting on a wall', { entry: 'murus ī m' });
N(8, 'numerus', 'i', 'm', 'number', ['number'], null, { abstract: true });
N(8, 'patruus', 'i', 'm', 'uncle', ['uncle'], null, { person: true });
N(8, 'victoria', 'ae', 'f', 'victory', ['victory', 'win'], null, { abstract: true });
A(8, 'ridiculus', 'silly, laughable', ['silly', 'laughable', 'ridiculous', 'funny'], null);
A(8, 'miser', 'miserable, sad', ['miserable', 'sad', 'unhappy', 'wretched'], null, { stem: 'miser', entry: 'miser -a -um' });
A(8, 'cunctī', 'all', ['all', 'everyone', 'all of them', 'every'], null, { rest: '-ae -a', restOk: ['aea', 'cunctaecuncta', 'aeai'], grammar: false, phrase: false, entry: 'cunctī -ae -a' });
VD(8, 'convoco', 'convocāre', 'convoco, -āre, -avī, -atus', 'to call together', ['to call together', 'to summon', 'to assemble', 'to gather'], { hook: 'convocation', tr: 'anim', en: [E('calls together', 'call together', 'calling together'), E('summons', 'summon', 'summoning'), E('gathers', 'gather', 'gathering')] });
VD(8, 'duco', 'ducere', 'duco, ducere, duxi, ductus', 'to lead', ['to lead', 'to take', 'to guide'], { hook: 'duct, conductor', tr: 'anim', en: [E('leads', 'lead', 'leading'), E('guides', 'guide', 'guiding')] });
VD(8, 'erro', 'errāre', 'erro, -āre, -avī, -atus', 'to wander', ['to wander', 'to stray', 'to roam', 'to make a mistake'], { hook: 'errant', tr: false, en: [E('wanders', 'wander', 'wandering'), E('roams', 'roam', 'roaming')] });
VD(8, 'lacrimo', 'lacrimāre', 'lacrimo, -āre, -avī, -atus', 'to cry', ['to cry', 'to weep'], { hook: 'lacrimal = tear gland', tr: false, en: [E('cries', 'cry', 'crying'), E('weeps', 'weep', 'weeping')] });
VD(8, 'lego', 'legere', 'lego, legere, legī, lectus', 'to read', ['to read', 'to choose'], { hook: 'legible', tr: 'thing', en: [E('reads', 'read', 'reading')], objs: ['fabula', 'epistula'], dat: true });
VD(8, 'pono', 'ponere', 'pono, ponere, posuī, positus', 'to put, place', ['to put', 'to place', 'to set'], { hook: 'position', tr: 'thing', en: [E('puts', 'put', 'putting'), E('places', 'place', 'placing')], objs: ['cibus', 'cena', 'pecunia', 'ramus', 'tunica', 'epistula', 'aqua'] });
VD(8, 'tempto', 'temptāre', 'tempto, -āre, -avī, -atus', 'to try', ['to try', 'to attempt', 'to test', 'to tempt'], { hook: 'attempt', tr: 'thing', en: [E('tries', 'try', 'trying'), E('tests', 'test', 'testing')], objs: ['cibus', 'cena', 'aqua'] });
X(8, 'atque', 'and, and so', ['and', 'and so', 'and also'], null);
X(8, 'fortasse', 'by chance', ['by chance', 'perhaps', 'maybe', 'possibly'], null);
X(8, 'identidem', 'again and again', ['again and again', 'repeatedly', 'over and over'], null);
X(8, 'iterum', 'again', ['again'], 'reiterate = say again');
X(8, 'simul', 'at the same time', ['at the same time', 'together', 'simultaneously'], 'simultaneous');
X(8, 'neque', 'and...not', ['and not', 'and...not', 'nor', 'neither'], null);

/* ---------------- Stage 9 ---------------- */
N(9, 'epistula', 'ae', 'f', 'letter', ['letter', 'epistle'], 'epistle');
N(9, 'poena', 'ae', 'f', 'punishment', ['punishment', 'penalty'], 'penalty', { abstract: true });
N(9, 'raeda', 'ae', 'f', 'carriage', ['carriage', 'coach', 'wagon'], null);
N(9, 'raedarius', 'i', 'm', 'driver, coachman', ['driver', 'coachman', 'carriage driver'], null, { person: true });
N(9, 'taberna', 'ae', 'f', 'shop', ['shop', 'store', 'inn', 'tavern'], 'tavern');
N(9, 'tabellarius', 'i', 'm', 'courier (someone who makes a delivery or transports something)', ['courier', 'messenger', 'delivery man', 'mail carrier', 'mailman'], null, { person: true });
N(9, 'turba', 'ae', 'f', 'crowd', ['crowd', 'mob'], 'turbulent');
N(9, 'tunica', 'ae', 'f', 'tunic', ['tunic'], null);
N(9, 'vicus', 'i', 'm', 'village', ['village', 'town'], 'vicinity');
N(9, 'fama', 'ae', 'f', 'fame, reputation', ['fame', 'reputation', 'rumor'], null, { abstract: true });
A(9, 'mirus', 'wonderful', ['wonderful', 'amazing', 'strange', 'marvelous', 'remarkable'], 'miracle');
A(9, 'periculosus', 'dangerous', ['dangerous', 'perilous', 'risky'], 'perilous');
A(9, 'plenus', 'full', ['full'], 'plenty');
A(9, 'strenuus', 'active', ['active', 'energetic', 'hardworking', 'vigorous'], 'strenuous');
VD(9, 'do', 'dāre', 'do, dāre, dedi, datus', 'to give', ['to give'], { hook: 'donate', infChoices: ['dāre', 'dēre', 'dere', 'dīre'], tr: 'thing', en: [E('gives', 'give', 'giving')], objs: ['pecunia', 'cibus', 'poena', 'epistula', 'equus', 'tunica', 'aqua', 'cena', 'copia', 'fabula'], dat: true });
VD(9, 'iubeo', 'iubēre', 'iubeo, iubēre, iussi, iussus', 'to order', ['to order', 'to command', 'to tell'], { tr: 'anim', en: [E('orders', 'order', 'ordering'), E('commands', 'command', 'commanding')] });
X(9, 'inquit', 'he, she says/said', ['he says', 'she says', 'he said', 'she said', 'says', 'said', 'he/she says', 'he/she said'], null);
VD(9, 'mando', 'mandāre', 'mando, -āre, -avī, -atus', 'to entrust', ['to entrust', 'to hand over', 'to command', 'to order'], { hook: 'mandate', tr: 'thing', en: [E('entrusts', 'entrust', 'entrusting'), E('hands over', 'hand over', 'handing over')], objs: ['pecunia', 'epistula', 'villa', 'equus', 'raeda', 'taberna'], dat: true });
VD(9, 'monstro', 'monstrāre', 'monstro, -āre, -avī, -atus', 'to show', ['to show', 'to point out', 'to demonstrate'], { hook: 'demonstrate', tr: 'thing', en: [E('shows', 'show', 'showing')], objs: ['villa', 'hortus', 'ager', 'via', 'epistula', 'fabula', 'tunica', 'raeda', 'taberna', 'vicus', 'insula'], dat: true });
VD(9, 'nuntio', 'nuntiāre', 'nuntio, -āre, -avī, -atus', 'to announce', ['to announce', 'to report'], { hook: 'announce', tr: 'thing', en: [E('announces', 'announce', 'announcing'), E('reports', 'report', 'reporting')], objs: ['victoria', 'poena'], dat: true });
VD(9, 'quiesco', 'quiescere', 'quiesco, quiescere, quievī, quietus', 'to be quiet/calm', ['to be quiet', 'to be calm', 'to rest', 'to relax', 'quiet', 'calm'], { hook: 'quiet', tr: false, en: [E('rests', 'rest', 'resting'), E('is calm', 'are calm', null), E('is quiet', 'are quiet', null)] });
VD(9, 'vigilo', 'vigilāre', 'vigilo, -āre, -avī, -atus', 'to be awake, to remain awake', ['to be awake', 'to remain awake', 'to stay awake', 'to keep watch', 'awake'], { hook: 'vigilant', tr: false, en: [E('stays awake', 'stay awake', 'staying awake'), E('keeps watch', 'keep watch', 'keeping watch'), E('is awake', 'are awake', null)] });
X(9, 'bene', 'well', ['well', 'good'], 'benefit');
X(9, 'ferociter', 'fiercely, ferociously', ['fiercely', 'ferociously'], 'ferocious');
X(9, 'olim', 'once', ['once', 'once upon a time', 'one day', 'long ago'], null);
X(9, 'praeterea', 'besides', ['besides', 'moreover', 'in addition', 'furthermore'], null);
X(9, 'procul', 'at a distance, far off', ['at a distance', 'far off', 'far away', 'far', 'in the distance'], null);
X(9, 'tantum', 'so much', ['so much', 'only'], null);

/* ---------------- Stage 10 ---------------- */
N3(10, 'frater', 'fratris', 'm', 'brother', ['brother'], { person: true, hook: 'fraternity' });
N3(10, 'lux', 'lucis', 'f', 'light', ['light'], { hook: 'lucid', abstract: true });
N3(10, 'mater', 'matris', 'f', 'mother', ['mother', 'mom'], { person: true, hook: 'maternal' });
N3(10, 'miles', 'militis', 'm', 'soldier', ['soldier'], { person: true, hook: 'military' });
N3(10, 'mors', 'mortis', 'f', 'death', ['death'], { hook: 'mortal', abstract: true });
N3(10, 'mons', 'montis', 'f', 'mountain', ['mountain', 'mount', 'hill'], { hook: 'mount', noAdj: true });
N3(10, 'pater', 'patris', 'm', 'father', ['father', 'dad'], { person: true, hook: 'paternal' });
N3(10, 'parens', 'parentis', 'm/f', 'parent', ['parent'], { person: true, skip3: true });
N3(10, 'rex', 'regis', 'm', 'king', ['king'], { person: true, hook: 'T. rex = king lizard' });
N3(10, 'soror', 'sororis', 'f', 'sister', ['sister'], { person: true, hook: 'sorority' });
N3(10, 'urbs', 'urbis', 'f', 'city (ium)', ['city'], { note: '(ium)', hook: 'urban', ium: true, enPl: ['cities'] });
N3(10, 'vox', 'vocis', 'f', 'voice', ['voice'], { hook: 'vocal', abstract: true });
A(10, 'meus', 'my', ['my', 'mine'], null, { grammar: false, poss: ['my'] });
A(10, 'tuus', 'your', ['your', 'yours'], null, { grammar: false, poss: ['your'] });
A(10, 'suus', 'his, hers, its, theirs', ['his', 'hers', 'its', 'theirs', 'her', 'their', 'his own', 'their own'], null, { grammar: false, poss: ['his', 'her', 'its', 'their', 'his own', 'her own', 'its own', 'their own'] });
A(10, 'noster', 'our', ['our', 'ours'], null, { stem: 'nostr', rest: 'nostra, nostrum', restOk: ['aum', 'raum', 'rarum', 'nostranostrum', 'nosternostranostrum'], grammar: false, poss: ['our'], entry: 'noster, nostra, nostrum' });
A(10, 'vester', 'your (plural you)', ['your', 'yours', "y'all's", 'your (plural)'], null, { stem: 'vestr', rest: 'vestra, vestrum', restOk: ['aum', 'raum', 'rarum', 'vestravestrum', 'vestervestravestrum'], grammar: false, poss: ['your', "y'all's", 'your (plural)'], entry: 'vester, vestra, vestrum' });
VD(10, 'aperio', 'aperīre', 'aperio, aperīre, aperuī, apertus', 'to open', ['to open'], { hook: 'aperture = an opening', tr: 'thing', en: [E('opens', 'open', 'opening')], objs: ['ianua', 'porta', 'taberna', 'epistula', 'villa', 'schola'] });
VD(10, 'coquo', 'coquere', 'coquo, coquere, coxī, coctus', 'to cook', ['to cook'], { hook: 'coquus = cook', tr: 'thing', en: [E('cooks', 'cook', 'cooking')], objs: ['cena', 'cibus'] });
VD(10, 'gaudeo', 'gaudēre', 'gaudeo, gaudēre, X, gavisus sum', 'to rejoice', ['to rejoice', 'to be glad', 'to be happy'], { hook: 'gaudy', tr: false, en: [E('rejoices', 'rejoice', 'rejoicing'), E('is glad', 'are glad', null), E('is happy', 'are happy', null)] });
VD(10, 'moveo', 'movēre', 'moveo, movēre, movī, motus', 'to move', ['to move'], { tr: 'thing', en: [E('moves', 'move', 'moving')], objs: ['raeda', 'ramus', 'equus', 'murus'] });
VD(10, 'repello', 'repellere', 'repello, repellere, reppulī, repulsus', 'to drive off', ['to drive off', 'to drive away', 'to repel', 'to push back'], { hook: 'repel', tr: 'anim', en: [E('drives off', 'drive off', 'driving off'), E('drives away', 'drive away', 'driving away'), E('repels', 'repel', 'repelling'), E('pushes back', 'push back', 'pushing back')] });
VD(10, 'respondeo', 'respondēre', 'respondeo, respondēre, respondī, responsurus', 'to reply', ['to reply', 'to respond', 'to answer'], { hook: 'respond', tr: false, en: [E('replies', 'reply', 'replying'), E('answers', 'answer', 'answering'), E('responds', 'respond', 'responding')] });
VD(10, 'rogo', 'rogāre', 'rogo -āre, -avī, -atus', 'to ask', ['to ask', 'to ask for'], { hook: 'interrogate', tr: 'anim', en: [E('asks', 'ask', 'asking')] });
VD(10, 'trado', 'tradere', 'trado, tradere, tradidī, traditus', 'to hand over', ['to hand over', 'to give', 'to deliver', 'to surrender', 'to betray'], { hook: 'tradition = handed down', tr: 'thing', en: [E('hands over', 'hand over', 'handing over'), E('gives', 'give', 'giving'), E('delivers', 'deliver', 'delivering')], objs: ['pecunia', 'epistula', 'cibus', 'tunica', 'equus', 'raeda'], dat: true });

export const W = Object.fromEntries(WORDS.map(w => [w.id, w]));
export const STAGES = [...new Set(WORDS.map(w => w.stage))].sort((a, b) => a - b);
export const MAX_STAGE = Math.max(...STAGES);
export const STAGE_NAMES = { 1: 'Stage 1 · Nouns & adjectives', 2: 'Stage 2 · Simple sentences', 3: 'Stage 3 · Direct objects & the accusative', 4: 'Stage 4 · The present tense',
  5: 'Stage 5 · Prepositional phrases', 6: 'Stage 6 · The imperfect tense', 7: 'Stage 7 · Irregular verbs', 8: 'Stage 8 · The genitive case', 9: 'Stage 9 · The dative case', 10: 'Stage 10 · Third declension' };
/* ---------- which units are turned on (parent ticks them) ---------- */
export const DEFAULT_UNITS = [1, 2, 3];
export const UNITS = { on: DEFAULT_UNITS.slice() };
export const unitsOf = settings => { const u = settings && Array.isArray(settings.units) && settings.units.length ? settings.units.map(Number) : DEFAULT_UNITS; return [...new Set(u)].filter(x => STAGES.includes(x)).sort((a, b) => a - b); };
export const setUnits = arr => { UNITS.on = arr.slice(); };
export const stageOn = s => UNITS.on.includes(s);
export const isOn = w => stageOn(w.stage) || (w.alsoIn || []).some(stageOn);
export const inUnit = (w, s) => w.stage === s || (w.alsoIn || []).includes(s);
export const curUnit = () => Math.max(...UNITS.on);
