import { auth, db, doc, setDoc, onSnapshot, onAuthStateChanged, signInWithEmailAndPassword, signOut } from './firebase.js';
import { STUDENT_UID, PARENT_UID, APP_VERSION } from './config.js';
import { WORDS, W, STAGES, MAX_STAGE, STAGE_NAMES, setUnits, unitsOf, isOn, inUnit, stageOn, curUnit } from './data.js';
import { SKILLS, SKILL } from './gen.js';
import { cardFromSpec, buildDaily, buildReview, buildLearn, buildUnit, buildTrouble, troubleWords, buildSkill, buildTestRun, buildMock, buildMastery, followUp, stageOf } from './session.js';
import { dayNum, isoFromDay, dayFromISO, blankState, updateWord, updateSkill, touchWords, completeDay, streakView, rankFor, nextMilestone, milestones,
  nextQuiz, readiness, isMasteryDay, quizCovers, mockPct, mockKind, wordStatus, STATUS_LABEL, skillStatus, skillAcc } from './srs.js';

/* ---------- tiny DOM helper ---------- */
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) { if (k == null || k === false) continue; e.append(k.nodeType ? k : document.createTextNode(String(k))); }
  return e;
};
const app = document.getElementById('app');
const show = (...nodes) => { app.replaceChildren(...nodes.flat().filter(n => n != null && n !== false)); window.scrollTo(0, 0); };
const fmtDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const pct = x => Math.round(x * 100) + '%';

/* ---------- connection banner ---------- */
const net = document.getElementById('net');
const setNet = () => { net.hidden = navigator.onLine; };
window.addEventListener('online', setNet); window.addEventListener('offline', setNet); setNet();

/* ---------- data ---------- */
let user = null, role = null, S = null, settings = {}, unsubs = [], run = null, loadedOnce = false, saveErr = null;
let studentDoc = () => doc(db, 'students', STUDENT_UID);
const settingsDoc = () => doc(db, 'settings', 'app');
let saveTimer = null;
// Every change stamps updatedAt right away; the write follows shortly (or immediately on flush).
function save(now = false) {
  S.updatedAt = Date.now();
  clearTimeout(saveTimer);
  if (now) return flush();
  saveTimer = setTimeout(flush, 500);
}
function flush() {
  clearTimeout(saveTimer); saveTimer = null;
  if (!S || !user) return;
  setDoc(studentDoc(), JSON.parse(JSON.stringify(S))).then(() => { saveErr = null; }).catch(e => { saveErr = e; console.error(e); showSaveError(); });
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer) flush(); });
window.addEventListener('pagehide', () => { if (saveTimer) flush(); });
function showSaveError() {
  if (document.getElementById('saveerr')) return;
  app.prepend(h('p', { class: 'err', id: 'saveerr' }, 'Progress isn\'t saving: ', saveErr && saveErr.code === 'permission-denied' ? 'the database rules are blocking it. Ask Mom to check the Firestore rules.' : 'it will retry when you\'re back online.'));
}
const runKey = () => 'latin-run-' + (user && user.uid);
const saveRun = () => { try { if (run) localStorage.setItem(runKey(), JSON.stringify(run)); else localStorage.removeItem(runKey()); } catch (e) {} };
const loadRun = () => { try { return JSON.parse(localStorage.getItem(runKey()) || 'null'); } catch (e) { return null; } };

onAuthStateChanged(auth, u => {
  unsubs.forEach(f => f()); unsubs = []; user = u; S = null; loadedOnce = false;
  if (!u) { role = null; return renderLogin(); }
  role = u.uid === PARENT_UID ? 'parent' : u.uid === STUDENT_UID ? 'student' : 'other';
  if (role === 'other') return show(h('section', { class: 'card' }, h('h2', { text: 'This account isn\'t set up for Latin Practice.' }), h('button', { class: 'ghost', onclick: () => signOut(auth) }, 'Sign out')));
  unsubs.push(onSnapshot(settingsDoc(), snap => { settings = snap.exists() ? snap.data() : {}; setUnits(unitsOf(settings)); if (loadedOnce && !run) route(); }, e => console.error(e)));
  unsubs.push(onSnapshot(studentDoc(), snap => {
    if (run) return; // don't disturb an answer in progress
    const incoming = snap.exists() ? snap.data() : null;
    if (S && incoming && (incoming.updatedAt || 0) < (S.updatedAt || 0)) return; // an older copy; ours is newer
    if (S && saveTimer) return; // a local change is about to be written
    S = incoming ? Object.assign(blankState(), incoming) : blankState();
    if (!loadedOnce) { loadedOnce = true; route(); } else if (!run) route();
  }, e => { console.error(e); show(h('section', { class: 'card' }, h('h2', { text: 'Can\'t load progress' }), h('p', { class: 'muted', text: e.code === 'permission-denied' ? 'The database rules are blocking this account. Check that the Firestore rules were published.' : 'Check the connection and reload.' }), h('p', { class: 'small muted', text: `v${APP_VERSION} · signed in as …${u.uid.slice(0, 4)} · looking for …${STUDENT_UID.slice(0, 4)}` }), h('button', { class: 'ghost', onclick: () => signOut(auth) }, 'Sign out'))); }));
});

/* ---------- routing ---------- */
let page = 'home', preview = false;
function go(p) { if (p === 'preview') { preview = true; p = 'home'; } if (p === 'parent') { preview = false; p = 'home'; } page = p; route(); }
function route() {
  if (!S) return;
  if (role === 'parent' && !preview) return renderParent();
  if (run) return renderRun();
  ({ home: renderHome, vocab: renderVocab, grammar: renderGrammar, prep: renderPrep, browse: renderBrowse }[page] || renderHome)();
}

