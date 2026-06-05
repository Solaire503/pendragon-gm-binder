/* ══════════════════════════════════════════════════════════════
   TAB: ROSTER
   NPC list — flat sorted list, filter by household, sort picker
══════════════════════════════════════════════════════════════ */

const RANK_ORDER = {
  'King':             1,
  'Warlord':          2,
  'Player Knight':    3,
  'Baron':            4,
  'Estate Holder':    5,
  'Knight Banneret':  6,
  'Vassal Knight':    7,
  'Bachelor Knight':  8,
  'Mercenary Knight': 9,
  'Knight':          10,
  'Lady':            11,
  'Esquire':         12,
  'Squire':          13,
  'Page':            14,
  'Steward':         15,
  'Priest':          16,
  'Druid':           17,
  'Merchant':        18,
  'Baby':            19,
  'Infant':          20,
};

function rankOf(role) {
  if (!role) return 99;
  for (const [k, v] of Object.entries(RANK_ORDER)) {
    if (role.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return 50;
}

const TabRoster = {
  _search:     '',
  _hh:         '',
  _sort:       'az',   // 'az' | 'rank' | 'class'
  _selectedId: null,

  render() {
    const panel = document.getElementById('tab-roster');
    if (!panel) return;

    // If skeleton already exists just refresh content, don't rebuild
    if (document.getElementById('rosterList')) {
      this._refreshControls();
      this._renderList();
      if (this._selectedId) this._renderDetail(this._selectedId);
      return;
    }

    const sortBtns = [
      { key: 'az',    label: 'A – Z' },
      { key: 'rank',  label: 'Rank' },
      { key: 'class', label: 'Class' },
      { key: 'age',   label: 'Age' },
    ].map(s =>
      `<button class="filter-chip${this._sort===s.key?' active':''}" onclick="TabRoster.setSort('${s.key}')">${s.label}</button>`
    ).join('');

    const hhChips = STORE.households.map(h =>
      `<button class="filter-chip${this._hh===h.name?' active':''}" data-hh="${esc(h.name)}" onclick="TabRoster.setHH('${esc(h.name)}')">${h.icon} ${esc(h.name)}</button>`
    ).join('');

    panel.innerHTML = `
      <div class="two-pane">
        <div class="pane-sidebar">
          <div class="search-bar-wrap">
            <div class="search-input-wrap">
              <input class="search-input" id="rosterSearch" placeholder="Search by name, role, manor…" value="${this._search}">
              <button class="search-clear" id="rosterSearchClear" title="Clear search" style="${this._search ? '' : 'display:none;'}">✕</button>
            </div>
          </div>
          <div class="filter-row" id="rosterSortRow">
            <span style="font-family:var(--font-heading);font-size:0.5rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--ink-soft);opacity:0.5;align-self:center;margin-right:2px;">Sort</span>
            ${sortBtns}
          </div>
          <div class="filter-row" id="rosterHHRow" style="padding-top:4px;">
            <span style="font-family:var(--font-heading);font-size:0.5rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--ink-soft);opacity:0.5;align-self:center;margin-right:2px;">House</span>
            <button class="filter-chip${!this._hh?' active':''}" onclick="TabRoster.setHH('')">All</button>
            ${hhChips}
          </div>
          <div class="npc-list" id="rosterList"></div>
          <div style="padding:8px 10px;border-top:1px solid var(--vellum-deep);flex-shrink:0;display:flex;flex-direction:column;gap:6px;">
            ${isGM() ? `
            <button class="btn btn-primary" style="width:100%;" onclick="Components.openAddNpc()">+ Add NPC</button>
            <button class="btn btn-ghost" style="width:100%;font-size:0.68rem;" onclick="Components.openImportNpc()" title="Import a single NPC from a Claude.ai-generated JSON">⬇ Import from Claude.ai</button>
            ` : ''}
            <div id="rosterOosFooter" style="font-family:var(--font-heading);font-size:0.58rem;letter-spacing:0.08em;text-align:center;color:#8a7a5a;opacity:0.8;cursor:pointer;padding:2px 0;" role="button" tabindex="0" onclick="APP.switchTab('mausoleum')" title="View in Mausoleum → Out of Story tab"></div>
          </div>
        </div>
        <div class="pane-content" id="rosterDetail">
          <div class="empty-state">
            <div class="empty-state-icon">📜</div>
            <div class="empty-state-text">Select a person from the roster</div>
          </div>
        </div>
      </div>`;

    const searchInput = document.getElementById('rosterSearch');
    const searchClear = document.getElementById('rosterSearchClear');
    searchInput.addEventListener('input', e => {
      this._search = e.target.value;
      searchClear.style.display = this._search ? '' : 'none';
      this._renderList();
    });
    searchClear.addEventListener('click', () => {
      this._search = '';
      searchInput.value = '';
      searchClear.style.display = 'none';
      searchInput.focus();
      this._renderList();
    });

    this._renderList();
    if (this._selectedId) this._renderDetail(this._selectedId);
  },

  // Update sort/filter button active states without rebuilding skeleton
  _refreshControls() {
    document.querySelectorAll('#rosterSortRow .filter-chip').forEach(btn => {
      const key = btn.getAttribute('onclick')?.match(/'(\w+)'/)?.[1];
      btn.classList.toggle('active', key === this._sort);
    });
    document.querySelectorAll('#rosterHHRow .filter-chip').forEach(btn => {
      const hh = btn.dataset.hh ?? '';
      btn.classList.toggle('active', hh === this._hh);
    });
  },

  _filtered() {
    const q = this._search.toLowerCase().trim();
    let npcs = STORE.living.filter(n => {
      if (n.out_of_story) return false;
      if (this._hh && n.household !== this._hh) return false;
      if (q && ![n.name, n.role, n.manor, n.notes].some(f => f && f.toLowerCase().includes(q))) return false;
      return true;
    });

    if (this._sort === 'az') {
      npcs.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this._sort === 'rank') {
      npcs.sort((a, b) => rankOf(a.role) - rankOf(b.role) || a.name.localeCompare(b.name));
    } else if (this._sort === 'class') {
      npcs.sort((a, b) => (a.role||'').localeCompare(b.role||'') || a.name.localeCompare(b.name));
    } else if (this._sort === 'age') {
      // Oldest first; NPCs with no birth year go to the bottom
      npcs.sort((a, b) => {
        if (!a.year_born && !b.year_born) return a.name.localeCompare(b.name);
        if (!a.year_born) return 1;
        if (!b.year_born) return -1;
        return a.year_born - b.year_born;
      });
    }
    return npcs;
  },

  _renderList() {
    const list = document.getElementById('rosterList');
    if (!list) return;
    const npcs = this._filtered();

    // Update OoS footer count
    const oosFooter = document.getElementById('rosterOosFooter');
    if (oosFooter) {
      const oosCount = STORE.living.filter(n => n.out_of_story).length;
      oosFooter.textContent = oosCount ? `🌫 ${oosCount} out of story` : '';
      oosFooter.style.display = oosCount ? '' : 'none';
    }

    if (!npcs.length) {
      list.innerHTML = '<div class="empty-state" style="padding:30px 10px;"><div class="empty-state-icon">🔍</div><div class="empty-state-text">No matches</div></div>';
      return;
    }

    if (this._sort === 'class') {
      // Group by role when sorting by class
      const groups = {};
      npcs.forEach(n => {
        const g = n.role || '—';
        if (!groups[g]) groups[g] = [];
        groups[g].push(n);
      });
      list.innerHTML = Object.entries(groups).map(([role, members]) => `
        <div class="npc-group-header">${esc(role)} (${members.length})</div>
        ${members.map(n => this._itemHtml(n)).join('')}
      `).join('');
    } else {
      list.innerHTML = npcs.map(n => this._itemHtml(n)).join('');
    }
  },

  _itemHtml(n) {
    const blessedBadge = n.blessed      ? '<span class="blessed-pip" title="Blessed Birth">✦</span>' : '';
    const fateBadge    = n.fate_touched ? '<span class="fate-pip"    title="Fate-Touched">◈</span>'  : '';

    // ── Age flag ──────────────────────────────────────────
    const flag    = this._ageFlag(n);
    const flagAge = n.year_born ? STORE.year - n.year_born : '';
    const flagHtml = flag === 'page'
      ? `<span class="roster-age-flag roster-age-flag-page"     title="Age ${flagAge}">⚑ Needs Page Placement</span>`
      : flag === 'training'
      ? `<span class="roster-age-flag roster-age-flag-training" title="Age ${flagAge}">⚑ Needs Training</span>`
      : flag === 'adult'
      ? `<span class="roster-age-flag roster-age-flag-adult"    title="Age ${flagAge}">⚑ Came of Age?</span>`
      : '';

    // ── Training relationship line ─────────────────────────
    const trainingHtml = this._trainingLine(n);

    const subLine = (flagHtml || trainingHtml)
      ? `<div class="npc-item-subline">${flagHtml}${trainingHtml}</div>`
      : '';

    const ageDisplay = (() => {
      if (!n.year_born) return '';
      if (n.status === 'Dead' && n.year_died) {
        const ageAtDeath = n.year_died - n.year_born;
        return `<span class="npc-item-age" style="opacity:0.55;">†${ageAtDeath}</span>`;
      }
      const age = STORE.year - n.year_born;
      return `<span class="npc-item-age">${age}</span>`;
    })();

    const rtStyle = n.round_table
      ? 'color:var(--gold-text);text-shadow:0 0 8px rgba(184,134,11,0.5);'
      : '';
    const rtBadge = n.round_table
      ? '<span title="Knight of the Round Table" style="font-size:0.65rem;color:var(--gold-text);">⊕</span>'
      : '';

    return `<div class="npc-list-item${this._selectedId===n.id?' selected':''}${n.round_table?' round-table-item':''}" data-npc-id="${n.id}" role="button" tabindex="0" onclick="TabRoster.select('${n.id}')">
      <span class="hh-pip" style="${hhPipStyle(n.household)}"></span>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
          <span class="npc-item-name" style="${rtStyle}">${esc(n.name)}${blessedBadge}${fateBadge}${rtBadge}</span>
          <span class="npc-item-role">${esc(n.role||'')}</span>
          ${ageDisplay}
          ${n.glory ? `<span class="npc-item-glory">${n.glory.toLocaleString()}</span>` : ''}
        </div>
        ${subLine}
      </div>
    </div>`;
  },

  // ── AGE FLAG ──────────────────────────────────────────────
  _ageFlag(npc) {
    if (!npc.year_born || npc.came_of_age) return null;
    const age  = STORE.year - npc.year_born;
    const role = (npc.role || '').toLowerCase();
    const unplacedRoles = ['baby', 'infant', ''];
    if (age >= 7  && age < 14 && unplacedRoles.includes(role) && !npc.page_placed) return 'page';
    if (age >= 14 && role === 'page')                                        return 'training';
    if (age >= 21 && role === 'squire')                                      return 'adult';
    if (age >= 18 && ['steward','priest','druid'].includes(role))            return 'adult';
    return null;
  },

  // ── TRAINING LINE ─────────────────────────────────────────
  // Convention: Squire/Page relationship — source = senior (knight/court),
  //             target = junior (squire/page)
  _trainingLine(npc) {
    const roleLower = (npc.role || '').toLowerCase();
    if (npc.came_of_age || !['squire','page',''].includes(roleLower)) return '';
    const rels = STORE.getRelationships(npc.id)
      .filter(r => r.type === 'Squire' || r.type === 'Page');
    if (!rels.length) {
      // Fall back to free-text training_where field
      if (npc.training_where) {
        const role  = (npc.role || '').toLowerCase();
        const label = role === 'squire' ? 'Squire under' : role === 'page' ? 'Page at' : 'Training';
        return `<span class="training-line">${label}: <strong>${esc(npc.training_where)}</strong></span>`;
      }
      return '';
    }
    // Show first match (most cases there's only one)
    const r       = rels[0];
    const isJunior = r.targetId === npc.id;
    const otherId  = isJunior ? r.sourceId : r.targetId;
    const other    = STORE.getNpc(otherId);
    const label    = isJunior
      ? (r.type === 'Squire' ? 'Squire under' : 'Page at')
      : (r.type === 'Squire' ? 'Squire' : 'Page');
    const name     = other ? other.name : (r.notes || '—');
    const clickAttr = other
      ? `data-npc-hover="${other.id}" role="button" tabindex="0" onclick="event.stopPropagation();Components.openNpcCard('${other.id}')" style="cursor:pointer;"`
      : '';
    return `<span class="training-line" ${clickAttr}>${label}: <strong>${esc(name)}</strong></span>`;
  },

  _renderDetail(id) {
    const detail = document.getElementById('rosterDetail');
    if (!detail) return;
    const npc = STORE.getNpc(id);
    if (!npc) {
      detail.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📜</div><div class="empty-state-text">NPC not found</div></div>';
      return;
    }
    detail.innerHTML = buildNpcCardHtml(npc, { inline: true });
  },

  select(id) {
    this._selectedId = id;
    document.querySelectorAll('#rosterList .npc-list-item').forEach(el => el.classList.remove('selected'));
    document.querySelector(`#rosterList .npc-list-item[data-npc-id="${id}"]`)?.classList.add('selected');
    // On mobile the detail pane is hidden — open a modal instead
    if (window.innerWidth <= 640) {
      Components.openNpcCard(id);
    } else {
      this._renderDetail(id);
    }
  },

  deselect() {
    this._selectedId = null;
    document.querySelectorAll('#rosterList .npc-list-item').forEach(el => el.classList.remove('selected'));
    const detail = document.getElementById('rosterDetail');
    if (detail) detail.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📜</div><div class="empty-state-text">Select an NPC to view details</div></div>';
  },

  setHH(name) {
    this._hh = this._hh === name ? '' : name;
    this._selectedId = null;
    this.render();
  },

  setSort(key) {
    this._sort = key;
    this._renderList();
    // Re-highlight selected
    if (this._selectedId) {
      document.querySelector(`#rosterList .npc-list-item[data-npc-id="${this._selectedId}"]`)?.classList.add('selected');
    }
  },

};
