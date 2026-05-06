/* ══════════════════════════════════════════════════════════════
   TAB: MANORS — full ledger with personnel, bars, expandable rows
══════════════════════════════════════════════════════════════ */

// Harvest outcome multipliers (Table 7, Pendragon 6e)
const HARVEST_MULT = {
  Incredible: 2.5, Excellent: 2.0, Good: 1.5, Regular: 1.0,
  Meager: 0.75, Bad: 0.5, 'Very Bad': 0.25, Negligible: 1 / 6,
};

// Steward's die (row) vs Misfortune's die (col) → outcome. null = tiebreaker needed.
// Source: Table 7 — Harvest Results Table, Pendragon 6e
const HARVEST_TABLE = {
  Critical: { Critical:'Regular',    Success:'Good',     Failure:'Excellent', Fumble:'Incredible' },
  Success:  { Critical:'Bad',        Success: null,      Failure:'Good',      Fumble:'Excellent'  },
  Failure:  { Critical:'Very Bad',   Success:'Bad',      Failure:'Regular',   Fumble:'Good'       },
  Fumble:   { Critical:'Negligible', Success:'Very Bad', Failure:'Bad',       Fumble:'Meager'     },
};

const LIFESTYLE_COST = { Impoverished:0, Poor:2, Normal:4, Rich:8, Extravagant:18 };

const HORSE_WAR    = ['Hobby','Charger (Small)','Charger (Normal)','Fairy Horse'];
const HORSE_RIDING = ['Jennet','Rouncey (Inferior)','Rouncy (Small)','Rouncy (Normal)','Rouncy (Large)','Courser','Dales/Irish/Cambrian Pony'];
const HORSE_WORK   = ['Cart Horse','Cob','Nag','Sumpter','Sumpter (Strong)','Hackney','Donkey','Mule'];
const HORSE_ALL    = [...HORSE_WAR, ...HORSE_RIDING, ...HORSE_WORK];

