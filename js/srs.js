// Scheduling, streaks, ranks and the test-readiness light. Pure functions.
import { WORDS, W } from './data.js';
import { SKILLS } from './gen.js';

const DAY = 86400000;
// A "day" runs 3am to 3am local time, so a late practice after a night game still counts.
export function dayNum(d = new Date()) {
  const t = new Date(d.getTime() - 3 * 3600000);
  return Math.floor(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / DAY);
}
export const dayFromISO = iso => { const [y, m, d] = iso.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / DAY); };
export const isoFromDay = n => new Date(n * DAY).toISOString().slice(0, 10);

/* ---------- word levels ---------- */
export const INTERVALS = [0, 1, 2, 4, 8, 16];
export const MAX_LVL = 5;
export function wordStatus(ws) {
  if (!ws || !ws.seen) return 'new';
  if (ws.slipped != null) return 'slipped';
  if (ws.lvl >= 5) return 'mastered';
  if (ws.lvl >= 3) return 'known';
  return 'learning';
}
export const STATUS_LABEL = { new: 'New', learning: 'Learning', known: 'Known', mastered: 'Mastered', slipped: 'Slipped' };
export function blankState() {
  return { v: 1, words: {}, skills: {}, streak: { count: 0, best: 0, last: null, rest: 0, ranks: [] }, practiceDays: 0, lastMastery: null, mocks: [], log: [] };
}
export function updateWord(state, id, ok, today) {
  const ws = state.words[id] || (state.words[id] = { lvl: 0, due: today, seen: 0, right: 0, wrong: 0, last: null, first: today, slipped: null, confirmed: null, lastOk: null });
  ws.seen++; ws.last = today; ws.lastOk = ok;
  if (ok) {
    ws.lvl = Math.min(MAX_LVL, ws.lvl + 1); ws.right++; ws.confirmed = today;
    ws.due = today + INTERVALS[ws.lvl];
    if (ws.slipped != null && ws.lvl >= 3) ws.slipped = null;
  } else {
    if (ws.lvl >= 4) ws.slipped = today;
    ws.lvl = 1; ws.wrong++; ws.due = today + 1;
  }
}
export function touchWords(state, ids, today) { // seen in a grammar context (for variety), no level change
  ids.forEach(id => { if (state.words[id]) state.words[id].ctx = today; else state.words[id] = { lvl: 0, due: today, seen: 0, right: 0, wrong: 0, last: null, first: null, slipped: null, confirmed: null, lastOk: null, ctx: today }; });
}
export function updateSkill(state, id, ok, today) {
  const s = state.skills[id] || (state.skills[id] = { hist: [], last: null, n: 0 });
  s.hist.push(ok ? 1 : 0); if (s.hist.length > 20) s.hist.shift(); s.last = today; s.n++;
}
export function skillAcc(state, id) {
  const s = state.skills[id]; if (!s || !s.hist.length) return null;
  const h = s.hist.slice(-10); return h.reduce((a, b) => a + b, 0) / h.length;
}
export function skillStatus(state, id) {
  const s = state.skills[id], acc = skillAcc(state, id);
  if (acc == null) return { label: 'Not started', level: 'none', acc: null };
  if (s.hist.length < 5) return { label: 'Warming up', level: 'mid', acc };
  if (acc >= 0.85) return { label: 'Strong', level: 'good', acc };
  if (acc >= 0.7) return { label: 'Almost', level: 'mid', acc };
  return { label: 'Needs work', level: 'bad', acc };
}

