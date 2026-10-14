// Exhaustive answer-key check. Run: node tests/test.mjs
import { WORDS, W, fold, letters } from '../js/data.js';
import { normEn } from '../js/grade.js';
import { AF, NF } from '../js/grade.js';
import * as g from '../js/gen.js';
import { cardFromSpec, buildDaily, buildMock, buildLearn, buildSkill, buildTestRun, buildMastery } from '../js/session.js';
import { blankState, updateWord, completeDay, streakView, readiness, dayFromISO } from '../js/srs.js';

let n = 0; const fails = [];
const ok = (card, vals, expect, label) => { n++; const r = card.check(vals); const got = r.ok.every(Boolean); if (got !== expect) fails.push(`${expect ? 'REJECTED' : 'ACCEPTED'} ${label || card.summary} <- ${JSON.stringify(vals)} ${JSON.stringify(r.hints)}`); return r; };
const assert = (c, msg) => { n++; if (!c) fails.push('ASSERT ' + msg); };

/* ---------- vocab ---------- */
const mids = w => {
  if (w.kind === 'v') return w.num === 'sg' ? ['singular', 'Singular'] : ['plural', 'Plural'];
  if (w.kind === 'a') return w.rest ? [w.rest, 'altera alterum', `${w.lemma}, ${w.rest}`] : ['-a -um', '-a, -um', 'a um', 'a-um', `${w.lemma} -a -um`];
  return w.gen === 'ae' ? [`-ae ${w.g}`, `-ae, ${w.g}`, `ae ${w.g}`, `${w.lemma} -ae ${w.g}`, `ae-${w.g}`] : [`-ī ${w.g}`, `-i ${w.g}`, `-i, ${w.g}`, `${w.lemma} -ī ${w.g}`, `I - ${w.g}`];
};
for (const w of WORDS) {
  const means = w.mean.concat([w.show, w.show.toUpperCase(), 'the ' + w.mean[0]]);
  if (w.kind === 'v') means.push('he ' + w.mean[0], 'she ' + w.mean[0]);
  const c1 = g.vocabL2E(w);
  for (const m of means) { if (w.kind === 'x') ok(c1, [m], true); else for (const mid of mids(w)) ok(c1, [m, mid], true); }
  ok(c1, w.kind === 'x' ? [w.correct || ''] : ['zzz', mids(w)[0]], false, 'neg ' + w.lemma);
}
// (English→Latin cards were retired Oct 2026: Burke only reads Latin and answers in English.)
const neg = [[g.vocabL2E(W.agricola), ['farmer', '-ae f']], [g.vocabL2E(W.malus), ['mad', '-a -um']], [g.vocabL2E(W.legit), ['read', 'singular']], [g.vocabL2E(W.legit), ['reads', 'plural']], [g.vocabL2E(W.femina), ['girl', '-ae f']], [g.vocabL2E(W.cibus), ['food', '-a -um']], [g.vocabL2E(W.latus), ['happy', '-a -um']]];
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

