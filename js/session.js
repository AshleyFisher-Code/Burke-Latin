// Builds practice sessions as lists of small, saveable "specs", and turns specs back into cards.
import { WORDS, W, MAX_STAGE, setUnits, unitsOf, curUnit, isOn, inUnit, stageOn } from './data.js';
import { vocabL2E, vocabPick, pickOpts, gNID, gChart, gAgree, gPhrase, gFixPhrase, gVnum, gSV, gComp, gRole, gTrans, gFixSent, gTrans2, gFix2, randomSpec2, poolsFor, fix2Errors, gCase, gDecline, gObjForm, gCaseFn, gDobj, caseFnAsks, randomSpec3, pools3, gPnum, gVtrans, gVpick, gConj, gCase5, gDecline5, gAgree5, gPPl2e, gPPe2l, CONJ_VERBS, PERSONS6, gIrrQ, IRR_QS,
  makeSkillCard, SKILLS, SKILL, CHARTS, shuffle, pickOne, PL_NOUNS, randomSentenceSpec, PHRASE_ADJS, PERSONS, NOUNS, COMP_ADJS } from './gen.js';
import { wordStatus, skillAcc, quizWords, quizSkills, isMasteryDay, quizCovers } from './srs.js';

const BUILD = { nid: gNID, chart: gChart, agree: gAgree, phrase: gPhrase, fixphrase: gFixPhrase, vnum: gVnum, sv: gSV, comp: gComp, role: gRole, trans: gTrans, fixsent: gFixSent, trans2: gTrans2, fix2: gFix2, case: gCase, decline: gDecline, objform: gObjForm, casefn: gCaseFn, dobj: gDobj, pnum: gPnum, vtrans: gVtrans, vpick: gVpick, conj: gConj, case5: gCase5, decline5: gDecline5, agree5: gAgree5, ppl2e: gPPl2e, ppe2l: gPPe2l, irrq: gIrrQ };
export function cardFromSpec(sp) {
  let c;
  // He only ever reads Latin and answers in English. Old saved English→Latin cards are shown as Latin→English.
  if (sp.t === 'l2e' || sp.t === 'e2l') c = vocabL2E(W[sp.id]);
  else if (sp.t === 'also') c = vocabL2E(W.etiam);
  else if (sp.t === 'pick') c = vocabPick(W[sp.id], sp.opts);
  else c = BUILD[sp.type](...sp.params);
  c.spec = sp; return c;
}
const gSpec = card => ({ t: 'g', type: card.type, params: card.params, skill: card.skill });
export const vocabSpec = (id, dir = 'l2e') => (dir === 'pick' ? pickSpec(id) : { t: 'l2e', id, cid: 'w:' + id });
export const pickSpec = id => ({ t: 'pick', id, cid: 'w:' + id, opts: pickOpts(W[id]) });

// Prefer words that haven't shown up in a while (vocab or grammar), so examples cover the whole bank.
export function makePicker(state) {
  const age = id => { const w = state.words[id]; if (!w) return -1e9; return Math.max(w.ctx ?? -1e9, w.last ?? -1e9); };
  return list => { if (!list.length) return undefined; const s = list.slice().sort((a, b) => age(a.id) - age(b.id)); const k = Math.max(2, Math.ceil(s.length / 3)); return pickOne(s.slice(0, k)); };
}
// The parent ticks which units are on; the highest ticked one is the current unit.
export const stageOf = settings => { setUnits(unitsOf(settings)); return curUnit(); };
function dirFor() { return 'l2e'; }
function skillCards(state, settings, n, stageCap, focusStage) {
  const pick = makePicker(state);
  const skills = SKILLS.filter(s => stageOn(s.stage) && s.stage <= stageCap);
  // weakest first; not-started skills of the current stage count as weak
  const score = s => { const a = skillAcc(state, s.id); return a == null ? (s.stage === focusStage ? -1 : 0.5) : a; };
  const ranked = skills.slice().sort((a, b) => score(a) - score(b));
  const out = [];
  for (let i = 0; i < n; i++) { const s = ranked[i % Math.min(ranked.length, 4)]; out.push(gSpec(makeSkillCard(s.id, pick, stageCap))); }
  return out;
}