/* ---------- login ---------- */
function renderLogin() {
  const email = h('input', { type: 'email', id: 'email', autocomplete: 'username', autocapitalize: 'off', placeholder: 'Email' });
  const pw = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', placeholder: 'Password' });
  const err = h('p', { class: 'err', hidden: true });
  const btn = h('button', { class: 'main', type: 'submit' }, 'Sign in');
  const form = h('form', { class: 'card', onsubmit: async e => {
    e.preventDefault(); btn.disabled = true; err.hidden = true;
    try { await signInWithEmailAndPassword(auth, email.value.trim(), pw.value); }
    catch (x) { err.hidden = false; err.textContent = x.code === 'auth/network-request-failed' ? 'No connection. Sign in once with signal; after that it works offline.' : 'That email or password didn\'t work.'; btn.disabled = false; }
  } }, h('div', { class: 'eyebrow', text: 'Latin Practice' }), h('h1', { text: 'Salvē!' }), h('label', { class: 'f' }, 'Email', email), h('label', { class: 'f' }, 'Password', pw), err, btn);
  show(form);
}

/* ---------- student home ---------- */
const today = () => dayNum();
function streakCard() {
  const t = today(), v = streakView(S, t, settings), rk = rankFor(v.count), nx = nextMilestone(v.count);
  const reward = nx && settings.rewards && settings.rewards[nx.days];
  const prev = rk ? rk.days : 0, frac = nx ? (v.count - prev) / (nx.days - prev) : 1;
  return h('section', { class: 'card' },
    h('div', { class: 'streak' },
      h('div', { class: 'flame' }, h('big', { text: v.count }), h('small', { text: v.count === 1 ? 'day' : 'days' })),
      h('div', {}, rk ? h('div', { class: 'rank' }, rk.latin, ' ', h('em', { text: rk.en })) : h('div', { class: 'rank' }, 'Streak')),
      h('div', { class: 'small muted' }, v.done ? 'Done today ✓' : v.off ? `${v.off === 'Day off' ? 'Day off' : v.off}: your streak is safe today. Practice if you want.` : v.restNeeded ? `Practice today: a rest day covers the missed day.` : v.atRisk ? 'Practice today to keep it going.' : v.broken ? `Streak reset (was ${v.broken}). Start a new one today.` : 'Finish Today\'s practice to start a streak.')),
    nx ? h('div', {}, h('div', { class: 'spread small' }, h('span', {}, `${nx.days - v.count} to `, h('b', { text: nx.latin }), reward ? ` → ${reward}` : ''), h('span', { class: 'muted' }, 'Rest days ', h('span', { class: 'rest' }, h('i', { class: v.rest >= 1 ? 'on' : '' }), h('i', { class: v.rest >= 2 ? 'on' : '' })))),
      h('div', { class: 'meter', style: 'margin-top:6px' }, h('i', { style: `width:${Math.max(4, Math.round(frac * 100))}%` }))) : null);
}
const qName = q => `Stage ${q.stage} ${({ vocab: 'vocab ', grammar: 'grammar ' })[quizCovers(q)] || ''}quiz`;
const mockLine = m => `${fmt1(m.score)}/${m.of || 30}`;
const mockPill = m => (mockPct(m) >= 0.9 ? 'good' : mockPct(m) >= 0.8 ? 'mid' : 'bad');
const mockLabel = m => `${mockKind(m) === 'vocab' ? 'Vocab' : mockKind(m) === 'grammar' ? 'Grammar' : 'Full'} · Stage ${m.stage} · ${fmtDate(isoFromDay(m.day))}`;
function lightCard(q, rd, compact) {
  const color = rd.color;
  return h('section', { class: 'card' },
    h('div', { class: 'light' },
      h('div', { class: 'lamp', role: 'img', 'aria-label': `Readiness: ${color}` }, h('i', { class: 'r' + (color === 'red' ? ' on' : '') }), h('i', { class: 'y' + (color === 'yellow' ? ' on' : '') }), h('i', { class: 'g' + (color === 'green' ? ' on' : '') })),
      h('div', {}, h('div', { class: 'eyebrow', text: `${qName(q)} · ${fmtDate(q.date)} · ${q.daysLeft === 0 ? 'today' : q.daysLeft === 1 ? 'tomorrow' : q.daysLeft + ' days'}` }),
        h('h2', { text: color === 'green' ? 'Ready.' : color === 'yellow' ? 'Almost ready.' : 'Not ready yet.' }),
        rd.reasons.length ? h('ul', {}, rd.reasons.map(r => h('li', { text: r }))) : h('p', { class: 'small muted', text: 'Keep it green: one more mock the day before.' }))),
    compact ? h('button', { class: 'ghost', onclick: () => go('prep') }, 'Go to Test Prep') : null);
}
function renderHome() {
  const t = today(), q = nextQuiz(settings, t), rd = q ? readiness(S, q, t) : null, v = streakView(S, t, settings);
  const saved = loadRun();
  const name = settings.name || '';
  const cov = q ? quizCovers(q) : 'both';
  const daily = q && q.daysLeft <= 4 ? (cov === 'vocab' ? 'Vocab quiz prep' : cov === 'grammar' ? 'Grammar quiz prep' : 'Quiz prep') : isMasteryDay(S) ? 'Mastery Check' : "Today's practice";
  const dueN = WORDS.filter(w => isOn(w) && S.words[w.id] && S.words[w.id].seen && S.words[w.id].due <= t).length;
  const shaky = troubleWords(S, settings).length;
  const weak = SKILLS.filter(s => stageOn(s.stage) && skillStatus(S, s.id).level !== 'good').length;
  show(
    h('div', { class: 'top' }, h('h1', { text: `Salvē${name ? ', ' + name : ''}!` }), role === 'parent' ? h('button', { class: 'back', onclick: () => go('parent') }, 'Parent view') : null),
    preview ? h('p', { class: 'chip gold', text: 'Preview of Burke\'s home' }) : null,
    rd ? lightCard(q, rd, true) : q ? h('p', { class: 'small muted', text: `Next: ${qName(q)} ${fmtDate(q.date)} · ${q.daysLeft} days. Test-readiness light turns on 4 days before.` }) : null,
    saved && saved.uid === user.uid ? h('button', { class: 'btn hero', onclick: () => { run = saved; renderRun(); } }, h('b', { text: 'Resume ' + saved.sess.title }), h('span', { text: `Question ${saved.idx + 1} of ${saved.deck.length}` })) : null,
    v.done ? h('button', { class: 'btn done', onclick: () => start(buildDaily(S, settings, t, q)) }, h('b', { text: `${daily} done ✓` }), h('span', { text: 'Want more? Run another round (streak already counted).' }))
      : h('button', { class: 'btn hero', onclick: () => start(buildDaily(S, settings, t, q)) }, h('b', { text: `Start ${daily.toLowerCase().replace("today's", "today's")}` }),
        h('span', { text: daily === 'Mastery Check' ? 'Every 10th day: a no-hints check of your whole word bank · about 10 min' : daily === 'Vocab quiz prep' ? `Unit ${q.stage} words only, no grammar · about 10 min` : daily === 'Grammar quiz prep' ? 'Weak grammar first + a few review words · about 12 min' : daily === 'Quiz prep' ? 'Unconfirmed quiz words + weak grammar · about 12 min' : 'About 25 cards · 10–12 min' })),
    (() => { const st = stageOf(settings), n = WORDS.filter(w => inUnit(w, st)).length; return h('button', { class: 'btn', onclick: () => start(buildUnit(st)) }, h('b', { text: `Unit ${st} vocab review` }), h('span', { text: v.done ? `All ${n} Unit ${st} words · streak already counted today` : `All ${n} Unit ${st} words · finishing it counts for today's streak` })); })(),
    streakCard(),
    h('div', { class: 'tiles' },
      h('button', { class: 'tile', onclick: () => go('vocab') }, h('b', { text: 'Vocab' }), h('span', { text: `${dueN} due · ${shaky} shaky` })),
      h('button', { class: 'tile', onclick: () => go('grammar') }, h('b', { text: 'Grammar' }), h('span', { text: q && cov === 'vocab' && q.daysLeft <= 4 ? 'After Friday' : `${weak} need work` })),
      h('button', { class: 'tile', onclick: () => go('prep') }, h('b', { text: 'Test Prep' }), h('span', { text: q ? (q.daysLeft === 0 ? 'Quiz today' : `Quiz in ${q.daysLeft}d`) : 'Mock quiz' }))),
    h('div', { class: 'row', style: 'justify-content:center' }, role === 'parent' ? null : h('button', { class: 'linkbtn', onclick: () => signOut(auth) }, 'Sign out'), h('span', { class: 'small muted', text: 'v' + APP_VERSION })));
}

