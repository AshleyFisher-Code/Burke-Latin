// Exhaustive answer-key check. Run: node tests/test.mjs
import { WORDS, W, fold, letters } from '../js/data.js';
import { AF, NF } from '../js/grade.js';
import * as g from '../js/gen.js';
import { cardFromSpec, buildDaily, buildMock, buildLearn, buildSkill, buildTestRun, buildMastery } from '../js/session.js';
import { blankState, updateWord, completeDay, streakView, readiness, dayFromISO } from '../js/srs.js';

let n = 0; const fails = [];
const ok = (card, vals, expect, label) => { n++; const r = card.check(vals); const got = r.ok.every(Boolean); if (got !== expect) fails.push(`${expect ? 'REJECTED' : 'ACCEPTED'} ${label || card.summary} <- ${JSON.stringify(vals)} ${JSON.stringify(r.hints)}`); return r; };
const assert = (c, msg) => { n++; if (!c) fails.push('ASSERT ' + msg); };

/* ---------- vocab ---------- */
const mids = w => {
  if (w.kind === 'v') return [w.pair, w.pair.toUpperCase(), fold(w.pair)];
  if (w.kind === 'a') return w.rest ? [w.rest, 'altera alterum', `${w.lemma}, ${w.rest}`] : ['-a -um', '-a, -um', 'a um', 'a-um', `${w.lemma} -a -um`];
  return w.gen === 'ae' ? [`-ae ${w.g}`, `-ae, ${w.g}`, `ae ${w.g}`, `${w.lemma} -ae ${w.g}`, `ae-${w.g}`] : [`-ī ${w.g}`, `-i ${w.g}`, `-i, ${w.g}`, `${w.lemma} -ī ${w.g}`, `I - ${w.g}`];
};
for (const w of WORDS) {
  const means = w.mean.concat([w.show, w.show.toUpperCase(), 'the ' + w.mean[0]]);
  if (w.kind === 'v') means.push('he ' + w.mean[0], 'she ' + w.mean[0]);
  const c1 = g.vocabL2E(w), c2 = g.vocabE2L(w);
  for (const m of means) { if (w.kind === 'x') ok(c1, [m], true); else for (const mid of mids(w)) ok(c1, [m, mid], true); }
  ok(c1, w.kind === 'x' ? [w.correct || ''] : ['zzz', mids(w)[0]], false, 'neg ' + w.lemma);
  if (w.id === 'etiam' || w.id === 'quoque') continue;
  const lats = w.forms && w.kind === 'x' ? ['quī/quae', 'qui quae', 'quae, qui'] : [w.lemma, w.lemma.toUpperCase(), fold(w.lemma) + ' '];
  for (const L of lats) { if (w.kind === 'x') ok(c2, [L], true); else for (const mid of mids(w)) ok(c2, [L, mid], true); }
}
for (const [a, b] of [['etiam', 'quoque'], ['quoque', 'etiam'], ['ETIAM', 'quoque.']]) ok(g.vocabAlso(), [a, b], true);
for (const [a, b] of [['etiam', 'etiam'], ['iam', 'quoque']]) ok(g.vocabAlso(), [a, b], false);
const neg = [[g.vocabL2E(W.agricola), ['farmer', '-ae f']], [g.vocabL2E(W.malus), ['mad', '-a -um']], [g.vocabL2E(W.legit), ['read', 'legunt']], [g.vocabL2E(W.femina), ['women', '-ae f']], [g.vocabL2E(W.cibus), ['food', '-a -um']], [g.vocabL2E(W.latus), ['happy', '-a -um']], [g.vocabE2L(W.magister), ['magistra', '-ī m']]];
neg.forEach(([c, v]) => ok(c, v, false, 'NEG ' + c.summary));