/* ---------- Today ---------- */
export function buildDaily(state, settings, today, quiz) {
  const stage = stageOf(settings);
  if (quiz && quiz.daysLeft <= 4 && quiz.daysLeft >= 0) return buildQuizPrep(state, settings, today, quiz);
  if (isMasteryDay(state) && state.streak.last !== today) return buildMastery(state, today, stage);
  const bank = WORDS.filter(w => isOn(w) && w.stage <= stage);
  const due = bank.filter(w => state.words[w.id] && state.words[w.id].seen && state.words[w.id].due <= today)
    .sort((a, b) => state.words[a.id].due - state.words[b.id].due || state.words[a.id].lvl - state.words[b.id].lvl);
  const picked = due.slice(0, 16);
  const unseen = bank.filter(w => !state.words[w.id] || !state.words[w.id].seen).sort((a, b) => b.stage - a.stage);
  const newOnes = shuffle(unseen.filter(w => inUnit(w, stage))).concat(shuffle(unseen.filter(w => !inUnit(w, stage)))).slice(0, Math.max(0, Math.min(8, 20 - picked.length)));
  let vocab = picked.concat(newOnes);
  if (vocab.length < 20) {
    const rest = bank.filter(w => !vocab.includes(w)).sort((a, b) => ((state.words[a.id] || {}).last ?? -1e9) - ((state.words[b.id] || {}).last ?? -1e9));
    vocab = vocab.concat(rest.slice(0, 20 - vocab.length));
  }
  const vspecs = vocab.map(w => vocabSpec(w.id, dirFor(state.words[w.id])));
  const g = skillCards(state, settings, 5, stage, stage);
  return { mode: 'daily', title: "Today's practice", specs: interleave(vspecs, g), counts: true };
}
function interleave(a, b) { const out = shuffle(a); b.forEach((x, i) => out.splice(Math.min(out.length, Math.round((i + 1) * out.length / (b.length + 1)) + i), 0, x)); return out; }

export function buildMastery(state, today, stage) {
  const bank = WORDS.filter(w => isOn(w) && w.stage <= stage);
  const known = shuffle(bank.filter(w => ['known', 'mastered', 'slipped'].includes(wordStatus(state.words[w.id]))));
  const others = shuffle(bank.filter(w => !known.includes(w)));
  const list = known.concat(others).slice(0, 30);
  return { mode: 'mastery', title: 'Mastery Check', test: true, counts: true,
    specs: shuffle(list.map(w => vocabSpec(w.id, 'l2e'))) };
}
export function buildQuizPrep(state, settings, today, quiz) {
  const cov = quizCovers(quiz), winStart = quiz.day - 4;
  const due = (excl = []) => WORDS.filter(w => isOn(w) && w.stage <= quiz.stage && !excl.includes(w) && state.words[w.id] && state.words[w.id].seen && state.words[w.id].due <= today);
  if (cov === 'grammar') { // grammar week: weak skills first, a few due words so older vocab doesn't slip
    const g = skillCards(state, settings, 14, quiz.stage, quiz.stage);
    const v = shuffle(due()).slice(0, 6).map(w => vocabSpec(w.id, 'l2e'));
    return { mode: 'quizprep', title: 'Grammar quiz prep', specs: interleave(g, v), counts: true };
  }
  const qw = quizWords(quiz.stage); // this unit's words: must all be confirmed
  const unconf = qw.filter(w => { const ws = state.words[w.id]; return !(ws && ws.confirmed != null && ws.confirmed >= winStart && ws.lastOk); });
  if (cov === 'vocab') { // vocab week: no grammar at all. Unconfirmed unit words, then the rest of the unit, then a few older due words.
    const rest = shuffle(qw.filter(w => !unconf.includes(w)));
    const unit = shuffle(unconf).concat(rest).slice(0, Math.max(20, Math.min(unconf.length, 30)));
    const older = shuffle(due(qw)).slice(0, 4);
    return { mode: 'quizprep', title: 'Vocab quiz prep', specs: shuffle(unit.concat(older)).map(w => vocabSpec(w.id, 'l2e')), counts: true };
  }
  const dueW = due(unconf); // older words stay in review
  const vocab = shuffle(unconf).slice(0, 22).concat(shuffle(dueW).slice(0, Math.max(0, 22 - unconf.length)));
  const vspecs = vocab.map(w => vocabSpec(w.id, 'l2e'));
  const g = skillCards(state, settings, 6, quiz.stage, quiz.stage);
  return { mode: 'quizprep', title: 'Quiz prep', specs: interleave(vspecs, g), counts: true };
}

