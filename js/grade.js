// Answer checking. Pure functions, no DOM, so every answer can be tested in node.
import { WORDS, W, fold, letters } from './data.js';

export const normT = s => fold(s).toLowerCase().replace(/[^a-z0-9]/g, '');
export const normEn = s => {
  let t = fold(s).toLowerCase().replace(/[’']/g, "'").replace(/[()?!.;:"]/g, ' ').replace(/[^a-z\s\/,']/g, ' ').replace(/\s+/g, ' ').trim();
  return t.replace(/^(a|an|the|to be) /, '');
};
const sortW = s => s.split(' ').filter(Boolean).sort().join(' ');
export const lev = (a, b) => {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => { const r = new Array(n + 1).fill(0); r[0] = i; return r; });
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[m][n];
};
export const G = g => (g === 'f' ? 'feminine' : 'masculine');
/* ---------- generous English spelling (Burke has dysgraphia: grade the meaning, not the spelling) ---------- */
// Compare sounds-alike-ish: letters only, doubled letters collapsed (hapy = happy, tierd = tired).
export const phon = s => (s || '').toLowerCase().replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
const thr = n => (n <= 3 ? 1 : n <= 6 ? 2 : 3);
// Every English word the app uses as an answer, plus plurals. A typed word that IS one of these is never
// treated as a misspelling of a different word (man is not a misspelling of bad).
export const EN_TOKENS = new Set();
const addTok = s => normEn(s).split(/[\s\/,]+/).filter(Boolean).forEach(t => EN_TOKENS.add(t));
WORDS.forEach(w => { w.mean.forEach(addTok); addTok(w.show); (w.enPl || []).forEach(addTok); (w.wrongNum || []).forEach(addTok); if (w.base) addTok(w.base); if (w.prog) addTok(w.prog); });
['is', 'are', 'not', 'and', 'he', 'she', 'it', 'they', 'women', 'men', 'girls', 'boys', 'but', 'does', 'do', 'in', 'who', 'walk', 'walks', 'walking', 'fields', 'house', 'i', 'we', 'you', 'all', 'am', 'him', 'her', 'them', 'guys', 'yall', 'because', 'wolves'].forEach(t => EN_TOKENS.add(t));
// Small grammar words carry number/meaning, so they must be right (doubled letters forgiven).
const FUNC = new Set(['is', 'are', 'not', 'and', 'he', 'she', 'it', 'they', 'but', 'does', 'do', 'in', 'who', 'i', 'we', 'you', 'all', 'am', 'him', 'her', 'them', 'because']);
// Is typed word x close enough to target t? Ties go to the target; a closer (or exact) other word wins.
// Consonant skeleton, for sound-alike spellings (rode = road, grate = great, rites = writes).
export const sKey = s => {
  const t = (s || '').toLowerCase().replace(/[^a-z]/g, '').replace(/^wr/, 'r').replace(/^kn/, 'n').replace(/ph/g, 'f').replace(/ck/g, 'k')
    .replace(/gh/g, '').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/z/g, 's').replace(/(.)\1+/g, '$1');
  return t.charAt(0) + t.slice(1).replace(/[aeiouy]/g, '');
};
export function closeWord(x, t, contrast = []) {
  if (x === t || phon(x) === phon(t)) return true;
  const px = phon(x), pt = phon(t); if (!px) return false;
  if (EN_TOKENS.has(x)) return false;
  const d = lev(px, pt);
  const k = sKey(x);
  if (pt.length >= 3 && k.length >= 2 && k === sKey(t) && !contrast.some(c => c !== t && sKey(c) === k && lev(px, phon(c)) < d)) return true;
  if (d > thr(pt.length)) return false;
  for (const c of contrast) if (c !== t && lev(px, phon(c)) < d) return false;
  return true;
}
// Token-by-token match of a typed English answer against accepted answers (already normalised).
// contrast: answers that must NOT be accepted (e.g. the other number), used to keep girl vs girls strict.
export function fuzzyEn(input, accepted, contrast = []) {
  const it = input.split(' ').filter(Boolean); if (!it.length) return null;
  const cts = contrast.map(c => c.split(' '));
  outer: for (const a of accepted) {
    const at = a.split(' '); if (at.length !== it.length) continue;
    for (let i = 0; i < at.length; i++) {
      const x = it[i], t = at[i];
      if (x === t) continue;
      if (at.length > 1 && (FUNC.has(t) || FUNC.has(x))) { if (phon(x) === phon(t)) continue; continue outer; }
      const local = cts.filter(c => c.length === at.length).map(c => c[i]).filter(c => c !== t);
      if (!closeWord(x, t, local.concat([...EN_TOKENS].filter(e => Math.abs(e.length - t.length) <= 3)))) continue outer;
    }
    return a;
  }
  return null;
}

