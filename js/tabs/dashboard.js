/* ══════════════════════════════════════════════════════════════
   TAB: DASHBOARD
   Overview of current year, PK manor summaries, recent events
══════════════════════════════════════════════════════════════ */

const TabDashboard = {
  render() {
    const panel = document.getElementById('tab-dashboard');
    if (!panel) return;

    const user = window.__USER__;
    if (user && user.role === 'player') {
      this._renderPlayerDashboard(panel, user);
      return;
    }

    const year = STORE.year;
    const manorKeys = STORE.manorKeys();

    // PK cards
    const pkCardsHtml = manorKeys.map(key => {
      const m = STORE.getManor(key);
      if (!m) return '';
      const hh = STORE.getHousehold(key);
      const col = hh ? hh.colour : '#5a5040';
      const treasury = STORE.manorTreasury(key);
      const last = m.history && m.history.length
        ? [...m.history].sort((a, b) => (b.year || 0) - (a.year || 0))[0]
        : null;
      const harvest = last ? last.harvestOutcome || last.harvestResult || '—' : '—';
      const conflict = last ? last.conflict || '—' : '—';
      const fate = last ? (last.fateResult || '—') : '—';
      const improvements = (m.improvements || []).filter(i => i.status === 'active').length;
      const damage = (m.propertyDamage || []).filter(d => d.status === 'damaged').length;

      return `<div class="pk-card" style="border-top-color:${col};" role="button" tabindex="0" onclick="APP.switchTab('manors');TabManors.selectManor('${esc(key)}')">
        <div class="pk-card-name">${esc(m.knight || key)}</div>
        <div class="pk-card-player" style="color:${col}aa">${hh ? hh.icon : '◆'} ${m.player ? 'Player: ' + esc(m.player) : esc(key)}</div>
        <div class="pk-stat"><span class="pk-stat-label">Treasury</span><span class="pk-stat-value">${treasury} L</span></div>
        <div class="pk-stat"><span class="pk-stat-label">Harvest ${last ? last.year : year}</span><span class="pk-stat-value">${esc(harvest)}</span></div>
        <div class="pk-stat"><span class="pk-stat-label">Conflict ${last ? last.year : year}</span><span class="pk-stat-value">${esc(conflict)}</span></div>
        <div class="pk-stat"><span class="pk-stat-label">Fate</span><span class="pk-stat-value">${esc(fate)}</span></div>
        <div class="pk-stat"><span class="pk-stat-label">Improvements</span><span class="pk-stat-value">${improvements}</span></div>
        ${damage ? `<div class="pk-stat"><span class="pk-stat-label" style="color:var(--crimson-mid)">⚠ Damage</span><span class="pk-stat-value" style="color:var(--crimson-mid)">${damage} item${damage!==1?'s':''}</span></div>` : ''}
      </div>`;
    }).join('');

    // Pending age transitions — scan all living NPCs
    const ageFlags     = [];
    const marriageFlags = [];
    STORE.living.forEach(n => {
      const age = n.year_born ? year - n.year_born : null;
      const hh  = n.household ? ` <span style="opacity:0.55;">(${esc(n.household)})</span>` : '';

      // Age transitions
      if (age !== null) {
        if ((n.role === 'Baby' || n.role === 'Child') && age >= 7 && !n.page_placed)
          ageFlags.push({ n, label: `${esc(n.name)}${hh} — age ${age}, ready for page training` });
        if (n.role === 'Page' && age >= 15)
          ageFlags.push({ n, label: `${esc(n.name)}${hh} — age ${age}, ready to become a Squire` });
        if (n.role === 'Squire' && age >= 21)
          ageFlags.push({ n, label: `${esc(n.name)}${hh} — age ${age}, ready to be Knighted` });
      }

      // Marriage eligibility: Steward role, 18+, sibling or child of household PK, no spouse yet
      if (n.role === 'Steward' && age !== null && age >= 18 && n.household) {
        const manorKey = STORE.manorKeys().find(k => k.toLowerCase() === (n.household||'').toLowerCase());
        const manor    = manorKey ? STORE.getManor(manorKey) : null;
        const pkNpc    = manor?.lord_id ? STORE.getNpc(manor.lord_id)
                       : STORE.living.find(m => (m.household||'').toLowerCase() === (n.household||'').toLowerCase()
                                             && m.role === 'Player Knight');
        if (pkNpc && pkNpc.id !== n.id) {
          const isFam = STORE.getRelationships(n.id).some(r => {
            const involvesPK = r.sourceId === pkNpc.id || r.targetId === pkNpc.id;
            if (!involvesPK) return false;
            if (r.type === 'Sibling' || r.type === 'Half-Sibling') return true;
            if ((r.type === 'Child' || r.type === 'Adopted Child' || r.type === 'Bastard') &&
                 r.sourceId === n.id && r.targetId === pkNpc.id) return true;
            if (r.type === 'Parent' && r.sourceId === pkNpc.id && r.targetId === n.id) return true;
            return false;
          });
          const nRels     = STORE.getRelationships(n.id);
          const hasSpouse = nRels.some(r => r.type === 'Spouse');
          const betRel    = !hasSpouse ? nRels.find(r => r.type === 'Betrothed') : null;
          if (isFam && !hasSpouse) {
            if (!betRel) {
              marriageFlags.push({ n, label: `${esc(n.name)}${hh} — eligible for marriage` });
            } else {
              const betId  = betRel.sourceId === n.id ? betRel.targetId : betRel.sourceId;
              const bet    = STORE.getNpc(betId);
              const betAge = bet?.year_born ? year - bet.year_born : null;
              if (betAge !== null && betAge >= 18)
                marriageFlags.push({ n, label: `${esc(n.name)}${hh} & ${esc(bet.name)} — betrothed, both of age, ready to wed` });
            }
          }
        }
      }
    });

    // Living / dead counts
    const living = STORE.living.length;
    const dead   = STORE.dead.length;
    const byRole = {};
    STORE.living.forEach(n => { byRole[n.role] = (byRole[n.role] || 0) + 1; });
    const topRoles = Object.entries(byRole).sort((a,b) => b[1]-a[1]).slice(0, 8);

    // Succession needed — households whose head is dead or deleted
    const successionFlags = STORE.households.filter(h => {
      if (!h.household_head) return false;
      const head = STORE.getNpc(h.household_head);
      return !head || head.status === 'Dead';
    }).map(h => {
      const head = STORE.getNpc(h.household_head);
      return { household: h, headName: head ? head.name : '(deleted NPC)', isDead: !!head };
    });

    // Recent deaths (last 2 years)
    const recentDead = STORE.dead.filter(n => n.year_died && n.year_died >= year - 2).sort((a,b) => b.year_died - a.year_died);

    // Households at a glance
    const hhHtml = STORE.households.map(h => {
      const members = STORE.householdMembers(h.name);
      return `<div class="pk-stat" style="cursor:pointer;" role="button" tabindex="0" onclick="APP.switchTab('families');TabFamilies.selectHousehold('${esc(h.name)}')">
        <span class="pk-stat-label"><span style="color:${h.colour}">${h.icon}</span> ${esc(h.name)}</span>
        <span class="pk-stat-value" style="color:${h.colour}">${members.length}</span>
      </div>`;
    }).join('');

    panel.innerHTML = `
      <div class="dashboard-layout">

        <div class="dashboard-full">
          <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:20px;">
            <div class="page-title">Anno Domini ${year}</div>
            <div class="page-subtitle" style="margin:0;">Britannia · Pendragon 6e</div>
          </div>
          <div class="pk-cards">${pkCardsHtml}</div>
        </div>

        <div class="card">
          <div class="section-title">Roster at a Glance</div>
          <div class="pk-stat"><span class="pk-stat-label">Living NPCs</span><span class="pk-stat-value">${living}</span></div>
          <div class="pk-stat"><span class="pk-stat-label">In the Mausoleum</span><span class="pk-stat-value">${dead}</span></div>
          <div style="margin-top:12px;border-top:1px dotted var(--vellum-deep);padding-top:10px;">
            ${topRoles.map(([r, c]) => `<div class="pk-stat"><span class="pk-stat-label">${esc(r||'(no role)')}</span><span class="pk-stat-value">${c}</span></div>`).join('')}
          </div>
        </div>

        ${typeof TasksManager !== 'undefined' ? TasksManager.buildDashboardWidget() : ''}

        <div class="card">
          <div class="section-title">Households</div>
          ${hhHtml}
        </div>

        ${recentDead.length ? `
        <div class="card">
          <div class="section-title">Recent Deaths</div>
          ${recentDead.slice(0,8).map(n => `
            <div class="pk-stat" style="cursor:pointer;" data-npc-hover="${n.id}" role="button" tabindex="0" onclick="Components.openNpcCard('${n.id}')">
              <span class="pk-stat-label">† ${esc(n.name)}</span>
              <span class="pk-stat-value" style="color:var(--crimson-mid)">${n.year_died} AD</span>
            </div>`).join('')}
        </div>` : ''}

        ${successionFlags.length ? `
        <div class="card" style="border-top:3px solid var(--crimson-mid);">
          <div class="section-title" style="margin-bottom:12px;color:var(--crimson-mid);">⚜ Succession Needed</div>
          ${successionFlags.map(({ household: h, headName, isDead }) => `
            <div class="pk-stat" style="cursor:pointer;" role="button" tabindex="0" onclick="APP.switchTab('families');TabFamilies.selectHousehold('${esc(h.name)}')">
              <span class="pk-stat-label" style="font-size:0.78rem;"><span style="color:${h.colour}">${h.icon}</span> ${esc(h.name)} — ${isDead ? '† ' + esc(headName) + ' has fallen' : 'Head of House missing'}</span>
              <span class="pk-stat-value" style="font-size:0.6rem;opacity:0.6;">choose heir →</span>
            </div>`).join('')}
        </div>` : ''}

        ${ageFlags.length ? `
        <div class="card" style="border-top:3px solid var(--gold);">
          <div class="section-title" style="margin-bottom:12px;">⏳ Pending Age Transitions</div>
          ${ageFlags.map(({ n, label }) => `
            <div class="pk-stat" style="cursor:pointer;" role="button" tabindex="0" onclick="Components.openNpcCard('${n.id}')">
              <span class="pk-stat-label" style="font-size:0.78rem;">${label}</span>
              <span class="pk-stat-value" style="font-size:0.6rem;opacity:0.6;">open →</span>
            </div>`).join('')}
        </div>` : ''}

        ${marriageFlags.length ? `
        <div class="card" style="border-top:3px solid #7a4a7a;">
          <div class="section-title" style="margin-bottom:12px;">💍 Eligible for Marriage</div>
          ${marriageFlags.map(({ n, label }) => `
            <div class="pk-stat" style="cursor:pointer;" role="button" tabindex="0" onclick="Components.openNpcCard('${n.id}')">
              <span class="pk-stat-label" style="font-size:0.78rem;">${label}</span>
              <span class="pk-stat-value" style="font-size:0.6rem;opacity:0.6;">open →</span>
            </div>`).join('')}
        </div>` : ''}

        ${typeof TabNpcManors !== 'undefined' && TabNpcManors.getVacantCount() ? `
        <div class="card" style="border-top:3px solid var(--crimson-mid);">
          <div class="section-title" style="margin-bottom:12px;color:var(--crimson-mid);">🏛 Vacant NPC Manors</div>
          ${TabNpcManors.getVacantManors().map(m => {
            const holder = m.holderId ? STORE.getNpc(m.holderId) : null;
            const reason = holder && holder.status === 'Dead'
              ? `† ${esc(holder.name)} has fallen`
              : 'No holder assigned';
            return `<div class="pk-stat" style="cursor:pointer;" role="button" tabindex="0" onclick="APP.switchTab('npc-manors')">
              <span class="pk-stat-label" style="font-size:0.78rem;">${esc(m.name)}${m.location ? ` <span style="opacity:0.55;">(${esc(m.location)})</span>` : ''} — ${reason}</span>
              <span class="pk-stat-value" style="font-size:0.6rem;opacity:0.6;">assign →</span>
            </div>`;
          }).join('')}
        </div>` : ''}

        ${this._buildPoiWidget(year)}

        <div class="card">
          <div class="section-title">Quick Actions</div>
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
            ${isGM() ? `<button class="btn btn-primary" onclick="Components.openAddNpc()">+ New NPC</button>` : ''}
            <button class="btn btn-verdigris" onclick="APP.switchTab('roster')">Open Roster</button>
            <button class="btn btn-ghost" onclick="APP.switchTab('manors')">Open Manors</button>
            ${isGM() ? `<button class="btn btn-ghost" onclick="APP.switchTab('families')">Open Families</button>` : ''}
          </div>
        </div>

        ${typeof Multiplayer !== 'undefined' ? Multiplayer.gmBroadcastHtml() : ''}

      </div>`;
  },

  // ── PERSONS OF INTEREST WIDGET ────────────────────────────
  _buildPoiWidget(year) {
    if (typeof PinsManager === 'undefined') return '';
    const pins = PinsManager._pins;
    if (pins === null) {
      // Not loaded yet — trigger load and re-render when ready
      PinsManager.load().then(() => TabDashboard.render());
      return '';
    }
    if (pins.length === 0) return '';

    const pinnedNpcs = pins.map(id => STORE.getNpc(id)).filter(Boolean);
    if (pinnedNpcs.length === 0) return '';

    const rows = pinnedNpcs.map(n => {
      const col = n.household ? hhColour(n.household) : roleColour(n.role);
      const age = n.year_born ? year - n.year_born : null;
      const dead = n.status === 'Dead';
      return `<div class="pk-stat" style="cursor:pointer;" role="button" tabindex="0" onclick="Components.openNpcCardPopup('${n.id}')">
        <span class="pk-stat-label" style="color:${col};${dead ? 'opacity:0.55;' : ''}">${dead ? '† ' : ''}${esc(n.name)}</span>
        <span class="pk-stat-value" style="font-size:0.6rem;opacity:0.7;">${esc(n.role||'—')}${age !== null ? ' · ' + age : ''}</span>
      </div>`;
    }).join('');

    return `<div class="card" style="border-top:3px solid var(--gold);">
      <div class="section-title" style="margin-bottom:12px;">★ Persons of Interest</div>
      ${rows}
    </div>`;
  },

  // ── PLAYER DASHBOARD STATE ─────────────────────────────────
  _rosterExpanded:  false,
  _rosterSort:      'rank',
  _damageExpanded:  false,
  _successionData:  null,

  toggleRoster()  { this._rosterExpanded = !this._rosterExpanded; this.render(); },
  toggleDamage()  { this._damageExpanded = !this._damageExpanded; this.render(); },
  setRosterSort(s){ this._rosterSort = s; this.render(); },

  // ── PLAYER DASHBOARD ───────────────────────────────────────
  _renderPlayerDashboard(panel, user) {
    const year      = STORE.year;
    const household = user.household || '';

    // Guard: if the binder hasn't been loaded yet or the account has no
    // household assigned, show an accurate holding message. These are two
    // different problems with different fixes — don't conflate them.
    if (!STORE.year) {
      panel.innerHTML = `<div style="padding:40px 24px;text-align:center;color:var(--ink-soft);font-family:'EB Garamond',serif;font-style:italic;">
        The binder is not yet loaded. Waiting for the GM to configure a save file.
      </div>`;
      return;
    }
    if (!household) {
      panel.innerHTML = `<div style="padding:40px 24px;text-align:center;color:var(--ink-soft);font-family:'EB Garamond',serif;font-style:italic;">
        Your account is not yet linked to a household. Ask the GM to assign one to your player profile.
      </div>`;
      return;
    }

    // Find the player's manor
    const manorKey = STORE.manorKeys().find(k => k.toLowerCase() === household.toLowerCase());
    const manor    = manorKey ? STORE.getManor(manorKey) : null;
    const hh       = STORE.getHousehold(household);
    const col      = hh ? hh.colour : '#8a6535';
    const icon     = hh ? hh.icon   : '⚜';
    const members  = STORE.householdMembers(household);

    // Player knight name
    const lordNpc   = manor?.lord_id ? STORE.getNpc(manor.lord_id) : null;
    const knightName = lordNpc?.name || manor?.knight || household;
    // Derive Sir/Dame from pronoun first, fall back to role name check
    const pkForTitle = members.find(n => n.role === 'Player Knight') || lordNpc;
    const pkPronoun  = (pkForTitle?.pronoun || '').toLowerCase();
    const title      = pkPronoun.startsWith('she') ? 'Dame'
                     : pkPronoun.startsWith('they') ? ''
                     : (lordNpc?.role || '').toLowerCase().includes('lady') ? 'Dame' : 'Sir';

    // Cycling greeting (changes daily)
    const GREETINGS = [
      `The realm endures, ${title} ${knightName}. What glory will you seek this day?`,
      `${title} ${knightName} — your banners yet fly over ${household} Manor.`,
      `Another year in Logres. The High King watches, ${title} ${knightName}.`,
      `Honour, glory, and the oath. These are your burdens, ${title} ${knightName}.`,
      `The year ${year} AD. What songs will the bards sing of ${title} ${knightName}?`,
      `${household} stands. Your household endures. Ride forth, ${title} ${knightName}.`,
      `Steel and faith, ${title} ${knightName}. The only constants in Logres.`,
      `The Round Table stirs. Logres has need of ${title} ${knightName}.`,
      `Another winter survived. Another year of glory awaits, ${title} ${knightName}.`,
      `Pen y Gaer remembers its champions. Be worthy of the name ${knightName}.`,
    ];
    const greeting = GREETINGS[Math.floor(Date.now() / 86400000) % GREETINGS.length];

    // Player Knight — find from household members
    const pk         = members.find(n => n.role === 'Player Knight');
    const pronoun    = (pk?.pronoun || 'He/him').toLowerCase();
    const lordTitle  = pronoun.startsWith('she') ? 'My Lady' : pronoun.startsWith('they') ? 'My Liege' : 'My Lord';

    // ── MANOR SNAPSHOT ────────────────────────────────────────
    // Resolve steward using same fallback logic as the manors tab:
    // prefer steward_id link, fall back to "Steward: Name" in manor notes.
    let stewardNpc = null;
    if (manor) {
      stewardNpc = manor.steward_id ? STORE.getNpc(manor.steward_id) : null;
      if (!stewardNpc) {
        const stewardStr = (manor.notes || '').match(/Steward:\s*(.+)/i)?.[1]?.trim() || '';
        if (stewardStr.length > 0)
          stewardNpc = STORE.living.find(n => n.name.toLowerCase().includes(stewardStr.toLowerCase())) || null;
      }
    }

    let manorHtml = '';
    if (manor && manorKey) {
      const treasury    = STORE.manorTreasury(manorKey);
      const last        = manor.history?.length ? [...manor.history].sort((a,b)=>(b.year||0)-(a.year||0))[0] : null;
      const activeImpr  = (manor.improvements||[]).filter(i=>i.status==='active');
      const damaged     = (manor.propertyDamage||[]).filter(d=>d.status==='damaged');

      const damageItemsHtml = this._damageExpanded ? damaged.map(d => {
        const overdue = d.yearRepaired && d.yearRepaired <= STORE.year;
        return `<div style="margin:4px 0 4px 12px;padding:6px 10px;background:${overdue?'rgba(139,30,30,0.08)':'var(--vellum-deep)'};border-radius:var(--radius);border-left:3px solid ${overdue?'var(--crimson-mid)':'rgba(139,30,30,0.3)'};">
          <div style="font-family:var(--font-heading);font-size:0.58rem;color:var(--crimson-mid);">${d.type||'Damage'}${overdue?' · ⚠ REPAIR DUE':''}</div>
          <div style="font-size:0.8rem;color:var(--ink);margin-top:2px;">${d.description||''}</div>
          ${d.repairCost ? `<div style="font-size:0.72rem;color:var(--ink-soft);margin-top:1px;">Repair cost: ${d.repairCost} L${d.yearRepaired?' · Est. '+d.yearRepaired+' AD':''}</div>` : ''}
        </div>`;
      }).join('') : '';

      manorHtml = `
        <div class="card" style="border-top:3px solid ${col};">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <span style="font-size:1.4rem;">${icon}</span>
            <div>
              <div class="section-title" style="margin-bottom:0;">${manorKey} Manor</div>
              <div style="font-family:var(--font-heading);font-size:0.5rem;letter-spacing:0.15em;text-transform:uppercase;color:${col};">Your Demesne</div>
            </div>
          </div>
          <div class="pk-stat"><span class="pk-stat-label">Treasury</span>
            <span class="pk-stat-value" style="color:${treasury>0?'var(--verdigris-mid)':treasury<0?'var(--crimson-mid)':'inherit'}">${treasury} L</span></div>
          <div class="pk-stat"><span class="pk-stat-label">Base Harvest</span><span class="pk-stat-value">${manor.baseHarvest||'?'} L</span></div>
          ${stewardNpc ? `<div class="pk-stat"><span class="pk-stat-label">Steward</span><span class="pk-stat-value">${esc(stewardNpc.name)}</span></div>` : ''}
          ${last ? `
          <div style="margin-top:10px;padding-top:10px;border-top:1px dotted var(--vellum-deep);">
            <div class="pk-stat"><span class="pk-stat-label">Last Harvest (${last.year} AD)</span><span class="pk-stat-value">${harvestBadge(last.harvestOutcome||last.harvestResult)}</span></div>
            <div class="pk-stat"><span class="pk-stat-label">Conflict</span><span class="pk-stat-value">${conflictBadge(last.conflict)}</span></div>
            <div class="pk-stat"><span class="pk-stat-label">Net Income</span><span class="pk-stat-value" style="color:${(last.netIncome||0)>=0?'var(--verdigris-mid)':'var(--crimson-mid)'};">${last.netIncome>=0?'+':''}${last.netIncome||0} L</span></div>
          </div>` : ''}
          ${activeImpr.length ? `<div class="pk-stat" style="margin-top:8px;"><span class="pk-stat-label">Improvements</span><span class="pk-stat-value">${activeImpr.length} active</span></div>` : ''}
          ${damaged.length ? `
            <div class="pk-stat" style="cursor:pointer;" role="button" tabindex="0" onclick="TabDashboard.toggleDamage()">
              <span class="pk-stat-label" style="color:var(--crimson-mid);">⚠ Property Damage</span>
              <span class="pk-stat-value" style="color:var(--crimson-mid);">${damaged.length} item${damaged.length!==1?'s':''} ${this._damageExpanded?'▴':'▾'}</span>
            </div>
            ${damageItemsHtml}` : ''}
          <div style="margin-top:12px;">
            <button class="btn btn-ghost" style="width:100%;" onclick="APP.switchTab('manors')">View Manor →</button>
          </div>
        </div>`;
    }

    // ── ATTENTION ITEMS ───────────────────────────────────────
    const attentionItems = [];
    if (!pk)
      attentionItems.push({ icon:'⚠', text:'No Player Knight is assigned to this household — use ⚔ Change Player Knight to set one', urgent:true });
    if (manor && manorKey) {
      const treasury = STORE.manorTreasury(manorKey);
      const damaged  = (manor.propertyDamage||[]).filter(d=>d.status==='damaged');
      if (treasury < 0)
        attentionItems.push({ icon:'💸', text:`Treasury is in deficit (${treasury} L)`, urgent:true });
      if (!stewardNpc)
        attentionItems.push({ icon:'⚠', text:'No Steward assigned to your manor', urgent:false });
      if (!manor.heir_id)
        attentionItems.push({ icon:'⚠', text:'No Heir designated for your manor', urgent:false });
      damaged.filter(d=>d.yearRepaired && d.yearRepaired <= year).forEach(d =>
        attentionItems.push({ icon:'🔨', text:`Overdue repair: ${esc(d.description||d.type)} (${d.repairCost||0} L)`, urgent:true }));
    }
    // Succession check — is the household head dead or missing?
    if (hh?.household_head) {
      const headNpc = STORE.getNpc(hh.household_head);
      if (!headNpc || headNpc.status === 'Dead')
        attentionItems.push({ icon:'⚜', text:`${headNpc ? '† ' + esc(headNpc.name) + ' has fallen' : 'Head of House is missing'} — a new Head of House must be chosen`, urgent:true });
    }
    // Helper: is npc a sibling or child of the Player Knight?
    const isFamilyOfPK = (npc) => {
      if (!pk) return false;
      return STORE.getRelationships(npc.id).some(r => {
        const involvesPK = r.sourceId === pk.id || r.targetId === pk.id;
        if (!involvesPK) return false;
        if (r.type === 'Sibling' || r.type === 'Half-Sibling') return true;
        // npc is child of PK
        if ((r.type === 'Child' || r.type === 'Adopted Child' || r.type === 'Bastard') &&
             r.sourceId === npc.id && r.targetId === pk.id) return true;
        // PK is parent of npc
        if (r.type === 'Parent' && r.sourceId === pk.id && r.targetId === npc.id) return true;
        return false;
      });
    };

    members.forEach(n => {
      const age = n.year_born ? year - n.year_born : null;
      if ((n.role === 'Baby' || n.role === 'Child') && age !== null && age >= 7 && !n.page_placed)
        attentionItems.push({ icon:'🧒', text:`${esc(n.name)} is ${age} — old enough to begin page training`, urgent:false });
      if (n.role === 'Page'   && age !== null && age >= 15)
        attentionItems.push({ icon:'⚔', text:`${esc(n.name)} is ${age} — old enough to become a Squire`, urgent:false });
      if (n.role === 'Squire' && age !== null && age >= 21)
        attentionItems.push({ icon:'⚔', text:`${esc(n.name)} is ${age} — old enough to be Knighted`, urgent:false });
      if (n.role === 'Steward' && age !== null && age >= 18 && isFamilyOfPK(n)) {
        const nRels      = STORE.getRelationships(n.id);
        const hasSpouse  = nRels.some(r => r.type === 'Spouse');
        const betRel     = !hasSpouse ? nRels.find(r => r.type === 'Betrothed') : null;
        if (!hasSpouse) {
          if (!betRel) {
            attentionItems.push({ icon:'💍', text:`${esc(n.name)} is eligible for marriage`, urgent:false });
          } else {
            const betId  = betRel.sourceId === n.id ? betRel.targetId : betRel.sourceId;
            const bet    = STORE.getNpc(betId);
            const betAge = bet?.year_born ? year - bet.year_born : null;
            if (betAge !== null && betAge >= 18)
              attentionItems.push({ icon:'💍', text:`${esc(n.name)} and ${esc(bet.name)} are betrothed and both of age — ready to wed`, urgent:false });
          }
        }
      }
    });

    const attentionHtml = attentionItems.length ? `
      <div class="card" style="border-top:3px solid var(--crimson-mid);">
        <div class="section-title" style="margin-bottom:12px;color:var(--crimson-mid);">⚠ Matters Requiring Attention, ${lordTitle}</div>
        ${attentionItems.map(a => `
          <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px dotted var(--vellum-deep);">
            <span style="flex-shrink:0;">${a.icon}</span>
            <span style="font-size:0.85rem;color:${a.urgent?'var(--crimson-mid)':'var(--ink)'};">${a.text}</span>
          </div>`).join('')}
      </div>`
    : `<div class="card" style="border-top:3px solid var(--verdigris-mid);opacity:0.8;">
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
          <span style="color:var(--verdigris-mid);">✓</span>
          <span style="font-size:0.85rem;color:var(--ink-soft);font-style:italic;">No matters requiring your attention, ${lordTitle}.</span>
        </div>
      </div>`;

    // ── HOUSEHOLD ROSTER ──────────────────────────────────────
    const ROLE_ORDER = ['Player Knight','Knight Banneret','Vassal Knight','Bachelor Knight','Mercenary Knight','Knight','Lady','Baron','Estate Holder','Esquire','Steward','Squire','Page','Priest','Merchant','Other','Baby'];
    const sortedMembers = [...members].sort((a,b) => {
      if (this._rosterSort === 'rank') return (ROLE_ORDER.indexOf(a.role)||99) - (ROLE_ORDER.indexOf(b.role)||99);
      if (this._rosterSort === 'age')  return (a.year_born||9999) - (b.year_born||9999);
      return a.name.localeCompare(b.name);
    });

    const rosterRows = (this._rosterExpanded ? sortedMembers : sortedMembers.slice(0,8)).map(n => {
      const age = n.year_born ? year - n.year_born : null;
      return `<div class="pk-stat" style="cursor:pointer;" role="button" tabindex="0" onclick="Components.openNpcCard('${n.id}')">
        <span class="pk-stat-label">${esc(n.name)}</span>
        <span class="pk-stat-value" style="font-size:0.6rem;opacity:0.7;">${esc(n.role||'—')}${age!==null?' · '+age:''}
        </span>
      </div>`;
    }).join('');

    const membersHtml = members.length ? `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div class="section-title" style="margin-bottom:0;">${icon} ${household} Household</div>
          ${this._rosterExpanded ? `
            <div style="display:flex;gap:4px;">
              ${['rank','age','az'].map(s=>`<button class="btn ${this._rosterSort===s?'btn-primary':'btn-ghost'}" style="padding:2px 8px;font-size:0.52rem;" onclick="TabDashboard.setRosterSort('${s}')">${s==='az'?'A–Z':s.charAt(0).toUpperCase()+s.slice(1)}</button>`).join('')}
            </div>` : ''}
        </div>
        ${rosterRows}
        <div style="margin-top:10px;">
          <button class="btn btn-ghost" style="width:100%;" onclick="TabDashboard.toggleRoster()">
            ${this._rosterExpanded ? `▴ Collapse (${members.length})` : `▾ Show All ${members.length} Members`}
          </button>
        </div>
      </div>` : '';

    // ── RECENT DEATHS ─────────────────────────────────────────
    const recentDead = STORE.dead
      .filter(n => n.year_died && n.year_died >= year - 3)
      .sort((a,b) => {
        const aOwn = (a.household||'').toLowerCase() === household.toLowerCase() ? 0 : 1;
        const bOwn = (b.household||'').toLowerCase() === household.toLowerCase() ? 0 : 1;
        return aOwn - bOwn || b.year_died - a.year_died;
      });

    const deathsHtml = recentDead.length ? `
      <div class="card">
        <div class="section-title" style="margin-bottom:12px;">Recent Deaths</div>
        ${recentDead.slice(0,6).map(n => {
          const isOwn = (n.household||'').toLowerCase() === household.toLowerCase();
          return `<div class="pk-stat" style="cursor:pointer;" role="button" tabindex="0" onclick="Components.openNpcCard('${n.id}')">
            <span class="pk-stat-label" style="${isOwn?'color:var(--crimson-mid);font-weight:600;':''}">† ${esc(n.name)}</span>
            <span class="pk-stat-value" style="color:var(--crimson-mid);font-size:0.65rem;">${n.year_died} AD</span>
          </div>`;
        }).join('')}
      </div>` : '';

    // ── RECENT CHRONICLE ──────────────────────────────────────
    const allEvents = [];
    if (STORE.chronicle) {
      Object.entries(STORE.chronicle).forEach(([yr, chron]) => {
        if (!Array.isArray(chron)) return;
        chron.forEach(e => allEvents.push({ year: parseInt(yr), ...e }));
      });
    }
    const recentEvents = allEvents.filter(e => e.year >= year - 2).sort((a,b) => b.year - a.year).slice(0, 5);

    const chronicleHtml = recentEvents.length ? `
      <div class="card">
        <div class="section-title" style="margin-bottom:12px;">📖 Recent Chronicle</div>
        ${recentEvents.map(e => {
          const cat = (typeof CHRONICLE_CATS !== 'undefined' && CHRONICLE_CATS[e.cat]) || { colour: '#707070' };
          return `<div style="padding:6px 0 6px 8px;border-bottom:1px dotted var(--vellum-deep);border-left:3px solid ${cat.colour}33;margin-bottom:2px;">
            <div style="font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.1em;text-transform:uppercase;color:${cat.colour};margin-bottom:2px;">${e.year} AD</div>
            <div style="font-size:0.82rem;color:var(--ink);">${esc(e.text)}</div>
          </div>`;
        }).join('')}
        <div style="margin-top:10px;">
          <button class="btn btn-ghost" style="width:100%;" onclick="APP.switchTab('chronicle')">Go to Chronicle →</button>
        </div>
      </div>` : '';

    panel.innerHTML = `
      <div style="height:100%;overflow-y:auto;padding:24px;background:var(--vellum);">

        <!-- WELCOME HEADER -->
        <div style="margin-bottom:24px;padding:20px 24px;background:linear-gradient(135deg,${col}28 0%,transparent 100%);
             border:1px solid ${col}44;border-left:4px solid ${col};border-radius:var(--radius);">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-family:var(--font-display);font-size:1.4rem;color:var(--ink);margin-bottom:6px;">${title} ${knightName}</div>
              <div style="font-family:var(--font-heading);font-size:0.55rem;letter-spacing:0.18em;text-transform:uppercase;color:${col};margin-bottom:12px;">${household} · Anno Domini ${year}</div>
              <div style="font-family:'EB Garamond',serif;font-style:italic;font-size:1rem;color:var(--ink-soft);line-height:1.6;">${greeting}</div>
            </div>
            <button class="btn btn-succession" onclick="TabDashboard.openSuccession()">⚔ Change Player Knight</button>
          </div>
        </div>

        <!-- CARDS GRID -->
        <div class="dashboard-layout">
          ${attentionHtml}
          ${typeof TasksManager !== 'undefined' ? TasksManager.buildDashboardWidget() : ''}
          ${manorHtml}
          ${this._buildPoiWidget(year)}
          ${typeof Notes !== 'undefined' ? Notes.buildDashboardWidget() : ''}
          ${membersHtml}
          ${deathsHtml}
          ${chronicleHtml}
        </div>

      </div>`;
  },

  // ── SUCCESSION MODAL ───────────────────────────────────────

  openSuccession() {
    const user      = window.__USER__;
    const household = user?.household || '';
    const members   = STORE.householdMembers(household);
    const pk        = members.find(n => n.role === 'Player Knight');
    const pkName    = pk?.name || 'your knight';

    this._successionData = { household, pk, members };

    Modal.open(`
      <div class="modal-title">Change Player Knight</div>
      <div style="margin-top:6px;font-family:'EB Garamond',serif;font-style:italic;font-size:0.95rem;color:var(--ink-soft);margin-bottom:20px;">
        What has become of <strong style="font-style:normal;">${pkName}</strong>?
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;">
        <button onclick="TabDashboard._successionStep2('died')" style="
            display:flex;flex-direction:column;align-items:center;gap:6px;padding:20px 12px;
            background:rgba(139,20,20,0.07);border:1px solid rgba(139,20,20,0.3);border-radius:var(--radius);
            cursor:pointer;font-family:var(--font-heading);letter-spacing:0.05em;color:var(--crimson-mid);
            transition:background 0.15s;">
          <span style="font-size:1.6rem;">†</span>
          <span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.12em;">Died</span>
          <span style="font-size:0.6rem;opacity:0.6;font-family:var(--font-body);text-transform:none;letter-spacing:0;">Record death &amp; choose heir</span>
        </button>
        <button onclick="TabDashboard._successionStep2('retired')" style="
            display:flex;flex-direction:column;align-items:center;gap:6px;padding:20px 12px;
            background:rgba(90,80,64,0.07);border:1px solid rgba(90,80,64,0.3);border-radius:var(--radius);
            cursor:pointer;font-family:var(--font-heading);letter-spacing:0.05em;color:var(--ink);
            transition:background 0.15s;">
          <span style="font-size:1.6rem;">🛡</span>
          <span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.12em;">Retired</span>
          <span style="font-size:0.6rem;opacity:0.6;font-family:var(--font-body);text-transform:none;letter-spacing:0;">Step down honourably</span>
        </button>
        <button onclick="TabDashboard._successionStep2('na')" style="
            display:flex;flex-direction:column;align-items:center;gap:6px;padding:20px 12px;
            background:rgba(60,100,80,0.07);border:1px solid rgba(60,100,80,0.3);border-radius:var(--radius);
            cursor:pointer;font-family:var(--font-heading);letter-spacing:0.05em;color:var(--verdigris-mid);
            transition:background 0.15s;">
          <span style="font-size:1.6rem;">⚔</span>
          <span style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.12em;">Play Another Knight</span>
          <span style="font-size:0.6rem;opacity:0.6;font-family:var(--font-body);text-transform:none;letter-spacing:0;">No fate recorded — simply switch characters</span>
        </button>
      </div>`);
  },

  _successionStep2(action) {
    const { pk } = this._successionData;
    this._successionData.action = action;
    const year = STORE.year;

    if (action === 'na') {
      this._successionStep3();
      return;
    }

    if (action === 'died') {
      Modal.push(`
        <div class="modal-title">† Record the Death of ${pk?.name || 'the Knight'}</div>
        <div style="display:flex;flex-direction:column;gap:14px;margin-top:16px;">
          <div>
            <label class="form-label">Year of Death</label>
            <input id="suc-death-year" type="number" class="form-input" value="${year}" min="400" max="700">
          </div>
          <div>
            <label class="form-label">Cause of Death</label>
            <input id="suc-death-cause" type="text" class="form-input" placeholder="e.g. Slain by a Saxon spear at the Battle of Badon">
          </div>
          <button class="btn btn-primary" style="align-self:flex-end;" onclick="TabDashboard._successionStep3()">Next: Choose Successor →</button>
        </div>`);
    } else if (action === 'retired') {
      Modal.push(`
        <div class="modal-title">🛡 Retirement of ${pk?.name || 'the Knight'}</div>
        <div style="display:flex;flex-direction:column;gap:14px;margin-top:16px;">
          <div>
            <label class="form-label">Life Event Title</label>
            <input id="suc-ret-title" type="text" class="form-input" value="Retired from Questing">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label class="form-label">Year</label>
              <input id="suc-ret-year" type="number" class="form-input" value="${year}" min="400" max="700">
            </div>
            <div>
              <label class="form-label">Season</label>
              <select id="suc-ret-season" class="form-input">
                <option value="spring">Spring</option>
                <option value="summer">Summer</option>
                <option value="autumn">Autumn</option>
                <option value="winter" selected>Winter</option>
              </select>
            </div>
          </div>
          <div>
            <label class="form-label">Notes <span style="opacity:0.5;">(optional)</span></label>
            <textarea id="suc-ret-notes" class="form-input" rows="3" placeholder="Any notable details about the retirement..."></textarea>
          </div>
          <button class="btn btn-primary" style="align-self:flex-end;" onclick="TabDashboard._successionStep3()">Next: Choose Successor →</button>
        </div>`);
    }
  },

  _successionStep3() {
    const { action, pk, members, household } = this._successionData;
    const year = STORE.year;

    // Collect form data from step 2 before the DOM changes
    if (action === 'died') {
      const deathYearEl = document.getElementById('suc-death-year');
      const causEl      = document.getElementById('suc-death-cause');
      this._successionData.deathData = {
        year:  deathYearEl ? parseInt(deathYearEl.value) || year : year,
        cause: causEl ? causEl.value.trim() : '',
      };
    } else if (action === 'retired') {
      const titleEl  = document.getElementById('suc-ret-title');
      const yearEl   = document.getElementById('suc-ret-year');
      const seasonEl = document.getElementById('suc-ret-season');
      const notesEl  = document.getElementById('suc-ret-notes');
      this._successionData.lifeEvent = {
        title:     titleEl  ? titleEl.value.trim()  || 'Retired from Questing' : 'Retired from Questing',
        year:      yearEl   ? parseInt(yearEl.value) || year : year,
        season:    seasonEl ? seasonEl.value : 'winter',
        userNotes: notesEl  ? notesEl.value.trim() : '',
      };
    }

    // Candidates: all living household members except the departing PK (unless just switching)
    const excludeId = (action !== 'na' && pk) ? pk.id : null;
    const candidates = members.filter(n => n.id && n.id !== excludeId && n.status !== 'Dead');

    const cardStyle = `
      display:flex;flex-direction:column;align-items:center;gap:4px;padding:14px 10px;
      background:var(--vellum-deep);border:2px solid transparent;border-radius:var(--radius);
      cursor:pointer;text-align:center;transition:border-color 0.15s,background 0.15s;`;
    const selectedStyle = `border-color:var(--verdigris-mid);background:rgba(60,110,80,0.1);`;

    Modal.push(`
      <div class="modal-title">Who shall bear the standard?</div>
      <div style="font-family:'EB Garamond',serif;font-style:italic;font-size:0.9rem;color:var(--ink-soft);margin-top:4px;margin-bottom:16px;">
        Select the new Player Knight from <strong style="font-style:normal;">${household}</strong> household.
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;max-height:320px;overflow-y:auto;padding:2px;">
        ${candidates.length ? candidates.map(n => {
          const age = n.year_born ? year - n.year_born : null;
          return `<div id="suc-card-${n.id}" style="${cardStyle}" role="button" tabindex="0" onclick="TabDashboard._successionSelect('${n.id}')">
            <div style="font-size:1.2rem;line-height:1;">⚔</div>
            <div style="font-family:var(--font-heading);font-size:0.62rem;letter-spacing:0.05em;">${esc(n.name)}</div>
            <div style="font-size:0.6rem;color:var(--ink-soft);">${esc(n.role || '—')}</div>
            ${age !== null ? `<div style="font-size:0.58rem;opacity:0.5;">${age} yrs</div>` : ''}
          </div>`;
        }).join('') : `<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--ink-soft);font-style:italic;">
          No eligible household members found.
        </div>`}
      </div>
      <div id="suc-confirm-area" style="margin-top:16px;"></div>`,
      { _selectedStyle: selectedStyle });
  },

  _successionSelect(npcId) {
    const { action, pk, members } = this._successionData;
    this._successionData.newPkId = npcId;
    const newPk = members.find(n => n.id === npcId);

    // Highlight the selected card
    document.querySelectorAll('[id^="suc-card-"]').forEach(el => {
      el.style.borderColor  = 'transparent';
      el.style.background   = 'var(--vellum-deep)';
    });
    const card = document.getElementById(`suc-card-${npcId}`);
    if (card) {
      card.style.borderColor = 'var(--verdigris-mid)';
      card.style.background  = 'rgba(60,110,80,0.1)';
    }

    // Build summary
    const lines = [];
    if (action === 'died' && pk) {
      const d = this._successionData.deathData;
      lines.push(`<span style="color:var(--crimson-mid);">† ${pk.name} will be recorded as deceased${d?.year ? ' (' + d.year + ' AD)' : ''}</span>`);
    } else if (action === 'retired' && pk) {
      const l = this._successionData.lifeEvent;
      lines.push(`🛡 ${pk.name} will retire to the role of Knight${l?.year ? ' (' + l.year + ' AD)' : ''}`);
    }
    lines.push(`⚔ ${newPk?.name || 'Unknown'} will be named Player Knight`);

    const area = document.getElementById('suc-confirm-area');
    if (!area) return;
    area.innerHTML = `
      <div style="background:rgba(0,0,0,0.04);border:1px solid var(--vellum-deep);border-radius:var(--radius);padding:12px 14px;margin-bottom:12px;">
        ${lines.map(l => `<div style="font-size:0.83rem;margin:4px 0;line-height:1.5;">${l}</div>`).join('')}
      </div>
      <div style="display:flex;justify-content:flex-end;">
        <button class="btn btn-primary" onclick="TabDashboard._successionConfirm()">Confirm &amp; Save →</button>
      </div>`;
  },

  async _successionConfirm() {
    const { action, pk, newPkId, deathData, lifeEvent } = this._successionData;

    if (!newPkId) { Toast.show('Please select a successor first.', 'error'); return; }

    const body = {
      old_pk_id:  pk?.id  || null,
      new_pk_id:  newPkId,
      old_action: action  || 'na',
      death_data: deathData || null,
      life_event: lifeEvent || null,
    };

    try {
      const res = await fetch('/api/succession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        Toast.show('Succession failed: ' + (err.error || `HTTP ${res.status}`), 'error');
        return;
      }
      Modal.close();
      this._successionData = null;
      await STORE.loadFromFile();
      this.render();
    } catch (e) {
      Toast.show('Network error: ' + e.message, 'error');
    }
  },
};
