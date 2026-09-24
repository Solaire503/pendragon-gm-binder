#!/usr/bin/env node
// Roll bridge — runs the Binder's OWN winter/solo tables (js/tabs/winter.js,
// js/tabs/solos.js) headlessly so server.py can offer them to AI tools
// without re-typing a single table. Nothing here writes to disk: the caller
// gets roll results back and decides what to persist.
//
// stdin:  {"op": "...", "binder": {year, living, dead, relationships}, "args": {...}}
// stdout: JSON result (or {"error": "..."} with exit code 1)
'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function fail(msg) {
  process.stdout.write(JSON.stringify({ error: msg }) + '\n');
  process.exit(1);
}

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (e) {
  fail('bad input JSON: ' + e.message);
}
const { op, binder = {}, args = {} } = input;
const living = Array.isArray(binder.living) ? binder.living : [];
const dead   = Array.isArray(binder.dead)   ? binder.dead   : [];
const rels   = Array.isArray(binder.relationships) ? binder.relationships : [];
const byId   = new Map([...living, ...dead].map(n => [n.id, n]));

// ── STORE stub — only what the roll/eligibility methods touch ──────────────
const STORE = {
  year: binder.year,
  living, dead, relationships: rels,
  getNpc: id => byId.get(id) || null,
  allNpcs: () => [...living, ...dead],
  getRelationships: id => rels.filter(r => r.sourceId === id || r.targetId === id),
  save() {}, updateNpc() {}, addNpc() { throw new Error('bridge is read-only'); },
  addRelationship() { throw new Error('bridge is read-only'); },
  addSoloEvent() { throw new Error('bridge is read-only'); },
};

// DOM/UI stubs so the tab files can be evaluated without a browser.
const noop = () => {};
const fakeEl = () => ({ value: '', checked: false, hidden: false, style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop },
  appendChild: noop, addEventListener: noop, querySelectorAll: () => [], querySelector: () => null, remove: noop, innerHTML: '', textContent: '' });
const document = {
  getElementById: () => null, createElement: fakeEl, querySelectorAll: () => [], querySelector: () => null,
  head: { appendChild: noop }, body: { appendChild: noop }, addEventListener: noop,
};
const sandbox = {
  STORE, document, console,
  window: { __USER__: { role: 'gm' }, addEventListener: noop },
  localStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  Toast: { success: noop, error: noop, info: noop, show: noop, warning: noop },
  Modal: { open: noop, close: noop }, CardPopup: { open: noop, close: noop, isOpen: () => false },
  Components: {}, EventStaging: { getIds: () => [], clear: noop }, AtMention: { render: s => s },
  esc: s => String(s ?? ''), isGM: () => true, isObserver: () => false,
  hhColour: () => '#000', roleColour: () => '#000', crypto: { randomUUID: () => 'bridge' },
  Math, JSON, Date, Object, Array, Number, String, parseInt, parseFloat, isNaN, setTimeout: noop, fetch: () => Promise.reject(new Error('no network')),
};
sandbox.window.document = document;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/tabs/winter.js', 'js/tabs/solos.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
const TabWinter = vm.runInContext('TabWinter', sandbox);
const TabSolos  = vm.runInContext('TabSolos', sandbox);
sandbox.TabWinter = TabWinter; sandbox.TabSolos = TabSolos;
// Render hooks are no-ops here — we only want the maths.
for (const k of ['render', '_renderSurvival', '_renderBirths', '_renderMarriage', '_renderActive']) TabWinter[k] = noop;
for (const k of ['render', '_reRenderCard']) TabSolos[k] = noop;

const age = n => (n && n.year_born) ? STORE.year - n.year_born : null;
const brief = n => n ? { id: n.id, name: n.name, household: n.household || '', role: n.role || '', pronoun: n.pronoun || '', age: age(n) } : null;
const wantIds = () => Array.isArray(args.npc_ids) && args.npc_ids.length ? new Set(args.npc_ids) : null;