/* ---------- tap buttons: the right answer is always there and accepted; every other button is wrong ---------- */
const allCards = [];
for (const ch of g.CHARTS) allCards.push(g.gChart(ch.id));
for (const nw of g.PL_NOUNS) for (const num of ['sg', 'pl']) {
  allCards.push(g.gNID(nw.id, num));
  for (const a of g.ADJS) { allCards.push(g.gAgree(nw.id, num, a.id)); if (a.id !== 'alter') for (const k of ['g', 'n']) allCards.push(g.gFixPhrase(nw.id, num, a.id, k)); }
  for (const a of g.PHRASE_ADJS) { allCards.push(g.gComp([nw.id], num, a.id)); for (const o of [0, 1, 2]) for (const ask of ['subject', 'complement']) { const c = g.gRole(nw.id, num, a.id, o, ask); if (new Set(c.fields[0].choices.map(letters)).size === 3) allCards.push(c); } }
  for (const v of verbs) allCards.push(g.gSV([nw.id], num, v.id));
}
for (const x of g.PERSONS) for (const y of g.PERSONS) if (x !== y) { for (const a of g.PHRASE_ADJS) allCards.push(g.gComp([x.id, y.id], 'pl', a.id)); for (const v of verbs) allCards.push(g.gSV([x.id, y.id], 'pl', v.id)); }
for (const sp of specs) { const errs = sp.k === 'adj' ? ['verb', 'adj-g', 'adj-n'] : sp.k === 'noun' && sp.s.length === 2 ? ['noun-g', 'verb'] : sp.k === 'noun' ? ['verb'] : []; for (const e of errs) allCards.push(g.gFixSent(sp, e)); }
let choiceCards = 0;
for (const c of allCards) {
  const cf = c.fields.map((f, i) => [f, i]).filter(([f]) => f.choices);
  assert(cf.length === c.fields.length, 'still a typed Latin field: ' + c.summary);
  for (const [f] of cf) assert(f.choices.length >= 2, 'fewer than 2 buttons: ' + c.summary);
  // find the combination of buttons that is right: exactly one per field
  const combos = cf.reduce((acc, [f]) => acc.flatMap(a => f.choices.map(x => a.concat([x]))), [[]]);
  const right = combos.filter(v => c.check(v).ok.every(Boolean));
  n++; if (right.length !== 1) fails.push(`${right.length} right answers among buttons: ${c.summary} ${JSON.stringify(c.fields.map(f => f.choices))}`);
  // same card rebuilt = same button order (cards are rebuilt from saved progress)
  const again = cardFromSpec(JSON.parse(JSON.stringify({ t: 'g', type: c.type, params: c.params, skill: c.skill })));
  assert(JSON.stringify(again.fields) === JSON.stringify(c.fields), 'button order changed on rebuild: ' + c.summary);
  choiceCards++;
}
/* tap-the-meaning cards */
for (const w of WORDS) for (let i = 0; i < 200; i++) {
  const opts = g.pickOpts(w), c = g.vocabPick(w, opts), ch = c.fields[0].choices;
  assert(ch.length === 4 && new Set(ch).size === 4, 'pick needs 4 different meanings: ' + w.lemma + ' ' + ch);
  const right = ch.filter(x => c.check([x]).ok[0]); n++; if (right.length !== 1 || right[0] !== w.show) fails.push('pick wrong key ' + w.lemma + ' ' + ch);
  for (const id of opts) assert(!W[id].mean.some(m => w.mean.includes(m)), `pick distractor means the same: ${w.lemma} / ${W[id].lemma}`);
}
/* ---------- generous English spelling ---------- */
const L2 = id => g.vocabL2E(W[id]), sec = w => w.kind === 'x' ? [] : [mids(w)[0]];
const spellOK = [['equus', 'morse'], ['equus', 'hors'], ['femina', 'women'], ['femina', 'womn'], ['laetus', 'hapy'], ['defessus', 'tierd'], ['puella', 'gril'], ['puer', 'boi'], ['latus', 'wid'], ['cibus', 'fod'], ['aut', 'ore'], ['villa', 'sumer house'], ['discipulus', 'studint'], ['magistra', 'teecher'], ['agricola', 'farmar'], ['statim', 'imediately'], ['parvus', 'smal'], ['legit', 'reeds'], ['scribit', 'rites'], ['magnus', 'grate'], ['longus', 'lung'], ['via', 'rode'], ['iratus', 'angery'], ['vicinus', 'nieboring'], ['familia', 'famly'], ['hortus', 'gardin'], ['nauta', 'saler'], ['poeta', 'poit'], ['subito', 'sudenly'], ['quod', 'becuz'], ['molestus', 'anoying'], ['vir', 'mun'], ['sedet', 'sitz']];
for (const [id, a] of spellOK) ok(L2(id), [a, ...sec(W[id])], true, 'spelling ' + id);
const spellBad = [['malus', 'man'], ['puella', 'girls'], ['puer', 'boys'], ['legit', 'read'], ['latus', 'happy'], ['laetus', 'wide'], ['vir', 'woman'], ['femina', 'man'], ['sunt', 'is'], ['est', 'are'], ['non', 'now'], ['iam', 'not'], ['et', 'or'], ['aut', 'and']];
for (const [id, a] of spellBad) ok(L2(id), [a, ...sec(W[id])], false, 'spelling-neg ' + id);
// No word's meaning is ever accepted for a different word (unless they really share it).
for (const w of WORDS) for (const o of WORDS) if (o !== w) for (const m of o.mean) {
  if (w.mean.some(x => normEn(x) === normEn(m))) continue;
  const r = g.vocabL2E(w).check([m, ...sec(w)]); n++; if (r.ok[0]) fails.push(`ACCEPTED ${o.lemma}'s meaning "${m}" for ${w.lemma}`);
}
// Misspelled sentences still pass; the wrong number still fails.
let fuzzS = 0;
for (const sp of specs) {
  const st = g.sentence(sp), c = g.gTrans(sp);
  const mis = st.correct.replace(/\b(girl|teacher|student|happy|tired|farmer|friend|sailor|reads|writes|angry|garden)\b/i, m => m.length > 4 ? m.slice(0, 2) + m[3] + m[2] + m.slice(4) : m + m.slice(-1));
  if (mis !== st.correct) { ok(c, [mis], true, 'trans misspelled ' + st.latin + ' <- ' + mis); fuzzS++; }
  if (sp.s.length === 1 && W[sp.s[0]].pl) { const fl = g.sentence({ ...sp, num: sp.num === 'sg' ? 'pl' : 'sg' }); if (!fl.accepted.some(x => st.accepted.includes(x))) ok(c, [fl.correct], false, 'trans flipped ' + st.latin); }
}
for (const nw of g.PL_NOUNS.filter(w => w.id !== 'cibus')) for (const num of ['sg', 'pl']) for (const a of g.PHRASE_ADJS) {
  const c = g.gPhrase(nw.id, num, a.id); const other = num === 'sg' ? nw.enPl : nw.mean;
  if (!(num === 'sg' && nw.id === 'villa')) for (const x of other) ok(c, [`${a.mean[0]} ${x}`], false, 'phrase number(all) ' + c.summary);
}
/* ---------- sessions never ask English → Latin ---------- */
for (let i = 0; i < 40; i++) for (const b of [buildDaily(st, {}, today, null), buildMastery(st, today, 2), buildMock(st, {}, 2), buildLearn(2), buildTestRun(st, {}, 2)])
  for (const sp of b.specs) { assert(sp.t !== 'e2l' && sp.t !== 'also', 'English→Latin card in ' + b.mode); const c = cardFromSpec(sp); assert(c.type !== 'e2l' && c.type !== 'also', 'e2l card built'); }