/* ---------- noun ID ---------- */
for (const w of g.PL_NOUNS) for (const num of ['sg', 'pl']) {
  const c = g.gNID(w.id, num);
  const Nn = num === 'sg' ? ['singular', 'sg', 'singler', 'Singular'] : ['plural', 'pl', 'plurel', 'Plural'];
  const Gg = w.g === 'm' ? ['masculine', 'masc', 'm', 'Masc.'] : ['feminine', 'fem', 'f', 'Fem.'];
  const Dd = w.gen === 'ae' ? ['1', '1st', 'first', '1st declension'] : ['2', '2nd', 'second', '2nd declension'];
  for (let i = 0; i < 4; i++) ok(c, [Nn[i], Gg[i], Dd[i]], true);
  ok(c, [Nn[0], w.g === 'm' ? 'feminine' : 'masculine', Dd[0]], false);
  ok(c, [num === 'sg' ? 'plural' : 'singular', Gg[0], Dd[0]], false);
}
/* ---------- charts ---------- */
for (const ch of g.CHARTS) { const c = g.gChart(ch.id); ok(c, [ch.sg, ch.pl], true); ok(c, ['-' + ch.sg, '-' + fold(ch.pl)], true); ok(c, [ch.pl, ch.sg], false); }
/* ---------- agreement ---------- */
for (const nw of g.PL_NOUNS) for (const num of ['sg', 'pl']) for (const a of g.ADJS) {
  const c = g.gAgree(nw.id, num, a.id); const want = a.forms[nw.g][num];
  ok(c, [want], true); ok(c, [fold(want)], true);
  for (const gg of ['m', 'f']) for (const nn of ['sg', 'pl']) { const f = a.forms[gg][nn]; if (letters(f) !== letters(want)) ok(c, [f], false); }
}
/* ---------- phrases ---------- */
let phraseCount = 0;
for (const nw of g.PL_NOUNS.filter(w => w.id !== 'cibus')) for (const num of ['sg', 'pl']) for (const a of g.PHRASE_ADJS) for (const af of [false, true]) {
  const c = g.gPhrase(nw.id, num, a.id, af); phraseCount++;
  const nm = num === 'sg' ? nw.mean : nw.enPl;
  assert(nm.length > 0, 'no english for ' + nw.id + num);
  for (const am of a.mean) for (const x of nm) { ok(c, [`${am} ${x}`], true); ok(c, [`the ${am} ${x}`], true); }
  const other = num === 'sg' ? nw.enPl : nw.mean;
  if (!(num === 'sg' && nw.id === 'villa')) ok(c, [`${a.mean[0]} ${other[0]}`], false, 'phrase number ' + c.summary);
  ok(c, [c.correct], true, 'phrase correct ' + c.summary);
}
/* ---------- fix phrase ---------- */
for (const nw of g.PL_NOUNS) for (const num of ['sg', 'pl']) for (const a of g.ADJS.filter(a => a.id !== 'alter')) for (const k of ['g', 'n']) {
  const c = g.gFixPhrase(nw.id, num, a.id, k);
  ok(c, [c.correct], true); ok(c, [c.correct.split(' ').reverse().join(' ')], true); ok(c, [fold(c.correct)], true);
  const bad = c.prompt.latin.replace(/[“”]/g, ''); ok(c, [bad], false);
  assert(letters(bad) !== letters(c.correct), 'fixphrase identical ' + bad);
}
/* ---------- verb number ---------- */
for (const v of WORDS.filter(w => w.kind === 'v' && w.num === 'sg')) for (const num of ['sg', 'pl']) {
  const c = g.gVnum(v.id, num); const en = g.verbEnglish(v, num);
  for (const e of en) { ok(c, [num === 'sg' ? 'singular' : 'plural', e], true); ok(c, [num === 'sg' ? 'sg' : 'pl', (num === 'sg' ? 'he ' : 'they ') + e], true); }
  ok(c, [num === 'sg' ? 'plural' : 'singular', en[0]], false);
  const other = g.verbEnglish(v, num === 'sg' ? 'pl' : 'sg')[0]; if (other !== en[0]) ok(c, [num === 'sg' ? 'singular' : 'plural', other], false, 'vnum wrong-number english ' + c.summary);
}
/* ---------- subject-verb ---------- */
const verbs = WORDS.filter(w => w.kind === 'v' && w.num === 'sg');
for (const nw of g.PL_NOUNS) for (const num of ['sg', 'pl']) for (const v of verbs) {
  const c = g.gSV([nw.id], num, v.id); const want = num === 'sg' ? v.lemma : v.pair;
  ok(c, [want], true); ok(c, [num === 'sg' ? v.pair : v.lemma], false);
}
for (const a of g.PERSONS) for (const b of g.PERSONS) if (a !== b) for (const v of verbs) { const c = g.gSV([a.id, b.id], 'pl', v.id); ok(c, [v.pair], true); ok(c, [v.lemma], false); }
/* ---------- subject-complement ---------- */
for (const nw of g.PL_NOUNS) for (const num of ['sg', 'pl']) for (const a of g.PHRASE_ADJS) {
  const c = g.gComp([nw.id], num, a.id); const want = a.forms[nw.g][num]; ok(c, [want], true);
  for (const gg of ['m', 'f']) for (const nn of ['sg', 'pl']) { const f = a.forms[gg][nn]; if (letters(f) !== letters(want)) ok(c, [f], false); }
}
for (const x of g.PERSONS) for (const y of g.PERSONS) if (x !== y) for (const a of g.PHRASE_ADJS) {
  const c = g.gComp([x.id, y.id], 'pl', a.id); const gg = (x.g === 'm' || y.g === 'm') ? 'm' : 'f';
  ok(c, [a.forms[gg].pl], true); ok(c, [a.forms[gg === 'm' ? 'f' : 'm'].pl], false); ok(c, [a.forms[gg].sg], false);
}
/* ---------- role ---------- */
for (const nw of g.PL_NOUNS) for (const num of ['sg', 'pl']) for (const a of g.PHRASE_ADJS) for (const o of [0, 1, 2]) for (const ask of ['subject', 'complement']) {
  const c = g.gRole(nw.id, num, a.id, o, ask); const S = num === 'sg' ? nw.lemma : nw.pl, C = a.forms[nw.g][num];
  if (letters(S) === letters(C)) continue;
  ok(c, [ask === 'subject' ? S : C], true); ok(c, [ask === 'subject' ? C : S], false);
}
/* ---------- sentences: translate + fix ---------- */
const specs = [];
for (const nw of g.PL_NOUNS) for (const num of ['sg', 'pl']) for (const a of g.PHRASE_ADJS) for (const order of [0, 1]) for (const negq of [false, true]) specs.push({ k: 'adj', s: [nw.id], num, a: a.id, order, neg: negq });
for (const x of g.PERSONS) for (const y of g.PERSONS) if (x !== y) for (const a of g.PHRASE_ADJS) specs.push({ k: 'adj', s: [x.id, y.id], num: 'pl', a: a.id, order: 1 });
for (const sw of g.PERSONS) for (const num of ['sg', 'pl']) for (const c of g.PERSONS) if (c.g === sw.g && c.id !== sw.id) for (const negq of [false, true]) specs.push({ k: 'noun', s: [sw.id], num, c: c.id, order: 1, neg: negq });
for (const sw of g.PERSONS) for (const num of ['sg', 'pl']) for (const v of g.ACTION_VERBS) specs.push({ k: 'act', s: [sw.id], num, v: v.id });
for (const x of g.PERSONS) for (const y of g.PERSONS) if (x !== y) for (const v of g.ACTION_VERBS) specs.push({ k: 'act', s: [x.id, y.id], num: 'pl', v: v.id });
for (const x of g.PERSONS) for (const y of g.PERSONS) if (x.g !== y.g) for (const m of g.MASC_TWINS) specs.push({ k: 'noun', s: [x.id, y.id], num: 'pl', c: m, order: 1 });
let sentCount = 0;
for (const sp of specs) {
  const st = g.sentence(sp); sentCount++;
  // independent grammar check of the Latin
  const lw = st.latWords.map(letters);
  const vIdx = lw.findIndex(t => ['est', 'sunt'].includes(t) || WORDS.some(w => w.kind === 'v' && (letters(w.lemma) === t || letters(w.pair) === t)));
  const vNum = ['est'].includes(lw[vIdx]) ? 'sg' : lw[vIdx] === 'sunt' ? 'pl' : (WORDS.find(w => w.kind === 'v' && w.num === 'sg' && letters(w.lemma) === lw[vIdx]) ? 'sg' : 'pl');
  assert(vNum === st.s.num, 'verb number mismatch: ' + st.latin);
  if (sp.k === 'adj') { const cf = AF[letters(W[sp.a].forms[st.s.g][st.s.num])]; const adjTok = lw.find(t => AF[t] && AF[t].id === sp.a); assert(adjTok === letters(W[sp.a].forms[st.s.g][st.s.num]), 'adj agreement: ' + st.latin); }
  const c = g.gTrans(sp);
  ok(c, [st.correct], true, 'trans correct ' + st.latin);
  ok(c, [st.correct.toLowerCase().replace(/\.$/, '')], true, 'trans lower ' + st.latin);
  for (const acc of st.accepted.slice(0, 3)) ok(c, [acc], true, 'trans acc ' + st.latin);
  if (sp.k !== 'act') ok(c, [st.correct.replace(/ (is|are) /, ' ')], false, 'trans no-LV ' + st.latin);
  if (sp.s.length === 1 && W[sp.s[0]].pl) { const fl = g.sentence({ ...sp, num: sp.num === 'sg' ? 'pl' : 'sg' }); if (!fl.accepted.some(x => st.accepted.includes(x))) ok(c, [fl.correct], false, 'trans flipped ' + st.latin); }
  // fix-the-error versions
  const errs = sp.k === 'adj' ? ['verb', 'adj-g', 'adj-n'] : sp.k === 'noun' && sp.s.length === 2 ? ['noun-g', 'verb'] : sp.k === 'noun' ? ['verb'] : [];
  for (const e of errs) {
    const f = g.gFixSent(sp, e); const bad = f.prompt.latin;
    ok(f, [f.correct], true, 'fix correct ' + f.summary); ok(f, [bad], false, 'fix bad ' + f.summary);
    const diff = g.sentence(sp).latWords.map(letters).filter((t, i) => t !== f.prompt.latin.replace(/\.$/, '').split(' ').map(letters)[i]).length;
    assert(diff === 1, `fix should differ by one word: ${bad} vs ${f.correct}`);
  }
}
/* ---------- sessions build and rebuild ---------- */
const st = blankState(); const today = dayFromISO('2026-10-10');
for (let i = 0; i < 30; i++) {
  for (const b of [buildDaily(st, {}, today, null), buildMastery(st, today, 2), buildMock(st, {}, 2), buildLearn(2), buildLearn(1), buildTestRun(st, {}, 2), buildSkill(st, {}, g.SKILLS[i % g.SKILLS.length].id)])
    for (const sp of b.specs) { const c = cardFromSpec(JSON.parse(JSON.stringify(sp))); assert(c && c.fields.length && typeof c.check === 'function', 'bad card from ' + JSON.stringify(sp)); assert(c.correct, 'no correct for ' + c.summary); }
}
const mock = buildMock(st, {}, 2); const pts = mock.specs.reduce((a, s) => a + s.pts, 0); assert(pts === 30, 'mock points = ' + pts);
/* ---------- streak ---------- */
const s2 = blankState(); let d = 100;
for (let i = 0; i < 7; i++) completeDay(s2, d++);
assert(s2.streak.count === 7 && s2.streak.rest === 1, 'streak 7 earns rest ' + JSON.stringify(s2.streak));
d++; // missed one day
assert(streakView(s2, d).count === 7 && streakView(s2, d).atRisk, 'rest day protects');
completeDay(s2, d++); assert(s2.streak.count === 8 && s2.streak.rest === 0, 'used rest ' + JSON.stringify(s2.streak));
d += 2; assert(streakView(s2, d).count === 0, 'broken after 2 missed with no rest');
completeDay(s2, d); assert(s2.streak.count === 1, 'restart');
const s3 = blankState(); for (let i = 0; i < 5; i++) completeDay(s3, 200 + i); assert(s3.streak.ranks.length === 1 && s3.streak.ranks[0].days === 5, 'rank at 5');
/* ---------- readiness ---------- */
const s4 = blankState(); const qd = dayFromISO('2026-10-13'); const quiz = { stage: 2, day: qd, daysLeft: 3 };
assert(readiness(s4, quiz, qd - 3).color === 'red', 'red when nothing done');
WORDS.forEach(w => updateWord(s4, w.id, true, qd - 2));
g.SKILLS.forEach(sk => { s4.skills[sk.id] = { hist: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }; });
s4.mocks.push({ stage: 2, day: qd - 1, at: Date.now(), score: 28 });
assert(readiness(s4, quiz, qd - 1).color === 'green', 'green when all done: ' + JSON.stringify(readiness(s4, quiz, qd - 1).reasons));
s4.mocks[0].score = 25; assert(readiness(s4, quiz, qd - 1).color === 'yellow', 'yellow at 25');
assert(readiness(s4, { ...quiz, daysLeft: 5 }, qd - 5) === null, 'hidden before 4 days');