/* ---------- vocab ---------- */
function backBar(title) { return h('div', { class: 'top' }, h('button', { class: 'back', onclick: () => go('home') }, '‹ Home'), h('span', { class: 'eyebrow', text: title })); }
function statusCounts(stageMax) {
  const c = { new: 0, learning: 0, known: 0, mastered: 0, slipped: 0 };
  WORDS.filter(w => isOn(w)).forEach(w => c[wordStatus(S.words[w.id])]++); return c;
}
function renderVocab() {
  const t = today(), st = stageOf(settings);
  const due = buildReview(S, settings, t).specs.length, trouble = troubleWords(S, settings).length, c = statusCounts(st);
  show(backBar('Vocab'), h('h1', { text: 'Vocab' }),
    h('section', { class: 'card' }, h('div', { class: 'statgrid' }, ['mastered', 'known', 'learning', 'slipped', 'new'].map(k => h('div', { class: 'stat' }, h('b', { text: c[k] }), h('span', { text: STATUS_LABEL[k] }))))),
    h('button', { class: 'btn', disabled: !due, onclick: () => start(buildReview(S, settings, t)) }, h('b', { text: 'Review' }), h('span', { text: due ? `${due} words due` : 'Nothing due right now' })),
    STAGES.filter(stageOn).slice().reverse().map(s => h('button', { class: 'btn', onclick: () => start(buildLearn(s)) }, h('b', { text: `Learn Stage ${s}` }), h('span', { text: `All ${WORDS.filter(w => inUnit(w, s)).length} words, both directions` }))),
    h('button', { class: 'btn', disabled: !trouble, onclick: () => start(buildTrouble(S, settings)) }, h('b', { text: 'Trouble words' }), h('span', { text: trouble ? `${trouble} words you keep missing` : 'None right now' })),
    h('button', { class: 'btn', onclick: () => go('browse') }, h('b', { text: 'Browse all words' }), h('span', { text: 'Every word with its status' })));
}
function renderBrowse() {
  show(h('div', { class: 'top' }, h('button', { class: 'back', onclick: () => go('vocab') }, '‹ Vocab'), h('span', { class: 'eyebrow', text: 'All words' })),
    h('div', { class: 'legend' }, ['mastered', 'known', 'learning', 'slipped', 'new'].map(k => h('span', {}, h('i', { class: 'dot ' + k }), STATUS_LABEL[k]))),
    STAGES.filter(stageOn).slice().reverse().map(s => h('section', { class: 'card' }, h('h2', { text: `Stage ${s}` }),
      h('ul', { class: 'list' }, WORDS.filter(w => inUnit(w, s)).map(w => { const k = wordStatus(S.words[w.id]); return h('li', {}, h('i', { class: 'dot ' + k, title: STATUS_LABEL[k] }), h('div', {}, h('b', { text: w.kind === 'v' ? `${w.lemma}/${w.pair}` : w.kind === 'x' ? w.lemma : w.entry }), ': ', w.show)); })))));
}

