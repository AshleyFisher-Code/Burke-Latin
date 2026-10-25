import { setUnits, isOn, inUnit } from '../js/data.js';
import { quizWords } from '../js/srs.js';
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
  if (w.kind === 'vb') return [w.inf];
  if (w.kind === 'p') return [w.takes];
  if (w.decl === 3) return [`${w.genForm} ${w.g}`];
  if (w.mid) return [w.midShow, 'orum m/f', '-ōrum, m/f'];
  if (w.restOk) return [w.rest, w.rest.replace(/,/g, '')];
  if (w.kind === 'v') return w.num === 'sg' ? ['singular', 'Singular'] : ['plural', 'Plural'];
  if (w.kind === 'a') return w.rest ? [w.rest, 'altera alterum', `${w.lemma}, ${w.rest}`] : ['-a -um', '-a, -um', 'a um', 'a-um', `${w.lemma} -a -um`];
  return w.gen === 'ae' ? [`-ae ${w.g}`, `-ae, ${w.g}`, `ae ${w.g}`, `${w.lemma} -ae ${w.g}`, `ae-${w.g}`] : [`-ī ${w.g}`, `-i ${w.g}`, `-i, ${w.g}`, `${w.lemma} -ī ${w.g}`, `I - ${w.g}`];
};
for (const w of WORDS) {
  const means = w.mean.concat([w.show, w.show.toUpperCase(), 'the ' + w.mean[0]]);
  if (w.kind === 'v') means.push('he ' + w.mean[0], 'she ' + w.mean[0]);
  const c1 = g.vocabL2E(w);
  if (w.kind === 'vb') means.push('to ' + w.mean[0].replace(/^to /, '').toUpperCase(), w.mean[0].replace(/^to /, ''));
  for (const m of means) { if (c1.fields.length === 1) ok(c1, [m], true); else for (const mid of mids(w)) ok(c1, [m, mid], true); }
  ok(c1, c1.fields.length === 1 ? [w.correct || ''] : ['zzz', mids(w)[0]], false, 'neg ' + w.lemma);
  // every wrong tap choice in the second box is marked wrong
  if (c1.fields[1] && c1.fields[1].choices) for (const ch of c1.fields[1].choices) if (ch !== mids(w)[0]) ok(c1, [w.mean[0], ch], false, 'wrong tap ' + w.lemma + ' ' + ch);
}
// (English→Latin cards were retired Oct 2026: Burke only reads Latin and answers in English.)
const neg = [[g.vocabL2E(W.agricola), ['farmer', '-ae f']], [g.vocabL2E(W.malus), ['mad', '-a -um']], [g.vocabL2E(W.legit), ['reads', 'plural']], [g.vocabL2E(W.femina), ['girl', '-ae f']], [g.vocabL2E(W.cibus), ['food', '-a -um']], [g.vocabL2E(W.latus), ['happy', '-a -um']]];
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
for (const ch of g.CHARTS.filter(x => !x.cells)) { const c = g.gChart(ch.id); ok(c, [ch.sg, ch.pl], true); ok(c, ['-' + ch.sg, '-' + fold(ch.pl)], true); ok(c, [ch.pl, ch.sg], false); }
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
  const other = g.verbEnglish(v, num === 'sg' ? 'pl' : 'sg')[0]; if (other !== en[0]) { const strict = v.id === 'est'; ok(c, [num === 'sg' ? 'singular' : 'plural', other], !strict, 'vnum bare verb with right button ' + c.summary); ok(c, [num === 'sg' ? 'plural' : 'singular', other], false, 'vnum wrong button ' + c.summary); }
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
const stk3 = blankState(); for (let i = 0; i < 5; i++) completeDay(stk3, 200 + i); assert(stk3.streak.ranks.length === 1 && stk3.streak.ranks[0].days === 5, 'rank at 5');
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
const spellBad = [['malus', 'man'], ['puella', 'girls'], ['puer', 'boys'], ['latus', 'happy'], ['laetus', 'wide'], ['vir', 'woman'], ['femina', 'man'], ['sunt', 'is'], ['est', 'are'], ['non', 'now'], ['iam', 'not'], ['et', 'or'], ['aut', 'and']];
for (const [id, a] of spellBad) ok(L2(id), [a, ...sec(W[id])], false, 'spelling-neg ' + id);
// No word's meaning is ever accepted for a different word (unless they really share it).
for (const w of WORDS) for (const o of WORDS) if (o !== w) for (const m of o.mean) {
  if (w.mean.some(x => normEn(x) === normEn(m))) continue;
  // Same English word, really the same meaning (a noun and its verb, or the Stage 2 form and the Stage 3 dictionary verb)
  if ([['habito', 'habitat'], ['sedeo', 'sedet'], ['ludo', 'fabula'], ['pono', 'area'], ['coquo', 'coquus'], ['dico', 'inquit']].some(([a, b]) => w.id === a && o.id === b)) continue;
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

/* ---------- verbs: bare English counts when the singular/plural button is right ---------- */
for (const v of WORDS.filter(w => w.kind === 'v' && w.id !== 'est' && w.id !== 'sunt')) {
  const c = g.vocabL2E(v), right = v.num === 'sg' ? 'singular' : 'plural', wrong = v.num === 'sg' ? 'plural' : 'singular';
  for (const b of v.wrongNum) { ok(c, [b, right], true, 'bare verb ' + v.lemma + ' ' + b); ok(c, ['they ' + b, right], true, 'bare verb pron ' + v.lemma); ok(c, [b, wrong], false, 'bare verb wrong button ' + v.lemma); }
  ok(c, [v.show, wrong], false, 'right meaning wrong button ' + v.lemma);
}
ok(g.vocabL2E(W.habitat), ['liv', 'singular'], true, 'habitat liv'); ok(g.vocabL2E(W.scribit), ['rite', 'singular'], true, 'scribit rite');
ok(g.vocabL2E(W.habitat), ['sits', 'singular'], false, 'habitat sits'); ok(g.vocabL2E(W.legit), ['write', 'singular'], false, 'legit write');
// sentence translation stays strict on number
ok(g.gTrans({ k: 'act', s: ['puella'], num: 'sg', v: 'habitat' }), ['the girl live'], false, 'sentence keeps -s strict');

/* ---------- two-part sentences (class worksheet style) ---------- */
let two = 0, fix2n = 0;
const VFORM = {}; WORDS.filter(w => w.kind === 'v').forEach(w => { VFORM[letters(w.lemma)] = w.num; VFORM[letters(w.pair)] = w.num === 'sg' ? 'pl' : 'sg'; });
Object.values(g.HELP_VERBS).forEach(v => { VFORM[letters(v.lemma)] = 'sg'; VFORM[letters(v.pair)] = 'pl'; });
const pools2 = g.poolsFor(2), pick2 = g.pickOne;
const seen2 = new Set();
for (let i = 0; i < 6000; i++) {
  const sp = g.randomSpec2(pick2, pools2, true); const key = JSON.stringify(sp); if (seen2.has(key)) continue; seen2.add(key); two++;
  const st = g.sentence2(sp), c = g.gTrans2(sp);
  assert(!/undefined|null/.test(st.latin + st.correct), 'undefined in ' + st.latin + ' / ' + st.correct);
  // independent Latin check: each part's verb and complement agree with its subject
  st.parts.forEach((p, pi) => { if (!p.cl) return; const S = p.S;
    const vt = letters(p.lat[p.idx.v]); assert(VFORM[vt] === S.num, `verb number ${st.latin} part ${pi}`);
    if (p.cl.k === 'adj' || p.cl.k === 'adj2') { const a = AF[letters(p.lat[p.idx.a])]; assert(a && a.id === p.cl.a && W[p.cl.a].forms[S.g][S.num] === p.lat[p.idx.a], `complement agreement ${st.latin}`); }
    if (p.cl.sa) assert(p.lat[1] === W[p.cl.sa].forms[S.g][S.num], `describing adj ${st.latin}`);
    if (p.cl.k === 'noun' && p.cl.ca) { const cn = W[p.cl.c]; assert(p.lat.includes(W[p.cl.ca].forms[cn.g][S.num]), `noun+adj complement ${st.latin}`); }
    if (S.compound) assert(S.num === 'pl', 'compound is plural');
    if (p.cl.place) assert(p.lat.join(' ').includes(p.cl.place === 'villa' ? 'in villā' : 'in agrīs'), 'place phrase');
  });
  assert(st.help.every(Boolean), 'help text');
  ok(c, [st.correct], true, 'two-part key ' + st.latin);
  ok(c, [st.correct.toLowerCase().replace(/[.,]/g, '')], true, 'two-part lower ' + st.latin);
  // every accepted first part with a few accepted second parts
  const j = st.join ? ' ' + st.join + ' ' : ' ';
  for (const a of st.parts[0].acc.slice(0, 4)) for (const b of st.parts[1].acc.slice(0, 4)) ok(c, [a + j + b], true, 'two-part acc ' + st.latin);
  // wrong number in either part is never accepted
  st.flips.forEach((f, fi) => { if (!f) return; const other = st.parts[1 - fi].acc[0];
    for (const fa of f.acc.slice(0, 3)) if (!st.parts[fi].acc.includes(fa)) ok(c, [fi === 0 ? fa + j + other : st.parts[0].acc[0] + j + fa], false, 'two-part flipped ' + st.latin); });
  if (st.join) { ok(c, [st.parts[0].acc[0] + (st.join === 'and' ? ' but ' : ' and ') + st.parts[1].acc[0]], false, 'wrong conjunction ' + st.latin); ok(c, [st.parts[0].acc[0]], false, 'half only ' + st.latin); }
  // dropping "not" is wrong
  if (st.parts.some(p => p.cl && p.cl.neg)) ok(c, [st.correct.replace(/ not\b/g, '').replace(/does (\w+)/, '$1s').replace(/\bdo (\w+)/, '$1')], false, 'dropped not ' + st.latin);
  // misspelled content word still passes
  const mis = st.correct.replace(/\b(girl|teacher|student|happy|tired|farmer|friend|sailor|reads|writes|angry|garden|walk|walks|family|horse|road)\b/i, m => m.length > 4 ? m.slice(0, 2) + m[3] + m[2] + m.slice(4) : m + m.slice(-1));
  if (mis !== st.correct) ok(c, [mis], true, 'two-part misspelled ' + st.latin + ' <- ' + mis);
  // rebuilt from its saved spec
  const rb = cardFromSpec({ t: 'g', type: 'trans2', params: [sp], skill: 'trans' }); assert(rb.correct === c.correct, 'rebuild trans2');
  // fix-the-error versions
  if (sp.q) continue;
  for (const e of g.fix2Errors(sp)) {
    const f = g.gFix2(sp, e), bad = f.prompt.latin; fix2n++;
    ok(f, [f.correct], true, 'fix2 correct ' + bad); ok(f, [bad], false, 'fix2 bad ' + bad);
    assert(f.fields[0].choices.includes(f.correct), 'fix2 choices include answer');
    assert(!f.fields[0].choices.some(x => letters(x) === letters(bad)), 'fix2 choices exclude the prompt');
    assert(new Set(f.fields[0].choices.map(letters)).size === f.fields[0].choices.length, 'fix2 choices distinct');
    for (const ch of f.fields[0].choices) if (ch !== f.correct) ok(f, [ch], false, 'fix2 distractor ' + ch);
    const gw = f.correct.replace(/\.$/, '').split(' ').map(letters), bw = bad.replace(/\.$/, '').split(' ').map(letters);
    assert(gw.length === bw.length && gw.filter((t, k) => t !== bw[k]).length === 1, 'fix2 differs by one word: ' + bad);
    // the error really is an error: the changed word disagrees with its clause's subject
    const p = st.parts[e.p], k = gw.findIndex((t, k2) => t !== bw[k2]), tok = bw[k];
    if (VFORM[tok]) assert(VFORM[tok] !== p.S.num, 'fix2 verb error real ' + bad);
    else if (AF[tok]) assert(!(AF[tok].g === p.S.g && AF[tok].num === p.S.num), 'fix2 adj error real ' + bad);
    else assert(false, 'fix2 changed an unexpected word ' + bad);
    if (p.S.implied && AF[tok]) assert(AF[tok].num !== p.S.num, 'implied-subject error must clash in number ' + bad);
  }
}
// Burke's own worksheet answers (week of Oct 12) grade the way his teacher would
const WS = [
  [{ c1: { k: 'noun', s: ['magistra', 'magister'], nums: ['sg', 'sg'], c: 'amicus', order: 0 }, c2: { k: 'act', imp: true, v: 'legit', place: 'agri' }, conj: 'et' },
    [['The teacher and teacher are friend and read in feild', false], ['the teacher and the teacher are friends and read in the fields', true], ['the teacher and teacher are freinds and they read in the feilds', true]]],
  [{ c1: { k: 'act', s: ['poeta', 'amicus'], nums: ['sg', 'sg'], v: 'scribit' }, c2: { k: 'adj', s: ['amicus'], num: 'sg', a: 'defessus' }, conj: 'sed' },
    [['the poet and freind write but the freind is tierd', true], ['the poet and friend sit but the friend is tired', false]]],
  [{ q: 1, s: 'magister', c: 'vir', ca: 'bonus' }, [['who is the teacher? he is good man', true], ['who is the teacher? the man is good', true], ['who is the teacher? he is a good men', false]]],
  [{ c1: { k: 'act', s: ['puella', 'puer'], nums: ['pl', 'pl'], v: 'ambulat' }, c2: { k: 'adj', imp: true, a: 'defessus', neg: true }, conj: 'sed' },
    [['the girls and boys walk but they are not tired', true], ['the girls and boys walk but are not tired', true], ['the girls and boys walks but they are not tired', false], ['the girls and boys walk but they is not tired', false]]],
  [{ c1: { k: 'adj', s: ['villa'], num: 'sg', a: 'parvus' }, c2: { k: 'adj', s: ['familia'], num: 'sg', a: 'laetus' }, conj: 'sed' }, [['the villa is small but the family is happy', true]]],
  [{ c1: { k: 'adj', s: ['equus'], num: 'pl', a: 'molestus', order: 1 }, c2: { k: 'adj', s: ['agricola'], num: 'sg', a: 'laetus', neg: true }, conj: 'et' },
    [['the horses is annoying and the farmer is not happy', false], ['the horses are annoying and the farmer is not happy', true], ['the horse is annoying and the farmer is not happy', false]]],
  [{ c1: { k: 'act', s: ['puella', 'puer'], nums: ['pl', 'pl'], v: 'habitat', place: 'villa' }, c2: { k: 'adj', imp: true, a: 'romanus' }, conj: 'et' },
    [['the girls and boys live in villa and and are roman', true], ['the girls and boys live in the house and they are Roman', true]]],
  [{ c1: { k: 'adj', s: ['villa'], num: 'sg', sa: 'vicinus', a: 'magnus', order: 1 }, c2: { k: 'act', s: ['familia'], num: 'sg', v: 'habitat', place: 'villa', neg: true }, conj: 'sed' },
    [['the neighboring villa is big but the family does not live in villa', true], ['the neighboring villa is big but the family doesnt live in the house', true], ['the big villa is neighboring but the family does not live in villa', false], ['the neighboring villa is big but the family lives in villa', false]]],
  [{ c1: { k: 'adj', s: ['cibus'], num: 'sg', a: 'malus' }, c2: { k: 'adj', s: ['familia'], num: 'sg', a: 'laetus', neg: true }, conj: 'et' },
    [['the food is bad and the family is not happy', true], ['the bad food is and the family is not happy', false]]],
];
for (const [sp, answers] of WS) { const c = g.gTrans2(sp); for (const [a, want] of answers) ok(c, [a], want, 'worksheet ' + c.prompt.latin); }
// Session builders produce two-part cards and they all rebuild
let saw2 = 0;
for (let i = 0; i < 40; i++) for (const b of [buildSkill(st, {}, 'trans'), buildSkill(st, {}, 'fixsent'), buildMock(st, {}, 2), buildMock(st, {}, 2, 'grammar')])
  for (const sp of b.specs) { const c = cardFromSpec(sp); if (c.type === 'trans2' || c.type === 'fix2') { saw2++; ok(c, [c.correct], true, 'session two-part ' + c.summary); } }
assert(saw2 > 50, 'sessions include two-part sentences');
// Stage 1 practice never gets two-part sentences
for (let i = 0; i < 40; i++) { const c = g.makeSkillCard('trans', g.pickOne, 1); assert(c.type !== 'trans2', 'no two-part at stage 1'); }
// Extra worksheet words are help only: never vocab cards, never in the vocab test
assert(!WORDS.some(w => ['ambulat', 'quis', 'in'].includes(w.id)), 'help words stay out of the vocab list');
/* ---------- Stage 3: accusative ---------- */
setUnits([1, 2, 3]);
let nf3 = 0;
// independent accusative endings, straight from the chart in the packet
const accOf = (w, num) => w.gen === 'ae' ? w.lemma.slice(0, -1) + (num === 'sg' ? 'am' : 'as') : w.pl.slice(0, -1) + (num === 'sg' ? 'um' : 'os');
const nomOf = (w, num) => (num === 'sg' ? w.lemma : w.pl);
for (const w of g.NOUNS.filter(x => x.pl)) for (const num of ['sg', 'pl']) for (const cas of ['nom', 'acc']) {
  assert(w.acc[num] === accOf(w, num), 'acc form ' + w.lemma + ' ' + num + ' ' + w.acc[num]);
  const c = g.gCase(w.id, num, cas); nf3++;
  const right = [cas === 'acc' ? 'accusative' : 'nominative', num === 'sg' ? 'singular' : 'plural'];
  ok(c, right, true, 'case ' + c.prompt.latin);
  for (const a of ['nominative', 'accusative']) for (const b of ['singular', 'plural']) if (a !== right[0] || b !== right[1]) ok(c, [a, b], false, 'case wrong ' + c.prompt.latin + ' ' + a + ' ' + b);
  const d = g.gDecline(w.id, num, cas), want = cas === 'acc' ? accOf(w, num) : nomOf(w, num);
  assert(d.fields[0].choices.includes(want) && new Set(d.fields[0].choices).size === d.fields[0].choices.length, 'decline choices ' + w.lemma);
  for (const ch of d.fields[0].choices) ok(d, [ch], ch === want, 'decline ' + w.lemma + ' ' + cas + ' ' + num + ' ' + ch);
}
for (const cid of ['c1', 'c2']) { const c = g.gChart(cid), want = c.fields.map((f, i) => ({ c1: ['-a', '-ae', '-am', '-as'], c2: ['-us / -r', '-ī', '-um', '-os'] }[cid][i]));
  ok(c, want, true, 'chart ' + cid); for (let i = 0; i < 4; i++) for (const ch of c.fields[i].choices) if (ch !== want[i]) { const v = want.slice(); v[i] = ch; ok(c, v, false, 'chart wrong ' + cid + ' ' + i + ' ' + ch); } }
const V3 = { amo: ['amat', 'amant'], ambulo: ['ambulat', 'ambulant'], audio: ['audit', 'audiunt'], curro: ['currit', 'currunt'], habeo: ['habet', 'habent'], habito: ['habitat', 'habitant'],
  sedeo: ['sedet', 'sedent'], terreo: ['terret', 'terrent'], timeo: ['timet', 'timent'], vexo: ['vexat', 'vexant'], video: ['videt', 'vident'] };
for (const [id, [sg, pl]] of Object.entries(V3)) { assert(g.v3(W[id], 'sg') === sg && g.v3(W[id], 'pl') === pl, 'verb form ' + id); }
assert(g.DRILL_VERBS.every(v => v.stage <= 6), 'only Stage 3–6 verbs are drilled so far');
// generated sentences: check the Latin independently, then the English key
const P3 = g.pools3(), seen3 = new Set();
let n3 = 0, cf3 = 0, of3 = 0;
for (let i = 0; i < 9000; i++) {
  const sp = g.randomSpec3(g.pickOne, P3, 0.45), key = JSON.stringify(sp); if (seen3.has(key)) continue; seen3.add(key); n3++;
  const st = g.sentence3(sp), c = g.gDobj(sp);
  assert(!/undefined|null/.test(st.latin + st.correct), 'undefined: ' + st.latin + ' / ' + st.correct);
  st.parts.forEach(p => { if (!p.cl.kind3) return; const tc = p.cl;
    // subject is nominative and the verb agrees with it
    if (tc.s.length === 1) assert(p.sLat[0] === nomOf(W[tc.s[0]], tc.num), 'subject nominative ' + st.latin);
    assert(p.vf === V3[tc.v][p.sNum === 'sg' ? 0 : 1], 'verb agrees ' + st.latin);
    if (tc.sa) assert(p.sLat[1] === W[tc.sa].forms[W[tc.s[0]].g][tc.num], 'subject adjective ' + st.latin);
    if (tc.k === 'tr') { const o = W[tc.o]; assert(p.oLat[0] === accOf(o, tc.onum), 'object accusative ' + st.latin);
      if (tc.oa) { const a = W[tc.oa], stem = a.lemma === 'alter' ? 'alter' : a.forms.f.sg.slice(0, -1); assert(p.oLat[1] === stem + (o.g === 'f' ? (tc.onum === 'sg' ? 'am' : 'as') : (tc.onum === 'sg' ? 'um' : 'os')), 'object adjective ' + st.latin); }
      assert(W[tc.v].tr !== false, 'intransitive verb with an object ' + st.latin); }
    else assert(W[tc.v].tr === false, 'transitive verb without object ' + st.latin);
    if (tc.neg) assert(p.lat[p.lat.indexOf(p.vf) - 1] === 'non', 'non before verb ' + st.latin);
  });
  ok(c, [st.correct], true, 'dobj key ' + st.latin);
  ok(c, [st.correct.toLowerCase().replace(/[.,]/g, '')], true, 'dobj lower ' + st.latin);
  const j = st.join ? ' ' + st.join + ' ' : '';
  for (const a of st.parts[0].acc.slice(0, 5)) for (const b of (st.parts[1] ? st.parts[1].acc.slice(0, 3) : [''])) ok(c, [(a + j + b).trim()], true, 'dobj acc ' + st.latin);
  st.cons.forEach((con, ci) => { const other = st.parts[1 - ci] ? st.parts[1 - ci].acc[0] : null;
    for (const bad of [...con.swap.slice(0, 3), ...con.subjNum.slice(0, 2), ...con.objNum.slice(0, 2)]) if (!st.parts[ci].acc.includes(bad))
      ok(c, [!st.join ? bad : ci === 0 ? bad + j + other : st.parts[0].acc[0] + j + bad], false, 'dobj wrong reading ' + st.latin + ' :: ' + bad); });
  if (st.join) { ok(c, [st.parts[0].acc[0]], false, 'dobj half ' + st.latin); ok(c, [st.parts[0].acc[0] + (st.join === 'and' ? ' but ' : ' and ') + st.parts[1].acc[0]], false, 'dobj wrong conj ' + st.latin); }
  if (st.parts.some(p => p.cl.kind3 && p.cl.neg)) ok(c, [st.correct.replace(/ not\b/g, '').replace(/\bdoes (\w+)/, '$1s').replace(/\bdo (\w+)/, '$1')], false, 'dobj dropped not ' + st.latin);
  const mis = st.correct.replace(/\b(girl|teacher|student|farmer|friend|sailor|wolf|wolves|horse|horses|garden|forest|stream|school|scares|annoys|hears|loves)\b/i, m => m.length > 4 ? m.slice(0, 2) + m[3] + m[2] + m.slice(4) : m + m.slice(-1));
  if (mis !== st.correct) ok(c, [mis], true, 'dobj misspelled ' + st.latin + ' <- ' + mis);
  assert(cardFromSpec({ t: 'g', type: 'dobj', params: [sp], skill: 'dobj' }).correct === c.correct, 'rebuild dobj');
  // case & function: every question, every wrong answer
  for (const ask of g.caseFnAsks(sp)) { const f = g.gCaseFn(sp, ask); cf3++;
    if (ask.modify) { const want = st.parts[ask.p].lat[ask.n]; assert(f.fields[0].choices.includes(want), 'modify choices'); for (const ch of f.fields[0].choices) ok(f, [ch], ch === want, 'modify ' + f.summary + ' ' + ch); continue; }
    const right = [ask.role === 'obj' ? 'accusative' : 'nominative', { subj: 'subject', obj: 'direct object', comp: 'complement' }[ask.role]];
    const wd = st.parts[ask.p].lat[ask.w]; // independent: accusative endings mean direct object
    if (ask.role === 'obj') assert(/(am|as|um|os)$/.test(wd), 'object word is accusative ' + wd); else assert(!/(am|as|um|os)$/.test(wd) || W[letters(wd)], 'nominative word ' + wd);
    for (const a of ['nominative', 'accusative']) for (const b of ['subject', 'direct object', 'complement']) ok(f, [a, b], a === right[0] && b === right[1], 'casefn ' + st.latin + ' ' + wd + ' ' + a + ' ' + b);
  }
  // pick the object form
  sp.c2 ? null : (() => { const tc = sp.c1; if (tc.k !== 'tr') return; for (const mode of ['noun', ...(tc.oa ? ['adj'] : [])]) { const f = g.gObjForm(tc, mode); of3++;
    const p = g.tclause(tc), want = mode === 'noun' ? p.oLat[0] : p.oLat[1];
    assert(f.fields[0].choices.includes(want) && new Set(f.fields[0].choices).size === f.fields[0].choices.length, 'objform choices ' + f.summary);
    for (const ch of f.fields[0].choices) ok(f, [ch], ch === want, 'objform ' + f.summary + ' ' + ch); } })();
}
// mock quizzes and sessions at Stage 3
for (let i = 0; i < 25; i++) {
  const m = buildMock(st, {}, 3), pts = m.specs.reduce((a, x) => a + x.pts, 0); assert(pts === 30, 'stage 3 mock points = ' + pts);
  const mg = buildMock(st, {}, 3, 'grammar'), pg = mg.specs.reduce((a, x) => a + x.pts, 0); assert(pg === 20, 'stage 3 grammar mock points = ' + pg);
  const mv = buildMock(st, {}, 3, 'vocab'); assert(mv.specs.every(sp => inUnit(W[sp.id], 3)), 'vocab mock: Unit 3 words only');
  for (const b of [m, mg, buildSkill(st, {}, 'case'), buildSkill(st, {}, 'objform'), buildSkill(st, {}, 'casefn'), buildSkill(st, {}, 'dobj'), buildSkill(st, {}, 'charts'), buildDaily(st, {}, today, null)])
    for (const sp of b.specs) { const c = cardFromSpec(sp); if (c.answers || c.type === 'l2e' || c.type === 'pick') continue; if (c.fields.every(f => f.choices)) { const r = c.check(c.fields.map(() => '')); assert(!r.ok.every(Boolean), 'blank answer accepted ' + c.summary); } }
}
// Unit 3 vocab test = Unit 3 words (subito and quī/quae are on her Stage 3 list too)
const q3 = quizWords(3).map(w => w.id); assert(q3.includes('subito') && q3.includes('quiquae') && q3.includes('lupus') && !q3.includes('puella') && q3.length === 30, 'unit 3 words ' + q3.length);
// Units not ticked never show up
setUnits([1, 2]);
for (let i = 0; i < 40; i++) for (const b of [buildDaily(st, { units: [1, 2] }, today, null), buildSkill(st, { units: [1, 2] }, 'trans'), buildSkill(st, { units: [1, 2] }, 'fixsent'), buildMock(st, { units: [1, 2] }, 2), buildTestRun(st, { units: [1, 2] }, 2)])
  for (const sp of b.specs) { const c = cardFromSpec(sp); for (const id of c.words || []) assert(W[id].stage <= 2, `unticked word ${id} (stage ${W[id].stage}) in ${b.mode}`); assert(!c.skill || g.SKILL[c.skill].stage <= 2, 'unticked skill ' + c.skill); }
setUnits([1, 2, 3]);
for (let i = 0; i < 20; i++) for (const sp of buildDaily(st, { units: [1, 3] }, today, null).specs) { const c = cardFromSpec(sp); if (c.type === 'l2e' || c.type === 'pick') assert(isOn(W[c.words[0]]), 'skipped unit word'); }
setUnits([1, 2, 3]);
console.log(`stage 3: noun forms ${nf3}, sentences ${n3}, case/function ${cf3}, object forms ${of3}`);
/* ---------- Stage 4: present tense ---------- */
setUnits([1, 2, 3, 4]);
const um = x => x.normalize('NFD').replace(/̄/g, '').normalize('NFC');
// her chart, typed out: amo amas amat amamus amatis amant / habeo… / cado… / audio…
const CHART4 = { 1: ['o', 'as', 'at', 'amus', 'atis', 'ant'], 2: ['eo', 'es', 'et', 'emus', 'etis', 'ent'], 3: ['o', 'is', 'it', 'imus', 'itis', 'unt'], 4: ['io', 'is', 'it', 'imus', 'itis', 'iunt'] };
const CUT = { 1: 3, 2: 3, 3: 3, 4: 3 };
const six = [[1, 'sg'], [2, 'sg'], [3, 'sg'], [1, 'pl'], [2, 'pl'], [3, 'pl']];
let n4 = 0;
const verbs4 = WORDS.filter(w => w.kind === 'vb' && w.en && w.conj !== 'irr');
assert(verbs4.length === 34 && verbs4.every(v => v.stage <= 6), 'Stage 3–6 verbs drilled: ' + verbs4.length);
for (const vb of verbs4) {
  const stem = um(vb.inf).slice(0, -CUT[vb.conj]);
  six.forEach(([p, nm], i) => { const want = i === 0 ? um(vb.lemma) : stem + CHART4[vb.conj][i]; n4++;
    assert(g.conjForm(vb, p, nm) === want, `conj ${vb.lemma} ${p}${nm}: ${g.conjForm(vb, p, nm)} vs ${want}`);
    if (i === 0 && vb.lemma !== 'appereo') assert(um(vb.lemma) === stem + CHART4[vb.conj][0], 'first principal part ' + vb.lemma);
    // person & number
    const c = g.gPnum(vb.id, p, nm);
    for (const a of ['1st', '2nd', '3rd']) for (const b of ['singular', 'plural']) ok(c, [a, b], a === ['', '1st', '2nd', '3rd'][p] && b === (nm === 'sg' ? 'singular' : 'plural'), 'pnum ' + want + ' ' + a + ' ' + b);
    // translate the verb: every accepted answer, and every other person's answer is wrong
    const t = g.gVtrans(vb.id, p, nm), mine = new Set();
    for (const pr of g.PRON_EN[p + nm]) for (const ve of g.vEnP(vb, p, nm, false)) { ok(t, [pr + ' ' + ve], true, 'vtrans ' + want); mine.add(pr + ' ' + ve); }
    ok(t, [g.PRON_SHOW[p + nm].replace('he/she/it', 'she') + ' ' + g.vEnP(vb, p, nm, false)[0]], true, 'vtrans show ' + want);
    for (const [p2, n2] of six) if (p2 !== p || n2 !== nm) for (const pr of g.PRON_EN[p2 + n2].slice(0, 2)) for (const ve of g.vEnP(vb, p2, n2, false).slice(0, 2)) if (!mine.has(pr + ' ' + ve)) ok(t, [pr + ' ' + ve], false, 'vtrans other person ' + want + ' <- ' + pr + ' ' + ve);
    if (nm === 'pl' && p === 2) ok(t, ['you ' + g.vEnP(vb, 2, 'pl', false)[0]], false, 'bare you for -tis ' + want);
    // English → tap the Latin
    for (const st of [0, 1, 2]) { const k = g.gVpick(vb.id, p, nm, st);
      assert(k.fields[0].choices.includes(want) && new Set(k.fields[0].choices).size === k.fields[0].choices.length, 'vpick choices ' + want);
      for (const ch of k.fields[0].choices) ok(k, [ch], ch === want, 'vpick ' + k.prompt.eng + ' ' + ch);
      const e = k.prompt.eng.toLowerCase(), want1 = { '1sg': /^i /, '2sg': /^you (?!all)/, '3sg': /^(he|she|it) /, '1pl': /^we /, '2pl': /^you all /, '3pl': /^they / }[p + nm];
      assert(want1.test(e), 'vpick English matches person: ' + e + ' for ' + want); }
  });
  // conjugate it
  const cj = g.gConj(vb.id), forms = six.map(([p, nm]) => g.conjForm(vb, p, nm));
  ok(cj, forms, true, 'conj all ' + vb.lemma);
  cj.fields.forEach((f, i) => { assert(f.choices.includes(forms[i]) && new Set(f.choices).size === f.choices.length && f.choices.length >= 2, 'conj choices ' + vb.lemma + ' ' + i);
    for (const ch of f.choices) if (ch !== forms[i]) { const v = forms.slice(); v[i] = ch; ok(cj, v, false, 'conj wrong ' + vb.lemma + ' ' + i + ' ' + ch); } });
  const wc = g.gConj(vb.id, 'which'); for (const ch of ['1st', '2nd', '3rd', '4th']) ok(wc, [ch], ch === ['', '1st', '2nd', '3rd', '4th'][vb.conj], 'which conj ' + vb.lemma + ' ' + ch);
}
for (const cid of ['pe', 'pv']) { const c = g.gChart(cid), want = { pe: ['-o', '-s', '-t', '-mus', '-tis', '-nt'], pv: ['a', 'e', 'i', 'i'] }[cid];
  ok(c, want, true, 'chart ' + cid); c.fields.forEach((f, i) => { for (const ch of f.choices) if (ch !== want[i]) { const v = want.slice(); v[i] = ch; ok(c, v, false, 'chart wrong ' + cid + ' ' + i); } }); }
// sentences with the subject in the verb, ego/tu/nos/vos, and eum/eam/eos/eas
const P4 = g.pools3(), seen4 = new Set(); let s4n = 0, hid4 = 0, pro4 = 0, opro4 = 0, q4 = 0;
for (let i = 0; i < 7000; i++) {
  const sp = g.randomSpec3(g.pickOne, P4, 0.45), key = JSON.stringify(sp); if (seen4.has(key)) continue; seen4.add(key); s4n++;
  const st = g.sentence3(sp), c = g.gDobj(sp);
  assert(!/undefined|null/.test(st.latin + st.correct), 'undefined4: ' + st.latin + ' / ' + st.correct);
  st.parts.forEach(p => { if (!p.cl.kind3) return; const tc = p.cl, per = tc.s.length ? 3 : tc.per;
    const vb = W[tc.v], idx = six.findIndex(([a, b]) => a === per && b === p.sNum), want = idx === 0 ? um(vb.lemma) : um(vb.inf).slice(0, -3) + CHART4[vb.conj][idx];
    assert(p.vf === want, 'verb form ' + st.latin + ' ' + p.vf + ' vs ' + want);
    if (!tc.s.length) { hid4++; if (tc.pro) { pro4++; assert(p.sLat[0] === { '1sg': 'ego', '2sg': 'tu', '1pl': 'nos', '2pl': 'vos' }[per + tc.num], 'pronoun ' + st.latin); } else assert(!p.sLat.length, 'hidden subject shows nothing ' + st.latin); }
    if (tc.opro) { opro4++; assert(['eum', 'eam', 'eos', 'eas'].includes(p.oLat[0]) && W[tc.v].tr === 'anim', 'object pronoun ' + st.latin); }
    if (tc.k === 'tr' && !tc.opro) assert(p.oLat[0] === accOf(W[tc.o], tc.onum), 'object accusative4 ' + st.latin);
  });
  ok(c, [st.correct], true, 'dobj4 key ' + st.latin);
  ok(c, [st.correct.toLowerCase().replace(/[.,]/g, '')], true, 'dobj4 lower ' + st.latin);
  const j = st.join ? ' ' + st.join + ' ' : '';
  for (const a of st.parts[0].acc.slice(0, 6)) for (const b of (st.parts[1] ? st.parts[1].acc.slice(0, 2) : [''])) ok(c, [(a + j + b).trim()], true, 'dobj4 acc ' + st.latin);
  st.cons.forEach((con, ci) => { const other = st.parts[1 - ci] ? st.parts[1 - ci].acc[0] : null;
    for (const bad of [...(con.person || []).filter((x, k) => k % 7 === 0).slice(0, 6), ...con.subjNum.slice(0, 2), ...con.objNum.slice(0, 2), ...con.swap.slice(0, 2)]) if (!st.parts[ci].acc.includes(bad))
      ok(c, [!st.join ? bad : ci === 0 ? bad + j + other : st.parts[0].acc[0] + j + bad], false, 'dobj4 wrong reading ' + st.latin + ' :: ' + bad); });
  for (const ask of g.caseFnAsks(sp)) { const f = g.gCaseFn(sp, ask); q4++;
    if (ask.subjof) { const p = st.parts[ask.p], want = p.hidden ? g.PRON_SHOW[p.pk] : p.sLat.filter((t, i) => t !== 'et' && !(p.cl.sa && i === 1)).join(' et ');
      assert(f.fields[0].choices.includes(want) && new Set(f.fields[0].choices).size === f.fields[0].choices.length, 'subjof choices ' + st.latin);
      for (const ch of f.fields[0].choices) ok(f, [ch], ch === want, 'subjof ' + st.latin + ' ' + p.vf + ' ' + ch); }
    else if (ask.pn) { const p = st.parts[ask.p]; for (const a of ['1st', '2nd', '3rd']) for (const b of ['singular', 'plural']) ok(f, [a, b], a === ['', '1st', '2nd', '3rd'][p.per] && b === (p.sNum === 'sg' ? 'singular' : 'plural'), 'pn ' + st.latin + ' ' + a + b); }
    else if (ask.modify) { const want = st.parts[ask.p].lat[ask.n]; for (const ch of f.fields[0].choices) ok(f, [ch], ch === want, 'modify4 ' + f.summary + ' ' + ch); }
    else { const right = [ask.role === 'obj' ? 'accusative' : 'nominative', { subj: 'subject', obj: 'direct object', comp: 'complement' }[ask.role]];
      for (const a of ['nominative', 'accusative']) for (const b of ['subject', 'direct object', 'complement']) ok(f, [a, b], a === right[0] && b === right[1], 'casefn4 ' + st.latin + ' ' + a + ' ' + b); }
  }
  assert(cardFromSpec({ t: 'g', type: 'dobj', params: [sp], skill: 'dobj' }).correct === c.correct, 'rebuild dobj4');
}
assert(hid4 > 500 && pro4 > 50 && opro4 > 50, `stage 4 sentence mix: hidden ${hid4}, pronoun ${pro4}, object pronoun ${opro4}`);
for (let i = 0; i < 25; i++) {
  const m = buildMock(st, { units: [1, 2, 3, 4] }, 4), pts = m.specs.reduce((a, x) => a + x.pts, 0); assert(pts === 30, 'stage 4 mock points = ' + pts);
  const mg = buildMock(st, { units: [1, 2, 3, 4] }, 4, 'grammar'), pg = mg.specs.reduce((a, x) => a + x.pts, 0); assert(pg === 20, 'stage 4 grammar mock points = ' + pg);
  for (const b of [m, mg, ...['pnum', 'vtrans', 'vpick', 'conj', 'casefn', 'dobj', 'charts'].map(k => buildSkill(st, { units: [1, 2, 3, 4] }, k))])
    for (const sp of b.specs) { const c = cardFromSpec(sp); if (c.type === 'l2e' || c.type === 'pick') continue; if (c.fields.every(f => f.choices)) assert(!c.check(c.fields.map(() => '')).ok.every(Boolean), 'blank accepted ' + c.summary); }
}
// With Stage 4 unticked, nothing from it appears (no hidden subjects, no Stage 4 skills or words)
setUnits([1, 2, 3]);
for (let i = 0; i < 40; i++) for (const b of [buildDaily(st, { units: [1, 2, 3] }, today, null), buildSkill(st, { units: [1, 2, 3] }, 'dobj'), buildSkill(st, { units: [1, 2, 3] }, 'casefn'), buildMock(st, { units: [1, 2, 3] }, 3)])
  for (const sp of b.specs) { const c = cardFromSpec(sp); for (const id of c.words || []) assert(W[id].stage <= 3 || (W[id].alsoIn || []).some(x => x <= 3), `unticked stage 4 word ${id} in ${b.mode}`); assert(!c.skill || g.SKILL[c.skill].stage <= 3, 'unticked skill ' + c.skill);
    if (c.type === 'dobj') for (const part of [sp.params[0].c1, sp.params[0].c2].filter(Boolean)) assert(part.kind === 'lv' || part.s.length, 'hidden subject before Stage 4'); }
setUnits([1, 2, 3]);
console.log(`stage 4: verb forms ${n4}, sentences ${s4n} (hidden ${hid4}, ego/tu/nos/vos ${pro4}, eum/eam ${opro4}), questions ${q4}`);
/* ---------- Stage 5: prepositions & the ablative ---------- */
setUnits([1, 2, 3, 4, 5]);
// her chart: 1st -ā / -īs, 2nd -ō / -īs
const ablOf = (w, num) => w.gen === 'ae' ? w.lemma.slice(0, -1) + (num === 'sg' ? 'ā' : 'īs') : w.pl.slice(0, -1) + (num === 'sg' ? 'ō' : 'īs');
const formOf5 = (w, num, cas) => cas === 'nom' ? nomOf(w, num) : cas === 'acc' ? accOf(w, num) : ablOf(w, num);
let n5 = 0;
const nouns5 = g.NOUNS.filter(x => x.pl), adjs5 = g.ADJS.filter(a => a.phrase && !['alter'].includes(a.id));
for (const w of nouns5) for (const num of ['sg', 'pl']) for (const cas of ['nom', 'acc', 'abl']) {
  if (cas === 'abl') assert(w.abl[num] === ablOf(w, num), 'abl form ' + w.lemma + ' ' + num + ' ' + w.abl[num]);
  const c = g.gCase5(w.id, num, cas); n5++;
  const right = [{ nom: 'nominative', acc: 'accusative', abl: 'ablative' }[cas], num === 'sg' ? 'singular' : 'plural', w.g === 'f' ? 'feminine' : 'masculine'];
  for (const a of ['nominative', 'accusative', 'ablative']) for (const b of ['singular', 'plural']) for (const gg of ['masculine', 'feminine']) ok(c, [a, b, gg], a === right[0] && b === right[1] && gg === right[2], 'case5 ' + c.prompt.latin + ' ' + a + ' ' + b + ' ' + gg);
  const d = g.gDecline5(w.id, num, cas), want = formOf5(w, num, cas);
  assert(d.fields[0].choices.includes(want) && new Set(d.fields[0].choices).size === d.fields[0].choices.length, 'decline5 choices ' + w.lemma);
  for (const ch of d.fields[0].choices) ok(d, [ch], ch === want, 'decline5 ' + w.lemma + ' ' + cas + ' ' + num + ' ' + ch);
  // make the adjective agree: independent ending from the noun's real gender (nautā → ignavō)
  for (const a of adjs5) { const f = g.gAgree5(w.id, num, cas, a.id), st2 = a.forms.f.sg.slice(0, -1);
    const wantA = st2 + { m: { nom: { sg: a.lemma.slice(st2.length), pl: 'ī' }, acc: { sg: 'um', pl: 'os' }, abl: { sg: 'ō', pl: 'īs' } }, f: { nom: { sg: 'a', pl: 'ae' }, acc: { sg: 'am', pl: 'as' }, abl: { sg: 'ā', pl: 'īs' } } }[w.g][cas][num];
    assert(f.fields[0].choices.includes(wantA) && new Set(f.fields[0].choices).size === f.fields[0].choices.length, 'agree5 choices ' + f.summary + ' ' + wantA);
    for (const ch of f.fields[0].choices) ok(f, [ch], ch === wantA, 'agree5 ' + f.summary + ' ' + ch); }
}
for (const cid of ['a1', 'a2']) { const c = g.gChart(cid), want = { a1: ['-a', '-ae', '-am', '-as', '-ā', '-īs'], a2: ['-us / -r', '-ī', '-um', '-os', '-ō', '-īs'] }[cid];
  ok(c, want, true, 'chart ' + cid); c.fields.forEach((f, i) => { for (const ch of f.choices) if (ch !== want[i]) { const v = want.slice(); v[i] = ch; ok(c, v, false, 'chart wrong ' + cid + ' ' + i); } }); }
// every preposition with every noun: the case it takes, e/ex and a/ab, English both ways
const TAKES = { aab: 'abl', ad: 'acc', circum: 'acc', cum: 'abl', de: 'abl', eex: 'abl', inabl: 'abl', inacc: 'acc', pro: 'abl', prope: 'acc', sine: 'abl', trans: 'acc' };
const PEN = { aab: 'away from', ad: 'to', circum: 'around', cum: 'with', de: 'about', eex: 'out of', inabl: 'in', inacc: 'into', pro: 'for', prope: 'near', sine: 'without', trans: 'across' };
let pp5 = 0;
for (const [pid, cas] of Object.entries(TAKES)) { assert(W[pid].takes === { abl: 'ablative', acc: 'accusative' }[cas], 'takes ' + pid);
  for (const w of nouns5) for (const num of ['sg', 'pl']) for (const a of [null, adjs5[(w.id.length + pp5) % adjs5.length]]) { if (a && !g.fits(w, a)) continue;
    const pp = { p: pid, n: w.id, num, a: a ? a.id : null }, ph = g.ppPhrase(pp), nf = formOf5(w, num, cas); pp5++;
    const lat0 = pid === 'eex' ? (/^[aeiou]/.test(nf) ? 'ex' : 'e') : pid === 'aab' ? (/^[aeiou]/.test(nf) ? 'ab' : 'a') : pid.startsWith('in') ? 'in' : pid;
    assert(ph.lat[0] === lat0 && ph.lat[1] === nf, `pp Latin ${ph.lat.join(' ')} vs ${lat0} ${nf}`);
    const c = g.gPPl2e(pp), npEn = (a ? a.mean[0] + ' ' : '') + (num === 'sg' ? w.mean[0] : w.enPl[0]);
    ok(c, [`${PEN[pid]} the ${npEn}`], true, 'ppl2e ' + c.summary); ok(c, [c.correct.split(' = ')[1]], true, 'ppl2e key ' + c.summary);
    if (w.enPl.length && num === 'sg' && !(w.mean.some(m => w.enPl.includes(m)))) ok(c, [`${PEN[pid]} the ${(a ? a.mean[0] + ' ' : '')}${w.enPl[0]}`], false, 'ppl2e number ' + c.summary);
    if (pid === 'inabl') ok(c, [`into the ${npEn}`], false, 'in+abl is not into ' + c.summary);
    if (pid === 'inacc') ok(c, [`in the ${npEn}`], false, 'in+acc is not in ' + c.summary);
    const e = g.gPPe2l(pp), good = ph.lat.join(' ');
    assert(e.fields[0].choices.includes(good) && new Set(e.fields[0].choices).size === e.fields[0].choices.length && e.fields[0].choices.length >= 3, 'ppe2l choices ' + e.summary);
    for (const ch of e.fields[0].choices) ok(e, [ch], ch === good, 'ppe2l ' + e.summary + ' ' + ch);
  } }
// sentences with prepositional phrases
const P5 = g.pools3(), seen5 = new Set(); let s5n = 0, withPP = 0, q5 = 0;
for (let i = 0; i < 3500; i++) {
  const sp = g.randomSpec3(g.pickOne, P5, 0.45), key = JSON.stringify(sp); if (seen5.has(key)) continue; seen5.add(key); s5n++;
  const st = g.sentence3(sp), c = g.gDobj(sp);
  assert(!/undefined|null/.test(st.latin + st.correct), 'undefined5: ' + st.latin + ' / ' + st.correct);
  st.parts.forEach(p => { if (!p.cl.kind3 || !p.cl.pp) return; withPP++; const q = p.cl.pp, w = W[q.n], nf = formOf5(w, q.num, TAKES[q.p]);
    assert(p.lat.includes(nf) && p.pp.nf === nf, 'pp noun case ' + st.latin);
    if (['cum', 'sine', 'pro'].includes(q.p)) assert(w.person && (!p.cl.s.length || p.cl.s.every(id => W[id].person)), 'cum/sine/pro with people ' + st.latin);
    if (q.a) { const a = W[q.a]; assert(p.pp.af === a[TAKES[q.p] === 'abl' ? 'abl' : 'acc'][w.g][q.num], 'pp adjective agrees ' + st.latin); } });
  ok(c, [st.correct], true, 'dobj5 key ' + st.latin);
  ok(c, [st.correct.toLowerCase().replace(/[.,]/g, '')], true, 'dobj5 lower ' + st.latin);
  const j = st.join ? ' ' + st.join + ' ' : '';
  for (const a of st.parts[0].acc.slice(0, 6)) for (const b of (st.parts[1] ? st.parts[1].acc.slice(0, 2) : [''])) ok(c, [(a + j + b).trim()], true, 'dobj5 acc ' + st.latin);
  st.cons.forEach((con, ci) => { const other = st.parts[1 - ci] ? st.parts[1 - ci].acc[0] : null;
    for (const bad of [...(con.ppNum || []).slice(0, 3), ...(con.ppCase || []).slice(0, 3), ...(con.noPP || []).slice(0, 2), ...con.swap.slice(0, 2), ...con.objNum.slice(0, 2)]) if (!st.parts[ci].acc.includes(bad))
      ok(c, [!st.join ? bad : ci === 0 ? bad + j + other : st.parts[0].acc[0] + j + bad], false, 'dobj5 wrong reading ' + st.latin + ' :: ' + bad); });
  for (const ask of g.caseFnAsks(sp)) { const f = g.gCaseFn(sp, ask); q5++;
    const p = st.parts[ask.p];
    if (ask.ppq) { const want = p.pp.lat.join(' '); for (const ch of f.fields[0].choices) ok(f, [ch], ch === want, 'ppq ' + st.latin + ' ' + ch); }
    else if (ask.trq) { const want = p.cl.k === 'tr' ? 'transitive' : 'intransitive'; for (const ch of ['transitive', 'intransitive']) ok(f, [ch], ch === want, 'trq ' + st.latin + ' ' + ch); }
    else if (ask.subjof || ask.pn || ask.modify) { const want = f.correct.split(': ').pop().split(' modifies ').pop(); if (ask.modify) { const w2 = p.lat[ask.n]; for (const ch of f.fields[0].choices) ok(f, [ch], ch === w2, 'modify5 ' + st.latin + ' ' + ch); } }
    else { const right = [ask.role === 'obj' ? 'accusative' : ask.role === 'pobj' ? (TAKES[p.cl.pp.p] === 'abl' ? 'ablative' : 'accusative') : 'nominative', { subj: 'subject', obj: 'direct object', comp: 'complement', pobj: 'object of a preposition' }[ask.role]];
      if (ask.role === 'pobj') assert(p.lat[ask.w] === p.pp.nf, 'pobj word');
      for (const a of ['nominative', 'accusative', 'ablative']) for (const b of ['subject', 'direct object', 'complement', 'object of a preposition']) ok(f, [a, b], a === right[0] && b === right[1], 'casefn5 ' + st.latin + ' ' + p.lat[ask.w] + ' ' + a + ' ' + b); }
  }
}
assert(withPP > 1000, 'stage 5 sentences with prepositional phrases: ' + withPP);
for (let i = 0; i < 25; i++) {
  const m = buildMock(st, { units: [1, 2, 3, 4, 5] }, 5), pts = m.specs.reduce((a, x) => a + x.pts, 0); assert(pts === 30, 'stage 5 mock points = ' + pts);
  const mg = buildMock(st, { units: [1, 2, 3, 4, 5] }, 5, 'grammar'), pg = mg.specs.reduce((a, x) => a + x.pts, 0); assert(pg === 20, 'stage 5 grammar mock points = ' + pg);
  for (const b of [m, mg, ...['case', 'agree5', 'ppl2e', 'ppe2l', 'casefn', 'dobj', 'charts'].map(k => buildSkill(st, { units: [1, 2, 3, 4, 5] }, k))])
    for (const sp of b.specs) { const c = cardFromSpec(JSON.parse(JSON.stringify(sp))); if (c.type === 'l2e' || c.type === 'pick') continue; if (c.fields.every(f => f.choices)) assert(!c.check(c.fields.map(() => '')).ok.every(Boolean), 'blank accepted ' + c.summary); }
}
setUnits([1, 2, 3, 4]);
for (let i = 0; i < 30; i++) for (const b of [buildSkill(st, { units: [1, 2, 3, 4] }, 'dobj'), buildSkill(st, { units: [1, 2, 3, 4] }, 'case'), buildMock(st, { units: [1, 2, 3, 4] }, 4)])
  for (const sp of b.specs) { const c = cardFromSpec(sp); for (const id of c.words || []) assert(W[id].stage <= 4 || (W[id].alsoIn || []).some(x => x <= 4), `unticked stage 5 word ${id}`); assert(!['case5', 'decline5'].includes(c.type), 'ablative before Stage 5'); }
setUnits([1, 2, 3]);
console.log(`stage 5: forms ${n5}, phrases ${pp5}, sentences ${s5n} (with a phrase ${withPP}), questions ${q5}`);
/* ---------- Stage 6: the imperfect tense ---------- */
setUnits([1, 2, 3, 4, 5, 6]);
// her chart: linking vowel a / e / e / ie, then -bam -bas -bat -bamus -batis -bant (amabam, habebam, dicebam, dormiebam)
const LV6 = { 1: 'a', 2: 'e', 3: 'e', 4: 'ie' }, BA = ['bam', 'bas', 'bat', 'bamus', 'batis', 'bant'];
const impfOf = (vb, i) => um(vb.inf).slice(0, -3) + LV6[vb.conj] + BA[i];
const presOf = (vb, i) => i === 0 ? um(vb.lemma) : um(vb.inf).slice(0, -3) + CHART4[vb.conj][i];
let n6 = 0;
const verbs6 = WORDS.filter(w => w.kind === 'vb' && w.en && w.conj !== 'irr');
assert(verbs6.length === 34, 'Stage 3–6 verbs drilled: ' + verbs6.length);
for (const vb of verbs6) {
  six.forEach(([p, nm], i) => { const want = impfOf(vb, i); n6++;
    assert(g.conjForm(vb, p, nm, 'impf') === want, `impf ${vb.lemma} ${p}${nm}: ${g.conjForm(vb, p, nm, 'impf')} vs ${want}`);
    assert(g.conjForm(vb, p, nm) === presOf(vb, i) || vb.lemma === 'appereo', 'present still right ' + vb.lemma);
    // English: past, was/were …ing, used to …
    const en = g.vEnP(vb, p, nm, false, 'impf'), wasWere = (p + nm === '1sg' || p + nm === '3sg') ? 'was' : 'were';
    for (const e of vb.en) { if (e.fixed) { assert(en.includes('did not know'), 'nescio impf'); continue; }
      if (/^is /.test(e.sg)) assert(en.includes(wasWere + ' ' + e.sg.slice(3)), 'be-verb impf ' + vb.lemma);
      else { assert(e.past && en.includes(e.past) && en.includes('used to ' + e.pl), 'past forms ' + vb.lemma); if (e.ing) assert(en.includes(wasWere + ' ' + e.ing), 'was/were ing ' + vb.lemma); } }
    // person, number and tense
    for (const t of ['pres', 'impf']) { const c = g.gPnum(vb.id, p, nm, t);
      for (const a of ['1st', '2nd', '3rd']) for (const b of ['singular', 'plural']) for (const tt of ['present', 'imperfect']) ok(c, [a, b, tt], a === ['', '1st', '2nd', '3rd'][p] && b === (nm === 'sg' ? 'singular' : 'plural') && tt === (t === 'impf' ? 'imperfect' : 'present'), 'pnum6 ' + c.prompt.latin + ' ' + a + b + tt); }
    // translate the imperfect form; present English is wrong for it, and the other way round
    for (const t of ['pres', 'impf']) { const c = g.gVtrans(vb.id, p, nm, t), other = t === 'impf' ? 'pres' : 'impf';
      for (const pr of g.PRON_EN[p + nm].slice(0, 3)) { for (const ve of g.vEnP(vb, p, nm, false, t)) ok(c, [pr + ' ' + ve], true, 'vtrans6 ' + c.summary + ' ' + pr + ' ' + ve);
        for (const ve of g.vEnP(vb, p, nm, false, other)) if (!g.vEnP(vb, p, nm, false, t).includes(ve)) ok(c, [pr + ' ' + ve], false, 'vtrans6 wrong tense ' + c.summary + ' ' + pr + ' ' + ve); }
      for (const [p2, n2] of six) if (p2 !== p || n2 !== nm) ok(c, [g.PRON_EN[p2 + n2][0] + ' ' + g.vEnP(vb, p2, n2, false, t)[0]], false, 'vtrans6 other person ' + c.summary);
      for (const st of [0, 1, 2]) { const k = g.gVpick(vb.id, p, nm, st, t), want = t === 'impf' ? impfOf(vb, i) : presOf(vb, i);
        if (vb.lemma === 'appereo' && i === 0 && t === 'pres') continue;
        assert(k.fields[0].choices.includes(want) && new Set(k.fields[0].choices).size === k.fields[0].choices.length, 'vpick6 choices ' + k.summary);
        for (const ch of k.fields[0].choices) ok(k, [ch], ch === want, 'vpick6 ' + k.summary + ' ' + ch); }
      const f = g.gConj(vb.id, 'form', t, p, nm), want = t === 'impf' ? impfOf(vb, i) : g.conjForm(vb, p, nm);
      assert(f.fields[0].choices.includes(want), 'form choices ' + f.summary); for (const ch of f.fields[0].choices) ok(f, [ch], ch === want, 'form ' + f.summary + ' ' + ch);
    }
  });
  const cj = g.gConj(vb.id, 'all', 'impf'), forms = six.map((_, i) => impfOf(vb, i));
  ok(cj, forms, true, 'conj impf ' + vb.lemma);
  cj.fields.forEach((f, i) => { assert(f.choices.includes(forms[i]) && new Set(f.choices).size === f.choices.length, 'conj impf choices ' + vb.lemma);
    for (const ch of f.choices) if (ch !== forms[i]) { const v = forms.slice(); v[i] = ch; ok(cj, v, false, 'conj impf wrong ' + vb.lemma + ' ' + ch); } });
}
for (const cid of ['ie', 'iv']) { const c = g.gChart(cid), want = { ie: ['-bam', '-bas', '-bat', '-bamus', '-batis', '-bant'], iv: ['a', 'e', 'e', 'ie'] }[cid];
  ok(c, want, true, 'chart ' + cid); c.fields.forEach((f, i) => { for (const ch of f.choices) if (ch !== want[i]) { const v = want.slice(); v[i] = ch; ok(c, v, false, 'chart wrong ' + cid + ' ' + i); } }); }
// sentences: both tenses, time words, -que, -ne questions
const P6 = g.pools3(), seen6 = new Set(); let s6n = 0, imp6 = 0, adv6 = 0, que6 = 0, ne6 = 0, q6 = 0;
for (let i = 0; i < 3000; i++) {
  const sp = g.randomSpec3(g.pickOne, P6, 0.45), key = JSON.stringify(sp); if (seen6.has(key)) continue; seen6.add(key); s6n++;
  const st = g.sentence3(sp), c = g.gDobj(sp);
  assert(!/undefined|null/.test(st.latin + st.correct), 'undefined6: ' + st.latin + ' / ' + st.correct);
  st.parts.forEach(p => { if (!p.cl.kind3) return; const tc = p.cl, vb = W[tc.v], per = tc.s.length ? 3 : tc.per, i6 = six.findIndex(([a, b]) => a === per && b === p.sNum);
    const want = (tc.tense || 'pres') === 'impf' ? impfOf(vb, i6) : presOf(vb, i6);
    assert(p.vf === want || (vb.lemma === 'appereo' && i6 === 0), 'verb form6 ' + st.latin + ' ' + p.vf + ' vs ' + want);
    if (tc.tense === 'impf') imp6++;
    if (tc.adv) { adv6++; assert(p.lat[0].replace(/ne$/, '') === tc.adv, 'time word first ' + st.latin); if (tc.adv === 'heri' || tc.adv === 'tum') assert(tc.tense === 'impf', 'heri/tum with imperfect ' + st.latin); if (tc.adv === 'nunc') assert(tc.tense === 'pres', 'nunc with present ' + st.latin); }
    if (tc.que) { que6++; assert(p.sLat.length === 2 && p.sLat[1].endsWith('que') && !p.sLat.includes('et'), '-que subject ' + st.latin); }
    if (tc.ne) { ne6++; assert(/ne$/.test(p.lat[0]) && st.latin.endsWith('?') && st.correct.endsWith('?') && !tc.neg, '-ne question ' + st.latin); }
  });
  ok(c, [st.correct], true, 'dobj6 key ' + st.latin);
  ok(c, [st.correct.toLowerCase().replace(/[.,?]/g, '')], true, 'dobj6 lower ' + st.latin);
  const j = st.join ? ' ' + st.join + ' ' : '';
  for (const a of st.parts[0].acc.slice(0, 6)) for (const b of (st.parts[1] ? st.parts[1].acc.slice(0, 2) : [''])) ok(c, [(a + j + b).trim()], true, 'dobj6 acc ' + st.latin);
  st.cons.forEach((con, ci) => { const other = st.parts[1 - ci] ? st.parts[1 - ci].acc[0] : null;
    for (const bad of [...(con.tense || []).slice(0, 4), ...(con.statement || []).slice(0, 3), ...(con.noAdv || []).slice(0, 2), ...con.swap.slice(0, 2), ...(con.person || []).filter((x, k) => k % 9 === 0).slice(0, 3)]) if (!st.parts[ci].acc.includes(bad))
      ok(c, [!st.join ? bad : ci === 0 ? bad + j + other : st.parts[0].acc[0] + j + bad], false, 'dobj6 wrong reading ' + st.latin + ' :: ' + bad); });
  for (const ask of g.caseFnAsks(sp)) { if (!ask.pn) continue; const f = g.gCaseFn(sp, ask), p = st.parts[ask.p]; q6++;
    assert(f.fields.length === 3, 'tense field from Stage 6');
    for (const a of ['1st', '2nd', '3rd']) for (const b of ['singular', 'plural']) for (const tt of ['present', 'imperfect']) ok(f, [a, b, tt], a === ['', '1st', '2nd', '3rd'][p.per] && b === (p.sNum === 'sg' ? 'singular' : 'plural') && tt === (p.tense === 'impf' ? 'imperfect' : 'present'), 'pnt ' + st.latin + a + b + tt); }
  assert(cardFromSpec({ t: 'g', type: 'dobj', params: [sp], skill: 'dobj' }).correct === c.correct, 'rebuild dobj6');
}
assert(imp6 > 800 && adv6 > 150 && que6 > 30 && ne6 > 100, `stage 6 mix: imperfect ${imp6}, time words ${adv6}, -que ${que6}, -ne ${ne6}`);
for (let i = 0; i < 25; i++) {
  const m = buildMock(st, { units: [1, 2, 3, 4, 5, 6] }, 6), pts = m.specs.reduce((a, x) => a + x.pts, 0); assert(pts === 30, 'stage 6 mock points = ' + pts);
  const mg = buildMock(st, { units: [1, 2, 3, 4, 5, 6] }, 6, 'grammar'), pg = mg.specs.reduce((a, x) => a + x.pts, 0); assert(pg === 20, 'stage 6 grammar mock points = ' + pg);
  for (const b of [m, mg, ...['pnum', 'vtrans', 'vpick', 'conj', 'casefn', 'dobj', 'charts'].map(k => buildSkill(st, { units: [1, 2, 3, 4, 5, 6] }, k))])
    for (const sp of b.specs) { const c = cardFromSpec(JSON.parse(JSON.stringify(sp))); if (c.type === 'l2e' || c.type === 'pick') continue; if (c.fields.every(f => f.choices)) assert(!c.check(c.fields.map(() => '')).ok.every(Boolean), 'blank accepted ' + c.summary); }
}
setUnits([1, 2, 3, 4, 5]);
for (let i = 0; i < 30; i++) for (const b of [buildSkill(st, { units: [1, 2, 3, 4, 5] }, 'dobj'), buildSkill(st, { units: [1, 2, 3, 4, 5] }, 'vtrans'), buildSkill(st, { units: [1, 2, 3, 4, 5] }, 'pnum'), buildMock(st, { units: [1, 2, 3, 4, 5] }, 5)])
  for (const sp of b.specs) { const c = cardFromSpec(sp); for (const id of c.words || []) assert(W[id].stage <= 5 || (W[id].alsoIn || []).some(x => x <= 5), `unticked stage 6 word ${id}`);
    assert(!/ba(m|s|t|mus|tis|nt)\b/.test(c.prompt.latin || '') || c.type === 'l2e', 'imperfect before Stage 6: ' + c.prompt.latin); }
setUnits([1, 2, 3]);
console.log(`stage 6: forms ${n6}, sentences ${s6n} (imperfect ${imp6}, time words ${adv6}, -que ${que6}, -ne ${ne6}), questions ${q6}`);
console.log(`two-part sentences ${two}, fix-the-error ${fix2n}`);
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
