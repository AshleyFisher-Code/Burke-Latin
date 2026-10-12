// Card builders. Every builder takes explicit parameters so tests can enumerate all of them;
// the random pickers below choose parameters, preferring words he hasn't seen in a while.
import { WORDS, W, letters } from './data.js';
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
export function vocabL2E(w) {
  const second = w.kind !== 'x';
  return {
    type: 'l2e', cid: 'w:' + w.id, words: [w.id], hook: w.hook, stage: w.stage,
    instr: w.kind === 'x' ? 'What does it mean?' : w.kind === 'v' ? 'Meaning, then tap singular or plural.' : 'Meaning, then the middle stuff.',
    prompt: { latin: w.lemma },
    fields: [{ label: 'Meaning', ph: 'English' }].concat(second ? [w.kind === 'v' ? { label: 'Number', choices: ['singular', 'plural'] } : { label: 'Middle stuff', ph: 'middle stuff' }] : []),
    check: v => pack(second ? [gradeMeaning(v[0], w), w.kind === 'v' ? gradeVerbNum(v[1], w) : gradeMiddle(v[1], w)] : [gradeMeaning(v[0], w)]),
    correct: vocabAnswer(w), summary: w.lemma,
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
  return same.concat(other).slice(0, 3).map(x => x.id);
}
export function vocabAnswer(w) {
  if (w.kind === 'v') return `${w.lemma}: ${w.show}  (${w.num === 'sg' ? 'singular' : 'plural'})`;
  if (w.kind === 'x') return `${w.lemma}: ${w.show}`;
  return `${w.entry}: ${w.show}`;
}

/* =============== grammar building blocks =============== */
export const NOUNS = WORDS.filter(w => w.kind === 'n' && w.id !== 'roma');
export const PL_NOUNS = NOUNS.filter(w => w.pl);
export const ADJS = WORDS.filter(w => w.kind === 'a');
export const PHRASE_ADJS = ADJS.filter(w => w.phrase);
export const PERSONS = NOUNS.filter(w => w.person);
export const ACTION_VERBS = WORDS.filter(w => w.kind === 'v' && w.num === 'sg' && w.id !== 'est' && w.id !== 'habitat');
// Feelings only make sense for people; keep generated sentences sensible.
const FEELINGS = ['defessus', 'laetus', 'iratus', 'solus'];
const SHAPES = ['longus', 'latus'], SHAPED = ['via', 'porta', 'villa', 'ager', 'hortus', 'equus'];
export const fits = (n, a) => (n.person ? !SHAPES.includes(a.id) : !FEELINGS.includes(a.id)) && (!SHAPES.includes(a.id) || SHAPED.includes(n.id));
const COMP_SKIP = ['multus', 'vicinus', 'alter'];
export const COMP_ADJS = WORDS.filter(w => w.kind === 'a' && !COMP_SKIP.includes(w.id));
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
];
export function gChart(cid) {
  const c = CHARTS.find(x => x.id === cid);
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
      const fz = !accepted.has(e) && fuzzyEn(e, [...accepted], otherAll); const ok1 = accepted.has(e) || !!fz;
      if (fz) r0.note = (r0.note ? r0.note + ' ' : '') + `Spelled: ${fz}`;
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
];
export const SKILL = Object.fromEntries(SKILLS.map(s => [s.id, s]));
const coin = p => Math.random() < p;
export function makeSkillCard(skillId, pick = pickOne, maxStage = 99) {
  const inStage = l => { const f = l.filter(w => w.stage <= maxStage); return f.length ? f : l; };
  const nouns = inStage(PL_NOUNS), adjs = inStage(ADJS), padjs = inStage(PHRASE_ADJS), persons = inStage(PERSONS), cadjs = inStage(COMP_ADJS).filter(a => a.phrase);
  const adjFor = (n, list) => pick(list.filter(a => fits(n, a)));
  const num = () => (coin(0.5) ? 'sg' : 'pl');
  const pair2 = () => { const a = pick(persons); let b = pick(persons.filter(w => w.id !== a.id)); return [a.id, b.id]; };
  switch (skillId) {
    case 'nid': return gNID(pick(nouns).id, num());
    case 'charts': return gChart(pickOne(CHARTS.filter(c => c.stage <= maxStage)).id);
    case 'agree': { const n = pick(nouns); return gAgree(n.id, num(), adjFor(n, adjs).id); }
    case 'phrase': { const n = pick(nouns); return gPhrase(n.id, num(), adjFor(n, padjs).id, coin(0.25)); }
    case 'fixphrase': { const n = pick(nouns); return gFixPhrase(n.id, num(), adjFor(n, adjs.filter(a => a.id !== 'alter')).id, coin(0.6) ? 'g' : 'n'); }
    case 'vnum': { const v = pick(WORDS.filter(w => w.kind === 'v' && w.num === 'sg')); return gVnum(v.id, num()); }
    case 'sv': { const v = pick(WORDS.filter(w => w.kind === 'v' && w.num === 'sg')); const subjPool = v.id === 'est' ? nouns : persons; return coin(0.3) ? gSV(pair2(), 'pl', v.id) : gSV([pick(subjPool).id], num(), v.id); }
    case 'comp': { if (coin(0.3)) return gComp(pair2(), 'pl', pick(cadjs.filter(x => fits(W.puer, x))).id); const n = pick(nouns); return gComp([n.id], num(), adjFor(n, cadjs).id); }
    case 'role': { const n = pick(nouns); return gRole(n.id, num(), adjFor(n, cadjs).id, pickOne([0, 1, 1]), coin(0.5) ? 'subject' : 'complement'); }
    case 'trans': return gTrans(randomSentenceSpec(pick, nouns, cadjs, persons));
    case 'fixsent': {
      const r = Math.random();
      if (r < 0.2) { const m = pick(MASC_TWINS.map(id => W[id]).filter(w => w.stage <= maxStage)) || W.amicus; const [x, y] = mixedPair(persons); return gFixSent({ k: 'noun', s: [x, y], num: 'pl', c: m.id, order: 1 }, 'noun-g'); }
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