import { followUp } from '../js/session.js';
for (const w of WORDS) { const f = followUp({ t: 'l2e', id: w.id }, st, {}); assert(f.t === 'pick', 'follow-up should be tap-the-meaning'); const f2 = followUp({ t: 'e2l', id: w.id }, st, {}); assert(f2.t === 'pick', 'old e2l follow-up'); }
assert(cardFromSpec({ t: 'e2l', id: 'puella' }).type === 'l2e', 'old saved English→Latin cards become Latin→English');

/* ---------- alter middle stuff + revealed answers are always accepted ---------- */
for (const a of ['-a -um', 'a um', '-a, -um', 'altera alterum', 'altera, alterum', 'alter, altera, alterum', '-era -erum', 'altra altrum', 'alterra alterrum']) ok(g.vocabL2E(W.alter), ['another', a], true, 'alter middle ' + a);
for (const a of ['-ī m', '-ae f', 'i m']) ok(g.vocabL2E(W.alter), ['another', a], false, 'alter middle neg ' + a);
for (const w of WORDS) { const c = g.vocabL2E(w); ok(c, c.answers.slice(0, c.fields.length), true, 'revealed answer ' + w.lemma); }

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
const u = buildUnit(2); if (u.specs.some(s => s.id && W[s.id].stage !== 2) || !u.counts || u.specs.length !== WORDS.filter(w => w.stage === 2).length) { uf++; console.log('unit session wrong'); }
const s7 = blankState(); const qd7 = dayFromISO('2026-10-16'), q7 = { stage: 2, day: qd7, daysLeft: 2 };
WORDS.filter(w => w.stage === 2).forEach(w => updateWord(s7, w.id, true, qd7 - 2));
g.SKILLS.forEach(sk => { s7.skills[sk.id] = { hist: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }; });
s7.mocks.push({ stage: 2, day: qd7 - 1, at: Date.now(), score: 28 });
const r7 = readiness(s7, q7, qd7 - 1); if (r7.color !== 'green' || r7.total !== 30) { uf++; console.log('unit-only readiness', r7); }
console.log(`unit checks: ${uf ? uf + ' FAILED' : 'all passed'}`); if (uf) process.exit(1);