const ops = {
  // ── Winter: who is on the table this year ───────────────────────────────
  overview() {
    const survival = TabWinter._getEligible().map(n => ({
      ...brief(n), category: TabWinter._getCategory(n), autoExempt: TabWinter._isAutoExempt(n),
    }));
    const births = TabWinter._getBirthEligible().map(n => {
      const sp = TabWinter._livingSpouse(n.id);
      return {
        ...brief(n), barren: !!n.barren, con: n.con || 13, autoMods: TabWinter._calcAutoMods(n),
        effectiveCon: TabWinter._getEffectiveCon(n),
        firstConception: TabWinter._isFirstConception(n), gaveBirthLastYear: TabWinter._didBirthLastYear(n),
        spouse: sp ? { ...brief(sp.spouse), alive: sp.alive } : null,
      };
    });
    const maidens = TabWinter._getMaidenEligible().map(n => ({ ...brief(n), ageMod: TabWinter._maidenAgeMod(age(n) ?? 17) }));
    const knights = TabWinter._getKnightEligible().map(n => ({
      ...brief(n), courtesy: n.courtesy || 10, waitYears: n.marriage_wait_years || 0,
      target: (n.courtesy || 10) + (n.marriage_wait_years || 0), bachelor: TabWinter._isBachelorKnight(n),
      orientation: n.marriage_orientation || 'hetero', candidateCount: TabWinter._getSpouseCandidates(n).length,
    }));
    const soloKnights = TabSolos._getKnights().map(n => ({ ...brief(n), wed: TabSolos._isWedKnight(n), landed: TabSolos._isLanded(n), isKnight: TabSolos._isKnight(n), personalityNote: n.personalityNote || '' }));
    return { year: STORE.year, survival, births, marriage: { maidens, knights }, soloKnights };
  },

  // ── Winter: survival rolls (no writes) ──────────────────────────────────
  survival() {
    const ids = wantIds();
    const household = args.household ? String(args.household).toLowerCase() : null;
    const includeExempt = !!args.include_exempt;
    const out = [];
    for (const n of TabWinter._getEligible()) {
      if (ids && !ids.has(n.id)) continue;
      if (household && (n.household || '').toLowerCase() !== household) continue;
      const exempt = TabWinter._isAutoExempt(n);
      const row = { ...brief(n), category: TabWinter._getCategory(n), autoExempt: exempt, roll: null };
      if (!row.category) { row.skipped = 'no year_born'; out.push(row); continue; }
      if (exempt && !includeExempt) { row.skipped = 'auto-exempt'; out.push(row); continue; }
      row.roll = TabWinter._roll(n);
      out.push(row);
    }
    return { year: STORE.year, rolled: out.filter(r => r.roll).length, deaths: out.filter(r => r.roll && r.roll.result === 'Death').map(r => r.id), results: out };
  },

  // ── Winter: childbirth rolls (no writes) ────────────────────────────────
  childbirth() {
    const ids = wantIds();
    const bastard = !!args.bastard;
    const modifier = Number(args.modifier) || 0;
    const out = [];
    for (const n of TabWinter._getBirthEligible()) {
      const sp = TabWinter._livingSpouse(n.id);
      if (ids) { if (!ids.has(n.id)) continue; }
      else if (!(sp && sp.alive)) continue;          // "Roll All" = women with a living spouse
      if (n.barren) { out.push({ ...brief(n), skipped: 'barren' }); continue; }
      if (args.con != null) n.con = Number(args.con);   // stub copy only
      TabWinter._modifiers[n.id] = modifier;
      const res = TabWinter._rollConception(n, bastard);
      out.push({
        ...brief(n), con: n.con || 13, modifier, autoMods: TabWinter._calcAutoMods(n), effectiveCon: TabWinter._getEffectiveCon(n),
        spouse: sp ? { ...brief(sp.spouse), alive: sp.alive } : null, result: res,
      });
    }
    return { year: STORE.year, results: out };
  },

  // ── Winter: marriage rolls (no writes) ──────────────────────────────────
  marriage() {
    const n = STORE.getNpc(args.npc_id);
    if (!n) return { error: 'NPC not found' };
    const custom = Number(args.custom_mod) || 0;
    TabWinter._marriageModifiers[n.id] = custom;
    const isMaiden = TabWinter._getMaidenEligible().some(m => m.id === n.id);
    const isKnight = TabWinter._getKnightEligible().some(k => k.id === n.id);
    let kind = args.kind || (isMaiden ? 'maiden' : isKnight ? 'knight' : null);
    if (!kind) return { error: `${n.name} is not eligible to roll for marriage (needs to be an unmarried maiden 17+ or an unmarried knight/noble 21+)` };
    if (kind === 'maiden') TabWinter.rollOneMaiden(n.id); else TabWinter.rollOneKnight(n.id);
    const res = TabWinter._marriageResults[n.id];
    if (kind === 'knight' && res.courtesyPassed && args.roll_rank) TabWinter.rollKnightRank(n.id);
    return { npc: brief(n), kind, eligible: isMaiden || isKnight, bachelor: TabWinter._isBachelorKnight(n), result: res,
             candidates: TabWinter._getSpouseCandidates(n).slice(0, 40).map(brief) };
  },
  marriage_rank() {
    const n = STORE.getNpc(args.npc_id);
    if (!n) return { error: 'NPC not found' };
    TabWinter._marriageResults[n.id] = { courtesyPassed: true, rolls: [], type: 'knight' };
    TabWinter.rollKnightRank(n.id);
    const res = TabWinter._marriageResults[n.id];
    return { npc: brief(n), waitYears: n.marriage_wait_years || 0, rankRoll: res.rankRoll, rankEntry: res.rankEntry,
             candidates: TabWinter._getSpouseCandidates(n).slice(0, 40).map(brief) };
  },
  spouse_rank_table() { return { table: TabWinter._SPOUSE_RANK_TABLE }; },

  // ── Solo / yearly / kin events (no writes) ──────────────────────────────
  solo() {
    const n = STORE.getNpc(args.npc_id);
    if (!n) return { error: 'NPC not found' };
    const mode = args.mode || 'yearly';
    const tier = args.tier === 'II' ? 'II' : 'I';
    const wedAuto = TabSolos._isWedKnight(n);
    const wed = args.wed === 'wed' ? 'wed' : args.wed === 'unwed' ? 'unwed' : (wedAuto ? 'wed' : 'unwed');
    const season = args.season || 'summer';
    const year = Number(args.year) || STORE.year;
    const isKnight = TabSolos._isKnight(n), landed = TabSolos._isLanded(n);
    const fixed = Number.isInteger(args.fixed_roll) ? args.fixed_roll : null;
    // Optional fixed top-level roll (GM rolled by hand): first die only.
    const orig20 = TabSolos._rollD20, orig6 = TabSolos._rollD6;
    let used = false;
    const once = (fn, sides) => function () { if (fixed != null && !used && fixed >= 1 && fixed <= sides) { used = true; return fixed; } return fn.call(this); };
    TabSolos._rollD20 = once(orig20, 20); TabSolos._rollD6 = once(orig6, 6);
    const base = { knight: { ...brief(n), wed: wedAuto, landed, isKnight, personalityNote: n.personalityNote || '' }, year, season, tier, wed, mode };
    let cards = [];
    try {
      if (mode === 'yearly') {
        const r = TabSolos._rollD20();
        const ev = tier === 'II' ? TabSolos._resolveYearlyEventsTierII(r) : TabSolos._resolveYearlyEvents(r, wed, n.name, isKnight, landed);
        cards.push({ tableRolls: { yearly: r }, eventType: ev.eventType, title: ev.title, mechDesc: ev.mechDesc, flags: ev.flags || [], chainResults: ev.chainResults || [] });
      } else if (mode === 'solo') {
        const d6 = TabSolos._rollD6();
        const ev = TabSolos._resolveTopLevel(d6, wed, n.name, isKnight, landed);
        cards.push({ tableRolls: { topD6: d6, topChain: ev.topChain || 'Unknown' }, eventType: ev.eventType, title: ev.title, mechDesc: ev.mechDesc, flags: ev.flags || [], chainResults: ev.chainResults || [] });
      } else if (mode === 'kin') {
        const kinSize = args.kin_size || 'normal';
        let freqMod = 0;
        if (kinSize === 'normal') freqMod += 1;
        if (kinSize === 'large') freqMod += 2;
        if (isKnight) freqMod += 5;
        if (landed) freqMod += 5;
        const freqRoll = TabSolos._rollD6() + freqMod;
        const numEvents = freqRoll >= 7 ? 2 : freqRoll >= 5 ? 1 : 0;
        if (!numEvents) {
          cards.push({ tableRolls: { frequency: freqRoll }, eventType: 'Kin Event', title: 'Kin — Quiet Season',
            mechDesc: `Frequency roll: ${freqRoll} (modifier +${freqMod}) — no kin event this year.`, flags: [], chainResults: [] });
        } else for (let i = 0; i < numEvents; i++) {
          const kinRoll = TabSolos._rollD20();
          const ev = TabSolos._tableKinEvent(kinRoll, isKnight, landed);
          cards.push({ tableRolls: { frequency: freqRoll, kin: kinRoll }, eventType: 'Kin Event', title: ev.title,
            mechDesc: `Freq: ${freqRoll} (+${freqMod}) → ${numEvents} event(s). Kin roll: ${kinRoll}. ${ev.mechDesc}`, flags: ev.flags || [], chainResults: ev.chainResults || [] });
        }
      } else {
        return { error: "mode must be 'yearly', 'solo' or 'kin'" };
      }
    } finally {
      TabSolos._rollD20 = orig20; TabSolos._rollD6 = orig6;
    }
    // Glory the app's Resolve button would add for exact-glory knights.
    for (const c of cards) {
      let total = 0; const re = /(\d[\d,]*)\s*Glory/gi; let m;
      while ((m = re.exec(c.mechDesc || '')) !== null) total += parseInt(m[1].replace(/,/g, ''), 10) || 0;
      c.gloryInText = total;
    }
    return { ...base, cards, flavorGuide: {
      system: 'Chronicler in the manner of Malory / the Vulgate Cycle. 2–3 sentences, under 90 words, plain grave third-person, archaic cadence; the actual event must be clear from the prose. Vary the angle per knight (a bystander POV, one object in the scene, a private thought, overheard rumour, a gesture, a terse steward note, aftermath, an indoor sensory anchor, a household proverb, a bard\'s verse).',
      forbidden: 'snow, frost, ice, frozen, chill, cold, bitter, moorland, wolf/wolves, mist, fog, rode through, rode forth, rampart, blizzard — and no weather or landscape padding.',
    } };
  },
};

if (!ops[op]) fail('unknown op: ' + op);
try {
  const result = ops[op]();
  process.stdout.write(JSON.stringify(result) + '\n');
  if (result && result.error) process.exit(1);
} catch (e) {
  fail(`${op} failed: ${e.message}`);
}
