/* ══════════════════════════════════════════════════════════════
   TAB: FAMILIES
   Household roster + holdings + family tree launcher
══════════════════════════════════════════════════════════════ */

const TabFamilies = {
  _current: '',

  render() {
    const panel = document.getElementById('tab-families');
    if (!panel) return;

    if (!this._current && STORE.households.length) {
      this._current = STORE.households[0].name;
    }

    const navHtml = STORE.households.map(h => {
      const count = STORE.householdMembers(h.name).length;
      return `<button class="family-nav-btn${this._current===h.name?' active':''}" onclick="TabFamilies.selectHousehold('${h.name}')">
        <span class="fam-icon">${h.icon}</span>
        <span class="fam-name">${h.name}</span>
        <span class="fam-count">${count}</span>
      </button>`;
    }).join('');

    panel.innerHTML = `
      <div class="families-layout">
        <div class="family-nav">${navHtml}</div>
        <div class="family-body" id="familyBody"></div>
      </div>`;

    // If the tree was open when this refresh was triggered, restore it
    // (e.g. after adding a relationship from an NPC card modal)
    if (TabTree.currentHousehold()) {
      TabTree.open(TabTree.currentHousehold());
    } else if (this._current) {
      this._renderHousehold();
    }
  },

  selectHousehold(name) {
    this._current = name;
    document.querySelectorAll('.family-nav-btn').forEach(el => el.classList.remove('active'));
    document.querySelector(`.family-nav-btn[onclick*="'${name}'"]`)?.classList.add('active');
    this._renderHousehold();
  },

  _renderHousehold() {
    const body = document.getElementById('familyBody');
    if (!body) return;
    const name = this._current;
    const hh = STORE.getHousehold(name);
    if (!hh) return;

    const members = STORE.householdMembers(name).sort((a,b) => {
      // Sort: PK first, then by role, then name
      const pkA = (a.role||'').toLowerCase().includes('player') ? 0 : 1;
      const pkB = (b.role||'').toLowerCase().includes('player') ? 0 : 1;
      return pkA - pkB || a.name.localeCompare(b.name);
    });

    // Group members by role category
    const roleGroups = {
      'Knights & Ladies': [],
      'Squires & Pages':  [],
      'Stewards':         [],
      'Clergy & Druids':  [],
      'Children':         [],
      'Other':            [],
    };
    members.forEach(n => {
      const r = (n.role || '').toLowerCase();
      const nAge = n.year_born != null ? (STORE.year - n.year_born) : (n.age ?? null);
      if (r.includes('knight') || r.includes('baron') || r.includes('lady') || r.includes('dame') || r.includes('estate'))
        roleGroups['Knights & Ladies'].push(n);
      else if (r.includes('squire') || r.includes('page'))
        roleGroups['Squires & Pages'].push(n);
      else if (r.includes('steward'))
        roleGroups['Stewards'].push(n);
      else if (r.includes('priest') || r.includes('druid'))
        roleGroups['Clergy & Druids'].push(n);
      else if (r.includes('baby') || r.includes('infant') || (nAge != null && nAge < 12))
        roleGroups['Children'].push(n);
      else
        roleGroups['Other'].push(n);
    });

    const memberHtml = Object.entries(roleGroups).filter(([,arr]) => arr.length).map(([grp, arr]) => `
      <div class="section-title">${grp}</div>
      <div class="family-member-list mb-12">
        ${arr.map(n => {
          const col = roleColour(n.role);
          const age = n.year_born != null ? (STORE.year - n.year_born) : (n.age ?? null);
          return `<div class="family-member-item" data-npc-hover="${n.id}" role="button" tabindex="0" onclick="Components.openNpcCard('${n.id}')">
            <span class="family-member-role" style="background:${col};">${n.role||'?'}</span>
            <span class="family-member-name">${esc(n.name)}</span>
            ${age != null ? `<span class="family-member-age">Age ${age}</span>` : ''}
            ${n.glory ? `<span class="family-member-age" style="color:var(--gold);">${n.glory.toLocaleString()} gl.</span>` : ''}
          </div>`;
        }).join('')}
      </div>`).join('');

    // Linked manor
    const manor = STORE.getManor(name);
    const manorHtml = manor ? `
      <div class="card mb-12" style="border-top:3px solid ${hh.colour};">
        <div class="section-title">Manor Holdings</div>
        <div class="pk-stat"><span class="pk-stat-label">Knight</span><span class="pk-stat-value">${esc(manor.knight||'—')}</span></div>
        <div class="pk-stat"><span class="pk-stat-label">Base Harvest</span><span class="pk-stat-value">${manor.baseHarvest} L</span></div>
        <div class="pk-stat"><span class="pk-stat-label">Treasury</span><span class="pk-stat-value">${STORE.manorTreasury(name)} L</span></div>
        <div class="pk-stat"><span class="pk-stat-label">Improvements</span><span class="pk-stat-value">${(manor.improvements||[]).filter(i=>i.status==='active').length}</span></div>
        <div class="pk-stat"><span class="pk-stat-label">Hatred / Care</span><span class="pk-stat-value">${manor.hatred} / ${manor.care}</span></div>
        <button class="btn btn-ghost mt-8" style="width:100%;font-size:0.55rem;" onclick="APP.switchTab('manors');TabManors.selectManor('${name}')">Open Manor Ledger →</button>
      </div>` : '';

    // Relationships summary for tree preview
    const allIds = members.map(n => n.id);
    const rels = STORE.relationships.filter(r => allIds.includes(r.sourceId) || allIds.includes(r.targetId));
    const relSummary = rels.length
      ? `<div class="pk-stat"><span class="pk-stat-label">Recorded Relationships</span><span class="pk-stat-value">${rels.length}</span></div>`
      : '<div style="font-size:0.85rem;font-style:italic;color:var(--ink-soft);opacity:0.7;">No relationships recorded yet.</div>';

    body.innerHTML = `
      <div class="family-header-banner" style="background:linear-gradient(135deg,${hh.colour}cc,${hh.colour}88);border-color:${hh.colour}44;">
        <div class="family-banner-icon">${hh.icon}</div>
        <div>
          <div class="family-banner-name">House ${name}</div>
          <div class="family-banner-tagline">${members.length} member${members.length!==1?'s':''} · ${esc(name)} Household${hh.household_head ? ` · ⚜ ${esc(STORE.getNpc(hh.household_head)?.name || '')}` : ''}</div>
        </div>
        <button class="tree-btn" style="margin-left:auto;" onclick="TabTree.open('${name}')">
          🌳 Family Tree
        </button>
      </div>

      <div class="family-sections">
        <div>
          ${manorHtml}
          <div class="card">
            <div class="section-title">Family Tree</div>
            ${relSummary}
            <button class="tree-btn mt-8" onclick="TabTree.open('${name}')">Open Family Tree</button>
          </div>
        </div>
        <div>
          ${memberHtml}
        </div>
      </div>`;
  },
};
