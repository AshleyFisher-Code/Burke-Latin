// Card builders. Every builder takes explicit parameters so tests can enumerate all of them;
// the random pickers below choose parameters, preferring words he hasn't seen in a while.
import { WORDS, W, letters, isOn, stageOn } from './data.js';
import { G, gradeMiddle, gradeMeaning, gradeOtherForm, gradeLatin, gradeAlso, gradeNID, gradeNumber, pack,
  latTokens, sameBag, enKey, normEn, fuzzyEn } from './grade.js';

export const pickOne = a => a[Math.floor(Math.random() * a.length)];
export const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const proper = s => s.replace(/\broman\b/g, 'Roman').replace(/\brome\b/g, 'Rome');
const decl = w => (w.gen === 'ae' ? '1st' : '2nd');
// Same card always shows its buttons in the same order (cards are rebuilt from saved specs).
const seeded = (arr, seed) => { let h = 2166136261; for (const ch of JSON.stringify(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; const j = h % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const uniq = arr => { const seen = new Set(); return arr.filter(x => { const k = letters(x); if (seen.has(k)) return false; seen.add(k); return true; }); };
const adjChoices = (a, seed) => seeded(uniq([a.forms.m.sg, a.forms.f.sg, a.forms.m.pl, a.forms.f.pl]), seed);

/* =============== vocabulary cards =============== */
// Tap choices for the second box on newer word types (no Latin is ever typed).
const infOpts = w => { if (w.infChoices) return w.infChoices;
  const stem = w.inf.replace(/(āre|ēre|ere|īre|are)$/, ''); return [w.inf, ...['āre', 'ēre', 'ere', 'īre'].map(e => stem + e).filter(f => f !== w.inf)]; };
const genOpts = w => { const g2 = w.g === 'm' ? 'f' : w.g === 'f' ? 'm' : 'm'; const base = w.genForm;
  return uniq([`${base} ${w.g}`, `${base} ${g2}`, `-ī ${w.g === 'm/f' ? 'm' : w.g}`, `-ae ${w.g === 'm/f' ? 'f' : w.g}`]); };
export function secondField(w) {
  if (w.kind === 'vb') return { label: 'Infinitive', choices: seeded(infOpts(w), ['inf', w.id]) };
  if (w.kind === 'p') return w.id === 'inabl' || w.id === 'inacc' ? null : { label: 'Takes', choices: ['accusative', 'ablative'] };
  if (w.kind === 'n' && w.decl === 3) return { label: 'Middle stuff', choices: seeded(genOpts(w), ['gen', w.id]) };
  return undefined; // default: typed middle stuff / number buttons
}
function gradeSecond(v, w) {
  if (w.kind === 'vb') { const ok = v === w.inf; return ok ? { ok } : { ok: false, hint: v ? `${w.lemma}'s infinitive is ${w.inf}${w.conj === 'irr' ? ' (irregular: memorize it)' : ` (${['', '1st', '2nd', '3rd', '4th'][w.conj]} conjugation)`}.` : null }; }
  if (w.kind === 'p') { const ok = v === w.takes; return ok ? { ok } : { ok: false, hint: v ? `${w.lemma.split(' ')[0]} takes the ${w.takes}.` : null }; }
  if (w.kind === 'n' && w.decl === 3) { const want = `${w.genForm} ${w.g}`, ok = v === want;
    return ok ? { ok } : { ok: false, hint: v ? `3rd declension: the middle stuff is the genitive (${w.genForm}) plus the gender (${w.g}): ${want}.` : null }; }
  return gradeMiddle(v, w);
}
export function vocabL2E(w) {
  const sf = secondField(w);
  if (sf !== undefined) {
    const fields = [{ label: 'Meaning', ph: 'English' }].concat(sf ? [sf] : []);
    return {
      type: 'l2e', cid: 'w:' + w.id, words: [w.id], hook: w.hook, stage: w.stage,
      instr: w.kind === 'vb' ? 'Meaning, then tap the infinitive.' : w.kind === 'p' ? (sf ? 'Meaning, then tap the case it takes.' : 'What does it mean?') : 'Meaning, then tap the middle stuff.',
      prompt: { latin: w.lemma }, fields,
      check: v => pack(sf ? [gradeMeaning(v[0], w), gradeSecond(v[1], w)] : [gradeMeaning(v[0], w)]),
      correct: vocabAnswer(w), summary: w.lemma,
      answers: [w.show, ...(sf ? [w.kind === 'vb' ? w.inf : w.kind === 'p' ? w.takes : `${w.genForm} ${w.g}`] : [])],
    };
  }
  const second = w.kind !== 'x';
  return {
    type: 'l2e', cid: 'w:' + w.id, words: [w.id], hook: w.hook, stage: w.stage,
    instr: w.kind === 'x' ? 'What does it mean?' : w.kind === 'v' ? 'Meaning, then tap singular or plural.' : 'Meaning, then the middle stuff.',
    prompt: { latin: w.lemma },
    fields: [{ label: 'Meaning', ph: 'English' }].concat(second ? [w.kind === 'v' ? { label: 'Number', choices: ['singular', 'plural'] } : { label: 'Middle stuff', ph: 'middle stuff' }] : []),
    check: v => {
      if (!second) return pack([gradeMeaning(v[0], w)]);
      if (w.kind !== 'v') return pack([gradeMeaning(v[0], w), gradeMiddle(v[1], w)]);
      let r0 = gradeMeaning(v[0], w); const r1 = gradeVerbNum(v[1], w);
      // The button already tests singular/plural, so "live" for habitat counts when he tapped singular.
      if (!r0.ok && r1.ok && verbOtherNum(v[0], w)) r0 = { ok: true, note: `Full meaning: ${w.num === 'sg' ? 'he/she' : 'they'} ${w.show}` };
      return pack([r0, r1]);
    },
    correct: vocabAnswer(w), summary: w.lemma,
    answers: [w.show, w.kind === 'v' ? (w.num === 'sg' ? 'singular' : 'plural') : w.midShow ? w.midShow : w.kind === 'a' ? (w.restOk ? w.rest : '-a -um') : `-${w.gen === 'i' ? 'ī' : 'ae'} ${w.g}`],
  };
}
export function vocabE2L(w) {
  const second = w.kind !== 'x';
  return {
    type: 'e2l', cid: 'w:' + w.id, words: [w.id], hook: w.hook, stage: w.stage,
    instr: w.kind === 'x' ? (w.forms ? 'Write it in Latin. Give both forms.' : 'Write it in Latin.') : w.kind === 'v' ? `Latin, then the ${w.num === 'sg' ? 'plural' : 'singular'} form.` : 'Latin, then the middle stuff.',
    prompt: { eng: w.show },
    fields: [{ label: 'Latin', ph: 'Latin' }].concat(second ? [{ label: w.kind === 'v' ? (w.num === 'sg' ? 'Plural form' : 'Singular form') : 'Middle stuff', ph: w.kind === 'v' ? 'Latin' : 'middle stuff' }] : []),
    check: v => pack(second ? [gradeLatin(v[0], w), w.kind === 'v' ? gradeOtherForm(v[1], w) : gradeMiddle(v[1], w)] : [gradeLatin(v[0], w)]),
    correct: vocabAnswer(w), summary: `${w.show} → Latin`,
  };
}
export function vocabAlso() {
  return {
    type: 'also', cid: 'w:etiam', words: ['etiam', 'quoque'], hook: 'etiam = et + iam. quoque ends in -que.', stage: 2,
    instr: 'Two Latin words mean "also." Type both.', prompt: { eng: 'also' },
    fields: [{ label: 'Latin word 1', ph: 'Latin' }, { label: 'Latin word 2', ph: 'Latin' }],
    check: v => gradeAlso(v[0], v[1]), correct: 'etiam and quoque', summary: 'also → both Latin words',
  };
}
function verbOtherNum(v, w) {
  if (w.id === 'est' || w.id === 'sunt') return false; // is/are are different words, not a dropped -s
  const n = normEn(v).replace(/^(he\/she\/it|he\/she|he or she|s\/he|he|she|it|they)\s+/, ''); if (!n) return false;
  const other = w.wrongNum.map(normEn); return other.includes(n) || !!fuzzyEn(n, other, w.mean.map(normEn));
}
function gradeVerbNum(v, w) {
  const r = gradeNumber(v, w.num); if (r.ok || !v) return r;
  return { ok: false, hint: w.id === 'est' ? 'est is singular (is). sunt is the plural (are).' : w.id === 'sunt' ? 'sunt is plural (are). est is the singular (is).' : w.num === 'sg' ? `${w.lemma} ends in -t, so it's singular.` : `${w.lemma} ends in -nt, so it's plural.` };
}
// Tap the meaning. opts = ids of the other words to show (picked by the session, saved in the spec).
export function vocabPick(w, opts) {
  const all = seeded([w.id, ...opts], [w.id, ...opts]).map(id => W[id]);
  return {
    type: 'pick', cid: 'w:' + w.id, words: [w.id], hook: w.hook, stage: w.stage,
    instr: 'Tap what it means.', prompt: { latin: w.lemma },
    fields: [{ label: 'Meaning', choices: all.map(x => x.show) }],
    check: v => ({ ok: [v[0] === w.show], hints: v[0] && v[0] !== w.show ? [`${w.lemma} means ${w.show}.`] : [], notes: [] }),
    correct: `${w.lemma}: ${w.show}`, summary: w.lemma,
  };
}
// Distractors for vocabPick: same kind of word, meaning doesn't overlap.
export function pickOpts(w) {
  const mine = new Set(w.mean.map(normEn));
  const pool = WORDS.filter(x => x.id !== w.id && x.show !== w.show && !x.mean.some(m => mine.has(normEn(m))));
  const same = shuffle(pool.filter(x => x.kind === w.kind)), other = shuffle(pool.filter(x => x.kind !== w.kind));
  const seen = new Set([w.show]), out = [];
  for (const x of same.concat(other)) { if (seen.has(x.show)) continue; seen.add(x.show); out.push(x.id); if (out.length === 3) break; }
  return out;
}
export function vocabAnswer(w) {
  if (w.kind === 'vb' || w.kind === 'p') return `${w.entry}: ${w.show}`;
  if (w.kind === 'v') return `${w.lemma}: ${w.show}  (${w.num === 'sg' ? 'singular' : 'plural'})`;
  if (w.kind === 'x') return `${w.lemma}: ${w.show}`;
  return `${w.entry}: ${w.show}`;
}

/* =============== grammar building blocks =============== */
export const NOUNS = WORDS.filter(w => w.kind === 'n' && w.id !== 'roma' && !w.noGrammar && !w.abstract);
export const PL_NOUNS = NOUNS.filter(w => w.pl);
export const ADJS = WORDS.filter(w => w.kind === 'a' && w.grammar !== false);
export const PHRASE_ADJS = ADJS.filter(w => w.phrase);
export const PERSONS = NOUNS.filter(w => w.person);
export const ACTION_VERBS = WORDS.filter(w => w.kind === 'v' && w.num === 'sg' && w.id !== 'est' && w.id !== 'habitat');
// Feelings only make sense for people; keep generated sentences sensible.
const FEELINGS = ['defessus', 'laetus', 'iratus', 'solus', 'ignavus', 'infirmus', 'inimicus', 'occupatus', 'perterritus', 'temerarius', 'tardus',
  'sollicitus', 'scelestus', 'miser', 'strenuus'];
const ANIMAL_FEELINGS = ['defessus', 'laetus', 'iratus', 'ignavus', 'infirmus', 'perterritus', 'tardus', 'solus'];
const THING_ONLY = ['aureus', 'plenus', 'calidus', 'frigidus'];
const SHAPES = ['longus', 'latus'], SHAPED = ['via', 'porta', 'villa', 'ager', 'hortus', 'equus', 'rivus', 'silva', 'ramus', 'fossa', 'insula', 'murus', 'ianua', 'tunica'];
export const fits = (n, a) => {
  if (SHAPES.includes(a.id)) return SHAPED.includes(n.id) && !n.person;
  if (n.person) return !THING_ONLY.includes(a.id);
  if (n.animal) return !THING_ONLY.includes(a.id) && (!FEELINGS.includes(a.id) || ANIMAL_FEELINGS.includes(a.id));
  return !FEELINGS.includes(a.id);
};
const COMP_SKIP = ['multus', 'vicinus', 'alter'];
export const COMP_ADJS = WORDS.filter(w => w.kind === 'a' && w.grammar !== false && !COMP_SKIP.includes(w.id));
const nForm = (w, num) => (num === 'sg' ? w.lemma : w.pl);
const nEn = (w, num) => (num === 'sg' ? w.mean : w.enPl);
export const aForm = (a, g, num) => a.forms[g][num];
const LV = num => (num === 'sg' ? 'est' : 'sunt');

// subject = {nouns:[{id,num}], num, g}
export function subj(ids, num) {
  const ws = ids.map(id => W[id]);
  if (ws.length === 1) return { nouns: [{ id: ws[0].id, num }], num, g: ws[0].g, latin: nForm(ws[0], num) };
  const g = ws.some(w => w.g === 'm') ? 'm' : 'f';
  return { nouns: ws.map(w => ({ id: w.id, num: 'sg' })), num: 'pl', g, compound: true, latin: ws.map(w => w.lemma).join(' et ') };
}
function subjEnOptions(s) {
  if (!s.compound) return nEn(W[s.nouns[0].id], s.nouns[0].num);
  const [a, b] = s.nouns.map(n => W[n.id].mean);
  const out = []; for (const x of a) for (const y of b) out.push(`${x} and ${y}`); return out;
}
const enAns = arr => [...new Set(arr.map(enKey))];
const S_CAP = s => cap(s);

/* =============== Stage 1 skills =============== */
export function gNID(id, num) {
  const w = W[id], form = nForm(w, num);
  return {
    type: 'nid', skill: 'nid', cid: 'g:nid', words: [id], stage: w.stage,
    instr: 'Number, gender and declension.', prompt: { latin: form },
    fields: [{ label: 'Number', choices: ['singular', 'plural'] }, { label: 'Gender', choices: ['masculine', 'feminine'] }, { label: 'Declension', choices: ['1st', '2nd'] }],
    check: v => gradeNID(v, w, num),
    correct: `${form}: ${num === 'sg' ? 'singular' : 'plural'}, ${G(w.g)}, ${decl(w)} declension  (${w.entry})`, summary: `Noun ID: ${form}`, params: [id, num],
  };
}
export const CHARTS = [
  { id: 'n1', title: '1st Declension Nouns', sg: 'a', pl: 'ae', stage: 1 },
  { id: 'n2', title: '2nd Declension Nouns', sg: 'us', pl: 'ī', stage: 1, sgAlso: ['usorr', 'usr', 'user', 'usorer'] },
  { id: 'af', title: 'Feminine Adjectives', sg: 'a', pl: 'ae', stage: 1 },
  { id: 'am', title: 'Masculine Adjectives', sg: 'us', pl: 'ī', stage: 1 },
  { id: 'vb', title: 'Verb Endings', sg: 't', pl: 'nt', stage: 2 },
  // Stage 3: nominative + accusative, like the chart in the packet
  { id: 'c1', title: '1st Declension: Nominative & Accusative', stage: 3, opts: ['-a', '-ae', '-am', '-as'],
    cells: [['Nominative singular', '-a'], ['Nominative plural', '-ae'], ['Accusative singular', '-am'], ['Accusative plural', '-as']] },
  { id: 'c2', title: '2nd Declension: Nominative & Accusative', stage: 3, opts: ['-us / -r', '-ī', '-um', '-os'],
    cells: [['Nominative singular', '-us / -r'], ['Nominative plural', '-ī'], ['Accusative singular', '-um'], ['Accusative plural', '-os']] },
];
export function gChart(cid) {
  const c = CHARTS.find(x => x.id === cid);
  if (c.cells) return {
    type: 'chart', skill: 'charts', cid: 'g:charts', words: [], stage: c.stage,
    instr: 'Tap the ending for each box.', prompt: { chart: c.title },
    fields: c.cells.map(([label]) => ({ label, choices: c.opts })),
    check: v => {
      const ok = c.cells.map(([, want], i) => v[i] === want), hints = [];
      if (!ok[2] && v[2] === c.cells[0][1]) hints.push('That\'s the nominative. The accusative singular ends in ' + c.cells[2][1] + '.');
      if (!ok[3] && v[3] === c.cells[1][1]) hints.push('That\'s the nominative plural. The accusative plural ends in ' + c.cells[3][1] + '.');
      if (!ok.every(Boolean) && !hints.length) hints.push('Nominative = subjects and complements. Accusative = direct objects.');
      return { ok, hints, notes: [] };
    },
    correct: c.cells.map(([l, w]) => `${l.replace('Nominative', 'Nom.').replace('Accusative', 'Acc.')} ${w}`).join(' · '), summary: `${c.title} chart`, params: [cid],
  };
  return {
    type: 'chart', skill: 'charts', cid: 'g:charts', words: [], stage: c.stage,
    instr: 'Tap the endings.', prompt: { chart: c.title },
    fields: (opts => [{ label: 'Singular', choices: opts }, { label: 'Plural', choices: opts }])(c.id === 'vb' ? ['-t', '-nt'] : ['-a', '-ae', '-us', '-ī']),
    check: v => {
      const s = letters(v[0]), p = letters(v[1]);
      const ok = [s === letters(c.sg) || (c.sgAlso || []).includes(s), p === letters(c.pl)];
      const hints = [];
      if (s === letters(c.pl) && p === letters(c.sg)) hints.push('Singular and plural are swapped.');
      if (c.id === 'vb' && !ok[0]) hints.push('Think est (singular, ends in -t) and sunt (plural, ends in -nt).');
      return { ok, hints, notes: [] };
    },
    correct: `Singular -${c.sg} · Plural -${c.pl}`, summary: `${c.title} chart`, params: [cid],
  };
}
export function gAgree(nid, num, aid) {
  const n = W[nid], a = W[aid], form = nForm(n, num), want = aForm(a, n.g, num);
  return {
    type: 'agree', skill: 'agree', cid: 'g:agree', words: [nid, aid], stage: Math.max(n.stage, a.stage),
    instr: 'Tap the adjective that matches the noun.', prompt: { latin: `${form} ___`, sub: `(${a.lemma})` },
    fields: [{ label: 'Adjective', choices: adjChoices(a, [nid, num, aid]) }],
    check: v => {
      const t = letters(v[0]); const ok = t === letters(want);
      return { ok: [ok], hints: ok || !t ? [] : [`${form} is ${G(n.g)} ${num === 'sg' ? 'singular' : 'plural'}, so the adjective needs the ${G(n.g)} ${num === 'sg' ? 'singular' : 'plural'} ending: ${want}.${n.trap ? ` (${n.lemma} is 1st declension but masculine.)` : ''}`], notes: [] };
    },
    correct: `${form} ${want}`, summary: `${form} ___ (${a.lemma})`, params: [nid, num, aid],
  };
}
export function phraseAnswers(n, num, a) { const out = []; for (const am of a.mean) for (const nm of nEn(n, num)) out.push(`${am} ${nm}`); return enAns(out); }
export function gPhrase(nid, num, aid, adjFirst = false) {
  const n = W[nid], a = W[aid], nf = nForm(n, num), af = aForm(a, n.g, num);
  const latin = adjFirst ? `${af} ${nf}` : `${nf} ${af}`;
  const accepted = phraseAnswers(n, num, a), other = num === 'sg' ? 'pl' : 'sg';
  const otherAcc = n.pl ? phraseAnswers(n, other, a) : [];
  return {
    type: 'phrase', skill: 'phrase', cid: 'g:phrase', words: [nid, aid], stage: Math.max(n.stage, a.stage),
    instr: 'Translate into English. Watch the number.', prompt: { latin },
    fields: [{ label: 'English', ph: 'English' }],
    check: v => {
      const k = enKey(v[0]); if (accepted.includes(k)) return { ok: [true], hints: [], notes: [] };
      const k2 = enKey(v[0].replace(/['’]s\b/g, 's')); if (accepted.includes(k2)) return { ok: [true], hints: [], notes: ['No apostrophe for a plural: ' + nEn(n, num)[0] + '.'] };
      const fz = fuzzyEn(k2, accepted, otherAcc); if (fz) return { ok: [true], hints: [], notes: [`Spelled: ${proper(fz)}`] };
      const hints = [];
      if (otherAcc.includes(k)) hints.push(num === 'pl' ? `${nf} is plural, so the English is plural: ${nEn(n, 'pl')[0]}.` : `${nf} is singular, so the English is singular: ${n.mean[0]}.`);
      else if (k && k.split(' ').length >= 2 && accepted.some(x => x.split(' ').reverse().join(' ') === k)) hints.push('In English the adjective comes before the noun.');
      return { ok: [false], hints, notes: [] };
    },
    correct: proper(`${a.mean[0]} ${nEn(n, num)[0]}`), summary: latin, params: [nid, num, aid, adjFirst],
  };
}
// wrongKind: 'g' = wrong gender, 'n' = wrong number
export function gFixPhrase(nid, num, aid, wrongKind) {
  const n = W[nid], a = W[aid], nf = nForm(n, num);
  const good = aForm(a, n.g, num);
  const bad = wrongKind === 'g' ? aForm(a, n.g === 'm' ? 'f' : 'm', num) : aForm(a, n.g, num === 'sg' ? 'pl' : 'sg');
  return {
    type: 'fixphrase', skill: 'fixphrase', cid: 'g:fixphrase', words: [nid, aid], stage: Math.max(n.stage, a.stage),
    instr: 'There\'s an agreement error. Tap the corrected phrase.', prompt: { latin: `“${nf} ${bad}”` },
    fields: [{ label: 'Corrected phrase', choices: seeded(uniq([good, ...adjChoices(a, 0)]).filter(f => letters(f) !== letters(bad)).slice(0, 3).map(f => `${nf} ${f}`), [nid, num, aid, wrongKind]) }],
    check: v => {
      const t = latTokens(v[0]); const ok = sameBag(t, [letters(nf), letters(good)]);
      const hints = [];
      if (!ok && t.length && !t.includes(letters(nf))) hints.push(`Nouns never change. Keep ${nf} and fix the adjective.`);
      else if (!ok && t.length) hints.push(`${nf} is ${G(n.g)} ${num === 'sg' ? 'singular' : 'plural'}, so the adjective is ${good}.${n.trap ? ` (${n.lemma} is masculine even though it's 1st declension.)` : ''}`);
      return { ok: [ok], hints, notes: [] };
    },
    correct: `${nf} ${good}`, summary: `Fix: ${nf} ${bad}`, params: [nid, num, aid, wrongKind],
  };
}

/* =============== Stage 2 skills =============== */
export function verbEnglish(vw, num) {
  if (vw.id === 'est' || vw.id === 'sunt') return num === 'sg' ? ['is'] : ['are'];
  if (num === 'sg') return vw.mean;
  const out = [vw.base, 'are ' + vw.prog];
  if (vw.id === 'habitat') out.push('dwell', 'live in', 'are living');
  return out;
}
export function gVnum(vid, num) {
  const vw = W[vid], form = num === 'sg' ? vw.lemma : vw.pair;
  const en = verbEnglish(vw.id === 'sunt' ? W.est : vw, num);
  const accepted = new Set(en.map(normEn).flatMap(e => [e, ...(num === 'sg' ? ['he ' + e, 'she ' + e, 'it ' + e, 'he/she ' + e] : ['they ' + e])]));
  const otherEn = verbEnglish(vw.id === 'sunt' ? W.est : vw, num === 'sg' ? 'pl' : 'sg').map(normEn);
  return {
    type: 'vnum', skill: 'vnum', cid: 'g:vnum', words: [vw.id === 'sunt' ? 'est' : vw.id], stage: 2,
    instr: 'Singular or plural? Then translate it.', prompt: { latin: form },
    fields: [{ label: 'Number', choices: ['singular', 'plural'] }, { label: 'English', ph: 'English' }],
    check: v => {
      const r0 = { ...gradeNumber(v[0], num) }; const e = normEn(v[1]);
      const otherAll = otherEn.flatMap(x => [x, ...(num === 'sg' ? ['they ' + x] : ['he ' + x, 'she ' + x, 'it ' + x])]);
      const fz = !accepted.has(e) && fuzzyEn(e, [...accepted], otherAll);
      // Number is tested by the button; if he got that right, the other-number English still shows he knows the verb.
      const bare = vw.id !== 'est' && vw.id !== 'sunt' && !accepted.has(e) && !fz && r0.ok && e && (otherAll.includes(e) || !!fuzzyEn(e, otherAll, [...accepted]));
      const ok1 = accepted.has(e) || !!fz || bare;
      if (fz) r0.note = (r0.note ? r0.note + ' ' : '') + `Spelled: ${fz}`;
      if (bare) r0.note = (r0.note ? r0.note + ' ' : '') + `Full meaning: ${num === 'sg' ? 'he/she ' : 'they '}${en[0]}`;
      const hints = [];
      if (!r0.ok) hints.push(num === 'sg' ? `${form} ends in -t, so it's singular.` : `${form} ends in -nt, so it's plural.`);
      if (!ok1 && e && otherEn.includes(e.replace(/^(he|she|it|they) /, ''))) hints.push(`That's the ${num === 'sg' ? 'plural' : 'singular'} English. ${form} is ${num === 'sg' ? 'singular' : 'plural'}: ${en[0]}.`);
      return { ok: [r0.ok, ok1], hints, notes: r0.note ? [r0.note] : [] };
    },
    correct: `${form}: ${num === 'sg' ? 'singular' : 'plural'}, "${num === 'sg' ? 'he/she ' : 'they '}${en[0]}"`, summary: `${form}: number + English`, params: [vid, num],
  };
}
// Subject–verb agreement. subjIds: 1 or 2 noun ids; num ignored for compound.
export function gSV(subjIds, num, vid) {
  const s = subj(subjIds, num), vw = W[vid], want = s.num === 'sg' ? vw.lemma : vw.pair;
  return {
    type: 'sv', skill: 'sv', cid: 'g:sv', words: [...subjIds, vid], stage: 2,
    instr: 'Tap the verb that agrees with the subject.', prompt: { latin: `${s.latin} ___` },
    fields: [{ label: 'Verb', choices: [vw.lemma, vw.pair] }],
    check: v => {
      const t = letters(v[0]); const ok = t === letters(want); const hints = [];
      if (!ok && t) hints.push(s.compound ? 'Two singular nouns joined by et count as a plural subject, so the verb ends in -nt.' : `${s.latin} is ${s.num === 'sg' ? 'singular → the verb ends in -t' : 'plural → the verb ends in -nt'}.${vw.id === 'est' ? ' (est is singular, sunt is plural.)' : ''}`);
      return { ok: [ok], hints, notes: [] };
    },
    correct: `${s.latin} ${want}`, summary: `${s.latin} ___ (${vw.lemma}/${vw.pair})`, params: [subjIds, num, vid],
  };
}
export function gComp(subjIds, num, aid) {
  const s = subj(subjIds, num), a = W[aid], want = aForm(a, s.g, s.num);
  return {
    type: 'comp', skill: 'comp', cid: 'g:comp', words: [...subjIds, aid], stage: 2,
    instr: 'The complement agrees with the subject. Tap the right one.', prompt: { latin: `${s.latin} ${LV(s.num)} ___`, sub: `(${a.lemma})` },
    fields: [{ label: 'Complement', choices: adjChoices(a, [subjIds, num, aid]) }],
    check: v => {
      const t = letters(v[0]); const ok = t === letters(want); const hints = [];
      if (!ok && t) {
        if (s.compound) hints.push(`A compound subject is plural.${s.g === 'm' && subjIds.some(id => W[id].g === 'f') ? ' When a boy and a girl are mixed, the complement is masculine plural.' : ''} So: ${want}.`);
        else hints.push(`${s.latin} is ${G(s.g)} ${s.num === 'sg' ? 'singular' : 'plural'}, so the complement is ${G(s.g)} ${s.num === 'sg' ? 'singular' : 'plural'}: ${want}.${subjIds.some(id => W[id].trap) ? ' Remember: agricola, nauta and poeta are masculine.' : ''}`);
      }
      return { ok: [ok], hints, notes: [] };
    },
    correct: `${s.latin} ${LV(s.num)} ${want}`, summary: `${s.latin} ${LV(s.num)} ___ (${a.lemma})`, params: [subjIds, num, aid],
  };
}
// order: 0 = S C V, 1 = S V C, 2 = C V S
export function gRole(nid, num, aid, order, ask) {
  const n = W[nid], a = W[aid], S = nForm(n, num), C = aForm(a, n.g, num), V = LV(num);
  const words = order === 0 ? [S, C, V] : order === 1 ? [S, V, C] : [C, V, S];
  const want = ask === 'subject' ? S : C, other = ask === 'subject' ? C : S;
  return {
    type: 'role', skill: 'role', cid: 'g:role', words: [nid, aid], stage: 2,
    instr: `Tap the ${ask.toUpperCase()} of this sentence.`, prompt: { latin: cap(words.join(' ')) + '.' },
    fields: [{ label: cap(ask), choices: words }],
    check: v => {
      const t = letters(v[0]); const ok = t === letters(want); const hints = [];
      if (!ok && t === letters(other)) hints.push(ask === 'subject' ? `${C} is the complement: it describes the subject. The subject is the noun being described: ${S}.` : `${S} is the subject (the noun). The complement is the word that describes it: ${C}.`);
      else if (!ok && t === letters(V)) hints.push(`${V} is the linking verb.`);
      return { ok: [ok], hints, notes: [] };
    },
    correct: `${ask}: ${want}`, summary: `${ask} of "${words.join(' ')}"`, params: [nid, num, aid, order, ask],
  };
}
// Sentence translation. spec = {k:'adj'|'noun'|'act', s:[ids], num, a/c/v, neg, order}
export function sentence(spec) {
  const s = subj(spec.s, spec.num);
  let latin, accepted, latWords, correct;
  const subjOpts = subjEnOptions(s);
  if (spec.k === 'adj' || spec.k === 'noun') {
    const lvEn = s.num === 'sg' ? 'is' : 'are';
    let cLat, cEn;
    if (spec.k === 'adj') { const a = W[spec.a]; cLat = aForm(a, s.g, s.num); cEn = a.mean; }
    else { const c = W[spec.c]; cLat = s.num === 'sg' ? c.lemma : c.pl; cEn = nEn(c, s.num); }
    const neg = spec.neg ? ['non'] : [];
    latWords = spec.order === 1 ? [...s.latin.split(' '), ...neg, LV(s.num), cLat] : [...s.latin.split(' '), cLat, ...neg, LV(s.num)];
    const out = [];
    for (const so of subjOpts) for (const ce of cEn) out.push(`${so} ${lvEn} ${spec.neg ? 'not ' : ''}${ce}`);
    accepted = enAns(out); correct = `The ${subjOpts[0]} ${lvEn} ${spec.neg ? 'not ' : ''}${spec.k === 'noun' ? (s.num === 'sg' ? 'a ' : '') : ''}${cEn[0]}.`.replace(' and ', ' and the ');
  } else {
    const vw = W[spec.v]; const vf = s.num === 'sg' ? vw.lemma : vw.pair;
    latWords = [...s.latin.split(' '), vf];
    const out = []; for (const so of subjOpts) for (const ve of verbEnglish(vw, s.num)) out.push(`${so} ${ve}`);
    accepted = enAns(out); correct = `The ${subjOpts[0]} ${verbEnglish(vw, s.num)[0]}.`.replace(' and ', ' and the ');
  }
  latin = cap(latWords.join(' ')) + '.';
  return { latin, latWords, accepted, correct: proper(correct), s };
}
export function gTrans(spec) {
  const st = sentence(spec);
  const flip = spec.s.length === 1 && W[spec.s[0]].pl ? sentence({ ...spec, num: spec.num === 'sg' ? 'pl' : 'sg' }) : null;
  return {
    type: 'trans', skill: 'trans', cid: 'g:trans', words: [...spec.s, spec.a || spec.c || spec.v].filter(Boolean), stage: 2,
    instr: 'Translate. Find the verb first.', prompt: { latin: st.latin },
    fields: [{ label: 'English', ph: 'English', wide: true }],
    check: v => {
      const k = enKey(v[0]); if (st.accepted.includes(k)) return { ok: [true], hints: [], notes: [] };
      const k2 = enKey(v[0].replace(/['’]s\b/g, 's')); if (st.accepted.includes(k2)) return { ok: [true], hints: [], notes: ['No apostrophe for a plural.'] };
      const fz = fuzzyEn(k2, st.accepted, flip ? flip.accepted : []); if (fz) return { ok: [true], hints: [], notes: [`Spelled: ${proper(fz)}`] };
      const hints = [], toks = k.split(' ');
      if (flip && flip.accepted.includes(k)) hints.push(spec.num === 'pl' ? `The subject is plural (${st.s.latin}), so the English is plural: "${st.correct}"` : `The subject is singular (${st.s.latin}), so the English is singular.`);
      else if (spec.k !== 'act' && !toks.includes('is') && !toks.includes('are') && k) hints.push(`${spec.num === 'sg' && !st.s.compound ? 'est' : 'sunt'} is a linking verb, so the English needs "${st.s.num === 'sg' ? 'is' : 'are'}" between the subject and the complement.`);
      else if (spec.k !== 'act' && st.s.num === 'pl' && toks.includes('is')) hints.push('sunt is plural, so it\'s "are," not "is."');
      else if (spec.k !== 'act' && st.s.num === 'sg' && toks.includes('are')) hints.push('est is singular, so it\'s "is," not "are."');
      if (st.s.compound && !toks.includes('and')) hints.push('et means and: two subjects.');
      if (spec.neg && !toks.includes('not')) hints.push('non means not.');
      return { ok: [false], hints, notes: [] };
    },
    correct: st.correct, summary: st.latin, params: [spec],
  };
}
// Fix-the-error sentences. err: 'verb' (wrong est/sunt), 'adj-g', 'adj-n', 'noun-g' (mixed compound with feminine plural noun complement)
export function gFixSent(spec, err) {
  const st = sentence(spec); const good = st.latWords.map(letters);
  const bad = st.latWords.slice();
  const s = st.s;
  if (err === 'verb') { const i = bad.findIndex(x => x === 'est' || x === 'sunt'); bad[i] = bad[i] === 'est' ? 'sunt' : 'est'; }
  else if (err === 'adj-g') { const a = W[spec.a]; const i = bad.indexOf(aForm(a, s.g, s.num)); bad[i] = aForm(a, s.g === 'm' ? 'f' : 'm', s.num); }
  else if (err === 'adj-n') { const a = W[spec.a]; const i = bad.indexOf(aForm(a, s.g, s.num)); bad[i] = aForm(a, s.g, s.num === 'sg' ? 'pl' : 'sg'); }
  else if (err === 'noun-g') { const c = W[spec.c]; const twin = W[c.twinF]; const i = bad.indexOf(c.pl); bad[i] = twin.pl; }
  const subjToks = s.latin.split(' ').map(letters);
  const badLatin = cap(bad.join(' ')) + '.';
  return {
    type: 'fixsent', skill: 'fixsent', cid: 'g:fixsent', words: st.latWords.map(x => (NFL[letters(x)] || {}).id).filter(Boolean), stage: 2,
    instr: 'There\'s one grammar error. Tap the corrected sentence.', prompt: { latin: badLatin },
    fields: [{ label: 'Corrected sentence', choices: fixSentChoices(st, spec, err, badLatin) }],
    check: v => {
      const t = latTokens(v[0]); const ok = sameBag(t, good); const hints = [];
      if (!ok && t.length) {
        if (!subjToks.every(x => t.includes(x))) hints.push('Keep the subject the same. Fix the verb or the complement to match it.');
        else if (err === 'verb') hints.push(s.compound ? 'Two subjects joined by et are plural, so the verb is sunt.' : `${s.latin} is ${s.num === 'sg' ? 'singular → est' : 'plural → sunt'}.`);
        else if (err === 'noun-g') hints.push('A mixed group (a man and a woman) takes the masculine plural.');
        else hints.push(`The complement has to match ${s.latin} in gender and number (${G(s.g)} ${s.num === 'sg' ? 'singular' : 'plural'}).`);
      }
      return { ok: [ok], hints, notes: [] };
    },
    correct: cap(st.latWords.join(' ')) + '.', summary: `Fix: ${badLatin}`, params: [spec, err],
  };
}
function fixSentChoices(st, spec, err, badLatin) {
  const good = cap(st.latWords.join(' ')) + '.', s = st.s, out = [good];
  if (spec.k === 'adj') { // every other form of the adjective (the bad one is the prompt, so leave it out)
    const a = W[spec.a], i = st.latWords.indexOf(aForm(a, s.g, s.num));
    for (const f of uniq([a.forms.m.sg, a.forms.f.sg, a.forms.m.pl, a.forms.f.pl])) { const w = st.latWords.slice(); w[i] = f; out.push(cap(w.join(' ')) + '.'); }
  }
  if (err === 'verb' || spec.k === 'adj') { // change the verb instead of the complement: still wrong
    const w = st.latWords.slice(), i = w.findIndex(x => x === 'est' || x === 'sunt'); w[i] = w[i] === 'est' ? 'sunt' : 'est'; out.push(cap(w.join(' ')) + '.');
  }
  if (spec.k === 'noun') { // complement in the other number: still wrong
    const c = W[spec.c], w = st.latWords.slice(), cur = s.num === 'sg' ? c.lemma : c.pl, i = w.indexOf(cur); w[i] = s.num === 'sg' ? c.pl : c.lemma; out.push(cap(w.join(' ')) + '.');
  }
  const opts = uniq(out).filter(x => letters(x) !== letters(badLatin));
  return seeded([good].concat(opts.filter(x => x !== good).slice(0, 2)), [spec, err]);
}
const NFL = {}; WORDS.forEach(w => { NFL[letters(w.lemma)] = w; if (w.pl) NFL[letters(w.pl)] = w; if (w.forms && w.kind === 'a') for (const g of ['m', 'f']) for (const k of ['sg', 'pl']) NFL[letters(w.forms[g][k])] = w; if (w.kind === 'v') NFL[letters(w.pair)] = w; });
// gender twins for noun complements
const TWINS = [['amicus', 'amica'], ['discipulus', 'discipula'], ['magister', 'magistra']];
TWINS.forEach(([m, f]) => { W[m].twinF = f; W[f].twinM = m; });
export const MASC_TWINS = TWINS.map(t => t[0]);

/* =============== skills registry =============== */
// pick(list) chooses from candidate words, preferring ones not seen recently.
export const SKILLS = [
  { id: 'nid', stage: 1, name: 'Noun ID', desc: 'Number, gender and declension' },
  { id: 'charts', stage: 1, name: 'Ending charts', desc: 'Singular and plural endings' },
  { id: 'agree', stage: 1, name: 'Noun–adjective agreement', desc: 'Match the adjective ending' },
  { id: 'phrase', stage: 1, name: 'Translate phrases', desc: 'Noun–adjective pairs, watch the number' },
  { id: 'fixphrase', stage: 1, name: 'Fix the phrase', desc: 'Find the agreement error' },
  { id: 'vnum', stage: 2, name: 'Verb number', desc: '-t singular, -nt plural' },
  { id: 'sv', stage: 2, name: 'Subject–verb agreement', desc: 'Including "puer et puella"' },
  { id: 'comp', stage: 2, name: 'Subject–complement agreement', desc: 'The linking verb is an equals sign' },
  { id: 'role', stage: 2, name: 'Subject or complement?', desc: 'Which word is which' },
  { id: 'trans', stage: 2, name: 'Translate sentences', desc: 'Find the verb first' },
  { id: 'fixsent', stage: 2, name: 'Fix the error', desc: 'Like the worksheet' },
  { id: 'case', stage: 3, name: 'Case & number', desc: 'Nominative or accusative? Decline it' },
  { id: 'objform', stage: 3, name: 'Make it the object', desc: 'Tap the accusative form' },
  { id: 'casefn', stage: 3, name: 'Case & function', desc: 'Like the homework questions' },
  { id: 'dobj', stage: 3, name: 'Translate: who does what', desc: 'Verb, then subject, then object' },
];
export const SKILL = Object.fromEntries(SKILLS.map(s => [s.id, s]));
const coin = p => Math.random() < p;
export function makeSkillCard(skillId, pick = pickOne, maxStage = 99) {
  const inStage = l => { const f = l.filter(w => isOn(w) && w.stage <= maxStage); return f.length ? f : l; };
  const nouns = inStage(PL_NOUNS), adjs = inStage(ADJS), padjs = inStage(PHRASE_ADJS), persons = inStage(PERSONS), cadjs = inStage(COMP_ADJS).filter(a => a.phrase);
  const adjFor = (n, list) => pick(list.filter(a => fits(n, a)));
  const num = () => (coin(0.5) ? 'sg' : 'pl');
  const pair2 = () => { const a = pick(persons); let b = pick(persons.filter(w => w.id !== a.id)); return [a.id, b.id]; };
  if (['pnum', 'vtrans', 'vpick', 'conj'].includes(skillId)) return makeSkillCard4(skillId, pick);
  if (['agree5', 'ppl2e', 'ppe2l'].includes(skillId)) return makeSkillCard5(skillId, pick);
  switch (skillId) {
    case 'case': { const n = pick(nouns), nm = num();
      if (stageOn(5)) { const cas = pickOne(['nom', 'acc', 'abl', 'abl']); return coin(0.5) ? gCase5(n.id, nm, cas) : gDecline5(n.id, nm, cas); }
      const cas = coin(0.6) ? 'acc' : 'nom'; return coin(0.5) ? gCase(n.id, nm, cas) : gDecline(n.id, nm, cas); }
    case 'objform': { const P = pools3(), mode = coin(0.65) ? 'noun' : 'adj'; const tc = randomT(pick, P, { k: 'tr', oaP: mode === 'adj' ? 1 : 0 }); return gObjForm(tc, tc.oa ? mode : 'noun'); }
    case 'casefn': { const P = pools3(); for (let i = 0; i < 20; i++) { const sp = randomSpec3(pick, P, 0.35), asks = caseFnAsks(sp); if (!asks.length) continue; const hard = asks.filter(a => a.role === 'obj' || a.modify || a.role === 'comp' || a.pn || a.subjof || a.role === 'pobj' || a.ppq || a.trq); return gCaseFn(sp, pickOne(hard.length && coin(0.7) ? hard : asks)); } return gCaseFn({ c1: { k: 'tr', s: ['puer'], num: 'sg', v: 'video', o: 'lupus', onum: 'sg', order: 'OSV' } }, { p: 0, role: 'obj', w: 0 }); }
    case 'dobj': return gDobj(randomSpec3(pick, pools3()));
    case 'nid': return gNID(pick(nouns).id, num());
    case 'charts': return gChart(pickOne(CHARTS.filter(c => stageOn(c.stage) && c.stage <= maxStage)).id);
    case 'agree': { const n = pick(nouns); return gAgree(n.id, num(), adjFor(n, adjs).id); }
    case 'phrase': { const n = pick(nouns); return gPhrase(n.id, num(), adjFor(n, padjs).id, coin(0.25)); }
    case 'fixphrase': { const n = pick(nouns); return gFixPhrase(n.id, num(), adjFor(n, adjs.filter(a => a.id !== 'alter')).id, coin(0.6) ? 'g' : 'n'); }
    case 'vnum': { const v = pick(WORDS.filter(w => w.kind === 'v' && w.num === 'sg')); return gVnum(v.id, num()); }
    case 'sv': { const v = pick(WORDS.filter(w => w.kind === 'v' && w.num === 'sg')); const subjPool = v.id === 'est' ? nouns : persons; return coin(0.3) ? gSV(pair2(), 'pl', v.id) : gSV([pick(subjPool).id], num(), v.id); }
    case 'comp': { if (coin(0.3)) return gComp(pair2(), 'pl', pick(cadjs.filter(x => fits(W.puer, x))).id); const n = pick(nouns); return gComp([n.id], num(), adjFor(n, cadjs).id); }
    case 'role': { const n = pick(nouns); return gRole(n.id, num(), adjFor(n, cadjs).id, pickOne([0, 1, 1]), coin(0.5) ? 'subject' : 'complement'); }
    case 'trans': return maxStage >= 2 && coin(0.5) ? gTrans2(randomSpec2(pick, poolsFor(maxStage))) : gTrans(randomSentenceSpec(pick, nouns, cadjs, persons));
    case 'fixsent': {
      const r = Math.random();
      if (maxStage >= 2 && r >= 0.6) { const sp = randomSpec2(pick, poolsFor(maxStage), false); return gFix2(sp, pickOne(fix2Errors(sp))); }
      if (r < 0.2) { const m = pick(MASC_TWINS.map(id => W[id]).filter(w => isOn(w) && w.stage <= maxStage)) || W.amicus; const [x, y] = mixedPair(persons); return gFixSent({ k: 'noun', s: [x, y], num: 'pl', c: m.id, order: 1 }, 'noun-g'); }
      const spec = randomSentenceSpec(pick, nouns, cadjs, persons, true);
      return gFixSent(spec, spec.k === 'adj' ? pickOne(['verb', 'adj-g', 'adj-g', 'adj-n']) : 'verb');
    }
  }
}
function mixedPair(persons) { const m = pickOne(persons.filter(w => w.g === 'm')), f = pickOne(persons.filter(w => w.g === 'f')); return coin(0.5) ? [m.id, f.id] : [f.id, m.id]; }
export function randomSentenceSpec(pick, nouns, padjs, persons, noAct = false) {
  const r = Math.random();
  if (!noAct && r < 0.3) {
    const v = pick(ACTION_VERBS); const subjP = persons;
    return coin(0.25) ? { k: 'act', s: (() => { const a = pick(subjP); const b = pick(subjP.filter(w => w.id !== a.id)); return [a.id, b.id]; })(), num: 'pl', v: v.id }
      : { k: 'act', s: [pick(subjP).id], num: coin(0.5) ? 'sg' : 'pl', v: v.id };
  }
  if (r < 0.45) { // noun complement: person = person of same gender
    const sw = pick(persons); const n = coin(0.5) ? 'sg' : 'pl';
    const c = pick(persons.filter(w => w.g === sw.g && w.id !== sw.id));
    return { k: 'noun', s: [sw.id], num: n, c: c.id, order: coin(0.6) ? 1 : 0, neg: coin(0.15) };
  }
  if (r < 0.6) { const a = pick(persons); const b = pick(persons.filter(w => w.id !== a.id)); return { k: 'adj', s: [a.id, b.id], num: 'pl', a: pick(padjs.filter(x => fits(a, x))).id, order: coin(0.5) ? 1 : 0 }; }
  const n = pick(nouns); return { k: 'adj', s: [n.id], num: coin(0.5) ? 'sg' : 'pl', a: pick(padjs.filter(a => fits(n, a))).id, order: coin(0.5) ? 1 : 0, neg: coin(0.15) };
}

/* =============== two-part sentences (like the class translation worksheets) =============== */
// Words the class uses in sentences before they're on a vocab list. Shown as help on the card,
// like the teacher's vocab help: he recognizes them, he's never quizzed on them.
export const HELP_VERBS = {
  ambulat: { id: 'ambulat', lemma: 'ambulat', pair: 'ambulant', mean: ['walks', 'is walking'], base: 'walk', prog: 'walking', help: 'ambulat / ambulant = walks / walk' },
};
export const PLACES = {
  villa: { lat: ['in', 'villā'], en: ['in house', 'in villa', 'in summer house', 'in country house'], show: 'in the house', help: 'in villā = in the house' },
  agri: { lat: ['in', 'agrīs'], en: ['in fields'], show: 'in the fields', help: 'in agrīs = in the fields' },
};
const QUIS_HELP = 'quis = who?';
const CLASH = [['magnus', 'parvus'], ['bonus', 'malus'], ['laetus', 'iratus'], ['laetus', 'defessus']];
const clash = (a, b) => a === b || CLASH.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
export const ATTR_ADJS = ADJS.filter(a => a.phrase && a.id !== 'multus');
const verbObj = id => HELP_VERBS[id] || W[id];
export const ACT2_VERBS = ['legit', 'sedet', 'scribit', 'ambulat', 'habitat'];
const an = s => (/^[aeiou]/.test(s) ? 'an ' : 'a ') + s;
const pronOf = (num, g, person) => (num === 'pl' ? ['they'] : person ? (g === 'm' ? ['he', 'he/she'] : ['she', 'he/she']) : ['it']);
// English for an action verb, optionally negated (does not walk / is not walking).
export function actEnglish(vw, num, neg) {
  const extra = vw.id === 'habitat' ? ['dwell'] : [];
  if (!neg) return num === 'sg' ? vw.mean.filter(m => !/ in$/.test(m) && m !== 'sits down') : [vw.base, 'are ' + vw.prog, ...extra];
  return num === 'sg' ? ['does not ' + vw.base, 'is not ' + vw.prog, ...extra.map(x => 'does not ' + x)] : ['do not ' + vw.base, 'are not ' + vw.prog, ...extra.map(x => 'do not ' + x)];
}
// Subject: one noun (optional describing adjective sa) or two nouns joined by et (each sg or pl).
function subj2(cl) {
  const ws = cl.s.map(id => W[id]);
  if (ws.length === 1) {
    const n = ws[0], num = cl.num, sa = cl.sa ? W[cl.sa] : null;
    const lat = [nForm(n, num)].concat(sa ? [aForm(sa, n.g, num)] : []);
    const en = []; for (const nm of nEn(n, num)) { if (sa) for (const am of sa.mean) en.push(`${am} ${nm}`); else en.push(nm); }
    return { lat, en, show: `the ${sa ? sa.mean[0] + ' ' : ''}${nEn(n, num)[0]}`, num, g: n.g, person: n.person, latin: lat.join(' '), noun: n, sa };
  }
  const nums = cl.nums || ['sg', 'sg'];
  const lat = [nForm(ws[0], nums[0]), 'et', nForm(ws[1], nums[1])];
  const en = []; for (const x of nEn(ws[0], nums[0])) for (const y of nEn(ws[1], nums[1])) en.push(`${x} and ${y}`);
  return { lat, en, show: `the ${nEn(ws[0], nums[0])[0]} and the ${nEn(ws[1], nums[1])[0]}`, num: 'pl', g: ws.some(w => w.g === 'm') ? 'm' : 'f', person: true, latin: lat.join(' '), compound: true };
}
// One clause. cl = {k:'adj'|'adj2'|'noun'|'act', s, num, nums, sa, a, a2, c, ca, v, place, neg, order, imp}
// prev = subject of the clause before (for an implied subject: "...sed non defessī sunt").
export function clause(cl, prev) {
  const S = cl.imp ? { lat: [], en: [], show: null, num: prev.num, g: prev.g, person: prev.person, latin: prev.latin, implied: true, prevEn: prev.en } : subj2(cl);
  const pron = pronOf(S.num, S.g, S.person);
  const subjEn = S.implied ? [...pron, ...S.prevEn, ''] : S.en;
  const subjShow = S.implied ? pron[0] : S.show;
  const neg = cl.neg ? ['non'] : [];
  let lat, en = [], show, idx = {};
  if (cl.k === 'act') {
    const vw = verbObj(cl.v), vf = S.num === 'sg' ? vw.lemma : vw.pair, pl = cl.place ? PLACES[cl.place] : null;
    lat = [...S.lat, ...neg, ...(pl ? pl.lat : []), vf]; idx.v = lat.length - 1;
    const vEn = actEnglish(vw, S.num, cl.neg);
    for (const so of subjEn) for (const ve of vEn) for (const pe of pl ? pl.en : ['']) en.push(`${so} ${ve} ${pe}`);
    show = `${subjShow} ${vEn[0]}${pl ? ' ' + pl.show : ''}`;
  } else {
    const LVw = LV(S.num), lvEn = S.num === 'sg' ? 'is' : 'are';
    let comp, compEn, compShow;
    if (cl.k === 'adj') { const a = W[cl.a]; comp = [aForm(a, S.g, S.num)]; compEn = a.mean; compShow = a.mean[0]; }
    else if (cl.k === 'adj2') {
      const a = W[cl.a], b = W[cl.a2]; comp = [aForm(a, S.g, S.num), 'et', aForm(b, S.g, S.num)];
      compEn = []; for (const x of a.mean) for (const y of b.mean) compEn.push(`${x} and ${y}`, `${y} and ${x}`); compShow = `${a.mean[0]} and ${b.mean[0]}`;
    } else {
      const c = W[cl.c], ca = cl.ca ? W[cl.ca] : null; comp = [nForm(c, S.num)].concat(ca ? [aForm(ca, c.g, S.num)] : []);
      compEn = []; for (const cm of nEn(c, S.num)) { if (ca) for (const am of ca.mean) compEn.push(`${am} ${cm}`); else compEn.push(cm); }
      const base = `${ca ? ca.mean[0] + ' ' : ''}${nEn(c, S.num)[0]}`; compShow = S.num === 'sg' ? an(base) : base;
    }
    // A describing adjective (villa vicina est magna) or a noun + adjective complement goes after the verb, so position shows which is which.
    const order = cl.imp ? 0 : cl.sa || (cl.k === 'noun' && cl.ca) ? 1 : cl.order || 0;
    lat = order === 1 ? [...S.lat, ...neg, LVw, ...comp] : [...S.lat, ...comp, ...neg, LVw];
    idx.v = lat.indexOf(LVw, S.lat.length); idx.a = lat.indexOf(comp[0], S.lat.length);
    for (const so of subjEn) for (const ce of compEn) en.push(`${so} ${lvEn} ${cl.neg ? 'not ' : ''}${ce}`);
    // "vir bonus est" can also be read "the man is good"
    if (cl.k === 'noun' && cl.ca && S.implied) { const c = W[cl.c], ca = W[cl.ca]; for (const cm of nEn(c, S.num)) for (const am of ca.mean) en.push(`${cm} ${lvEn} ${cl.neg ? 'not ' : ''}${am}`); }
    show = `${subjShow} ${lvEn}${cl.neg ? ' not' : ''} ${compShow}`;
  }
  if (cl.sa) idx.sa = 1;
  const help = [];
  if (cl.k === 'act' && HELP_VERBS[cl.v]) help.push(HELP_VERBS[cl.v].help);
  if (cl.place) help.push(PLACES[cl.place].help);
  const words = [...(cl.imp ? [] : cl.s), cl.sa, cl.a, cl.a2, cl.c, cl.ca, cl.k === 'act' && !HELP_VERBS[cl.v] ? cl.v : null].filter(Boolean);
  return { lat, acc: enAns(en), show, S, idx, help, words, cl };
}
// The same clause with the number flipped (for the "watch the number" contrast and hints).
function flipClause(cl, prev) {
  if (cl.imp) return clause(cl, { ...prev, num: prev.num === 'sg' ? 'pl' : 'sg', en: [] });
  if (cl.s.length !== 1 || !W[cl.s[0]].pl) return null;
  return clause({ ...cl, num: cl.num === 'sg' ? 'pl' : 'sg' }, prev);
}
// spec2 = {c1, c2, conj:'et'|'sed'}  or  {q:1, s, c, ca}  (Quis magister est? Vir bonus est.)
export function sentence2(sp) {
  if (sp.q) {
    const s = W[sp.s], qS = { num: 'sg', g: s.g, person: true, latin: s.lemma, en: [] };
    const c2 = clause({ k: 'noun', imp: true, c: sp.c, ca: sp.ca }, qS);
    const qAcc = s.mean.map(m => enKey(`who is ${m}`));
    const latin = `Quis ${s.lemma} est? ${cap(c2.lat.join(' '))}.`;
    return { latin, parts: [{ acc: qAcc, flip: [], lat: ['quis', s.lemma, 'est'], show: `who is the ${s.mean[0]}`, S: qS }, c2], join: null,
      correct: proper(`Who is the ${s.mean[0]}? ${cap(c2.show)}.`), help: [QUIS_HELP], words: [sp.s, ...c2.words], flips: [null, flipClause(c2.cl, qS)] };
  }
  const p1 = clause(sp.c1), p2 = clause(sp.c2, p1.S);
  const f1 = flipClause(sp.c1), f2 = flipClause(sp.c2, p1.S);
  const latin = cap([...p1.lat, sp.conj, ...p2.lat].join(' ')) + '.';
  const joinEn = sp.conj === 'sed' ? 'but' : 'and';
  return { latin, parts: [p1, p2], join: joinEn, flips: [f1, f2], correct: proper(`${cap(p1.show)}${sp.conj === 'sed' ? ', but' : ' and'} ${p2.show}.`),
    help: [...new Set([...p1.help, ...p2.help])], words: [...new Set([...p1.words, ...p2.words])] };
}
// Typed English, cleaned: contractions and the common spellings of "does" fixed so they can't trip him.
export const prenorm = s => (s || '').toLowerCase().replace(/[’]/g, "'").replace(/\b(u|ya|yu|yoo)\b/g, 'you').replace(/\bya'?ll\b/g, "y'all").replace(/\bi'?m\b/g, 'i am').replace(/\b(you|we|they)'re\b/g, '$1 are').replace(/\b(he|she|it)'s\b/g, '$1 is').replace(/\b(you|we|they)re\b/g, '$1 are').replace(/\b(teh|hte|th|tha|thee)\b/g, 'the').replace(/\bwolfs\b/g, 'wolves').replace(/\bwolfes\b/g, 'wolves').replace(/\bwomans\b/g, 'women').replace(/\bmans\b/g, 'men').replace(/\b(and|but|is|are|the|a|not|in|do|does)(\s+\1\b)+/g, '$1').replace(/[’]/g, "'").replace(/\bdoesn'?t\b/g, 'does not').replace(/\bdon'?t\b/g, 'do not')
  .replace(/\bisn'?t\b/g, 'is not').replace(/\baren'?t\b/g, 'are not').replace(/\bwho'?s\b/g, 'who is').replace(/\b(dosent|dosnt|doesent|dosen'?t|dosn'?t)\b/g, 'does not').replace(/\b(dose|dos|duz|dus|doez)\b/g, 'does');
function matchPart(str, part, flip) {
  if (part.acc.includes(str)) return { ok: true };
  const fz = str && fuzzyEn(str, part.acc, flip ? flip.acc : []); return fz ? { ok: true, fz } : { ok: false };
}
// Try every place the sentence could split into its two parts.
export function gradeTwoPart(input, st) {
  const toks = enKey(prenorm(input)).split(' ').filter(Boolean);
  let best = null;
  for (let i = 0; i <= toks.length; i++) {
    let right = toks.slice(i);
    if (st.join) { if (right[0] !== st.join) continue; right = right.slice(1); }
    const a = matchPart(toks.slice(0, i).join(' '), st.parts[0], st.flips[0]), b = matchPart(right.join(' '), st.parts[1], st.flips[1]);
    const score = (a.ok ? 1 : 0) + (b.ok ? 1 : 0);
    // On a tie, pick the split whose halves are closest in length to the expected answer.
    const off = Math.abs(i - st.parts[0].acc[0].split(' ').length) + Math.abs(right.length - st.parts[1].acc[0].split(' ').filter(Boolean).length);
    if (!best || score > best.score || (score === best.score && off < best.off)) best = { score, off, a, b, left: toks.slice(0, i), right };
    if (score === 2) break;
  }
  return { toks, best };
}
function partHints(part, flip, toks, which) {
  const t = toks.join(' '), cl = part.cl, S = part.S, out = [];
  if (!cl) { out.push('quis means who: "Who is the …?"'); return out; }
  const subjL = S.implied ? `(no subject written, so it's still ${S.latin})` : S.latin;
  if (flip && flip.acc.includes(t)) out.push(S.num === 'pl' ? `${subjL} is plural, so the English is plural: "${part.show}."` : `${subjL} is singular, so the English is singular: "${part.show}."`);
  else if (cl.k !== 'act') {
    if (!toks.includes('is') && !toks.includes('are')) out.push(`${S.num === 'sg' ? 'est' : 'sunt'} is a linking verb, so this part needs "${S.num === 'sg' ? 'is' : 'are'}."`);
    else if (S.num === 'pl' && toks.includes('is') && !toks.includes('are')) out.push(`sunt is plural, so it's "are," not "is."`);
    else if (S.num === 'sg' && toks.includes('are') && !toks.includes('is')) out.push(`est is singular, so it's "is," not "are."`);
  } else if (cl.neg && !toks.includes('not')) out.push(`non + verb: "${part.show}."`);
  else {
    const vw = verbObj(cl.v), other = actEnglish(vw, S.num === 'sg' ? 'pl' : 'sg', cl.neg).map(normEn), mine = actEnglish(vw, S.num, cl.neg).map(normEn);
    if (other.some(o => (' ' + t + ' ').includes(' ' + o + ' ')) && !mine.some(m => (' ' + t + ' ').includes(' ' + m + ' ')))
      out.push(S.num === 'sg' ? `${vw.lemma} ends in -t (singular), so the English verb is singular: "${actEnglish(vw, 'sg', cl.neg)[0]}."` : `${vw.pair} ends in -nt (plural), so the English verb is plural: "${actEnglish(vw, 'pl', cl.neg)[0]}."`);
  }
  if (cl.k === 'noun') { const c = W[cl.c], want = nEn(c, S.num), wrong = nEn(c, S.num === 'sg' ? 'pl' : 'sg');
    if (!toks.some(x => want.some(w => w.split(' ').includes(x))) && toks.some(x => wrong.some(w => w.split(' ').includes(x)))) out.push(`${nForm(c, S.num)} is ${S.num === 'sg' ? 'singular' : 'plural'}: "${want[0]}."`); }
  if (cl.neg && !toks.includes('not') && cl.k !== 'act') out.push('non means not.');
  if (cl.place && !toks.includes('in')) out.push(`Don't skip the place: "${PLACES[cl.place].show}."`);
  if (cl.sa) { const sa = W[cl.sa]; out.push(`${aForm(sa, S.g, S.num)} sits right next to ${nForm(S.noun, S.num)} with no verb between them, so it describes the noun directly: "${S.show}."`); }
  if (cl.k === 'adj' && !cl.sa && !S.compound && !S.implied) { const a = W[cl.a];
    if (a.mean.some(am => S.en.some(se => (' ' + t + ' ').includes(` ${am} ${se} `) || t.startsWith(`${am} ${se}`)))) out.push(`${aForm(a, S.g, S.num)} goes with the linking verb, so it's the complement: "${part.show}." It isn't describing the noun directly.`); }
  if (S.implied && !out.length) out.push(`No subject is written in this part, so it's the same subject as before: "${part.show}."`);
  return out.map(proper);
}
export function gTrans2(sp) {
  const st = sentence2(sp);
  return {
    type: 'trans2', skill: 'trans', cid: 'g:trans', words: st.words, stage: 2,
    instr: sp.q ? 'Translate the question and the answer.' : 'Translate. Two parts: find each verb.', prompt: { latin: st.latin, help: st.help },
    fields: [{ label: 'English', ph: 'English', wide: true }],
    check: v => {
      const { toks, best } = gradeTwoPart(v[0], st);
      if (best && best.score === 2) { const fz = [best.a.fz, best.b.fz].filter(Boolean); return { ok: [true], hints: [], notes: fz.length ? [`Spelled: ${proper(fz.join(' … '))}`] : [] }; }
      const hints = [];
      if (!toks.length) return { ok: [false], hints, notes: [] };
      if (st.join && !toks.includes(st.join)) hints.push(st.join === 'but' ? 'sed means but. It joins the two parts.' : 'et means and. It joins the two parts.');
      else if (best) {
        if (best.a.ok) hints.push(`${sp.q ? 'The question' : 'The first part'} is right.`);
        else hints.push(...partHints(st.parts[0], st.flips[0], best.left, 0));
        if (best.b.ok) hints.push(`${sp.q ? 'The answer' : 'The second part'} is right.`);
        else hints.push(...partHints(st.parts[1], st.flips[1], best.right, 1));
      }
      return { ok: [false], hints: [...new Set(hints)], notes: [] };
    },
    correct: st.correct, summary: st.latin, params: [sp],
  };
}
// Fix the error in a two-part sentence. err = {p: 0|1, kind: 'verb'|'adj-g'|'adj-n'|'sa-g'}
function corrupt(part, kind) {
  const cl = part.cl, S = part.S, lat = part.lat.slice();
  if (kind === 'verb') {
    if (cl.k === 'act') { const vw = verbObj(cl.v); lat[part.idx.v] = S.num === 'sg' ? vw.pair : vw.lemma; }
    else lat[part.idx.v] = S.num === 'sg' ? 'sunt' : 'est';
  } else if (kind === 'adj-g' || kind === 'adj-n') {
    if (cl.k !== 'adj' && cl.k !== 'adj2') return null; const a = W[cl.a];
    lat[part.idx.a] = kind === 'adj-g' ? aForm(a, S.g === 'm' ? 'f' : 'm', S.num) : aForm(a, S.g, S.num === 'sg' ? 'pl' : 'sg');
  } else if (kind === 'sa-g') {
    if (!cl.sa) return null; lat[part.idx.sa] = aForm(W[cl.sa], S.g === 'm' ? 'f' : 'm', S.num);
  } else return null;
  return letters(lat.join(' ')) === letters(part.lat.join(' ')) ? null : lat;
}
// With no subject written, only errors that clash inside the clause itself are clear-cut.
const kindsFor = part => (part.S.implied ? ['verb', 'adj-n'] : ['verb', 'adj-g', 'adj-n', 'sa-g']);
export function fix2Errors(sp) { const st = sentence2(sp), out = []; st.parts.forEach((p, i) => kindsFor(p).forEach(kind => { if (corrupt(p, kind)) out.push({ p: i, kind }); })); return out; }
function assemble(sp, lats) { return cap([...lats[0], sp.conj, ...lats[1]].join(' ')) + '.'; }
export function gFix2(sp, err) {
  const st = sentence2(sp), good = assemble(sp, st.parts.map(p => p.lat));
  const withErr = e => { const l = st.parts.map(p => p.lat); const c = corrupt(st.parts[e.p], e.kind); if (!c) return null; l[e.p] = c; return assemble(sp, l); };
  const bad = withErr(err);
  const others = uniq(fix2Errors(sp).map(withErr).filter(x => x && letters(x) !== letters(bad) && letters(x) !== letters(good)));
  const choices = seeded([good, ...seeded(others, [sp, err]).slice(0, 2)], [sp, err, 1]);
  const part = st.parts[err.p], S = part.S, which = err.p === 0 ? 'first' : 'second';
  const subjL = S.implied ? `the same subject as the first part (${S.latin})` : S.latin;
  return {
    type: 'fix2', skill: 'fixsent', cid: 'g:fixsent', words: st.words, stage: 2,
    instr: 'There\'s one grammar error. Tap the corrected sentence.', prompt: { latin: bad, help: st.help },
    fields: [{ label: 'Corrected sentence', choices }],
    check: v => {
      const ok = letters(v[0] || '') === letters(good), hints = [];
      if (!ok && v[0]) {
        if (err.kind === 'verb') hints.push(`Look at the ${which} part. Its subject is ${subjL}, which is ${S.num === 'sg' ? 'singular' : 'plural'}, so the verb ends in ${S.num === 'sg' ? '-t (est)' : '-nt (sunt)'}.${S.compound ? ' Two nouns joined by et are plural.' : ''}`);
        else if (err.kind === 'sa-g') hints.push(`Look at the ${which} part: the adjective next to ${nForm(S.noun, S.num)} has to match it (${G(S.g)}).${S.noun.trap ? ` ${S.noun.lemma} is masculine.` : ''}`);
        else hints.push(`Look at the ${which} part: the complement has to match ${subjL} (${G(S.g)} ${S.num === 'sg' ? 'singular' : 'plural'}).`);
      }
      return { ok: [ok], hints, notes: [] };
    },
    correct: good, summary: `Fix: ${bad}`, params: [sp, err],
  };
}
/* ----- random two-part specs that make sense ----- */
export function randomClause(pick, pools, opts = {}) {
  const { nouns, cadjs, persons, attr } = pools, r = Math.random();
  const numOf = n => (n.pl ? (coin(0.5) ? 'sg' : 'pl') : 'sg');
  if (opts.imp) { // same subject as before, described: "...sed non defessī sunt" / "...et Romanī sunt"
    const host = opts.prevNoun;
    if (host.person && coin(0.4)) { const v = pick(['legit', 'sedet', 'scribit', 'ambulat'].map(verbObj)); return { k: 'act', imp: true, v: v.id, place: coin(0.4) ? pickOne(['villa', 'agri']) : null, neg: coin(opts.negP ?? 0.25) }; }
    const a = pick(cadjs.filter(x => fits(host, x) && !(opts.avoidAdj && clash(x.id, opts.avoidAdj)))); return { k: 'adj', imp: true, a: a.id, neg: coin(opts.negP ?? 0.35) };
  }
  if (r < 0.35) { // action: persons (the family can live in the house)
    let v = pick(ACT2_VERBS.map(verbObj)); const compound = coin(0.3);
    let s, num, nums;
    if (compound) { const a = pick(persons), b = pick(persons.filter(w => w.id !== a.id)); s = [a.id, b.id]; num = 'pl'; nums = coin(0.4) ? ['pl', 'pl'] : ['sg', 'sg']; if (nums[0] === 'pl' && (!a.pl || !b.pl)) nums = ['sg', 'sg']; }
    else { const subjPool = v.id === 'habitat' ? persons.concat(nouns.filter(n => n.id === 'familia')) : persons; const n = pick(subjPool); s = [n.id]; num = numOf(n); }
    const place = v.id === 'habitat' ? 'villa' : coin(0.3) ? pickOne(['villa', 'agri']) : null;
    return { k: 'act', s, num, nums, v: v.id, place, neg: coin(opts.negP ?? 0.25) };
  }
  if (r < 0.5) { // noun complement, sometimes with its own adjective (vir bonus est)
    const sw = pick(persons), num = numOf(sw), c = pick(persons.filter(w => w.g === sw.g && w.id !== sw.id));
    const ca = coin(0.4) ? pick(attr.filter(a => fits(c, a) && a.id !== 'vicinus')) : null;
    return { k: 'noun', s: [sw.id], num, c: c.id, ca: ca ? ca.id : null, order: coin(0.6) ? 1 : 0, neg: coin(opts.negP ?? 0.2) };
  }
  if (r < 0.62) { // compound subject + adjective
    const a = pick(persons), b = pick(persons.filter(w => w.id !== a.id)); let nums = coin(0.4) ? ['pl', 'pl'] : ['sg', 'sg'];
    return { k: 'adj', s: [a.id, b.id], num: 'pl', nums, a: pick(cadjs.filter(x => fits(a, x) && fits(b, x))).id, order: coin(0.5) ? 1 : 0, neg: coin(opts.negP ?? 0.2) };
  }
  const n = pick(nouns.concat(nouns.length ? [W.cibus] : [])), num = numOf(n);
  const a = pick(cadjs.filter(x => fits(n, x)));
  const r2 = Math.random();
  if (r2 < 0.3) { const sa = pick(attr.filter(x => fits(n, x) && !clash(x.id, a.id))); if (sa) return { k: 'adj', s: [n.id], num, sa: sa.id, a: a.id, order: coin(0.6) ? 1 : 0, neg: coin(opts.negP ?? 0.2) }; }
  if (r2 < 0.45) { const b = pick(cadjs.filter(x => fits(n, x) && !clash(x.id, a.id))); if (b) return { k: 'adj2', s: [n.id], num, a: a.id, a2: b.id, order: 0 }; }
  return { k: 'adj', s: [n.id], num, a: a.id, order: coin(0.5) ? 1 : 0, neg: coin(opts.negP ?? 0.2) };
}
export function randomSpec2(pick, pools, allowQuis = true) {
  if (allowQuis && coin(0.12)) {
    const s = pick(pools.persons), c = pick(pools.persons.filter(w => w.g === s.g && w.id !== s.id));
    return { q: 1, s: s.id, c: c.id, ca: pick(pools.attr.filter(a => fits(c, a) && a.id !== 'vicinus')).id };
  }
  const conj = coin(0.5) ? 'sed' : 'et';
  const c1 = randomClause(pick, pools);
  const single = c1.s.length === 1, host = W[c1.s[0]];
  if (coin(0.35) && (c1.s.length === 2 || host.person)) { // implied subject in the second part
    const prevNoun = c1.s.length === 2 ? W.puer : host;
    return { c1, c2: randomClause(pick, pools, { imp: true, prevNoun, avoidAdj: c1.a, negP: conj === 'sed' ? 0.6 : 0.25 }), conj };
  }
  let c2, tries = 0;
  do { c2 = randomClause(pick, pools, { negP: conj === 'sed' ? 0.5 : 0.2 }); tries++; } while (tries < 8 && c2.s.some(id => c1.s.includes(id)));
  return { c1, c2, conj };
}
export function poolsFor(maxStage) {
  const f = l => { const x = l.filter(w => isOn(w) && w.stage <= maxStage); return x.length ? x : l; };
  return { nouns: f(PL_NOUNS), cadjs: f(COMP_ADJS).filter(a => a.phrase), persons: f(PERSONS), attr: f(ATTR_ADJS) };
}

/* =============== Stage 3: direct objects & the accusative case =============== */
const unmac = s => s.normalize('NFD').replace(/[̄]/g, '').normalize('NFC');
// Present tense from the infinitive (her chart): chop -re, add the linking vowel, add -o -s -t -mus -tis -nt.
// 1st: ama- (amo drops the a) · 2nd: habe- · 3rd: cad-i- (cado, cadunt) · 4th: audi- (audiunt).
export const PERSONS6 = [[1, 'sg'], [2, 'sg'], [3, 'sg'], [1, 'pl'], [2, 'pl'], [3, 'pl']];
export const PN_LABEL = { '1sg': '1st singular', '2sg': '2nd singular', '3sg': '3rd singular', '1pl': '1st plural', '2pl': '2nd plural', '3pl': '3rd plural' };
export function conjForm(vb, per, num) {
  const inf = unmac(vb.inf);
  if (per === 1 && num === 'sg') return unmac(vb.lemma);
  const END = { '2sg': 's', '3sg': 't', '1pl': 'mus', '2pl': 'tis', '3pl': 'nt' }, k = per + num;
  if (vb.conj === 1 || vb.conj === 2) return inf.slice(0, -2) + END[k];
  if (vb.conj === 3) { const st = inf.slice(0, -3); return k === '3pl' ? st + 'unt' : st + 'i' + END[k]; }
  if (vb.conj === 4) { const st = inf.slice(0, -2); return k === '3pl' ? st + 'unt' : st + END[k]; }
  return null;
}
export function v3(vb, num) { return conjForm(vb, 3, num); }
// English subjects hidden in the ending
export const PRON_EN = { '1sg': ['i'], '2sg': ['you'], '3sg': ['he', 'she', 'it', 'he/she', 'he/she/it', 'he or she', 'he/it', 'she/it'], '1pl': ['we'],
  '2pl': ['you all', "y'all", 'yall', 'you guys', 'you pl', 'you plural', 'all of you', 'you both', 'you two'], '3pl': ['they'] };
export const PRON_SHOW = { '1sg': 'I', '2sg': 'you', '3sg': 'he/she/it', '1pl': 'we', '2pl': 'you all', '3pl': 'they' };
export const PRON_LAT = { '1sg': 'ego', '2sg': 'tu', '1pl': 'nos', '2pl': 'vos' };
// English verb for any person: simple, progressive (am/is/are …ing) and emphatic (do/does …), plus "not".
export function vEnP(vb, per, num, neg) {
  const out = [], k = per + num, third = k === '3sg';
  const be = k === '1sg' ? 'am' : third ? 'is' : 'are';
  for (const e of vb.en) {
    if (e.fixed) { if (!neg) out.push(third ? e.sg : e.pl); continue; } // nescio: "does not know" already has the not
    if (/^is /.test(e.sg)) { const rest = e.sg.replace(/^is /, ''); out.push(`${be} ${neg ? 'not ' : ''}${rest}`); continue; }
    if (!neg) { out.push(third ? e.sg : e.pl); if (e.ing) out.push(`${be} ${e.ing}`); out.push(`${third ? 'does' : 'do'} ${e.pl}`); }
    else { out.push(`${third ? 'does' : 'do'} not ${e.pl}`); if (e.ing) out.push(`${be} not ${e.ing}`); }
  }
  return out;
}
export function vEn(vb, num, neg) { return vEnP(vb, 3, num, neg); }
export const DRILL_VERBS = WORDS.filter(w => w.kind === 'vb' && w.en);
const accF = (n, num) => n.acc[num];
const adjAcc = (a, g, num) => a.acc[g][num];
const caseEnd = (n, num, cas) => (cas === 'acc' ? (n.gen === 'ae' ? (num === 'sg' ? '-am' : '-as') : (num === 'sg' ? '-um' : '-os')) : (n.gen === 'ae' ? (num === 'sg' ? '-a' : '-ae') : (num === 'sg' ? (n.lemma.endsWith('r') ? '-r' : '-us') : '-ī')));
const nounEnOpts = (n, num, adj, g) => { const out = []; for (const nm of nEn(n, num)) { if (adj) for (const am of adj.mean) out.push(`${am} ${nm}`); else out.push(nm); } return out; };
const nounShow = (n, num, adj) => `the ${adj ? adj.mean[0] + ' ' : ''}${nEn(n, num)[0]}`;

// One transitive or intransitive clause.
// tc = {k:'tr'|'int', s:[ids], num, nums, sa, v, o, onum, oa, opro, neg, order:'SOV'|'OSV'|'SVO', per, pro}
//   per 1/2 (or s:[] with per 3) = the subject is in the verb; pro = show ego/tu/nos/vos; opro = eum/eam/eos/eas as the object
export const OPRO = { eum: { en: ['him'], num: 'sg', g: 'm' }, eam: { en: ['her'], num: 'sg', g: 'f' }, eos: { en: ['them'], num: 'pl', g: 'm' }, eas: { en: ['them'], num: 'pl', g: 'f' } };
export function tclause(tc) {
  const vb = W[tc.v], ws = tc.s.map(id => W[id]), per = tc.per || 3;
  let sLat, sEn, sShow, sNum, sG, hidden = false;
  if (!ws.length) { sNum = tc.num; sG = 'm'; hidden = true; const k = per + sNum;
    sLat = tc.pro && PRON_LAT[k] ? [PRON_LAT[k]] : []; sEn = PRON_EN[k]; sShow = PRON_SHOW[k]; }
  else if (ws.length === 1) { const n = ws[0], sa = tc.sa ? W[tc.sa] : null; sNum = tc.num; sG = n.g;
    sLat = [nForm(n, sNum)].concat(sa ? [aForm(sa, n.g, sNum)] : []); sEn = nounEnOpts(n, sNum, sa); sShow = nounShow(n, sNum, sa); }
  else { const nums = tc.nums || ['sg', 'sg']; sNum = 'pl'; sG = ws.some(w => w.g === 'm') ? 'm' : 'f';
    sLat = [nForm(ws[0], nums[0]), 'et', nForm(ws[1], nums[1])];
    sEn = []; for (const x of nEn(ws[0], nums[0])) for (const y of nEn(ws[1], nums[1])) sEn.push(`${x} and ${y}`);
    sShow = `the ${nEn(ws[0], nums[0])[0]} and the ${nEn(ws[1], nums[1])[0]}`; }
  const vPer = ws.length ? 3 : per;
  const vf = conjForm(vb, vPer, sNum), neg = tc.neg ? ['non'] : [];
  const V = [...neg, vf];
  let oLat = [], oEn = [''], oShow = '';
  if (tc.k === 'tr' && tc.opro) { oLat = [tc.opro]; oEn = OPRO[tc.opro].en; oShow = OPRO[tc.opro].en[0]; }
  else if (tc.k === 'tr') { const o = W[tc.o], oa = tc.oa ? W[tc.oa] : null;
    oLat = [accF(o, tc.onum)].concat(oa ? [adjAcc(oa, o.g, tc.onum)] : []); oEn = nounEnOpts(o, tc.onum, oa); oShow = nounShow(o, tc.onum, oa); }
  const order = tc.k === 'tr' ? tc.order || 'SOV' : 'SV';
  const pp = tc.pp ? ppPhrase(tc.pp) : null;
  const Vp = pp && tc.pp.pos !== 'front' ? [...pp.lat, ...V] : V;
  let lat = order === 'OSV' ? [...oLat, ...sLat, ...Vp] : order === 'SVO' ? [...sLat, ...Vp, ...oLat] : [...sLat, ...oLat, ...Vp];
  if (pp && tc.pp.pos === 'front') lat = [...pp.lat, ...lat];
  const vEns = vEnP(vb, vPer, sNum, tc.neg);
  const acc = []; for (const se of sEn) for (const ve of vEns) for (const oe of oEn) { const core = `${se} ${ve} ${oe}`.trim();
    if (!pp) acc.push(core); else for (const pe of pp.en) { acc.push(`${core} ${pe}`); acc.push(`${pe} ${core}`); } }
  const show = `${sShow} ${vEns[0]}${oShow ? ' ' + oShow : ''}${pp ? ' ' + pp.show : ''}`;
  const words = [...tc.s, tc.sa, tc.v, tc.o, tc.oa, ...(tc.pp ? [tc.pp.p, tc.pp.n, tc.pp.a] : [])].filter(Boolean);
  const pk = vPer + sNum;
  return { lat, acc: enAns(acc), show, sLat, oLat, vf, sNum, sG, per: vPer, pk, hidden, pp,
    S: { num: sNum, g: sG, latin: sLat.join(' ') || `(in the verb: ${PRON_SHOW[pk]})`, person: ws.every(w => w.person), en: sEn, compound: ws.length > 1 }, words, cl: { ...tc, kind3: true } };
}
// The wrong readings we watch for: roles swapped, or the wrong number on the subject or the object.
function tContrasts(tc) {
  const out = { swap: [], subjNum: [], objNum: [], person: [], ppNum: [], ppCase: [], noPP: [] };
  if (tc.k === 'tr' && tc.s.length === 1 && tc.o && !tc.opro) {
    const sw = tclause({ ...tc, s: [tc.o], num: tc.onum, sa: tc.oa, o: tc.s[0], onum: tc.num, oa: tc.sa }); out.swap = sw.acc;
  }
  if ((tc.s.length === 1 && W[tc.s[0]].pl) || !tc.s.length) out.subjNum = tclause({ ...tc, num: tc.num === 'sg' ? 'pl' : 'sg' }).acc;
  if (!tc.s.length) for (const [p, n] of PERSONS6) if (!(p === (tc.per || 3) && n === tc.num)) out.person.push(...tclause({ ...tc, per: p, num: n }).acc);
  if (tc.pp) { const q = tc.pp, n = W[q.n];
    if (n.pl) out.ppNum = tclause({ ...tc, pp: { ...q, num: q.num === 'sg' ? 'pl' : 'sg' } }).acc;
    if (q.p === 'inabl' || q.p === 'inacc') out.ppCase = tclause({ ...tc, pp: { ...q, p: q.p === 'inabl' ? 'inacc' : 'inabl' } }).acc;
    out.noPP = tclause({ ...tc, pp: null }).acc; }
  if (tc.k === 'tr' && tc.opro) { const flip = { eum: 'eos', eos: 'eum', eam: 'eas', eas: 'eam' }[tc.opro]; out.objNum = tclause({ ...tc, opro: flip }).acc; }
  else if (tc.k === 'tr' && W[tc.o].pl) out.objNum = tclause({ ...tc, onum: tc.onum === 'sg' ? 'pl' : 'sg' }).acc;
  return out;
}
const ENDING_SAYS = { '1sg': '-o = I', '2sg': '-s = you', '3sg': '-t = he/she/it', '1pl': '-mus = we', '2pl': '-tis = you all', '3pl': '-nt = they' };
function tHints(p, toks, con) {
  const t = toks.join(' '), tc = p.cl, out = [];
  const o = tc.o && !tc.opro ? W[tc.o] : null;
  if (p.pp && con.ppCase && con.ppCase.includes(t)) out.push(tc.pp.p === 'inabl' ? `in + ablative (${p.pp.lat.join(' ')}) = in / on. "Into" would need the accusative.` : `in + accusative (${p.pp.lat.join(' ')}) = into / onto. "In" would need the ablative.`);
  else if (p.pp && con.ppNum && con.ppNum.includes(t)) out.push(`${p.pp.lat[1]} is ${CASES[W[tc.pp.p].takes === 'ablative' ? 'abl' : 'acc']} ${tc.pp.num === 'sg' ? 'singular' : 'plural'}: "${p.pp.show}."`);
  else if (p.pp && con.noPP && con.noPP.includes(t)) out.push(`Don't leave out the prepositional phrase: ${p.pp.lat.join(' ')} = "${p.pp.show}."`);
  else if (p.hidden && (con.person.includes(t) || con.subjNum.includes(t))) out.push(`No nominative, so the subject is in the verb: ${p.vf} ends in ${ENDING_SAYS[p.pk]}. "${proper(p.show)}."`);
  else if (tc.opro && con.objNum.includes(t)) out.push(`${tc.opro} = ${OPRO[tc.opro].en[0]} (accusative, the direct object).`);
  else if (con.swap.includes(t)) out.push(`Who does it? ${p.sLat[0]} is nominative (subject). ${p.oLat[0]} ends in ${caseEnd(o, tc.onum, 'acc')}: accusative, so it's the direct object. "${proper(p.show)}."`);
  else if (con.objNum.includes(t)) out.push(`${p.oLat[0]} is accusative ${tc.onum === 'sg' ? 'singular' : 'plural'} (${caseEnd(o, tc.onum, 'acc')}), so it's "${nEn(o, tc.onum)[0]}."`);
  else if (con.subjNum.includes(t)) out.push(`${p.sLat[0]} is nominative ${p.sNum === 'sg' ? 'singular' : 'plural'}, and ${p.vf} ends in ${p.sNum === 'sg' ? '-t' : '-nt'}: "${proper(p.show)}."`);
  else if (tc.neg && !toks.includes('not')) out.push(`non means not: "${proper(p.show)}."`);
  else if (!p.hidden && (() => { const vb = W[tc.v], other = vEn(vb, p.sNum === 'sg' ? 'pl' : 'sg', tc.neg).map(normEn), mine = vEn(vb, p.sNum, tc.neg).map(normEn), pad = ' ' + t + ' ';
    return other.some(x => pad.includes(' ' + x + ' ')) && !mine.some(x => pad.includes(' ' + x + ' ')); })())
    out.push(`${p.vf} ends in ${p.sNum === 'sg' ? '-t, so it\'s singular: "' + vEn(W[tc.v], 'sg', tc.neg)[0] + '"' : '-nt, so it\'s plural: "' + vEn(W[tc.v], 'pl', tc.neg)[0] + '"'}. "${proper(p.show)}."`);
  else if (o && toks.length) out.push(`Find the verb (${p.vf}), then the subject (nominative: ${p.sLat.join(' ')})${o ? `, then the direct object (accusative: ${p.oLat.join(' ')})` : ''}.`);
  return out;
}
// A sentence: one clause, or two joined by et / sed / quod. A part can also be a Stage 2 linking-verb clause.
const CONJ_EN = { et: 'and', sed: 'but', quod: 'because' };
function partOf(c, prev) { return c.kind === 'lv' ? clause(c.cl, prev) : tclause(c); }
function contrastsOf(c, prev) { if (c.kind === 'lv') { const f = flipClause(c.cl, prev); return { swap: [], subjNum: f ? f.acc : [], objNum: [] }; } return tContrasts(c); }
export function sentence3(sp) {
  const p1 = partOf(sp.c1); const parts = [p1], cons = [contrastsOf(sp.c1)];
  if (sp.c2) { const p2 = partOf(sp.c2, p1.S); parts.push(p2); cons.push(contrastsOf(sp.c2, p1.S));
    // "rivum videmus et currimus" = "we see the stream and run": English can leave out a subject that carries over
    if (p2.cl && p2.cl.kind3 && p2.hidden && p1.cl && p1.cl.kind3 && p1.pk === p2.pk) {
      const bare = vEnP(W[p2.cl.v], p2.per, p2.sNum, p2.cl.neg).flatMap(ve => p2.oLat.length ? (p2.cl.opro ? OPRO[p2.cl.opro].en : nounEnOpts(W[p2.cl.o], p2.cl.onum, p2.cl.oa ? W[p2.cl.oa] : null)).map(oe => `${ve} ${oe}`) : [ve]);
      p2.acc = [...new Set([...p2.acc, ...enAns(bare)])];
    } }
  const latin = cap([...p1.lat, ...(sp.c2 ? [sp.conj, ...parts[1].lat] : [])].join(' ')) + '.';
  const correct = proper(cap(p1.show) + (sp.c2 ? `${sp.conj === 'sed' ? ', but' : sp.conj === 'quod' ? ' because' : ' and'} ${parts[1].show}` : '') + '.');
  const help = [...new Set(parts.flatMap(p => p.help || []))];
  return { latin, parts, cons, join: sp.c2 ? CONJ_EN[sp.conj] : null, correct, help, words: [...new Set(parts.flatMap(p => p.words))] };
}
const allCon = c => [...c.swap, ...c.subjNum, ...c.objNum, ...(c.person || []), ...(c.ppNum || []), ...(c.ppCase || [])];
export function gDobj(sp) {
  const st = sentence3(sp);
  return {
    type: 'dobj', skill: 'dobj', cid: 'g:dobj', words: st.words, stage: 3,
    instr: sp.c2 ? 'Translate. Don\'t read left to right: find each verb, its subject (nominative) and its object (accusative).' : 'Translate. Don\'t read left to right: verb, then subject (nominative), then object (accusative).',
    prompt: { latin: st.latin, help: st.help },
    fields: [{ label: 'English', ph: 'English', wide: true }],
    check: v => {
      const toks = enKey(prenorm(v[0])).split(' ').filter(Boolean);
      const match = (str, i) => { const p = st.parts[i]; if (p.acc.includes(str)) return { ok: true }; const fz = str && fuzzyEn(str, p.acc, allCon(st.cons[i])); return fz ? { ok: true, fz } : { ok: false }; };
      let best = null;
      if (!st.join) { const r = match(toks.join(' '), 0); best = { score: r.ok ? 2 : 0, a: r, b: { ok: true }, left: toks, right: [] }; }
      else for (let i = 0; i <= toks.length; i++) {
        let right = toks.slice(i); if (right[0] !== st.join) continue; right = right.slice(1);
        const a = match(toks.slice(0, i).join(' '), 0), b = match(right.join(' '), 1), score = (a.ok ? 1 : 0) + (b.ok ? 1 : 0);
        const off = Math.abs(i - st.parts[0].acc[0].split(' ').length) + Math.abs(right.length - st.parts[1].acc[0].split(' ').filter(Boolean).length);
        if (!best || score > best.score || (score === best.score && off < best.off)) best = { score, off, a, b, left: toks.slice(0, i), right };
        if (score === 2) break;
      }
      if (best && best.score === 2) { const fz = [best.a.fz, best.b.fz].filter(Boolean); return { ok: [true], hints: [], notes: fz.length ? [`Spelled: ${proper(fz.join(' … '))}`] : [] }; }
      const hints = [];
      if (!toks.length) return { ok: [false], hints, notes: [] };
      const hintFor = (i, tk) => st.parts[i].cl.kind3 ? tHints(st.parts[i], tk, st.cons[i]) : partHints(st.parts[i], flipClause(sp.c2.cl, st.parts[0].S), tk);
      if (st.join && !toks.includes(st.join)) hints.push(`${sp.conj} means ${st.join}. It joins the two parts.`);
      else if (!st.join) hints.push(...hintFor(0, toks));
      else if (best) {
        if (best.a.ok) hints.push('The first part is right.'); else hints.push(...(st.parts[0].cl.kind3 ? tHints(st.parts[0], best.left, st.cons[0]) : partHints(st.parts[0], flipClause(sp.c1.cl), best.left)));
        if (best.b.ok) hints.push('The second part is right.'); else hints.push(...hintFor(1, best.right));
      }
      return { ok: [false], hints: [...new Set(hints)], notes: [] };
    },
    correct: st.correct, summary: st.latin, params: [sp],
  };
}

/* ----- case & number of one form, and "decline it" ----- */
export const CASES = { nom: 'nominative', acc: 'accusative', abl: 'ablative' };
export function gCase(nid, num, cas) {
  const n = W[nid], form = cas === 'acc' ? accF(n, num) : nForm(n, num);
  return {
    type: 'case', skill: 'case', cid: 'g:case', words: [nid], stage: 3,
    instr: 'Case and number?', prompt: { latin: form, sub: `(${n.entry})` },
    fields: [{ label: 'Case', choices: ['nominative', 'accusative'] }, { label: 'Number', choices: ['singular', 'plural'] }],
    check: v => {
      const ok = [v[0] === CASES[cas], v[1] === (num === 'sg' ? 'singular' : 'plural')], hints = [];
      if (!ok.every(Boolean)) hints.push(`${form} ends in ${caseEnd(n, num, cas)}: ${CASES[cas]} ${num === 'sg' ? 'singular' : 'plural'}.${cas === 'acc' ? ' Accusative = direct object.' : ' Nominative = subject or complement.'}`);
      return { ok, hints, notes: [] };
    },
    correct: `${form}: ${CASES[cas]} ${num === 'sg' ? 'singular' : 'plural'}`, summary: `${form}: case + number`, params: [nid, num, cas],
  };
}
export function gDecline(nid, num, cas) {
  const n = W[nid], want = cas === 'acc' ? accF(n, num) : nForm(n, num);
  const opts = seeded(uniq([n.lemma, n.pl, n.acc.sg, n.acc.pl]), [nid, num, cas]);
  return {
    type: 'decline', skill: 'case', cid: 'g:case', words: [nid], stage: 3,
    instr: `Tap the ${CASES[cas]} ${num === 'sg' ? 'singular' : 'plural'}.`, prompt: { latin: n.entry, sub: `${CASES[cas]} ${num === 'sg' ? 'singular' : 'plural'}` },
    fields: [{ label: 'Form', choices: opts }],
    check: v => { const ok = v[0] === want; return { ok: [ok], hints: ok || !v[0] ? [] : [`${n.gen === 'ae' ? '1st' : '2nd'} declension ${CASES[cas]} ${num === 'sg' ? 'singular' : 'plural'} ends in ${caseEnd(n, num, cas)}: ${want}.`], notes: [] }; },
    correct: `${CASES[cas]} ${num === 'sg' ? 'singular' : 'plural'}: ${want}`, summary: `${n.lemma}: ${CASES[cas]} ${num}`, params: [nid, num, cas],
  };
}
/* ----- pick the object form ("Puer ___ videt.") ----- */
// mode 'noun': tap the noun's form; mode 'adj': the object is there, tap the adjective that goes with it.
export function gObjForm(tc, mode) {
  const p = tclause(tc), o = W[tc.o];
  let latWords = p.lat.slice(), want, opts, blankIdx, sub;
  if (mode === 'noun') { blankIdx = latWords.indexOf(p.oLat[0]); want = p.oLat[0]; opts = uniq([o.lemma, o.pl, o.acc.sg, o.acc.pl]); sub = `(${o.lemma}, ${tc.onum === 'sg' ? 'one' : 'more than one'})`; }
  else { const a = W[tc.oa]; blankIdx = latWords.indexOf(p.oLat[1]); want = p.oLat[1]; opts = uniq([a.forms[o.g][tc.onum], adjAcc(a, o.g, tc.onum), adjAcc(a, o.g === 'm' ? 'f' : 'm', tc.onum), adjAcc(a, o.g, tc.onum === 'sg' ? 'pl' : 'sg')]); sub = `(${a.lemma})`; }
  latWords[blankIdx] = '___';
  const prompt = cap(latWords.join(' ')) + '.';
  return {
    type: 'objform', skill: 'objform', cid: 'g:objform', words: p.words, stage: 3,
    instr: mode === 'noun' ? 'Tap the form that makes it the direct object.' : 'Tap the adjective that matches the direct object.', prompt: { latin: prompt, sub },
    fields: [{ label: mode === 'noun' ? 'Direct object' : 'Adjective', choices: seeded(opts, [tc, mode]) }],
    check: v => {
      const ok = v[0] === want, hints = [];
      if (!ok && v[0]) {
        if (mode === 'noun') hints.push(`The subject is ${p.sLat[0]}, so ${o.lemma} is what receives the action: the direct object. Direct objects are accusative: ${want} (${caseEnd(o, tc.onum, 'acc')}).`);
        else hints.push(`${p.oLat[0]} is accusative ${tc.onum === 'sg' ? 'singular' : 'plural'} and ${G(o.g)}${o.trap ? ` (${o.lemma} is masculine)` : ''}, so the adjective is too: ${want}.`);
      }
      return { ok: [ok], hints, notes: [] };
    },
    correct: cap(p.lat.join(' ')) + '.', summary: prompt, params: [tc, mode],
  };
}
/* ----- case & function of a word, or what an adjective modifies ----- */
// sp = sentence spec for sentence3; ask = {p: part index, role: 'subj'|'obj'|'comp', w: index of the word inside the part's Latin} or {modify: true, ...}
export function gCaseFn(sp, ask) {
  const st = sentence3(sp), p = st.parts[ask.p], word = p.lat[ask.w];
  if (ask.pn) { const k = p.pk, per = Number(k[0]), num = k.slice(1);
    return { type: 'casefn', skill: 'casefn', cid: 'g:casefn', words: st.words, stage: 4,
      instr: `What is the person and number of ${word}?`, prompt: { latin: st.latin, help: st.help },
      fields: [{ label: 'Person', choices: ['1st', '2nd', '3rd'] }, { label: 'Number', choices: ['singular', 'plural'] }],
      check: v => { const ok = [v[0] === ['', '1st', '2nd', '3rd'][per], v[1] === (num === 'sg' ? 'singular' : 'plural')]; return { ok, hints: ok.every(Boolean) ? [] : [`${word} ends in ${ENDING_SAYS[k]}: ${PN_LABEL[k]} (present tense).`], notes: [] }; },
      correct: `${word}: ${PN_LABEL[k]}, present tense`, summary: `${word}: person + number`, params: [sp, ask] }; }
  if (ask.subjof) {
    const subjOf = q => q.sLat.filter((t, i) => t !== 'et' && !(q.cl.sa && i === 1)).join(' et ');
    const want = p.hidden ? PRON_SHOW[p.pk] : subjOf(p);
    const nouns = uniq(st.parts.flatMap(q => q.cl && q.cl.kind3 ? [...(q.hidden ? [] : [subjOf(q)]), ...(q.oLat[0] && !q.cl.opro ? [q.oLat[0]] : [])] : q.S && !q.S.implied ? [q.lat[0]] : []));
    const prons = seeded(Object.values(PRON_SHOW).filter(x => x !== want), [sp, ask]);
    const choices = seeded(uniq([want, ...nouns.filter(x => x !== want).slice(0, 3), ...prons]).slice(0, 6), [sp, ask, 'c']);
    return { type: 'casefn', skill: 'casefn', cid: 'g:casefn', words: st.words, stage: 4,
      instr: `Who or what is the subject of ${p.vf}?`, prompt: { latin: st.latin, help: st.help },
      fields: [{ label: `Subject of ${p.vf}`, choices }],
      check: v => { const ok = v[0] === want; return { ok: [ok], hints: ok || !v[0] ? [] : [p.hidden ? `No nominative goes with ${p.vf}, so the subject is in the ending: ${ENDING_SAYS[p.pk]}.` : `The subject is nominative and matches the verb: ${want}.${p.oLat[0] && v[0] === p.oLat[0] ? ` ${p.oLat[0]} is accusative: the direct object.` : ''}`], notes: [] }; },
      correct: `Subject of ${p.vf}: ${want}`, summary: `subject of ${p.vf}`, params: [sp, ask] };
  }
  const offset = ask.p === 0 ? 0 : st.parts[0].lat.length + 1;
  if (ask.modify) {
    const nounWord = p.lat[ask.n], nouns = uniq(st.parts.flatMap(q => q.cl && q.cl.kind3 ? [q.cl.s.length === 1 ? q.sLat[0] : null, ...(q.cl.s.length > 1 ? [q.sLat[0], q.sLat[2]] : []), q.cl.opro ? null : q.oLat[0], q.pp ? q.pp.nf : null] : q.S && !q.S.implied ? [q.lat[0]] : []).filter(Boolean));
    return {
      type: 'casefn', skill: 'casefn', cid: 'g:casefn', words: st.words, stage: 3,
      instr: `What word is ${word} modifying?`, prompt: { latin: st.latin, help: st.help },
      fields: [{ label: `${word} modifies`, choices: seeded(nouns, [sp, ask]) }],
      check: v => { const ok = v[0] === nounWord; return { ok: [ok], hints: ok || !v[0] ? [] : [`An adjective matches its noun in case, number and gender. ${word} matches ${nounWord}.`], notes: [] }; },
      correct: `${word} modifies ${nounWord}`, summary: `${word} modifies?`, params: [sp, ask],
    };
  }
  if (ask.ppq) { const want = p.pp.lat.join(' ');
    const words = p.lat, i0 = words.indexOf(p.pp.lat[0]);
    const decoys = uniq([words.slice(i0, i0 + p.pp.lat.length - 1).join(' '), words.slice(i0 + 1, i0 + p.pp.lat.length + 1).join(' '), p.oLat.join(' '), p.sLat.join(' ')].filter(x => x && x !== want));
    return { type: 'casefn', skill: 'casefn', cid: 'g:casefn', words: st.words, stage: 5,
      instr: 'What is the prepositional phrase in the sentence?', prompt: { latin: st.latin, help: st.help },
      fields: [{ label: 'Prepositional phrase', choices: seeded([want, ...decoys.slice(0, 3)], [sp, ask]) }],
      check: v => { const ok = v[0] === want; return { ok: [ok], hints: ok || !v[0] ? [] : [`A prepositional phrase = the preposition + its object (and any adjective with it): ${want}.`], notes: [] }; },
      correct: `Prepositional phrase: ${want}`, summary: 'the prepositional phrase', params: [sp, ask] }; }
  if (ask.trq) { const want = p.cl.k === 'tr' ? 'transitive' : 'intransitive';
    return { type: 'casefn', skill: 'casefn', cid: 'g:casefn', words: st.words, stage: 5,
      instr: `Is ${p.vf} a transitive or intransitive verb?`, prompt: { latin: st.latin, help: st.help },
      fields: [{ label: p.vf, choices: ['transitive', 'intransitive'] }],
      check: v => { const ok = v[0] === want; return { ok: [ok], hints: ok || !v[0] ? [] : [want === 'transitive' ? `${p.vf} has a direct object (${p.oLat[0]}), so it's transitive.` : `${p.vf} has no direct object${p.pp ? ` (${p.pp.lat.join(' ')} is a prepositional phrase, not a direct object)` : ''}, so it's intransitive.`], notes: [] }; },
      correct: `${p.vf}: ${want}`, summary: `${p.vf}: transitive?`, params: [sp, ask] }; }
  const ablOn = stageOn(5);
  const cas = ask.role === 'obj' ? 'accusative' : ask.role === 'pobj' ? (p.pp.takesAbl ? 'ablative' : 'accusative') : 'nominative';
  const fn = { subj: 'subject', obj: 'direct object', comp: 'complement', pobj: 'object of a preposition' }[ask.role];
  const caseOpts = ablOn ? ['nominative', 'accusative', 'ablative'] : ['nominative', 'accusative'];
  const fnOpts = ablOn ? ['subject', 'direct object', 'complement', 'object of a preposition'] : ['subject', 'direct object', 'complement'];
  return {
    type: 'casefn', skill: 'casefn', cid: 'g:casefn', words: st.words, stage: ask.role === 'pobj' ? 5 : 3,
    instr: `What is the case and function of ${word}?`, prompt: { latin: st.latin, help: st.help },
    fields: [{ label: 'Case', choices: caseOpts }, { label: 'Function', choices: fnOpts }],
    check: v => {
      const ok = [v[0] === cas, v[1] === fn], hints = [];
      if (!ok[0] && v[0]) hints.push(ask.role === 'pobj' ? `${p.pp.lat[0]} takes the ${cas}, so ${word} is ${cas}.` : `${word} is ${cas}.${cas === 'accusative' ? ' -am, -as, -um, -os are accusative endings.' : ''}`);
      if (!ok[1] && v[1]) hints.push(fn === 'object of a preposition' ? `${word} comes right after the preposition ${p.pp.lat[0]}: it's the object of the preposition.` : fn === 'direct object' ? (ablOn ? 'It is accusative with no preposition in front, so it receives the action: the direct object.' : 'Accusative nouns can only be direct objects: they receive the action.') : fn === 'subject' ? 'Nominative + an action verb: it\'s the subject (who does it?).' : 'With est / sunt, the nominative word that describes the subject is the complement.');
      if (ok[0] && !ok[1] && cas === 'nominative' && v[1] === 'direct object') hints.push('A nominative word can never be a direct object.');
      return { ok, hints, notes: [] };
    },
    correct: `${word}: ${cas}, ${fn}`, summary: `${word}: case + function`, params: [sp, ask],
  };
}
export function caseFnAsks(sp) { // every question that can be asked about a sentence
  const st = sentence3(sp), out = [];
  st.parts.forEach((p, pi) => {
    if (p.cl.kind3) {
      const s0 = p.lat.indexOf(p.sLat[0]); if (s0 >= 0 && p.cl.s.length === 1) out.push({ p: pi, role: 'subj', w: s0 });
      if (p.cl.opro) out.push({ p: pi, role: 'obj', w: p.lat.indexOf(p.oLat[0]) });
      if (p.oLat.length && !p.cl.opro) { out.push({ p: pi, role: 'obj', w: p.lat.indexOf(p.oLat[0]) }); if (p.oLat[1]) out.push({ p: pi, modify: true, w: p.lat.indexOf(p.oLat[1]), n: p.lat.indexOf(p.oLat[0]) }); }
      if (p.sLat[1] && p.cl.s.length === 1) out.push({ p: pi, modify: true, w: p.lat.indexOf(p.sLat[1]), n: p.lat.indexOf(p.sLat[0]) });
      if (p.pp) { const iN = p.lat.indexOf(p.pp.nf); out.push({ p: pi, role: 'pobj', w: iN }, { p: pi, ppq: true, w: iN });
        if (p.pp.af) out.push({ p: pi, modify: true, w: p.lat.indexOf(p.pp.af), n: iN }); }
      if (stageOn(5)) out.push({ p: pi, trq: true, w: p.lat.indexOf(p.vf) });
    } else if (p.cl && !p.S.implied && p.cl.s.length === 1) {
      out.push({ p: pi, role: 'subj', w: 0 });
      if (p.idx.a >= 0 && p.cl.k === 'adj') out.push({ p: pi, role: 'comp', w: p.idx.a });
    }
  });
  if (stageOn(4)) st.parts.forEach((p, pi) => { if (!p.cl.kind3) return; out.push({ p: pi, pn: true, w: p.lat.indexOf(p.vf) }); out.push({ p: pi, subjof: true, w: p.lat.indexOf(p.vf) }); });
  // a word that appears twice in the sentence would be ambiguous: skip it
  const all = st.parts.flatMap(p => p.lat).map(letters);
  return out.filter(a => all.filter(t => t === letters(st.parts[a.p].lat[a.w])).length === 1 && (!a.modify || all.filter(t => t === letters(st.parts[a.p].lat[a.n])).length === 1));
}

/* ----- random specs that make sense ----- */
const ANIM_SUBJ = n => n.person || n.animal;
export function pools3() {
  const nouns = NOUNS.filter(w => isOn(w) && w.pl), adjs = ADJS.filter(a => isOn(a) && a.phrase && !['multus', 'alter', 'solus'].includes(a.id));
  const verbs = DRILL_VERBS.filter(isOn);
  return { nouns, adjs, verbs, anim: nouns.filter(ANIM_SUBJ), persons: nouns.filter(n => n.person), things: nouns.filter(n => !n.person && !n.animal) };
}
const OBJ_PERSON = ['doceo', 'voco'];
function objPool(vb, P, subj) {
  const base = OBJ_PERSON.includes(vb.id) ? P.persons : vb.tr === 'anim' ? P.anim : vb.tr === 'have' ? P.nouns.filter(n => !n.person) : P.nouns;
  return base.filter(n => !subj.includes(n.id));
}
const PERSON_SUBJ = ['doceo', 'voco', 'clamo', 'rideo', 'taceo', 'habito'];
function subjPool(vb, P) { if (PERSON_SUBJ.includes(vb.id)) return P.persons; return vb.tr === false ? (vb.id === 'habito' ? P.persons : P.anim) : vb.id === 'vexo' ? P.nouns : vb.tr === 'have' ? P.persons : P.anim; }
export function randomT(pick, P, opts = {}) {
  const tr = opts.k ? opts.k === 'tr' : coin(0.8);
  const vb = pick(P.verbs.filter(v => (v.tr !== false) === tr)) || pick(P.verbs);
  const isTr = vb.tr !== false;
  const sp = subjPool(vb, P), num = () => (coin(0.5) ? 'sg' : 'pl');
  let s, sNum = num(), nums, sa = null;
  if (coin(isTr ? 0.15 : 0.3) && P.persons.length > 1) { const a = pick(P.persons), b = pick(P.persons.filter(w => w.id !== a.id)); s = [a.id, b.id]; nums = coin(0.4) ? ['pl', 'pl'] : ['sg', 'sg']; sNum = 'pl'; }
  else { const n = pick(sp); s = [n.id]; if (coin(0.25)) { const a = pick(P.adjs.filter(x => fits(n, x))); if (a) sa = a.id; } }
  const tc = { k: isTr ? 'tr' : 'int', s, num: sNum, nums, sa, v: vb.id, neg: !vb.noNeg && coin(opts.negP ?? 0.15) };
  if (stageOn(4) && !opts.noHidden && coin(opts.hiddenP ?? 0.4)) { // Stage 4: the subject is in the verb (videmus, curritis, amat with no nominative)
    const [pp, nn] = pickOne(PERSONS6); tc.s = []; tc.sa = null; tc.nums = undefined; tc.per = pp; tc.num = nn; if (pp !== 3 && coin(0.25)) tc.pro = true;
  }
  if (isTr) {
    if (stageOn(4) && vb.tr === 'anim' && coin(0.15)) { tc.opro = pickOne(['eum', 'eam', 'eos', 'eas']); tc.o = null; tc.onum = OPRO[tc.opro].num; tc.order = pickOne(['SOV', 'OSV']); return tc; }
    const o = pick(objPool(vb, P, tc.s)); tc.o = o.id; tc.onum = num();
    if (coin(opts.oaP ?? 0.3)) { const a = pick(P.adjs.filter(x => fits(o, x) && x.id !== sa)); if (a) tc.oa = a.id; }
    tc.order = pickOne(['SOV', 'SOV', 'OSV', 'OSV', 'SVO']);
  }
  if (stageOn(5) && coin(opts.ppP ?? 0.45)) { const pp = ppFor(vb, pick, P, [...tc.s, tc.o].filter(Boolean), !tc.s.length || tc.s.every(id => W[id].person)); if (pp) tc.pp = pp; }
  return tc;
}
export function randomSpec3(pick, P, twoP = 0.4) {
  const c1 = randomT(pick, P);
  if (!coin(twoP)) return { c1 };
  const conj = pickOne(['et', 'sed', 'quod']);
  if (coin(0.25)) { // second part: a Stage 2 linking-verb clause ("…et familia laeta est")
    const pools = poolsFor(99); const r = randomClause(pick, { ...pools, nouns: pools.nouns.filter(isOn), cadjs: pools.cadjs.filter(isOn), persons: pools.persons.filter(isOn), attr: pools.attr.filter(isOn) }, { negP: 0.25 });
    if (!r.imp && r.k !== 'act') return { c1, c2: { kind: 'lv', cl: r }, conj: conj === 'et' && (c1.s.length > 1 || r.s.length > 1) ? 'sed' : conj };
  }
  let c2, tries = 0; do { c2 = randomT(pick, P); tries++; } while (tries < 6 && c2.s.some(id => c1.s.includes(id)));
  return { c1, c2, conj: conj === 'et' && (c1.s.length > 1 || c2.s.length > 1) ? 'sed' : conj };
}


/* =============== Stage 4: the present tense =============== */
const pkOf = (per, num) => per + num;
const PN_ORDER = ['1sg', '2sg', '3sg', '1pl', '2pl', '3pl'];
export const CONJ_NAME = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };
// Person & number of a form (the homework's "person, number, and tense"; tense is present until Stage 6)
export function gPnum(vid, per, num) {
  const vb = W[vid], form = conjForm(vb, per, num), k = pkOf(per, num);
  return {
    type: 'pnum', skill: 'pnum', cid: 'g:pnum', words: [vid], stage: 4,
    instr: 'Person and number?', prompt: { latin: form, sub: `(${vb.entry})` },
    fields: [{ label: 'Person', choices: ['1st', '2nd', '3rd'] }, { label: 'Number', choices: ['singular', 'plural'] }],
    check: v => {
      const ok = [v[0] === ['', '1st', '2nd', '3rd'][per], v[1] === (num === 'sg' ? 'singular' : 'plural')], hints = [];
      if (!ok.every(Boolean)) hints.push(`${form} ends in ${ENDING_SAYS[k]}: ${PN_LABEL[k]}.`);
      return { ok, hints, notes: [] };
    },
    correct: `${form}: ${PN_LABEL[k]} (${PRON_SHOW[k]})`, summary: `${form}: person + number`, params: [vid, per, num],
  };
}
// Translate one verb form into English (all three translations count: I walk / I am walking / I do walk)
export function gVtrans(vid, per, num) {
  const vb = W[vid], form = conjForm(vb, per, num), k = pkOf(per, num);
  const accFor = (p, n) => { const out = []; for (const pr of PRON_EN[pkOf(p, n)]) for (const ve of vEnP(vb, p, n, false)) out.push(`${pr} ${ve}`); return enAns(out); };
  const acc = accFor(per, num), others = PERSONS6.filter(([p, n]) => !(p === per && n === num));
  const otherAcc = others.flatMap(([p, n]) => accFor(p, n));
  return {
    type: 'vtrans', skill: 'vtrans', cid: 'g:vtrans', words: [vid], stage: 4,
    instr: 'Translate the verb. The subject is in the ending.', prompt: { latin: form },
    fields: [{ label: 'English', ph: 'English' }],
    check: v => {
      const t = enKey(prenorm(v[0]));
      if (acc.includes(t)) return { ok: [true], hints: [], notes: [] };
      const fz = t && fuzzyEn(t, acc, otherAcc); if (fz) return { ok: [true], hints: [], notes: [`Spelled: ${fz}`] };
      const hints = [];
      if (t) {
        const hit = others.find(([p, n]) => accFor(p, n).includes(t));
        if (hit) hints.push(`${form} ends in ${ENDING_SAYS[k]}, not ${ENDING_SAYS[pkOf(...hit)].split(' = ')[0]}. "${PRON_SHOW[k]} ${vEnP(vb, per, num, false)[0]}"`);
        else if (k === '2pl' && t.startsWith('you ') && !/^you (all|guys)/.test(t)) hints.push('-tis is plural "you": write "you all".');
        else if (k === '3sg' && PRON_EN['3sg'].some(pr => vb.en.some(e => t === `${pr} ${e.pl}`))) hints.push(`he/she/it → the English verb takes -s: "${PRON_SHOW[k]} ${vEnP(vb, per, num, false)[0]}".`);
        else hints.push(`${ENDING_SAYS[k]}. Start with the subject: "${PRON_SHOW[k]} …"`);
      }
      return { ok: [false], hints, notes: [] };
    },
    correct: `${form}: ${PRON_SHOW[k]} ${vEnP(vb, per, num, false)[0]}`, summary: form, params: [vid, per, num],
  };
}
// English → tap the Latin form (her "translate into Latin" exercise, without writing Latin)
export function gVpick(vid, per, num, style = 0) {
  const vb = W[vid], k = pkOf(per, num), want = conjForm(vb, per, num);
  const ve = vEnP(vb, per, num, false), phrase = ve[Math.min(style, ve.length - 1)];
  const eng = `${PRON_SHOW[k] === 'he/she/it' ? pickStable(['he', 'she', 'it'], [vid, per, num]) : PRON_SHOW[k]} ${phrase}`;
  const opts = seeded(uniq(PN_ORDER.map(x => conjForm(vb, Number(x[0]), x.slice(1)))), [vid, per, num, style]);
  return {
    type: 'vpick', skill: 'vpick', cid: 'g:vpick', words: [vid], stage: 4,
    instr: 'Tap the Latin.', prompt: { eng: cap(eng) },
    fields: [{ label: 'Latin', choices: opts }],
    check: v => { const ok = v[0] === want; return { ok: [ok], hints: ok || !v[0] ? [] : [`"${PRON_SHOW[k]}" = ${ENDING_SAYS[k].split(' = ')[0]}: ${want}.`], notes: [] }; },
    correct: `${cap(eng)} = ${want}`, summary: `${eng} → Latin`, params: [vid, per, num, style],
  };
}
function pickStable(arr, seed) { return seeded(arr, seed)[0]; }
// Conjugate it: tap each of the six forms (or: which conjugation is it?)
export function gConj(vid, mode = 'all') {
  const vb = W[vid];
  if (mode === 'which') {
    const want = CONJ_NAME[vb.conj];
    return {
      type: 'conj', skill: 'conj', cid: 'g:conj', words: [vid], stage: 4,
      instr: 'Which conjugation? Look at the infinitive.', prompt: { latin: vb.entry.split(',').slice(0, 2).join(',') },
      fields: [{ label: 'Conjugation', choices: ['1st', '2nd', '3rd', '4th'] }],
      check: v => { const ok = v[0] === want; return { ok: [ok], hints: ok || !v[0] ? [] : [`${vb.inf} ends in ${({ 1: '-āre', 2: '-ēre', 3: '-ere', 4: '-īre' })[vb.conj]}: ${want} conjugation.`], notes: [] }; },
      correct: `${vb.inf}: ${want} conjugation`, summary: `${vb.lemma}: conjugation`, params: [vid, mode],
    };
  }
  const forms = PN_ORDER.map(x => conjForm(vb, Number(x[0]), x.slice(1)));
  // Each box: the right form, the same person in the wrong conjugation pattern, and a neighbouring person's form.
  const decoyConj = vb.conj === 3 ? 1 : 3, st = unmac(vb.inf).replace(/(are|ere|ire)$/, '');
  const dv = { ...vb, conj: decoyConj, inf: st + (decoyConj === 1 ? 'are' : 'ere') };
  const rowOpts = PN_ORDER.map((x, i) => { const wrongConj = i === 0 ? null : conjForm(dv, Number(x[0]), x.slice(1));
    const neighbour = forms[(i + 1) % 6], o = uniq([forms[i], wrongConj, neighbour].filter(Boolean)).filter((f, j) => j === 0 || !forms.slice(0, 0).includes(f));
    if (o.length < 3) o.push(forms[(i + 2) % 6]); return seeded(uniq(o).slice(0, 3), [vid, x]); });
  return {
    type: 'conj', skill: 'conj', cid: 'g:conj', words: [vid], stage: 4,
    instr: 'Conjugate it in the present tense: tap the form for each box.', prompt: { latin: vb.entry.split(',').slice(0, 2).join(',') },
    fields: PN_ORDER.map((x, i) => ({ label: PN_LABEL[x], choices: rowOpts[i] })),
    check: v => {
      const ok = forms.map((f, i) => v[i] === f), hints = [];
      if (!ok.every(Boolean)) hints.push(`${CONJ_NAME[vb.conj]} conjugation: ${({ 1: 'linking vowel a (1st sg drops it: -o)', 2: 'linking vowel e, no irregularities', 3: 'linking vowel i (1st sg drops it, 3rd pl -unt)', 4: 'linking vowel i (3rd pl -iunt)' })[vb.conj]}.`);
      return { ok, hints, notes: [] };
    },
    correct: forms.join(', '), summary: `Conjugate ${vb.lemma}`, params: [vid, mode],
  };
}
CHARTS.push(
  { id: 'pe', title: 'Present Tense Endings', stage: 4, opts: ['-o', '-s', '-t', '-mus', '-tis', '-nt'],
    cells: [['1st singular (I)', '-o'], ['2nd singular (you)', '-s'], ['3rd singular (he/she/it)', '-t'], ['1st plural (we)', '-mus'], ['2nd plural (you all)', '-tis'], ['3rd plural (they)', '-nt']] },
  { id: 'pv', title: 'Present Tense Linking Vowels', stage: 4, opts: ['a', 'e', 'i'],
    cells: [['1st conjugation (amāre)', 'a'], ['2nd conjugation (habēre)', 'e'], ['3rd conjugation (cadere)', 'i'], ['4th conjugation (audīre)', 'i']] },
);
SKILLS.push(
  { id: 'pnum', stage: 4, name: 'Person & number', desc: '-o, -s, -t, -mus, -tis, -nt' },
  { id: 'vtrans', stage: 4, name: 'Translate the verb', desc: 'festinatis = you all hurry' },
  { id: 'vpick', stage: 4, name: 'Pick the Latin verb', desc: '"We walk" → tap the form' },
  { id: 'conj', stage: 4, name: 'Conjugate it', desc: 'All six forms, all four conjugations' },
);
SKILL.pnum = SKILLS.find(x => x.id === 'pnum'); SKILL.vtrans = SKILLS.find(x => x.id === 'vtrans'); SKILL.vpick = SKILLS.find(x => x.id === 'vpick'); SKILL.conj = SKILLS.find(x => x.id === 'conj');
export const CONJ_VERBS = () => WORDS.filter(w => w.kind === 'vb' && isOn(w) && w.en && w.conj !== 'irr');
export function makeSkillCard4(skillId, pick) {
  const vb = pick(CONJ_VERBS()), [p, n] = pickOne(PERSONS6);
  switch (skillId) {
    case 'pnum': return gPnum(vb.id, p, n);
    case 'vtrans': return gVtrans(vb.id, p, n);
    case 'vpick': return gVpick(vb.id, p, n, pickOne([0, 0, 1, 2]));
    case 'conj': return coin(0.3) ? gConj(vb.id, 'which') : gConj(vb.id);
  }
}

/* =============== Stage 5: prepositions & the ablative =============== */
// villa and villā are different answers now: keep both (the long mark is the whole point)
const uniqX = arr => [...new Set(arr)];
const ablF = (n, num) => n.abl[num];
const adjAbl = (a, g, num) => a.abl[g][num];
const vowelStart = w => /^[aeiouh]/i.test(unmac(w)) && !/^h/i.test(w);
// e/ex and a/ab: ex / ab before a vowel, e / a before a consonant (e silvā, ex agrīs, a lupō, ab agrīs)
function prepLat(pid, next) {
  if (pid === 'eex') return vowelStart(next) ? 'ex' : 'e';
  if (pid === 'aab') return vowelStart(next) ? 'ab' : 'a';
  if (pid === 'inabl' || pid === 'inacc') return 'in';
  return W[pid].lemma;
}
// English for each preposition, from her sheet (+ the obvious synonyms)
export const PREP_EN = { aab: ['away from', 'from'], ad: ['to', 'towards', 'toward', 'at'], circum: ['around'], cum: ['with'], de: ['about', 'concerning'],
  eex: ['out of', 'from', 'out from'], inabl: ['in', 'on'], inacc: ['into', 'onto'], pro: ['for', 'on behalf of', 'in front of'], prope: ['near', 'close to', 'next to'],
  sine: ['without'], trans: ['across', 'over'] };
// pp = {p: prep id, n: noun id, num, a: adjective id, pos: 'front'|'beforeV'}
export function ppPhrase(pp) {
  const n = W[pp.n], a = pp.a ? W[pp.a] : null, takesAbl = W[pp.p].takes === 'ablative';
  const nf = takesAbl ? ablF(n, pp.num) : accF(n, pp.num), af = a ? (takesAbl ? adjAbl(a, n.g, pp.num) : adjAcc(a, n.g, pp.num)) : null;
  const lat = [prepLat(pp.p, nf), nf, ...(af ? [af] : [])];
  const nps = nounEnOpts(n, pp.num, a), en = []; for (const pe of PREP_EN[pp.p]) for (const np of nps) en.push(`${pe} ${np}`);
  return { lat, en: enAns(en), show: `${PREP_EN[pp.p][0]} ${nounShow(n, pp.num, a)}`, nf, af, takesAbl };
}
// which phrases make sense with which verbs
const MOTION = ['ambulo', 'curro', 'festino', 'navigo', 'venio', 'erro', 'cado'];
const PLACE_IDS = ['villa', 'hortus', 'ager', 'via', 'silva', 'schola', 'insula', 'terra', 'fossa', 'rivus', 'porta', 'taberna', 'vicus', 'area', 'murus', 'raeda'];
export function ppFor(vb, pick, P, avoid = [], personSubj = true) {
  const places = P.nouns.filter(n => PLACE_IDS.includes(n.id) && !avoid.includes(n.id)), people = P.persons.filter(n => !avoid.includes(n.id));
  const opts = [];
  if (MOTION.includes(vb.id)) opts.push('ad', 'eex', 'aab', 'trans', 'circum', 'inacc', 'ad', 'eex');
  if (vb.tr === false || coin(0.4)) opts.push('inabl', 'inabl', 'prope');
  if (personSubj) { opts.push('cum'); if (coin(0.3)) opts.push('sine'); }
  if (personSubj && ['laboro', 'pugno'].includes(vb.id)) opts.push('pro', 'pro');
  if (['cogito', 'dico', 'narro'].includes(vb.id)) opts.push('de', 'de', 'de');
  const p = pickOne(opts.filter(x => isOn(W[x])));
  if (!p) return null;
  const pool = ['cum', 'sine', 'pro'].includes(p) ? people : p === 'de' ? P.nouns.filter(n => !avoid.includes(n.id)) : places;
  const n = pick(pool); if (!n) return null;
  const num = n.id === 'terra' ? 'sg' : coin(0.5) ? 'sg' : 'pl';
  const a = coin(0.25) ? pick(P.adjs.filter(x => fits(n, x))) : null;
  return { p, n: n.id, num, a: a ? a.id : null, pos: coin(0.4) ? 'front' : 'beforeV' };
}
CHARTS.push(
  { id: 'a1', title: '1st Declension: Nom., Acc. & Abl.', stage: 5, opts: ['-a', '-ae', '-am', '-as', '-ā', '-īs'],
    cells: [['Nominative singular', '-a'], ['Nominative plural', '-ae'], ['Accusative singular', '-am'], ['Accusative plural', '-as'], ['Ablative singular', '-ā'], ['Ablative plural', '-īs']] },
  { id: 'a2', title: '2nd Declension: Nom., Acc. & Abl.', stage: 5, opts: ['-us / -r', '-ī', '-um', '-os', '-ō', '-īs'],
    cells: [['Nominative singular', '-us / -r'], ['Nominative plural', '-ī'], ['Accusative singular', '-um'], ['Accusative plural', '-os'], ['Ablative singular', '-ō'], ['Ablative plural', '-īs']] },
);
const formOf = (n, num, cas) => (cas === 'abl' ? ablF(n, num) : cas === 'acc' ? accF(n, num) : nForm(n, num));
const ablEnd = (n, num) => (n.gen === 'ae' ? (num === 'sg' ? '-ā' : '-īs') : (num === 'sg' ? '-ō' : '-īs'));
// Case, number and gender of a form (Stage 5 adds the ablative and asks gender too)
export function gCase5(nid, num, cas) {
  const n = W[nid], form = formOf(n, num, cas);
  const end = cas === 'abl' ? ablEnd(n, num) : caseEnd(n, num, cas);
  return {
    type: 'case5', skill: 'case', cid: 'g:case', words: [nid], stage: 5,
    instr: 'Case, number and gender?', prompt: { latin: form, sub: `(${n.entry})` },
    fields: [{ label: 'Case', choices: ['nominative', 'accusative', 'ablative'] }, { label: 'Number', choices: ['singular', 'plural'] }, { label: 'Gender', choices: ['masculine', 'feminine'] }],
    check: v => {
      const ok = [v[0] === CASES[cas], v[1] === (num === 'sg' ? 'singular' : 'plural'), v[2] === G(n.g)], hints = [];
      if (!ok[0] || !ok[1]) hints.push(`${form} ends in ${end}: ${CASES[cas]} ${num === 'sg' ? 'singular' : 'plural'}.${cas === 'abl' ? ' Watch the long mark: -ā and -ō are ablative.' : ''}`);
      if (!ok[2]) hints.push(n.trap ? `${n.lemma} is 1st declension but masculine.` : `Check the entry: ${n.entry}.`);
      return { ok, hints, notes: [] };
    },
    correct: `${form}: ${CASES[cas]} ${num === 'sg' ? 'singular' : 'plural'}, ${G(n.g)}`, summary: `${form}: case, number, gender`, params: [nid, num, cas],
  };
}
export function gDecline5(nid, num, cas) {
  const n = W[nid], want = formOf(n, num, cas);
  const opts = seeded(uniqX([n.lemma, n.pl, n.acc.sg, n.acc.pl, n.abl.sg, n.abl.pl]), [nid, num, cas, 5]);
  return {
    type: 'decline5', skill: 'case', cid: 'g:case', words: [nid], stage: 5,
    instr: `Tap the ${CASES[cas]} ${num === 'sg' ? 'singular' : 'plural'}.`, prompt: { latin: n.entry, sub: `${CASES[cas]} ${num === 'sg' ? 'singular' : 'plural'}` },
    fields: [{ label: 'Form', choices: opts }],
    check: v => { const ok = v[0] === want; return { ok: [ok], hints: ok || !v[0] ? [] : [`${n.gen === 'ae' ? '1st' : '2nd'} declension ${CASES[cas]} ${num === 'sg' ? 'singular' : 'plural'}: ${cas === 'abl' ? ablEnd(n, num) : caseEnd(n, num, cas)} → ${want}.`], notes: [] }; },
    correct: `${CASES[cas]} ${num === 'sg' ? 'singular' : 'plural'}: ${want}`, summary: `${n.lemma}: ${CASES[cas]} ${num}`, params: [nid, num, cas],
  };
}
// Make the adjective agree with a noun in any case (her "make ignavus agree with…": nautā → ignavō)
export function gAgree5(nid, num, cas, aid) {
  const n = W[nid], a = W[aid], form = formOf(n, num, cas), want = cas === 'abl' ? adjAbl(a, n.g, num) : cas === 'acc' ? adjAcc(a, n.g, num) : aForm(a, n.g, num);
  const all = uniqX(['m', 'f'].flatMap(g => ['sg', 'pl'].flatMap(nm => [aForm(a, g, nm), adjAcc(a, g, nm), adjAbl(a, g, nm)])));
  const opts = seeded(uniqX([want, ...seeded(all.filter(x => x !== want), [nid, num, cas, aid]).slice(0, 5)]), [nid, num, cas, aid, 'o']);
  return {
    type: 'agree5', skill: 'agree5', cid: 'g:agree5', words: [nid, aid], stage: 5,
    instr: `Make ${a.lemma} agree with the noun.`, prompt: { latin: `${form} ___`, sub: `(${a.lemma})` },
    fields: [{ label: 'Adjective', choices: opts }],
    check: v => { const ok = v[0] === want; return { ok: [ok], hints: ok || !v[0] ? [] : [`${form} is ${CASES[cas]} ${num === 'sg' ? 'singular' : 'plural'} and ${G(n.g)}${n.trap ? ` (${n.lemma} is masculine even though it ends in -a)` : ''}. The adjective matches all three: ${want}.`], notes: [] }; },
    correct: `${form} ${want}`, summary: `${form} ___ (${a.lemma})`, params: [nid, num, cas, aid],
  };
}
// Prepositional phrase, Latin → English
export function gPPl2e(pp) {
  const ph = ppPhrase(pp), otherNum = W[pp.n].pl ? ppPhrase({ ...pp, num: pp.num === 'sg' ? 'pl' : 'sg' }).en : [];
  const otherIn = pp.p === 'inabl' || pp.p === 'inacc' ? ppPhrase({ ...pp, p: pp.p === 'inabl' ? 'inacc' : 'inabl' }).en : [];
  return {
    type: 'ppl2e', skill: 'ppl2e', cid: 'g:ppl2e', words: [pp.p, pp.n, pp.a].filter(Boolean), stage: 5,
    instr: 'Translate the prepositional phrase.', prompt: { latin: ph.lat.join(' ') },
    fields: [{ label: 'English', ph: 'English' }],
    check: v => {
      const t = enKey(prenorm(v[0])); if (ph.en.includes(t)) return { ok: [true], hints: [], notes: [] };
      const fz = t && fuzzyEn(t, ph.en, [...otherNum, ...otherIn]); if (fz) return { ok: [true], hints: [], notes: [`Spelled: ${fz}`] };
      const hints = [];
      if (otherIn.includes(t)) hints.push(pp.p === 'inabl' ? `in + ablative = in / on. ${ph.nf} is ablative.` : `in + accusative = into / onto. ${ph.nf} is accusative.`);
      else if (otherNum.includes(t)) hints.push(`${ph.nf} is ${pp.num === 'sg' ? 'singular' : 'plural'}: "${ph.show}."`);
      else if (t) hints.push(`${ph.lat[0]} = ${PREP_EN[pp.p].slice(0, 2).join(' / ')}.`);
      return { ok: [false], hints, notes: [] };
    },
    correct: proper(`${ph.lat.join(' ')} = ${ph.show}`), summary: ph.lat.join(' '), params: [pp],
  };
}
// English → tap the Latin phrase (her "translate the English prepositional phrases into Latin", without writing Latin)
export function gPPe2l(pp) {
  const ph = ppPhrase(pp), n = W[pp.n], a = pp.a ? W[pp.a] : null, good = ph.lat.join(' ');
  const wrongCase = ph.takesAbl ? [prepLat(pp.p, accF(n, pp.num)), accF(n, pp.num), ...(a ? [adjAcc(a, n.g, pp.num)] : [])] : [prepLat(pp.p, ablF(n, pp.num)), ablF(n, pp.num), ...(a ? [adjAbl(a, n.g, pp.num)] : [])];
  const onum = pp.num === 'sg' ? 'pl' : 'sg';
  const wrongNum = n.pl ? ppPhrase({ ...pp, num: onum }).lat : null;
  const nomForm = [prepLat(pp.p, nForm(n, pp.num)), nForm(n, pp.num), ...(a ? [aForm(a, n.g, pp.num)] : [])];
  const wrongAdj = a ? [ph.lat[0], ph.nf, (ph.takesAbl ? adjAbl : adjAcc)(a, n.g === 'm' ? 'f' : 'm', pp.num)] : null;
  const opts = seeded(uniqX([good, wrongCase.join(' '), ...(wrongNum ? [wrongNum.join(' ')] : []), nomForm.join(' '), ...(wrongAdj ? [wrongAdj.join(' ')] : [])]).slice(0, 4), [pp, 'e2l']);
  if (!opts.includes(good)) opts[0] = good;
  return {
    type: 'ppe2l', skill: 'ppe2l', cid: 'g:ppe2l', words: [pp.p, pp.n, pp.a].filter(Boolean), stage: 5,
    instr: 'Tap the Latin. Which case does the preposition take?', prompt: { eng: proper(ph.show) },
    fields: [{ label: 'Latin', choices: seeded(opts, [pp, 'o']) }],
    check: v => {
      const ok = v[0] === good, hints = [];
      if (!ok && v[0]) hints.push(`${W[pp.p].lemma.split(' ')[0]} takes the ${W[pp.p].takes}${pp.num === 'pl' ? ' (plural)' : ''}: ${good}.${a && v[0] === (wrongAdj || []).join(' ') ? ` The adjective matches the noun's gender${n.trap ? ` (${n.lemma} is masculine)` : ''}.` : ''}`);
      return { ok: [ok], hints, notes: [] };
    },
    correct: proper(`${ph.show} = ${good}`), summary: `${ph.show} → Latin`, params: [pp],
  };
}
export function randomPP(pick, P) {
  const places = P.nouns.filter(n => PLACE_IDS.includes(n.id));
  const on = Object.keys(PREP_EN).filter(x => isOn(W[x])), p = pickOne(on.length ? on : Object.keys(PREP_EN));
  const pool = ['cum', 'sine', 'pro'].includes(p) ? P.persons : p === 'de' ? P.nouns : (places.length ? places : P.nouns);
  const n = pick(pool), num = n.id === 'terra' ? 'sg' : coin(0.5) ? 'sg' : 'pl';
  const a = coin(0.35) ? pick(P.adjs.filter(x => fits(n, x))) : null;
  return { p, n: n.id, num, a: a ? a.id : null };
}
SKILLS.push(
  { id: 'agree5', stage: 5, name: 'Make it agree', desc: 'Adjectives in every case: nautā → ignavō' },
  { id: 'ppl2e', stage: 5, name: 'Prepositional phrases', desc: 'in villā = in the house' },
  { id: 'ppe2l', stage: 5, name: 'Pick the Latin phrase', desc: 'Which case does it take?' },
);
['agree5', 'ppl2e', 'ppe2l'].forEach(id => { SKILL[id] = SKILLS.find(x => x.id === id); });
export function makeSkillCard5(skillId, pick) {
  const P = pools3(), nouns = P.nouns, num = () => (coin(0.5) ? 'sg' : 'pl');
  switch (skillId) {
    case 'agree5': { const n = pick(nouns), a = pick(P.adjs.filter(x => fits(n, x))) || pick(P.adjs); return gAgree5(n.id, num(), pickOne(['nom', 'acc', 'abl', 'abl']), a.id); }
    case 'ppl2e': return gPPl2e(randomPP(pick, P));
    case 'ppe2l': return gPPe2l(randomPP(pick, P));
  }
}