/* ---------- grammar ---------- */
function renderGrammar() {
  const st = stageOf(settings);
  show(backBar('Grammar'), h('h1', { text: 'Grammar' }),
    STAGES.filter(s => stageOn(s) && SKILLS.some(k => k.stage === s)).slice().reverse().map(s => h('section', { class: 'card' }, h('h2', { text: STAGE_NAMES[s] || `Stage ${s}` }),
      SKILLS.filter(k => k.stage === s).map(k => { const ss = skillStatus(S, k.id); return h('button', { class: 'skill', onclick: () => start(buildSkill(S, settings, k.id)) },
        h('div', { class: 'spread' }, h('b', { text: k.name }), h('span', { class: 'pill ' + ss.level, text: ss.acc == null ? ss.label : `${ss.label} · ${pct(ss.acc)}` })),
        h('span', { class: 'small muted', text: k.desc })); }))));
}

/* ---------- test prep ---------- */
function renderPrep() {
  const t = today(), q = nextQuiz(settings, t), rd = q ? readiness(S, q, t) : null, stage = q ? q.stage : stageOf(settings), cov = q ? quizCovers(q) : 'both';
  const mocks = (S.mocks || []).slice().reverse().slice(0, 8);
  show(backBar('Test Prep'), h('h1', { text: 'Test Prep' }),
    rd ? lightCard(q, rd, false) : h('p', { class: 'muted', text: q ? `${qName(q)} ${fmtDate(q.date)}. The readiness light turns on 4 days before.` : 'No quiz date set yet. Mom adds it when it shows up in Google Classroom.' }),
    cov === 'vocab' ? h('button', { class: 'btn hero', onclick: () => start(buildMock(S, settings, stage, 'vocab')) }, h('b', { text: `Vocab mock quiz · Unit ${stage}` }), h('span', { text: '15 of this unit\'s words: meaning + middle stuff. No grammar. ~6 min' }))
      : cov === 'grammar' ? h('button', { class: 'btn hero', onclick: () => start(buildMock(S, settings, stage, 'grammar')) }, h('b', { text: `Grammar mock quiz · Stage ${stage}` }), h('span', { text: 'Her format without the vocab section, out of 20. ~12 min' }))
      : h('button', { class: 'btn hero', onclick: () => start(buildMock(S, settings, stage)) }, h('b', { text: `Mock quiz · Stage ${stage}` }), h('span', { text: 'Her format, scored out of 30. Feedback at the end. ~15 min' })),
    h('button', { class: 'btn', onclick: () => start(buildTestRun(S, settings, stage, cov)) }, h('b', { text: cov === 'vocab' ? 'Vocab Test Run' : cov === 'grammar' ? 'Grammar Test Run' : 'Test Run' }), h('span', { text: '10 quick questions, no help, leans on what you miss' })),
    mocks.length ? h('section', { class: 'card' }, h('h2', { text: 'Mock quiz history' }), h('ul', { class: 'list' }, mocks.map(m => h('li', {}, h('span', { class: 'pill ' + mockPill(m), text: mockLine(m) }), h('div', { text: mockLabel(m) }))))) : null);
}
const fmt1 = x => (Math.round(x * 2) / 2).toString();