/* ---------- Vocab page ---------- */
export function buildReview(state, settings, today) {
  const stage = stageOf(settings);
  const due = WORDS.filter(w => isOn(w) && w.stage <= stage && state.words[w.id] && state.words[w.id].seen && state.words[w.id].due <= today)
    .sort((a, b) => state.words[a.id].due - state.words[b.id].due).slice(0, 25);
  return { mode: 'review', title: 'Vocab review', specs: due.map(w => vocabSpec(w.id, dirFor(state.words[w.id]))) };
}
// Every word in the unit once (type the meaning). Finishing it counts for the day's streak.
export function buildUnit(stage) {
  return { mode: 'unit', title: `Unit ${stage} vocab review`, counts: true, specs: shuffle(WORDS.filter(w => inUnit(w, stage))).map(w => vocabSpec(w.id, 'l2e')) };
}
export function buildLearn(stage) {
  const ws = WORDS.filter(w => inUnit(w, stage));
  const a = shuffle(ws).map(w => pickSpec(w.id)); // first see it: tap the meaning
  const b = shuffle(ws).map(w => vocabSpec(w.id, 'l2e')); // then type the meaning
  return { mode: 'learn', title: `Learn Stage ${stage}`, specs: a.concat(b) };
}
export function troubleWords(state, settings) {
  const stage = stageOf(settings);
  return WORDS.filter(w => isOn(w) && w.stage <= stage).filter(w => { const s = state.words[w.id]; return s && s.seen && (s.slipped != null || (s.wrong >= 2 && s.lvl <= 3) || (s.wrong >= 1 && s.lvl <= 1)); })
    .sort((a, b) => (state.words[b.id].wrong - state.words[b.id].right) - (state.words[a.id].wrong - state.words[a.id].right));
}
export function buildTrouble(state, settings) {
  const t = troubleWords(state, settings).slice(0, 20);
  return { mode: 'trouble', title: 'Trouble words', specs: shuffle(t.flatMap(w => [vocabSpec(w.id, 'l2e')])) };
}

/* ---------- Grammar page ---------- */
export function buildSkill(state, settings, skillId, n = 12) {
  const pick = makePicker(state);
  const specs = []; for (let i = 0; i < n; i++) specs.push(gSpec(makeSkillCard(skillId, pick, stageOf(settings))));
  return { mode: 'skill', title: SKILL[skillId].name, specs };
}

/* ---------- follow-ups (misses come back, asked a different way) ---------- */
export function followUp(sp, state, settings) {
  if (sp.t === 'l2e' || sp.t === 'e2l') return { ...pickSpec(sp.id), follow: true }; // comes back as tap-the-meaning
  if (sp.t === 'pick') return { ...vocabSpec(sp.id, 'l2e'), follow: true };
  if (sp.t === 'also') return { ...pickSpec(pickOne(['etiam', 'quoque'])), follow: true };
  const c = makeSkillCard(sp.skill || sp.type, makePicker(state), stageOf(settings));
  return { ...gSpec(c), follow: true };
}

