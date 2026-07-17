/* ══════════════════════════════════════════════════════════════
   STORE.JS — localStorage data layer
   All persistent state lives here. Tabs read/write through STORE.
══════════════════════════════════════════════════════════════ */

const LS = {
  LIVING:        'pb_living',
  DEAD:          'pb_dead',
  HOUSEHOLDS:    'pb_households',
  MANORS:        'pb_manors',
  RELATIONSHIPS: 'pb_relationships',  // family tree edges
  TREE_POS:      'pb_tree_pos',       // { npcId: { x, y } } per household key
  TREE_LOCK:     'pb_tree_lock',      // { householdName: true/false }
  YEAR:          'pb_year',
  CHRONICLE:     'pb_chronicle',      // { "490": [{id, text, cat, ts}] }
  NPC_MANORS:    'pb_npc_manors',    // [ { id, name, location, status, holderId, faction, notes } ]
  VERSION:       'pb_version',
};

const DATA_VERSION = 6;

const HOUSEHOLDS_DEFAULT = [
  { name: 'Blackwood', colour: '#7a1c1c', icon: '🐺', starred: true, locked: true },
  { name: 'Cador',     colour: '#1e3a5f', icon: '🦅', starred: true, locked: true },
  { name: 'Dawnwell',  colour: '#2d5a4a', icon: '🌅', starred: true, locked: true },
  { name: 'Westwood',  colour: '#4a3a1e', icon: '🌿', starred: true, locked: true },
  { name: 'Upavon',    colour: '#4a2070', icon: '⚜',  starred: true, locked: true },
];

const RELATION_TYPES = [
  'Spouse', 'Betrothed', 'Lover', 'Former Spouse',
  'Child', 'Adopted Child', 'Bastard',
  'Parent', 'Adoptive Parent',
  'Sibling', 'Half-Sibling',
  'Aunt/Uncle', 'Niece/Nephew', 'Cousin',
  'Grandparent', 'Grandchild',
  'Sworn Brother/Sister',
  'Squire', 'Former Squire', 'Page',
  'Vassal',
  'Ward', 'Guardian',
  'Other',
];