/* ---------- quiz types: vocab-only / grammar-only ---------- */
import { buildQuizPrep } from '../js/session.js';
import { quizCovers } from '../js/srs.js';
let qf = 0; const bad = m => { qf++; console.log(m); };
const qv = dayFromISO('2026-10-16'), vq = { stage: 2, day: qv, daysLeft: 2, covers: 'vocab' }, gq = { stage: 2, day: qv + 7, daysLeft: 2, covers: 'grammar' };
for (let i = 0; i < 50; i++) {
  const st0 = blankState();
  const p = buildQuizPrep(st0, {}, qv - 2, vq);
  if (p.specs.some(x => x.t === 'g')) { bad('vocab prep has grammar'); break; }
  if (p.specs.filter(x => W[x.id].stage === 2).length < 20 || !p.counts) { bad('vocab prep too few unit words'); break; }
  const d = buildDaily(st0, {}, qv - 2, vq); if (d.specs.some(x => x.t === 'g')) { bad('daily during vocab week has grammar'); break; }
  const gp = buildQuizPrep(st0, {}, qv + 5, gq); if (gp.specs.filter(x => x.t === 'g').length < 14) { bad('grammar prep light on grammar'); break; }
  const mv = buildMock(st0, {}, 2, 'vocab'); if (mv.specs.some(x => x.t === 'g' || W[x.id].stage !== 2) || mv.kind !== 'vocab' || mv.specs.length !== 15) { bad('vocab mock wrong'); break; }
  const mg = buildMock(st0, {}, 2, 'grammar'); if (mg.specs.some(x => x.t !== 'g') || mg.specs.reduce((a, x) => a + x.pts, 0) !== 20) { bad('grammar mock wrong'); break; }
  const tv = buildTestRun(st0, {}, 2, 'vocab'); if (tv.specs.some(x => x.t === 'g' || W[x.id].stage !== 2)) { bad('vocab test run wrong'); break; }
  const tg = buildTestRun(st0, {}, 2, 'grammar'); if (tg.specs.some(x => x.t !== 'g')) { bad('grammar test run wrong'); break; }
  for (const b of [p, gp, mv, mg, tv, tg]) for (const sp of b.specs) { const c = cardFromSpec(JSON.parse(JSON.stringify(sp))); if (!c || !c.check) bad('bad card'); }
}
// readiness: vocab quiz ignores grammar entirely
const sv = blankState();
WORDS.filter(w => w.stage === 2).forEach(w => updateWord(sv, w.id, true, qv - 2));
let rv = readiness(sv, vq, qv - 1);
if (rv.color === 'green' || rv.reasons.some(r => /Grammar/.test(r))) bad('vocab readiness mentions grammar / green without mock ' + JSON.stringify(rv.reasons));
sv.mocks.push({ stage: 2, day: qv - 1, at: Date.now(), score: 14, of: 15, kind: 'vocab' });
rv = readiness(sv, vq, qv - 1); if (rv.color !== 'green') bad('vocab readiness should be green ' + JSON.stringify(rv.reasons));
sv.mocks = [{ stage: 2, day: qv - 1, at: Date.now(), score: 28, of: 30, kind: 'both' }];
rv = readiness(sv, vq, qv - 1); if (rv.color === 'green') bad('full mock should not count as vocab mock');
// grammar quiz ignores vocab confirmation
const sg = blankState(); g.SKILLS.forEach(sk => { sg.skills[sk.id] = { hist: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1] }; });
sg.mocks.push({ stage: 2, day: qv + 6, at: Date.now(), score: 19, of: 20, kind: 'grammar' });
const rg = readiness(sg, gq, qv + 6); if (rg.color !== 'green' || rg.reasons.some(r => /words/.test(r))) bad('grammar readiness ' + JSON.stringify(rg.reasons));
if (quizCovers({ stage: 2, date: 'x' }) !== 'both') bad('old quizzes default to both');
// finishing the unit review counts for the streak
const su = blankState(); completeDay(su, 300); if (su.streak.count !== 1) bad('streak');
console.log(`quiz-type checks: ${qf ? qf + ' FAILED' : 'all passed'}`); if (qf) process.exit(1);