/* ---------- running a session ---------- */
function start(sess) {
  if (!sess.specs.length) return;
  run = { uid: user.uid, sess: { ...sess, specs: undefined }, deck: sess.specs.map(s => JSON.parse(JSON.stringify(s))), idx: 0, results: [], firstRight: 0, firstTotal: sess.specs.length, follows: {} };
  saveRun(); renderRun();
}
let cur = null, lastSubmit = 0;
if (new URLSearchParams(location.search).has('debug')) window.__latin = { cur: () => cur, state: () => S, run: () => run };
function renderRun() {
  if (run.idx >= run.deck.length) return finishRun();
  const sp = run.deck[run.idx]; const c = cardFromSpec(sp); cur = c; c.mode = 'answer';
  const test = run.sess.test;
  const ahead = run.deck.slice(run.idx + 1).filter(d => d.follow).length;
  const chipText = sp.follow ? 'Coming back · asked a new way' : test ? (run.sess.mode === 'mock' ? run.sess.sections[sp.sec].name : run.sess.title) : run.sess.title;
  const autoGo = () => { if (!test && c.fields.every(f => f.choices) && inputs.every(x => x.readOnly || x.value)) goFn(); };
  const inputs = c.fields.map((f, i) => f.choices ? choiceGroup(f, i, autoGo) : h('input', { type: 'text', id: 'f' + i, autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: i < c.fields.length - 1 ? 'next' : 'go', placeholder: f.ph || '' }));
  c.inputs = inputs;
  const p = c.prompt;
  const promptEl = p.latin ? h('div', {}, h('p', { class: 'latin' + (p.latin.length > 45 ? ' xs' : p.latin.length > 22 ? ' sm' : '') , text: p.latin }), p.sub ? h('div', { class: 'sub', text: p.sub }) : null, p.help && p.help.length ? h('div', { class: 'help' }, h('b', { text: 'Help: ' }), p.help.join(' · ')) : null)
    : p.eng ? h('p', { class: 'eng', text: p.eng }) : p.chart ? h('p', { class: 'latin sm', text: p.chart }) : null;
  const fb = h('div', { hidden: true });
  const btn = h('button', { class: 'main', id: 'go' }, test ? (run.idx === run.deck.length - 1 ? 'Finish' : 'Submit') : 'Check');
  const quit = h('button', { class: 'linkbtn', onclick: () => confirmQuit() }, 'Exit');
  show(
    h('div', { class: 'prog' }, h('div', { class: 'spread small muted' }, h('span', { text: `${run.idx + 1} of ${run.deck.length}${ahead ? ` · ${ahead} coming back` : ''}` }), quit), h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(100 * run.idx / run.deck.length)}%` }))),
    h('section', { class: 'card' },
      h('div', { class: 'row' }, h('span', { class: 'chip' + (sp.follow ? ' back' : ''), text: chipText }), c.stage ? h('span', { class: 'eyebrow', text: `Stage ${c.stage}` }) : null),
      c.instr ? h('p', { class: 'instr', text: c.instr }) : null, promptEl,
      h('div', { class: 'fields' + (c.fields.length === 3 ? ' three' : c.fields.length === 2 ? ' two' : '') }, c.fields.map((f, i) => h(f.choices ? 'div' : 'label', { class: 'f' }, f.label, inputs[i]))),
      fb, h('div', { class: 'actions' }, btn)));
  const goFn = () => {
    if (Date.now() - lastSubmit < 250) return;
    if (test) return submitTest(c);
    if (c.mode === 'answer') submitPractice(c, fb, btn); else if (c.mode === 'retype') retype(c, fb, btn); else if (c.mode === 'done') nextCard();
  };
  btn.onclick = goFn;
  inputs.forEach((el, i) => el.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return; e.preventDefault();
    const nextEmpty = inputs.findIndex((x, j) => j > i && !x.readOnly && !x.value.trim());
    if (nextEmpty >= 0 && c.mode !== 'done') inputs[nextEmpty].focus(); else goFn();
  }));
  setTimeout(() => (inputs.find(x => x.tagName === 'INPUT') || inputs[0]).focus(), 30);
}
// Tap buttons instead of typing. Acts like an <input> (value, readOnly, focus) so checking works the same.
function choiceGroup(f, i, onPick) {
  let sel = '', ro = false;
  const long = f.choices.some(x => x.length > 14);
  // 4 medium-length choices (currere, lupos…) sit in a 2×2 grid so words never break mid-word
  const grid = !long && (f.choices.length >= 4 ? f.choices.some(x => x.length > 5) : f.choices.length === 3 && f.choices.some(x => x.length > 8));
  const box = h('div', { class: 'choices' + (long ? ' long' : grid ? ' grid' : ''), id: 'f' + i, role: 'group' });
  const btns = f.choices.map(x => h('button', { type: 'button', class: 'opt', text: x, onclick: () => { if (ro) return; box.value = x; box.classList.remove('bad'); onPick(); } }));
  box.append(...btns);
  Object.defineProperty(box, 'value', { get: () => sel, set: v => { sel = v; btns.forEach(b => b.classList.toggle('sel', b.textContent === sel)); } });
  Object.defineProperty(box, 'readOnly', { get: () => ro, set: v => { ro = !!v; btns.forEach(b => (b.disabled = ro)); } });
  box.focus = () => {}; box.select = () => {};
  return box;
}
function confirmQuit() {
  show(h('section', { class: 'card' }, h('h2', { text: 'Stop for now?' }), h('p', { class: 'muted', text: run.sess.counts ? 'Answers so far are saved. Today only counts for your streak when you finish, so you can resume from the home screen.' : 'Answers so far are saved. You can resume from the home screen.' }),
    h('div', { class: 'actions' }, h('button', { class: 'main', onclick: () => { run = null; go('home'); } }, 'Stop for now'), h('button', { class: 'ghost', onclick: () => renderRun() }, 'Keep going'))));
}
const vals = c => c.inputs.map(i => i.value);
function record(sp, c, r) {
  const t = today(), ok = r.ok.every(Boolean), frac = r.ok.filter(Boolean).length / r.ok.length;
  if (c.skill) { updateSkill(S, c.skill, ok, t); touchWords(S, c.words, t); }
  else if (!sp.follow) c.words.forEach(id => updateWord(S, id, ok, t));
  if (!sp.follow) { run.firstRight += ok ? 1 : 0; }
  run.results.push({ summary: c.summary, ok, frac, ans: vals(c).filter(x => x.trim()).join(' / '), correct: c.correct, sec: sp.sec, pts: sp.pts, follow: !!sp.follow, cid: c.cid });
  save();
  return ok;
}
function submitPractice(c, fb, btn) {
  const v = vals(c); if (v.every(x => !x.trim())) { c.inputs[0].focus(); return; }
  lastSubmit = Date.now();
  const sp = run.deck[run.idx], r = c.check(v), ok = record(sp, c, r);
  c.inputs.forEach((el, i) => { el.classList.toggle('ok', !!r.ok[i]); el.classList.toggle('bad', !r.ok[i]); el.readOnly = true; });
  feedback(fb, ok, r, c);
  if (!ok) {
    const key = c.cid + ':' + (sp.t === 'g' ? run.idx : '');
    const nF = run.follows[c.cid] || 0;
    if (nF < 2) { run.follows[c.cid] = nF + 1; const f = followUp(sp, S, settings); const pos = run.idx + 1 + 5 + Math.floor(Math.random() * 4); if (pos >= run.deck.length) run.deck.push(f); else run.deck.splice(pos, 0, f); }
    const wrong = r.ok.map((x, i) => (x ? -1 : i)).filter(i => i >= 0);
    c.mode = 'retype'; c.wrong = wrong; c.tries = 1;
    wrong.forEach(i => { const el = c.inputs[i]; el.readOnly = false; el.value = ''; el.classList.remove('bad'); el.placeholder = 'type the correct answer'; });
    if (wrong.every(i => c.fields[i].choices)) fb.querySelector('.retype-msg')?.replaceChildren('Tap the right answer to keep going.');
    btn.textContent = 'Check'; c.inputs[wrong[0]].focus();
  } else { c.mode = 'done'; btn.textContent = 'Next'; setTimeout(() => btn.focus(), 0); }
  saveRun();
}
function retype(c, fb, btn) {
  if (c.wrong.some(i => !c.inputs[i].value.trim())) { c.inputs[c.wrong.find(i => !c.inputs[i].value.trim())].focus(); return; }
  lastSubmit = Date.now(); const r = c.check(vals(c)); let all = true;
  c.wrong.forEach(i => { const ok = !!r.ok[i]; c.inputs[i].classList.toggle('ok', ok); c.inputs[i].classList.toggle('bad', !ok); if (!ok) all = false; });
  c.tries = (c.tries || 1) + 1;
  if (!all && c.tries >= 3) return reveal(c, fb, btn, r);
  if (all) { c.mode = 'done'; c.inputs.forEach(i => (i.readOnly = true)); btn.textContent = 'Next'; setTimeout(() => btn.focus(), 0); }
  else { const f = c.wrong.find(i => !r.ok[i]); c.inputs[f].focus(); c.inputs[f].select(); }
}
// Three misses on the same card: stop, show the answer, move on. (It's already queued to come back later.)
function reveal(c, fb, btn, r) {
  c.wrong.filter(i => !r.ok[i]).forEach(i => {
    const el = c.inputs[i], f = c.fields[i];
    let ans = c.answers && c.answers[i];
    if (!ans && f.choices) ans = f.choices.find(x => { const v = vals(c); v[i] = x; return c.check(v).ok[i]; });
    if (ans != null) el.value = ans;
    el.classList.remove('bad'); el.classList.add('shown');
  });
  c.mode = 'done'; c.inputs.forEach(i => (i.readOnly = true));
  fb.className = 'fb shown';
  fb.replaceChildren(h('h3', { text: "Here's the answer" }), h('p', { class: 'ans' }, h('b', { text: c.correct })),
    c.hook ? h('p', { class: 'hook', text: 'Memory hook: ' + c.hook }) : null,
    h('p', { class: 'small muted', text: "No worries. This one will come back later so you can get it." }));
  btn.textContent = 'Next'; setTimeout(() => btn.focus(), 0); saveRun();
}
function feedback(fb, ok, r, c) {
  const kids = [h('h3', { text: ok ? 'Correct' : 'Not quite' })];
  if (!ok) { kids.push(h('p', { class: 'ans' }, 'Answer: ', h('b', { text: c.correct })));
    if (c.answers) r.ok.forEach((x, i) => { if (!x && c.fields[i] && !c.fields[i].choices) kids.push(h('p', {}, `${c.fields[i].label}: `, h('b', { text: c.answers[i] }))); }); r.hints.forEach(x => kids.push(h('p', { text: x }))); if (c.hook) kids.push(h('p', { class: 'hook', text: 'Memory hook: ' + c.hook })); if (!ok) kids.push(h('p', { class: 'small muted retype-msg', text: 'Type the right answer to keep going.' })); }
  r.notes.forEach(x => kids.push(h('p', { class: 'small muted', text: x })));
  fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'bad'); fb.replaceChildren(...kids);
}
function nextCard() { run.idx++; saveRun(); renderRun(); }
function submitTest(c) {
  const v = vals(c); if (v.every(x => !x.trim())) { c.inputs[0].focus(); return; }
  lastSubmit = Date.now();
  record(run.deck[run.idx], c, c.check(v));
  run.idx++; saveRun(); renderRun();
}
function finishRun() {
  const r = run; run = null; saveRun();
  const t = today(); let celebrate = null, extra = [];
  if (r.sess.mode === 'mock') {
    const earned = r.results.reduce((a, x) => a + (x.pts || 1) * x.frac, 0), possible = r.results.reduce((a, x) => a + (x.pts || 1), 0);
    const of = Math.round(possible), score = Math.round((earned / possible) * of * 2) / 2;
    S.mocks = (S.mocks || []).concat([{ stage: r.sess.stage, day: t, at: Date.now(), score, of, kind: r.sess.kind || 'both' }]).slice(-40);
    extra.push(h('p', { class: 'big', text: `${fmt1(score)} / ${of}` }));
  }
  if (r.sess.counts) {
    const before = S.streak.last === t;
    const out = completeDay(S, t, settings);
    if (!before) { if (out.newRank) celebrate = out.newRank; if (out.earnedRest) extra.push(h('p', { class: 'small', text: 'You earned a rest day (7 days in a row). A missed day won\'t break your streak.' })); if (out.usedRest) extra.push(h('p', { class: 'small muted', text: `A rest day covered ${out.usedRest} missed day${out.usedRest > 1 ? 's' : ''}.` })); }
  }
  S.log = (S.log || []).concat([{ day: t, at: Date.now(), mode: r.sess.mode, n: r.firstTotal, right: r.firstRight }]).slice(-150);
  save(true);
  const missed = r.results.filter(x => !x.ok && !x.follow);
  const pctRight = r.firstTotal ? Math.round(100 * r.firstRight / r.firstTotal) : 0;
  const reward = celebrate && settings.rewards && settings.rewards[celebrate.days];
  show(
    celebrate ? h('section', { class: 'card celebrate' }, h('span', { class: 'chip gold', text: `${celebrate.days}-day streak` }), h('div', { class: 'rank', text: celebrate.latin }), h('p', { class: 'muted', text: `You're now a ${celebrate.en}.` }), reward ? h('p', {}, 'Reward: ', h('b', { text: reward })) : null) : null,
    h('section', { class: 'card' }, h('span', { class: 'chip', text: `${r.sess.title} done` }),
      r.sess.mode === 'mock' ? null : h('div', {}, h('p', { class: 'eyebrow', text: 'First try' }), h('p', { class: 'big', text: `${r.firstRight} / ${r.firstTotal}` }), h('p', { class: 'small muted', text: pctRight + '%' })),
      extra,
      missed.length ? h('div', {}, h('h2', { text: r.sess.test ? 'Missed' : 'Missed the first time' }), h('ul', { class: 'list' }, missed.map(x => h('li', {}, h('span', { class: 'pill bad', text: 'Missed' }), h('div', {}, h('div', { text: x.summary }), h('div', { class: 'small muted' }, r.sess.test ? `You wrote: ${x.ans || '(blank)'} · ` : '', 'Answer: ', h('b', { text: x.correct }))))))) : h('p', { text: 'No misses.' }),
      h('div', { class: 'actions' }, h('button', { class: 'main', onclick: () => go('home') }, 'Home'))));
}

