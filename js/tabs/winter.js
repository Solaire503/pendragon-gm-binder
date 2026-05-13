/* ══════════════════════════════════════════════════════════════
   TAB: WINTER PHASE
   Survival rolls + Childbirth rolls
══════════════════════════════════════════════════════════════ */

const TabWinter = {

  // ── STATE — SURVIVAL ──────────────────────────────────────
  _manualExempt: new Set(),
  _results:      {},
  _rolled:       false,
  _search:       '',

  // ── STATE — CHILDBIRTH ────────────────────────────────────
  _birthResults:     {},
  _birthRolled:      false,
  _birthSearch:      '',
  _fornicationFlags: new Set(),
  _modifiers:        {},

  // ── STATE — MARRIAGE ──────────────────────────────────────
  _marriageResults:   {},
  _marriageRolled:    false,
  _bachelorEligible:  new Set(),   // bachelor knights manually permitted by GM
  _marriageModifiers: {},          // per-NPC custom +/- modifier for individual rolls
  _marriageSort:      'alpha',     // 'alpha' | 'rank'

  // ── STATE — NAVIGATION ────────────────────────────────────
  _subTab: 'survival',   // 'survival' | 'childbirth' | 'marriage' | 'solos'

  // ── RENDER ────────────────────────────────────────────────
  render() {
    const panel = document.getElementById('tab-winter');
    if (!panel) return;

    panel.innerHTML = `
      <div class="winter-layout">
        <div class="winter-header">
          <div class="page-title" style="margin-bottom:8px;">❄ Winter Phase — ${STORE.year} AD</div>
          <div style="font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.12em;color:var(--ink-soft);opacity:0.8;margin-bottom:14px;">
            "The long dark comes. Let us see who greets the spring."
          </div>
          <nav class="winter-subnav">
            <button class="winter-subtab${this._subTab==='survival'?' active':''}"
              onclick="TabWinter.switchSubTab('survival')">☠ Survival Rolls</button>
            <button class="winter-subtab${this._subTab==='childbirth'?' active':''}"
              onclick="TabWinter.switchSubTab('childbirth')">🍼 Childbirth Rolls</button>
            <button class="winter-subtab${this._subTab==='marriage'?' active':''}"
              onclick="TabWinter.switchSubTab('marriage')">💒 Marriage Rolls</button>
            <button class="winter-subtab${this._subTab==='solos'?' active':''}"
              onclick="TabWinter.switchSubTab('solos')">📖 Yearly &amp; Solo Events</button>
          </nav>
        </div>
        <div class="winter-body">
          <div id="winterActiveSection"></div>
        </div>
      </div>`;

    this._renderActive();
  },

  switchSubTab(name) {
    this._subTab = name;
    this.render();
  },

  _renderActive() {
    const el = document.getElementById('winterActiveSection');
    if (!el) return;
    el.innerHTML = '';
    if (this._subTab === 'survival') {
      el.innerHTML = '<div id="winterSurvivalSection"></div>';
      this._renderSurvival();
    } else if (this._subTab === 'marriage') {
      el.innerHTML = '<div id="winterMarriageSection"></div>';
      this._renderMarriage();
    } else if (this._subTab === 'solos') {
      el.innerHTML = '<div id="solosPanel"></div>';
      TabSolos.render();
    } else {
      el.innerHTML = '<div id="winterBirthSection"></div>';
      this._renderBirths();
    }
  },

  // ══════════════════════════════════════════════════════════
  //  SURVIVAL SECTION
  // ══════════════════════════════════════════════════════════

  _renderSurvival() {
    const el = document.getElementById('winterSurvivalSection');
    if (!el) return;

    const eligible = this._getEligible();

    // Summary counts
    let summaryHtml = '';
    if (this._rolled) {
      let nSafe = 0, nDead = 0, nUnrolled = 0;
      eligible.forEach(n => {
        if (this._isAutoExempt(n) || this._manualExempt.has(n.id)) return;
        const r = this._results[n.id];
        if (!r) { nUnrolled++; return; }
        if (r.result === 'Death') nDead++;
        else nSafe++;
      });
      summaryHtml = `
        <div class="winter-summary">
          <span class="wsumm wsumm-safe">✔ ${nSafe} Safe</span>
          ${nDead    ? `<span class="wsumm wsumm-dead">✕ ${nDead} Death${nDead!==1?'s':''} pending</span>` : ''}
          ${nUnrolled? `<span class="wsumm wsumm-pending">◌ ${nUnrolled} Pending</span>` : ''}
        </div>`;
    }

    const pendingDeaths = eligible.filter(n =>
      !this._isAutoExempt(n) &&
      !this._manualExempt.has(n.id) &&
      this._results[n.id]?.result === 'Death'
    );
    const deathsHtml = pendingDeaths.length ? this._deathsBlock(pendingDeaths) : '';

    const q = this._search.toLowerCase().trim();
    const visibleEligible = q ? eligible.filter(n => n.name.toLowerCase().includes(q)) : eligible;
    const byHH = this._groupByHousehold(visibleEligible);

    el.innerHTML = `
      <div class="winter-section">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap;">
          <div class="section-title" style="margin-bottom:0;">Household Survival Rolls</div>
          <button class="btn btn-primary" style="font-size:0.6rem;" onclick="TabWinter.rollAll()">⚄ Roll All</button>
          ${this._rolled ? `<button class="btn btn-ghost" style="font-size:0.6rem;" onclick="TabWinter.clearRolls()">↺ Reset</button>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
          <input class="search-input winter-search" id="winterSearch" placeholder="Filter by name…"
            value="${this._search.replace(/"/g,'&quot;')}"
            oninput="TabWinter._onSearch(this.value)" style="max-width:240px;">
          ${q ? `<span style="font-family:var(--font-heading);font-size:0.6rem;color:var(--ink-soft);">${visibleEligible.length} of ${eligible.length} shown</span>` : ''}
        </div>
        <div style="font-size:0.72rem;color:var(--ink-soft);margin-bottom:12px;line-height:1.5;">
          Auto-exempt: Player Knights · Fate-Touched · Pages · Squires · Blessed children under 21.
          Tick the box next to any NPC to manually exempt them.
        </div>
        ${summaryHtml}
        ${deathsHtml}
        ${eligible.length === 0
          ? `<div class="empty-state" style="padding:40px 0;"><div class="empty-state-icon">🕊</div><div class="empty-state-text">No eligible NPCs to roll for</div></div>`
          : visibleEligible.length === 0
            ? `<div class="empty-state" style="padding:30px 0;"><div class="empty-state-icon">🔍</div><div class="empty-state-text">No NPCs match "${this._search}"</div></div>`
            : Object.entries(byHH).map(([hh, npcs]) => this._hhBlock(hh, npcs)).join('')
        }
      </div>`;
  },

  _deathsBlock(npcs) {
    const rows = npcs.map(n => {
      const hh     = STORE.getHousehold(n.household);
      const col    = hh?.colour || 'var(--ink-soft)';
      const icon   = hh?.icon  || '';
      const age    = n.year_born ? STORE.year - n.year_born : null;
      const ageStr = age !== null ? `Age ${age}` : '?';
      const cat    = this._getCategory(n);
      const res    = this._results[n.id];
      const rollStr = res?.rolls?.join(' → ') || '';
      return `
        <div class="winter-death-row">
          <span class="winter-death-dot" style="background:${col};"></span>
          <div class="winter-death-name-col">
            <span class="winter-npc-name" data-npc-hover="${n.id}" role="button" tabindex="0" onclick="Components.openNpcCard('${n.id}')">${esc(n.name)}</span>
            <span class="winter-death-hh">${icon ? icon + ' ' : ''}${esc(n.household || '—')}</span>
          </div>
          <span class="winter-age-str">${ageStr}</span>
          ${cat ? `<span class="winter-cat-badge" style="background:${this._catColour(cat)};">${cat}</span>` : '<span style="min-width:64px;"></span>'}
          <span class="winter-roll-detail" style="flex-shrink:0;">[${rollStr}]</span>
          <button class="btn btn-danger" style="font-size:0.55rem;padding:3px 12px;flex-shrink:0;"
            onclick="TabWinter.confirmDeath('${n.id}')">✕ Confirm Death</button>
        </div>`;
    }).join('');
    return `
      <div class="winter-deaths-block">
        <div class="winter-deaths-title">
          ☠ Deaths — Pending Confirmation
          <span class="winter-deaths-count">${npcs.length}</span>
        </div>
        <div class="winter-deaths-list">${rows}</div>
      </div>`;
  },

  _hhBlock(hhName, npcs) {
    const hh  = STORE.getHousehold(hhName);
    const col = hh?.colour || 'var(--ink-soft)';
    const icon = hh?.icon || '🏠';
    const rows = npcs.map(n => this._npcRow(n)).join('');
    return `
      <div class="winter-hh-block" style="border-left-color:${col};">
        <div class="winter-hh-title" style="color:${col};">${icon} ${hhName || 'No Household'}</div>
        <div class="winter-npc-list">${rows}</div>
      </div>`;
  },

  _npcRow(n) {
    const age    = n.year_born ? STORE.year - n.year_born : null;
    const cat    = this._getCategory(n);
    const autoEx = this._isAutoExempt(n);
    const manEx  = this._manualExempt.has(n.id);
    const exempt = autoEx || manEx;
    const res    = this._results[n.id];
    const ageStr = age !== null ? `Age ${age}` : '?';

    let resBadge = '';
    if (res) {
      const col = res.result === 'Death' ? 'var(--crimson-mid)' : 'var(--verdigris-mid)';
      resBadge = `<span class="winter-result-badge" style="background:${col};">${res.result}</span>
                  <span class="winter-roll-detail">[${res.rolls.join(' → ')}]</span>`;
    }

    let actionBtn = '';
    if (!exempt && !res) {
      actionBtn = `<button class="btn btn-ghost" style="font-size:0.52rem;padding:2px 8px;" onclick="TabWinter.rollOne('${n.id}')">Roll</button>`;
    }

    let exemptTag = '';
    if (autoEx) {
      const role = (n.role||'').toLowerCase();
      const reason = role.includes('player') ? 'Player Knight'
        : n.fate_touched ? 'Fate-Touched'
        : role === 'page' ? 'Page'
        : role === 'squire' ? 'Squire'
        : n.blessed ? 'Blessed'
        : 'Exempt';
      exemptTag = `<span class="winter-exempt-tag">${reason}</span>`;
    }

    return `
      <div class="winter-npc-row${exempt?' exempt':''}${res?.result==='Death'?' dead-row':''}">
        <label class="winter-exempt-check" title="${autoEx?'Auto-exempt — cannot override':'Manually exempt this NPC'}">
          <input type="checkbox" ${exempt?'checked':''} ${autoEx?'disabled':''}
            onchange="TabWinter.toggleExempt('${n.id}', this.checked)">
        </label>
        <div style="flex:1;min-width:0;">
          <span class="winter-npc-name" data-npc-hover="${n.id}" role="button" tabindex="0" onclick="Components.openNpcCard('${n.id}')">${esc(n.name)}</span>
          ${exemptTag}
        </div>
        <span class="winter-age-str">${ageStr}</span>
        ${cat && !exempt ? `<span class="winter-cat-badge" style="background:${this._catColour(cat)};">${cat}</span>` : '<span style="min-width:64px;"></span>'}
        <div class="winter-result-col">
          ${resBadge}
          ${actionBtn}
        </div>
      </div>`;
  },

  // ── SURVIVAL DATA & ROLLING ────────────────────────────────
  _getEligible() {
    return [...STORE.living].sort((a, b) => {
      return (a.household||'').localeCompare(b.household||'') || a.name.localeCompare(b.name);
    });
  },

  _groupByHousehold(npcs) {
    const groups = {};
    npcs.forEach(n => {
      const key = n.household || '—';
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });
    return groups;
  },

  _isAutoExempt(npc) {
    if (npc.out_of_story)         return true;
    const role = (npc.role || '').toLowerCase();
    if (role.includes('player'))  return true;
    if (npc.fate_touched)         return true;
    if (role === 'page')          return true;
    if (role === 'squire')        return true;
    if (npc.blessed && npc.year_born && (STORE.year - npc.year_born) < 21) return true;
    return false;
  },

  _getCategory(npc) {
    if (!npc.year_born) return null;
    const age   = STORE.year - npc.year_born;
    const isShe = (npc.pronoun || '').toLowerCase().includes('she');

    if (isShe && age >= 15 && age <= 40) {
      const role = (npc.role || '').toLowerCase();
      // Female knights of any class roll on the Adult table
      const isKnight = role.includes('knight');
      if (!isKnight) {
        // Non-knight women roll Adult only if married to a Player Knight;
        // all others (unlinked, widowed, married to non-PK) use the Women table
        const spouseRels = STORE.getRelationships(npc.id)
          .filter(r => r.type === 'Spouse' || r.type === 'Betrothed');
        const marriedToPK = spouseRels.some(r => {
          const spId = r.sourceId === npc.id ? r.targetId : r.sourceId;
          const sp   = STORE.getNpc(spId);
          return sp && (sp.role || '').toLowerCase().includes('player');
        });
        if (!marriedToPK) return 'Women';
      }
      // Female knights and PK-wives fall through to Adult below
    }

    if (age <= 1)  return 'Infant';
    if (age <= 20) return 'Child';
    if (age <= 45) return 'Adult';
    if (age <= 65) return 'Elder';
    return 'Very Old';
  },

  _catColour(cat) {
    return { 'Infant':'#8a3020','Child':'#5a6a3a','Women':'#7a3a8a','Adult':'#3a5a7a','Elder':'#7a6a3a','Very Old':'#5a3a3a' }[cat] || 'var(--ink-soft)';
  },

  _d20() { return Math.floor(Math.random() * 20) + 1; },
  _d6()  { return Math.floor(Math.random() * 6)  + 1; },

  _roll(npc) {
    const cat = this._getCategory(npc);
    if (!cat) return null;
    const rolls = [];
    let result;
    switch (cat) {
      case 'Infant':   { const r = this._d20(); rolls.push(r); result = r <= 2 ? 'Death' : 'Safe'; break; }
      case 'Child':    { const r1 = this._d20(); rolls.push(r1); if (r1===1){ const r2=this._d20(); rolls.push(r2); result=r2<=5?'Death':'Safe'; } else result='Safe'; break; }
      case 'Women':    { const r1 = this._d20(); rolls.push(r1); if (r1<=2){ const r2=this._d20(); rolls.push(r2); result=r2<=10?'Death':'Safe'; } else result='Safe'; break; }
      case 'Adult':    { const r1 = this._d20(); rolls.push(r1); if (r1===1){ const r2=this._d20(); rolls.push(r2); result=r2<=10?'Death':'Safe'; } else result='Safe'; break; }
      case 'Elder':    { const r = this._d20(); rolls.push(r); result = r===1 ? 'Death' : 'Safe'; break; }
      case 'Very Old': { const r = this._d20(); rolls.push(r); result = r<=4  ? 'Death' : 'Safe'; break; }
    }
    return { category: cat, rolls, result };
  },

  rollAll() {
    this._getEligible().forEach(n => {
      if (this._isAutoExempt(n) || this._manualExempt.has(n.id) || this._results[n.id]) return;
      const r = this._roll(n);
      if (r) this._results[n.id] = r;
    });
    this._rolled = true;
    this._renderSurvival();
  },

  rollOne(npcId) {
    const npc = STORE.getNpc(npcId);
    if (!npc) return;
    const r = this._roll(npc);
    if (r) { this._results[npcId] = r; this._rolled = true; }
    this._renderSurvival();
  },

  clearRolls() {
    this._results = {};
    this._rolled  = false;
    this._search  = '';
    this._renderSurvival();
  },

  _onSearch(val) {
    this._search = val;
    this._renderSurvival();
    const input = document.getElementById('winterSearch');
    if (input) { input.focus(); input.setSelectionRange(val.length, val.length); }
  },

  toggleExempt(npcId, checked) {
    if (checked) { this._manualExempt.add(npcId); delete this._results[npcId]; }
    else           this._manualExempt.delete(npcId);
    this._renderSurvival();
  },

  // ── SURVIVAL DEATH CONFIRMATION ───────────────────────────
  confirmDeath(npcId) {
    const npc = STORE.getNpc(npcId);
    if (!npc) return;
    Modal.open(`
      <div style="min-width:340px;">
        <div class="modal-header"><h2 style="margin:0;font-size:1rem;">Confirm Death — ${esc(npc.name)}</h2></div>
        <div style="padding:16px 20px;">
          <p style="margin:0 0 12px;font-size:0.9rem;color:var(--ink-soft);">
            Winter claimed <strong>${esc(npc.name)}</strong>. Record the cause for the chronicles?
          </p>
          <div class="detail-field mb-8">
            <div class="detail-label">Year of Death</div>
            <input class="edit-input" id="wkill-year" type="number" value="${STORE.year}">
          </div>
          <div class="detail-field mb-12">
            <div class="detail-label">Cause (optional)</div>
            <input class="edit-input" id="wkill-notes" placeholder="Fever, old wounds, the cold…">
          </div>
          <div class="btn-row">
            <button class="btn btn-danger" onclick="TabWinter._doConfirmDeath('${npcId}')">✕ Record Death</button>
            <button class="btn btn-ghost"  onclick="Modal.close()">Cancel</button>
          </div>
        </div>
      </div>`);
  },

  _doConfirmDeath(npcId) {
    const year  = parseInt(document.getElementById('wkill-year')?.value, 10) || STORE.year;
    const notes = document.getElementById('wkill-notes')?.value?.trim() || 'Winter survival roll';
    const npc   = STORE.getNpc(npcId);
    STORE.killNpc(npcId, year, notes);
    delete this._results[npcId];
    Toast.success(`${npc?.name} moved to the Mausoleum`);
    Modal.close();
    this._renderSurvival();
  },

  // ══════════════════════════════════════════════════════════
  //  CHILDBIRTH SECTION
  // ══════════════════════════════════════════════════════════

  _renderBirths() {
    const el = document.getElementById('winterBirthSection');
    if (!el) return;

    const eligible = this._getBirthEligible();
    const q = this._birthSearch.toLowerCase().trim();
    const visible = q ? eligible.filter(n => n.name.toLowerCase().includes(q)) : eligible;
    const byHH = this._groupByHousehold(visible);

    // Summary
    let summaryHtml = '';
    if (this._birthRolled) {
      let nBirth = 0, nTragedy = 0, nNone = 0, nUnrolled = 0;
      eligible.forEach(n => {
        if (n.barren) return;
        const r = this._birthResults[n.id];
        if (!r) { nUnrolled++; return; }
        if (['success','critical','prestige'].includes(r.result)) nBirth++;
        else if (r.result === 'fumble' && r.fumbleType !== 'no_birth') nTragedy++;
        else nNone++;
      });
      summaryHtml = `
        <div class="winter-summary">
          ${nBirth   ? `<span class="wsumm wsumm-birth-new">⁺ ${nBirth} Birth${nBirth!==1?'s':''}</span>` : ''}
          ${nTragedy ? `<span class="wsumm wsumm-dead">⚠ ${nTragedy} Tragedies</span>` : ''}
          ${nNone    ? `<span class="wsumm wsumm-pending">✕ ${nNone} No Conception</span>` : ''}
          ${nUnrolled? `<span class="wsumm wsumm-pending">◌ ${nUnrolled} Pending</span>` : ''}
        </div>`;
    }

    const pendingBirths = eligible.filter(n => {
      const r = this._birthResults[n.id];
      return r && ['success','critical','prestige'].includes(r.result) && !r.confirmed;
    });
    const pendingTragedies = eligible.filter(n => {
      const r = this._birthResults[n.id];
      return r && r.result === 'fumble' && r.fumbleType && r.fumbleType !== 'no_birth' && !r.confirmed;
    });

    el.innerHTML = `
      <div class="winter-section">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap;">
          <div class="section-title" style="margin-bottom:0;">Childbirth Rolls</div>
          <button class="btn btn-primary" style="font-size:0.6rem;" onclick="TabWinter.rollAllBirths()">⚄ Roll All</button>
          ${this._birthRolled ? `<button class="btn btn-ghost" style="font-size:0.6rem;" onclick="TabWinter.clearBirths()">↺ Reset</button>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
          <input class="search-input winter-search" id="birthSearch" placeholder="Filter by name…"
            value="${this._birthSearch.replace(/"/g,'&quot;')}"
            oninput="TabWinter._onBirthSearch(this.value)" style="max-width:240px;">
          ${q ? `<span style="font-family:var(--font-heading);font-size:0.6rem;color:var(--ink-soft);">${visible.length} of ${eligible.length} shown</span>` : ''}
        </div>
        <div style="font-size:0.72rem;color:var(--ink-soft);margin-bottom:12px;line-height:1.5;">
          Eligible: women (she/her · age 18–40 · not barren). Roll All covers women with a living spouse.
          Use individual Roll for widowed or unmarried. ⚔ = fornication/adultery (bastard). ⚜ = prestige bypass.
        </div>
        ${summaryHtml}
        ${pendingBirths.length    ? this._pendingBirthsBlock(pendingBirths)       : ''}
        ${pendingTragedies.length ? this._pendingTragediesBlock(pendingTragedies) : ''}
        ${eligible.length === 0
          ? `<div class="empty-state" style="padding:40px 0;"><div class="empty-state-icon">🍼</div><div class="empty-state-text">No eligible women to roll for</div></div>`
          : visible.length === 0
            ? `<div class="empty-state" style="padding:30px 0;"><div class="empty-state-icon">🔍</div><div class="empty-state-text">No NPCs match "${this._birthSearch}"</div></div>`
            : Object.entries(byHH).map(([hh, npcs]) => this._birthHhBlock(hh, npcs)).join('')
        }
      </div>`;
  },

  _pendingBirthsBlock(npcs) {
    const rows = npcs.map(n => {
      const res = this._birthResults[n.id];
      const hh  = STORE.getHousehold(n.household);
      const col = hh?.colour || 'var(--ink-soft)';
      const { label } = this._birthResultDisplay(res);
      return `
        <div class="winter-death-row">
          <span class="winter-death-dot" style="background:${col};"></span>
          <div class="winter-death-name-col">
            <span class="winter-npc-name" data-npc-hover="${n.id}" role="button" tabindex="0" onclick="Components.openNpcCard('${n.id}')">${esc(n.name)}</span>
            <span class="winter-death-hh">${hh?.icon ? hh.icon+' ' : ''}${esc(n.household||'—')}</span>
          </div>
          <span class="winter-roll-detail" style="flex-shrink:0;">[${res.rolls.join(' → ')}]</span>
          <span class="winter-result-badge birth-badge" style="margin-left:auto;">${label}</span>
          <button class="btn btn-primary" style="font-size:0.55rem;padding:3px 12px;flex-shrink:0;"
            onclick="TabWinter.recordBirth('${n.id}')">✔ Record Birth</button>
        </div>`;
    }).join('');
    return `
      <div class="winter-births-block">
        <div class="winter-births-title">
          ⁺ Births — Pending Record
          <span class="winter-deaths-count" style="background:var(--verdigris-mid);">${npcs.length}</span>
        </div>
        <div class="winter-deaths-list">${rows}</div>
      </div>`;
  },

  _pendingTragediesBlock(npcs) {
    const LABELS = { child_dies:'⚠ Child Died in Birth', mother_dies:'⚠ Mother Dies', both_die:'⚠ Both Die', difficult_birth:'⚠ Difficult Birth (−1 CON)', barren:'⚠ Barren' };
    const rows = npcs.map(n => {
      const res = this._birthResults[n.id];
      const hh  = STORE.getHousehold(n.household);
      const col = hh?.colour || 'var(--ink-soft)';
      const label = LABELS[res.fumbleType] || '⚠ Tragedy';
      return `
        <div class="winter-death-row">
          <span class="winter-death-dot" style="background:${col};"></span>
          <div class="winter-death-name-col">
            <span class="winter-npc-name" data-npc-hover="${n.id}" role="button" tabindex="0" onclick="Components.openNpcCard('${n.id}')">${esc(n.name)}</span>
            <span class="winter-death-hh">${hh?.icon ? hh.icon+' ' : ''}${esc(n.household||'—')}</span>
          </div>
          <span class="winter-roll-detail" style="flex-shrink:0;">[${res.rolls.join(' → ')}]</span>
          <span class="winter-result-badge" style="background:var(--crimson-mid);margin-left:auto;">${label}</span>
          <button class="btn btn-danger" style="font-size:0.55rem;padding:3px 12px;flex-shrink:0;"
            onclick="TabWinter.resolveTragedy('${n.id}')">Resolve</button>
        </div>`;
    }).join('');
    return `
      <div class="winter-tragedies-block">
        <div class="winter-deaths-title" style="color:var(--crimson-mid);">
          ⚠ Tragedies — Pending Resolution
          <span class="winter-deaths-count">${npcs.length}</span>
        </div>
        <div class="winter-deaths-list">${rows}</div>
      </div>`;
  },

  _birthHhBlock(hhName, npcs) {
    const hh  = STORE.getHousehold(hhName);
    const col = hh?.colour || 'var(--ink-soft)';
    const icon = hh?.icon || '🏠';
    const rows = npcs.map(n => this._birthNpcRow(n)).join('');
    return `
      <div class="winter-hh-block" style="border-left-color:${col};">
        <div class="winter-hh-title" style="color:${col};">${icon} ${hhName || 'No Household'}</div>
        <div class="winter-npc-list">${rows}</div>
      </div>`;
  },

  _birthNpcRow(n) {
    const age    = n.year_born ? STORE.year - n.year_born : null;
    const ageStr = age !== null ? `Age ${age}` : '?';

    // Barren — show greyed out, no rolls
    if (n.barren) {
      const hh = STORE.getHousehold(n.household);
      return `
        <div class="winter-npc-row birth-npc-row barren-row">
          <div class="birth-row-top">
            <span class="winter-npc-name" style="opacity:0.45;" data-npc-hover="${n.id}" role="button" tabindex="0" onclick="Components.openNpcCard('${n.id}')">${esc(n.name)}</span>
            <span class="birth-mod-tag barren-tag" style="font-size:0.65rem;padding:2px 10px;">Barren</span>
            <span class="winter-age-str" style="margin-left:auto;opacity:0.45;">${ageStr}</span>
          </div>
        </div>`;
    }

    const res    = this._birthResults[n.id];
    const baseCon = n.con || 13;
    const userMod = this._modifiers[n.id] || 0;
    const autoMod = this._calcAutoMods(n);
    const effCon  = Math.max(1, baseCon + userMod + autoMod);
    const forn    = this._fornicationFlags.has(n.id);

    // Spouse tag
    const spouseRels = STORE.getRelationships(n.id).filter(r => r.type==='Spouse'||r.type==='Betrothed');
    let spouseTag = `<span class="birth-spouse-tag unmarried">no spouse</span>`;
    if (spouseRels.length) {
      const rel  = spouseRels[0];
      const spId = rel.sourceId === n.id ? rel.targetId : rel.sourceId;
      const sp   = STORE.getNpc(spId);
      if (sp) {
        const alive = STORE.living.some(l => l.id === spId);
        spouseTag = alive
          ? `<span class="birth-spouse-tag">♥ ${esc(sp.name)}</span>`
          : `<span class="birth-spouse-tag unmarried" title="${esc(sp.name)} is deceased">† widowed</span>`;
      }
    }

    // Auto mod tags
    let modTags = '';
    if (this._didBirthLastYear(n)) modTags += `<span class="birth-mod-tag">−10 prior birth</span>`;
    if (age && age > 35) modTags += `<span class="birth-mod-tag">−${age-35} age</span>`;
    if (n.barren) modTags += `<span class="birth-mod-tag barren-tag">Barren</span>`;

    // Result
    let resultHtml = '';
    if (res) {
      const { label, colour } = this._birthResultDisplay(res);
      resultHtml = `<span class="winter-result-badge" style="background:${colour};">${label}</span>
                    <span class="winter-roll-detail">[${res.rolls.join(' → ')}]</span>`;
    }

    // Actions
    let actionHtml = '';
    if (!res) {
      actionHtml = `
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
          <label class="birth-forn-label" title="Fornication / adultery — child is a bastard">
            <input type="checkbox" ${forn?'checked':''}
              onchange="TabWinter.toggleFornication('${n.id}', this.checked)">
            <span title="Fornication roll">⚔</span>
          </label>
          <button class="btn btn-ghost" style="font-size:0.52rem;padding:2px 8px;"
            onclick="TabWinter.rollOneBirth('${n.id}')">Roll</button>
          <button class="btn btn-ghost" style="font-size:0.52rem;padding:2px 8px;color:var(--gold-text);border-color:var(--gold-text);"
            onclick="TabWinter.prestigeBirth('${n.id}')" title="Prestige bonus — guaranteed healthy birth">⚜</button>
        </div>`;
    }

    return `
      <div class="winter-npc-row birth-npc-row">
        <div class="birth-row-top">
          <span class="winter-npc-name" data-npc-hover="${n.id}" role="button" tabindex="0" onclick="Components.openNpcCard('${n.id}')">${esc(n.name)}</span>
          ${spouseTag}
          <span class="winter-age-str" style="margin-left:auto;">${ageStr}</span>
        </div>
        <div class="birth-row-bottom">
          <div class="birth-con-group">
            <span class="birth-stat-label">CON</span>
            <input class="birth-stat-input" type="number" min="1" max="30" value="${baseCon}"
              onchange="TabWinter.updateCon('${n.id}', this.value)" title="Constitution score">
            ${modTags}
            <span class="birth-stat-sep">+</span>
            <span class="birth-stat-label">Mod</span>
            <input class="birth-stat-input" type="number" value="${userMod}"
              oninput="TabWinter.updateModifier('${n.id}', this.value)" title="Extra modifier">
            <span class="birth-eff-con" title="Effective CON">→ ${effCon}</span>
          </div>
          <div class="birth-row-actions">
            ${resultHtml}
            ${actionHtml}
          </div>
        </div>
      </div>`;
  },

  _birthResultDisplay(res) {
    if (!res) return { label: '?', colour: 'var(--ink-soft)' };
    if (res.result === 'failure') return { label: '✕ No Conception', colour: '#8a7a6a' };
    if (res.result === 'fumble' && res.fumbleType === 'no_birth') return { label: '◌ No Birth (prior year)', colour: '#8a7a6a' };
    if (res.result === 'fumble') {
      const labels = { child_dies:'⚠ Child Died', mother_dies:'⚠ Mother Dies', both_die:'⚠ Both Die', difficult_birth:'⚠ −1 CON', barren:'⚠ Barren' };
      return { label: labels[res.fumbleType]||'⚠ Tragedy', colour: 'var(--crimson-mid)' };
    }
    if (res.result === 'prestige') return { label: `⚜ Prestige ${res.children[0]?.sex==='boy'?'Boy':'Girl'}`, colour: 'var(--gold)' };
    if (res.critType === 'multiple') return { label: `✦ ${this._multiLabel(res.multiType)}`, colour: '#6a3a8a' };
    if (res.critType === 'blessed_boy')  return { label: '✦ Blessed Boy',  colour: 'var(--gold)' };
    if (res.critType === 'blessed_girl') return { label: '✦ Blessed Girl', colour: 'var(--gold)' };
    if (res.result === 'critical') return { label: '✦ Critical!', colour: '#6a3a8a' };
    if (res.result === 'success')  return { label: `✔ Healthy ${res.children[0]?.sex==='boy'?'Boy':'Girl'}`, colour: 'var(--verdigris-mid)' };
    return { label: '?', colour: 'var(--ink-soft)' };
  },

  _multiLabel(multiType) {
    return { twin_mixed:'Twin Boy & Girl', twin_girls_frat:'Twin Girls (Fraternal)', twin_boys_frat:'Twin Boys (Fraternal)', twin_girls_id:'Twin Girls (Identical)', twin_boys_id:'Twin Boys (Identical)', triplets:'Triplets' }[multiType] || 'Multiple Birth';
  },

  // ── BIRTH DATA HELPERS ─────────────────────────────────────
  _getBirthEligible() {
    return [...STORE.living].filter(n => {
      if (n.out_of_story) return false;
      if (!(n.pronoun||'').toLowerCase().includes('she')) return false;
      if (!n.year_born) return false;
      const age = STORE.year - n.year_born;
      return age >= 18 && age <= 40;
    }).sort((a, b) => (a.household||'').localeCompare(b.household||'') || a.name.localeCompare(b.name));
  },

  _calcAutoMods(npc) {
    let mod = 0;
    if (this._didBirthLastYear(npc)) mod -= 10;
    const age = npc.year_born ? STORE.year - npc.year_born : 0;
    if (age > 35) mod -= (age - 35);
    return mod;
  },

  _getEffectiveCon(npc) {
    return Math.max(1, (npc.con||13) + (this._modifiers[npc.id]||0) + this._calcAutoMods(npc));
  },

  _didBirthLastYear(npc) {
    return STORE.getRelationships(npc.id).some(r => {
      if ((r.type!=='Child' && r.type!=='Bastard') || r.targetId !== npc.id) return false;
      const child = STORE.getNpc(r.sourceId);
      return child && child.year_born === STORE.year - 1;
    });
  },

  _isFirstConception(npc) {
    return !STORE.getRelationships(npc.id).some(r =>
      (r.type==='Child'||r.type==='Bastard') && r.targetId === npc.id
    );
  },

  // ── BIRTH ROLLING ─────────────────────────────────────────
  _rollConception(npc, bastard) {
    const effCon = this._getEffectiveCon(npc);
    const d20 = this._d20();
    const rolls = [d20];
    let result, critType=null, multiRoll=null, multiType=null, tripletRolls=null;
    let fumbleRoll=null, fumbleType=null, children=[];

    if (d20 === 20) {
      result = 'fumble';
      if (this._didBirthLastYear(npc)) {
        fumbleType = 'no_birth';
      } else {
        const bonus = this._isFirstConception(npc) ? 1 : 0;
        fumbleRoll  = this._d6() + bonus;
        rolls.push(fumbleRoll);
        if      (fumbleRoll <= 1) fumbleType = 'child_dies';
        else if (fumbleRoll === 2) fumbleType = 'mother_dies';
        else if (fumbleRoll <= 4) fumbleType = 'both_die';
        else if (fumbleRoll <= 6) fumbleType = 'difficult_birth';
        else                       fumbleType = 'barren';
        if (fumbleType === 'child_dies' || fumbleType === 'both_die') {
          const sr = this._d20(); rolls.push(sr);
          children = [{ sex: sr%2===1?'boy':'girl', blessed: false }];
        }
      }
    } else if (d20 === effCon) {
      result = 'critical';
      const cr = this._d6(); rolls.push(cr);
      if (cr <= 4) {
        critType  = 'multiple';
        multiRoll = this._d20(); rolls.push(multiRoll);
        if      (multiRoll <= 7)  { multiType='twin_mixed';      children=[{sex:'boy',blessed:false},{sex:'girl',blessed:false}]; }
        else if (multiRoll <= 10) { multiType='twin_girls_frat'; children=[{sex:'girl',blessed:false},{sex:'girl',blessed:false}]; }
        else if (multiRoll <= 13) { multiType='twin_boys_frat';  children=[{sex:'boy',blessed:false},{sex:'boy',blessed:false}]; }
        else if (multiRoll <= 16) { multiType='twin_girls_id';   children=[{sex:'girl',blessed:false},{sex:'girl',blessed:false}]; }
        else if (multiRoll <= 19) { multiType='twin_boys_id';    children=[{sex:'boy',blessed:false},{sex:'boy',blessed:false}]; }
        else {
          multiType    = 'triplets';
          tripletRolls = [this._d6(), this._d6(), this._d6()]; rolls.push(...tripletRolls);
          children     = tripletRolls.map(r => ({ sex: r%2===1?'boy':'girl', blessed: false }));
        }
      } else if (cr === 5) { critType='blessed_boy';  children=[{sex:'boy', blessed:true}]; }
      else                  { critType='blessed_girl'; children=[{sex:'girl',blessed:true}]; }
    } else if (d20 < effCon) {
      result   = 'success';
      children = [{ sex: d20%2===1?'boy':'girl', blessed: false }];
    } else {
      result = 'failure';
    }

    return { rolls, result, critType, multiRoll, multiType, tripletRolls, fumbleRoll, fumbleType, children, bastard, confirmed: false };
  },

  rollAllBirths() {
    this._getBirthEligible().forEach(n => {
      if (n.barren) return;
      if (this._birthResults[n.id]) return;
      // Roll All: married women with a living spouse only
      const spouseRels = STORE.getRelationships(n.id).filter(r => r.type==='Spouse'||r.type==='Betrothed');
      if (!spouseRels.length) return;
      const rel = spouseRels[0];
      const spId = rel.sourceId===n.id ? rel.targetId : rel.sourceId;
      if (!STORE.living.some(l => l.id === spId)) return;  // spouse dead/missing
      this._birthResults[n.id] = this._rollConception(n, false);
    });
    this._birthRolled = true;
    this._renderBirths();
  },

  rollOneBirth(npcId) {
    const npc = STORE.getNpc(npcId);
    if (!npc) return;
    const bastard = this._fornicationFlags.has(npcId);
    this._birthResults[npcId] = this._rollConception(npc, bastard);
    this._birthRolled = true;
    this._renderBirths();
  },

  prestigeBirth(npcId) {
    const r = Math.floor(Math.random() * 2) + 1;
    this._birthResults[npcId] = {
      rolls: [], result: 'prestige', critType: null, multiType: null,
      children: [{ sex: r%2===1?'boy':'girl', blessed: false }],
      bastard: false, confirmed: false,
    };
    this._birthRolled = true;
    this._renderBirths();
  },

  clearBirths() {
    this._birthResults = {};
    this._birthRolled  = false;
    this._birthSearch  = '';
    this._fornicationFlags.clear();
    this._modifiers    = {};
    this._renderBirths();
  },

  _onBirthSearch(val) {
    this._birthSearch = val;
    this._renderBirths();
    const input = document.getElementById('birthSearch');
    if (input) { input.focus(); input.setSelectionRange(val.length, val.length); }
  },

  toggleFornication(npcId, checked) {
    if (checked) this._fornicationFlags.add(npcId);
    else         this._fornicationFlags.delete(npcId);
  },

  updateCon(npcId, val) {
    const npc = STORE.getNpc(npcId);
    if (!npc) return;
    const v = parseInt(val, 10);
    if (!isNaN(v) && v >= 1) { npc.con = v; STORE.save(); }
    this._renderBirths();
  },

  updateModifier(npcId, val) {
    const v = parseInt(val, 10);
    this._modifiers[npcId] = isNaN(v) ? 0 : v;
  },

  // ── RECORD BIRTH MODAL ────────────────────────────────────
  recordBirth(npcId) {
    const mother = STORE.getNpc(npcId);
    const res    = this._birthResults[npcId];
    if (!mother || !res) return;

    const children = res.children;
    const bastard  = res.bastard;

    let spouseId = '', spouseName = '';
    if (!bastard) {
      const spRels = STORE.getRelationships(npcId).filter(r => r.type==='Spouse'||r.type==='Betrothed');
      if (spRels.length) {
        const rel = spRels[0];
        spouseId  = rel.sourceId===npcId ? rel.targetId : rel.sourceId;
        spouseName = STORE.getNpc(spouseId)?.name || '';
      }
    }

    const childRows = children.map((c, i) => `
      <div class="birth-child-block">
        ${children.length > 1 ? `<div class="birth-child-label">Child ${i+1} of ${children.length} · ${c.sex==='boy'?'♂ Boy':'♀ Girl'}${c.blessed?' · ✦ Blessed':''}</div>` : (c.blessed ? `<div class="birth-child-label">✦ Blessed ${c.sex==='boy'?'Boy':'Girl'}</div>` : '')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div class="detail-field">
            <div class="detail-label">Name</div>
            <input class="edit-input" id="birth-name-${i}" placeholder="${c.sex==='boy'?'Boy':'Girl'}'s name…">
          </div>
          <div class="detail-field">
            <div class="detail-label">Pronoun</div>
            <select class="edit-input" id="birth-pronoun-${i}">
              <option value="he/him"${c.sex==='boy'?' selected':''}>he/him</option>
              <option value="she/her"${c.sex==='girl'?' selected':''}>she/her</option>
              <option value="they/them">they/them</option>
            </select>
          </div>
          ${c.blessed ? `<div class="detail-field" style="grid-column:1/-1;">
            <div class="detail-label">Blessing Description</div>
            <input class="edit-input" id="birth-blessing-${i}" placeholder="Describe the blessing…">
          </div>` : ''}
        </div>
      </div>`).join('');

    const fatherHtml = bastard
      ? `<div class="detail-field mb-8">
           <div class="detail-label">Father (optional — bastard)</div>
           ${buildNpcSearchHtml('birth-father-search','birth-father-id')}
         </div>`
      : `<div class="detail-field mb-8">
           <div class="detail-label">Father</div>
           <input class="edit-input" value="${spouseName}" readonly style="opacity:0.7;">
           <input type="hidden" id="birth-father-id" value="${spouseId}">
         </div>`;

    const titleLabel = res.result==='prestige' ? '⚜ Prestige Birth'
      : res.critType==='multiple'              ? '✦ Multiple Birth'
      : res.critType?.startsWith('blessed')    ? '✦ Blessed Birth'
      : '✔ Record Birth';

    Modal.open(`
      <div style="min-width:440px;max-width:560px;">
        <div class="modal-header">
          <h2 style="margin:0;font-size:1rem;">${titleLabel} — ${esc(mother.name)}</h2>
        </div>
        <div style="padding:16px 20px;">
          ${bastard ? `<div class="birth-bastard-notice">⚔ Bastard Birth — father unknown or unacknowledged</div>` : ''}
          <p style="margin:0 0 14px;font-size:0.85rem;color:var(--ink-soft);">
            <strong>${esc(mother.name)}</strong> bore ${children.length===1?'a child':children.length+' children'} in ${STORE.year} AD.
          </p>
          ${childRows}
          <div style="border-top:1px solid var(--vellum-deep);padding-top:12px;margin-top:8px;">
            <div class="detail-field mb-8">
              <div class="detail-label">Mother</div>
              <input class="edit-input" value="${mother.name}" readonly style="opacity:0.7;">
            </div>
            ${fatherHtml}
          </div>
          <div class="btn-row" style="margin-top:16px;">
            <button class="btn btn-primary"
              onclick="TabWinter._doRecordBirth('${npcId}', ${children.length}, ${bastard})">
              ✔ Record ${children.length>1?'Children':'Child'}
            </button>
            <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
          </div>
        </div>
      </div>`,
      bastard ? { onOpen: () => initNpcSearch('birth-father-search','birth-father-id') } : {}
    );
  },

  _doRecordBirth(npcId, childCount, bastard) {
    const mother = STORE.getNpc(npcId);
    const res    = this._birthResults[npcId];
    if (!mother || !res) return;

    const fatherId = document.getElementById('birth-father-id')?.value?.trim() || '';
    const created  = [];

    for (let i = 0; i < childCount; i++) {
      const name     = document.getElementById(`birth-name-${i}`)?.value?.trim() || `Child of ${mother.name}`;
      const pronoun  = document.getElementById(`birth-pronoun-${i}`)?.value || 'he/him';
      const blessing = document.getElementById(`birth-blessing-${i}`)?.value?.trim() || '';
      const cd       = res.children[i] || {};
      const notes    = [cd.blessed && blessing ? `✦ Blessing: ${blessing}` : '', bastard ? '⚔ Bastard' : ''].filter(Boolean).join('\n');

      const childId = STORE.addNpc({
        name, pronoun, year_born: STORE.year,
        household: mother.household || '',
        role: 'Baby', status: 'Alive',
        blessed: cd.blessed || false,
        fate_touched: false, notes,
      });

      STORE.addRelationship(childId, npcId, 'Child', '');
      if (fatherId) STORE.addRelationship(childId, fatherId, bastard ? 'Bastard' : 'Child', '');
      created.push(name);
    }

    res.confirmed = true;
    Modal.close();
    Toast.success(`${created.join(' & ')} added to the roster`);
    this._renderBirths();
  },

  // ── TRAGEDY RESOLUTION ────────────────────────────────────
  resolveTragedy(npcId) {
    const npc = STORE.getNpc(npcId);
    const res = this._birthResults[npcId];
    if (!npc || !res) return;

    const ft     = res.fumbleType;
    const sexStr = res.children?.[0]?.sex === 'girl' ? 'girl' : res.children?.[0]?.sex === 'boy' ? 'boy' : 'child';
    let body = '';

    if (ft === 'child_dies') {
      body = `
        <p style="margin:0 0 12px;">A ${sexStr} was born to <strong>${esc(npc.name)}</strong> but did not survive.</p>
        <div class="detail-field mb-12">
          <div class="detail-label">Child's Name (optional — for records)</div>
          <input class="edit-input" id="trag-child-name" placeholder="Leave blank to skip">
        </div>
        <div class="btn-row">
          <button class="btn btn-danger" onclick="TabWinter._doResolveTragedy('${npcId}','child_dies',true)">✕ Record & Resolve</button>
          <button class="btn btn-ghost"  onclick="TabWinter._doResolveTragedy('${npcId}','child_dies',false)">Skip Record</button>
          <button class="btn btn-ghost"  onclick="Modal.close()">Cancel</button>
        </div>`;
    } else if (ft === 'mother_dies') {
      body = `
        <p style="margin:0 0 12px;"><strong>${esc(npc.name)}</strong> died in childbirth.</p>
        <div class="detail-field mb-12">
          <div class="detail-label">Cause of Death</div>
          <input class="edit-input" id="trag-cause" value="Died in childbirth">
        </div>
        <div class="btn-row">
          <button class="btn btn-danger" onclick="TabWinter._doResolveTragedy('${npcId}','mother_dies')">✕ Record Death</button>
          <button class="btn btn-ghost"  onclick="Modal.close()">Cancel</button>
        </div>`;
    } else if (ft === 'both_die') {
      body = `
        <p style="margin:0 0 12px;"><strong>${esc(npc.name)}</strong> and her ${sexStr} both perished.</p>
        <div class="detail-field mb-8">
          <div class="detail-label">Child's Name (optional)</div>
          <input class="edit-input" id="trag-child-name" placeholder="Leave blank to skip">
        </div>
        <div class="detail-field mb-12">
          <div class="detail-label">Cause of Death</div>
          <input class="edit-input" id="trag-cause" value="Died in childbirth">
        </div>
        <div class="btn-row">
          <button class="btn btn-danger" onclick="TabWinter._doResolveTragedy('${npcId}','both_die')">✕ Record Both Deaths</button>
          <button class="btn btn-ghost"  onclick="Modal.close()">Cancel</button>
        </div>`;
    } else if (ft === 'difficult_birth') {
      body = `
        <p style="margin:0 0 12px;"><strong>${esc(npc.name)}</strong> survived a difficult birth but suffers a permanent −1 to CON (currently ${npc.con||13}).</p>
        <div class="btn-row">
          <button class="btn btn-danger" onclick="TabWinter._doResolveTragedy('${npcId}','difficult_birth')">Apply −1 CON</button>
          <button class="btn btn-ghost"  onclick="Modal.close()">Cancel</button>
        </div>`;
    } else if (ft === 'barren') {
      body = `
        <p style="margin:0 0 12px;">After this ordeal, <strong>${esc(npc.name)}</strong> will bear no more children. This is permanent.</p>
        <div class="btn-row">
          <button class="btn btn-danger" onclick="TabWinter._doResolveTragedy('${npcId}','barren')">Mark as Barren</button>
          <button class="btn btn-ghost"  onclick="Modal.close()">Cancel</button>
        </div>`;
    }

    Modal.open(`
      <div style="min-width:360px;">
        <div class="modal-header"><h2 style="margin:0;font-size:1rem;">⚠ Tragedy — ${esc(npc.name)}</h2></div>
        <div style="padding:16px 20px;font-size:0.88rem;color:var(--ink);line-height:1.6;">${body}</div>
      </div>`);
  },

  _doResolveTragedy(npcId, type, recordChild = true) {
    const mother = STORE.getNpc(npcId);
    const res    = this._birthResults[npcId];
    if (!mother) return;

    const childSex    = res?.children?.[0]?.sex;
    const childPron   = childSex === 'girl' ? 'she/her' : 'he/him';

    if (type === 'child_dies') {
      if (recordChild) {
        const name = document.getElementById('trag-child-name')?.value?.trim() || `Child of ${mother.name}`;
        const childId = STORE.addNpc({ name, pronoun: childPron, year_born: STORE.year, year_died: STORE.year, household: mother.household||'', role:'', status:'Dead', blessed:false, fate_touched:false, notes:'† Died in childbirth' });
        STORE.addRelationship(childId, npcId, 'Child', '');
        Toast.success(`${name} recorded in the Mausoleum`);
      } else {
        Toast.show('Tragedy resolved — no record created', 'warning');
      }
    } else if (type === 'mother_dies') {
      const cause = document.getElementById('trag-cause')?.value?.trim() || 'Died in childbirth';
      STORE.killNpc(npcId, STORE.year, cause);
      delete this._results[npcId];
      Toast.show(`${mother.name} moved to the Mausoleum`, 'warning');
    } else if (type === 'both_die') {
      const cname = document.getElementById('trag-child-name')?.value?.trim() || `Child of ${mother.name}`;
      const cause = document.getElementById('trag-cause')?.value?.trim() || 'Died in childbirth';
      const childId = STORE.addNpc({ name: cname, pronoun: childPron, year_born: STORE.year, year_died: STORE.year, household: mother.household||'', role:'', status:'Dead', blessed:false, fate_touched:false, notes:'† Died in childbirth' });
      STORE.addRelationship(childId, npcId, 'Child', '');
      STORE.killNpc(npcId, STORE.year, cause);
      delete this._results[npcId];
      Toast.show(`${mother.name} and ${cname} moved to the Mausoleum`, 'warning');
    } else if (type === 'difficult_birth') {
      mother.con = Math.max(1, (mother.con||13) - 1);
      STORE.save();
      Toast.show(`${mother.name}'s CON permanently reduced to ${mother.con}`, 'warning');
    } else if (type === 'barren') {
      mother.barren = true;
      STORE.save();
      Toast.show(`${mother.name} marked as Barren`, 'warning');
    }

    if (res) res.confirmed = true;
    Modal.close();
    this._renderSurvival();
    this._renderBirths();
  },

  // ══════════════════════════════════════════════════════════
  //  MARRIAGE SECTION
  // ══════════════════════════════════════════════════════════

  _SPOUSE_RANK_TABLE: [
    { min: 1,    max: 5,    rank: "Wealthy Commoner's Daughter",          dowry: "3d6+6 £",     glory: 0,   notes: "" },
    { min: 6,    max: 8,    rank: "Esquire's Daughter",                   dowry: "£3",          glory: 10,  notes: "Roll 1d6: daughter number" },
    { min: 9,    max: 10,   rank: "Household Knight's Daughter",          dowry: "1d6 £",       glory: 50,  notes: "Roll 1d6: daughter number" },
    { min: 11,   max: 11,   rank: "Rich Vassal Knight's Eldest Daughter", dowry: "1d3+6 £",     glory: 100, notes: "She is the eldest daughter" },
    { min: 12,   max: 20,   rank: "Vassal Knight's Daughter",             dowry: "1d6 £",       glory: 100, notes: "Roll 1d6: daughter number · Roll 1d6: number of brothers" },
    { min: 21,   max: 25,   rank: "Vassal Knight's Heiress",              dowry: "1d6+10 £ + 1 manor", glory: 100, notes: "" },
    { min: 26,   max: 27,   rank: "Wealthy Vassal Knight's Heiress",      dowry: "1d6 £ + 2 manors",   glory: 300, notes: "" },
    { min: 28,   max: 9999, rank: "Baron's Younger Daughter",             dowry: "1d6+10 £ + 1 manor", glory: 250, notes: "" },
  ],

  _getSpouseRank(total) {
    const t = Math.max(1, total);
    return this._SPOUSE_RANK_TABLE.find(e => t >= e.min && t <= e.max) || this._SPOUSE_RANK_TABLE[0];
  },

  _setSortMode(mode) {
    this._marriageSort = mode;
    this._renderMarriage();
  },

  _rankOrder(role) {
    const r = (role || '').toLowerCase();
    if (r.includes('king'))     return 0;
    if (r.includes('warlord'))  return 1;
    if (r.includes('baron'))    return 2;
    if (r.includes('lord'))     return 3;
    if (r.includes('banneret')) return 4;
    if (r.includes('noble'))    return 5;
    if (r.includes('dame'))     return 6;
    if (r.includes('knight'))   return 7;
    if (r.includes('steward'))  return 8;
    return 99;
  },

  _sortNpcs(list) {
    if (this._marriageSort === 'rank') {
      return [...list].sort((a, b) =>
        this._rankOrder(a.role) - this._rankOrder(b.role) || a.name.localeCompare(b.name)
      );
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  },

  _maidenAgeMod(age) {
    if (age <= 17) return 2;
    if (age === 18) return 4;
    if (age === 19) return 6;
    if (age === 20) return 8;
    return 8 + (age - 20) * 5;
  },

  // ── ELIGIBILITY ───────────────────────────────────────────
  _getMaidenEligible() {
    const knightRoles = ['knight','lord','baron','noble','steward','banneret','dame'];
    return [...STORE.living].filter(n => {
      if (n.out_of_story) return false;
      if (!(n.pronoun || '').toLowerCase().includes('she')) return false;
      if (!n.year_born) return false;
      const age = STORE.year - n.year_born;
      if (age < 17) return false;
      const roleL = (n.role || '').toLowerCase();
      if (knightRoles.some(r => roleL.includes(r))) return false;
      return !STORE.getRelationships(n.id).some(r =>
        (r.type === 'Spouse' || r.type === 'Betrothed') &&
        (r.sourceId === n.id || r.targetId === n.id)
      );
    }).sort((a, b) => (a.household||'').localeCompare(b.household||'') || a.name.localeCompare(b.name));
  },

  _getKnightEligible() {
    const eligibleRoles = ['king','warlord','knight','lord','baron','noble','steward','banneret','dame'];
    return [...STORE.living].filter(n => {
      if (n.out_of_story) return false;
      const roleL = (n.role || '').toLowerCase();
      if (!eligibleRoles.some(r => roleL.includes(r))) return false;
      if (!n.year_born) return false;
      if (STORE.year - n.year_born < 21) return false;
      return !STORE.getRelationships(n.id).some(r =>
        (r.type === 'Spouse' || r.type === 'Betrothed') &&
        (r.sourceId === n.id || r.targetId === n.id)
      );
    }).sort((a, b) => (a.household||'').localeCompare(b.household||'') || a.name.localeCompare(b.name));
  },

  _isBachelorKnight(npc) {
    return (npc.role || '').toLowerCase().includes('bachelor');
  },

  _getSpouseCandidates(npc) {
    const orientation = npc.marriage_orientation || 'hetero';
    const pronL = (npc.pronoun || 'he/him').toLowerCase();
    const npcIsShe = pronL.includes('she');
    const npcIsHe  = !npcIsShe && pronL.includes('he');

    return [...STORE.living].filter(c => {
      if (c.id === npc.id) return false;
      if (STORE.getRelationships(c.id).some(r =>
        (r.type === 'Spouse' || r.type === 'Betrothed') &&
        (r.sourceId === c.id || r.targetId === c.id)
      )) return false;

      const cPronL  = (c.pronoun || 'he/him').toLowerCase();
      const cIsShe  = cPronL.includes('she');
      const cIsHe   = !cIsShe && cPronL.includes('he');
      const cOrient = c.marriage_orientation || 'hetero';

      let npcWantsC;
      if (orientation === 'hetero')     npcWantsC = npcIsShe ? cIsHe : cIsShe;
      else if (orientation === 'homo')  npcWantsC = npcIsShe ? cIsShe : cIsHe;
      else                              npcWantsC = true;

      let cWantsNpc;
      if (cOrient === 'hetero')         cWantsNpc = cIsShe ? npcIsHe : npcIsShe;
      else if (cOrient === 'homo')      cWantsNpc = cIsShe ? npcIsShe : npcIsHe;
      else                              cWantsNpc = true;

      return npcWantsC && cWantsNpc;
    }).sort((a, b) => a.name.localeCompare(b.name));
  },

  // ── ROLLING ───────────────────────────────────────────────
  rollAllMaidens() {
    this._getMaidenEligible().forEach(n => {
      if (this._marriageResults[n.id]) return;
      const age    = n.year_born ? STORE.year - n.year_born : 17;
      const mod    = this._maidenAgeMod(age);
      const roll   = this._d20();
      const total  = roll + mod;
      const passed = total >= 20;
      let rankRoll = null, rankEntry = null;
      if (passed) { rankRoll = this._d20(); rankEntry = this._getSpouseRank(rankRoll); }
      this._marriageResults[n.id] = { rolls: [roll], modifier: mod, total, passed, rankRoll, rankEntry, type: 'maiden', confirmed: false };
    });
    this._marriageRolled = true;
    this._renderMarriage();
  },

  rollOneMaiden(npcId) {
    const npc = STORE.getNpc(npcId);
    if (!npc) return;
    const age     = npc.year_born ? STORE.year - npc.year_born : 17;
    const ageMod  = this._maidenAgeMod(age);
    const custMod = this._marriageModifiers[npcId] || 0;
    const mod     = ageMod + custMod;
    const roll    = this._d20();
    const total   = roll + mod;
    const passed  = total >= 20;
    let rankRoll = null, rankEntry = null;
    if (passed) { rankRoll = this._d20(); rankEntry = this._getSpouseRank(rankRoll); }
    this._marriageResults[npcId] = { rolls: [roll], modifier: mod, ageMod, custMod, total, passed, rankRoll, rankEntry, type: 'maiden', confirmed: false };
    this._marriageRolled = true;
    this._renderMarriage();
  },

  rollAllKnights() {
    this._getKnightEligible().forEach(n => {
      if (this._marriageResults[n.id]) return;
      if (this._isBachelorKnight(n) && !this._bachelorEligible.has(n.id)) return;
      const courtesy  = n.courtesy || 10;
      const waitYears = n.marriage_wait_years || 0;
      const target    = courtesy + waitYears;
      const roll      = this._d20();
      const courtesyPassed = roll <= target;
      // Failing courtesy does nothing — no wait increment, nothing changes
      this._marriageResults[n.id] = {
        rolls: [roll], target, courtesyPassed,
        rankRoll: null, rankEntry: null, waiting: false,
        type: 'knight', confirmed: false,
      };
    });
    this._marriageRolled = true;
    this._renderMarriage();
  },

  rollOneKnight(npcId) {
    const npc = STORE.getNpc(npcId);
    if (!npc) return;
    const courtesy  = npc.courtesy || 10;
    const waitYears = npc.marriage_wait_years || 0;
    const custMod   = this._marriageModifiers[npcId] || 0;
    const target    = courtesy + waitYears + custMod;
    const roll      = this._d20();
    const courtesyPassed = roll <= target;
    // Failing courtesy does nothing — no wait increment
    this._marriageResults[npcId] = {
      rolls: [roll], target, custMod, courtesyPassed,
      rankRoll: null, rankEntry: null, waiting: false,
      type: 'knight', confirmed: false,
    };
    this._marriageRolled = true;
    this._renderMarriage();
  },

  // Called when GM decides to roll rank (marry this year after passing courtesy)
  rollKnightRank(npcId) {
    const npc = STORE.getNpc(npcId);
    const res = this._marriageResults[npcId];
    if (!npc || !res || !res.courtesyPassed) return;
    const waitYears = npc.marriage_wait_years || 0;
    const rankRoll  = this._d20() + waitYears;
    res.rankRoll  = rankRoll;
    res.rankEntry = this._getSpouseRank(rankRoll);
    this._renderMarriage();
  },

  // Called when GM decides to wait (passed courtesy but hold out for better rank next year)
  waitKnight(npcId) {
    const npc = STORE.getNpc(npcId);
    const res = this._marriageResults[npcId];
    if (!npc || !res || !res.courtesyPassed) return;
    npc.marriage_wait_years = (npc.marriage_wait_years || 0) + 1;
    STORE.save();
    res.waiting = true;
    this._renderMarriage();
  },

  _toggleBachelorEligible(npcId, checked) {
    if (checked) this._bachelorEligible.add(npcId);
    else         this._bachelorEligible.delete(npcId);
    this._renderMarriage();
  },

  _setOrientation(npcId, val) {
    const npc = STORE.getNpc(npcId);
    if (!npc) return;
    npc.marriage_orientation = val;
    STORE.save();
  },

  _setWaitYears(npcId, val) {
    const npc = STORE.getNpc(npcId);
    if (!npc) return;
    const v = parseInt(val, 10);
    npc.marriage_wait_years = isNaN(v) ? 0 : Math.max(0, v);
    STORE.save();
  },

  _setMarriageMod(npcId, val) {
    const v = parseInt(val, 10);
    this._marriageModifiers[npcId] = isNaN(v) ? 0 : v;
  },

  _clearOneMarriageResult(npcId) {
    delete this._marriageResults[npcId];
    this._renderMarriage();
  },

  clearMarriage() {
    this._marriageResults   = {};
    this._marriageRolled    = false;
    this._bachelorEligible  = new Set();
    this._marriageModifiers = {};
    this._renderMarriage();
  },

  // ── RENDER ────────────────────────────────────────────────
  _renderMarriage() {
    const el = document.getElementById('winterMarriageSection');
    if (!el) return;

    const maidens = this._getMaidenEligible();
    const knights = this._getKnightEligible();

    const allPending = [...maidens, ...knights].filter(n => {
      const r = this._marriageResults[n.id];
      if (!r || r.confirmed) return false;
      if (r.type === 'maiden') return r.passed;
      return r.courtesyPassed && r.rankRoll !== null;
    });

    el.innerHTML =
      '<div class="winter-section">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap;">' +
          '<div class="section-title" style="margin-bottom:0;">Marriage Rolls</div>' +
          (this._marriageRolled ? '<button class="btn btn-ghost" style="font-size:0.6rem;" onclick="TabWinter.clearMarriage()">&#x21BA; Reset</button>' : '') +
        '</div>' +
        '<div style="font-size:0.72rem;color:var(--ink-soft);margin-bottom:16px;line-height:1.6;">' +
          'Maidens (she/her, 17+, not titled) roll 1d20 + age modifier — total 20+ marries. ' +
          'Knights &amp; Nobles (21+) roll d20 \u2264 Courtesy + Years Waited. Success \u2192 Wife\'s Rank table (d20 + Years Waited). ' +
          'Bachelor Knights need their lord\'s permission before rolling.' +
        '</div>' +
        (allPending.length ? this._pendingMarriagesBlock(allPending) : '') +
        this._renderMaidenSection(maidens) +
        this._renderKnightSection(knights) +
      '</div>';
  },

  _pendingMarriagesBlock(npcs) {
    const rows = npcs.map(n => {
      const res = this._marriageResults[n.id];
      const hh  = STORE.getHousehold(n.household);
      const col = hh?.colour || 'var(--ink-soft)';
      const rollStr = res.type === 'maiden'
        ? res.rolls[0] + '+' + res.modifier + '=' + res.total
        : res.rolls[0] + '/' + res.target;
      const rankLabel = res.rankEntry ? ('💒 ' + res.rankEntry.rank) : '💒 Marries!';
      return '<div class="winter-death-row">' +
        '<span class="winter-death-dot" style="background:' + col + ';"></span>' +
        '<div class="winter-death-name-col">' +
          '<span class="winter-npc-name" data-npc-hover="' + n.id + '" role="button" tabindex="0" onclick="Components.openNpcCard(\'' + n.id + '\')">' + esc(n.name) + '</span>' +
          '<span class="winter-death-hh">' + (hh?.icon ? hh.icon + ' ' : '') + esc(n.household || '—') + '</span>' +
        '</div>' +
        '<span class="winter-roll-detail" style="flex-shrink:0;">[' + rollStr + ']</span>' +
        '<span class="winter-result-badge birth-badge" style="background:#5a4a7a;margin-left:auto;">' + rankLabel + '</span>' +
        '<button class="btn btn-primary" style="font-size:0.65rem;padding:3px 12px;flex-shrink:0;" ' +
          'onclick="TabWinter.confirmMarriage(\'' + n.id + '\')">&#x1F492; Confirm</button>' +
        '<button class="btn btn-ghost" style="font-size:0.65rem;padding:3px 10px;flex-shrink:0;" ' +
          'title="Dismiss — no marriage this year" onclick="TabWinter._clearOneMarriageResult(\'' + n.id + '\')">&#x2715; Dismiss</button>' +
      '</div>';
    }).join('');
    return '<div class="winter-births-block">' +
      '<div class="winter-births-title" style="color:#8a6aaa;">&#x1F492; Marriages &#x2014; Pending Confirmation' +
        '<span class="winter-deaths-count" style="background:#5a4a7a;">' + npcs.length + '</span>' +
      '</div>' +
      '<div class="winter-deaths-list">' + rows + '</div>' +
    '</div>';
  },

  _sortToggle() {
    const isAlpha = this._marriageSort === 'alpha';
    return '<div style="display:flex;gap:4px;margin-left:auto;">' +
      '<button class="btn ' + (isAlpha  ? 'btn-primary' : 'btn-ghost') + '" style="font-size:0.6rem;padding:2px 9px;" ' +
        'onclick="TabWinter._setSortMode(\'alpha\')" title="Sort A–Z by name">A–Z</button>' +
      '<button class="btn ' + (!isAlpha ? 'btn-primary' : 'btn-ghost') + '" style="font-size:0.6rem;padding:2px 9px;" ' +
        'onclick="TabWinter._setSortMode(\'rank\')" title="Sort by rank / title">By Rank</button>' +
    '</div>';
  },

  _renderMaidenSection(maidens) {
    const sorted   = this._sortNpcs(maidens);
    const unrolled = sorted.filter(n => !this._marriageResults[n.id]);
    const header =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;margin-top:20px;flex-wrap:wrap;">' +
        '<div class="section-title" style="margin-bottom:0;">Maidens-in-Waiting</div>' +
        (unrolled.length ? '<button class="btn btn-primary" style="font-size:0.58rem;padding:3px 10px;" onclick="TabWinter.rollAllMaidens()">&#x2684; Roll All (' + unrolled.length + ')</button>' : '') +
        this._sortToggle() +
      '</div>' +
      '<div style="font-size:0.68rem;color:var(--ink-soft);margin-bottom:10px;">' +
        '1d20 + age modifier. 20+ = marries. Age 17:+2 &middot; 18:+4 &middot; 19:+6 &middot; 20:+8 &middot; 21+:+8+(age&minus;20)&times;5' +
      '</div>';

    if (!maidens.length) {
      return header +
        '<div class="empty-state" style="padding:20px 0;">' +
          '<div class="empty-state-icon">&#x1F470;</div>' +
          '<div class="empty-state-text">No eligible maidens (she/her, unmarried, age 17+, untitled)</div>' +
        '</div>';
    }
    return header + '<div class="winter-npc-list">' + sorted.map(n => this._maidenRow(n)).join('') + '</div>';
  },

  _renderKnightSection(knights) {
    const sorted   = this._sortNpcs(knights);
    const eligible = sorted.filter(n => !this._isBachelorKnight(n) || this._bachelorEligible.has(n.id));
    const unrolled = eligible.filter(n => !this._marriageResults[n.id]);
    const header =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;margin-top:24px;flex-wrap:wrap;">' +
        '<div class="section-title" style="margin-bottom:0;">Knights &amp; Nobles</div>' +
        (unrolled.length ? '<button class="btn btn-primary" style="font-size:0.58rem;padding:3px 10px;" onclick="TabWinter.rollAllKnights()">&#x2684; Roll All (' + unrolled.length + ')</button>' : '') +
        this._sortToggle() +
      '</div>' +
      '<div style="font-size:0.68rem;color:var(--ink-soft);margin-bottom:10px;">' +
        'Roll d20 \u2264 Courtesy + Years Waited to seek marriage. Success \u2192 Wife\'s Rank table (d20 + Years Waited). ' +
        'Years Waited stacks each failed winter; resets to 0 on marriage, widowing, or divorce. ' +
        'Bachelor Knights need the lord\'s permission (tick Eligible) before they may roll.' +
      '</div>';

    if (!knights.length) {
      return header +
        '<div class="empty-state" style="padding:20px 0;">' +
          '<div class="empty-state-icon">&#x2694;</div>' +
          '<div class="empty-state-text">No eligible unmarried knights or nobles (age 21+)</div>' +
        '</div>';
    }
    return header + '<div class="winter-npc-list">' + sorted.map(n => this._knightRow(n)).join('') + '</div>';
  },

  _maidenRow(n) {
    const age    = n.year_born ? STORE.year - n.year_born : null;
    const ageStr = age !== null ? 'Age ' + age : '?';
    const mod    = age !== null ? this._maidenAgeMod(age) : 0;
    const res    = this._marriageResults[n.id];
    const orient = n.marriage_orientation || 'hetero';

    const TAG  = 'font-family:var(--font-heading);font-size:0.72rem;letter-spacing:0.04em;padding:2px 8px;border-radius:8px;';
    const orientSel =
      '<select style="' + TAG + 'border:1px solid var(--vellum-deep);background:var(--vellum);color:var(--ink);cursor:pointer;margin-left:6px;" ' +
        'onchange="TabWinter._setOrientation(\'' + n.id + '\', this.value)" title="Marriage orientation">' +
        '<option value="hetero"' + (orient === 'hetero' ? ' selected' : '') + '>Hetero</option>' +
        '<option value="homo"'   + (orient === 'homo'   ? ' selected' : '') + '>Homo</option>' +
        '<option value="bi"'     + (orient === 'bi'     ? ' selected' : '') + '>Bi</option>' +
      '</select>';

    const custMod = this._marriageModifiers[n.id] || 0;

    let resultHtml = '', dismissBtn = '';
    if (res) {
      const col   = res.passed ? '#5a4a7a' : '#6a6a6a';
      const rlabel = res.passed
        ? ('&#x1F492; ' + (res.rankEntry ? res.rankEntry.rank : 'Marries!') + ' (' + res.total + ')')
        : ('&#x2715; Not this year (' + res.total + ')');
      resultHtml  = '<span class="winter-result-badge" style="background:' + col + ';color:#fff;white-space:normal;max-width:320px;">' + rlabel + '</span>';
      if (!res.confirmed) dismissBtn = '<button class="btn btn-ghost" style="font-size:0.65rem;padding:2px 8px;" title="Clear this result" onclick="TabWinter._clearOneMarriageResult(\'' + n.id + '\')">&#x2715; Dismiss</button>';
    }

    const modInput = !res
      ? '<span style="' + TAG + 'color:var(--ink-soft);">Bonus</span>' +
        '<input class="birth-stat-input" type="number" style="width:46px;font-size:0.72rem;" ' +
          'value="' + custMod + '" ' +
          'oninput="TabWinter._setMarriageMod(\'' + n.id + '\', this.value)" title="+/- modifier added to this roll">'
      : '';

    const rollBtn = !res
      ? '<button class="btn btn-ghost" style="font-size:0.72rem;" onclick="TabWinter.rollOneMaiden(\'' + n.id + '\')">Roll</button>'
      : '';

    const roleTag = n.role
      ? '<span style="' + TAG + 'background:rgba(60,60,80,0.1);border:1px solid rgba(60,60,80,0.25);color:var(--ink-soft);margin-left:6px;">' + esc(n.role) + '</span>'
      : '';

    return '<div class="winter-npc-row birth-npc-row">' +
      '<div class="birth-row-top">' +
        '<span class="winter-npc-name" data-npc-hover="' + n.id + '" role="button" tabindex="0" onclick="Components.openNpcCard(\'' + n.id + '\')">' + esc(n.name) + '</span>' +
        roleTag +
        '<span style="' + TAG + 'background:rgba(90,74,58,0.15);border:1px solid rgba(90,74,58,0.35);color:var(--ink);margin-left:6px;">+' + mod + ' age mod</span>' +
        orientSel +
        '<span class="winter-age-str" style="margin-left:auto;">' + ageStr + '</span>' +
      '</div>' +
      '<div class="birth-row-bottom">' +
        '<div class="birth-con-group">' + modInput + '</div>' +
        '<div class="birth-row-actions">' + resultHtml + dismissBtn + rollBtn + '</div>' +
      '</div>' +
    '</div>';
  },

  _knightRow(n) {
    const age       = n.year_born ? STORE.year - n.year_born : null;
    const ageStr    = age !== null ? 'Age ' + age : '?';
    const courtesy  = n.courtesy || 10;
    const waitYears = n.marriage_wait_years || 0;
    const target    = courtesy + waitYears;
    const res       = this._marriageResults[n.id];
    const orient    = n.marriage_orientation || 'hetero';
    const isBach    = this._isBachelorKnight(n);
    const bachOk    = !isBach || this._bachelorEligible.has(n.id);

    const TAG  = 'font-family:var(--font-heading);font-size:0.72rem;letter-spacing:0.04em;padding:2px 8px;border-radius:8px;';
    const orientSel =
      '<select style="' + TAG + 'border:1px solid var(--vellum-deep);background:var(--vellum);color:var(--ink);cursor:pointer;" ' +
        'onchange="TabWinter._setOrientation(\'' + n.id + '\', this.value)" title="Marriage orientation">' +
        '<option value="hetero"' + (orient === 'hetero' ? ' selected' : '') + '>Hetero</option>' +
        '<option value="homo"'   + (orient === 'homo'   ? ' selected' : '') + '>Homo</option>' +
        '<option value="bi"'     + (orient === 'bi'     ? ' selected' : '') + '>Bi</option>' +
      '</select>';

    const waitInput =
      '<span style="' + TAG + 'color:var(--ink-soft);margin-left:8px;">Years waited</span>' +
      '<input class="birth-stat-input" type="number" min="0" style="width:46px;font-size:0.72rem;" ' +
        'value="' + waitYears + '" ' +
        'onchange="TabWinter._setWaitYears(\'' + n.id + '\', this.value)" title="Years waited (bonus to Courtesy check + Rank roll)">';

    const bachCheck = isBach
      ? '<label style="font-family:var(--font-heading);font-size:0.72rem;cursor:pointer;display:flex;align-items:center;gap:4px;margin-left:10px;color:var(--ink);" ' +
          'title="Bachelor Knights need their lord\'s permission to seek marriage">' +
          '<input type="checkbox"' + (this._bachelorEligible.has(n.id) ? ' checked' : '') +
            ' onchange="TabWinter._toggleBachelorEligible(\'' + n.id + '\', this.checked)">' +
          'Eligible to marry?' +
        '</label>'
      : '';

    const custMod = this._marriageModifiers[n.id] || 0;

    let resultHtml = '', dismissBtn = '', actionHtml = '';

    if (!res) {
      // Not yet rolled
      actionHtml = bachOk
        ? '<button class="btn btn-ghost" style="font-size:0.72rem;" onclick="TabWinter.rollOneKnight(\'' + n.id + '\')">Roll Courtesy</button>'
        : '<span style="font-size:0.72rem;color:var(--ink-soft);font-style:italic;">Needs lord\'s permission</span>';
    } else if (!res.courtesyPassed) {
      // Failed courtesy — nothing happens, just show the miss
      resultHtml = '<span class="winter-result-badge" style="background:#6a6a6a;color:#fff;">&#x2715; Failed (' + res.rolls[0] + '/' + target + ')</span>';
      dismissBtn = '<button class="btn btn-ghost" style="font-size:0.65rem;padding:2px 8px;" onclick="TabWinter._clearOneMarriageResult(\'' + n.id + '\')">&#x2715; Dismiss</button>';
    } else if (res.waiting) {
      // Passed but chose to wait — years waited already incremented
      const newWait = n.marriage_wait_years || 0;
      resultHtml = '<span class="winter-result-badge" style="background:#7a6a3a;color:#fff;">&#x23F3; Waiting — now +' + newWait + ' yr bonus</span>';
      dismissBtn = '<button class="btn btn-ghost" style="font-size:0.65rem;padding:2px 8px;" onclick="TabWinter._clearOneMarriageResult(\'' + n.id + '\')">&#x2715; Dismiss</button>';
    } else if (res.rankRoll !== null) {
      // Passed courtesy AND rolled rank — ready to confirm
      const rankNote = res.rankEntry ? ' \u2014 ' + res.rankEntry.rank : '';
      resultHtml = '<span class="winter-result-badge" style="background:#5a4a7a;color:#fff;white-space:normal;max-width:360px;">&#x1F492; Marries!' + rankNote + ' (' + res.rolls[0] + '/' + target + ')</span>';
      if (!res.confirmed) dismissBtn = '<button class="btn btn-ghost" style="font-size:0.65rem;padding:2px 8px;" onclick="TabWinter._clearOneMarriageResult(\'' + n.id + '\')">&#x2715; Dismiss</button>';
    } else {
      // Passed courtesy — GM decides: roll rank now or wait
      resultHtml = '<span class="winter-result-badge" style="background:#3a6a3a;color:#fff;">&#x2714; Courtesy Passed! (' + res.rolls[0] + '/' + target + ')</span>';
      actionHtml =
        '<button class="btn btn-primary" style="font-size:0.65rem;padding:3px 10px;" onclick="TabWinter.rollKnightRank(\'' + n.id + '\')">&#x1F3B2; Roll Rank Table</button>' +
        '<button class="btn btn-ghost"   style="font-size:0.65rem;padding:3px 10px;" onclick="TabWinter.waitKnight(\'' + n.id + '\')" title="Wait this year — adds +1 to years waited for a better rank next winter">&#x23F3; Wait</button>';
      dismissBtn = '<button class="btn btn-ghost" style="font-size:0.65rem;padding:2px 8px;" onclick="TabWinter._clearOneMarriageResult(\'' + n.id + '\')">&#x2715; Dismiss</button>';
    }

    const modInput = !res && bachOk
      ? '<span style="' + TAG + 'color:var(--ink-soft);margin-left:8px;">Bonus</span>' +
        '<input class="birth-stat-input" type="number" style="width:46px;font-size:0.72rem;" ' +
          'value="' + custMod + '" ' +
          'oninput="TabWinter._setMarriageMod(\'' + n.id + '\', this.value)" title="+/- modifier added to target (makes roll easier/harder)">'
      : '';

    const roleTag = n.role
      ? '<span style="' + TAG + 'background:rgba(60,60,80,0.1);border:1px solid rgba(60,60,80,0.25);color:var(--ink-soft);margin-left:6px;">' + esc(n.role) + '</span>'
      : '';

    return '<div class="winter-npc-row birth-npc-row">' +
      '<div class="birth-row-top">' +
        '<span class="winter-npc-name" data-npc-hover="' + n.id + '" role="button" tabindex="0" onclick="Components.openNpcCard(\'' + n.id + '\')">' + esc(n.name) + '</span>' +
        roleTag +
        '<span style="' + TAG + 'background:rgba(40,80,120,0.15);border:1px solid rgba(40,80,120,0.35);color:var(--ink);margin-left:6px;">Courtesy ' + courtesy + '</span>' +
        (waitYears > 0 ? '<span style="' + TAG + 'background:rgba(90,50,90,0.15);border:1px solid rgba(90,50,90,0.35);color:var(--ink);">+' + waitYears + ' yr waited</span>' : '') +
        (isBach ? '<span style="' + TAG + 'background:rgba(160,120,40,0.2);border:1px solid rgba(160,120,40,0.4);color:var(--ink);">Bachelor</span>' : '') +
        '<span class="winter-age-str" style="margin-left:auto;">' + ageStr + '</span>' +
      '</div>' +
      '<div class="birth-row-bottom">' +
        '<div class="birth-con-group">' + orientSel + waitInput + bachCheck + modInput + '</div>' +
        '<div class="birth-row-actions">' + resultHtml + dismissBtn + actionHtml + '</div>' +
      '</div>' +
    '</div>';
  },

  // ── CONFIRM MARRIAGE MODAL ────────────────────────────────
  confirmMarriage(npcId) {
    const npc = STORE.getNpc(npcId);
    const res = this._marriageResults[npcId];
    if (!npc || !res) return;

    const candidates = this._getSpouseCandidates(npc);
    const candOpts = candidates.length
      ? candidates.map(c => '<option value="' + c.id + '">' + esc(c.name) + (c.year_born ? ' (Age ' + (STORE.year - c.year_born) + ')' : '') + (c.role ? ' \u2014 ' + esc(c.role) : '') + '</option>').join('')
      : '<option value="">— No compatible NPCs found —</option>';

    const re = res.rankEntry;
    const rankNote = re
      ? '<div style="margin-bottom:14px;padding:10px 14px;background:var(--vellum-deep);border-radius:4px;font-size:0.82rem;line-height:1.7;">' +
          '<div><strong>Wife\'s Rank Roll:</strong> ' + res.rankRoll + (res.type === 'knight' ? ' (+' + (npc.marriage_wait_years || 0) + ' yrs waited)' : '') + ' \u2192 <strong>' + re.rank + '</strong></div>' +
          '<div style="display:flex;gap:20px;margin-top:4px;font-size:0.78rem;color:var(--ink-soft);">' +
            '<span>&#x1F4B0; Dowry: <strong style="color:var(--ink);">' + re.dowry + '</strong></span>' +
            '<span>&#x2605; Glory: <strong style="color:var(--ink);">' + re.glory + '</strong></span>' +
          '</div>' +
          (re.notes ? '<div style="margin-top:4px;font-size:0.75rem;color:var(--gold-text);font-style:italic;">&#x2692; ' + re.notes + '</div>' : '') +
        '</div>'
      : '';

    Modal.open(
      '<div style="min-width:420px;max-width:540px;">' +
        '<div class="modal-header"><h2 style="margin:0;font-size:1rem;">&#x1F492; Confirm Marriage \u2014 ' + esc(npc.name) + '</h2></div>' +
        '<div style="padding:16px 20px;">' +
          rankNote +
          '<p style="margin:0 0 14px;font-size:0.85rem;color:var(--ink-soft);">' +
            '<strong>' + esc(npc.name) + '</strong> is to be wed this winter of ' + STORE.year + ' AD. ' +
            'Pick an existing NPC or create a new spouse.' +
          '</p>' +
          '<div style="display:flex;gap:8px;margin-bottom:14px;">' +
            '<button class="btn btn-primary" id="marrTabPick" onclick="TabWinter._marriageTabSwitch(\'pick\')" style="flex:1;">Pick Existing NPC</button>' +
            '<button class="btn btn-ghost"   id="marrTabNew"  onclick="TabWinter._marriageTabSwitch(\'new\')"  style="flex:1;">Create New NPC</button>' +
          '</div>' +
          '<div id="marrPanelPick">' +
            '<div class="detail-field mb-8">' +
              '<div class="detail-label">Select Spouse (orientation-filtered)</div>' +
              '<select class="edit-input" id="marrPickId" style="width:100%;">' +
                '<option value="">\u2014 skip / unrecorded \u2014</option>' +
                candOpts +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div id="marrPanelNew" hidden>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
              '<div class="detail-field"><div class="detail-label">Name</div><input class="edit-input" id="marrNewName" placeholder="Spouse\'s name\u2026"></div>' +
              '<div class="detail-field"><div class="detail-label">Pronoun</div>' +
                '<select class="edit-input" id="marrNewPronoun">' +
                  '<option value="she/her">she/her</option>' +
                  '<option value="he/him">he/him</option>' +
                  '<option value="they/them">they/them</option>' +
                '</select>' +
              '</div>' +
              '<div class="detail-field"><div class="detail-label">Role / Rank</div><input class="edit-input" id="marrNewRole" placeholder="' + (re ? re.rank : 'Lady') + '"></div>' +
              '<div class="detail-field"><div class="detail-label">Year Born (optional)</div><input class="edit-input" id="marrNewYear" type="number" placeholder="' + (STORE.year - 20) + '"></div>' +
              '<div class="detail-field" style="grid-column:1/-1;"><div class="detail-label">Household</div><input class="edit-input" id="marrNewHousehold" value="' + esc(npc.household || '') + '"></div>' +
            '</div>' +
          '</div>' +
          '<div class="btn-row" style="margin-top:16px;">' +
            '<button class="btn btn-primary" onclick="TabWinter._doMarry(\'' + npcId + '\')">&#x1F492; Record Marriage</button>' +
            '<button class="btn btn-ghost"   onclick="Modal.close()">Cancel</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  },

  _marriageTabSwitch(mode) {
    const pickPanel = document.getElementById('marrPanelPick');
    const newPanel  = document.getElementById('marrPanelNew');
    const pickTab   = document.getElementById('marrTabPick');
    const newTab    = document.getElementById('marrTabNew');
    if (mode === 'pick') {
      if (pickPanel) pickPanel.hidden = false;
      if (newPanel)  newPanel.hidden  = true;
      if (pickTab) { pickTab.className = pickTab.className.replace('btn-ghost','btn-primary'); }
      if (newTab)  { newTab.className  = newTab.className.replace('btn-primary','btn-ghost'); }
    } else {
      if (pickPanel) pickPanel.hidden = true;
      if (newPanel)  newPanel.hidden  = false;
      if (pickTab) { pickTab.className = pickTab.className.replace('btn-primary','btn-ghost'); }
      if (newTab)  { newTab.className  = newTab.className.replace('btn-ghost','btn-primary'); }
    }
  },

  _doMarry(npcId) {
    const npc = STORE.getNpc(npcId);
    const res = this._marriageResults[npcId];
    if (!npc) return;

    const newPanel = document.getElementById('marrPanelNew');
    const isNew    = newPanel && !newPanel.hidden;

    let spouseId = '';
    if (isNew) {
      const name = document.getElementById('marrNewName')?.value?.trim();
      if (!name) { Toast.error('Please enter a name for the new spouse'); return; }
      const pronoun   = document.getElementById('marrNewPronoun')?.value  || 'she/her';
      const role      = document.getElementById('marrNewRole')?.value?.trim()      || '';
      const yearStr   = document.getElementById('marrNewYear')?.value?.trim();
      const year_born = yearStr ? parseInt(yearStr, 10) : null;
      const household = document.getElementById('marrNewHousehold')?.value?.trim() || '';
      spouseId = STORE.addNpc({ name, pronoun, role, year_born, household, status: 'Alive', blessed: false, fate_touched: false, notes: '' });
    } else {
      spouseId = document.getElementById('marrPickId')?.value?.trim() || '';
    }

    if (spouseId) {
      STORE.addRelationship(npcId, spouseId, 'Spouse', 'Married ' + STORE.year + ' AD');
    }

    npc.marriage_wait_years = 0;
    STORE.save();

    if (res) res.confirmed = true;
    Modal.close();
    const spouseName = spouseId ? (STORE.getNpc(spouseId)?.name || 'their new spouse') : '(unrecorded)';
    Toast.success(npc.name + ' married ' + spouseName + '!');
    this._renderMarriage();
  },
};
