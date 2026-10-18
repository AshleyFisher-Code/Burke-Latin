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
    check: v => {
      if (!second) return pack([gradeMeaning(v[0], w)]);
      if (w.kind !== 'v') return pack([gradeMeaning(v[0], w), gradeMiddle(v[1], w)]);
      let r0 = gradeMeaning(v[0], w); const r1 = gradeVerbNum(v[1], w);
      // The button already tests singular/plural, so "live" for habitat counts when he tapped singular.
      if (!r0.ok && r1.ok && verbOtherNum(v[0], w)) r0 = { ok: true, note: `Full meaning: ${w.num === 'sg' ? 'he/she' : 'they'} ${w.show}` };
      return pack([r0, r1]);
    },
    correct: vocabAnswer(w), summary: w.lemma,
    answers: [w.show, w.kind === 'v' ? (w.num === 'sg' ? 'singular' : 'plural') : w.kind === 'a' ? '-a -um' : `-${w.gen === 'i' ? 'ī' : 'ae'} ${w.g}`],
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
    case 'trans': return maxStage >= 2 && coin(0.5) ? gTrans2(randomSpec2(pick, poolsFor(maxStage))) : gTrans(randomSentenceSpec(pick, nouns, cadjs, persons));
    case 'fixsent': {
      const r = Math.random();
      if (maxStage >= 2 && r >= 0.6) { const sp = randomSpec2(pick, poolsFor(maxStage), false); return gFix2(sp, pickOne(fix2Errors(sp))); }
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
export const prenorm = s => (s || '').toLowerCase().replace(/\b(and|but|is|are|the|a|not|in|do|does)(\s+\1\b)+/g, '$1').replace(/[’]/g, "'").replace(/\bdoesn'?t\b/g, 'does not').replace(/\bdon'?t\b/g, 'do not')
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
  const f = l => { const x = l.filter(w => w.stage <= maxStage); return x.length ? x : l; };
  return { nouns: f(PL_NOUNS), cadjs: f(COMP_ADJS).filter(a => a.phrase), persons: f(PERSONS), attr: f(ATTR_ADJS) };
}