// ── STORE OBJECT ──────────────────────────────────────────────
const STORE = {
  living:        [],
  dead:          [],
  households:    [],
  manors:        {},
  relationships: [],
  treePos:       {},
  treeLock:      {},
  chronicle:     {},
  year:          498,

  // ── INIT ───────────────────────────────────────────────────
  init() {
    const ver = parseInt(localStorage.getItem(LS.VERSION) || '0', 10);
    if (ver === 0) {
      // Fresh install — seed everything from defaults
      this._seed();
    } else {
      // Existing data — load then apply any pending migrations
      this._load();
      if (ver < DATA_VERSION) this._migrate(ver);
    }
    localStorage.setItem(LS.VERSION, String(DATA_VERSION));
  },

  // ── DATA MIGRATIONS ────────────────────────────────────────
  // Called when existing localStorage data is older than DATA_VERSION.
  // Each block upgrades from one version to the next.
  _migrate(fromVer) {
    let changed = false;

    // v1 → v2 / v2 → v3: mark established adult Stewards/Priests/Druids as came_of_age.
    // v1→v2 was tagged before the save-file sync was fixed, so the migration never
    // reached the file. v2→v3 re-applies the same logic so file-loaded data gets fixed.
    if (fromVer < 3) {
      const adultRoles = ['steward', 'priest', 'druid'];
      [...this.living, ...this.dead].forEach(npc => {
        if (npc.came_of_age === true) return;
        const role = (npc.role || '').toLowerCase();
        if (!adultRoles.some(r => role.includes(r))) return;
        const age = npc.year_born ? (this.year - npc.year_born) : null;
        // No year_born (clearly ancient) OR 18+ → confirmed adult
        if (age === null || age >= 18) {
          npc.came_of_age = true;
          changed = true;
        }
      });
    }

    // v3 → v4: Household Knight removed — convert all to Bachelor Knight.
    if (fromVer < 4) {
      [...this.living, ...this.dead].forEach(npc => {
        if (npc.role === 'Household Knight') {
          npc.role = 'Bachelor Knight';
          changed = true;
        }
      });
    }

    // v4 → v5: Fix wrong-direction parent-child relationships created by the
    // components.js saveRelationship bug (card owner was used as source regardless
    // of role). Use year_born to detect inversions: for Child/Adopted Child/Bastard
    // the source must be the child (younger); for Parent/Adoptive Parent the source
    // must be the parent (older). Swap when year_born data shows the opposite.
    if (fromVer < 5) {
      const childTypes  = new Set(['Child', 'Adopted Child', 'Bastard']);
      const parentTypes = new Set(['Parent', 'Adoptive Parent']);
      this.relationships.forEach(r => {
        if (!childTypes.has(r.type) && !parentTypes.has(r.type)) return;
        const src = this.getNpc(r.sourceId);
        const tgt = this.getNpc(r.targetId);
        if (!src || !tgt) return;
        const srcBorn = src.year_born ? parseInt(src.year_born, 10) : null;
        const tgtBorn = tgt.year_born ? parseInt(tgt.year_born, 10) : null;
        if (srcBorn === null || tgtBorn === null || isNaN(srcBorn) || isNaN(tgtBorn)) return;
        // Child types: source should be younger (child). If source is older → swap.
        if (childTypes.has(r.type) && srcBorn < tgtBorn) {
          [r.sourceId, r.targetId] = [r.targetId, r.sourceId];
          changed = true;
        }
        // Parent types: source should be older (parent). If source is younger → swap.
        if (parentTypes.has(r.type) && srcBorn > tgtBorn) {
          [r.sourceId, r.targetId] = [r.targetId, r.sourceId];
          changed = true;
        }
      });
    }

    // v5 → v6: Intentionally re-runs the v4→v5 direction-correction fix.
    // The v4→v5 migration ran before file-sync was reliable, so any data loaded
    // from a save file never received it. This pass ensures file-loaded data also
    // gets corrected. The year_born heuristic is idempotent — correctly-directed
    // rels are not swapped.
    if (fromVer < 6) {
      const childTypes6  = new Set(['Child', 'Adopted Child', 'Bastard']);
      const parentTypes6 = new Set(['Parent', 'Adoptive Parent']);
      this.relationships.forEach(r => {
        if (!childTypes6.has(r.type) && !parentTypes6.has(r.type)) return;
        const src = this.getNpc(r.sourceId);
        const tgt = this.getNpc(r.targetId);
        if (!src || !tgt) return;
        const srcBorn = src.year_born ? parseInt(src.year_born, 10) : null;
        const tgtBorn = tgt.year_born ? parseInt(tgt.year_born, 10) : null;
        if (srcBorn === null || tgtBorn === null || isNaN(srcBorn) || isNaN(tgtBorn)) return;
        if (childTypes6.has(r.type)  && srcBorn < tgtBorn) { [r.sourceId, r.targetId] = [r.targetId, r.sourceId]; changed = true; }
        if (parentTypes6.has(r.type) && srcBorn > tgtBorn) { [r.sourceId, r.targetId] = [r.targetId, r.sourceId]; changed = true; }
      });
    }

    if (changed) this.save();
  },

  _seed() {
    // Seed from the generated constants (seed-npcs.js / seed-manors.js)
    this.living     = (typeof SEED_LIVING  !== 'undefined') ? JSON.parse(JSON.stringify(SEED_LIVING))  : [];
    this.dead       = (typeof SEED_DEAD    !== 'undefined') ? JSON.parse(JSON.stringify(SEED_DEAD))    : [];
    this.households = JSON.parse(JSON.stringify(HOUSEHOLDS_DEFAULT));
    this.manors     = (typeof SEED_MANORS  !== 'undefined') ? JSON.parse(JSON.stringify(SEED_MANORS))  : {};
    this.year       = (typeof SEED_YEAR    !== 'undefined') ? SEED_YEAR : 498;
    this.relationships = [];
    this.treePos    = {};
    this.treeLock   = {};
    this.npcManors  = [];
    this._save();
  },

  _load() {
    try { this.living     = JSON.parse(localStorage.getItem(LS.LIVING))     || []; } catch(e) { this.living     = []; }
    try { this.dead       = JSON.parse(localStorage.getItem(LS.DEAD))       || []; } catch(e) { this.dead       = []; }
    try { this.households = JSON.parse(localStorage.getItem(LS.HOUSEHOLDS)) || JSON.parse(JSON.stringify(HOUSEHOLDS_DEFAULT)); } catch(e) { this.households = JSON.parse(JSON.stringify(HOUSEHOLDS_DEFAULT)); }
    try { this.manors     = JSON.parse(localStorage.getItem(LS.MANORS))     || {}; } catch(e) { this.manors     = {}; }
    try { this.relationships = JSON.parse(localStorage.getItem(LS.RELATIONSHIPS)) || []; } catch(e) { this.relationships = []; }
    try { this.treePos    = JSON.parse(localStorage.getItem(LS.TREE_POS))   || {}; } catch(e) { this.treePos    = {}; }
    try { this.treeLock   = JSON.parse(localStorage.getItem(LS.TREE_LOCK))  || {}; } catch(e) { this.treeLock   = {}; }
    try { this.chronicle  = JSON.parse(localStorage.getItem(LS.CHRONICLE))  || {}; } catch(e) { this.chronicle  = {}; }
    try { this.npcManors  = JSON.parse(localStorage.getItem(LS.NPC_MANORS)) || []; } catch(e) { this.npcManors  = []; }
    try { this.year       = parseInt(localStorage.getItem(LS.YEAR), 10)     || 498; } catch(e) { this.year      = 498; }
  },

  _save() {
    try {
      localStorage.setItem(LS.LIVING,        JSON.stringify(this.living));
      localStorage.setItem(LS.DEAD,          JSON.stringify(this.dead));
      localStorage.setItem(LS.HOUSEHOLDS,    JSON.stringify(this.households));
      localStorage.setItem(LS.MANORS,        JSON.stringify(this.manors));
      localStorage.setItem(LS.RELATIONSHIPS, JSON.stringify(this.relationships));
      localStorage.setItem(LS.TREE_POS,      JSON.stringify(this.treePos));
      localStorage.setItem(LS.TREE_LOCK,     JSON.stringify(this.treeLock));
      localStorage.setItem(LS.CHRONICLE,     JSON.stringify(this.chronicle));
      localStorage.setItem(LS.NPC_MANORS,    JSON.stringify(this.npcManors));
      localStorage.setItem(LS.YEAR,          String(this.year));
    } catch(e) {
      console.warn('localStorage save failed', e);
    }
  },

  // ── NPC HELPERS ────────────────────────────────────────────
  getNpc(id) {
    return this.living.find(n => n.id === id) || this.dead.find(n => n.id === id) || null;
  },

  allNpcs() {
    return this.living.concat(this.dead);
  },

  updateNpc(id, changes) {
    let arr = this.living;
    let idx = arr.findIndex(n => n.id === id);
    if (idx === -1) { arr = this.dead; idx = arr.findIndex(n => n.id === id); }
    if (idx === -1) return false;
    Object.assign(arr[idx], changes);
    this.save();
    return true;
  },

  addSoloEvent(npcId, event) {
    const npc = this.getNpc(npcId);
    if (!npc) return null;
    const id = 'se-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    if (!npc.soloEvents) npc.soloEvents = [];
    npc.soloEvents.unshift({ id, ...event });
    if (event.year && event.title) {
      if (!this.chronicle) this.chronicle = {};
      const yearKey = String(event.year);
      if (!this.chronicle[yearKey]) this.chronicle[yearKey] = [];
      this.chronicle[yearKey].push({
        id: 'ev-' + crypto.randomUUID(),
        text: `${npc.name} — ${event.title}`,
        cat: 'personal',
        ts: Date.now(),
        sourceEventId: id,   // ties the mirror to the life event so edits/deletes stay in sync
        auto: true,          // distinguishes auto-mirrors from GM-penned entries (never auto-rewritten)
      });
    }
    this.save();
    return id;
  },

  updateSoloEvent(npcId, eventId, changes) {
    const npc = this.getNpc(npcId);
    if (!npc || !npc.soloEvents) return false;
    const ev = npc.soloEvents.find(e => e.id === eventId);
    if (!ev) return false;
    Object.assign(ev, changes);
    this._syncSoloEventMirror(npc, ev);
    this.save();
    return true;
  },

  // Keep the auto-created chronicle line matching its life event —
  // rewrite the text and move it to the right year if that changed.
  _syncSoloEventMirror(npc, ev) {
    if (!this.chronicle) return;
    Object.keys(this.chronicle).forEach(yr => {
      const list = this.chronicle[yr];
      for (let i = list.length - 1; i >= 0; i--) {
        const entry = list[i];
        if (!entry.auto || entry.sourceEventId !== ev.id) continue;
        entry.text = `${npc.name} — ${ev.title}`;
        const targetYr = String(ev.year || yr);
        if (targetYr !== yr) {
          list.splice(i, 1);
          (this.chronicle[targetYr] = this.chronicle[targetYr] || []).push(entry);
        }
      }
    });
  },

  deleteSoloEvent(npcId, eventId) {
    const npc = this.getNpc(npcId);
    if (!npc || !npc.soloEvents) return false;
    const idx = npc.soloEvents.findIndex(e => e.id === eventId);
    if (idx === -1) return false;
    npc.soloEvents.splice(idx, 1);
    if (this.chronicle) {
      Object.keys(this.chronicle).forEach(yr => {
        this.chronicle[yr] = this.chronicle[yr].filter(e => !(e.auto && e.sourceEventId === eventId));
      });
    }
    this.save();
    return true;
  },

  // ── VASSAL LEDGER ↔ NPC-MANOR REGISTRY ─────────────────────
  // PK manor pages keep their own vassal ledger (manor.vassals[].knightId),
  // while the NPC Manors registry (npcManors[].holderId) is where succession
  // and enfeoffment actually happen. Match the two by manor name — registry
  // names may carry a parenthetical like "Bedwyn (Under Blackwood)".
  // Returns null when there is no single unambiguous match (e.g. two
  // registry manors both named "Wilton (…)"), so callers fall back safely.
  npcManorForVassalName(name) {
    const q = (name || '').trim().toLowerCase();
    if (!q) return null;
    const all = this.npcManors || [];
    const exact = all.filter(nm => (nm.name || '').trim().toLowerCase() === q);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null;
    const baseOf = nm => (nm.name || '').replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
    const matches = all.filter(nm => baseOf(nm) === q);
    return matches.length === 1 ? matches[0] : null;
  },

  // Push a registry manor's current holder into every PK vassal-ledger
  // entry that unambiguously refers to it. Call whenever holderId changes,
  // or dashboards keep alerting on the previous (possibly dead) knight.
  syncVassalKnight(npcManor) {
    if (!npcManor) return;
    Object.values(this.manors || {}).forEach(pk => {
      (pk.vassals || []).forEach(v => {
        if (this.npcManorForVassalName(v.manorName) === npcManor) {
          v.knightId = npcManor.holderId || null;
        }
      });
    });
  },

  addNpc(npc) {
    // Generate ID
    const maxId = this.allNpcs().reduce((m, n) => {
      const num = parseInt((n.id || '').replace('npc-', ''), 10);
      return isNaN(num) ? m : Math.max(m, num);
    }, 0);
    npc.id = 'npc-' + String(maxId + 1).padStart(3, '0');
    npc.status       = npc.status || 'Alive';
    npc.blessed      = npc.blessed      ?? false;
    npc.fate_touched = npc.fate_touched ?? false;
    if (npc.status === 'Alive') this.living.push(npc);
    else this.dead.push(npc);
    this.save();
    return npc.id;
  },

  killNpc(id, yearDied, deathNotes) {
    const idx = this.living.findIndex(n => n.id === id);
    if (idx === -1) return false;
    const npc = this.living.splice(idx, 1)[0];
    npc.status   = 'Dead';
    npc.year_died = yearDied || this.year;
    if (deathNotes) npc.notes = (npc.notes ? npc.notes + '\n\n' : '') + '† ' + deathNotes;
    this.dead.push(npc);
    this.save();
    return true;
  },

  restoreNpc(id) {
    const idx = this.dead.findIndex(n => n.id === id);
    if (idx === -1) return false;
    const npc = this.dead.splice(idx, 1)[0];
    npc.status   = 'Alive';
    npc.year_died = null;
    this.living.push(npc);
    this.save();
    return true;
  },

  deleteNpc(id) {
    let idx = this.living.findIndex(n => n.id === id);
    if (idx !== -1) { this.living.splice(idx, 1); }
    else {
      idx = this.dead.findIndex(n => n.id === id);
      if (idx !== -1) this.dead.splice(idx, 1);
    }
    // Remove their relationships
    this.relationships = this.relationships.filter(r => r.sourceId !== id && r.targetId !== id);
    // Remove the NPC's impression from the per-user Notes store
    if (typeof Notes !== 'undefined' && Notes._data?.impressions) {
      delete Notes._data.impressions[id];
      Notes._dirty = true;
      Notes._scheduleSave?.();
    }
    // Remove orphaned NPC manor assignments
    if (Array.isArray(this.npcManors)) {
      this.npcManors = this.npcManors.filter(m => m.holderId !== id);
    }
    // Remove the NPC from the Pins list
    if (typeof PinsManager !== 'undefined' && Array.isArray(PinsManager._pins)) {
      const pinIdx = PinsManager._pins.indexOf(id);
      if (pinIdx !== -1) {
        PinsManager._pins.splice(pinIdx, 1);
        PinsManager._save();
      }
    }
    this.save();
  },

  // ── HOUSEHOLD HELPERS ──────────────────────────────────────
  getHousehold(name) {
    return this.households.find(h => h.name === name) || null;
  },

  householdColour(name) {
    const h = this.getHousehold(name);
    return h ? h.colour : '#5a5040';
  },

  householdIcon(name) {
    const h = this.getHousehold(name);
    return h ? h.icon : '◆';
  },

  householdMembers(name) {
    const lower = (name || '').toLowerCase();
    return this.living.filter(n => (n.household || '').toLowerCase() === lower);
  },

  // ── MANOR HELPERS ──────────────────────────────────────────
  getManor(key) {
    return this.manors[key] || null;
  },

  manorKeys() {
    return Object.keys(this.manors);
  },

  // Get current-year treasury for a manor (last history entry)
  manorTreasury(key) {
    const m = this.getManor(key);
    if (!m || !m.history || !m.history.length) return 0;
    return [...m.history].sort((a, b) => b.year - a.year)[0].treasury;
  },

  addManorHistory(key, entry) {
    const m = this.getManor(key);
    if (!m) return;
    m.history.push(entry);
    this.save();
  },

  updateManorHistory(key, year, changes) {
    const m = this.getManor(key);
    if (!m) return;
    const entry = m.history.find(h => h.year === year);
    if (entry) { Object.assign(entry, changes); this.save(); }
  },

  // ── VASSAL HELPERS ─────────────────────────────────────────
  addVassal(manorKey, vassal) {
    const m = this.getManor(manorKey);
    if (!m) return;
    if (!m.vassals) m.vassals = [];
    const id = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    m.vassals.push({ id, ...vassal });
    this.save();
    return id;
  },

  updateVassal(manorKey, vassalId, changes) {
    const m = this.getManor(manorKey);
    if (!m || !m.vassals) return;
    const v = m.vassals.find(v => v.id === vassalId);
    if (v) { Object.assign(v, changes); this.save(); }
  },

  removeVassal(manorKey, vassalId) {
    const m = this.getManor(manorKey);
    if (!m || !m.vassals) return;
    m.vassals = m.vassals.filter(v => v.id !== vassalId);
    this.save();
  },

  // ── RELATIONSHIP HELPERS ───────────────────────────────────
  getRelationships(npcId) {
    return this.relationships.filter(r => r.sourceId === npcId || r.targetId === npcId);
  },

  // ── INFERRED SIBLINGS ──────────────────────────────────────────
  // Returns [{npc, sibType}] derived purely from parent records.
  // Never stored — won't appear as lines on the family tree.
  // sibType: 'Full Sibling' | 'Half-Sibling' | 'Sibling' | 'Step-Sibling'
  inferredSiblings(npcId) {
    // Collect subject's biological and adoptive parents
    const bioParentIds   = new Set();
    const adoptParentIds = new Set();

    this.relationships.forEach(r => {
      if (r.sourceId === npcId) {
        if (r.type === 'Child'   || r.type === 'Bastard') bioParentIds.add(r.targetId);
        if (r.type === 'Adopted Child')                   adoptParentIds.add(r.targetId);
      }
      if (r.targetId === npcId) {
        if (r.type === 'Parent')          bioParentIds.add(r.sourceId);
        if (r.type === 'Adoptive Parent') adoptParentIds.add(r.sourceId);
      }
    });

    if (bioParentIds.size === 0 && adoptParentIds.size === 0) return [];

    // Spouses of bio parents who are NOT themselves bio parents → step-parent pool
    const stepParentIds = new Set();
    this.relationships.forEach(r => {
      if (r.type !== 'Spouse') return;
      const [a, b] = [r.sourceId, r.targetId];
      if (bioParentIds.has(a) && !bioParentIds.has(b)) stepParentIds.add(b);
      if (bioParentIds.has(b) && !bioParentIds.has(a)) stepParentIds.add(a);
    });

    // Skip NPCs already stored as explicit siblings (avoid duplication)
    const storedSibIds = new Set(
      this.getRelationships(npcId)
        .filter(r => r.type === 'Sibling' || r.type === 'Half-Sibling')
        .map(r => r.sourceId === npcId ? r.targetId : r.sourceId)
    );

    const allParentIds = new Set([...bioParentIds, ...adoptParentIds, ...stepParentIds]);

    // For each candidate sibling, track how they connect back to the subject
    const candidates = new Map();

    this.relationships.forEach(r => {
      let childId, parentId, isBioRel;
      if (r.type === 'Child' || r.type === 'Bastard') {
        childId = r.sourceId; parentId = r.targetId; isBioRel = true;
      } else if (r.type === 'Adopted Child') {
        childId = r.sourceId; parentId = r.targetId; isBioRel = false;
      } else if (r.type === 'Parent') {
        childId = r.targetId; parentId = r.sourceId; isBioRel = true;
      } else if (r.type === 'Adoptive Parent') {
        childId = r.targetId; parentId = r.sourceId; isBioRel = false;
      } else return;

      if (childId === npcId)             return; // that's the subject
      if (!allParentIds.has(parentId))   return; // not a relevant parent
      if (storedSibIds.has(childId))     return; // already stored explicitly

      if (!candidates.has(childId)) candidates.set(childId, { bioShared: new Set(), viaStep: false, viaAdopt: false });
      const d = candidates.get(childId);

      if (bioParentIds.has(parentId) && isBioRel) {
        d.bioShared.add(parentId);   // shared bio parent, candidate is also bio child
      } else if (stepParentIds.has(parentId)) {
        d.viaStep = true;            // child of subject's bio parent's spouse
      } else {
        d.viaAdopt = true;           // via adoptive parent, or adopted child of bio parent
      }
    });

    const result = [];
    const bioCount = bioParentIds.size;

    candidates.forEach((d, candidateId) => {
      const npc = this.getNpc(candidateId);
      if (!npc) return;

      let sibType;
      const shared = d.bioShared.size;

      if (shared > 0) {
        if (bioCount >= 2) {
          const sharesAll = [...bioParentIds].every(pid => d.bioShared.has(pid));
          sibType = sharesAll ? 'Full Sibling' : 'Half-Sibling';
        } else {
          sibType = 'Sibling'; // only 1 bio parent recorded — full/half indeterminate
        }
      } else if (d.viaStep || d.viaAdopt) {
        sibType = 'Step-Sibling';
      } else {
        return;
      }

      result.push({ npc, sibType });
    });

    // Sort by birth year ascending
    result.sort((a, b) => (a.npc.year_born || 9999) - (b.npc.year_born || 9999));
    return result;
  },

  // ── SHARED HELPERS ─────────────────────────────────────────────
  _getBioParentIds(npcId) {
    const ids = new Set();
    this.relationships.forEach(r => {
      if ((r.type === 'Child' || r.type === 'Bastard') && r.sourceId === npcId) ids.add(r.targetId);
      if (r.type === 'Parent' && r.targetId === npcId) ids.add(r.sourceId);
    });
    return ids;
  },

  _getBioChildIds(npcId) {
    const ids = new Set();
    this.relationships.forEach(r => {
      if ((r.type === 'Child' || r.type === 'Bastard') && r.targetId === npcId) ids.add(r.sourceId);
      if (r.type === 'Parent' && r.sourceId === npcId) ids.add(r.targetId);
    });
    return ids;
  },

  _getAllParentIds(npcId) {
    const ids = new Set();
    this.relationships.forEach(r => {
      if ((r.type === 'Child' || r.type === 'Bastard' || r.type === 'Adopted Child') && r.sourceId === npcId) ids.add(r.targetId);
      if ((r.type === 'Parent' || r.type === 'Adoptive Parent') && r.targetId === npcId) ids.add(r.sourceId);
    });
    return ids;
  },

  _getAllChildIds(npcId) {
    const ids = new Set();
    this.relationships.forEach(r => {
      if ((r.type === 'Child' || r.type === 'Bastard' || r.type === 'Adopted Child') && r.targetId === npcId) ids.add(r.sourceId);
      if ((r.type === 'Parent' || r.type === 'Adoptive Parent') && r.sourceId === npcId) ids.add(r.targetId);
    });
    return ids;
  },

  _getSpouseIds(npcId) {
    const ids = new Set();
    this.relationships.forEach(r => {
      if (r.type === 'Spouse' || r.type === 'Betrothed') {
        if (r.sourceId === npcId) ids.add(r.targetId);
        if (r.targetId === npcId) ids.add(r.sourceId);
      }
    });
    return ids;
  },

  // ── INFERRED GRANDPARENTS / GRANDCHILDREN ──────────────────────
  // Returns [{npc, role}] — 'Grandparent' or 'Grandchild'
  inferredGrandparents(npcId) {
    const storedIds = new Set(
      this.getRelationships(npcId).map(r => r.sourceId === npcId ? r.targetId : r.sourceId)
    );
    const result = [];
    const seen = new Set([npcId]);

    // Parents' parents → Grandparents (includes adoptive)
    this._getAllParentIds(npcId).forEach(parentId => {
      this._getAllParentIds(parentId).forEach(gpId => {
        if (seen.has(gpId) || storedIds.has(gpId)) return;
        seen.add(gpId);
        const npc = this.getNpc(gpId);
        if (npc) result.push({ npc, role: 'Grandparent' });
      });
    });

    // Children's children → Grandchildren (includes adoptive)
    this._getAllChildIds(npcId).forEach(childId => {
      this._getAllChildIds(childId).forEach(gcId => {
        if (seen.has(gcId) || storedIds.has(gcId)) return;
        seen.add(gcId);
        const npc = this.getNpc(gcId);
        if (npc) result.push({ npc, role: 'Grandchild' });
      });
    });

    result.sort((a, b) => (a.npc.year_born || 9999) - (b.npc.year_born || 9999));
    return result;
  },

  // ── INFERRED AUNTS / UNCLES / NIECES / NEPHEWS ────────────────
  // Returns [{npc, role}] — 'Aunt/Uncle' or 'Niece/Nephew'
  // Uses bio chains only (no step-siblings propagated as aunts/uncles)
  inferredAuntsUncles(npcId) {
    const storedIds = new Set(
      this.getRelationships(npcId).map(r => r.sourceId === npcId ? r.targetId : r.sourceId)
    );
    storedIds.add(npcId);
    const result = [];
    const seen = new Set([npcId]);

    // Aunts/Uncles: each parent's stored + inferred siblings (includes adoptive)
    this._getAllParentIds(npcId).forEach(parentId => {
      const parentSibIds = new Set();
      this.relationships.forEach(r => {
        if (r.type !== 'Sibling' && r.type !== 'Half-Sibling') return;
        if (r.sourceId === parentId) parentSibIds.add(r.targetId);
        if (r.targetId === parentId) parentSibIds.add(r.sourceId);
      });
      this.inferredSiblings(parentId)
        .filter(s => s.sibType !== 'Step-Sibling')
        .forEach(s => parentSibIds.add(s.npc.id));

      parentSibIds.forEach(sibId => {
        if (seen.has(sibId) || storedIds.has(sibId)) return;
        seen.add(sibId);
        const npc = this.getNpc(sibId);
        if (npc) result.push({ npc, role: 'Aunt/Uncle' });
      });
    });

    // Nieces/Nephews: subject's stored + inferred bio siblings' bio children
    const subjectSibIds = new Set();
    this.relationships.forEach(r => {
      if (r.type !== 'Sibling' && r.type !== 'Half-Sibling') return;
      if (r.sourceId === npcId) subjectSibIds.add(r.targetId);
      if (r.targetId === npcId) subjectSibIds.add(r.sourceId);
    });
    this.inferredSiblings(npcId)
      .filter(s => s.sibType !== 'Step-Sibling')
      .forEach(s => subjectSibIds.add(s.npc.id));

    subjectSibIds.forEach(sibId => {
      this._getAllChildIds(sibId).forEach(nephId => {
        if (seen.has(nephId) || storedIds.has(nephId)) return;
        seen.add(nephId);
        const npc = this.getNpc(nephId);
        if (npc) result.push({ npc, role: 'Niece/Nephew' });
      });
    });

    result.sort((a, b) => (a.npc.year_born || 9999) - (b.npc.year_born || 9999));
    return result;
  },

  // ── INFERRED IN-LAWS ──────────────────────────────────────────
  // Good-Father/Mother: spouse's bio parents
  // Good-Brother/Sister: spouse's STORED siblings only (deliberately limited)
  // Good-Son/Daughter: bio children's spouses
  inferredInLaws(npcId) {
    const storedIds = new Set(
      this.getRelationships(npcId).map(r => r.sourceId === npcId ? r.targetId : r.sourceId)
    );
    storedIds.add(npcId);
    const result = [];
    const seen = new Set([npcId]);

    const pronRole = (npc, femRole, mascRole, neutRole) => {
      const p = (npc.pronoun || '').toLowerCase();
      return p.includes('she') ? femRole : p.includes('he') ? mascRole : neutRole;
    };

    const spouseIds = this._getSpouseIds(npcId);

    spouseIds.forEach(spouseId => {
      // Good-Father / Good-Mother: spouse's parents (includes adoptive)
      this._getAllParentIds(spouseId).forEach(parentId => {
        if (seen.has(parentId) || storedIds.has(parentId)) return;
        seen.add(parentId);
        const npc = this.getNpc(parentId);
        if (!npc) return;
        result.push({ npc, role: pronRole(npc, 'Good-Mother', 'Good-Father', 'Good-Parent') });
      });

      // Good-Brother / Good-Sister: spouse's STORED siblings only
      this.relationships.forEach(r => {
        if (r.type !== 'Sibling' && r.type !== 'Half-Sibling') return;
        let sibId = null;
        if (r.sourceId === spouseId) sibId = r.targetId;
        else if (r.targetId === spouseId) sibId = r.sourceId;
        if (!sibId || seen.has(sibId) || storedIds.has(sibId)) return;
        seen.add(sibId);
        const npc = this.getNpc(sibId);
        if (!npc) return;
        result.push({ npc, role: pronRole(npc, 'Good-Sister', 'Good-Brother', 'Good-Sibling') });
      });
    });

    // Good-Son / Good-Daughter: children's spouses (includes adoptive)
    this._getAllChildIds(npcId).forEach(childId => {
      this._getSpouseIds(childId).forEach(spouseId => {
        if (seen.has(spouseId) || storedIds.has(spouseId)) return;
        seen.add(spouseId);
        const npc = this.getNpc(spouseId);
        if (!npc) return;
        result.push({ npc, role: pronRole(npc, 'Good-Daughter', 'Good-Son', 'Good-Child') });
      });
    });

    result.sort((a, b) => (a.npc.year_born || 9999) - (b.npc.year_born || 9999));
    return result;
  },

  _dedupeRelationships() {
    const INVERSE = {
      'Child': 'Parent',           'Parent': 'Child',
      'Adopted Child': 'Adoptive Parent', 'Adoptive Parent': 'Adopted Child',
      'Bastard': 'Parent',
      'Sibling': 'Sibling',        'Half-Sibling': 'Half-Sibling',
      'Spouse': 'Spouse',          'Betrothed': 'Betrothed',
      'Lover': 'Lover',            'Former Spouse': 'Former Spouse',
      'Aunt/Uncle': 'Niece/Nephew','Niece/Nephew': 'Aunt/Uncle',
      'Cousin': 'Cousin',
      'Grandparent': 'Grandchild', 'Grandchild': 'Grandparent',
      'Sworn Brother/Sister': 'Sworn Brother/Sister',
      'Squire': 'Squire',          'Former Squire': 'Former Squire',
      'Page': 'Page',
      'Vassal': 'Vassal',
      'Ward': 'Guardian',          'Guardian': 'Ward',
      'Other': 'Other',
    };
    const seen = new Set();
    this.relationships = this.relationships.filter(r => {
      const pair = [r.sourceId, r.targetId].sort().join('|');
      // Normalise to the canonical type so inverse pairs share a key
      const canonical = [r.sourceId, r.targetId].sort()[0] === r.sourceId ? r.type : (INVERSE[r.type] || r.type);
      const key = `${canonical}|${pair}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },

  addRelationship(sourceId, targetId, type, notes) {
    type = type || 'Other';
    // Validation: self-relationship is nonsense in every type.
    if (sourceId === targetId) {
      if (typeof Toast !== 'undefined') Toast.error('A character cannot have a relationship with themselves');
      return null;
    }
    // Validation: ancestry cycles. If the proposed link would put someone
    // in their own ancestor chain, reject it — otherwise the family tree
    // stops being a tree.
    if (this._wouldCreateAncestryCycle(sourceId, targetId, type)) {
      if (typeof Toast !== 'undefined') Toast.error('That would create a circular ancestry chain');
      return null;
    }
    const id = 'rel-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    this.relationships.push({ id, sourceId, targetId, type, notes: notes || '' });
    this.save();
    return id;
  },

  // Walks the existing ancestry graph to see whether adding
  // (sourceId → targetId, type) would close a cycle.
  // Only meaningful for direct-ancestry types; sibling/spouse/etc. return false.
  _wouldCreateAncestryCycle(sourceId, targetId, type) {
    // Normalise to (ancestorId, descendantId) for the proposed link.
    let ancestorId, descendantId;
    switch (type) {
      // "source is a child of target" → target is ancestor
      case 'Child':
      case 'Bastard':
      case 'Adopted Child':
      case 'Grandchild':
        ancestorId = targetId; descendantId = sourceId; break;
      // "source is a parent of target" → source is ancestor
      case 'Parent':
      case 'Adoptive Parent':
      case 'Grandparent':
        ancestorId = sourceId; descendantId = targetId; break;
      default:
        return false; // non-ancestry type — no cycle possible
    }
    // Walk upward from ancestorId through existing parent links.
    // If we hit descendantId, the proposed link would close a loop.
    const visited = new Set();
    const stack   = [ancestorId];
    while (stack.length) {
      const cur = stack.pop();
      if (cur === descendantId) return true;
      if (visited.has(cur)) continue;
      visited.add(cur);
      this.relationships.forEach(r => {
        // cur is stored as a child → targetId is a parent of cur
        if ((r.type === 'Child' || r.type === 'Bastard' || r.type === 'Adopted Child') && r.sourceId === cur) {
          stack.push(r.targetId);
        }
        // cur is stored as a parent's child → sourceId is a parent of cur
        if ((r.type === 'Parent' || r.type === 'Adoptive Parent') && r.targetId === cur) {
          stack.push(r.sourceId);
        }
        // Grandparent chains — walk two steps at once through the stored link.
        if (r.type === 'Grandparent' && r.targetId === cur) stack.push(r.sourceId);
        if (r.type === 'Grandchild' && r.sourceId === cur) stack.push(r.targetId);
      });
    }
    return false;
  },

  removeRelationship(id) {
    this.relationships = this.relationships.filter(r => r.id !== id);
    this.save();
  },

  updateRelationship(id, changes) {
    const rel = this.relationships.find(r => r.id === id);
    if (rel) { Object.assign(rel, changes); this.save(); }
  },

  // ── TREE POSITION ──────────────────────────────────────────
  getTreePos(npcId) {
    return this.treePos[npcId] || null;
  },

  setTreePos(npcId, x, y) {
    const pinned     = this.treePos[npcId]?.pinned     ?? false;
    const userPlaced = this.treePos[npcId]?.userPlaced ?? false;
    this.treePos[npcId] = { x, y, pinned, userPlaced };
    this.save();
  },

  // ── YEAR ───────────────────────────────────────────────────
  setYear(y) {
    this.year = y;
    this._save();
    this._dirty = true;
    FileSync.setStatus('unsaved');
    // Sync immediately — year changes are infrequent and must not be lost on close
    this.syncToFile();
  },

  // ── EXPORT / IMPORT ────────────────────────────────────────
  exportJSON() {
    return JSON.stringify({
      version: DATA_VERSION,
      exported: new Date().toISOString(),
      year: this.year,
      living: this.living,
      dead: this.dead,
      households: this.households,
      manors: this.manors,
      relationships: this.relationships,
      treePos: this.treePos,
      treeLock: this.treeLock,
      chronicle: this.chronicle,
      npcManors: this.npcManors,
    }, null, 2);
  },

  importJSON(json) {
    try {
      const data = JSON.parse(json);
      if (!data.living || !data.dead) throw new Error('Invalid format');
      this.living        = data.living;
      this.dead          = data.dead;
      this.households    = data.households || JSON.parse(JSON.stringify(HOUSEHOLDS_DEFAULT));
      this.manors        = data.manors || {};
      this.relationships = data.relationships || [];
      this.treePos       = data.treePos || {};
      this.treeLock      = data.treeLock || {};
      this.chronicle     = data.chronicle || {};
      this.npcManors     = data.npcManors || [];
      this._dedupeRelationships();
      this.year          = data.year || 498;

      // Run any pending migrations against the loaded data.
      // The file may be from an older version — this ensures migrations
      // apply even when the file is the source of truth (not localStorage).
      const fileVer = parseInt(data.version, 10) || 0;
      localStorage.setItem(LS.VERSION, String(DATA_VERSION));
      this._save();
      if (fileVer < DATA_VERSION) this._migrate(fileVer);

      return true;
    } catch(e) {
      console.error('Failed to parse save file:', e);
      // Do NOT reset to defaults — keep existing in-memory state
      if (typeof Toast !== 'undefined') Toast.error('Save file appears corrupted — data not loaded');
      return 'corrupt';
    }
  },

  resetToSeed() {
    localStorage.clear();
    this._seed();
    localStorage.setItem(LS.VERSION, String(DATA_VERSION));
  },

  // ── FILE SYNC ──────────────────────────────────────────────
  // Vault-style: save file path is stored in config.json on each
  // computer. First run shows a welcome screen to pick/create a file.

  _syncTimer:     null,
  _periodicTimer: null,
  _dirty:         false,

  // Called on every data change — localStorage immediately,
  // file sync debounced by 3 seconds.
  save() {
    this._save();
    this._dirty = true;
    this._scheduleSyncToFile();
    FileSync.setStatus('unsaved');
  },

  _scheduleSyncToFile() {
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(() => this.syncToFile(), 3000);
  },

  async syncToFile() {
    clearTimeout(this._syncTimer);
    FileSync.setStatus('saving');
    try {
      const isPlayer = window.__USER__?.role !== 'gm';
      const url  = isPlayer ? '/api/relationships' : '/api/save';
      const body = isPlayer
        ? JSON.stringify({ relationships: this.relationships, treePos: this.treePos, treeLock: this.treeLock })
        : this.exportJSON();
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (res.ok) {
        this._dirty = false;
        FileSync.setStatus('saved');
      } else {
        FileSync.setStatus('error');
        console.warn('File save failed:', res.status);
        Toast.error(`Save failed (${res.status}) — data not written to disk`);
      }
    } catch(e) {
      FileSync.setStatus('offline');
      Toast.error('Save failed — server unreachable');
    }
  },

  // Check server config and load save file.
  // Returns: 'loaded' | 'no_config' | 'file_missing' | 'offline'
  async loadFromFile() {
    try {
      const cfgRes = await fetch('/api/config');
      if (!cfgRes.ok) return 'offline';
      const cfg = await cfgRes.json();

      if (!cfg.configured) return 'no_config';
      if (!cfg.exists)     return 'file_missing';

      // Players use the scoped endpoint; GM uses the full endpoint
      const loadUrl = (window.__USER__?.role === 'gm') ? '/api/load' : '/api/player-load';
      const res = await fetch(loadUrl);
      if (!res.ok) return 'offline';

      const text = await res.text();
      // If server returned a status object rather than save data
      try {
        const maybe = JSON.parse(text);
        if (maybe.status) return maybe.status;
      } catch(e) {}

      // Identical to the last poll — skip the import so callers don't
      // tear down and re-render the page for data that hasn't changed.
      if (text === this._lastLoadedText) {
        if (!this._dirty) FileSync.setStatus('saved');
        return 'unchanged';
      }

      const ok = this.importJSON(text);
      if (ok === true) { this._lastLoadedText = text; if (!this._dirty) FileSync.setStatus('saved'); return 'loaded'; }
      if (ok === 'corrupt') return 'corrupt';
      return 'offline';

    } catch(e) {
      FileSync.setStatus('offline');
      return 'offline';
    }
  },

  // Write current in-memory data to a brand-new save file path.
  // Note: the caller (_fpConfirm in app.js) already POSTed to /api/new to set
  // the config, so we only need to sync the data here.
  async saveToNewFile(filePath) {
    try {
      await this.syncToFile();
      return true;
    } catch(e) { return false; }
  },

  startPeriodicSync() {
    clearInterval(this._periodicTimer);
    this._periodicTimer = setInterval(() => {
      if (this._dirty) this.syncToFile();
    }, 5 * 60 * 1000);
  },
};
