// Builds practice sessions as lists of small, saveable "specs", and turns specs back into cards.
import { WORDS, W, MAX_STAGE } from './data.js';
import { vocabL2E, vocabE2L, vocabAlso, gNID, gChart, gAgree, gPhrase, gFixPhrase, gVnum, gSV, gComp, gRole, gTrans, gFixSent,
  makeSkillCard, SKILLS, SKILL, CHARTS, shuffle, pickOne, PL_NOUNS, randomSentenceSpec, PHRASE_ADJS, PERSONS, NOUNS, COMP_ADJS } from './gen.js';
import { wordStatus, skillAcc, quizWords, quizSkills, isMasteryDay } from './srs.js';

const BUILD = { nid: gNID, chart: gChart, agree: gAgree, phrase: gPhrase, fixphrase: gFixPhrase, vnum: gVnum, sv: gSV, comp: gComp, role: gRole, trans: gTrans, fixsent: gFixSent };
export function cardFromSpec(sp) {
  let c;
  if (sp.t === 'l2e') c = vocabL2E(W[sp.id]);
  else if (sp.t === 'e2l') c = (sp.id === 'etiam' || sp.id === 'quoque') ? vocabAlso() : vocabE2L(W[sp.id]);
  else if (sp.t === 'also') c = vocabAlso();
  else c = BUILD[sp.type](...sp.params);
  c.spec = sp; return c;
}
const gSpec = card => ({ t: 'g', type: card.type, params: card.params, skill: card.skill });
export const vocabSpec = (id, dir) => ({ t: dir, id, cid: 'w:' + id });

// Prefer words that haven't shown up in a while (vocab or grammar), so examples cover the whole bank.
export function makePicker(state) {
  const age = id => { const w = state.words[id]; if (!w) return -1e9; return Math.max(w.ctx ?? -1e9, w.last ?? -1e9); };
  return list => { if (!list.length) return undefined; const s = list.slice().sort((a, b) => age(a.id) - age(b.id)); const k = Math.max(2, Math.ceil(s.length / 3)); return pickOne(s.slice(0, k)); };
}
export const stageOf = settings => Math.min(MAX_STAGE, (settings && settings.currentStage) || MAX_STAGE);
function dirFor(ws) { if (!ws || ws.lvl <= 1) return 'l2e'; return Math.random() < 0.5 ? 'l2e' : 'e2l'; }
function skillCards(state, settings, n, stageCap, focusStage) {
  const pick = makePicker(state);
  const skills = SKILLS.filter(s => s.stage <= stageCap);
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
  const bank = WORDS.filter(w => w.stage <= stage);
  const due = bank.filter(w => state.words[w.id] && state.words[w.id].seen && state.words[w.id].due <= today)
    .sort((a, b) => state.words[a.id].due - state.words[b.id].due || state.words[a.id].lvl - state.words[b.id].lvl);
  const picked = due.slice(0, 16);
  const unseen = bank.filter(w => !state.words[w.id] || !state.words[w.id].seen).sort((a, b) => b.stage - a.stage);
  const newOnes = shuffle(unseen.filter(w => w.stage === stage)).concat(shuffle(unseen.filter(w => w.stage !== stage))).slice(0, Math.max(0, Math.min(8, 20 - picked.length)));
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
  const bank = WORDS.filter(w => w.stage <= stage);
  const known = shuffle(bank.filter(w => ['known', 'mastered', 'slipped'].includes(wordStatus(state.words[w.id]))));
  const others = shuffle(bank.filter(w => !known.includes(w)));
  const list = known.concat(others).slice(0, 30);
  return { mode: 'mastery', title: 'Mastery Check', test: true, counts: true,
    specs: shuffle(list.map(w => vocabSpec(w.id, Math.random() < 0.5 ? 'l2e' : 'e2l'))) };
}
export function buildQuizPrep(state, settings, today, quiz) {
  const winStart = quiz.day - 4;
  const qw = quizWords(quiz.stage); // this unit's words: must all be confirmed
  const unconf = qw.filter(w => { const ws = state.words[w.id]; return !(ws && ws.confirmed != null && ws.confirmed >= winStart && ws.lastOk); });
  const due = WORDS.filter(w => w.stage <= quiz.stage && !unconf.includes(w) && state.words[w.id] && state.words[w.id].seen && state.words[w.id].due <= today); // older words stay in review
  const vocab = shuffle(unconf).slice(0, 22).concat(shuffle(due).slice(0, Math.max(0, 22 - unconf.length)));
  const vspecs = vocab.map(w => vocabSpec(w.id, Math.random() < 0.5 ? 'l2e' : 'e2l'));
  const g = skillCards(state, settings, 6, quiz.stage, quiz.stage);
  return { mode: 'quizprep', title: 'Quiz prep', specs: interleave(vspecs, g), counts: true };
}