const OK = { ok: true };

/* lookups */
export const BYL = {};
WORDS.forEach(w => { BYL[letters(w.lemma)] = w; if (w.forms && w.kind === 'x') w.forms.forEach(f => (BYL[letters(f)] = w)); });
export const REV = {};
WORDS.forEach(w => w.mean.forEach(m => { const k = normEn(m); if (!REV[k]) REV[k] = w.lemma; }));
export const NF = {}; // noun form -> {id, num}
WORDS.filter(w => w.kind === 'n').forEach(w => { NF[letters(w.lemma)] = { id: w.id, num: 'sg' }; if (w.pl) NF[letters(w.pl)] = { id: w.id, num: 'pl' }; });
export const AF = {}; // adjective form -> {id, g, num}
WORDS.filter(w => w.kind === 'a').forEach(w => { for (const g of ['m', 'f']) for (const num of ['sg', 'pl']) { const k = letters(w.forms[g][num]); if (!AF[k]) AF[k] = { id: w.id, g, num }; } });

/* ---------- vocabulary ---------- */
export function gradeMiddle(v, w) {
  const raw = letters(v); if (!raw) return { ok: false };
  const lw = letters(w.lemma);
  const cands = [raw]; if (raw.length > lw.length && raw.startsWith(lw)) cands.push(raw.slice(lw.length));
  if (w.mid) { if (cands.some(n => w.mid.includes(n))) return OK; return { ok: false, hint: `${w.lemma} is plural only. Its middle stuff is ${w.midShow}.` }; }
  if (w.kind === 'a') {
    if (w.restOk) {
      const full = letters(w.rest);
      if (cands.some(n => n === full || w.restOk.includes(n))) return OK;
      if (cands.some(n => n.length >= 5 && lev(phon(n), phon(full)) <= 2)) return { ok: true, note: `Spelled: ${w.rest}` };
      return { ok: false, hint: `The entry is ${w.entry}. Type the middle stuff: ${w.rest}.` };
    }
    if (w.rest) {
      // alter, altera, alterum: accept the full forms, the short pattern (-a -um, since alter + a = altera), or -era -erum.
      const full = letters(w.rest), ok = [full, 'aum', 'eraerum', 'usaum'];
      if (cands.some(n => ok.includes(n))) return OK;
      if (cands.some(n => n.length >= 6 && lev(phon(n), phon(full)) <= 3)) return { ok: true, note: `Spelled: ${w.rest}` };
      return { ok: false, hint: `alter follows the -a -um pattern: alter, altera, alterum. Type -a -um.` };
    }
    if (cands.some(n => n === 'aum' || n === 'usaum')) return OK;
    const n = cands[cands.length - 1];
    if (/^(i|ae)?[mf]?$/.test(n) || /^[mf](i|ae)$/.test(n)) return { ok: false, hint: `${w.lemma} is an adjective. Adjectives don't have just one gender, so the middle stuff is -a -um, not -ī m.` };
    return { ok: false, hint: 'Adjective middle stuff is always -a -um.' };
  }
  const genD = w.gen === 'i' ? 'ī' : 'ae', trapNote = w.trap ? ` Watch out: ${w.lemma} is 1st declension but MASCULINE.` : '';
  for (const n of cands) if (n === w.gen + w.g || n === w.g + w.gen) return w.trap ? { ok: true, note: `Right. ${w.lemma} is one of the masculine 1st declension nouns (agricola, nauta, poeta).` } : OK;
  const n = cands[cands.length - 1];
  if (n === 'aum') return { ok: false, hint: `${w.lemma} is a noun, not an adjective. A noun has one gender, so its middle stuff is -${genD} ${w.g}.${trapNote}` };
  let gp = null, gn = n;
  if (/[mf]$/.test(n)) { gp = n.slice(-1); gn = n.slice(0, -1); } else if (/^[mf]/.test(n)) { gp = n[0]; gn = n.slice(1); }
  const msg = [];
  if (gn !== w.gen) msg.push(`${w.lemma} is ${w.gen === 'ae' ? '1st' : '2nd'} declension, so the middle ending is -${genD}.`);
  if (gp !== w.g) msg.push(gp ? `${w.lemma} is ${G(w.g)}, so the gender is ${w.g}.` : `Don't forget the gender: ${w.g}.`);
  return { ok: false, hint: msg.join(' ') + (gp !== w.g ? trapNote : '') };
}
const stripPron = n => n.replace(/^(he\/she\/it|he\/she|he or she|s\/he|he|she|it|they)\s+/, '');
export function gradeMeaning(v, w) {
  let n = normEn(v); if (!n) return { ok: false };
  if (w.kind === 'v') n = stripPron(n);
  const toless = x => x.replace(/^to /, '').replace(/^be /, '');
  if (w.kind === 'vb') n = toless(stripPron(n.replace(/^i /, '')));
  if (w.kind === 'p') n = n.replace(/\s*\+?\s*(ablative|accusative|abl|acc)$/, '').trim();
  let accs = w.mean.map(normEn).concat([normEn(w.show)]);
  if (w.kind === 'vb') { accs = accs.map(toless); (w.en || []).forEach(e => accs.push(normEn(e.sg))); }
  if (w.kind === 'p') accs = accs.map(a => a.replace(/\s*\+?\s*(ablative|accusative)$/, '').trim());
  const match = p => accs.includes(p) || accs.some(a => sortW(a) === sortW(p));
  const full = w.show.includes('/') || w.show.includes(',') ? { ok: true, note: `Full meaning: ${w.show}` } : OK;
  if (match(n)) return full;
  if (n !== 'or') { const parts = n.split(/\s*(?:\/|,|\bor\b|\band\b)\s*/).map(s => s.trim()).filter(Boolean); if (parts.length > 1 && new Set(parts).size === parts.length && parts.every(match)) return full; }
  if (w.kind === 'v' && w.wrongNum.map(normEn).includes(n))
    return { ok: false, hint: w.num === 'sg' ? `${w.lemma} ends in -t, so it's singular. Use the singular English: ${w.show} (he/she ${w.show}).` : `${w.lemma} ends in -nt, so it's plural: ${w.show}.` };
  // woman/women and man/men sound alike: count it, just show the singular.
  const pl = { woman: 'women', man: 'men' };
  if (w.kind === 'n') for (const a of accs) if (pl[a] && n === pl[a]) return { ok: true, note: `One ${a}. (Spelled ${a}.)` };
  if (w.kind === 'n') for (const a of accs) if (n === a + 's' || n === a + 'es') return { ok: false, hint: `"${n}" is plural, but ${w.lemma} is singular. Singular in Latin means singular in English: ${a}.` };
  if (w.near && w.near[n]) return { ok: false, hint: w.near[n] };
  const o = REV[n]; if (o && o !== w.lemma && !accs.includes(n)) return { ok: false, hint: `"${n}" is what ${o} means. ${w.lemma} means ${w.show}.` };
  // Generous spelling: hours = horse? no. morse/hors/hapy/tierd = yes.
  const own = (w.enPl || []).map(normEn).concat((w.wrongNum || []).map(normEn));
  const hit = fuzzyEn(n, accs, own);
  if (hit) return { ok: true, note: `Spelled: ${hit}` };
  if (n !== 'or') { const parts = n.split(/\s*(?:\/|,|\bor\b|\band\b)\s*/).map(s => s.trim()).filter(Boolean); if (parts.length > 1 && new Set(parts).size === parts.length && parts.every(p => match(p) || fuzzyEn(p, accs, own))) return full; }
  return { ok: false };
}
export function gradeOtherForm(v, w) {
  const want = w.pair, n = letters(v); if (!n) return { ok: false };
  if (n === letters(want)) return OK;
  if (want === 'sunt') return { ok: false, hint: 'The plural of est is sunt. It\'s irregular, so just memorize it.' };
  if (want === 'est') return { ok: false, hint: 'The singular of sunt is est.' };
  return { ok: false, hint: w.num === 'sg' ? `Plural verbs end in -nt: ${want}.` : `Singular verbs end in -t: ${want}.` };
}
export function gradeLatin(v, w) {
  const n = letters(v), want = letters(w.lemma); if (!n) return { ok: false };
  if (w.forms && w.kind === 'x') {
    const toks = fold(v).toLowerCase().split(/[^a-z]+/).filter(Boolean).sort().join(' ');
    if (toks === w.forms.map(letters).sort().join(' ')) return OK;
    if (w.forms.map(letters).includes(n)) return { ok: false, hint: 'Give both forms: quī/quae.' };
    return { ok: false };
  }
  if (n === want) return OK;
  if ((w.kind === 'n' || w.kind === 'a') && n.startsWith(want) && gradeMiddle(n.slice(want.length), w).ok) return OK;
  if (w.kind === 'v' && n === letters(w.pair)) return { ok: false, hint: w.num === 'sg' ? `${w.pair} is the plural. Give the singular first: ${w.lemma}.` : `${w.pair} is the singular. "${w.show}" is plural: ${w.lemma}.` };
  const f = NF[n]; if (f && f.id === w.id) return { ok: false, hint: `Use the dictionary form: ${w.lemma}.` };
  const twin = { amica: 'amicus', amicus: 'amica', discipula: 'discipulus', discipulus: 'discipula', magister: 'magistra', magistra: 'magister' }[w.lemma];
  if (twin && n === letters(twin)) return { ok: false, hint: `${twin} is the ${w.g === 'f' ? 'male' : 'female'} one. The ${w.g === 'f' ? 'female' : 'male'} one is ${w.lemma}.` };
  if (w.lemma === 'etiam' && n === 'iam') return { ok: false, hint: 'iam means now. "Also" is etiam (et + iam).' };
  const o = BYL[n]; if (o) return { ok: false, hint: `${o.lemma} means ${o.show}.` };
  return { ok: false };
}
export function gradeAlso(a0, b0) {
  const a = letters(a0), b = letters(b0);
  const ok0 = ['etiam', 'quoque'].includes(a), ok1 = ['etiam', 'quoque'].includes(b) && b !== a;
  const hints = [];
  if ([a, b].includes('iam')) hints.push('iam means now. "Also" is etiam (et + iam).');
  if (ok0 && a === b) hints.push('You typed the same word twice. The other one is ' + (a === 'etiam' ? 'quoque' : 'etiam') + '.');
  return { ok: [ok0, ok1], hints, notes: [] };
}
export const pack = r => ({ ok: r.map(x => x.ok), hints: r.map(x => x.hint).filter(Boolean), notes: r.map(x => x.note).filter(Boolean) });