console.log(`checks: ${n}  failures: ${fails.length}  (phrases ${phraseCount}, sentences ${sentCount})`);
if (fails.length) { console.log(fails.slice(0, 80).join('\n')); process.exit(1); }
/* ---------- days off ---------- */
import { federalHolidays, dayOff } from '../js/srs.js';
const fh = federalHolidays(2026);
const expect26 = { '2026-01-01': 1, '2026-01-19': 1, '2026-02-16': 1, '2026-05-25': 1, '2026-06-19': 1, '2026-07-04': 1, '2026-09-07': 1, '2026-10-12': 1, '2026-11-11': 1, '2026-11-26': 1, '2026-12-25': 1 };
const fh27 = federalHolidays(2027);
const expect27 = ['2027-01-01', '2027-01-18', '2027-02-15', '2027-05-31', '2027-06-19', '2027-07-04', '2027-09-06', '2027-10-11', '2027-11-11', '2027-11-25', '2027-12-25'];
let hf = 0;
for (const k of Object.keys(expect26)) if (!fh[k]) { hf++; console.log('missing 2026 holiday', k, fh); }
for (const k of expect27) if (!fh27[k]) { hf++; console.log('missing 2027 holiday', k); }
if (!dayOff(dayFromISO('2027-03-05'), {})) { hf++; console.log('March 5 not off'); }
if (dayOff(dayFromISO('2027-03-06'), {})) { hf++; console.log('March 6 wrongly off'); }
// streak across Thanksgiving: practice Wed, skip Thu (holiday), practice Fri -> continues with no rest day used
const s5 = blankState(); const wed = dayFromISO('2026-11-25');
completeDay(s5, wed - 1, {}); completeDay(s5, wed, {});
if (!streakView(s5, wed + 1, {}).off) { hf++; console.log('Thanksgiving not shown as off'); }
completeDay(s5, wed + 2, {});
if (s5.streak.count !== 3 || s5.streak.rest !== 0) { hf++; console.log('holiday broke streak', s5.streak); }
// skipping a normal day with no rest breaks it
const s6 = blankState(); completeDay(s6, wed - 3, {}); completeDay(s6, wed - 1, {}); if (s6.streak.count !== 1) { hf++; console.log('normal skip should reset', s6.streak); }
console.log(`days-off checks: ${hf ? hf + ' FAILED' : 'all passed'}`); if (hf) process.exit(1);
/* ---------- unit-only vocab ---------- */
import { buildUnit } from '../js/session.js';
let uf = 0;
for (let i = 0; i < 50; i++) {
  const m = buildMock(blankState(), {}, 2);
  const v = m.specs.filter(s => s.sec === 0);
  if (v.length !== 10 || v.some(s => W[s.id].stage !== 2)) { uf++; console.log('mock vocab not unit-only', v.map(s => s.id)); break; }
  const pts = m.specs.reduce((a, s) => a + s.pts, 0); if (pts !== 30) { uf++; console.log('mock pts', pts); break; }
}
const u = buildUnit(2); if (u.specs.some(s => s.id && W[s.id].stage !== 2) || u.counts) { uf++; console.log('unit session wrong'); }
const s7 = blankState(); const qd7 = dayFromISO('2026-10-16'), q7 = { stage: 2, day: qd7, daysLeft: 2 };
WORDS.filter(w => w.stage === 2).forEach(w => updateWord(s7, w.id, true, qd7 - 2));
g.SKILLS.forEach(sk => { s7.skills[sk.id] = { hist: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }; });
s7.mocks.push({ stage: 2, day: qd7 - 1, at: Date.now(), score: 28 });
const r7 = readiness(s7, q7, qd7 - 1); if (r7.color !== 'green' || r7.total !== 30) { uf++; console.log('unit-only readiness', r7); }
console.log(`unit checks: ${uf ? uf + ' FAILED' : 'all passed'}`); if (uf) process.exit(1);