/* ---------- parent ---------- */
function renderParent() {
  const t = today(), v = streakView(S, t, settings), rk = rankFor(v.count), q = nextQuiz(settings, t), rd = q ? readiness(S, q, t) : null;
  const log = S.log || [];
  const practicedDays = new Set(log.filter(l => ['daily', 'mastery', 'quizprep', 'unit'].includes(l.mode)).map(l => l.day));
  const c = statusCounts(MAX_STAGE);
  const slipped = WORDS.filter(w => isOn(w) && wordStatus(S.words[w.id]) === 'slipped');
  const trouble = troubleWords(S, settings).filter(w => !slipped.includes(w));
  const lastLog = log[log.length - 1];
  show(
    h('div', { class: 'top' }, h('h1', { text: 'Parent view' }), h('button', { class: 'linkbtn', onclick: () => signOut(auth) }, 'Sign out')),
    h('section', { class: 'card' },
      h('div', { class: 'spread' }, h('h2', { text: v.done ? 'Practiced today ✓' : 'Not practiced yet today' }), h('span', { class: 'pill ' + (v.done ? 'good' : 'mid'), text: `${v.count}-day streak` })),
      h('p', { class: 'small muted', text: `${rk ? `Rank: ${rk.latin} (${rk.en}). ` : ''}Best streak ${S.streak.best}. Rest days saved: ${v.rest}. ${lastLog ? `Last session ${fmtDate(isoFromDay(lastLog.day))}: ${lastLog.right}/${lastLog.n} first try.` : 'No sessions yet.'}` }),
      h('div', {}, h('div', { class: 'eyebrow', text: 'Last 21 days' }), h('div', { class: 'days', style: 'margin-top:6px' }, Array.from({ length: 21 }, (_, i) => t - 20 + i).map(d => h('i', { class: practicedDays.has(d) ? 'on' : '', title: isoFromDay(d) }))))),
    rd ? lightCard(q, rd, false) : h('p', { class: 'small muted', text: q ? `Next: ${qName(q)}, ${fmtDate(q.date)} (${q.daysLeft} days). Light turns on 4 days before.` : 'No quiz date set. Add one below.' }),
    h('section', { class: 'card' }, h('h2', { text: 'Words' }),
      h('div', { class: 'statgrid' }, ['mastered', 'known', 'learning', 'slipped', 'new'].map(k => h('div', { class: 'stat' }, h('b', { text: c[k] }), h('span', { text: STATUS_LABEL[k] })))),
      slipped.length ? h('div', {}, h('div', { class: 'eyebrow', text: 'Slipped (used to know)' }), h('p', { text: slipped.map(w => w.lemma).join(', ') })) : null,
      trouble.length ? h('div', {}, h('div', { class: 'eyebrow', text: 'Shaky' }), h('p', { text: trouble.map(w => w.lemma).join(', ') })) : null),
    h('section', { class: 'card' }, h('h2', { text: 'Grammar' }), h('ul', { class: 'list' }, SKILLS.filter(k => stageOn(k.stage)).map(k => { const ss = skillStatus(S, k.id); return h('li', {}, h('span', { class: 'pill ' + ss.level, text: ss.acc == null ? '—' : pct(ss.acc) }), h('div', { text: `Stage ${k.stage} · ${k.name}` })); }))),
    (S.mocks || []).length ? h('section', { class: 'card' }, h('h2', { text: 'Mock quizzes' }), h('ul', { class: 'list' }, S.mocks.slice().reverse().slice(0, 10).map(m => h('li', {}, h('span', { class: 'pill ' + mockPill(m), text: mockLine(m) }), h('div', { text: mockLabel(m) }))))) : null,
    settingsCard(),
    h('section', { class: 'card' }, h('h2', { text: 'Backup' }), h('p', { class: 'small muted', text: 'Saves a copy of all progress to this device. Once a month is plenty.' }),
      h('button', { class: 'ghost', onclick: download }, 'Download progress')),
    h('button', { class: 'btn', onclick: () => go('preview') }, h('b', { text: 'See Burke\'s home screen' }), h('span', { text: 'Anything you practice here counts as his.' })),
    h('p', { class: 'small muted center', text: 'v' + APP_VERSION }));
}
function settingsCard() {
  const s = JSON.parse(JSON.stringify(settings || {}));
  s.quizzes = s.quizzes || []; s.rewards = s.rewards || {};
  const name = h('input', { type: 'text', id: 'set-name', value: s.name || '', placeholder: 'Burke' });
  const on = unitsOf(s);
  const unitBoxes = STAGES.map(x => ({ x, el: h('input', { type: 'checkbox', id: 'unit-' + x, checked: on.includes(x) }) }));
  const qDate = h('input', { type: 'date', id: 'q-date' });
  const qStage = h('select', { id: 'q-stage' }, STAGES.map(x => h('option', { value: x, selected: x === curUnit() }, `Stage ${x}`)));
  const COV = [['vocab', 'Vocab only'], ['grammar', 'Grammar only'], ['both', 'Vocab + grammar']];
  const covSel = (val, id) => h('select', { id }, COV.map(([v, l]) => h('option', { value: v, selected: v === val }, l)));
  const qCov = covSel('vocab', 'q-cov');
  const msg = h('p', { class: 'small muted', hidden: true });
  const rewardInputs = milestones(0).slice(0, 9).map(m => ({ m, el: h('input', { type: 'text', id: 'rw-' + m.days, value: s.rewards[m.days] || '', placeholder: 'e.g. pick Friday dinner' }) }));
  const persist = async () => {
    s.name = name.value.trim();
    const picked = unitBoxes.filter(u => u.el.checked).map(u => u.x); s.units = picked.length ? picked : [1]; s.currentStage = Math.max(...s.units); setUnits(s.units);
    rewardInputs.forEach(({ m, el }) => { const v = el.value.trim(); if (v) s.rewards[m.days] = v; else delete s.rewards[m.days]; });
    try { await setDoc(settingsDoc(), s); msg.hidden = false; msg.textContent = 'Saved.'; } catch (e) { msg.hidden = false; msg.textContent = 'Couldn\'t save: ' + (e.code || e.message); }
  };
  return h('section', { class: 'card' }, h('h2', { text: 'Settings' }),
    h('label', { class: 'f' }, 'His name (shown on his home screen)', name),
    h('div', {}, h('div', { class: 'eyebrow', text: 'Units he has done or is doing' }), h('p', { class: 'small muted', text: 'Only ticked units show up in his practice. The highest ticked unit is his current unit (Unit vocab button and vocab mock quiz).' }),
      h('div', { class: 'checks' }, unitBoxes.map(({ x, el }) => h('label', { class: 'check' }, el, h('span', { text: STAGE_NAMES[x] || `Stage ${x}` }))))),
    h('div', {}, h('div', { class: 'eyebrow', text: 'Quiz dates' }),
      s.quizzes.length ? h('ul', { class: 'list' }, s.quizzes.slice().sort((a, b) => a.date.localeCompare(b.date)).map(q => h('li', {}, h('div', {}, h('div', { text: `Stage ${q.stage} · ${fmtDate(q.date)}` }), (() => { const sel = covSel(quizCovers(q)); sel.style.marginTop = '4px'; sel.onchange = () => { q.covers = sel.value; settings = s; persist().then(route); }; return sel; })()), h('button', { class: 'linkbtn', onclick: () => { s.quizzes = s.quizzes.filter(x => x !== q); settings = s; persist().then(route); } }, 'Remove')))) : h('p', { class: 'small muted', text: 'None yet.' }),
      h('div', { class: 'fields', style: 'margin-top:8px' }, h('label', { class: 'f' }, 'Date', qDate), h('label', { class: 'f' }, 'Stage', qStage), h('label', { class: 'f' }, 'Type', qCov)),
      h('button', { class: 'ghost', style: 'margin-top:8px', onclick: () => { if (!qDate.value) return; s.quizzes.push({ date: qDate.value, stage: Number(qStage.value), covers: qCov.value }); settings = s; persist().then(route); } }, 'Add quiz date')),
    h('div', {}, h('div', { class: 'eyebrow', text: 'Days off' }), h('p', { class: 'small muted', text: 'Federal holidays and March 5 don\'t count against his streak. He can still practice on them.' })),
    h('div', {}, h('div', { class: 'eyebrow', text: 'Streak rewards' }), h('div', { class: 'fields' }, rewardInputs.map(({ m, el }) => h('label', { class: 'f' }, `${m.days} days · ${m.latin}`, el)))),
    h('div', { class: 'actions' }, h('button', { class: 'main', onclick: () => persist() }, 'Save settings')), msg);
}
function download() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), settings, progress: S }, null, 1)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `latin-progress-${isoFromDay(today())}.json` }); document.body.append(a); a.click(); a.remove();
}