/* ---------- Test Prep ---------- */
export function buildTestRun(state, settings, stage, covers = 'both') {
  const pick = makePicker(state);
  if (covers === 'vocab') { const unit = WORDS.filter(w => inUnit(w, stage)); const shakyU = unit.filter(w => { const s = state.words[w.id]; return !s || !s.seen || s.lvl <= 2 || s.slipped != null; });
    return { mode: 'testrun', title: 'Vocab Test Run', test: true, specs: shuffle(shakyU).concat(shuffle(unit.filter(w => !shakyU.includes(w)))).slice(0, 10).map(w => vocabSpec(w.id, 'l2e')) }; }
  if (covers === 'grammar') { const sk = SKILLS.filter(s => stageOn(s.stage) && s.stage <= stage).sort((a, b) => (skillAcc(state, a.id) ?? 0) - (skillAcc(state, b.id) ?? 0));
    const specs = []; for (let i = 0; i < 10; i++) specs.push(gSpec(makeSkillCard(sk[i % Math.min(sk.length, 6)].id, pick, stage)));
    return { mode: 'testrun', title: 'Grammar Test Run', test: true, specs: shuffle(specs) }; }
  const bank = WORDS.filter(w => isOn(w) && w.stage <= stage);
  const shaky = bank.filter(w => { const s = state.words[w.id]; return s && s.seen && (s.lvl <= 2 || s.slipped != null); });
  const vocabPool = shuffle(shaky).concat(shuffle(bank.filter(w => !shaky.includes(w))));
  const specs = vocabPool.slice(0, 6).map(w => vocabSpec(w.id, 'l2e'));
  const skills = SKILLS.filter(s => stageOn(s.stage) && s.stage <= stage).sort((a, b) => (skillAcc(state, a.id) ?? 0) - (skillAcc(state, b.id) ?? 0)).slice(0, 4);
  skills.forEach(s => specs.push(gSpec(makeSkillCard(s.id, pick, stage))));
  return { mode: 'testrun', title: 'Test Run', test: true, specs: shuffle(specs) };
}
// Mock quiz in the teacher's format, scored out of 30.
export function buildMock(state, settings, stage, covers = 'both') {
  const pick = makePicker(state);
  if (covers === 'vocab') { // this unit's words only, like the real vocab quiz
    const xs = shuffle(WORDS.filter(w => inUnit(w, stage) && w.kind === 'x')).slice(0, 3);
    const unit = shuffle(WORDS.filter(w => inUnit(w, stage) && w.kind !== 'x')).slice(0, 15 - xs.length).concat(xs);
    return { mode: 'mock', kind: 'vocab', title: `Vocab mock quiz · Unit ${stage}`, test: true, stage, sections: [{ name: 'Vocabulary: meaning + middle stuff' }],
      specs: shuffle(unit).map(w => ({ ...vocabSpec(w.id, 'l2e'), sec: 0, pts: 1 })) };
  }
  // Vocab section: this unit's words only (like the real test). Grammar sections below use every word so far.
  const cur = shuffle(WORDS.filter(w => inUnit(w, stage) && w.kind !== 'x'));
  const misc = shuffle(WORDS.filter(w => inUnit(w, stage) && w.kind === 'x'));
  const vocab = cur.slice(0, 10 - Math.min(2, misc.length)).concat(misc.slice(0, 2)); // always 10 words (Stage 5's extras are all prepositions)
  const sections = [];
  sections.push({ name: 'I. Vocabulary', pts: 1, specs: shuffle(vocab).map(w => vocabSpec(w.id, 'l2e')) });
  if (stage >= 7) { // Stage 7 quiz: sum and possum charts, forms, translations, facts, translating
    sections.push({ name: 'II. Conjugate sum and possum (2 points each)', pts: 2, specs: [gSpec(gConj('sum', 'all', Math.random() < 0.5 ? 'pres' : 'impf')), gSpec(gConj('possum', 'all', Math.random() < 0.5 ? 'pres' : 'impf'))] });
    const fm = []; for (let i = 0; i < 4; i++) { const [p, n] = pickOne(PERSONS6); fm.push(gSpec(gConj(i % 2 ? 'sum' : 'possum', 'form', i < 2 ? 'impf' : 'pres', p, n))); }
    sections.push({ name: 'III. Produce the requested form', pts: 1, specs: fm });
    const vt = []; for (let i = 0; i < 4; i++) { const [p, n] = pickOne(PERSONS6); vt.push(gSpec(gVtrans(i % 2 ? 'sum' : 'possum', p, n, i < 2 ? 'impf' : 'pres'))); }
    sections.push({ name: 'IV. Translate the verbs', pts: 1, specs: vt });
    const qi = shuffle([0, 1, 2, 3, 4, 5]).slice(0, 2);
    sections.push({ name: 'V. Questions about sum and possum', pts: 1, specs: qi.map(i => gSpec(gIrrQ(i))) });
    const P = pools3(), tr = []; for (let i = 0; i < 3; i++) tr.push(gSpec(gDobj(randomSpec3(pick, P, 0.6))));
    sections.push({ name: 'VI. Translating (2 points each)', pts: 2, specs: tr });
    if (covers === 'grammar') sections.shift();
    const specs = []; sections.forEach((s, si) => s.specs.forEach(sp => specs.push({ ...sp, sec: si, pts: s.pts })));
    return { mode: 'mock', kind: covers, title: covers === 'grammar' ? `Grammar mock quiz · Stage ${stage}` : `Mock quiz · Stage ${stage}`, test: true, stage, sections: sections.map(s => ({ name: s.name })), specs };
  }
  if (stage >= 6) { // Stage 6 quiz: present vs imperfect: translate verbs, person/number/tense, produce the form, conjugate, translating
    const vt = []; for (let i = 0; i < 5; i++) vt.push(gSpec(makeSkillCard('vtrans', pick, stage)));
    sections.push({ name: 'II. Translate the verbs', pts: 1, specs: vt });
    const pn = []; for (let i = 0; i < 4; i++) pn.push(gSpec(makeSkillCard('pnum', pick, stage)));
    sections.push({ name: 'III. Person, number and tense', pts: 1, specs: pn });
    const cv = CONJ_VERBS(), fm = [];
    for (let i = 0; i < 3; i++) { const v = pickOne(cv), [p, n] = pickOne(PERSONS6); fm.push(gSpec(gConj(v.id, 'form', i === 2 ? 'pres' : 'impf', p, n))); }
    sections.push({ name: 'IV. Produce the requested form', pts: 1, specs: fm });
    sections.push({ name: 'V. Conjugate in the imperfect (3 points)', pts: 3, specs: [gSpec(gConj(pickOne(cv).id, 'all', 'impf'))] });
    sections.push({ name: 'VI. Grammar question', pts: 1, specs: [gSpec(makeSkillCard('casefn', pick, stage))] });
    const P = pools3(), tr = []; for (let i = 0; i < 2; i++) tr.push(gSpec(gDobj(randomSpec3(pick, P, 0.6))));
    sections.push({ name: 'VII. Translating (2 points each)', pts: 2, specs: tr });
    if (covers === 'grammar') sections.shift();
    const specs = []; sections.forEach((s, si) => s.specs.forEach(sp => specs.push({ ...sp, sec: si, pts: s.pts })));
    return { mode: 'mock', kind: covers, title: covers === 'grammar' ? `Grammar mock quiz · Stage ${stage}` : `Mock quiz · Stage ${stage}`, test: true, stage, sections: sections.map(s => ({ name: s.name })), specs };
  }
  if (stage >= 5) { // Stage 5 quiz: decline (with ablative), case/number/gender, phrases both ways, grammar questions, translating
    const nouns5 = shuffle(PL_NOUNS.filter(w => isOn(w) && w.stage <= stage));
    sections.push({ name: 'II. Decline the nouns', pts: 1, specs: nouns5.slice(0, 3).map((w, i) => ({ t: 'g', type: 'decline5', params: [w.id, i % 2 ? 'pl' : 'sg', 'abl'], skill: 'case' })) });
    sections.push({ name: 'III. Case, number and gender', pts: 1, specs: nouns5.slice(3, 7).map((w, i) => ({ t: 'g', type: 'case5', params: [w.id, Math.random() < 0.5 ? 'sg' : 'pl', ['abl', 'acc', 'abl', 'nom'][i]], skill: 'case' })) });
    const pl = []; for (let i = 0; i < 4; i++) pl.push(gSpec(makeSkillCard('ppl2e', pick, stage)));
    sections.push({ name: 'IV. Prepositional phrases into English', pts: 1, specs: pl });
    const pe = []; for (let i = 0; i < 3; i++) pe.push(gSpec(makeSkillCard('ppe2l', pick, stage)));
    sections.push({ name: 'V. Prepositional phrases into Latin', pts: 1, specs: pe });
    const cf = []; while (cf.length < 2) cf.push(gSpec(makeSkillCard('casefn', pick, stage)));
    sections.push({ name: 'VI. Grammar questions', pts: 1, specs: cf });
    const P = pools3(), tr = []; for (let i = 0; i < 2; i++) tr.push(gSpec(gDobj(randomSpec3(pick, P, 0.6))));
    sections.push({ name: 'VII. Translating (2 points each)', pts: 2, specs: tr });
    if (covers === 'grammar') sections.shift();
    const specs = []; sections.forEach((s, si) => s.specs.forEach(sp => specs.push({ ...sp, sec: si, pts: s.pts })));
    return { mode: 'mock', kind: covers, title: covers === 'grammar' ? `Grammar mock quiz · Stage ${stage}` : `Mock quiz · Stage ${stage}`, test: true, stage, sections: sections.map(s => ({ name: s.name })), specs };
  }
  if (stage >= 4) { // Stage 4 quiz: translate verbs, conjugate, person/number + case questions, translating (30 points with vocab, 20 without)
    const vt = []; for (let i = 0; i < 5; i++) vt.push(gSpec(makeSkillCard('vtrans', pick, stage)));
    sections.push({ name: 'II. Translate the verbs', pts: 1, specs: vt });
    sections.push({ name: 'III. Conjugate (3 points)', pts: 3, specs: [gSpec(makeSkillCard('conj', pick, stage))].map(sp => sp.params[1] === 'which' ? { ...sp, params: [sp.params[0], 'all'], type: 'conj' } : sp) });
    const cf = []; while (cf.length < 4) cf.push(gSpec(makeSkillCard('casefn', pick, stage)));
    sections.push({ name: 'IV. Grammar questions', pts: 1, specs: cf });
    const P = pools3(), tr = []; for (let i = 0; i < 4; i++) tr.push(gSpec(gDobj(randomSpec3(pick, P, i < 2 ? 0.8 : 0.3))));
    sections.push({ name: 'V. Translating (2 points each)', pts: 2, specs: tr });
    if (covers === 'grammar') sections.shift();
    const specs = []; sections.forEach((s, si) => s.specs.forEach(sp => specs.push({ ...sp, sec: si, pts: s.pts })));
    return { mode: 'mock', kind: covers, title: covers === 'grammar' ? `Grammar mock quiz · Stage ${stage}` : `Mock quiz · Stage ${stage}`, test: true, stage, sections: sections.map(s => ({ name: s.name })), specs };
  }
  if (stage >= 3) { // Stage 3 quiz: decline, case & function, charts, translate (30 points with vocab, 20 without)
    const nouns3 = shuffle(PL_NOUNS.filter(w => isOn(w) && w.stage <= stage)).slice(0, 4);
    sections.push({ name: 'II. Decline the nouns', pts: 1, specs: nouns3.map((w, i) => ({ t: 'g', type: 'decline', params: [w.id, i % 2 ? 'pl' : 'sg', i < 2 ? 'acc' : (Math.random() < 0.5 ? 'acc' : 'nom')], skill: 'case' })) });
    const cf = []; while (cf.length < 4) cf.push(gSpec(makeSkillCard('casefn', pick, stage)));
    sections.push({ name: 'III. Case and function', pts: 1, specs: cf });
    sections.push({ name: 'IV. Charts', pts: 1, specs: CHARTS.filter(c => c.stage === 3).map(c => ({ t: 'g', type: 'chart', params: [c.id], skill: 'charts' })) });
    const P = pools3(), tr = []; for (let i = 0; i < 5; i++) tr.push(gSpec(gDobj(randomSpec3(pick, P, i < 2 ? 0.8 : 0.3))));
    sections.push({ name: 'V. Translating (2 points each)', pts: 2, specs: tr });
    if (covers === 'grammar') sections.shift();
    const specs = []; sections.forEach((s, si) => s.specs.forEach(sp => specs.push({ ...sp, sec: si, pts: s.pts })));
    return { mode: 'mock', kind: covers, title: covers === 'grammar' ? `Grammar mock quiz · Stage ${stage}` : `Mock quiz · Stage ${stage}`, test: true, stage, sections: sections.map(s => ({ name: s.name })), specs };
  }
  if (stage >= 2) {
    const fx = [];
    for (let i = 0; i < 1; i++) {
      const spec = randomSentenceSpec(pick, PL_NOUNS.filter(w => isOn(w) && w.stage <= stage), COMP_ADJS.filter(w => isOn(w) && w.stage <= stage && w.phrase), PERSONS.filter(w => isOn(w) && w.stage <= stage), true);
      const err = spec.k === 'adj' ? pickOne(['verb', 'adj-g', 'adj-n']) : 'verb';
      fx.push({ t: 'g', type: 'fixsent', params: [spec, err], skill: 'fixsent' }, { t: 'g', type: 'trans', params: [spec], skill: 'trans', afterFix: true });
    }
    { // one two-part sentence, like the class worksheets
      const sp2 = randomSpec2(pick, poolsFor(stage), false);
      fx.push({ t: 'g', type: 'fix2', params: [sp2, pickOne(fix2Errors(sp2))], skill: 'fixsent' }, { t: 'g', type: 'trans2', params: [sp2], skill: 'trans', afterFix: true });
    }
    sections.push({ name: 'II. Fix the error (correct it, then translate it)', pts: 1, specs: fx });
  } else {
    const fx = []; for (let i = 0; i < 4; i++) fx.push(gSpec(makeSkillCard('fixphrase', pick, stage)));
    sections.push({ name: 'II. Fix the phrase', pts: 1, specs: fx });
  }
  const nouns = shuffle(PL_NOUNS.filter(w => isOn(w) && w.stage <= stage));
  const trapFirst = nouns.filter(w => w.trap).slice(0, 1).concat(nouns.filter(w => !w.trap)).slice(0, 4);
  sections.push({ name: 'III. Noun identification', pts: 1.5, specs: trapFirst.map(w => ({ t: 'g', type: 'nid', params: [w.id, Math.random() < 0.5 ? 'sg' : 'pl'], skill: 'nid' })) });
  sections.push({ name: 'IV. Charts', pts: 1, specs: CHARTS.filter(c => stageOn(c.stage) && c.stage <= stage).map(c => ({ t: 'g', type: 'chart', params: [c.id], skill: 'charts' })) });
  const tr = []; for (let i = 0; i < 5; i++) tr.push(gSpec(makeSkillCard(stage >= 2 ? 'trans' : 'phrase', pick, stage)));
  sections.push({ name: 'V. Translating', pts: 1, specs: tr });
  if (covers === 'grammar') sections.shift(); // grammar quiz: no vocab section
  const specs = []; sections.forEach((s, si) => s.specs.forEach(sp => specs.push({ ...sp, sec: si, pts: s.pts })));
  return { mode: 'mock', kind: covers, title: covers === 'grammar' ? `Grammar mock quiz · Stage ${stage}` : `Mock quiz · Stage ${stage}`, test: true, stage, sections: sections.map(s => ({ name: s.name })), specs };
}