/* ---------- Vocab page ---------- */
export function buildReview(state, settings, today) {
  const stage = stageOf(settings);
  const due = WORDS.filter(w => w.stage <= stage && state.words[w.id] && state.words[w.id].seen && state.words[w.id].due <= today)
    .sort((a, b) => state.words[a.id].due - state.words[b.id].due).slice(0, 25);
  return { mode: 'review', title: 'Vocab review', specs: due.map(w => vocabSpec(w.id, dirFor(state.words[w.id]))) };
}
export function buildUnit(stage) { const s = buildLearn(stage); return { ...s, mode: 'unit', title: `Unit ${stage} vocab` }; }
export function buildLearn(stage) {
  const ws = WORDS.filter(w => w.stage === stage);
  const a = shuffle(ws).map(w => vocabSpec(w.id, 'l2e'));
  const b = shuffle(ws.filter(w => w.id !== 'quoque')).map(w => vocabSpec(w.id, 'e2l'));
  return { mode: 'learn', title: `Learn Stage ${stage}`, specs: a.concat(b) };
}
export function troubleWords(state, settings) {
  const stage = stageOf(settings);
  return WORDS.filter(w => w.stage <= stage).filter(w => { const s = state.words[w.id]; return s && s.seen && (s.slipped != null || (s.wrong >= 2 && s.lvl <= 3) || (s.wrong >= 1 && s.lvl <= 1)); })
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
  if (sp.t === 'l2e') return { ...vocabSpec(sp.id, 'e2l'), follow: true };
  if (sp.t === 'e2l' || sp.t === 'also') return { ...vocabSpec(sp.t === 'also' ? pickOne(['etiam', 'quoque']) : sp.id, 'l2e'), follow: true };
  const c = makeSkillCard(sp.skill || sp.type, makePicker(state), stageOf(settings));
  return { ...gSpec(c), follow: true };
}

/* ---------- Test Prep ---------- */
export function buildTestRun(state, settings, stage) {
  const pick = makePicker(state);
  const bank = WORDS.filter(w => w.stage <= stage);
  const shaky = bank.filter(w => { const s = state.words[w.id]; return s && s.seen && (s.lvl <= 2 || s.slipped != null); });
  const vocabPool = shuffle(shaky).concat(shuffle(bank.filter(w => !shaky.includes(w))));
  const specs = vocabPool.slice(0, 6).map(w => vocabSpec(w.id, Math.random() < 0.5 ? 'l2e' : 'e2l'));
  const skills = SKILLS.filter(s => s.stage <= stage).sort((a, b) => (skillAcc(state, a.id) ?? 0) - (skillAcc(state, b.id) ?? 0)).slice(0, 4);
  skills.forEach(s => specs.push(gSpec(makeSkillCard(s.id, pick, stage))));
  return { mode: 'testrun', title: 'Test Run', test: true, specs: shuffle(specs) };
}
// Mock quiz in the teacher's format, scored out of 30.
export function buildMock(state, settings, stage) {
  const pick = makePicker(state);
  // Vocab section: this unit's words only (like the real test). Grammar sections below use every word so far.
  const cur = shuffle(WORDS.filter(w => w.stage === stage && w.kind !== 'x'));
  const misc = shuffle(WORDS.filter(w => w.stage === stage && w.kind === 'x'));
  const vocab = cur.slice(0, 8).concat(misc.slice(0, 2));
  const sections = [];
  sections.push({ name: 'I. Vocabulary', pts: 1, specs: shuffle(vocab).map(w => vocabSpec(w.id, 'l2e')) });
  if (stage >= 2) {
    const fx = [];
    for (let i = 0; i < 2; i++) {
      const spec = randomSentenceSpec(pick, PL_NOUNS.filter(w => w.stage <= stage), COMP_ADJS.filter(w => w.stage <= stage && w.phrase), PERSONS.filter(w => w.stage <= stage), true);
      const err = spec.k === 'adj' ? pickOne(['verb', 'adj-g', 'adj-n']) : 'verb';
      fx.push({ t: 'g', type: 'fixsent', params: [spec, err], skill: 'fixsent' }, { t: 'g', type: 'trans', params: [spec], skill: 'trans', afterFix: true });
    }
    sections.push({ name: 'II. Fix the error (correct it, then translate it)', pts: 1, specs: fx });
  } else {
    const fx = []; for (let i = 0; i < 4; i++) fx.push(gSpec(makeSkillCard('fixphrase', pick, stage)));
    sections.push({ name: 'II. Fix the phrase', pts: 1, specs: fx });
  }
  const nouns = shuffle(PL_NOUNS.filter(w => w.stage <= stage));
  const trapFirst = nouns.filter(w => w.trap).slice(0, 1).concat(nouns.filter(w => !w.trap)).slice(0, 4);
  sections.push({ name: 'III. Noun identification', pts: 1.5, specs: trapFirst.map(w => ({ t: 'g', type: 'nid', params: [w.id, Math.random() < 0.5 ? 'sg' : 'pl'], skill: 'nid' })) });
  sections.push({ name: 'IV. Charts', pts: 1, specs: CHARTS.filter(c => c.stage <= stage).map(c => ({ t: 'g', type: 'chart', params: [c.id], skill: 'charts' })) });
  const tr = []; for (let i = 0; i < 5; i++) tr.push(gSpec(makeSkillCard(stage >= 2 ? 'trans' : 'phrase', pick, stage)));
  sections.push({ name: 'V. Translating', pts: 1, specs: tr });
  const specs = []; sections.forEach((s, si) => s.specs.forEach(sp => specs.push({ ...sp, sec: si, pts: s.pts })));
  return { mode: 'mock', title: `Mock quiz · Stage ${stage}`, test: true, stage, sections: sections.map(s => ({ name: s.name })), specs };
}