const TabManors = {
  _current:  null,
  _section:  'overview',        // overview | history | improvements | stables
  _playerSection: 'overview',   // overview | stables for player view
  _horsesCache: {},             // cacheKey → array of horse objects
  _expanded: new Set(),    // set of expanded history year keys
  _summaryExpanded: new Set(),    // manors with full history summary visible
  _summaryRowExpanded: new Set(), // individual year rows expanded in overview summary
  _recordOpen:   false,    // inline record-year panel open
  _workingEntry: null,     // in-progress year data for inline form

  render() {
    const panel = document.getElementById('tab-manors');
    if (!panel) return;

    const user = window.__USER__;
    if (user && user.role === 'player') {
      this._renderPlayerView(panel, user.household);
      return;
    }

    const keys = STORE.manorKeys();
    if (!keys.length) {
      panel.innerHTML = '<div class="empty-state mt-20"><div class="empty-state-icon">🏰</div><div class="empty-state-text">No manors loaded</div></div>';
      return;
    }
    if (!this._current || !keys.includes(this._current)) this._current = keys[0];

    const tabsHtml = keys.map(k => {
      const hh  = STORE.getHousehold(k);
      const col = hh ? hh.colour : '#5a5040';
      return `<button class="manor-tab${this._current===k?' active':''}" data-key="${esc(k)}" onclick="TabManors.selectManor(this.dataset.key)">
        <span class="hh-dot" style="background:${col};"></span>${esc(k)}
      </button>`;
    }).join('');

    panel.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
        <div class="manor-selector">${tabsHtml}</div>
        <div class="manor-body" id="manorBody"></div>
      </div>`;

    this._renderManor();
  },

  // ── PLAYER VIEW ────────────────────────────────────────────
  _renderPlayerView(panel, household) {
    const keys = STORE.manorKeys();
    if (!keys.length) {
      panel.innerHTML = '<div class="empty-state mt-20"><div class="empty-state-icon">🏰</div><div class="empty-state-text">No manors loaded</div></div>';
      return;
    }

    // Summary tiles for all manors (compact)
    const summaryTiles = keys.map(k => {
      const m        = STORE.getManor(k);
      const hh       = STORE.getHousehold(k);
      const col      = hh ? hh.colour : '#5a5040';
      const icon     = hh ? hh.icon   : '🏰';
      const treasury = STORE.manorTreasury(k);
      const last     = m.history?.length ? m.history[m.history.length - 1] : null;
      const lordNpc  = m.lord_id ? STORE.getNpc(m.lord_id) : null;
      const isOwn    = k.toLowerCase() === (household || '').toLowerCase();

      return `
        <div class="manor-stat-block" style="${isOwn ? `border-left:3px solid ${col};` : 'opacity:0.85;'}">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
            <span style="width:32px;height:32px;border-radius:var(--radius);background:${col}22;border:1px solid ${col}66;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">${icon}</span>
            <div>
              <div style="font-family:var(--font-display);font-size:0.9rem;color:var(--ink);">${k}</div>
              ${isOwn ? `<div style="font-family:var(--font-heading);font-size:0.48rem;letter-spacing:0.15em;text-transform:uppercase;color:${col};">Your Manor</div>` : ''}
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <div><div class="detail-label">Lord</div><div style="font-size:0.82rem;margin-top:2px;">${esc(lordNpc ? lordNpc.name : m.knight || '—')}</div></div>
            <div><div class="detail-label">Treasury</div>
              <div style="font-size:0.82rem;margin-top:2px;color:${treasury>0?'var(--verdigris-mid)':treasury<0?'var(--crimson-mid)':'var(--ink)'};font-weight:600;">${treasury} L</div>
            </div>
            ${last ? `
            <div style="margin-top:4px;"><div class="detail-label">Last Harvest</div><div style="margin-top:2px;">${harvestBadge(last.harvestOutcome||last.harvestResult)}</div></div>
            <div style="margin-top:4px;"><div class="detail-label">Conflict ${last.year}</div><div style="margin-top:2px;">${conflictBadge(last.conflict)}</div></div>
            ` : ''}
          </div>
        </div>`;
    }).join('');

    // Full detail for own manor (read-only)
    const ownKey = keys.find(k => k.toLowerCase() === (household || '').toLowerCase());
    let ownDetail = '';
    if (ownKey) {
      const m   = STORE.getManor(ownKey);
      const hh  = STORE.getHousehold(ownKey);
      const col = hh ? hh.colour : '#5a5040';
      const playerSecBtns = ['overview','stables'].map(s =>
        `<button class="btn ${this._playerSection===s?'btn-primary':'btn-ghost'}" style="font-size:0.58rem;" onclick="TabManors.setPlayerSection('${s}')">${s.charAt(0).toUpperCase()+s.slice(1)}</button>`
      ).join('');
      const playerContent = this._playerSection === 'stables'
        ? this._renderStables(m, ownKey, col, false)
        : this._renderOverview(m, ownKey, col, true);
      ownDetail = `
        <div style="margin-top:24px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div class="section-title" style="color:var(--gold);margin-bottom:0;">Your Manor — Full Detail</div>
            <div style="display:flex;gap:6px;">${playerSecBtns}</div>
          </div>
          ${playerContent}
        </div>`;
    }

    panel.innerHTML = `
      <div style="height:100%;overflow-y:auto;padding:20px 24px;background:var(--vellum);">
        <div class="section-title" style="margin-bottom:12px;">All Manors</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">
          ${summaryTiles}
        </div>
        ${ownDetail}
      </div>`;
  },

  selectManor(key) {
    this._workingEntry = null;
    this._current = key;
    this._section = 'overview';
    document.querySelectorAll('.manor-tab').forEach(el => el.classList.remove('active'));
    document.querySelector(`.manor-tab[data-key="${key.replace(/"/g,'&quot;')}"]`)?.classList.add('active');
    this._renderManor();
  },

  // ── MAIN RENDER ────────────────────────────────────────────
  _renderManor() {
    const body = document.getElementById('manorBody');
    if (!body) return;
    const key = this._current;
    const m   = STORE.getManor(key);
    if (!m) return;

    const hh   = STORE.getHousehold(key);
    const col  = hh ? hh.colour : '#5a5040';
    const icon = hh ? hh.icon  : '🏰';

    const sections = ['overview','history','improvements','stables'];
    const secBtns  = sections.map(s =>
      `<button class="btn ${this._section===s?'btn-primary':'btn-ghost'}" style="font-size:0.58rem;" onclick="TabManors.setSection('${s}')">${s.charAt(0).toUpperCase()+s.slice(1)}</button>`
    ).join('');

    let content = '';
    if      (this._section === 'overview')     content = this._renderOverview(m, key, col);
    else if (this._section === 'history')      content = this._renderHistory(m, key);
    else if (this._section === 'improvements') content = this._renderImprovementsSection(m, key);
    else if (this._section === 'stables')      content = this._renderStables(m, key, col, false);

    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding:14px 20px 0;flex-wrap:wrap;flex-shrink:0;">
        <div style="width:40px;height:40px;border-radius:var(--radius);background:${col}22;border:2px solid ${col};display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">${icon}</div>
        <div>
          <div style="font-family:var(--font-display);font-size:1.1rem;color:var(--ink);">${key} Manor</div>
          <div style="font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--ink-soft);opacity:0.55;">${m.knight||''} · ${m.player?'Player: '+m.player:''}</div>
        </div>
        <div style="margin-left:auto;display:flex;gap:6px;">${secBtns}</div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:16px 20px 24px;" id="manorContent">
        ${content}
      </div>`;

    // Wire up inline record form listeners after render
    if (this._section === 'overview' && this._recordOpen) {
      setTimeout(() => {
        const m2 = STORE.getManor(this._current);
        if (m2) this._initRecordListeners(this._current, m2);
      }, 0);
    }
  },

  // ── OVERVIEW ───────────────────────────────────────────────
  _renderOverview(m, key, col, readOnly = false) {
    const treasury  = STORE.manorTreasury(key);
    const activeImpr = (m.improvements||[]).filter(i=>i.status==='active');
    const dv         = activeImpr.reduce((s,i) => s+(i.dvMod||0), 0);
    const damaged    = (m.propertyDamage||[]).filter(d=>d.status==='damaged');
    const last       = m.history?.length ? m.history[m.history.length-1] : null;

    // ── Personnel ──────────────────────────────────────────
    const lordNpc    = m.lord_id    ? STORE.getNpc(m.lord_id)    : null;
    const stewardNpc = m.steward_id ? STORE.getNpc(m.steward_id) : null;
    const heirNpc    = m.heir_id    ? STORE.getNpc(m.heir_id)    : null;

    // Fallback: find steward from notes
    const stewardStr = !stewardNpc ? ((m.notes||'').match(/Steward:\s*(.+)/i)?.[1]?.trim()||'') : '';
    const stewardFallback = stewardStr.length > 0 ? STORE.living.find(n => n.name.toLowerCase().includes(stewardStr.toLowerCase())) : null;

    const npcBtn = (npc, placeholder, field) => {
      if (npc) return `<span class="npc-inline-link" data-npc-hover="${npc.id}" role="button" tabindex="0" onclick="Components.openNpcCard('${npc.id}')">${esc(npc.name)}</span>` +
        (readOnly ? '' : `<button class="btn btn-ghost" style="padding:2px 8px;font-size:0.5rem;margin-left:4px;" onclick="TabManors._pickPersonnel('${key}','${field}')">✎</button>`);
      if (readOnly) return '<span style="opacity:0.4;font-style:italic;">—</span>';
      return `<button class="btn btn-ghost" style="padding:3px 10px;font-size:0.55rem;" onclick="TabManors._pickPersonnel('${key}','${field}')">+ Set ${placeholder}</button>`;
    };

    const stewardRef = stewardNpc || stewardFallback;
    const stewardIndustryMatch = stewardRef?.skills?.match(/Industry[:\s]+(\d+)/i);
    const stewardSkillDisplay = stewardRef
      ? `<span style="font-family:var(--font-heading);font-size:0.78rem;color:var(--verdigris-mid);margin-left:8px;" title="Stewardship skill — used in manor fate checks">Stewardship: <strong>${m.steward_skill ?? '?'}</strong></span>` +
        (stewardIndustryMatch ? `<span style="font-family:var(--font-heading);font-size:0.78rem;color:var(--verdigris-mid);margin-left:8px;" title="Industry skill — extra income from steward">Industry: <strong>${stewardIndustryMatch[1]}</strong></span>` : '') +
        (readOnly ? '' : `<button class="btn btn-ghost" style="padding:2px 6px;font-size:0.48rem;margin-left:4px;" onclick="TabManors._editStewardSkill('${key}')">✎</button>`)
      : '';

    // ── Hatred / Care bars ────────────────────────────────
    const hatred = Math.max(0, m.hatred ?? 0);
    const care   = Math.max(0, m.care   ?? 0);

    const passionLabel = v => v <= 20 ? `${v} / 20` : `20+${v - 20}`;
    const passionPct   = v => Math.min(100, (Math.min(v, 20) / 20 * 100)).toFixed(1);
    const passionCrit  = v => v > 20;

    const barsHtml = `
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span style="font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--crimson-mid);">Hatred (Landlord)</span>
            <span style="font-family:var(--font-heading);font-size:0.65rem;color:var(--crimson-mid);">
              ${passionLabel(hatred)}
              ${passionCrit(hatred) ? `<span style="font-size:0.55rem;background:var(--crimson-mid);color:#fff;padding:1px 5px;border-radius:8px;margin-left:4px;">CRIT</span>` : ''}
            </span>
          </div>
          <div style="height:8px;background:var(--vellum-deep);border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${passionPct(hatred)}%;background:var(--crimson-mid);border-radius:4px;transition:width 0.3s;"></div>
          </div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
            <span style="font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--verdigris-mid);">Care (Commoners)</span>
            <span style="font-family:var(--font-heading);font-size:0.65rem;color:var(--verdigris-mid);">
              ${passionLabel(care)}
              ${passionCrit(care) ? `<span style="font-size:0.55rem;background:var(--verdigris-mid);color:#fff;padding:1px 5px;border-radius:8px;margin-left:4px;">CRIT</span>` : ''}
            </span>
          </div>
          <div style="height:8px;background:var(--vellum-deep);border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${passionPct(care)}%;background:var(--verdigris-mid);border-radius:4px;transition:width 0.3s;"></div>
          </div>
        </div>
      </div>`;

    // ── Latest year snapshot ──────────────────────────────
    const latestHtml = last ? `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:4px;">
        <div><div class="detail-label">Last Harvest</div><div style="margin-top:2px;">${harvestBadge(last.harvestOutcome||last.harvestResult)}</div></div>
        <div><div class="detail-label">Conflict</div><div style="margin-top:2px;">${conflictBadge(last.conflict)}</div></div>
        <div><div class="detail-label">Year</div><div style="font-family:var(--font-heading);font-size:0.85rem;color:var(--ink);margin-top:2px;">${last.year} AD</div></div>
      </div>` : '';

    // ── Property damage ───────────────────────────────────
    const damageHtml = damaged.length ? `
      <div class="section-title mt-16" style="color:var(--crimson-mid);">⚠ Property Damage</div>
      <div style="display:flex;flex-direction:column;gap:5px;">
        ${damaged.map(d => {
          const dueNow = d.yearRepaired && d.yearRepaired <= STORE.year;
          const fieldNote = d.type === 'Field' && d.numFields
            ? `<span style="font-family:var(--font-heading);font-size:0.68rem;color:var(--crimson-mid);margin-left:6px;">${d.numFields} field${d.numFields!==1?'s':''} (−${d.numFields} L/harvest)</span>` : '';
          const repairNote = d.yearRepaired && !dueNow
            ? `<span style="font-family:var(--font-heading);font-size:0.62rem;color:var(--ink-soft);opacity:0.6;margin-left:6px;">Est. repair: ${d.yearRepaired} AD</span>` : '';
          return `
          <div class="damage-item${dueNow?' damage-item-due':''}">
            <span class="damage-status damaged">${d.type||'Damaged'}</span>
            <span style="flex:1;">${esc(d.description)}${fieldNote}${repairNote}</span>
            <span style="font-family:var(--font-heading);font-size:0.75rem;color:var(--crimson-mid);">${d.repairCost>0?d.repairCost+' L':''}</span>
            ${readOnly ? '' : dueNow
              ? `<button class="btn btn-verdigris" style="padding:2px 10px;font-size:0.5rem;" onclick="TabManors._markRepaired('${key}',${d.id})">✓ Repaired?</button>`
              : `<button class="btn btn-ghost"    style="padding:2px 8px;font-size:0.5rem;"  onclick="TabManors._markRepaired('${key}',${d.id})">Repaired</button>`}
            ${readOnly ? '' : `<button class="btn btn-ghost" style="padding:2px 8px;font-size:0.5rem;" onclick="TabManors.openEditDamage('${key}',${d.id})">✎</button>`}
          </div>
          ${d.notes ? `<div style="font-size:0.78rem;color:var(--ink-soft);font-style:italic;padding:2px 8px 4px 8px;">${esc(d.notes)}</div>` : ''}`;
        }).join('')}
      </div>` : '';

    // ── Improvements quick list ───────────────────────────
    const imprHtml = activeImpr.length ? `
      <div class="section-title mt-16">Active Improvements (${activeImpr.length}${dv?' · DV +'+dv:''})</div>
      <div class="improvement-list">
        ${activeImpr.map(i=>`
          <div class="improvement-item ${i.cat==='fortification'?'fortification':''}">
            <div style="flex:1;"><div class="improvement-name">${esc(i.name)}</div><div class="improvement-note">${esc(i.notes||'')}</div></div>
            <div style="text-align:right;flex-shrink:0;">
              <div class="improvement-meta">Built ${i.yearBuilt}</div>
              <div class="improvement-meta">Maint: ${i.maintenance} L/yr${i.dvMod?' · DV +'+i.dvMod:''}</div>
              ${(i.income||i.incomeNote) ? `<div class="improvement-meta" style="color:var(--verdigris-mid);">Income: ${i.income?i.income+' L/yr':''}${i.income&&i.incomeNote?' + ':''}${i.incomeNote||''}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>` : '';

    // ── Household members (collapsed) ─────────────────────
    const household = STORE.householdMembers(key);
    const membersHtml = household.length ? `
      <div class="section-title mt-16" style="cursor:pointer;user-select:none;" role="button" tabindex="0" onclick="TabManors._toggleMembers('${key}')">
        <span id="membersCaret-${key}">▶</span> Household Members (${household.length})
      </div>
      <div id="membersPanel-${key}" style="display:none;">
        <div class="family-member-list mt-8">
          ${household.sort((a,b)=>a.name.localeCompare(b.name)).map(n=>`
            <div class="family-member-item" role="button" tabindex="0" onclick="Components.openNpcCard('${n.id}')">
              <span class="family-member-role" style="background:${roleColour(n.role)};padding:2px 7px;border-radius:10px;font-family:var(--font-heading);font-size:0.48rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--vellum);">${n.role||'?'}</span>
              <span class="family-member-name">${esc(n.name)}</span>
              ${n.glory?`<span class="family-member-age">${n.glory.toLocaleString()} gl.</span>`:''}
            </div>`).join('')}
        </div>
      </div>` : '';

    return `
      <!-- PERSONNEL -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div class="manor-stat-block">
          <div class="section-title">Key Personnel</div>
          <div class="manor-key-val">
            <span class="key">Lord / Lady</span>
            <span class="val">${npcBtn(lordNpc,'Lord/Lady','lord_id')}</span>
          </div>
          <div class="manor-key-val" style="flex-wrap:wrap;gap:4px;">
            <span class="key">Steward</span>
            <span class="val" style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">
              ${npcBtn(stewardNpc||(stewardFallback?{id:stewardFallback.id,name:stewardFallback.name}:null),'Steward','steward_id')}
              ${stewardSkillDisplay}
            </span>
          </div>
          <div class="manor-key-val">
            <span class="key">Heir</span>
            <span class="val">${npcBtn(heirNpc,'Heir','heir_id')}</span>
          </div>
          <div class="manor-key-val">
            <span class="key">Faction</span>
            <span class="val">${m.faction||'—'}</span>
          </div>
        </div>

        <div class="manor-stat-block">
          <div class="section-title">Manor Stats</div>
          <div class="manor-key-val"><span class="key">Base Harvest</span><span class="val">${m.baseHarvest} L</span></div>
          <div class="manor-key-val"><span class="key">Lifestyle</span><span class="val">${m.lifestyle||'Normal'}</span></div>
          <div class="manor-key-val">
            <span class="key">Treasury</span>
            <span class="val" style="color:${treasury>0?'var(--verdigris-mid)':treasury<0?'var(--crimson-mid)':'inherit'};font-weight:600;">${treasury} L</span>
          </div>
          <div class="manor-key-val"><span class="key">Defense Value</span><span class="val">${dv > 0 ? '+'+dv : dv || '0'}</span></div>
          <div style="margin-top:10px;">${barsHtml}</div>
        </div>
      </div>

      <!-- PREVIOUS YEAR + RECORD NEW YEAR TOGGLE -->
      ${last ? `<div class="manor-stat-block" style="margin-bottom:8px;">${latestHtml}</div>` : ''}

      <!-- INLINE RECORD PANEL (GM only) -->
      ${readOnly ? '' : `
      <div style="margin-bottom:16px;">
        <button class="btn ${this._recordOpen ? 'btn-primary' : 'btn-verdigris'}" style="width:100%;" onclick="TabManors.toggleRecord('${key}')">
          ${this._recordOpen ? '▲ Cancel Recording' : `▼ Record New Year (${STORE.year} AD)`}
        </button>
        ${this._recordOpen ? this._renderInlineRecord(m, key) : ''}
      </div>`}

      ${damageHtml}
      ${imprHtml}
      ${this._renderVassals(m, key)}
      ${this._renderHistorySummary(m, key)}
      ${membersHtml}

      <!-- NOTES -->
      ${m.notes ? `<div class="detail-block mt-16"><div class="detail-label">Notes</div><div class="detail-value" style="white-space:pre-wrap;">${esc(m.notes)}</div></div>` : ''}

      <!-- ACTIONS (GM only) -->
      ${readOnly ? '' : `
      <div class="btn-row mt-16">
        <button class="btn btn-ghost" onclick="TabManors.openAddImprovement('${key}')">+ Improvement</button>
        <button class="btn btn-ghost" onclick="TabManors.openAddDamage('${key}')">+ Damage</button>
        <button class="btn btn-ghost" onclick="TabManors._editManorNotes('${key}')">Edit Notes</button>
      </div>`}`;
  },

  _toggleMembers(key) {
    const panel  = document.getElementById(`membersPanel-${key}`);
    const caret  = document.getElementById(`membersCaret-${key}`);
    if (!panel) return;
    const open = panel.style.display === 'none';
    panel.style.display = open ? 'block' : 'none';
    if (caret) caret.textContent = open ? '▼' : '▶';
  },

  // ── VASSALS ────────────────────────────────────────────────
  _renderVassals(m, key) {
    const vassals = m.vassals || [];
    const TENURE_COLOURS = {
      Gifted:    'var(--verdigris-mid)',
      Granted:   'var(--gold)',
      Inherited: 'var(--cobalt-mid)',
      Seized:    'var(--crimson-mid)',
      Other:     'var(--ink-soft)',
    };
    const rows = vassals.map(v => {
      const knight = v.knightId ? STORE.getNpc(v.knightId) : null;
      const col = TENURE_COLOURS[v.tenure] || 'var(--ink-soft)';
      return `
        <div class="improvement-item" style="align-items:flex-start;">
          <div style="flex:1;">
            <div class="improvement-name">${esc(v.manorName)}</div>
            <div class="improvement-note" style="color:var(--verdigris-mid);">${v.passiveIncome ?? 1} L/yr</div>
            ${v.notes ? `<div class="improvement-note">${esc(v.notes)}</div>` : ''}
          </div>
          <div style="text-align:right;flex-shrink:0;margin-right:8px;">
            <div style="font-family:var(--font-heading);font-size:0.6rem;color:${col};margin-bottom:2px;">${v.tenure||'—'}</div>
            <div class="improvement-meta">
              ${knight ? `<span class="npc-inline-link" data-npc-hover="${knight.id}" role="button" tabindex="0" onclick="Components.openNpcCard('${knight.id}')">${esc(knight.name)}</span>` : '<span style="opacity:0.5;">No knight set</span>'}
            </div>
          </div>
          <button class="btn btn-ghost" style="padding:2px 7px;font-size:0.5rem;" onclick="TabManors.openEditVassal('${key}',${v.id})">✎</button>
          <button class="btn btn-ghost" style="padding:2px 7px;font-size:0.5rem;color:var(--crimson-mid);" onclick="TabManors._removeVassal('${key}',${v.id})">✕</button>
        </div>`;
    }).join('');

    return `
      <div class="section-title mt-16" style="display:flex;justify-content:space-between;align-items:center;">
        <span>Vassal Manors (${vassals.length}${vassals.length ? ' · +'+vassals.reduce((s,v)=>s+(v.passiveIncome??1),0)+' L/yr' : ''})</span>
        <button class="btn btn-ghost" style="padding:2px 10px;font-size:0.5rem;" onclick="TabManors.openAddVassal('${key}')">+ Add Vassal</button>
      </div>
      ${vassals.length ? `<div class="improvement-list">${rows}</div>` : `<div style="font-size:0.78rem;color:var(--ink-soft);opacity:0.6;padding:4px 0;">No vassal manors.</div>`}`;
  },

  openAddVassal(key) {
    this._openVassalModal(key, null);
  },

  openEditVassal(key, vassalId) {
    const m = STORE.getManor(key);
    const v = (m?.vassals||[]).find(v => v.id === vassalId);
    if (!v) return;
    this._openVassalModal(key, v);
  },

  _openVassalModal(key, v) {
    const isEdit = !!v;
    const tenureOpts = ['Gifted','Granted','Inherited','Seized','Other']
      .map(t => `<option${v?.tenure===t?' selected':''}>${t}</option>`).join('');
    const knightNpc = v?.knightId ? STORE.getNpc(v.knightId) : null;
    Modal.open(`
      <div style="min-width:340px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">${isEdit?'Edit':'Add'} Vassal Manor</div>
        <div class="detail-field mb-8">
          <div class="detail-label">Manor Name</div>
          <input class="edit-input" id="vas-name" value="${v?.manorName||''}">
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Tenure</div>
          <select class="edit-input edit-select" id="vas-tenure">${tenureOpts}</select>
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Current Knight</div>
          <div class="npc-search-wrap">
            <input class="edit-input npc-search-input" id="vas-knight-search" placeholder="Search NPC…" autocomplete="off">
            <input type="hidden" id="vas-knight-id" value="${v?.knightId||''}">
            <div id="vas-knight-search-results" class="npc-search-results" style="display:none;"></div>
          </div>
          ${knightNpc ? `<div style="font-size:0.78rem;margin-top:4px;color:var(--verdigris-mid);">Currently: ${esc(knightNpc.name)}</div>` : ''}
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Passive Manor Income (L/yr)</div>
          <input class="edit-input" id="vas-passive-income" type="number" value="${v?.passiveIncome ?? 1}" min="0" step="0.5">
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Notes</div>
          <input class="edit-input" id="vas-notes" value="${v?.notes||''}">
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabManors._saveVassal('${key}',${v?.id||'null'})">Save</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>
    `, {
      onOpen: () => initNpcSearch('vas-knight-search', 'vas-knight-id', STORE.allNpcs()),
    });
  },

  _saveVassal(key, vassalId) {
    const name = document.getElementById('vas-name')?.value?.trim();
    if (!name) { Toast.error('Manor name required'); return; }
    const data = {
      manorName:     name,
      tenure:        document.getElementById('vas-tenure')?.value        || 'Granted',
      knightId:      document.getElementById('vas-knight-id')?.value     || null,
      passiveIncome: parseFloat(document.getElementById('vas-passive-income')?.value) || 1,
      notes:         document.getElementById('vas-notes')?.value?.trim() || '',
    };
    if (vassalId && vassalId !== 'null') {
      STORE.updateVassal(key, vassalId, data);
    } else {
      STORE.addVassal(key, data);
    }
    Modal.close();
    Toast.success('Vassal manor saved');
    this._renderManor();
  },

  _removeVassal(key, vassalId) {
    STORE.removeVassal(key, vassalId);
    Toast.success('Vassal manor removed');
    this._renderManor();
  },

  // ── OVERVIEW HISTORY SUMMARY ───────────────────────────────
  _renderHistorySummary(m, key) {
    const history = [...(m.history||[])].sort((a,b) => b.year - a.year);
    if (!history.length) return '';

    const showAll = this._summaryExpanded.has(key);
    const PAGE    = 10;
    const visible = showAll ? history : history.slice(0, PAGE);
    const hasMore = history.length > PAGE;
    const thStyle = 'font-family:var(--font-heading);font-size:0.48rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--ink-soft);opacity:0.6;padding:2px 6px;';

    const rowHtml = visible.map(h => {
      const rKey     = `${key}-${h.year}`;
      const isOpen   = this._summaryRowExpanded.has(rKey);
      const treasury = h.treasury ?? 0;
      const tCol     = treasury > 0 ? 'var(--verdigris-mid)' : treasury < 0 ? 'var(--crimson-mid)' : 'inherit';
      const luckBadge = this._luckBadge(h.luck);

      // Budget detail panel shown when row is expanded
      const miscIn  = this._sumMiscItems(h.miscIncomeItems, h.miscIncome);
      const miscOut = this._sumMiscItems(h.miscExpItems,    h.miscExp);
      const totalIn  = (h.harvestIncome||0)+(h.improvIncome||0)+(h.discretionary||0)+(h.extraManorial||0)+miscIn+(h.stewardIndustry||0)+(h.vassalIncome||0);
      const totalOut = (h.lifestyleCost||0)+(h.improvMaint||0)+(h.family||0)+(h.improvBuild||0)+miscOut;
      const misfortune = (h.fateWeather||0)+(h.fateConflict||0)+(h.fateCommoners||0)+(h.fatePresence||0)+(h.fateMisc||0);
      const net      = totalIn - totalOut;

      const detailRow = isOpen ? `
        <tr>
          <td colspan="6" style="padding:0;">
            <div style="padding:10px 14px 12px;background:var(--vellum-mid);border-bottom:1px solid var(--vellum-deep);display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <div class="section-title mb-6" style="font-size:0.46rem;">Income</div>
                ${this._ledgerLine('Harvest',          h.harvestIncome,   'income')}
                ${this._ledgerLine('Steward Industry', h.stewardIndustry, 'income')}
                ${this._ledgerLine('Improvements',     h.improvIncome,    'income')}
                ${this._ledgerLine('Discretionary',    h.discretionary,   'income')}
                ${this._ledgerLine('Extra-Manorial',   h.extraManorial,   'income')}
                ${h.vassalIncome ? this._ledgerLine(`Passive Vassal Income`, h.vassalIncome, 'income') : ''}
                ${this._miscLedgerLines(h.miscIncomeItems, h.miscIncome, 'income', 'Misc Income')}
                <div style="border-top:1px solid var(--vellum-deep);margin-top:4px;padding-top:4px;">
                  ${this._ledgerLine('Total In', totalIn, 'income', true)}
                </div>
              </div>
              <div>
                <div class="section-title mb-6" style="font-size:0.46rem;">Expenses</div>
                ${this._ledgerLine('Lifestyle',    h.lifestyleCost, 'expense')}
                ${this._ledgerLine('Impr. Maint.', h.improvMaint,   'expense')}
                ${this._ledgerLine('Family',       h.family,        'expense')}
                ${this._ledgerLine('Build Cost',   h.improvBuild,   'expense')}
                ${this._miscLedgerLines(h.miscExpItems, h.miscExp, 'expense', 'Misc Expense')}
                <div style="border-top:1px solid var(--vellum-deep);margin-top:4px;padding-top:4px;">
                  ${this._ledgerLine('Total Out', totalOut, 'expense', true)}
                  ${this._ledgerLine('Net', net, net >= 0 ? 'income' : 'expense', true)}
                </div>
                ${h.notes ? `<div style="margin-top:8px;font-size:0.78rem;color:var(--ink-soft);font-style:italic;white-space:pre-wrap;">${esc(h.notes)}</div>` : ''}
              </div>
            </div>
          </td>
        </tr>` : '';

      return `
        <tr class="ledger-summary-row" style="cursor:pointer;" role="button" tabindex="0" onclick="TabManors._toggleSummaryRow('${key}', ${h.year})">
          <td style="font-family:var(--font-heading);font-size:0.7rem;color:var(--ink-soft);padding:4px 8px;white-space:nowrap;">${h.year} AD</td>
          <td style="padding:4px 6px;">${luckBadge}</td>
          <td style="padding:4px 6px;">${conflictBadge(h.conflict)}</td>
          <td style="padding:4px 6px;">${harvestBadge(h.harvestOutcome||h.harvestResult)}</td>
          <td style="font-family:var(--font-heading);font-size:0.72rem;color:${tCol};text-align:right;padding:4px 8px;font-weight:600;">${treasury >= 0 ? '+' : ''}${treasury} L</td>
          <td style="text-align:center;opacity:0.4;font-size:0.65rem;padding:4px 6px;">${isOpen ? '▲' : '▼'}</td>
        </tr>
        ${detailRow}`;
    }).join('');

    const footer = hasMore ? `
      <div style="text-align:center;margin-top:6px;">
        <button class="btn btn-ghost" style="font-size:0.55rem;letter-spacing:0.12em;" onclick="TabManors._toggleHistorySummary('${key}')">
          ${showAll ? '▲ Show last 10 only' : `▼ Show all ${history.length} years`}
        </button>
      </div>` : '';

    const yearsWithConflict = history.filter(h => h.conflict && h.conflict !== 'No Result' && h.conflict !== '—').length;

    return `
      <div class="section-title mt-16">Year-by-Year Summary</div>
      ${yearsWithConflict ? `<div style="font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.08em;color:var(--crimson-mid);margin-bottom:6px;">Years with Conflict: ${yearsWithConflict}</div>` : ''}
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.82rem;">
          <thead>
            <tr style="border-bottom:1px solid var(--vellum-deep);">
              <th style="${thStyle}text-align:left;">Year</th>
              <th style="${thStyle}">Luck</th>
              <th style="${thStyle}">Conflict</th>
              <th style="${thStyle}">Harvest</th>
              <th style="${thStyle}text-align:right;">Treasury</th>
              <th style="${thStyle}"></th>
            </tr>
          </thead>
          <tbody>${rowHtml}</tbody>
        </table>
      </div>
      ${footer}`;
  },

  _toggleHistorySummary(key) {
    if (this._summaryExpanded.has(key)) {
      this._summaryExpanded.delete(key);
    } else {
      this._summaryExpanded.add(key);
    }
    this._renderManor();
  },

  _toggleSummaryRow(key, year) {
    const rKey = `${key}-${year}`;
    if (this._summaryRowExpanded.has(rKey)) {
      this._summaryRowExpanded.delete(rKey);
    } else {
      this._summaryRowExpanded.add(rKey);
    }
    this._renderManor();
  },

  // ── INLINE RECORD YEAR ─────────────────────────────────────

  _getHarvestOutcome(steward, fate, tiebreaker) {
    const row = HARVEST_TABLE[steward];
    if (!row) return null;
    const result = row[fate];
    if (result === null) {
      if (tiebreaker === 'win')  return 'Regular';
      if (tiebreaker === 'lose') return 'Meager';
      return null; // unresolved tie
    }
    return result || null;
  },

  toggleRecord(key) {
    // Opening — check if this year is already recorded
    if (!this._recordOpen) {
      const m = STORE.getManor(key);
      const year = STORE.year;
      if (m && (m.history||[]).some(h => h.year === year)) {
        Modal.open(`
          <div class="modal-header"><h2 style="margin:0;">Year Already Recorded</h2></div>
          <div style="padding:16px 20px;">
            <p style="margin:0 0 16px;">${year} AD is already recorded for ${key}.</p>
            <div class="btn-row">
              <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
              <button class="btn btn-verdigris" onclick="Modal.close(); TabManors.openEditHistory('${key}', ${year})">Edit</button>
              <button class="btn btn-danger"   onclick="Modal.close(); TabManors._overwriteRecord('${key}', ${year})">Overwrite</button>
            </div>
          </div>`);
        return;
      }
    }
    this._recordOpen = !this._recordOpen;
    if (this._recordOpen && !this._workingEntry) {
      const m = STORE.getManor(key);
      const lastTreas  = STORE.manorTreasury(key);
      const activeI    = (m.improvements||[]).filter(i=>i.status==='active');
      const autoMaint  = activeI.reduce((s,i)=>s+(i.maintenance||0),0);
      const autoIncome = activeI.reduce((s,i)=>s+(i.income||0),0);
      this._workingEntry = {
        year: STORE.year,
        stewardResult: null, fateResult: null, tiebreaker: null,
        luck: 'No Result', luckSeason: '—',
        conflict: 'No Result', conflictSeason: '—',
        harvestOutcome: null, harvestIncome: 0,
        lifestyle: m.lifestyle || 'Normal',
        improvMaint: autoMaint,
        improvIncome: autoIncome,
        prevTreasury: lastTreas,
      };
    }
    if (!this._recordOpen) this._workingEntry = null;
    this._renderManor();
  },

  _overwriteRecord(key, year) {
    const m = STORE.getManor(key);
    if (!m) return;
    m.history = (m.history || []).filter(h => h.year !== year);
    STORE.save();
    this._recordOpen = false;
    this._workingEntry = null;
    this.toggleRecord(key);
  },

  _setTestResult(key, which, val) {
    const wp = this._workingEntry;
    if (!wp) return;
    if (which === 'steward') wp.stewardResult = val;
    else if (which === 'fate') wp.fateResult = val;
    else if (which === 'tb')  wp.tiebreaker  = val;
    // Clear tiebreaker if no longer a tie
    if (which !== 'tb' && !(wp.stewardResult === 'Success' && wp.fateResult === 'Success')) {
      wp.tiebreaker = null;
    }
    this._updateRecordCalcs(key, STORE.getManor(key));
  },

  _updateRecordCalcs(key, m) {
    const g  = id => document.getElementById(id);
    const wp = this._workingEntry;
    if (!wp || !m) return;

    // ── Harvest ──────────────────────────────────────────────
    const outcome = this._getHarvestOutcome(wp.stewardResult, wp.fateResult, wp.tiebreaker);
    const needsTB = wp.stewardResult === 'Success' && wp.fateResult === 'Success';
    const tbRow   = g('ry-tb-row');
    if (tbRow) tbRow.style.display = needsTB ? 'flex' : 'none';

    const mult          = outcome ? (HARVEST_MULT[outcome] ?? 1) : null;
    const baseIncome    = outcome ? Math.round((m.baseHarvest || 10) * mult) : 0;
    // Deduct 1 L per damaged field
    const fieldPenalty  = (m.propertyDamage||[])
      .filter(d => d.status === 'damaged' && d.type === 'Field' && d.numFields)
      .reduce((s, d) => s + d.numFields, 0);
    const harvestIncome = Math.max(0, baseIncome - fieldPenalty);
    wp.harvestIncome  = harvestIncome;
    wp.harvestOutcome = outcome;

    const hDisp = g('ry-harvest-display');
    if (hDisp) {
      if (outcome) {
        const col = mult >= 1 ? 'var(--verdigris-mid)' : mult >= 0.5 ? 'var(--gold)' : 'var(--crimson-mid)';
        const multStr = mult === 1/6 ? '×⅙' : `×${mult}`;
        const fieldStr = fieldPenalty > 0
          ? ` <span style="color:var(--crimson-mid);font-size:0.75rem;">−${fieldPenalty} L (${fieldPenalty} field${fieldPenalty!==1?'s':''} damaged)</span>`
          : '';
        hDisp.innerHTML = `<span style="color:${col};font-weight:600;">${outcome}</span> <span style="color:var(--ink-soft);font-size:0.78rem;">${multStr} of ${m.baseHarvest||10} L${fieldStr}</span><span style="float:right;color:${col};font-weight:600;font-family:var(--font-heading);">${harvestIncome} L</span>`;
      } else if (needsTB) {
        hDisp.innerHTML = `<span style="color:var(--gold);font-style:italic;">Select tiebreaker above</span>`;
      } else {
        hDisp.innerHTML = `<span style="color:var(--ink-soft);font-style:italic;">Select test results above</span>`;
      }
    }

    // ── Highlight test buttons ───────────────────────────────
    ['steward','fate'].forEach(which => {
      const val = which === 'steward' ? wp.stewardResult : wp.fateResult;
      g(`ry-${which}-btns`)?.querySelectorAll('.result-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.val === val);
      });
    });
    g('ry-tb-btns')?.querySelectorAll('.result-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === wp.tiebreaker);
    });

    // ── Totals ───────────────────────────────────────────────
    const miscIn  = this._readMiscItems('ry-misc-income-list').reduce((s,i)=>s+(parseFloat(i.amount)||0),0);
    const miscOut = this._readMiscItems('ry-misc-exp-list').reduce((s,i)=>s+(parseFloat(i.amount)||0),0);

    const stewardIndustry = parseFloat(g('ry-steward-industry')?.value) || 0;
    const improvIncome    = parseFloat(g('ry-impr-income')?.value)      || 0;
    const discretionary   = parseFloat(g('ry-discretionary')?.value)    || 0;
    const extraManorial   = parseFloat(g('ry-extra-manorial')?.value)   || 0;

    const lifestyleVal  = g('ry-lifestyle')?.value || 'Normal';
    const lifestyleCost = LIFESTYLE_COST[lifestyleVal] ?? 4;
    const lcEl = g('ry-lifestyle-cost');
    if (lcEl) lcEl.textContent = lifestyleCost + ' L';

    const improvMaint = parseFloat(g('ry-impr-maint')?.value) || 0;
    const family      = parseFloat(g('ry-family')?.value)     || 0;
    const improvBuild = parseFloat(g('ry-impr-build')?.value) || 0;

    const vassalIncome = (m.vassals||[]).reduce((s,v)=>s+(v.passiveIncome??1),0);
    const totalIn  = harvestIncome + stewardIndustry + improvIncome + discretionary + extraManorial + miscIn + vassalIncome;
    const totalOut = lifestyleCost + improvMaint + family + improvBuild + miscOut;
    const misfortune = ['weather','conflict','commoners','presence','misc']
      .reduce((s,f) => s + (parseFloat(g('ry-fate-'+f)?.value) || 0), 0);
    const mEl = g('ry-misfortune-total');
    if (mEl) mEl.textContent = misfortune;
    const prevT    = parseFloat(g('ry-prev-treasury')?.value) || 0;
    const net      = Math.round((totalIn - totalOut) * 10) / 10;
    const newT     = Math.round((prevT + net) * 10) / 10;

    const set = (id, text, col) => {
      const el = g(id);
      if (!el) return;
      el.textContent = text;
      if (col) el.style.color = col;
    };
    set('ry-total-in',  totalIn  + ' L');
    set('ry-total-out', totalOut + ' L');
    set('ry-net',  (net >= 0 ? '+' : '') + net + ' L',  net  >= 0 ? 'var(--verdigris-mid)' : 'var(--crimson-mid)');
    set('ry-new-t', newT + ' L', newT >= 0 ? 'var(--verdigris-mid)' : 'var(--crimson-mid)');
  },

  _initRecordListeners(key, m) {
    const g   = id => document.getElementById(id);
    const upd = () => this._updateRecordCalcs(key, m);
    ['ry-steward-industry','ry-impr-income','ry-discretionary','ry-extra-manorial',
     'ry-impr-maint','ry-family','ry-impr-build','ry-prev-treasury',
     'ry-fate-weather','ry-fate-conflict','ry-fate-commoners','ry-fate-presence','ry-fate-misc'].forEach(id => {
      g(id)?.addEventListener('input', upd);
    });
    g('ry-lifestyle')?.addEventListener('change', upd);
    // Event delegation for dynamically added misc item rows
    ['ry-misc-income-list','ry-misc-exp-list'].forEach(id => {
      g(id)?.addEventListener('input', upd);
    });
    upd(); // run once to set initial state
  },

  _renderInlineRecord(m, key) {
    const wp = this._workingEntry;
    if (!wp) return '';

    const RESULTS = ['Critical','Success','Failure','Fumble'];
    const rBtns = (which) => RESULTS.map(r =>
      `<button class="result-btn" data-val="${r}" onclick="TabManors._setTestResult('${key}','${which}','${r}')">${r}</button>`
    ).join('');

    const luckOpts     = ['No Result','Boon','Calamity'].map(v=>`<option${wp.luck===v?' selected':''}>${v}</option>`).join('');
    const sznOpts      = ['—','Spring','Summer','Fall','Winter'].map(v=>`<option>${v}</option>`).join('');
    const conflictOpts = ['No Result','Bandits','Raided','Pillaged','Plundered'].map(v=>`<option${wp.conflict===v?' selected':''}>${v}</option>`).join('');
    const lifestyleOpts= ['Impoverished','Poor','Normal','Rich','Extravagant'].map(v=>
      `<option${(wp.lifestyle||'Normal')===v?' selected':''}>${v}</option>`).join('');
    const lc0 = LIFESTYLE_COST[wp.lifestyle||'Normal'] ?? 4;
    const activeImprovements = (m.improvements||[]).filter(i=>i.status==='active');
    const autoMaint   = activeImprovements.reduce((s,i)=>s+(i.maintenance||0),0);
    const autoIncome  = activeImprovements.reduce((s,i)=>s+(i.income||0),0);
    const diceNotes   = activeImprovements.filter(i=>i.incomeNote).map(i=>`${i.name}: ${i.incomeNote}`).join(', ');

    return `
    <div style="background:var(--vellum-mid);border:1px solid var(--vellum-deep);border-radius:var(--radius);padding:16px 18px;margin-top:6px;">

      <!-- Year + Events -->
      <div style="display:grid;grid-template-columns:80px 1fr 80px 1fr 80px;gap:8px;align-items:end;margin-bottom:14px;">
        <div class="detail-field">
          <div class="detail-label">Year</div>
          <input class="edit-input" id="ry-year" type="number" value="${wp.year||STORE.year}" style="text-align:center;">
        </div>
        <div class="detail-field">
          <div class="detail-label">Luck</div>
          <select class="edit-input edit-select" id="ry-luck">${luckOpts}</select>
        </div>
        <div class="detail-field">
          <div class="detail-label">Season</div>
          <select class="edit-input edit-select" id="ry-luck-season">${sznOpts}</select>
        </div>
        <div class="detail-field">
          <div class="detail-label">Conflict</div>
          <select class="edit-input edit-select" id="ry-conflict">${conflictOpts}</select>
        </div>
        <div class="detail-field">
          <div class="detail-label">Season</div>
          <select class="edit-input edit-select" id="ry-conflict-season">${sznOpts}</select>
        </div>
      </div>

      <!-- Stewardship test -->
      <div class="section-title mb-8">Stewardship Test</div>
      <div style="display:grid;grid-template-columns:max-content 1fr;gap:5px 10px;align-items:center;margin-bottom:6px;">
        <span class="detail-label" style="white-space:nowrap;">Steward Roll</span>
        <div id="ry-steward-btns" class="result-btn-group">${rBtns('steward')}</div>
        <span class="detail-label" style="white-space:nowrap;">Misfortune Die</span>
        <div id="ry-fate-btns" class="result-btn-group">${rBtns('fate')}</div>
      </div>

      <!-- Tiebreaker — shown only when both Success -->
      <div id="ry-tb-row" style="display:${wp.stewardResult==='Success'&&wp.fateResult==='Success'?'flex':'none'};align-items:center;gap:10px;margin-bottom:6px;">
        <span class="detail-label" style="white-space:nowrap;color:var(--gold);">Tie — Who wins?</span>
        <div id="ry-tb-btns" class="result-btn-group">
          <button class="result-btn" data-val="win"  onclick="TabManors._setTestResult('${key}','tb','win')">Steward Wins → Regular</button>
          <button class="result-btn" data-val="lose" onclick="TabManors._setTestResult('${key}','tb','lose')">Misfortune Wins → Meager</button>
        </div>
      </div>

      <!-- Harvest outcome display -->
      <div style="background:var(--vellum-deep);border-radius:var(--radius);padding:8px 12px;margin-bottom:14px;display:flex;align-items:center;">
        <span style="font-family:var(--font-heading);font-size:0.46rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--ink-soft);margin-right:10px;white-space:nowrap;">Harvest</span>
        <span id="ry-harvest-display" style="flex:1;font-size:0.82rem;color:var(--ink-soft);font-style:italic;">Select test results above</span>
      </div>

      <!-- Income / Expenses (2 cols) -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;">
        <div>
          <div class="section-title mb-8">Income</div>
          <div class="detail-field mb-6">
            <div class="detail-label">Steward Industry (L)</div>
            <input class="edit-input" id="ry-steward-industry" type="number" value="0" min="0" step="0.5">
          </div>
          <div class="detail-field mb-6">
            <div class="detail-label">Improvement Income (L) <span title="Don't forget to calculate improvements and roll improvement incomes!" style="cursor:help;color:var(--gold);font-weight:bold;">!</span></div>
            <input class="edit-input" id="ry-impr-income" type="number" value="${wp.improvIncome ?? autoIncome}" min="0" step="0.5">
          </div>
          <div class="detail-field mb-6">
            <div class="detail-label">Discretionary (L)</div>
            <input class="edit-input" id="ry-discretionary" type="number" value="0" min="0" step="0.5">
          </div>
          <div class="detail-field mb-6">
            <div class="detail-label">Extra-Manorial (L)</div>
            <input class="edit-input" id="ry-extra-manorial" type="number" value="0" min="0" step="0.5">
          </div>
          ${(() => { const pvi = (m.vassals||[]).reduce((s,v)=>s+(v.passiveIncome??1),0); return pvi > 0 ? `<div class="detail-field mb-6">
            <div class="detail-label" style="display:flex;justify-content:space-between;">
              Passive Vassal Income
              <span style="color:var(--verdigris-mid);font-family:var(--font-heading);font-size:0.75rem;">${pvi} L</span>
            </div>
            <div style="color:var(--ink-soft);font-size:0.7rem;">${(m.vassals||[]).length} vassal manor${(m.vassals||[]).length!==1?'s':''} · ${pvi} L total (auto)</div>
          </div>` : ''; })()}
          <div class="detail-field mb-6">
            <div class="detail-label" style="display:flex;justify-content:space-between;align-items:center;">
              Misc Income
              <button class="btn btn-ghost" style="font-size:0.6rem;padding:1px 6px;" onclick="event.preventDefault();TabManors._addMiscItem('ry-misc-income-list');TabManors._updateRecordCalcs('${key}',STORE.getManor('${key}'))">＋ Add</button>
            </div>
            <div id="ry-misc-income-list"></div>
          </div>
          <div style="border-top:1px solid var(--vellum-deep);padding-top:6px;display:flex;justify-content:space-between;font-family:var(--font-heading);font-size:0.78rem;">
            <span style="color:var(--ink-soft);">Total In</span>
            <span id="ry-total-in" style="color:var(--verdigris-mid);">0 L</span>
          </div>
        </div>

        <div>
          <div class="section-title mb-8">Expenses</div>
          <div class="detail-field mb-6">
            <div class="detail-label" style="display:flex;justify-content:space-between;">
              Lifestyle
              <span id="ry-lifestyle-cost" style="color:var(--crimson-mid);font-family:var(--font-heading);font-size:0.75rem;">${lc0} L</span>
            </div>
            <select class="edit-input edit-select" id="ry-lifestyle">${lifestyleOpts}</select>
          </div>
          <div class="detail-field mb-6">
            <div class="detail-label">Impr. Maintenance (L)${autoMaint?` <span style="opacity:0.5;">(auto: ${autoMaint})</span>`:''}</div>
            <input class="edit-input" id="ry-impr-maint" type="number" value="${wp.improvMaint||0}" min="0" step="0.5">
          </div>
          <div class="detail-field mb-6">
            <div class="detail-label">Family Expenses (L)</div>
            <input class="edit-input" id="ry-family" type="number" value="0" min="0" step="0.5">
          </div>
          <div class="detail-field mb-6">
            <div class="detail-label">Build Cost (L)</div>
            <input class="edit-input" id="ry-impr-build" type="number" value="0" min="0" step="0.5">
          </div>
          <div class="detail-field mb-6">
            <div class="detail-label" style="display:flex;justify-content:space-between;align-items:center;">
              Misc Expenses
              <button class="btn btn-ghost" style="font-size:0.6rem;padding:1px 6px;" onclick="event.preventDefault();TabManors._addMiscItem('ry-misc-exp-list');TabManors._updateRecordCalcs('${key}',STORE.getManor('${key}'))">＋ Add</button>
            </div>
            <div id="ry-misc-exp-list"></div>
          </div>
          <div style="border-top:1px solid var(--vellum-deep);padding-top:6px;display:flex;justify-content:space-between;font-family:var(--font-heading);font-size:0.78rem;">
            <span style="color:var(--ink-soft);">Total Out</span>
            <span id="ry-total-out" style="color:var(--crimson-mid);">0 L</span>
          </div>
        </div>
      </div>

      <!-- Misfortune factors -->
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px;">
        <div class="section-title" style="margin-bottom:0;">Misfortune Factors</div>
        <span style="font-size:0.72rem;color:var(--ink-soft);">Total Misfortune Score: <strong id="ry-misfortune-total" style="color:var(--crimson-mid);">0</strong></span>
        <span style="font-size:0.68rem;color:var(--ink-soft);opacity:0.7;">Roll Misfortune die against this score</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
        ${['weather','conflict','commoners','presence','misc'].map(f=>`
          <div class="detail-field" style="flex:1;min-width:70px;">
            <div class="detail-label">${f.charAt(0).toUpperCase()+f.slice(1)}</div>
            <input class="edit-input" id="ry-fate-${f}" type="number" value="0" step="1">
          </div>`).join('')}
      </div>

      <!-- Hatred / Care -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
        <div class="detail-field">
          <div class="detail-label">Hatred After</div>
          <input class="edit-input" id="ry-hatred" type="number" value="${m.hatred??0}">
        </div>
        <div class="detail-field">
          <div class="detail-label">Care After</div>
          <input class="edit-input" id="ry-care" type="number" value="${m.care??0}">
        </div>
      </div>

      <!-- Property Damage (inline) -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div class="section-title" style="margin-bottom:0;">Property Damage</div>
        <button class="btn btn-ghost" style="font-size:0.6rem;padding:2px 8px;" onclick="TabManors.openAddDamage('${key}')">+ Add Damage</button>
      </div>
      <div style="background:var(--vellum-deep);border-radius:var(--radius);padding:8px 12px;margin-bottom:14px;font-size:0.78rem;color:var(--ink-soft);">
        ${(m.propertyDamage||[]).filter(d=>d.status==='damaged').length
          ? (m.propertyDamage||[]).filter(d=>d.status==='damaged').map(d =>
              `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid var(--vellum-mid);">
                <span><strong>${esc(d.type)}</strong> — ${esc(d.description)}${d.numFields ? ` (${d.numFields} field${d.numFields!==1?'s':''})` : ''}</span>
                <span style="white-space:nowrap;margin-left:8px;color:var(--crimson-mid);">${d.repairCost ? d.repairCost+' L' : ''}</span>
              </div>`
            ).join('')
          : '<span style="font-style:italic;">No active damage</span>'}
      </div>

      <!-- Notes -->
      <div class="section-title mb-6">Notes</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">
        <textarea class="edit-input edit-textarea" id="ry-notes" placeholder="Events of the year…"></textarea>
        <textarea class="edit-input edit-textarea" id="ry-notes2" placeholder="Notes 2…"></textarea>
      </div>

      <!-- Treasury summary -->
      <div style="background:var(--vellum-deep);border-radius:var(--radius);padding:10px 14px;margin-bottom:14px;">
        <div class="section-title mb-6" style="font-size:0.46rem;">Treasury Summary</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;align-items:center;">
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;">
            <span class="detail-label">Previous Treasury</span>
            <input class="edit-input" id="ry-prev-treasury" type="number" value="${wp.prevTreasury||0}" style="width:72px;text-align:right;">
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.82rem;">
            <span class="detail-label">Net This Year</span>
            <span id="ry-net" style="font-family:var(--font-heading);font-size:0.82rem;font-weight:600;">0 L</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.88rem;font-weight:600;">
            <span>New Treasury</span>
            <span id="ry-new-t" style="font-family:var(--font-heading);font-size:0.9rem;font-weight:600;">0 L</span>
          </div>
        </div>
      </div>

      <div class="btn-row">
        <button class="btn btn-primary" onclick="TabManors._saveHistoryInline('${key}')">Save Year</button>
        <button class="btn btn-ghost"   onclick="TabManors.toggleRecord('${key}')">Cancel</button>
      </div>
    </div>`;
  },

  _saveHistoryInline(key) {
    const g = id => document.getElementById(id);
    const year = parseInt(g('ry-year')?.value, 10);
    if (!year) { Toast.error('Year required'); return; }

    const m  = STORE.getManor(key);
    if (!m) return;

    const wp = this._workingEntry || {};
    const lifestyleVal  = g('ry-lifestyle')?.value || 'Normal';
    const lifestyleCost = LIFESTYLE_COST[lifestyleVal] ?? 4;

    const miscIncomeItems = this._readMiscItems('ry-misc-income-list');
    const miscExpItems    = this._readMiscItems('ry-misc-exp-list');
    const miscIn  = miscIncomeItems.reduce((s,i)=>s+(parseFloat(i.amount)||0),0);
    const miscOut = miscExpItems.reduce((s,i)=>s+(parseFloat(i.amount)||0),0);

    const harvestIncome   = wp.harvestIncome || 0;
    const stewardIndustry = parseFloat(g('ry-steward-industry')?.value) || 0;
    const improvIncome    = parseFloat(g('ry-impr-income')?.value)      || 0;
    const discretionary   = parseFloat(g('ry-discretionary')?.value)    || 0;
    const extraManorial   = parseFloat(g('ry-extra-manorial')?.value)   || 0;
    const improvMaint     = parseFloat(g('ry-impr-maint')?.value)       || 0;
    const family          = parseFloat(g('ry-family')?.value)           || 0;
    const improvBuild     = parseFloat(g('ry-impr-build')?.value)       || 0;
    const prevTreasury    = parseFloat(g('ry-prev-treasury')?.value)    || 0;

    const vassalIncome = (m.vassals||[]).reduce((s,v)=>s+(v.passiveIncome??1),0);
    const totalIn  = harvestIncome + stewardIndustry + improvIncome + discretionary + extraManorial + miscIn + vassalIncome;
    const totalOut = lifestyleCost + improvMaint + family + improvBuild + miscOut;
    const treasury = Math.round((prevTreasury + totalIn - totalOut) * 10) / 10;

    const newHatred = parseInt(g('ry-hatred')?.value, 10);
    const newCare   = parseInt(g('ry-care')?.value, 10);
    if (!isNaN(newHatred)) m.hatred = newHatred;
    if (!isNaN(newCare))   m.care   = newCare;

    STORE.addManorHistory(key, {
      year,
      luck:           g('ry-luck')?.value           || 'No Result',
      luckSeason:     g('ry-luck-season')?.value    || '—',
      conflict:       g('ry-conflict')?.value        || 'No Result',
      conflictSeason: g('ry-conflict-season')?.value|| '—',
      harvestOutcome: wp.harvestOutcome              || 'Regular',
      harvestIncome,  stewardIndustry, improvIncome, discretionary, extraManorial, vassalIncome,
      miscIncomeItems,
      lifestyle: lifestyleVal, lifestyleCost,
      improvMaint, family, improvBuild,
      miscExpItems,
      prevTreasury, treasury,
      fateWeather:   parseFloat(g('ry-fate-weather')?.value)   || 0,
      fateConflict:  parseFloat(g('ry-fate-conflict')?.value)  || 0,
      fateCommoners: parseFloat(g('ry-fate-commoners')?.value) || 0,
      fatePresence:  parseFloat(g('ry-fate-presence')?.value)  || 0,
      fateMisc:      parseFloat(g('ry-fate-misc')?.value)      || 0,
      stewardResult: wp.stewardResult || '—',
      fateResult:    wp.fateResult    || '—',
      tiebreaker:    wp.tiebreaker    || '—',
      notes:         g('ry-notes')?.value?.trim()  || '',
      notes2:        g('ry-notes2')?.value?.trim() || '',
    });

    this._workingEntry = null;
    this._recordOpen   = false;
    Toast.success(`${year} AD recorded — Treasury: ${treasury} L`);
    this._section = 'history';
    this._expanded.add(`${key}-${year}`);
    this._renderManor();
  },

  // ── EDIT / DELETE HISTORY ENTRIES ──────────────────────────

  openEditHistory(key, year) {
    const m = STORE.getManor(key);
    if (!m) return;
    const h = m.history?.find(e => e.year === year);
    if (!h) return;

    const sel = (opts, cur) => opts.map(v=>`<option${v===cur?' selected':''}>${v}</option>`).join('');
    const harvestOpts  = ['Incredible','Excellent','Good','Regular','Meager','Bad','Very Bad','Negligible'];
    const conflictOpts = ['No Result','Bandits','Raided','Pillaged','Plundered'];
    const luckOpts     = ['No Result','Boon','Calamity'];
    const sznOpts      = ['—','Spring','Summer','Fall','Winter'];
    const resultOpts   = ['—','Critical','Success','Failure','Fumble'];
    const tbOpts       = ['—','win','lose'];
    const lifestyleOpts= ['Impoverished','Poor','Normal','Rich','Extravagant'];
    const miscInTotal  = this._sumMiscItems(h.miscIncomeItems, h.miscIncome);
    const miscExpTotal = this._sumMiscItems(h.miscExpItems,    h.miscExp);
    const fate = (f) => h[`fate${f.charAt(0).toUpperCase()+f.slice(1)}`] || 0;

    Modal.open(`
      <div style="min-width:560px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:16px;">Edit ${year} AD — ${key}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">

          <div>
            <div class="section-title mb-8">Events & Tests</div>
            <div class="detail-field mb-6"><div class="detail-label">Luck</div><select class="edit-input edit-select" id="hy-luck">${sel(luckOpts,h.luck||'No Result')}</select></div>
            <div class="detail-field mb-6"><div class="detail-label">Luck Season</div><select class="edit-input edit-select" id="hy-luck-season">${sel(sznOpts,h.luckSeason||'—')}</select></div>
            <div class="detail-field mb-6"><div class="detail-label">Conflict</div><select class="edit-input edit-select" id="hy-conflict">${sel(conflictOpts,h.conflict||'No Result')}</select></div>
            <div class="detail-field mb-6"><div class="detail-label">Conflict Season</div><select class="edit-input edit-select" id="hy-conflict-season">${sel(sznOpts,h.conflictSeason||'—')}</select></div>
            <div class="detail-field mb-6"><div class="detail-label">Steward Result</div><select class="edit-input edit-select" id="hy-steward-result">${sel(resultOpts,h.stewardResult||'—')}</select></div>
            <div class="detail-field mb-6"><div class="detail-label">Fate Result</div><select class="edit-input edit-select" id="hy-fate-result">${sel(resultOpts,h.fateResult||'—')}</select></div>
            <div class="detail-field mb-6"><div class="detail-label">Tiebreaker</div><select class="edit-input edit-select" id="hy-tiebreaker">${sel(tbOpts,h.tiebreaker||'—')}</select></div>
            <div class="detail-field mb-6"><div class="detail-label">Harvest Outcome</div><select class="edit-input edit-select" id="hy-harvest">${sel(harvestOpts,h.harvestOutcome||'Regular')}</select></div>
          </div>

          <div>
            <div class="section-title mb-8">Income</div>
            <div class="detail-field mb-6"><div class="detail-label">Harvest Income (L)</div><input class="edit-input" id="hy-harvest-income" type="number" value="${h.harvestIncome||0}"></div>
            <div class="detail-field mb-6"><div class="detail-label">Steward Industry (L)</div><input class="edit-input" id="hy-steward-industry" type="number" value="${h.stewardIndustry||0}"></div>
            <div class="detail-field mb-6"><div class="detail-label">Improvement Income (L)</div><input class="edit-input" id="hy-impr-income" type="number" value="${h.improvIncome||0}"></div>
            <div class="detail-field mb-6"><div class="detail-label">Discretionary (L)</div><input class="edit-input" id="hy-discretionary" type="number" value="${h.discretionary||0}"></div>
            <div class="detail-field mb-6"><div class="detail-label">Extra-Manorial (L)</div><input class="edit-input" id="hy-extra-manorial" type="number" value="${h.extraManorial||0}"></div>
            <div class="detail-field mb-6"><div class="detail-label">Misc Income (L)</div><input class="edit-input" id="hy-misc-income-edit" type="number" value="${miscInTotal}"></div>
            <div class="section-title mb-8 mt-10">Expenses</div>
            <div class="detail-field mb-6"><div class="detail-label">Lifestyle</div><select class="edit-input edit-select" id="hy-lifestyle">${sel(lifestyleOpts,h.lifestyle||'Normal')}</select></div>
            <div class="detail-field mb-6"><div class="detail-label">Lifestyle Cost (L)</div><input class="edit-input" id="hy-lifestyle-cost" type="number" value="${h.lifestyleCost||4}"></div>
            <div class="detail-field mb-6"><div class="detail-label">Impr. Maint. (L)</div><input class="edit-input" id="hy-impr-maint" type="number" value="${h.improvMaint||0}"></div>
            <div class="detail-field mb-6"><div class="detail-label">Family (L)</div><input class="edit-input" id="hy-family" type="number" value="${h.family||0}"></div>
            <div class="detail-field mb-6"><div class="detail-label">Build Cost (L)</div><input class="edit-input" id="hy-impr-build" type="number" value="${h.improvBuild||0}"></div>
            <div class="detail-field mb-6"><div class="detail-label">Misc Expenses (L)</div><input class="edit-input" id="hy-misc-exp-edit" type="number" value="${miscExpTotal}"></div>
          </div>

          <div>
            <div class="section-title mb-8">Treasury</div>
            <div class="detail-field mb-6"><div class="detail-label">Prev. Treasury (L)</div><input class="edit-input" id="hy-prev-treasury" type="number" value="${h.prevTreasury||0}"></div>
            <div class="detail-field mb-6"><div class="detail-label">Treasury After (L)</div><input class="edit-input" id="hy-treasury" type="number" value="${h.treasury||0}"></div>
            <div class="section-title mb-8 mt-10">Hatred / Care</div>
            <div class="detail-field mb-6"><div class="detail-label">Hatred</div><input class="edit-input" id="hy-hatred" type="number" value="${m.hatred??0}"></div>
            <div class="detail-field mb-6"><div class="detail-label">Care</div><input class="edit-input" id="hy-care" type="number" value="${m.care??0}"></div>
            <div class="section-title mb-8 mt-10">Fate Modifiers</div>
            ${['weather','conflict','commoners','presence','misc'].map(f=>`
              <div class="detail-field mb-6"><div class="detail-label">${f.charAt(0).toUpperCase()+f.slice(1)}</div>
              <input class="edit-input" id="hy-fate-${f}" type="number" value="${fate(f)}"></div>`).join('')}
            <div class="section-title mb-8 mt-10">Notes</div>
            <div class="detail-field mb-4"><textarea class="edit-input edit-textarea" id="hy-notes">${h.notes||''}</textarea></div>
            <div class="detail-field"><textarea class="edit-input edit-textarea" id="hy-notes2">${h.notes2||''}</textarea></div>
          </div>

        </div>
        <div class="btn-row mt-16">
          <button class="btn btn-primary" onclick="TabManors._saveEditHistory('${key}',${year})">Save Changes</button>
          <button class="btn btn-ghost"   onclick="Modal.close()">Cancel</button>
        </div>
      </div>`, { wide: true });
  },

  _saveEditHistory(key, year) {
    const g = id => document.getElementById(id);
    const m = STORE.getManor(key);
    if (!m) return;
    const entry = m.history?.find(e => e.year === year);
    if (!entry) return;

    const newHatred = parseInt(g('hy-hatred')?.value, 10);
    const newCare   = parseInt(g('hy-care')?.value, 10);
    if (!isNaN(newHatred)) m.hatred = newHatred;
    if (!isNaN(newCare))   m.care   = newCare;

    Object.assign(entry, {
      luck:           g('hy-luck')?.value             || 'No Result',
      luckSeason:     g('hy-luck-season')?.value      || '—',
      conflict:       g('hy-conflict')?.value          || 'No Result',
      conflictSeason: g('hy-conflict-season')?.value  || '—',
      harvestOutcome: g('hy-harvest')?.value           || 'Regular',
      harvestIncome:  parseFloat(g('hy-harvest-income')?.value)     || 0,
      stewardIndustry:parseFloat(g('hy-steward-industry')?.value)   || 0,
      improvIncome:   parseFloat(g('hy-impr-income')?.value)        || 0,
      discretionary:  parseFloat(g('hy-discretionary')?.value)      || 0,
      extraManorial:  parseFloat(g('hy-extra-manorial')?.value)     || 0,
      miscIncome:     parseFloat(g('hy-misc-income-edit')?.value)   || 0,
      lifestyle:      g('hy-lifestyle')?.value         || 'Normal',
      lifestyleCost:  parseFloat(g('hy-lifestyle-cost')?.value)     || 4,
      improvMaint:    parseFloat(g('hy-impr-maint')?.value)         || 0,
      family:         parseFloat(g('hy-family')?.value)             || 0,
      improvBuild:    parseFloat(g('hy-impr-build')?.value)         || 0,
      miscExp:        parseFloat(g('hy-misc-exp-edit')?.value)      || 0,
      prevTreasury:   parseFloat(g('hy-prev-treasury')?.value)      || 0,
      treasury:       parseFloat(g('hy-treasury')?.value)           || 0,
      fateWeather:    parseFloat(g('hy-fate-weather')?.value)       || 0,
      fateConflict:   parseFloat(g('hy-fate-conflict')?.value)      || 0,
      fateCommoners:  parseFloat(g('hy-fate-commoners')?.value)     || 0,
      fatePresence:   parseFloat(g('hy-fate-presence')?.value)      || 0,
      fateMisc:       parseFloat(g('hy-fate-misc')?.value)          || 0,
      stewardResult:  g('hy-steward-result')?.value    || '—',
      fateResult:     g('hy-fate-result')?.value       || '—',
      tiebreaker:     g('hy-tiebreaker')?.value        || '—',
      notes:          g('hy-notes')?.value?.trim()     || '',
      notes2:         g('hy-notes2')?.value?.trim()    || '',
    });
    // Clear itemized arrays — edit modal uses legacy totals
    delete entry.miscIncomeItems;
    delete entry.miscExpItems;

    STORE.save();
    Toast.success(`${year} AD updated`);
    Modal.close();
    this._renderManor();
  },

  deleteHistory(key, year) {
    if (!confirm(`Delete the ${year} AD ledger entry for ${key}?\nThis cannot be undone.`)) return;
    const m = STORE.getManor(key);
    if (!m) return;
    m.history = (m.history || []).filter(h => h.year !== year);
    STORE.save();
    Toast.success(`${year} AD deleted`);
    this._renderManor();
  },

  // ── YEAR SUMMARY PNG EXPORT ────────────────────────────────
  exportYearSummaryPng(key, year) {
    const m = STORE.getManor(key);
    const h = (m?.history || []).find(e => e.year === year);
    if (!h) { Toast.error('No record found'); return; }

    const hh  = STORE.getHousehold(key);
    const col = hh?.colour || '#4a2070';

    // ── Canvas setup ──────────────────────────────────────────
    const W = 720, PAD = 40;
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');

    // Measure content height first with a dry-run, then set canvas height
    const lines = this._buildSummaryLines(h, key);
    const ROW_H = 22, SECTION_H = 30, HEADER_H = 90, FOOTER_H = 36;
    let contentH = HEADER_H + FOOTER_H + 20;
    lines.forEach(l => { contentH += l.section ? SECTION_H : ROW_H; });
    canvas.width  = W;
    canvas.height = contentH + PAD * 2;

    // ── Background ────────────────────────────────────────────
    ctx.fillStyle = '#f5edd8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle parchment texture lines
    ctx.strokeStyle = 'rgba(180,150,90,0.08)';
    ctx.lineWidth = 1;
    for (let y2 = 0; y2 < canvas.height; y2 += 18) {
      ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(canvas.width, y2); ctx.stroke();
    }

    // Border
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    ctx.strokeStyle = 'rgba(180,150,90,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

    // ── Header band ───────────────────────────────────────────
    ctx.fillStyle = col;
    ctx.fillRect(12, 12, canvas.width - 24, HEADER_H - 10);

    // Household icon + title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px serif';
    ctx.textAlign = 'center';
    const icon = hh?.icon || '🏰';
    ctx.fillText(`${icon}  House ${key}`, W / 2, 50);
    ctx.font = '15px serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`Manor Year Summary — ${year} AD`, W / 2, 74);

    // ── Harvest banner ────────────────────────────────────────
    if (h.harvestOutcome) {
      const harvestColours = {
        Incredible: '#2d6b47', Excellent: '#3a7d5a', Good: '#4a8c6a',
        Regular: '#5a7a5a', Meager: '#8a6a2a', Bad: '#a05020',
        'Very Bad': '#b03020', Negligible: '#8a1a1a',
      };
      const hCol = harvestColours[h.harvestOutcome] || '#5a7a5a';
      ctx.fillStyle = hCol;
      ctx.fillRect(PAD, HEADER_H + 4, W - PAD * 2, 28);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Harvest: ${h.harvestOutcome}`, W / 2, HEADER_H + 23);
    }

    // ── Content rows ──────────────────────────────────────────
    let cy = HEADER_H + (h.harvestOutcome ? 46 : 18);
    ctx.textAlign = 'left';

    lines.forEach(l => {
      if (l.section) {
        // Section divider
        cy += 8;
        ctx.fillStyle = col;
        ctx.fillRect(PAD, cy, W - PAD * 2, 1);
        cy += 4;
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = col;
        ctx.fillText(l.section.toUpperCase(), PAD, cy + 11);
        cy += SECTION_H - 12;
      } else {
        ctx.font = l.bold ? 'bold 13px serif' : '13px serif';
        // Label
        ctx.fillStyle = l.bold ? '#1a1008' : '#4a3a20';
        ctx.fillText(l.label, PAD + (l.indent ? 16 : 0), cy + 14);
        // Value (right-aligned)
        ctx.textAlign = 'right';
        ctx.fillStyle = l.colour || (l.bold ? '#1a1008' : '#4a3a20');
        ctx.fillText(l.value, W - PAD, cy + 14);
        ctx.textAlign = 'left';
        cy += ROW_H;
      }
    });

    // ── Footer ────────────────────────────────────────────────
    const footerY = canvas.height - FOOTER_H;
    ctx.fillStyle = 'rgba(180,150,90,0.25)';
    ctx.fillRect(12, footerY, canvas.width - 24, FOOTER_H);
    ctx.fillStyle = 'rgba(90,70,30,0.5)';
    ctx.font = 'italic 11px serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Pendragon GM's Binder · ${key} Manor · ${year} AD`, W / 2, footerY + 22);

    // ── Download ──────────────────────────────────────────────
    const link = document.createElement('a');
    link.download = `${key}-${year}-AD-summary.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    Toast.success(`Exported ${key} ${year} AD summary`);
  },

  _buildSummaryLines(h, key) {
    const m    = STORE.getManor(key);
    const misc = (items, legacy) => this._sumMiscItems(items, legacy);
    const fmt  = v => v ? `${v} L` : '—';
    const pos  = '#2d6b47', neg = '#a03020', neu = '#4a3a20';

    const miscIn  = misc(h.miscIncomeItems,  h.miscIncome);
    const miscOut = misc(h.miscExpItems,     h.miscExp);
    const totalIn  = (h.harvestIncome||0)+(h.improvIncome||0)+(h.discretionary||0)
                   +(h.extraManorial||0)+miscIn+(h.stewardIndustry||0)+(h.vassalIncome||0);
    const totalOut = (h.lifestyleCost||0)+(h.improvMaint||0)+(h.family||0)+(h.improvBuild||0)+miscOut;
    const net      = Math.round((totalIn - totalOut) * 10) / 10;
    const misfortune = (h.fateWeather||0)+(h.fateConflict||0)+(h.fateCommoners||0)
                     +(h.fatePresence||0)+(h.fateMisc||0);

    const row = (label, value, colour, bold, indent) =>
      ({ label, value, colour, bold, indent });
    const sec = section => ({ section });

    const lines = [];

    // ── Rolls & outcome ──────────────────────────────────────
    lines.push(sec('Rolls & Outcome'));
    if (h.stewardResult) lines.push(row('Steward Roll', h.stewardResult, neu));
    if (h.fateResult)    lines.push(row('Misfortune Die', h.fateResult, neu));
    if (h.tiebreaker && h.tiebreaker !== '—') lines.push(row('Tiebreaker', h.tiebreaker, neu));
    lines.push(row('Misfortune Score', String(misfortune), misfortune > 5 ? neg : neu));

    // ── Events ───────────────────────────────────────────────
    lines.push(sec('Events'));
    if (h.luck && h.luck !== 'No Result')         lines.push(row('Luck', `${h.luck}${h.luckSeason?' ('+h.luckSeason+')':''}`, neu));
    if (h.conflict && h.conflict !== 'No Result') lines.push(row('Conflict', `${h.conflict}${h.conflictSeason?' ('+h.conflictSeason+')':''}`, neg));

    // ── Income ───────────────────────────────────────────────
    lines.push(sec('Income'));
    if (h.harvestIncome)    lines.push(row('Harvest',          fmt(h.harvestIncome),   pos, false, true));
    if (h.stewardIndustry)  lines.push(row('Steward Industry', fmt(h.stewardIndustry), pos, false, true));
    if (h.improvIncome)     lines.push(row('Improvements',     fmt(h.improvIncome),    pos, false, true));
    if (h.discretionary)    lines.push(row('Discretionary',    fmt(h.discretionary),   pos, false, true));
    if (h.extraManorial)    lines.push(row('Extra-Manorial',   fmt(h.extraManorial),   pos, false, true));
    if (h.vassalIncome)     lines.push(row('Vassal Income',    fmt(h.vassalIncome),    pos, false, true));
    if (miscIn)             lines.push(row('Misc Income',      fmt(miscIn),            pos, false, true));
    lines.push(row('Total Income', fmt(totalIn), pos, true));

    // ── Expenses ─────────────────────────────────────────────
    lines.push(sec('Expenses'));
    if (h.lifestyleCost)  lines.push(row('Lifestyle',      fmt(h.lifestyleCost),  neg, false, true));
    if (h.improvMaint)    lines.push(row('Impr. Maint.',   fmt(h.improvMaint),    neg, false, true));
    if (h.family)         lines.push(row('Family',         fmt(h.family),         neg, false, true));
    if (h.improvBuild)    lines.push(row('Build Cost',     fmt(h.improvBuild),    neg, false, true));
    if (miscOut)          lines.push(row('Misc Expenses',  fmt(miscOut),          neg, false, true));
    lines.push(row('Total Expenses', fmt(totalOut), neg, true));

    // ── Treasury ─────────────────────────────────────────────
    lines.push(sec('Treasury'));
    lines.push(row('Previous Treasury', fmt(h.prevTreasury), neu));
    lines.push(row('Net This Year',     (net >= 0 ? '+' : '') + net + ' L', net >= 0 ? pos : neg, true));
    lines.push(row('New Treasury',      fmt(h.treasury), net >= 0 ? pos : neg, true));

    // ── Notes ────────────────────────────────────────────────
    const notes = [h.notes, h.notes2].filter(Boolean).join('  ·  ');
    if (notes) {
      lines.push(sec('Notes'));
      // Word-wrap notes into ~60-char chunks
      const words = notes.split(' ');
      let line = '';
      words.forEach(w => {
        if ((line + w).length > 62) {
          lines.push(row(line.trim(), '', neu, false));
          line = w + ' ';
        } else {
          line += w + ' ';
        }
      });
      if (line.trim()) lines.push(row(line.trim(), '', neu, false));
    }

    return lines;
  },

  // ── MISC ITEM HELPERS ──────────────────────────────────────
  // Sum an array of misc items; falls back to a legacy scalar if no array
  _sumMiscItems(items, legacy) {
    if (Array.isArray(items) && items.length) {
      return items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    }
    return legacy || 0;
  },

  // Read current misc item rows from a container div in the form
  _readMiscItems(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const rows = container.querySelectorAll('.misc-item-row');
    const items = [];
    rows.forEach(row => {
      const amount = parseFloat(row.querySelector('[data-misc-amount]')?.value) || 0;
      const note   = row.querySelector('[data-misc-note]')?.value?.trim() || '';
      if (amount || note) items.push({ amount, note });
    });
    return items;
  },

  // Append a new blank row to a misc item container
  _addMiscItem(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'misc-item-row';
    row.style.cssText = 'display:flex;gap:4px;align-items:center;margin-bottom:4px;';
    row.innerHTML = `
      <input type="number" class="edit-input" data-misc-amount="true" placeholder="L" style="width:64px;flex-shrink:0;" min="0" step="0.5">
      <input type="text"   class="edit-input" data-misc-note="true"   placeholder="Note…" style="flex:1;">
      <button class="btn btn-ghost" style="padding:2px 7px;font-size:0.68rem;flex-shrink:0;" onclick="event.preventDefault();const p=this.closest('.misc-item-row').parentElement;this.closest('.misc-item-row').remove();p?.dispatchEvent(new Event('input',{bubbles:true}))">✕</button>`;
    container.appendChild(row);
    row.querySelector('[data-misc-amount]').focus();
  },

  // Render misc item lines inside the expanded ledger panel
  _miscLedgerLines(items, legacy, type, label) {
    const arr = Array.isArray(items) && items.length ? items : null;
    if (!arr) {
      // Legacy: single number
      return this._ledgerLine(label, legacy || 0, type);
    }
    return arr.map((item, i) => {
      const lineLabel = item.note ? item.note : `${label} ${i + 1}`;
      return this._ledgerLine(lineLabel, item.amount, type);
    }).join('');
  },

  // ── HISTORY LEDGER ─────────────────────────────────────────
  _renderHistory(m, key) {
    const history = [...(m.history||[])].sort((a,b) => b.year - a.year);
    if (!history.length) return `
      <div class="empty-state"><div class="empty-state-text">No history recorded yet</div></div>
      <div class="btn-row mt-16"><button class="btn btn-verdigris" onclick="TabManors._goToRecord('${key}')">+ Record First Year</button></div>`;

    const rows = history.map(h => {
      const yKey   = `${key}-${h.year}`;
      const isOpen = this._expanded.has(yKey);

      const miscIn   = this._sumMiscItems(h.miscIncomeItems, h.miscIncome);
      const miscOut  = this._sumMiscItems(h.miscExpItems,    h.miscExp);
      const totalIn  = (h.harvestIncome||0)+(h.improvIncome||0)+(h.discretionary||0)+(h.extraManorial||0)+miscIn+(h.stewardIndustry||0)+(h.vassalIncome||0);
      const totalOut = (h.lifestyleCost||0)+(h.improvMaint||0)+(h.family||0)+(h.improvBuild||0)+miscOut;
      const misfortune = (h.fateWeather||0)+(h.fateConflict||0)+(h.fateCommoners||0)+(h.fatePresence||0)+(h.fateMisc||0);
      const net      = totalIn - totalOut;

      const noteSnip = [h.notes, h.notes2].filter(Boolean).join(' · ');
      const notePreview = noteSnip.length > 60 ? noteSnip.slice(0,58)+'…' : noteSnip;

      const luckBadge = this._luckBadge(h.luck);

      const expandedHtml = isOpen ? `
        <tr class="history-expanded-row">
          <td colspan="6" style="padding:0;">
            <div style="padding:12px 16px;background:var(--vellum-mid);border-bottom:2px solid var(--vellum-deep);display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">

              <div>
                <div class="section-title mb-8">Income</div>
                ${this._ledgerLine('Harvest',         h.harvestIncome,    'income')}
                ${this._ledgerLine('Steward Industry',h.stewardIndustry,  'income')}
                ${this._ledgerLine('Improvements',    h.improvIncome,     'income')}
                ${this._ledgerLine('Discretionary',   h.discretionary,    'income')}
                ${this._ledgerLine('Extra-Manorial',  h.extraManorial,    'income')}
                ${h.vassalIncome ? this._ledgerLine(`Passive Vassal Income`, h.vassalIncome, 'income') : ''}
                ${this._miscLedgerLines(h.miscIncomeItems, h.miscIncome, 'income', 'Misc Income')}
                <div style="border-top:1px solid var(--vellum-deep);margin-top:4px;padding-top:4px;">
                  ${this._ledgerLine('Total In', totalIn, 'income', true)}
                </div>
              </div>

              <div>
                <div class="section-title mb-8">Expenses</div>
                ${this._ledgerLine('Lifestyle',       h.lifestyleCost,    'expense')}
                ${this._ledgerLine('Impr. Maint.',    h.improvMaint,      'expense')}
                ${this._ledgerLine('Family',          h.family,           'expense')}
                ${this._ledgerLine('Build Cost',      h.improvBuild,      'expense')}
                ${this._miscLedgerLines(h.miscExpItems, h.miscExp, 'expense', 'Misc Expense')}
                <div style="border-top:1px solid var(--vellum-deep);margin-top:4px;padding-top:4px;">
                  ${this._ledgerLine('Total Out', totalOut, 'expense', true)}
                  ${this._ledgerLine('Net', net, net>=0?'income':'expense', true)}
                </div>
              </div>

              <div>
                <div class="section-title mb-8">Misfortune & Events</div>
                ${this._misfortuneLine('Weather',   h.fateWeather)}
                ${this._misfortuneLine('Conflict',  h.fateConflict)}
                ${this._misfortuneLine('Commoners', h.fateCommoners)}
                ${this._misfortuneLine('Presence',  h.fatePresence)}
                ${this._misfortuneLine('Misc',      h.fateMisc)}
                <div style="border-top:1px solid var(--vellum-deep);margin-top:4px;padding-top:4px;">
                  <div style="display:flex;justify-content:space-between;padding:1px 0;font-size:0.85rem;font-weight:600;">
                    <span style="color:var(--ink);">Total Misfortune Score</span>
                    <span style="color:var(--crimson-mid);">${misfortune}</span>
                  </div>
                </div>
                <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px;">
                  ${h.luck && h.luck!=='No Result' ? `<div style="font-size:0.82rem;"><span class="text-muted">Luck: </span>${luckBadge}${h.luckSeason?' ('+h.luckSeason+')':''}</div>` : ''}
                  ${h.stewardResult && h.stewardResult!=='—' ? `<div style="font-size:0.82rem;"><span class="text-muted">Steward: </span><strong>${h.stewardResult}</strong></div>` : ''}
                  ${h.fateResult    && h.fateResult!=='—'    ? `<div style="font-size:0.82rem;"><span class="text-muted">Fate: </span><strong>${h.fateResult}</strong></div>` : ''}
                  ${h.tiebreaker    && h.tiebreaker!=='—'    ? `<div style="font-size:0.82rem;"><span class="text-muted">Tiebreaker: </span><strong>${h.tiebreaker}</strong></div>` : ''}
                </div>
                ${noteSnip ? `<div style="margin-top:10px;font-size:0.82rem;color:var(--ink-soft);font-style:italic;white-space:pre-wrap;">${noteSnip}</div>` : ''}
                <div style="margin-top:12px;display:flex;gap:6px;">
                  <button class="btn btn-ghost" style="font-size:0.55rem;padding:2px 10px;" onclick="event.stopPropagation();TabManors.openEditHistory('${key}',${h.year})">✎ Edit</button>
                  <button class="btn btn-ghost" style="font-size:0.55rem;padding:2px 10px;" onclick="event.stopPropagation();TabManors.exportYearSummaryPng('${key}',${h.year})">⬇ Export Summary</button>
                  <button class="btn btn-ghost" style="font-size:0.55rem;padding:2px 10px;color:var(--crimson-mid);border-color:var(--crimson-mid);opacity:0.7;" onclick="event.stopPropagation();TabManors.deleteHistory('${key}',${h.year})">✕ Delete</button>
                </div>
              </div>

            </div>
          </td>
        </tr>` : '';

      return `
        <tr class="history-row" style="cursor:pointer;" role="button" tabindex="0" onclick="TabManors._toggleRow('${yKey}')">
          <td>
            <span style="font-family:var(--font-heading);font-size:0.88rem;">${h.year} AD</span>
          </td>
          <td>${luckBadge}</td>
          <td>${conflictBadge(h.conflict)}</td>
          <td style="text-align:left;max-width:200px;"><span style="font-size:0.78rem;color:var(--ink-soft);font-style:italic;">${notePreview}</span></td>
          <td>${harvestBadge(h.harvestOutcome||h.harvestResult)}</td>
          <td class="treasury-val" style="color:${h.treasury>0?'var(--verdigris-mid)':h.treasury<0?'var(--crimson-mid)':'inherit'}">${h.treasury} L</td>
          <td style="text-align:center;opacity:0.4;font-size:0.7rem;">${isOpen?'▲':'▼'}</td>
        </tr>
        ${expandedHtml}`;
    }).join('');

    return `
      <div class="history-table-wrap">
        <table class="history-table" style="table-layout:auto;">
          <thead>
            <tr>
              <th style="text-align:left;">Year</th>
              <th style="text-align:left;">Luck</th>
              <th style="text-align:left;">Conflict</th>
              <th style="text-align:left;">Notes</th>
              <th style="text-align:left;">Harvest</th>
              <th>Treasury</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="btn-row mt-16">
        <button class="btn btn-verdigris" onclick="TabManors._goToRecord('${key}')">+ Record Year</button>
      </div>`;
  },

  _toggleRow(yKey) {
    if (this._expanded.has(yKey)) this._expanded.delete(yKey);
    else this._expanded.add(yKey);
    this._renderManor();
    // Scroll back to roughly where the row was
    const content = document.getElementById('manorContent');
    if (content) {
      const rows = content.querySelectorAll('.history-row');
      const year = parseInt(yKey.split('-').pop(), 10);
      // Find and scroll the row into view
      rows.forEach(r => { if (r.textContent.includes(year + ' AD')) r.scrollIntoView({block:'nearest'}); });
    }
  },

  _misfortuneLine(label, val) {
    if (!val) return `<div style="display:flex;justify-content:space-between;padding:1px 0;font-size:0.82rem;">
      <span style="color:var(--ink-soft);opacity:0.6;">${label}</span>
      <span style="opacity:0.4;">0</span>
    </div>`;
    return `<div style="display:flex;justify-content:space-between;padding:1px 0;font-size:0.82rem;">
      <span style="color:var(--ink-soft);">${label}</span>
      <span style="color:${val>0?'var(--crimson-mid)':'var(--verdigris-mid)'};">${val>0?'+':''}${val}</span>
    </div>`;
  },

  _ledgerLine(label, val, type, bold) {
    if (val === undefined || val === null || val === '' || val === 0) {
      if (type === 'fate' && val === 0) {
        return `<div style="display:flex;justify-content:space-between;padding:1px 0;font-size:0.82rem;">
          <span style="color:var(--ink-soft);opacity:0.6;">${label}</span>
          <span style="opacity:0.4;">0</span>
        </div>`;
      }
      if (!bold) return '';
    }
    const n = parseFloat(val) || 0;
    const colour = type==='income' ? 'var(--verdigris-mid)' : type==='expense' ? 'var(--crimson-mid)' : n>0?'var(--verdigris-mid)':n<0?'var(--crimson-mid)':'inherit';
    const prefix = (type==='income'||type==='fate') && n>0 ? '+' : '';
    return `<div style="display:flex;justify-content:space-between;padding:1px 0;font-size:${bold?'0.85':'0.82'}rem;${bold?'font-weight:600;':''}">
      <span style="color:var(--ink-soft)${bold?';opacity:1;color:var(--ink)':''}">${label}</span>
      <span style="color:${colour};">${prefix}${n} L</span>
    </div>`;
  },

  _luckBadge(luck) {
    if (!luck || luck === 'No Result') return `<span class="conflict-badge none">—</span>`;
    if (luck === 'Boon') {
      return `<span class="conflict-badge" style="background:rgba(45,90,74,0.15);color:var(--verdigris-mid);border-color:rgba(45,90,74,0.3);">${luck}</span>`;
    }
    return `<span class="conflict-badge pillaged">${luck}</span>`;
  },

  // ── IMPROVEMENTS SECTION ───────────────────────────────────
  _renderImprovementsSection(m, key) {
    const all    = m.improvements || [];
    const active = all.filter(i=>i.status==='active');
    const inactive = all.filter(i=>i.status!=='active');

    const renderList = (arr) => arr.map(i=>`
      <div class="improvement-item ${i.cat==='fortification'?'fortification':''}">
        <div style="flex:1;">
          <div class="improvement-name">${i.name}
            <span style="margin-left:6px;font-family:var(--font-heading);font-size:0.48rem;letter-spacing:0.1em;text-transform:uppercase;padding:1px 6px;border-radius:10px;background:${i.cat==='fortification'?'rgba(30,58,95,0.15)':'rgba(45,90,74,0.15)'};color:${i.cat==='fortification'?'var(--cobalt-mid)':'var(--verdigris-mid)'};">${i.cat}</span>
          </div>
          <div class="improvement-note">${i.notes||''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div class="improvement-meta">Built ${i.yearBuilt} · Maint: ${i.maintenance} L/yr</div>
          ${(i.income||i.incomeNote) ? `<div class="improvement-meta" style="color:var(--verdigris-mid);">Income: ${i.income?i.income+' L/yr':''}${i.income&&i.incomeNote?' + ':''}${i.incomeNote||''}</div>` : ''}
          ${i.dvMod ? `<div class="improvement-meta" style="color:var(--cobalt-mid);">DV +${i.dvMod}</div>` : ''}
          ${i.dvNote ? `<div class="improvement-note">${i.dvNote}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-self:center;margin-left:8px;">
          <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.5rem;" onclick="TabManors.openEditImprovement('${key}',${i.id})">Edit</button>
          <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.5rem;" onclick="TabManors._toggleImprovementStatus('${key}',${i.id},'${i.status}')">
            ${i.status==='active'?'Deactivate':'Restore'}
          </button>
        </div>
      </div>`).join('');

    return `
      <div class="section-title">Active Improvements (${active.length})</div>
      ${active.length ? `<div class="improvement-list">${renderList(active)}</div>` : '<div class="text-muted italic" style="font-size:0.85rem;margin-bottom:12px;">None yet</div>'}

      ${inactive.length ? `
        <div class="section-title mt-16" style="opacity:0.55;">Inactive / Destroyed (${inactive.length})</div>
        <div class="improvement-list" style="opacity:0.6;">${renderList(inactive)}</div>` : ''}

      <div class="btn-row mt-16">
        <button class="btn btn-verdigris" onclick="TabManors.openAddImprovement('${key}')">+ Add Improvement</button>
      </div>`;
  },

  _toggleImprovementStatus(key, imprId, currentStatus) {
    const m = STORE.getManor(key);
    const i = m?.improvements?.find(x => x.id === imprId || x.id === String(imprId));
    if (!i) return;
    i.status = currentStatus === 'active' ? 'inactive' : 'active';
    STORE.save();
    this._renderManor();
  },

  setSection(s) {
    this._section = s;
    this._renderManor();
  },

  setPlayerSection(s) {
    this._playerSection = s;
    this.render();
  },

  // ── PERSONNEL PICKER ──────────────────────────────────────
  _pickPersonnel(key, field) {
    const labels  = { lord_id: 'Lord / Lady', steward_id: 'Steward', heir_id: 'Heir' };
    const m       = STORE.getManor(key);
    const current = m[field];
    const currentNpc = current ? STORE.getNpc(current) : null;

    Modal.open(`
      <div style="min-width:360px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Set ${labels[field]} — ${key}</div>
        <div class="detail-field mb-12">
          <div class="detail-label">Search by name or role</div>
          ${buildNpcSearchHtml('pp-search', 'pp-id')}
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabManors._savePersonnel('${key}','${field}')">Set</button>
          ${current ? `<button class="btn btn-ghost" onclick="TabManors._clearPersonnel('${key}','${field}')">Clear</button>` : ''}
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`, {
      onOpen: () => {
        initNpcSearch('pp-search', 'pp-id', STORE.allNpcs());
        // Pre-fill with current value so the user can see who is set
        if (currentNpc) {
          document.getElementById('pp-id').value   = currentNpc.id;
          document.getElementById('pp-search').value = currentNpc.name + (currentNpc.role ? ' (' + currentNpc.role + ')' : '');
        }
      },
    });
  },

  _savePersonnel(key, field) {
    const val = document.getElementById('pp-id')?.value;
    const m   = STORE.getManor(key);
    if (!m) return;
    m[field] = val || null;
    // If setting a steward, prompt for skill
    if (field === 'steward_id' && val) {
      STORE.save();
      Modal.close();
      this._editStewardSkill(key);
    } else {
      STORE.save();
      Modal.close();
      Toast.success('Updated');
      this._renderManor();
    }
  },

  _clearPersonnel(key, field) {
    const m = STORE.getManor(key);
    if (m) { m[field] = null; STORE.save(); }
    Modal.close();
    Toast.success('Cleared');
    this._renderManor();
  },

  _editStewardSkill(key) {
    const m = STORE.getManor(key);
    const npc = m?.steward_id ? STORE.getNpc(m.steward_id) : null;
    Modal.open(`
      <div style="min-width:300px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:6px;">Stewardship Skill</div>
        ${npc ? `<div style="font-size:0.9rem;color:var(--ink-soft);margin-bottom:14px;">${esc(npc.name)}</div>` : ''}
        <div class="detail-field mb-12">
          <div class="detail-label">Stewardship Skill Level</div>
          <input class="edit-input" id="ss-skill" type="number" min="1" max="30"
            value="${m?.steward_skill ?? ''}" placeholder="e.g. 15" style="font-size:1.1rem;text-align:center;">
        </div>
        <div style="font-size:0.82rem;color:var(--ink-soft);font-style:italic;margin-bottom:12px;">
          Used in the Stewardship vs Fate check each manor year.
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabManors._saveStewardSkill('${key}')">Save</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`);
    setTimeout(() => document.getElementById('ss-skill')?.focus(), 50);
  },

  _saveStewardSkill(key) {
    const val = parseInt(document.getElementById('ss-skill')?.value, 10);
    const m   = STORE.getManor(key);
    if (m && !isNaN(val)) { m.steward_skill = val; STORE.save(); }
    Modal.close();
    Toast.success('Stewardship skill saved');
    this._renderManor();
  },

  // ── EDIT MANOR NOTES ──────────────────────────────────────
  _editManorNotes(key) {
    const m = STORE.getManor(key);
    Modal.open(`
      <div style="min-width:420px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Edit Manor Notes — ${key}</div>
        <div class="detail-field mb-8">
          <div class="detail-label">Notes</div>
          <textarea class="edit-input edit-textarea" id="mn-notes" style="min-height:100px;">${m?.notes||''}</textarea>
        </div>
        <div class="npc-detail-grid">
          <div class="detail-field">
            <div class="detail-label">Faction</div>
            <input class="edit-input" id="mn-faction" value="${m?.faction||''}">
          </div>
          <div class="detail-field">
            <div class="detail-label">Lifestyle</div>
            <select class="edit-input edit-select" id="mn-lifestyle">
              ${['Normal','Rich','Extravagant','Impoverished'].map(l=>`<option ${l===(m?.lifestyle||'Normal')?'selected':''}>${l}</option>`).join('')}
            </select>
          </div>
          <div class="detail-field">
            <div class="detail-label">Hatred</div>
            <input class="edit-input" id="mn-hatred" type="number" value="${m?.hatred??0}">
          </div>
          <div class="detail-field">
            <div class="detail-label">Care</div>
            <input class="edit-input" id="mn-care" type="number" value="${m?.care??0}">
          </div>
          <div class="detail-field">
            <div class="detail-label">Base Harvest (L)</div>
            <input class="edit-input" id="mn-harvest" type="number" value="${m?.baseHarvest??0}">
          </div>
        </div>
        <div class="btn-row mt-12">
          <button class="btn btn-primary" onclick="TabManors._saveManorNotes('${key}')">Save</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`, {wide: false});
  },

  _saveManorNotes(key) {
    const g = id => document.getElementById(id);
    const m = STORE.getManor(key);
    if (!m) return;
    m.notes      = g('mn-notes')?.value?.trim() || '';
    m.faction    = g('mn-faction')?.value?.trim() || '';
    m.lifestyle  = g('mn-lifestyle')?.value || 'Normal';
    m.hatred     = parseInt(g('mn-hatred')?.value, 10) || 0;
    m.care       = parseInt(g('mn-care')?.value, 10) || 0;
    m.baseHarvest= parseInt(g('mn-harvest')?.value, 10) || m.baseHarvest;
    STORE.save();
    Modal.close();
    Toast.success('Saved');
    this._renderManor();
  },

  // ── MARK REPAIRED ──────────────────────────────────────────
  _markRepaired(key, damageId) {
    const m = STORE.getManor(key);
    const d = m?.propertyDamage?.find(x => x.id == damageId);
    if (d) { d.status = 'repaired'; STORE.save(); Toast.success('Marked repaired'); this._renderManor(); }
  },

  // Navigate to Overview and open the inline record panel
  _goToRecord(key) {
    this._section    = 'overview';
    this._recordOpen = true;
    this._workingEntry = null; // will be initialized by toggleRecord logic
    const m = STORE.getManor(key);
    if (m) {
      const lastTreas = STORE.manorTreasury(key);
      const activeI    = (m.improvements||[]).filter(i=>i.status==='active');
      const autoMaint  = activeI.reduce((s,i)=>s+(i.maintenance||0),0);
      const autoIncome = activeI.reduce((s,i)=>s+(i.income||0),0);
      this._workingEntry = {
        year: STORE.year,
        stewardResult: null, fateResult: null, tiebreaker: null,
        luck: 'No Result', luckSeason: '—',
        conflict: 'No Result', conflictSeason: '—',
        harvestOutcome: null, harvestIncome: 0,
        lifestyle: m.lifestyle || 'Normal',
        improvMaint: autoMaint,
        improvIncome: autoIncome,
        prevTreasury: lastTreas,
      };
    }
    this._renderManor();
    document.getElementById('manorContent')?.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // ── ADD HISTORY (legacy modal — kept for reference) ────────
  openAddHistory(key) {
    const m         = STORE.getManor(key);
    const nextYear  = STORE.year;
    const lastTreas = STORE.manorTreasury(key);
    const stewardSkill = m?.steward_skill;

    const lifestyleOpts = ['Normal','Rich','Extravagant','Impoverished'].map(l => `<option ${l==='Normal'?'selected':''}>${l}</option>`).join('');
    const harvestOpts   = ['Incredible','Excellent','Good','Regular','Meager','Bad','Very Bad','Negligible'].map(h => `<option ${h==='Regular'?'selected':''}>${h}</option>`).join('');
    const conflictOpts  = ['No Result','Bandits','Raided','Pillaged','Plundered'].map(c => `<option>${c}</option>`).join('');
    const luckOpts      = ['No Result','Boon','Calamity'].map(l => `<option>${l}</option>`).join('');
    const seasonOpts    = ['—','Spring','Summer','Fall','Winter'].map(s => `<option>${s}</option>`).join('');
    const resultOpts    = ['—','Critical','Success','Failure','Fumble'].map(r => `<option>${r}</option>`).join('');
    const tiebreakerOpts = ['—','win','lose'].map(r => `<option>${r}</option>`).join('');

    Modal.open(`
      <div style="min-width:560px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:16px;">Record Year — ${key}</div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">

          <!-- EVENTS & FATE -->
          <div>
            <div class="section-title mb-8">Events</div>
            <div class="detail-field mb-8">
              <div class="detail-label">Year</div>
              <input class="edit-input" id="hy-year" type="number" value="${nextYear}">
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Luck</div>
              <select class="edit-input edit-select" id="hy-luck">${luckOpts}</select>
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Luck Season</div>
              <select class="edit-input edit-select" id="hy-luck-season">${seasonOpts}</select>
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Conflict</div>
              <select class="edit-input edit-select" id="hy-conflict">${conflictOpts}</select>
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Conflict Season</div>
              <select class="edit-input edit-select" id="hy-conflict-season">${seasonOpts}</select>
            </div>

            <div class="section-title mb-8 mt-12">Fate Modifiers</div>
            ${['Weather','Conflict','Commoners','Presence','Misc'].map(f=>`
              <div class="detail-field mb-6">
                <div class="detail-label">${f}</div>
                <input class="edit-input" id="hy-fate-${f.toLowerCase()}" type="number" value="0">
              </div>`).join('')}

            <div class="section-title mb-8 mt-12">Test Results</div>
            <div class="detail-field mb-8">
              <div class="detail-label">Steward Roll ${stewardSkill?'(Skill '+stewardSkill+')':''}</div>
              <select class="edit-input edit-select" id="hy-steward-result">${resultOpts}</select>
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Fate Roll</div>
              <select class="edit-input edit-select" id="hy-fate-result">${resultOpts}</select>
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Tiebreaker</div>
              <select class="edit-input edit-select" id="hy-tiebreaker">${tiebreakerOpts}</select>
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Harvest Outcome</div>
              <select class="edit-input edit-select" id="hy-harvest">${harvestOpts}</select>
            </div>
          </div>

          <!-- INCOME -->
          <div>
            <div class="section-title mb-8">Income</div>
            <div class="detail-field mb-8">
              <div class="detail-label">Harvest Income (L)</div>
              <input class="edit-input" id="hy-harvest-income" type="number" value="0">
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Steward Industry (L)</div>
              <input class="edit-input" id="hy-steward-industry" type="number" value="0">
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Improvement Income (L)</div>
              <input class="edit-input" id="hy-impr-income" type="number" value="0">
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Discretionary (L)</div>
              <input class="edit-input" id="hy-discretionary" type="number" value="0">
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Extra-Manorial (L)</div>
              <input class="edit-input" id="hy-extra-manorial" type="number" value="0">
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label" style="display:flex;justify-content:space-between;align-items:center;">
                Misc Income
                <button class="btn btn-ghost" style="font-size:0.6rem;padding:1px 6px;" onclick="event.preventDefault();TabManors._addMiscItem('hy-misc-income-list')">＋ Add</button>
              </div>
              <div id="hy-misc-income-list" style="display:flex;flex-direction:column;gap:0;"></div>
            </div>

            <div class="section-title mb-8 mt-12">Expenses</div>
            <div class="detail-field mb-8">
              <div class="detail-label">Lifestyle</div>
              <select class="edit-input edit-select" id="hy-lifestyle">${lifestyleOpts}</select>
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Lifestyle Cost (L)</div>
              <input class="edit-input" id="hy-lifestyle-cost" type="number" value="4">
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Improvement Maint (L)</div>
              <input class="edit-input" id="hy-impr-maint" type="number" value="0">
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Family Expenses (L)</div>
              <input class="edit-input" id="hy-family" type="number" value="0">
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Build Cost (L)</div>
              <input class="edit-input" id="hy-impr-build" type="number" value="0">
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label" style="display:flex;justify-content:space-between;align-items:center;">
                Misc Expenses
                <button class="btn btn-ghost" style="font-size:0.6rem;padding:1px 6px;" onclick="event.preventDefault();TabManors._addMiscItem('hy-misc-exp-list')">＋ Add</button>
              </div>
              <div id="hy-misc-exp-list" style="display:flex;flex-direction:column;gap:0;"></div>
            </div>
          </div>

          <!-- TREASURY & NOTES -->
          <div>
            <div class="section-title mb-8">Treasury</div>
            <div class="detail-field mb-8">
              <div class="detail-label">Prev. Treasury (L)</div>
              <input class="edit-input" id="hy-prev-treasury" type="number" value="${lastTreas}">
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Treasury After (L)</div>
              <input class="edit-input" id="hy-treasury" type="number" value="${lastTreas}">
            </div>

            <div class="section-title mb-8 mt-12">Hatred / Care</div>
            <div class="detail-field mb-8">
              <div class="detail-label">Hatred (after)</div>
              <input class="edit-input" id="hy-hatred" type="number" value="${m?.hatred??0}">
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Care (after)</div>
              <input class="edit-input" id="hy-care" type="number" value="${m?.care??0}">
            </div>

            <div class="section-title mb-8 mt-12">Notes</div>
            <div class="detail-field mb-8">
              <div class="detail-label">Notes</div>
              <textarea class="edit-input edit-textarea" id="hy-notes"></textarea>
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Notes 2</div>
              <textarea class="edit-input edit-textarea" id="hy-notes2"></textarea>
            </div>
          </div>

        </div>

        <div class="btn-row mt-16">
          <button class="btn btn-primary" onclick="TabManors._saveHistory('${key}')">Save Year</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`, { wide: true });
  },

  _saveHistory(key) {
    const g = id => document.getElementById(id);
    const year = parseInt(g('hy-year')?.value, 10);
    if (!year) { Toast.error('Year required'); return; }

    const m = STORE.getManor(key);

    // Guard against duplicate year entries
    if (m.history && m.history.some(h => h.year === year)) {
      Toast.error(`A record for ${year} AD already exists. Edit the existing entry instead.`);
      return;
    }

    // Update hatred/care on the manor itself
    const newHatred = parseInt(g('hy-hatred')?.value, 10);
    const newCare   = parseInt(g('hy-care')?.value, 10);
    if (!isNaN(newHatred)) m.hatred = newHatred;
    if (!isNaN(newCare))   m.care   = newCare;

    const entry = {
      year,
      luck:             g('hy-luck')?.value || 'No Result',
      luckSeason:       g('hy-luck-season')?.value || '—',
      conflict:         g('hy-conflict')?.value || 'No Result',
      conflictSeason:   g('hy-conflict-season')?.value || '—',
      harvestOutcome:   g('hy-harvest')?.value || 'Regular',
      harvestIncome:    parseFloat(g('hy-harvest-income')?.value)||0,
      stewardIndustry:  parseFloat(g('hy-steward-industry')?.value)||0,
      improvIncome:     parseFloat(g('hy-impr-income')?.value)||0,
      discretionary:    parseFloat(g('hy-discretionary')?.value)||0,
      extraManorial:    parseFloat(g('hy-extra-manorial')?.value)||0,
      miscIncomeItems:  this._readMiscItems('hy-misc-income-list'),
      lifestyle:        g('hy-lifestyle')?.value || 'Normal',
      lifestyleCost:    parseFloat(g('hy-lifestyle-cost')?.value)||0,
      improvMaint:      parseFloat(g('hy-impr-maint')?.value)||0,
      family:           parseFloat(g('hy-family')?.value)||0,
      improvBuild:      parseFloat(g('hy-impr-build')?.value)||0,
      miscExpItems:     this._readMiscItems('hy-misc-exp-list'),
      prevTreasury:     parseFloat(g('hy-prev-treasury')?.value)||0,
      treasury:         parseFloat(g('hy-treasury')?.value)||0,
      fateWeather:      parseFloat(g('hy-fate-weather')?.value)||0,
      fateConflict:     parseFloat(g('hy-fate-conflict')?.value)||0,
      fateCommoners:    parseFloat(g('hy-fate-commoners')?.value)||0,
      fatePresence:     parseFloat(g('hy-fate-presence')?.value)||0,
      fateMisc:         parseFloat(g('hy-fate-misc')?.value)||0,
      stewardResult:    g('hy-steward-result')?.value || '—',
      fateResult:       g('hy-fate-result')?.value || '—',
      tiebreaker:       g('hy-tiebreaker')?.value || '—',
      notes:            g('hy-notes')?.value?.trim() || '',
      notes2:           g('hy-notes2')?.value?.trim() || '',
    };

    STORE.addManorHistory(key, entry);
    Toast.success('Year recorded');
    Modal.close();
    this._section = 'history';
    this._expanded.add(`${key}-${year}`);
    this._renderManor();
  },

  // ── ADD IMPROVEMENT ────────────────────────────────────────
  openAddImprovement(key) {
    Modal.open(`
      <div style="min-width:420px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Add Improvement — ${key}</div>
        <div class="npc-detail-grid">
          <div class="detail-field"><div class="detail-label">Name</div><input class="edit-input" id="ai-name" placeholder="Apiary, Mill, Tower…"></div>
          <div class="detail-field"><div class="detail-label">Category</div>
            <select class="edit-input edit-select" id="ai-cat"><option value="improvement">Improvement</option><option value="fortification">Fortification</option></select>
          </div>
          <div class="detail-field"><div class="detail-label">Year Built</div><input class="edit-input" id="ai-year" type="number" value="${STORE.year}"></div>
          <div class="detail-field"><div class="detail-label">Build Cost (L)</div><input class="edit-input" id="ai-cost" type="number" value="0"></div>
          <div class="detail-field"><div class="detail-label">Maintenance (L/yr)</div><input class="edit-input" id="ai-maint" type="number" value="0" step="0.5"></div>
          <div class="detail-field"><div class="detail-label">Fixed Income (L/yr)</div><input class="edit-input" id="ai-income" type="number" value="0" step="0.5"></div>
          <div class="detail-field"><div class="detail-label">Dice Income (e.g. 1d2)</div><input class="edit-input" id="ai-income-note" placeholder="1d2, 1d3+1…"></div>
          <div class="detail-field"><div class="detail-label">DV Modifier</div><input class="edit-input" id="ai-dv" type="number" value="0"></div>
          <div class="detail-field"><div class="detail-label">DV Note</div><input class="edit-input" id="ai-dv-note" placeholder="Optional description"></div>
        </div>
        <div class="detail-field mt-8 mb-8">
          <div class="detail-label">Notes</div>
          <textarea class="edit-input edit-textarea" id="ai-notes" placeholder="Additional notes…"></textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabManors._saveImprovement('${key}')">Add</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`);
  },

  _saveImprovement(key) {
    const g    = id => document.getElementById(id);
    const name = g('ai-name')?.value?.trim();
    if (!name) { Toast.error('Name required'); return; }
    const m = STORE.getManor(key);
    if (!m) return;
    if (!m.improvements) m.improvements = [];
    m.improvements.push({
      id:          Date.now(),
      name,
      cat:         g('ai-cat')?.value || 'improvement',
      status:      'active',
      yearBuilt:   parseInt(g('ai-year')?.value, 10) || STORE.year,
      yearIncome:  parseInt(g('ai-year')?.value, 10) || STORE.year,
      buildCost:   parseFloat(g('ai-cost')?.value)||0,
      maintenance: parseFloat(g('ai-maint')?.value)||0,
      income:      parseFloat(g('ai-income')?.value)||0,
      incomeNote:  g('ai-income-note')?.value?.trim()||'',
      dvMod:       parseInt(g('ai-dv')?.value, 10)||0,
      dvNote:      g('ai-dv-note')?.value?.trim()||'',
      notes:       g('ai-notes')?.value?.trim()||'',
    });
    STORE.save();
    Toast.success('Improvement added');
    Modal.close();
    this._renderManor();
  },

  // ── EDIT IMPROVEMENT ───────────────────────────────────────
  openEditImprovement(key, imprId) {
    const m = STORE.getManor(key);
    const i = m?.improvements?.find(x => x.id === imprId || x.id === String(imprId));
    if (!i) return;
    const catOpts = ['improvement','fortification'].map(v=>`<option${v===i.cat?' selected':''}>${v}</option>`).join('');
    Modal.open(`
      <div style="min-width:420px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Edit Improvement — ${key}</div>
        <div class="npc-detail-grid">
          <div class="detail-field"><div class="detail-label">Name</div><input class="edit-input" id="ei-name" value="${i.name}"></div>
          <div class="detail-field"><div class="detail-label">Category</div>
            <select class="edit-input edit-select" id="ei-cat">${catOpts}</select>
          </div>
          <div class="detail-field"><div class="detail-label">Year Built</div><input class="edit-input" id="ei-year" type="number" value="${i.yearBuilt}"></div>
          <div class="detail-field"><div class="detail-label">Build Cost (L)</div><input class="edit-input" id="ei-cost" type="number" value="${i.buildCost||0}"></div>
          <div class="detail-field"><div class="detail-label">Maintenance (L/yr)</div><input class="edit-input" id="ei-maint" type="number" value="${i.maintenance||0}" step="0.5"></div>
          <div class="detail-field"><div class="detail-label">Fixed Income (L/yr)</div><input class="edit-input" id="ei-income" type="number" value="${i.income||0}" step="0.5"></div>
          <div class="detail-field"><div class="detail-label">Dice Income (e.g. 1d2)</div><input class="edit-input" id="ei-income-note" value="${i.incomeNote||''}" placeholder="1d2, 1d3+1…"></div>
          <div class="detail-field"><div class="detail-label">DV Modifier</div><input class="edit-input" id="ei-dv" type="number" value="${i.dvMod||0}"></div>
          <div class="detail-field"><div class="detail-label">DV Note</div><input class="edit-input" id="ei-dv-note" value="${i.dvNote||''}" placeholder="Optional description"></div>
        </div>
        <div class="detail-field mt-8 mb-8">
          <div class="detail-label">Notes</div>
          <textarea class="edit-input edit-textarea" id="ei-notes">${i.notes||''}</textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabManors._saveEditImprovement('${key}',${imprId})">Save</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`);
  },

  _saveEditImprovement(key, imprId) {
    const m = STORE.getManor(key);
    const i = m?.improvements?.find(x => x.id === imprId || x.id === String(imprId));
    if (!i) return;
    const g = id => document.getElementById(id);
    const name = g('ei-name')?.value?.trim();
    if (!name) { Toast.error('Name required'); return; }
    i.name        = name;
    i.cat         = g('ei-cat')?.value || 'improvement';
    i.yearBuilt   = parseInt(g('ei-year')?.value, 10) || i.yearBuilt;
    i.buildCost   = parseFloat(g('ei-cost')?.value)||0;
    i.maintenance = parseFloat(g('ei-maint')?.value)||0;
    i.income      = parseFloat(g('ei-income')?.value)||0;
    i.incomeNote  = g('ei-income-note')?.value?.trim()||'';
    i.dvMod       = parseInt(g('ei-dv')?.value, 10)||0;
    i.dvNote      = g('ei-dv-note')?.value?.trim()||'';
    i.notes       = g('ei-notes')?.value?.trim()||'';
    STORE.save();
    Toast.success('Improvement updated');
    Modal.close();
    this._renderManor();
  },

  // ── ADD DAMAGE ─────────────────────────────────────────────
  openAddDamage(key) {
    Modal.open(`
      <div style="min-width:380px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Log Property Damage — ${key}</div>
        <div class="detail-field mb-8">
          <div class="detail-label">Type</div>
          <select class="edit-input edit-select" id="ad-type" onchange="TabManors._onDamageTypeChange()">
            <option value="General">General</option>
            <option value="Field">Field</option>
            <option value="Building">Building</option>
            <option value="Livestock">Livestock</option>
          </select>
        </div>
        <div id="ad-field-row" style="display:none;" class="detail-field mb-8">
          <div class="detail-label">Number of Fields Damaged</div>
          <input class="edit-input" id="ad-num-fields" type="number" value="1" min="1" step="1">
          <div style="font-size:0.72rem;color:var(--ink-soft);margin-top:3px;font-style:italic;">Each damaged field reduces harvest income by 1 L for the damaged year.</div>
        </div>
        <div class="detail-field mb-8"><div class="detail-label">Description</div><input class="edit-input" id="ad-desc" placeholder="Fields burned, mill roof collapsed…"></div>
        <div class="detail-field mb-8"><div class="detail-label">Repair Cost (L)</div><input class="edit-input" id="ad-cost" type="number" value="0"></div>
        <div class="detail-field mb-8">
          <div class="detail-label">Estimated Year Repaired <span style="opacity:0.5;">(optional — will prompt you that year)</span></div>
          <input class="edit-input" id="ad-year-repaired" type="number" placeholder="${STORE.year + 1}">
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabManors._saveDamage('${key}')">Log</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`);
  },

  openEditDamage(key, id) {
    const m = STORE.getManor(key);
    const d = m?.propertyDamage?.find(x => x.id == id);
    if (!d) return;
    const typeOpts = ['General','Field','Building','Livestock'].map(v =>
      `<option${v===(d.type||'General')?' selected':''}>${v}</option>`).join('');
    Modal.open(`
      <div style="min-width:380px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Edit Damage — ${key}</div>
        <div class="detail-field mb-8">
          <div class="detail-label">Type</div>
          <select class="edit-input edit-select" id="ed-type" onchange="TabManors._onEditDamageTypeChange()">${typeOpts}</select>
        </div>
        <div id="ed-field-row" style="display:${d.type==='Field'?'block':'none'};" class="detail-field mb-8">
          <div class="detail-label">Number of Fields Damaged</div>
          <input class="edit-input" id="ed-num-fields" type="number" value="${d.numFields||1}" min="1">
        </div>
        <div class="detail-field mb-8"><div class="detail-label">Description</div><input class="edit-input" id="ed-desc" value="${d.description||''}"></div>
        <div class="detail-field mb-8"><div class="detail-label">Repair Cost (L)</div><input class="edit-input" id="ed-cost" type="number" value="${d.repairCost||0}"></div>
        <div class="detail-field mb-8">
          <div class="detail-label">Estimated Year Repaired</div>
          <input class="edit-input" id="ed-year-repaired" type="number" value="${d.yearRepaired||''}" placeholder="leave blank if unknown">
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Notes</div>
          <textarea class="edit-input edit-textarea" id="ed-notes">${d.notes||''}</textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabManors._saveEditDamage('${key}',${id})">Save</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`);
  },

  _onEditDamageTypeChange() {
    const type = document.getElementById('ed-type')?.value;
    const row  = document.getElementById('ed-field-row');
    if (row) row.style.display = type === 'Field' ? 'block' : 'none';
  },

  _saveEditDamage(key, id) {
    const g = id2 => document.getElementById(id2);
    const m = STORE.getManor(key);
    const d = m?.propertyDamage?.find(x => x.id == id);
    if (!d) return;
    const type = g('ed-type')?.value || 'General';
    d.type        = type;
    d.numFields   = type === 'Field' ? (parseInt(g('ed-num-fields')?.value, 10) || 1) : null;
    d.description = g('ed-desc')?.value?.trim() || d.description;
    d.repairCost  = parseFloat(g('ed-cost')?.value) || 0;
    d.yearRepaired= parseInt(g('ed-year-repaired')?.value, 10) || null;
    d.notes       = g('ed-notes')?.value?.trim() || '';
    STORE.save();
    Toast.success('Damage updated');
    Modal.close();
    this._renderManor();
  },

  _onDamageTypeChange() {
    const type = document.getElementById('ad-type')?.value;
    const row  = document.getElementById('ad-field-row');
    if (row) row.style.display = type === 'Field' ? 'block' : 'none';
  },

  _saveDamage(key) {
    const g    = id => document.getElementById(id);
    const type = g('ad-type')?.value || 'General';
    const desc = g('ad-desc')?.value?.trim() || (type === 'Field' ? 'Fields damaged' : '');
    if (!desc && type !== 'Field') { Toast.error('Description required'); return; }
    const m = STORE.getManor(key);
    if (!m) return;
    if (!m.propertyDamage) m.propertyDamage = [];

    const numFields    = type === 'Field' ? (parseInt(g('ad-num-fields')?.value, 10) || 1) : null;
    const yearRepaired = parseInt(g('ad-year-repaired')?.value, 10) || null;

    m.propertyDamage.push({
      id: Date.now(),
      type,
      description:  desc || `${numFields} field${numFields !== 1 ? 's' : ''} damaged`,
      repairCost:   parseFloat(g('ad-cost')?.value) || 0,
      numFields,
      yearRepaired,
      status: 'damaged',
    });
    STORE.save();
    Toast.success('Damage logged');
    Modal.close();
    if (!this._recordOpen) this._renderManor();
  },

  // ══════════════════════════════════════════════════════════
  // STABLES — horse tracking & survival rolls
  // ══════════════════════════════════════════════════════════

  _stablesCacheKey(key) {
    // GM uses manor key; player always uses 'self'
    return isGM() ? `gm:${key}` : 'self';
  },

  async _loadHorses(key) {
    const url = isGM() ? `/api/horses/${encodeURIComponent(key)}` : '/api/horses';
    try {
      const r = await fetch(url);
      const d = await r.json();
      this._horsesCache[this._stablesCacheKey(key)] = d.horses || [];
    } catch {
      this._horsesCache[this._stablesCacheKey(key)] = [];
    }
    this.render();
  },

  async _persistHorses(key) {
    const horses = this._horsesCache[this._stablesCacheKey(key)] || [];
    const url = isGM() ? `/api/horses/${encodeURIComponent(key)}` : '/api/horses';
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horses }),
      });
    } catch (e) {
      Toast.error('Failed to save horses');
    }
  },

  _renderStables(m, key, col, readOnly = false) {
    const cacheKey = this._stablesCacheKey(key);
    if (!this._horsesCache[cacheKey]) {
      this._loadHorses(key);
      return '<div style="padding:32px;text-align:center;opacity:0.5;font-style:italic;">Loading stables…</div>';
    }

    const year   = STORE.year;
    const horses = this._horsesCache[cacheKey];
    const living = horses.filter(h => h.alive !== false);
    const dead   = horses.filter(h => h.alive === false)
                         .sort((a, b) => (b.year_died || 0) - (a.year_died || 0));

    // Cemetery: show 30 most recent + always show favorites
    const shown30ids = new Set(dead.slice(0, 30).map(h => h.id));
    const cemeteryHorses = dead.filter(h => shown30ids.has(h.id) || h.favorite);
    const favCount = dead.filter(h => h.favorite).length;

    const riderName = h => {
      if (!h.rider) return null;
      const npc = STORE.getNpc(h.rider);
      return npc ? npc.name : null;
    };

    const horseCardHtml = h => {
      const age      = year - (h.year_born || year);
      const typeTag  = HORSE_WAR.includes(h.type) ? 'war' : HORSE_RIDING.includes(h.type) ? 'riding' : 'work';
      const needsRoll = HORSE_WAR.includes(h.type) || HORSE_RIDING.includes(h.type);
      const ageOver  = Math.max(0, age - 7);
      const lastRoll = h.survivalHistory?.length ? h.survivalHistory[h.survivalHistory.length - 1] : null;
      const rider    = riderName(h);

      const lastRollHtml = lastRoll ? `
        <div style="font-size:0.7rem;color:var(--ink-soft);margin-top:5px;">
          Last roll (${lastRoll.year} AD): rolled <strong>${lastRoll.roll}</strong>
          ${lastRoll.modified_total !== lastRoll.roll ? `→ modified <strong>${lastRoll.modified_total}</strong>` : ''} —
          <span style="color:${lastRoll.result==='healthy'?'var(--verdigris-mid)':lastRoll.result==='ruined'?'var(--gold)':'var(--crimson-mid)'};">${lastRoll.result}</span>
        </div>` : '';

      return `
        <div class="horse-card" style="border-left:3px solid ${col};">
          <div style="display:flex;align-items:flex-start;gap:10px;">
            <div style="flex:1;min-width:0;">
              <div style="font-family:var(--font-display);font-size:0.92rem;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(h.name)}</div>
              <div style="display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:wrap;">
                <span class="horse-type-badge horse-type-${typeTag}">${esc(h.type)}</span>
                <span style="font-family:var(--font-heading);font-size:0.65rem;color:var(--ink-soft);">Age ${age}</span>
                ${ageOver > 0 ? `<span style="font-family:var(--font-heading);font-size:0.6rem;color:var(--crimson-mid);">−${ageOver} age</span>` : ''}
              </div>
              <div style="margin-top:6px;display:flex;gap:16px;flex-wrap:wrap;">
                <div><div class="detail-label">Rider</div><div style="font-size:0.8rem;margin-top:1px;">${rider ? esc(rider) : '<span style="opacity:0.4;font-style:italic;">None</span>'}</div></div>
                ${h.notes ? `<div style="min-width:0;flex:1;"><div class="detail-label">Notes</div><div style="font-size:0.8rem;margin-top:1px;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(h.notes)}</div></div>` : ''}
              </div>
              ${lastRollHtml}
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0;">
              ${needsRoll && !readOnly ? `<button class="btn btn-ghost" style="padding:2px 9px;font-size:0.52rem;" onclick="TabManors.openSurvivalRoll('${key}','${h.id}')">🎲 Roll</button>` : ''}
              ${!readOnly ? `
                <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.5rem;" onclick="TabManors.openEditHorse('${key}','${h.id}')">✎</button>
                <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.5rem;color:var(--crimson-mid);" onclick="TabManors._killHorse('${key}','${h.id}','dead')">✝</button>
                <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.5rem;color:var(--gold);" onclick="TabManors._killHorse('${key}','${h.id}','ruined')">⚠</button>
                <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.5rem;opacity:0.5;" onclick="TabManors._deleteHorse('${key}','${h.id}')">🗑</button>
              ` : ''}
            </div>
          </div>
        </div>`;
    };

    const cemHorseHtml = h => {
      const lifespan    = `${h.year_born ?? '?'} – ${h.year_died ?? '?'} AD`;
      const reasonLabel = h.death_reason === 'ruined' ? 'Ruined' : 'Dead';
      const reasonColor = h.death_reason === 'ruined' ? 'var(--gold)' : 'var(--crimson-mid)';
      const canFav = h.favorite || favCount < 10;
      const favDisabled = !canFav ? 'disabled title="Remove a favourite to add another (10/10)"' : '';
      return `
        <div class="horse-card horse-card-dead">
          <div style="display:flex;align-items:flex-start;gap:8px;">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="font-family:var(--font-display);font-size:0.85rem;color:var(--ink-soft);">${esc(h.name)}</span>
                <span style="font-family:var(--font-heading);font-size:0.6rem;color:${reasonColor};">${reasonLabel}</span>
                ${h.favorite ? '<span style="font-family:var(--font-heading);font-size:0.55rem;color:var(--gold);">★ Favourite</span>' : ''}
              </div>
              <div style="font-family:var(--font-heading);font-size:0.62rem;color:var(--ink-soft);opacity:0.7;margin-top:2px;">${esc(h.type)} · ${lifespan}</div>
              ${h.notes ? `<div style="font-size:0.72rem;color:var(--ink-soft);font-style:italic;margin-top:2px;">${esc(h.notes.length > 120 ? h.notes.slice(0, 120).replace(/\s+\S*$/, '') + '…' : h.notes)}</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0;">
              <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.85rem;${!canFav ? 'opacity:0.35;' : ''}"
                onclick="TabManors._toggleFavorite('${key}','${h.id}')" ${favDisabled}>
                ${h.favorite ? '★' : '☆'}
              </button>
              <button class="btn btn-ghost" style="padding:2px 8px;font-size:0.5rem;opacity:0.5;" onclick="TabManors._deleteHorse('${key}','${h.id}')">🗑</button>
            </div>
          </div>
        </div>`;
    };

    const addBtn = readOnly ? '' :
      `<button class="btn btn-verdigris" onclick="TabManors.openAddHorse('${key}')" style="font-size:0.72rem;">+ Add Horse</button>`;

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div class="section-title" style="margin-bottom:0;">Active Stable (${living.length})</div>
        ${addBtn}
      </div>
      ${living.length
        ? `<div style="display:flex;flex-direction:column;gap:8px;">${living.map(horseCardHtml).join('')}</div>`
        : `<div class="text-muted italic" style="font-size:0.85rem;margin-bottom:16px;">No horses stabled here yet.</div>`
      }
      ${cemeteryHorses.length ? `
        <div class="section-title mt-20" style="opacity:0.6;margin-bottom:10px;">⚰ Pet Cemetery (${dead.length}${dead.length > 30 ? ', showing ' + cemeteryHorses.length : ''})</div>
        <div style="display:flex;flex-direction:column;gap:6px;">${cemeteryHorses.map(cemHorseHtml).join('')}</div>
      ` : ''}`;
  },

  // ── ADD / EDIT HORSE MODALS ────────────────────────────────

  openAddHorse(key) {
    const household = STORE.householdMembers(key);
    const pk = household.find(n => n.role === 'PK');
    const riderOptions = [
      pk ? `<option value="${pk.id}">${esc(pk.name)} (PK)</option>` : '',
      ...household.filter(n => n !== pk).map(n => `<option value="${n.id}">${esc(n.name)}</option>`),
    ].join('');

    const typeOptions = [
      `<optgroup label="War Horses">${HORSE_WAR.map(t => `<option value="${t}">${t}</option>`).join('')}</optgroup>`,
      `<optgroup label="Riding Horses">${HORSE_RIDING.map(t => `<option value="${t}">${t}</option>`).join('')}</optgroup>`,
      `<optgroup label="Work Horses">${HORSE_WORK.map(t => `<option value="${t}">${t}</option>`).join('')}</optgroup>`,
    ].join('');

    Modal.open(`
      <div style="min-width:340px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:16px;">Add Horse — ${esc(key)}</div>
        <div class="detail-field mb-10">
          <div class="detail-label">Name *</div>
          <input id="ah-name" class="form-input" type="text" placeholder="e.g. Shadowmane" autocomplete="off">
        </div>
        <div class="detail-field mb-10">
          <div class="detail-label">Type *</div>
          <select id="ah-type" class="form-input" onchange="TabManors._onHorseTypeChange()">
            ${typeOptions}
          </select>
        </div>
        <div id="ah-type-hint" style="font-size:0.75rem;color:var(--ink-soft);font-style:italic;margin:6px 0 12px 0;">Combat horses are typically fully-fledged at age 6.</div>
        <div class="detail-field mb-10">
          <div class="detail-label">Age *</div>
          <input id="ah-age" class="form-input" type="number" min="0" max="30" value="6" oninput="this._touched=true">
        </div>
        <div class="detail-field mb-10">
          <div class="detail-label">Rider</div>
          <select id="ah-rider" class="form-input">
            <option value="">— None —</option>
            ${riderOptions}
          </select>
        </div>
        <div class="detail-field mb-16">
          <div class="detail-label">Notes (optional)</div>
          <textarea id="ah-notes" class="form-input" rows="2" placeholder="Markings, history…" style="resize:vertical;"></textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-verdigris" onclick="TabManors._saveNewHorse('${key}')">Add Horse</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`);
  },

  _onHorseTypeChange() {
    const type    = document.getElementById('ah-type')?.value || '';
    const hint    = document.getElementById('ah-type-hint');
    const ageInput = document.getElementById('ah-age');
    if (HORSE_WAR.includes(type)) {
      if (hint) hint.textContent = 'Combat horses are typically fully-fledged at age 6.';
      if (ageInput && !ageInput._touched) ageInput.value = 6;
    } else if (HORSE_RIDING.includes(type)) {
      if (hint) hint.textContent = 'Riding horses are typically fully-fledged at age 5.';
      if (ageInput && !ageInput._touched) ageInput.value = 5;
    } else {
      if (hint) hint.textContent = 'Work horses are typically ready at age 4.';
      if (ageInput && !ageInput._touched) ageInput.value = 4;
    }
  },

  _saveNewHorse(key) {
    const name  = document.getElementById('ah-name')?.value.trim();
    const type  = document.getElementById('ah-type')?.value;
    const age   = parseInt(document.getElementById('ah-age')?.value, 10);
    const rider = document.getElementById('ah-rider')?.value || null;
    const notes = document.getElementById('ah-notes')?.value.trim() || '';
    if (!name)        { Toast.error('Name required'); return; }
    if (isNaN(age) || age < 0) { Toast.error('Valid age required'); return; }

    const cacheKey = this._stablesCacheKey(key);
    const horses   = this._horsesCache[cacheKey] || [];
    horses.push({
      id:           `horse-${Date.now()}`,
      name,
      type,
      year_born:    STORE.year - age,
      year_acquired: STORE.year,
      rider:        rider || null,
      notes,
      alive:        true,
      year_died:    null,
      death_reason: null,
      favorite:     false,
      survivalHistory: [],
    });
    this._horsesCache[cacheKey] = horses;
    this._persistHorses(key);
    Toast.success(`${name} added to the stable.`);
    Modal.close();
    this.render();
  },

  openEditHorse(key, horseId) {
    const cacheKey = this._stablesCacheKey(key);
    const horses   = this._horsesCache[cacheKey] || [];
    const h        = horses.find(x => x.id === horseId);
    if (!h) return;

    const age = STORE.year - (h.year_born || STORE.year);
    const household = STORE.householdMembers(key);
    const pk = household.find(n => n.role === 'PK');
    const riderOptions = [
      `<option value="">— None —</option>`,
      pk ? `<option value="${pk.id}" ${h.rider===pk.id?'selected':''}>${esc(pk.name)} (PK)</option>` : '',
      ...household.filter(n => n !== pk).map(n => `<option value="${n.id}" ${h.rider===n.id?'selected':''}>${esc(n.name)}</option>`),
    ].join('');

    const typeOptions = [
      `<optgroup label="War Horses">${HORSE_WAR.map(t => `<option value="${t}" ${h.type===t?'selected':''}>${t}</option>`).join('')}</optgroup>`,
      `<optgroup label="Riding Horses">${HORSE_RIDING.map(t => `<option value="${t}" ${h.type===t?'selected':''}>${t}</option>`).join('')}</optgroup>`,
      `<optgroup label="Work Horses">${HORSE_WORK.map(t => `<option value="${t}" ${h.type===t?'selected':''}>${t}</option>`).join('')}</optgroup>`,
    ].join('');

    Modal.open(`
      <div style="min-width:340px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:16px;">Edit Horse — ${esc(h.name)}</div>
        <div class="detail-field mb-10">
          <div class="detail-label">Name *</div>
          <input id="eh-name" class="form-input" type="text" value="${esc(h.name)}">
        </div>
        <div class="detail-field mb-10">
          <div class="detail-label">Type</div>
          <select id="eh-type" class="form-input">${typeOptions}</select>
        </div>
        <div class="detail-field mb-10">
          <div class="detail-label">Age (current)</div>
          <input id="eh-age" class="form-input" type="number" min="0" max="30" value="${age}" title="Adjusts year_born">
        </div>
        <div class="detail-field mb-10">
          <div class="detail-label">Rider</div>
          <select id="eh-rider" class="form-input">${riderOptions}</select>
        </div>
        <div class="detail-field mb-16">
          <div class="detail-label">Notes</div>
          <textarea id="eh-notes" class="form-input" rows="2" style="resize:vertical;">${esc(h.notes || '')}</textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-verdigris" onclick="TabManors._saveEditHorse('${key}','${horseId}')">Save</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-ghost" style="color:var(--crimson-mid);margin-left:auto;" onclick="TabManors._deleteHorse('${key}','${horseId}')">Delete</button>
        </div>
      </div>`);
  },

  _saveEditHorse(key, horseId) {
    const cacheKey = this._stablesCacheKey(key);
    const horses   = this._horsesCache[cacheKey] || [];
    const h        = horses.find(x => x.id === horseId);
    if (!h) return;
    const name  = document.getElementById('eh-name')?.value.trim();
    const age   = parseInt(document.getElementById('eh-age')?.value, 10);
    const rider = document.getElementById('eh-rider')?.value || null;
    const notes = document.getElementById('eh-notes')?.value.trim() || '';
    if (!name)             { Toast.error('Name required'); return; }
    if (isNaN(age) || age < 0) { Toast.error('Valid age required'); return; }
    h.name     = name;
    h.type     = document.getElementById('eh-type')?.value || h.type;
    h.year_born = STORE.year - age;
    h.rider    = rider || null;
    h.notes    = notes;
    this._persistHorses(key);
    Toast.success('Horse updated.');
    Modal.close();
    this.render();
  },

  _deleteHorse(key, horseId) {
    const cacheKey = this._stablesCacheKey(key);
    const horses   = this._horsesCache[cacheKey] || [];
    const h        = horses.find(x => x.id === horseId);
    if (!h) return;
    if (!confirm(`Permanently delete ${h.name}? This cannot be undone.`)) return;
    this._horsesCache[cacheKey] = horses.filter(x => x.id !== horseId);
    this._persistHorses(key);
    Toast.show(`${h.name} deleted.`, 'error');
    Modal.close();
    this.render();
  },

  // ── SURVIVAL ROLLS ────────────────────────────────────────

  _noRecordYet() {
    Toast.show(`Re-try once ${STORE.year} AD is recorded for your manor! (Yell at GM Steve if this is late)`, 'error');
  },

  _calcSurvivalModifiers(h, key) {
    const year   = STORE.year;
    const age    = year - (h.year_born || year);
    const manor  = STORE.getManor(key);
    const hist   = (manor?.history || []).filter(e => e.year >= (h.year_acquired || 0));

    // Find current year entry
    const curEntry = hist.find(e => e.year === year);
    const lifestyle = curEntry?.lifestyle || null;

    // Age penalty
    const agePenalty = Math.max(0, age - 7) * -1;

    // Current year penalty
    let poorPenalty = 0;
    let impovPenalty = 0;
    if (lifestyle === 'Poor')          poorPenalty   = -3;
    else if (lifestyle === 'Impoverished') impovPenalty  = -15;

    // Consecutive years (including current) going back through history since year_acquired
    // Count consecutive Poor OR Impoverished years backward from current year, stopping at Normal+
    const histByYear = {};
    hist.forEach(e => { histByYear[e.year] = e.lifestyle; });
    let consecutive = 0;
    for (let y = year; y >= (h.year_acquired || 0); y--) {
      const ls = histByYear[y];
      if (ls === 'Poor' || ls === 'Impoverished') consecutive++;
      else if (ls) break;  // Normal/Rich/Extravagant — stop
      // If no entry for a year, stop (unknown)
      else break;
    }
    // Consecutive modifier is -3 per year (the years themselves, not additional years)
    const consecutivePenalty = consecutive > 0 ? consecutive * -3 : 0;

    return {
      year,
      age,
      lifestyle,
      agePenalty,
      poorPenalty,
      impovPenalty,
      consecutive,
      consecutivePenalty,
      total: agePenalty + poorPenalty + impovPenalty + consecutivePenalty,
      missingHistory: !curEntry,
    };
  },

  openSurvivalRoll(key, horseId, force = false) {
    const cacheKey = this._stablesCacheKey(key);
    const horses   = this._horsesCache[cacheKey] || [];
    const h        = horses.find(x => x.id === horseId);
    if (!h) return;

    const mods = this._calcSurvivalModifiers(h, key);

    if (mods.missingHistory && !force) {
      Modal.open(`
        <div style="min-width:340px;">
          <div style="font-family:var(--font-display);font-size:0.95rem;margin-bottom:10px;">⚠ ${STORE.year} AD Not Recorded</div>
          <div style="font-size:0.82rem;color:var(--ink-soft);margin-bottom:18px;">
            Economic Circumstances for <strong>${STORE.year} AD</strong> haven't been recorded for this manor yet.<br><br>
            Are you rolling for a different year, or testing?
          </div>
          <div class="btn-row">
            <button class="btn btn-verdigris" onclick="Modal.close();TabManors.openSurvivalRoll('${key}','${horseId}',true)">Yes, Roll Anyway</button>
            <button class="btn btn-ghost" onclick="Modal.close();TabManors._noRecordYet()">No, Not Yet</button>
          </div>
        </div>`);
      return;
    }

    // Roll
    const roll    = Math.floor(Math.random() * 20) + 1;
    const modified = roll + mods.total;
    const result  = modified <= 1 ? 'dead' : modified === 2 ? 'ruined' : 'healthy';
    const resultLabel = result === 'dead' ? 'Dead' : result === 'ruined' ? 'Ruined' : 'Healthy';
    const resultColor = result === 'healthy' ? 'var(--verdigris-mid)' : result === 'ruined' ? 'var(--gold)' : 'var(--crimson-mid)';

    const modRow = (label, val) => val !== 0
      ? `<div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:3px 0;">
           <span style="color:var(--ink-soft);">${label}</span>
           <span style="color:${val < 0 ? 'var(--crimson-mid)' : 'var(--verdigris-mid)'};">${val > 0 ? '+' : ''}${val}</span>
         </div>` : '';

    Modal.open(`
      <div style="min-width:340px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:4px;">Survival Roll — ${esc(h.name)}</div>
        <div style="font-family:var(--font-heading);font-size:0.62rem;color:var(--ink-soft);margin-bottom:16px;">${esc(h.type)} · Age ${mods.age} · ${STORE.year} AD</div>

        <div style="text-align:center;margin-bottom:16px;">
          <div style="font-family:var(--font-display);font-size:2.5rem;color:var(--ink);line-height:1;">${roll}</div>
          <div style="font-family:var(--font-heading);font-size:0.6rem;color:var(--ink-soft);margin-top:2px;">d20 roll</div>
        </div>

        ${mods.total !== 0 ? `
          <div style="border:1px solid var(--vellum-deep);border-radius:var(--radius);padding:10px 12px;margin-bottom:12px;">
            <div style="font-family:var(--font-heading);font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:6px;">Modifiers</div>
            ${modRow(`Age ${mods.age} (over 7 by ${mods.age - 7})`, mods.agePenalty)}
            ${modRow('Poor this year', mods.poorPenalty)}
            ${modRow('Impoverished this year', mods.impovPenalty)}
            ${modRow(`Consecutive poor/impoverished years (${mods.consecutive}×)`, mods.consecutivePenalty)}
            <div style="display:flex;justify-content:space-between;font-size:0.8rem;padding:4px 0 0;border-top:1px solid var(--vellum-deep);margin-top:4px;font-weight:600;">
              <span>Modified total</span>
              <span>${modified}</span>
            </div>
          </div>
        ` : `<div style="font-size:0.8rem;color:var(--ink-soft);margin-bottom:12px;font-style:italic;">No modifiers apply.</div>`}

        <div style="text-align:center;margin-bottom:16px;">
          <div style="font-family:var(--font-display);font-size:1.4rem;color:${resultColor};">${resultLabel}</div>
          ${result === 'dead'   ? '<div style="font-size:0.78rem;color:var(--ink-soft);margin-top:2px;">The horse has died.</div>' : ''}
          ${result === 'ruined' ? '<div style="font-size:0.78rem;color:var(--ink-soft);margin-top:2px;">The horse is no longer serviceable.</div>' : ''}
          ${result === 'healthy' ? '<div style="font-size:0.78rem;color:var(--ink-soft);margin-top:2px;">The horse survives the winter.</div>' : ''}
        </div>

        <div class="btn-row">
          <button class="btn btn-verdigris" onclick="TabManors._confirmSurvivalRoll('${key}','${horseId}',${roll},${modified},'${result}')">Confirm & Record</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel (reroll)</button>
        </div>
      </div>`);
  },

  _confirmSurvivalRoll(key, horseId, roll, modified, result) {
    const cacheKey = this._stablesCacheKey(key);
    const horses   = this._horsesCache[cacheKey] || [];
    const h        = horses.find(x => x.id === horseId);
    if (!h) return;

    const mods = this._calcSurvivalModifiers(h, key);

    if (!h.survivalHistory) h.survivalHistory = [];
    h.survivalHistory.push({
      year:           STORE.year,
      roll,
      modifiers: {
        age_penalty:  mods.agePenalty,
        poor:         mods.poorPenalty,
        impoverished: mods.impovPenalty,
        consecutive:  mods.consecutivePenalty,
      },
      modified_total: modified,
      result,
    });

    if (result === 'dead' || result === 'ruined') {
      h.alive        = false;
      h.year_died    = STORE.year;
      h.death_reason = result;
    }

    this._persistHorses(key);
    Toast.show(
      result === 'healthy' ? `${h.name} survives the winter.` :
      result === 'ruined'  ? `${h.name} is ruined — no longer serviceable.` :
                             `${h.name} has died.`,
      result === 'healthy' ? 'success' : 'error'
    );
    Modal.close();
    this.render();
  },

  _killHorse(key, horseId, reason) {
    const cacheKey = this._stablesCacheKey(key);
    const horses   = this._horsesCache[cacheKey] || [];
    const h        = horses.find(x => x.id === horseId);
    if (!h) return;
    const label = reason === 'ruined' ? 'ruined' : 'dead';
    if (!confirm(`Mark ${h.name} as ${label}?`)) return;
    h.alive        = false;
    h.year_died    = STORE.year;
    h.death_reason = reason;
    this._persistHorses(key);
    Toast.show(`${h.name} moved to the Pet Cemetery.`, 'error');
    this.render();
  },

  _toggleFavorite(key, horseId) {
    const cacheKey = this._stablesCacheKey(key);
    const horses   = this._horsesCache[cacheKey] || [];
    const h        = horses.find(x => x.id === horseId);
    if (!h) return;
    const dead     = horses.filter(x => x.alive === false);
    const favCount = dead.filter(x => x.favorite).length;
    if (!h.favorite && favCount >= 10) return; // at cap, button should be disabled but guard anyway
    h.favorite = !h.favorite;
    this._persistHorses(key);
    this.render();
  },
};