/* ---------- streak ---------- */
export const RANKS = [
  [5, 'Tīrō', 'recruit'], [10, 'Mīles', 'soldier'], [25, 'Signifer', 'standard-bearer'], [50, 'Centuriō', 'centurion'],
  [75, 'Tribūnus', 'tribune'], [100, 'Lēgātus', 'general'], [150, 'Imperātor', 'commander'], [200, 'Cōnsul', 'consul'], [250, 'Caesar', 'Caesar'],
];
export function milestones(upTo) {
  const out = RANKS.map(r => ({ days: r[0], latin: r[1], en: r[2] }));
  for (let d = 300; d <= Math.max(300, upTo + 50); d += 50) out.push({ days: d, latin: 'Caesar', en: `${d}-day Caesar` });
  return out;
}
export function rankFor(count) { let r = null; for (const m of milestones(count)) if (count >= m.days) r = m; return r; }
export function nextMilestone(count) { return milestones(count).find(m => m.days > count); }
// What the streak looks like right now (without changing it).
export function streakView(st, today) {
  const s = st.streak; if (s.last == null) return { count: 0, done: false, atRisk: false, rest: s.rest };
  if (s.last === today) return { count: s.count, done: true, atRisk: false, rest: s.rest };
  const gap = today - s.last - 1; // full days missed
  if (gap === 0) return { count: s.count, done: false, atRisk: true, rest: s.rest };
  if (gap <= s.rest) return { count: s.count, done: false, atRisk: true, rest: s.rest, restNeeded: gap };
  return { count: 0, done: false, atRisk: false, rest: 0, broken: s.count };
}
// Call when Today's practice is finished. Returns {count, usedRest, earnedRest, newRank}.
export function completeDay(st, today) {
  const s = st.streak; const out = { usedRest: 0, earnedRest: false, newRank: null };
  if (s.last === today) { out.count = s.count; return out; }
  if (s.last == null) s.count = 1;
  else {
    const gap = today - s.last - 1;
    if (gap <= 0) s.count += 1;
    else if (gap <= s.rest) { s.rest -= gap; out.usedRest = gap; s.count += 1; }
    else { s.count = 1; s.rest = 0; }
  }
  s.last = today; s.best = Math.max(s.best, s.count);
  if (s.count % 7 === 0 && s.rest < 2) { s.rest += 1; out.earnedRest = true; }
  const m = milestones(s.count).find(m => m.days === s.count);
  if (m) { out.newRank = m; s.ranks.push({ days: m.days, day: today }); }
  st.practiceDays = (st.practiceDays || 0) + 1;
  out.count = s.count; return out;
}

/* ---------- quizzes and the readiness light ---------- */
export function nextQuiz(settings, today) {
  const qs = ((settings && settings.quizzes) || []).filter(q => q.date && dayFromISO(q.date) >= today).sort((a, b) => a.date.localeCompare(b.date));
  if (!qs.length) return null;
  const q = qs[0]; return { ...q, day: dayFromISO(q.date), daysLeft: dayFromISO(q.date) - today };
}
export const quizWords = stage => WORDS.filter(w => w.stage <= stage);
export const quizSkills = stage => SKILLS.filter(s => s.stage <= stage);
export function readiness(st, quiz, today, nowMs = Date.now()) {
  if (!quiz || quiz.daysLeft > 4 || quiz.daysLeft < 0) return null;
  const winStart = quiz.day - 4;
  const qw = quizWords(quiz.stage);
  const confirmed = qw.filter(w => { const ws = st.words[w.id]; return ws && ws.confirmed != null && ws.confirmed >= winStart && ws.lastOk; });
  const vocabPct = confirmed.length / qw.length;
  const skills = quizSkills(quiz.stage).map(s => ({ ...s, acc: skillAcc(st, s.id), n: (st.skills[s.id] || { hist: [] }).hist.length }));
  const skillOk = sk => sk.n >= 5 && sk.acc >= 0.85, skillNear = sk => sk.n >= 3 && sk.acc >= 0.7;
  const mocks = (st.mocks || []).filter(m => m.stage === quiz.stage && m.day >= winStart);
  const recent = mocks.filter(m => nowMs - m.at <= 48 * 3600000);
  const bestRecent = recent.length ? Math.max(...recent.map(m => m.score)) : null;
  const bestWin = mocks.length ? Math.max(...mocks.map(m => m.score)) : null;
  const reasons = [];
  if (vocabPct < 1) reasons.push(`${qw.length - confirmed.length} words not confirmed yet`);
  const weak = skills.filter(s => !skillOk(s));
  if (weak.length) reasons.push(`Grammar to bring up to 85%: ${weak.map(s => s.name).join(', ')}`);
  if (bestRecent == null || bestRecent < 27) reasons.push(bestRecent == null ? (bestWin == null ? 'No mock quiz yet' : `Take a fresh mock quiz (last one was over 2 days ago)`) : `Mock quiz ${Math.round(bestRecent * 10) / 10}/30 (need 27)`);
  let color = 'red';
  if (vocabPct === 1 && !weak.length && bestRecent != null && bestRecent >= 27) color = 'green';
  else if (vocabPct >= 0.85 && skills.every(skillNear) && bestWin != null && bestWin >= 24) color = 'yellow';
  return { color, reasons, vocabPct, confirmed: confirmed.length, total: qw.length, skills, bestRecent, bestWin, unconfirmed: qw.filter(w => !confirmed.includes(w)).map(w => w.id) };
}
export const isMasteryDay = st => ((st.practiceDays || 0) + 1) % 10 === 0;