/* ---------- noun ID ---------- */
const NUMS = { sg: ['singular', 'sing', 'sg', 's'], pl: ['plural', 'plur', 'plu', 'pl', 'p'] };
const GENS = { m: ['masculine', 'masc', 'mas', 'm', 'male'], f: ['feminine', 'fem', 'f', 'female'] };
const DECS = { ae: ['1', '1st', 'first', 'one'], i: ['2', '2nd', 'second', 'two'] };
function fuzzyIn(v, list, full) { const n = normT(v); if (!n) return { ok: false }; if (list.includes(n)) return OK; if (n.length >= 5 && lev(n, full) <= 2) return { ok: true, note: `Spelling: ${full}` }; return { ok: false }; }
export const gradeNumber = (v, num) => fuzzyIn(v, NUMS[num], num === 'sg' ? 'singular' : 'plural');
export function gradeNID(vals, w, num) {
  const form = num === 'sg' ? w.lemma : w.pl;
  const dn = normT(vals[2]).replace(/(declension|declention|declenson|decl|dec)$/, '');
  const r = [gradeNumber(vals[0], num), fuzzyIn(vals[1], GENS[w.g], G(w.g)), { ok: DECS[w.gen].includes(dn) }];
  const hints = [];
  if (!r[0].ok) hints.push(num === 'sg' ? `${form} is singular. It's the dictionary form.` : `${form} is plural. It ends in -${w.gen === 'ae' ? 'ae' : 'ī'}, the ${w.gen === 'ae' ? '1st' : '2nd'} declension plural ending.`);
  if (!r[1].ok) hints.push(w.trap ? `${w.lemma} looks feminine but it's MASCULINE. Check the entry: ${w.entry}.` : `Check the entry: ${w.entry}. The ${w.g} means ${G(w.g)}.`);
  if (!r[2].ok) hints.push(`The middle stuff -${w.gen === 'ae' ? 'ae' : 'ī'} means ${w.gen === 'ae' ? '1st' : '2nd'} declension.${w.trap ? ' Gender doesn\'t change the declension.' : ''}`);
  return { ok: r.map(x => x.ok), hints, notes: r.map(x => x.note).filter(Boolean) };
}

/* ---------- Latin phrase / sentence answers ---------- */
export const latTokens = s => fold(s).toLowerCase().replace(/[^a-z\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
export const sameBag = (a, b) => a.slice().sort().join(' ') === b.slice().sort().join(' ');

/* ---------- English answers ---------- */
// Compare after removing articles and punctuation; contractions expanded.
export function enKey(s) {
  return normEn(s).replace(/\bisn't\b/g, 'is not').replace(/\baren't\b/g, 'are not').replace(/,/g, ' ')
    .split(/\s+/).filter(t => t && !['the', 'a', 'an'].includes(t)).join(' ');
}
