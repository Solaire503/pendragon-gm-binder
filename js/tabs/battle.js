/* ══════════════════════════════════════════════════════════════
   BATTLE.JS — Battle Records tab
   Live multiplayer battle tracker for KAP 6e battles.
══════════════════════════════════════════════════════════════ */

const TabBattle = {

  _state: null,
  _battle: null,
  _users: null,
  _expandedPKs: new Set(),
  _stepsOpen: true,
  _foesRefOpen: false,
  _roundLogOpen: true,
  _killsSummaryOpen: false,

  FOE_TEMPLATES: [
    // Ch.6 Battle Encounters
    { group:'Battle Encounters', type:'Peasants', weapon:'Agricultural Implement', hp:18, armor:'0', skill:8, damage:'2D6+3', kv:0.0625, glory:0, moraleLoss:'1D3', moraleMin:5, perPK:5, behavior:'Flee on any damage. Half attack per round (3 per PK). Cowardly check if charged. Valorous 6 check each round.' },
    { group:'Battle Encounters', type:'Spearmen', weapon:'Spear (2H)', hp:23, armor:'5', skill:10, damage:'4D6+2D6', kv:0.125, glory:10, moraleLoss:'1D6', moraleMin:8, perPK:3, behavior:'Set Spear vs charge (need Valorous roll). Defend action at 1/3 injured. Flee at 2/3 injured.' },
    { group:'Battle Encounters', type:'Archers', weapon:'Self Bow / Crossbow', hp:24, armor:'1-5', skill:12, damage:'3D6', kv:0.125, glory:5, moraleLoss:'1D6', moraleMin:5, perPK:3, behavior:'Shoot at range. Valorous check if charged by mounted. Flee at 1/3 down.' },
    { group:'Battle Encounters', type:'Foot Soldiers', weapon:'Sword / Axe / Mace', hp:23, armor:'5+6', skill:10, damage:'4D6', kv:0.125, glory:10, moraleLoss:'1D6', moraleMin:7, perPK:2, behavior:'Valorous 12 check if charged. Flee at 50% down.' },
    { group:'Battle Encounters', type:'Knights on Foot', weapon:'Sword (Spear vs mounted)', hp:28, armor:'10+6', skill:15, damage:'4D6', kv:0.5, glory:25, moraleLoss:'1D6', moraleMin:10, perPK:1.5, behavior:'Double up on highest Glory PKs. Spear negates height penalty.' },
    { group:'Battle Encounters', type:'Elite Knights on Foot', weapon:'Sword (Spear vs mounted)', hp:28, armor:'10+6', skill:15, damage:'4D6', kv:0.5, glory:25, moraleLoss:'1D6+2', moraleMin:12, perPK:1.5, behavior:'Double up on highest Glory PKs. Spear negates height penalty.' },
    { group:'Battle Encounters', type:'Hobilars', weapon:'Spear', hp:23, armor:'6+6', skill:14, damage:'3D6', kv:0.5, glory:25, moraleLoss:'1D6+3', moraleMin:10, perPK:2, behavior:'Auto-Evade when engaged. Movement 18. Valorous check each round if caught.' },
    { group:'Battle Encounters', type:'Mounted Sergeants', weapon:'Spear / Sword', hp:28, armor:'9+6', skill:13, damage:'4D6', kv:0.75, glory:25, moraleLoss:'1D6+2', moraleMin:12, perPK:1, behavior:'May counter-charge. Charge damage 5D6.' },
    { group:'Battle Encounters', type:'Mounted Knights', weapon:'Spear / Sword', hp:28, armor:'10+6', skill:15, damage:'4D6', kv:1, glory:25, moraleLoss:'1D6+2', moraleMin:12, perPK:1, behavior:'May counter-charge. Charge damage 6D6. Prefer swords after charge.' },
    { group:'Battle Encounters', type:'Elite Mounted Knights', weapon:'Spear / Sword', hp:28, armor:'10+6', skill:15, damage:'4D6', kv:1, glory:25, moraleLoss:'2D6', moraleMin:12, perPK:1, behavior:'May counter-charge. Charge damage 6D6. Fine stallions (+£5).' },
    { group:'Battle Encounters', type:'Pictish Clansmen', weapon:'Spear (2H)', hp:24, armor:'4', skill:14, damage:'6D6', kv:0.125, glory:25, moraleLoss:'1D6+1', moraleMin:8, perPK:2, behavior:'Set Spear vs charge (no roll needed). Flee at 1/3 down. No ransom.' },
    { group:'Battle Encounters', type:'Saxon Warriors', weapon:'Axe / Spear / Sword + Great Axe', hp:30, armor:'5+6', skill:14, damage:'5D6', kv:0.25, glory:25, moraleLoss:'1D6+2', moraleMin:8, perPK:2, behavior:'Shield wall round 1 (Defenders only). Both attack from round 2. No ransom. Fight to 3/4 down.' },
    // Ch.7 Knights
    { group:'Knights', type:'Unproven Knight', weapon:'Sword', hp:28, armor:'10+6', skill:13, damage:'4D6', kv:1, glory:25, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Charge 13 (6D6). Horsemanship 13.' },
    { group:'Knights', type:'Average Knight', weapon:'Sword', hp:28, armor:'10+6', skill:15, damage:'5D6', kv:1, glory:25, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Charge 15 (6D6). Horsemanship 15. Valorous 13+1D3.' },
    { group:'Knights', type:'Veteran Knight', weapon:'Sword', hp:30, armor:'11+6', skill:16, damage:'5D6', kv:1, glory:50, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Charge 16 (6D6). Horsemanship 16. Valorous 14+1D6.' },
    { group:'Knights', type:'Respected Knight', weapon:'Sword', hp:29, armor:'10+6', skill:17, damage:'5D6', kv:1, glory:50, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Charge 17 (6D6). Horsemanship 17. Valorous 14+1D3.' },
    { group:'Knights', type:'Notable Knight', weapon:'Sword', hp:30, armor:'11+6', skill:19, damage:'5D6', kv:1, glory:50, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Charge 19 (6D6). Spear 14 (5D6). Horsemanship 19. Battle 16.' },
    { group:'Knights', type:'Renowned Knight', weapon:'Sword', hp:31, armor:'11+6', skill:20, damage:'5D6', kv:1, glory:100, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Charge 20+ (6D6). Horsemanship 20+. Battle 18.' },
    { group:'Knights', type:'Extraordinary Knight', weapon:'Sword', hp:34, armor:'12+6', skill:20, damage:'5D6', kv:1, glory:100, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Charge 20+ (6D6). Horsemanship 20+. Battle 18. All weapon skills 10+.' },
    // Ch.7 Saxons
    { group:'Saxons', type:'Ceorl', weapon:'Spear / Seax', hp:26, armor:'0+6', skill:10, damage:'4D6', kv:0.125, glory:10, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Local levy. Javelin 10 (3D6). No armor, round shield only.' },
    { group:'Saxons', type:'Rich Ceorl', weapon:'Axe / Spear', hp:30, armor:'7+6', skill:12, damage:'5D6', kv:0.25, glory:25, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Javelin 12 (3D6). Haubergeon + aketon + open helm.' },
    { group:'Saxons', type:'Saxon Knight', weapon:'Sword', hp:27, armor:'9+6', skill:15, damage:'5D6', kv:1, glory:25, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Charge 12 (5D6). Horsemanship 12. Round shield (-2 mounted attacks).' },
    { group:'Saxons', type:'Heorthgeneat', weapon:'Axe / Spear', hp:32, armor:'10+6', skill:16, damage:'5D6', kv:0.5, glory:50, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Javelin 15 (3D6). Foot soldier. Hauberk + aketon + nasal helm.' },
    { group:'Saxons', type:'Mounted Heorthgeneat', weapon:'Axe', hp:30, armor:'10+6', skill:16, damage:'5D6', kv:0.5, glory:50, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Mounted infantry, dismount before attacking. Javelin 15 (3D6). Horsemanship 15.' },
    { group:'Saxons', type:'Ætheling', weapon:'Sword / Axe / Spear', hp:31, armor:'11+6', skill:20, damage:'5D6', kv:1, glory:50, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Saxon chieftain. Valorous 16. Hate (Britons) 14.' },
    { group:'Saxons', type:'Cyning', weapon:'Sword / Spear', hp:31, armor:'11+6', skill:20, damage:'5D6', kv:1, glory:50, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Saxon king. Valorous 20. Duty (Subjects) 18. Hate (Britons) 15.' },
    { group:'Saxons', type:'Berserker', weapon:'Great Axe / Maul', hp:33, armor:'6', skill:18, damage:'8D6', kv:1, glory:50, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Hate (You) 18. Reckless 20. No shield. Haubergeon + aketon only.' },
    // Ch.7 Picts
    { group:'Picts', type:'Pict Warrior', weapon:'Spear / Javelin', hp:24, armor:'0+4', skill:14, damage:'4D6', kv:0.125, glory:25, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Javelin 15 (3D6). Targe shield. Prefer 2H spear. Half darkness penalties. Avoidance 14.' },
    { group:'Picts', type:'Superlative Pict Warrior', weapon:'Spear / Sword', hp:26, armor:'3+4', skill:16, damage:'4D6', kv:0.25, glory:50, moraleLoss:'', moraleMin:0, perPK:1, behavior:'Javelin 18 (3D6). Magical tattoos + targe. Hate (Cymri) 15. Avoidance 12.' },
  ],

  SIZES: [
    { value: 'fight',    label: 'Fight',         rounds: 1 },
    { value: 'skirmish', label: 'Skirmish',      rounds: 3 },
    { value: 'clash',    label: 'Clash',         rounds: 5 },
    { value: 'small',    label: 'Small Battle',  rounds: 6 },
    { value: 'medium',   label: 'Medium Battle', rounds: 7 },
    { value: 'large',    label: 'Large Battle',  rounds: 8 },
    { value: 'huge',     label: 'Huge Battle',   rounds: 8 },
  ],

  async render() {
    const panel = document.getElementById('tab-battle');
    if (!panel) return;

    try {
      const res = await API.get('/api/battle/active');
      if (!res.ok) {
        panel.innerHTML = '<p class="muted" style="padding:2rem">Could not load battle status.</p>';
        return;
      }

      this._state = res.data;
      this._renderedState = res.data.active ? res.data.state : 'empty';

      if (!res.data.active) {
        this._renderEmpty(panel);
      } else if (res.data.state === 'setup') {
        await this._loadAndRenderSetup(panel);
      } else if (res.data.state === 'active') {
        await this._loadAndRenderConsole(panel);
      } else if (res.data.state === 'finalizing') {
        await this._loadAndRenderFinalization(panel);
      } else {
        this._renderedState = 'empty';
        this._renderEmpty(panel);
      }

      if (!isGM()) this._startPlayerPoll();
    } catch (err) {
      Toast.show('Battle render error: ' + err.message, 'error');
      if (panel) panel.innerHTML = `<p style="padding:2rem;color:var(--crimson-mid)">Battle render error: ${esc(String(err.message))}</p>`;
    }
  },

  _renderEmpty(panel) {
    if (isGM()) {
      panel.innerHTML = `
        <div class="battle-empty">
          <div class="battle-empty-icon">⚔</div>
          <h2 class="battle-empty-title">No Battle in Progress</h2>
          <p class="battle-empty-text">When you're ready to lead the conroi into battle, begin here.</p>
          <button class="btn btn-primary battle-start-btn" onclick="TabBattle.createBattle()">Start Battle</button>
        </div>`;
    } else {
      panel.innerHTML = `
        <div class="battle-empty">
          <div class="battle-empty-icon">⚔</div>
          <h2 class="battle-empty-title">No Battle in Progress</h2>
          <p class="battle-empty-text">The field is quiet. When the GM calls the conroi to arms, the battle will appear here.</p>
        </div>`;
    }
  },

  async createBattle() {
    const res = await API.post('/api/battle/create');
    if (!res.ok) {
      Toast.show(res.error || 'Failed to create battle', 'error');
      return;
    }
    this._battle = res.data.battle;
    if (STORE.year) {
      const yr = await API.patch('/api/battle/setup', { year: STORE.year });
      if (yr.ok) this._battle.year = STORE.year;
    }
    this.render();
  },

  async _loadAndRenderSetup(panel) {
    const [battleRes, usersRes] = await Promise.all([
      API.get('/api/battle/state'),
      this._users ? Promise.resolve({ ok: true, data: this._users }) : API.get('/api/users'),
    ]);
    if (!battleRes.ok || !battleRes.data.battle) {
      panel.innerHTML = '<p class="muted" style="padding:2rem">Could not load battle.</p>';
      return;
    }
    this._battle = battleRes.data.battle;
    if (usersRes.ok && Array.isArray(usersRes.data)) {
      this._users = usersRes.data;
    }

    if (!isGM()) {
      panel.innerHTML = `
        <div class="battle-empty">
          <div class="battle-empty-icon">⚔</div>
          <h2 class="battle-empty-title">Preparing for Battle</h2>
          <p class="battle-empty-text">The GM is marshalling the forces. Stand ready.</p>
        </div>`;
      return;
    }

    this._renderSetupForm(panel);
  },

  _renderSetupForm(panel) {
    const b = this._battle;
    const sizeOptions = this.SIZES.map(s =>
      `<option value="${s.value}" ${b.size === s.value ? 'selected' : ''}>${esc(s.label)}</option>`
    ).join('');

    panel.innerHTML = `
      <div class="battle-setup">
        <div class="battle-setup-header">
          <h2 class="battle-setup-title">⚔ Battle Setup</h2>
          <div class="battle-setup-actions">
            <button class="btn btn-sm btn-muted" onclick="TabBattle.abandonSetup()">Abandon</button>
            <button class="btn btn-sm btn-primary" onclick="TabBattle.beginBattle()">Begin Battle</button>
          </div>
        </div>

        <div class="battle-setup-grid">
          <div class="battle-setup-main">

            <div class="bs-section">
              <div class="bs-row">
                <label class="bs-label">Battle Name</label>
                <input class="edit-input" id="bs-name" value="${esc(b.name)}"
                  placeholder="e.g. The Siege of Ebble" onchange="TabBattle._saveField('name', this.value)">
              </div>
              <div class="bs-row-pair">
                <div class="bs-row">
                  <label class="bs-label">Year</label>
                  <input class="edit-input" id="bs-year" type="number" value="${b.year || ''}"
                    placeholder="496" onchange="TabBattle._saveField('year', +this.value)">
                </div>
                <div class="bs-row">
                  <label class="bs-label">Location</label>
                  <input class="edit-input" id="bs-location" value="${esc(b.location)}"
                    placeholder="e.g. River Ebble, Salisbury" onchange="TabBattle._saveField('location', this.value)">
                </div>
              </div>
              <div class="bs-row-pair">
                <div class="bs-row">
                  <label class="bs-label">Battle Size</label>
                  <select class="edit-input edit-select" id="bs-size" onchange="TabBattle._saveField('size', this.value)">
                    ${sizeOptions}
                  </select>
                </div>
                <div class="bs-row">
                  <label class="bs-label">Intensity <span class="bs-tip" title="Roll or set per Table 6.1.\nFight: set by GM. Skirmish: d6+3. Clash: d6+6.\nSmall: 2d6+3. Medium: 2d6+6.\nLarge: 2d6+9. Huge: 3d6+7.\nHigher = harder for players to choose encounters.">(?)</span></label>
                  <input class="edit-input" id="bs-intensity" type="number" value="${b.intensity}"
                    onchange="TabBattle._saveField('intensity', +this.value)">
                </div>
              </div>
              <div class="bs-row-pair">
                <div class="bs-row">
                  <label class="bs-label">Max Rounds</label>
                  <input class="edit-input" id="bs-max-rounds" type="number" value="${b.maxRounds}"
                    onchange="TabBattle._saveField('maxRounds', +this.value)">
                </div>
                <div class="bs-row">
                  <label class="bs-label">Starting Morale <span class="bs-tip" title="Average the conroi's shared Passion values.\nIf all PKs chose the same Passion, add +5.\nMorale can never exceed this starting value.">(?)</span></label>
                  <input class="edit-input" id="bs-morale" type="number" value="${b.morale?.starting || 0}"
                    placeholder="Average conroi passion" onchange="TabBattle._saveMorale(+this.value)">
                </div>
              </div>
            </div>

            <div class="bs-section">
              <h3 class="bs-section-title">Commanders</h3>
              <div class="bs-commander-grid">
                <div class="bs-commander">
                  <label class="bs-label">Friendly Commander</label>
                  <div class="bs-commander-fields">
                    ${buildNpcSearchHtml('bs-fc-search', 'bs-fc-id', 'Search NPC / PK or type name…')}
                    <input class="edit-input bs-battle-score" id="bs-fc-battle" placeholder="Battle"
                      value="${esc(b.friendlyCommander?.battle || '')}"
                      onchange="TabBattle._saveCommander('friendlyCommander')">
                  </div>
                </div>
                <div class="bs-commander">
                  <label class="bs-label">Enemy Commander</label>
                  <div class="bs-commander-fields">
                    ${buildNpcSearchHtml('bs-ec-search', 'bs-ec-id', 'Search NPC / PK or type name…')}
                    <input class="edit-input bs-battle-score" id="bs-ec-battle" placeholder="Battle"
                      value="${esc(b.enemyCommander?.battle || '')}"
                      onchange="TabBattle._saveCommander('enemyCommander')">
                  </div>
                </div>
              </div>
            </div>

            <div class="bs-section">
              <h3 class="bs-section-title">GM Notes</h3>
              <textarea class="edit-input edit-textarea" id="bs-notes" rows="3"
                placeholder="Notes for your eyes only…"
                onchange="TabBattle._saveField('gmNotes', this.value)">${esc(b.gmNotes)}</textarea>
            </div>

          </div>

          <div class="battle-setup-sidebar">

            <div class="bs-section">
              <div class="bs-section-header">
                <h3 class="bs-section-title">Conroi</h3>
                <button class="btn btn-sm btn-verdigris" onclick="TabBattle._showAddParticipant()">+ Add</button>
              </div>
              <div id="bs-participants-list">
                ${this._renderParticipantsList()}
              </div>
              <div class="bs-conroi-commander">
                <label class="bs-label">Conroi Commander</label>
                <select class="edit-input edit-select" id="bs-conroi-cmd"
                  onchange="TabBattle._saveField('conroiCommanderId', this.value || null)">
                  <option value="">— Select —</option>
                  ${b.participants.map(p =>
                    `<option value="${esc(p.participantId)}" ${b.conroiCommanderId === p.participantId ? 'selected' : ''}>${esc(p.name)}</option>`
                  ).join('')}
                </select>
                <input class="edit-input bs-battle-score" id="bs-cc-battle" placeholder="Battle"
                  style="margin-top:4px">
              </div>
            </div>

            <div class="bs-section">
              <div class="bs-section-header">
                <h3 class="bs-section-title">Foes Table</h3>
                <button class="btn btn-sm btn-crimson" onclick="TabBattle._showAddFoe()">+ Add Foe</button>
              </div>
              <div id="bs-foes-list">
                ${this._renderFoesList()}
              </div>
            </div>

          </div>
        </div>
      </div>`;

    this._initCommanderSearch();
  },

  _renderParticipantsList() {
    const b = this._battle;
    if (!b.participants.length) {
      return '<p class="muted" style="font-size:0.8rem;padding:8px 0">No participants added yet.</p>';
    }
    return b.participants.map(p => `
      <div class="bs-participant" data-pid="${esc(p.participantId)}">
        <div class="bs-participant-info">
          <span class="bs-participant-name">${esc(p.name)}</span>
          ${p.isPK ? '<span class="bs-pk-badge">PK</span>' : '<span class="bs-npc-badge">NPC</span>'}
          ${b.conroiCommanderId === p.participantId ? '<span class="bs-cmd-badge">CMD</span>' : ''}
        </div>
        <button class="btn-icon" onclick="TabBattle._removeParticipant('${esc(p.participantId)}')" title="Remove">×</button>
      </div>
    `).join('');
  },

  _renderFoesList() {
    const b = this._battle;
    if (!b.foes.length) {
      return '<p class="muted" style="font-size:0.8rem;padding:8px 0">No foes added yet.</p>';
    }
    return b.foes.map(f => `
      <div class="bs-foe" data-fid="${esc(f.foeId)}">
        <div class="bs-foe-info">
          <span class="bs-foe-type">${esc(f.type)}</span>
          <span class="bs-foe-stats">HP ${f.hp} · KV ${f.kv} · Glory ${f.glory}</span>
        </div>
        <div class="bs-foe-actions">
          <button class="btn-icon" onclick="TabBattle._editFoe('${esc(f.foeId)}')" title="Edit">✎</button>
          <button class="btn-icon" onclick="TabBattle._removeFoe('${esc(f.foeId)}')" title="Remove">×</button>
        </div>
      </div>
    `).join('');
  },

  _initCommanderSearch() {
    const allNpcs = STORE.living;
    initNpcSearch('bs-fc-search', 'bs-fc-id', allNpcs);
    initNpcSearch('bs-ec-search', 'bs-ec-id', allNpcs);

    const b = this._battle;
    const fcInput = document.getElementById('bs-fc-search');
    const fcHidden = document.getElementById('bs-fc-id');
    if (fcInput && b.friendlyCommander?.name) {
      fcInput.value = b.friendlyCommander.name;
      if (b.friendlyCommander.npcId) fcHidden.value = b.friendlyCommander.npcId;
    }
    const ecInput = document.getElementById('bs-ec-search');
    const ecHidden = document.getElementById('bs-ec-id');
    if (ecInput && b.enemyCommander?.name) {
      ecInput.value = b.enemyCommander.name;
      if (b.enemyCommander.npcId) ecHidden.value = b.enemyCommander.npcId;
    }

    if (fcInput) fcInput.addEventListener('change', () => this._saveCommander('friendlyCommander'));
    if (ecInput) ecInput.addEventListener('change', () => this._saveCommander('enemyCommander'));
  },

  async _saveField(field, value) {
    const body = {};
    body[field] = value;
    const res = await API.patch('/api/battle/setup', body);
    if (res.ok) {
      this._battle = res.data.battle;
      if (field === 'size') {
        const mr = document.getElementById('bs-max-rounds');
        if (mr) mr.value = this._battle.maxRounds;
      }
    } else {
      Toast.show(res.error || 'Failed to save', 'error');
    }
  },

  async _saveMorale(starting) {
    const res = await API.patch('/api/battle/setup', {
      morale: { current: starting, starting: starting }
    });
    if (res.ok) this._battle = res.data.battle;
    else Toast.show(res.error || 'Failed to save morale', 'error');
  },

  async _saveCommander(which) {
    const prefix = which === 'friendlyCommander' ? 'bs-fc' : 'bs-ec';
    const nameInput = document.getElementById(prefix + '-search');
    const idInput = document.getElementById(prefix + '-id');
    const battleInput = document.getElementById(prefix + '-battle');
    const cmd = {
      name: nameInput?.value || '',
      npcId: idInput?.value || null,
      battle: battleInput?.value || '',
    };
    const body = {};
    body[which] = cmd;
    const res = await API.patch('/api/battle/setup', body);
    if (res.ok) this._battle = res.data.battle;
    else Toast.show(res.error || 'Failed to save commander', 'error');
  },

  _showAddParticipant() {
    const allNpcs = STORE.living;
    const players = (this._users || []).filter(u => u.role === 'player');
    const playerOpts = players.map(u =>
      `<option value="${esc(u.username)}">${esc(u.username)}${u.household ? ' (' + esc(u.household) + ')' : ''}</option>`
    ).join('');

    const html = `
      <div style="margin-bottom:12px">
        ${buildNpcSearchHtml('bs-add-p-search', 'bs-add-p-id', 'Search for NPC or PK…')}
      </div>
      <div style="margin-bottom:8px">
        <label style="font-size:0.8rem;display:flex;align-items:center;gap:6px">
          <input type="checkbox" id="bs-add-p-pk"> This is a Player Knight (PK)
        </label>
      </div>
      <div style="margin-bottom:8px">
        <label class="bs-label" style="font-size:0.8rem">Controlled by</label>
        <select class="edit-input edit-select" id="bs-add-p-ctrl">
          <option value="">— GM controlled —</option>
          ${playerOpts}
        </select>
      </div>`;

    Modal.open(`
      <div style="min-width:360px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Add Participant</div>
        ${html}
        <div class="btn-row" style="margin-top:14px;">
          <button class="btn btn-primary" onclick="TabBattle._doAddParticipant()">Add</button>
          <button class="btn btn-muted" onclick="Modal.close()">Cancel</button>
        </div>
      </div>
    `, { onOpen: () => {
      initNpcSearch('bs-add-p-search', 'bs-add-p-id', allNpcs);
      this._wireParticipantAutoDetect(players);
    }});
  },

  _wireParticipantAutoDetect(players) {
    const hidden = document.getElementById('bs-add-p-id');
    const pkCheck = document.getElementById('bs-add-p-pk');
    const ctrlSelect = document.getElementById('bs-add-p-ctrl');
    if (!hidden || !ctrlSelect) return;

    hidden.addEventListener('change', () => {
      const npcId = hidden.value;
      if (!npcId) return;
      const npc = STORE.living.find(n => n.id === npcId);
      if (!npc) return;
      const match = players.find(u =>
        u.household && npc.household &&
        u.household.toLowerCase() === npc.household.toLowerCase()
      );
      if (match) {
        ctrlSelect.value = match.username;
        if (pkCheck) pkCheck.checked = true;
      }
    });
  },

  async _doAddParticipant() {
    const nameInput = document.getElementById('bs-add-p-search');
    const idInput = document.getElementById('bs-add-p-id');
    const pkCheck = document.getElementById('bs-add-p-pk');
    const ctrlInput = document.getElementById('bs-add-p-ctrl');
    const name = nameInput?.value?.trim();
    if (!name) { Toast.show('Enter a name', 'error'); return; }

    const res = await API.post('/api/battle/participant', {
      name: name,
      npcId: idInput?.value || null,
      isPK: pkCheck?.checked || false,
      controlledBy: ctrlInput?.value?.trim() || null,
    });
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    this._battle.participants.push(res.data.participant);
    Modal.close();

    if (this._battle.state === 'active') {
      const panel = document.getElementById('tab-battle');
      if (panel) this._renderBattleConsole(panel);
      return;
    }
    const list = document.getElementById('bs-participants-list');
    if (list) list.innerHTML = this._renderParticipantsList();
    const cmdSelect = document.getElementById('bs-conroi-cmd');
    if (cmdSelect) {
      const p = res.data.participant;
      const opt = document.createElement('option');
      opt.value = p.participantId;
      opt.textContent = p.name;
      cmdSelect.appendChild(opt);
    }
  },

  async _removeParticipant(pid) {
    const res = await API.del('/api/battle/participant/' + pid);
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    this._battle.participants = this._battle.participants.filter(p => p.participantId !== pid);
    if (this._battle.conroiCommanderId === pid) this._battle.conroiCommanderId = null;

    const list = document.getElementById('bs-participants-list');
    if (list) list.innerHTML = this._renderParticipantsList();
    const cmdSelect = document.getElementById('bs-conroi-cmd');
    if (cmdSelect) {
      const opt = cmdSelect.querySelector(`option[value="${pid}"]`);
      if (opt) opt.remove();
    }
  },

  _showAddFoe() {
    let templateOpts = '';
    let lastGroup = '';
    this.FOE_TEMPLATES.forEach((t, i) => {
      if (t.group !== lastGroup) {
        if (lastGroup) templateOpts += '</optgroup>';
        templateOpts += `<optgroup label="${esc(t.group)}">`;
        lastGroup = t.group;
      }
      templateOpts += `<option value="${i}">${esc(t.type)}</option>`;
    });
    if (lastGroup) templateOpts += '</optgroup>';

    const html = `
      <div class="bs-foe-form">
        <div class="bs-row">
          <label class="bs-label">Template</label>
          <select class="edit-input edit-select" id="bs-af-template" onchange="TabBattle._applyFoeTemplate()">
            <option value="">— Custom foe —</option>
            ${templateOpts}
          </select>
        </div>
        <div class="bs-row">
          <label class="bs-label">Foe Type</label>
          <input class="edit-input" id="bs-af-type" placeholder="e.g. Saxon Heorthgeneats">
        </div>
        <div class="bs-row-pair">
          <div class="bs-row">
            <label class="bs-label">Weapon(s)</label>
            <input class="edit-input" id="bs-af-weapon" placeholder="e.g. Axes">
          </div>
          <div class="bs-row">
            <label class="bs-label">HP</label>
            <input class="edit-input" id="bs-af-hp" type="number" placeholder="30">
          </div>
        </div>
        <div class="bs-row-pair">
          <div class="bs-row">
            <label class="bs-label">Armor</label>
            <input class="edit-input" id="bs-af-armor" placeholder="e.g. 10+6">
          </div>
          <div class="bs-row">
            <label class="bs-label">Damage</label>
            <input class="edit-input" id="bs-af-damage" placeholder="e.g. 5D6">
          </div>
        </div>
        <div class="bs-row-pair">
          <div class="bs-row">
            <label class="bs-label">Per PK</label>
            <input class="edit-input" id="bs-af-perpk" type="number" value="1" placeholder="2">
          </div>
          <div class="bs-row">
            <label class="bs-label">Primary Skill</label>
            <input class="edit-input" id="bs-af-skill" type="number" placeholder="14">
          </div>
        </div>
        <div class="bs-row">
          <label class="bs-label">Skills &amp; Traits</label>
          <textarea class="edit-input edit-textarea" id="bs-af-skills" rows="2"
            placeholder="Sword 18, Lance 16, Horsemanship 15, Valorous 14…"></textarea>
        </div>
        <div class="bs-row-pair">
          <div class="bs-row">
            <label class="bs-label">Knight Value (KV)</label>
            <input class="edit-input" id="bs-af-kv" type="number" step="0.0625" placeholder="0.25">
          </div>
          <div class="bs-row">
            <label class="bs-label">Glory</label>
            <input class="edit-input" id="bs-af-glory" type="number" placeholder="25">
          </div>
        </div>
        <div class="bs-row-pair">
          <div class="bs-row">
            <label class="bs-label">Morale Loss</label>
            <input class="edit-input" id="bs-af-mloss" placeholder="e.g. 1D6+2">
          </div>
          <div class="bs-row">
            <label class="bs-label">Morale Min</label>
            <input class="edit-input" id="bs-af-mmin" type="number" placeholder="10">
          </div>
        </div>
        <div class="bs-row">
          <label class="bs-label">Behavior Notes</label>
          <textarea class="edit-input edit-textarea" id="bs-af-behavior" rows="2"
            placeholder="Shield wall round 1, flee conditions…"></textarea>
        </div>
      </div>`;

    Modal.open(`
      <div style="min-width:400px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Add Foe Encounter</div>
        ${html}
        <div class="btn-row" style="margin-top:14px;">
          <button class="btn btn-primary" onclick="TabBattle._doAddFoe()">Add</button>
          <button class="btn btn-muted" onclick="Modal.close()">Cancel</button>
        </div>
      </div>
    `);
  },

  _applyFoeTemplate() {
    const sel = document.getElementById('bs-af-template');
    if (!sel || sel.value === '') return;
    const t = this.FOE_TEMPLATES[+sel.value];
    if (!t) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('bs-af-type', t.type);
    set('bs-af-weapon', t.weapon);
    set('bs-af-hp', t.hp);
    set('bs-af-armor', t.armor);
    set('bs-af-skill', t.skill);
    set('bs-af-damage', t.damage);
    set('bs-af-kv', t.kv);
    set('bs-af-glory', t.glory);
    set('bs-af-mloss', t.moraleLoss);
    set('bs-af-mmin', t.moraleMin);
    set('bs-af-perpk', t.perPK);
    set('bs-af-skills', t.skills || '');
    set('bs-af-behavior', t.behavior);
  },

  async _doAddFoe() {
    const v = id => document.getElementById(id)?.value || '';
    const type = v('bs-af-type').trim();
    if (!type) { Toast.show('Enter a foe type', 'error'); return; }

    const res = await API.post('/api/battle/foe', {
      type,
      weapon: v('bs-af-weapon'),
      hp: +v('bs-af-hp') || 0,
      armor: v('bs-af-armor'),
      skill: +v('bs-af-skill') || 0,
      damage: v('bs-af-damage'),
      kv: +v('bs-af-kv') || 0,
      glory: +v('bs-af-glory') || 0,
      moraleLoss: v('bs-af-mloss'),
      moraleMin: +v('bs-af-mmin') || 0,
      perPK: +v('bs-af-perpk') || 1,
      skills: v('bs-af-skills'),
      behavior: v('bs-af-behavior'),
    });
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    this._battle.foes.push(res.data.foe);
    Modal.close();

    const list = document.getElementById('bs-foes-list');
    if (list) {
      list.innerHTML = this._renderFoesList();
    } else {
      const panel = document.getElementById('tab-battle');
      if (panel && this._battle.state === 'active') this._renderBattleConsole(panel);
    }
  },

  _editFoe(foeId) {
    const f = this._battle.foes.find(x => x.foeId === foeId);
    if (!f) return;

    const html = `
      <div class="bs-foe-form">
        <div class="bs-row">
          <label class="bs-label">Foe Type</label>
          <input class="edit-input" id="bs-ef-type" value="${esc(f.type)}">
        </div>
        <div class="bs-row-pair">
          <div class="bs-row">
            <label class="bs-label">Weapon(s)</label>
            <input class="edit-input" id="bs-ef-weapon" value="${esc(f.weapon)}">
          </div>
          <div class="bs-row">
            <label class="bs-label">HP</label>
            <input class="edit-input" id="bs-ef-hp" type="number" value="${f.hp}">
          </div>
        </div>
        <div class="bs-row-pair">
          <div class="bs-row">
            <label class="bs-label">Armor</label>
            <input class="edit-input" id="bs-ef-armor" value="${esc(f.armor)}">
          </div>
          <div class="bs-row">
            <label class="bs-label">Skill</label>
            <input class="edit-input" id="bs-ef-skill" type="number" value="${f.skill}">
          </div>
        </div>
        <div class="bs-row-pair">
          <div class="bs-row">
            <label class="bs-label">Damage</label>
            <input class="edit-input" id="bs-ef-damage" value="${esc(f.damage)}">
          </div>
          <div class="bs-row">
            <label class="bs-label">Per PK</label>
            <input class="edit-input" id="bs-ef-perpk" type="number" value="${f.perPK}">
          </div>
        </div>
        <div class="bs-row-pair">
          <div class="bs-row">
            <label class="bs-label">Knight Value (KV)</label>
            <input class="edit-input" id="bs-ef-kv" type="number" step="0.0625" value="${f.kv}">
          </div>
          <div class="bs-row">
            <label class="bs-label">Glory</label>
            <input class="edit-input" id="bs-ef-glory" type="number" value="${f.glory}">
          </div>
        </div>
        <div class="bs-row-pair">
          <div class="bs-row">
            <label class="bs-label">Morale Loss</label>
            <input class="edit-input" id="bs-ef-mloss" value="${esc(f.moraleLoss)}">
          </div>
          <div class="bs-row">
            <label class="bs-label">Morale Min</label>
            <input class="edit-input" id="bs-ef-mmin" type="number" value="${f.moraleMin}">
          </div>
        </div>
        <div class="bs-row">
          <label class="bs-label">Skills &amp; Traits</label>
          <textarea class="edit-input edit-textarea" id="bs-ef-skills" rows="2"
            placeholder="Sword 18, Lance 16, Valorous 14…">${esc(f.skills || '')}</textarea>
        </div>
        <div class="bs-row">
          <label class="bs-label">Behavior Notes</label>
          <textarea class="edit-input edit-textarea" id="bs-ef-behavior" rows="2">${esc(f.behavior)}</textarea>
        </div>
      </div>`;

    Modal.open(`
      <div style="min-width:400px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Edit Foe: ${esc(f.type)}</div>
        ${html}
        <div class="btn-row" style="margin-top:14px;">
          <button class="btn btn-primary" onclick="TabBattle._doEditFoe('${esc(foeId)}')">Save</button>
          <button class="btn btn-muted" onclick="Modal.close()">Cancel</button>
        </div>
      </div>
    `);
  },

  async _doEditFoe(foeId) {
    const v = id => document.getElementById(id)?.value || '';
    const res = await API.patch('/api/battle/foe/' + foeId, {
      type: v('bs-ef-type').trim(),
      weapon: v('bs-ef-weapon'),
      hp: +v('bs-ef-hp') || 0,
      armor: v('bs-ef-armor'),
      skill: +v('bs-ef-skill') || 0,
      damage: v('bs-ef-damage'),
      kv: +v('bs-ef-kv') || 0,
      glory: +v('bs-ef-glory') || 0,
      moraleLoss: v('bs-ef-mloss'),
      moraleMin: +v('bs-ef-mmin') || 0,
      perPK: +v('bs-ef-perpk') || 1,
      skills: v('bs-ef-skills'),
      behavior: v('bs-ef-behavior'),
    });
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    const idx = this._battle.foes.findIndex(f => f.foeId === foeId);
    if (idx !== -1) this._battle.foes[idx] = res.data.foe;
    Modal.close();

    const list = document.getElementById('bs-foes-list');
    if (list) list.innerHTML = this._renderFoesList();
  },

  async _removeFoe(foeId) {
    const res = await API.del('/api/battle/foe/' + foeId);
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    this._battle.foes = this._battle.foes.filter(f => f.foeId !== foeId);

    const list = document.getElementById('bs-foes-list');
    if (list) list.innerHTML = this._renderFoesList();
  },

  async beginBattle() {
    const res = await API.post('/api/battle/start');
    if (!res.ok) {
      Toast.show(res.error || 'Cannot start battle', 'error');
      return;
    }
    this._battle = res.data.battle;
    Toast.show('The battle has begun!', 'success');
    await this.render();
  },

  async abandonSetup() {
    if (!confirm('Abandon this battle setup? This cannot be undone.')) return;
    const res = await API.del('/api/battle/abandon');
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    this._battle = null;
    this.render();
  },

  async _loadAndRenderConsole(panel) {
    const res = await API.get('/api/battle/state');
    if (!res.ok || !res.data.battle) {
      panel.innerHTML = '<p class="muted" style="padding:2rem">Could not load battle.</p>';
      return;
    }
    this._battle = res.data.battle;

    if (!isGM()) {
      this._renderPlayerView(panel);
      return;
    }
    try {
      this._renderBattleConsole(panel);
    } catch (err) {
      console.error('Battle console render error:', err);
      panel.innerHTML = `<p class="muted" style="padding:2rem">Render error: ${esc(err.message)}</p>`;
    }
  },

  /* ── Player battle view ─────────────────────────────────────── */

  PLAYER_STATUS_LABELS: {
    active: 'Active', major_wound: 'Major Wound', unconscious: 'Unconscious',
    dead: 'Dead', alone: 'Alone in Field', rear: 'Retired to Rear',
  },
  PLAYER_STATUS_COLOURS: {
    active: '#208060', major_wound: '#c07820', unconscious: '#c07820',
    dead: '#c03030', alone: '#9040c0', rear: '#707070',
  },
  ENEMY_STATUS_LABELS: {
    active: 'Fighting', major_wound: 'Grievously Wounded', dead: 'Slain',
    captured: 'Captured', fled: 'Fled',
  },
  PASSION_RESULT_LABELS: {
    inspired: 'Inspired', impassioned: 'Impassioned', failed: 'Failed', fumbled: 'Fumbled',
  },

  _addKillOpenFor: null,

  _renderPlayerView(panel) {
    const b = this._battle;
    const me = window.__USER__?.username;
    const mine = (b.participants || []).filter(p => p.controlledBy === me);
    const cmdr = (b.participants || []).find(p => p.participantId === b.conroiCommanderId);
    const iAmCommander = !!(cmdr && cmdr.controlledBy === me);
    const sizeLabel = (this.SIZES.find(s => s.value === b.size) || {}).label || b.size;
    const fc = b.friendlyCommander || {};
    const ec = b.enemyCommander || {};

    panel.innerHTML = `
      <div class="battle-player">
        <div class="bp-header">
          <h2 class="bp-title">⚔ ${esc(b.name)}</h2>
          <div class="bp-subtitle">${b.location ? esc(b.location) + ' · ' : ''}${esc(sizeLabel)} · Round ${b.currentRound} / ${b.maxRounds}</div>
        </div>
        ${this._bpFieldCard(b)}
        ${this._bpMoraleCard(b, cmdr, iAmCommander)}
        ${mine.map(p => this._bpKnightCard(b, p)).join('')}
        ${mine.length === 0 ? `<div class="bp-card"><p class="bp-empty-note">You have no knight in this battle. Watch the field below.</p></div>` : ''}
        ${this._bpConroiCard(b)}
        ${this._bpFoesCard(b)}
        ${this._bpRoundLogCard(b)}
        <div class="bp-commanders">${esc(fc.name || '—')} <span class="bp-vs">vs</span> ${esc(ec.name || '—')}</div>
      </div>`;
  },

  _bpFieldCard(b) {
    const enc = b.encounter || {};
    const foe = enc.foeId ? (b.foes || []).find(f => f.foeId === enc.foeId) : null;
    const facing = enc.retired
      ? '<span class="bp-facing bp-facing-rear">Retired to the Rear</span>'
      : (foe ? `<span class="bp-facing">Facing: <strong>${esc(foe.type)}</strong></span>` : '');
    if (!enc.text && !facing) return '';
    return `
      <div class="bp-card">
        <div class="bp-card-title">The Field</div>
        ${enc.text ? `<p class="bp-field-text">${esc(enc.text)}</p>` : ''}
        ${facing}
      </div>`;
  },

  _bpMoraleCard(b, cmdr, iAmCommander) {
    const m = b.morale || { current: 0, starting: 0 };
    const pct = m.starting > 0 ? Math.min(100, Math.round((m.current / m.starting) * 100)) : (m.current > 0 ? 100 : 0);
    const btns = iAmCommander ? `
      <div class="bp-morale-btns">
        <button onclick="TabBattle._myMorale(-5)" title="-5">−5</button>
        <button onclick="TabBattle._myMorale(-1)" title="-1">−1</button>
        <button onclick="TabBattle._myMorale(1)" title="+1">+1</button>
        <button onclick="TabBattle._myMorale(5)" title="+5">+5</button>
      </div>` : '';
    return `
      <div class="bp-card">
        <div class="bp-card-title">Conroi Morale</div>
        <div class="bp-morale-row">
          <div class="bc-morale-track"><div class="bc-morale-fill" style="width:${pct}%"></div></div>
          <span class="bp-morale-num">${m.current} / ${m.starting}</span>
          ${btns}
        </div>
        ${cmdr ? `<div class="bp-cmdr-line">Commander: <strong>${esc(cmdr.name)}</strong>${iAmCommander ? ' (you — adjust as the GM calls it)' : ''}</div>` : ''}
      </div>`;
  },

  _bpKnightCard(b, p) {
    const st = this.PLAYER_STATUS_LABELS[p.status] || p.status;
    const stCol = this.PLAYER_STATUS_COLOURS[p.status] || '#707070';
    const posture = p.posture ? p.posture.charAt(0).toUpperCase() + p.posture.slice(1) : '—';
    const passion = p.passion
      ? `<div class="bp-passion">✦ ${esc(p.passion.name)} — ${esc(this.PASSION_RESULT_LABELS[p.passion.result] || p.passion.result)}</div>`
      : '';
    const isCmdr = p.participantId === b.conroiCommanderId;

    const opponents = (p.enemies || []).map(e => {
      const est = this.ENEMY_STATUS_LABELS[e.status] || e.status;
      const down = e.status !== 'active';
      return `<div class="bp-opp ${down ? 'bp-opp-down' : ''}">
        <span class="bp-opp-name">${esc(e.label || e.type)}</span>
        <span class="bp-opp-weapon">${esc(e.weapon || '')}</span>
        <span class="bp-opp-status">${esc(est)}</span>
      </div>`;
    }).join('');

    const ledger = p.killLedger || [];
    const totalGlory = ledger.reduce((s, k) => s + (Number(k.glory) || 0), 0);
    const totalKv = ledger.reduce((s, k) => s + (Number(k.kv) || 0), 0);
    const killRows = ledger.map(k => `
      <div class="bp-kill-row">
        <span>${esc(k.type)} <span class="bp-kill-round">(Rd ${k.round})</span></span>
        <span class="bp-kill-glory">${Number(k.glory) || 0} gl${k.enemyId ? '' : `
          <button class="bp-kill-undo" title="Remove this kill"
            onclick="TabBattle._myUndoKill('${p.participantId}','${k.killId}')">✕</button>`}</span>
      </div>`).join('');

    const panelOpen = this._addKillOpenFor === p.participantId;
    const foeBtns = (b.foes || []).map(f =>
      `<button class="bp-foe-btn" onclick="TabBattle._myAddKill('${p.participantId}','${f.foeId}')">${esc(f.type)}</button>`
    ).join('');
    const addKillPanel = panelOpen ? `
      <div class="bp-addkill-panel">
        <div class="bp-addkill-hint">Tap the foe you felled:</div>
        <div class="bp-foe-btn-wrap">${foeBtns}</div>
        <div class="bp-addkill-custom">
          <input type="text" class="edit-input bp-custom-input" id="bp-custom-${esc(p.participantId)}"
            placeholder="Other… (GM sets glory later)" maxlength="60">
          <button class="btn btn-ghost bp-custom-add" onclick="TabBattle._myAddCustomKill('${p.participantId}')">Add</button>
        </div>
      </div>` : '';

    return `
      <div class="bp-card bp-knight">
        <div class="bp-knight-head">
          <span class="bp-knight-name">⚜ ${esc(p.name)}${isCmdr ? ' <span class="bp-cmd-flag">[cmd]</span>' : ''}</span>
          <span class="bp-status" style="background:${stCol}18;color:${stCol};">${esc(st)}</span>
        </div>
        <div class="bp-knight-meta">Posture: <strong>${esc(posture)}</strong></div>
        ${passion}
        ${opponents ? `<div class="bp-sub">Opponents</div>${opponents}` : ''}
        <div class="bp-kills-head">
          <span class="bp-sub" style="margin:0">Kill Tally</span>
          <button class="btn btn-primary bp-addkill-btn" onclick="TabBattle._toggleAddKill('${p.participantId}')">${panelOpen ? 'Close' : '+ Add Kill'}</button>
        </div>
        ${addKillPanel}
        ${killRows || '<div class="bp-kill-row bp-kill-none">No kills yet this battle.</div>'}
        ${ledger.length ? `<div class="bp-kill-total">Total: ${totalGlory} Glory · ${totalKv.toFixed(2)} KV</div>` : ''}
      </div>`;
  },

  _bpConroiCard(b) {
    const sorted = [...(b.participants || [])].sort((a, b_) => {
      if (a.isPK !== b_.isPK) return a.isPK ? -1 : 1;
      return a.name.localeCompare(b_.name);
    });
    const rows = sorted.map(p => {
      const st = this.PLAYER_STATUS_LABELS[p.status] || p.status;
      const stCol = this.PLAYER_STATUS_COLOURS[p.status] || '#707070';
      const posture = p.posture ? p.posture.charAt(0).toUpperCase() + p.posture.slice(1) : '—';
      const passion = p.passion ? `✦ ${esc(p.passion.name)}` : '';
      const isCmdr = p.participantId === b.conroiCommanderId;
      return `
        <div class="bp-conroi-row">
          <span class="bp-conroi-name">${p.isPK ? '⚜ ' : ''}${esc(p.name)}${isCmdr ? ' <span class="bp-cmd-flag">[cmd]</span>' : ''}</span>
          <span class="bp-conroi-posture">${esc(posture)}</span>
          <span class="bp-conroi-passion">${passion}</span>
          <span class="bp-status" style="background:${stCol}18;color:${stCol};">${esc(st)}</span>
        </div>`;
    }).join('');
    return `
      <div class="bp-card">
        <div class="bp-card-title">The Conroi</div>
        ${rows}
      </div>`;
  },

  _bpFoesCard(b) {
    const foes = b.foes || [];
    if (!foes.length) return '';
    return `
      <div class="bp-card">
        <div class="bp-card-title">Possible Foes</div>
        <div class="bp-foe-chips">${foes.map(f => `<span class="bp-foe-chip">${esc(f.type)}</span>`).join('')}</div>
      </div>`;
  },

  _bpRoundLogCard(b) {
    const rounds = b.rounds || [];
    if (!rounds.length) return '';
    const rows = [...rounds].reverse().map(r => {
      const mor = r.morale || {};
      return `
        <div class="bp-log-row">
          <span class="bp-log-round">Rd ${r.round}</span>
          <span class="bp-log-enc">${esc(r.encounter || '—')}</span>
          <span class="bp-log-morale">${mor.start ?? '—'} → ${mor.end ?? '—'}</span>
        </div>`;
    }).join('');
    return `
      <div class="bp-card">
        <div class="bp-card-title bp-log-toggle" onclick="TabBattle._togglePlayerLog()">
          Round Log <span class="bp-log-caret">${this._roundLogOpen ? '▾' : '▸'}</span>
        </div>
        ${this._roundLogOpen ? rows : ''}
      </div>`;
  },

  _togglePlayerLog() {
    this._roundLogOpen = !this._roundLogOpen;
    const panel = document.getElementById('tab-battle');
    if (panel && panel.querySelector('.battle-player')) this._renderPlayerView(panel);
  },

  _toggleAddKill(pid) {
    this._addKillOpenFor = this._addKillOpenFor === pid ? null : pid;
    const panel = document.getElementById('tab-battle');
    if (panel && panel.querySelector('.battle-player')) this._renderPlayerView(panel);
  },

  async _myAddKill(pid, foeId) {
    const res = await API.post('/api/battle/my-kill', { participantId: pid, foeId });
    if (!res.ok) { Toast.show(res.error || 'Failed to record kill', 'error'); return; }
    this._applyMyLedger(pid, res.data.killLedger);
    Toast.show('Kill recorded — ' + (res.data.kill?.type || ''), 'success');
  },

  async _myAddCustomKill(pid) {
    const input = document.getElementById('bp-custom-' + pid);
    const custom = (input?.value || '').trim();
    if (!custom) { Toast.show('Name the foe first', 'error'); return; }
    const res = await API.post('/api/battle/my-kill', { participantId: pid, custom });
    if (!res.ok) { Toast.show(res.error || 'Failed to record kill', 'error'); return; }
    this._applyMyLedger(pid, res.data.killLedger);
    Toast.show('Kill recorded — GM will set glory', 'success');
  },

  async _myUndoKill(pid, killId) {
    const res = await API.post('/api/battle/my-kill', { participantId: pid, removeKillId: killId });
    if (!res.ok) { Toast.show(res.error || 'Failed to remove kill', 'error'); return; }
    this._applyMyLedger(pid, res.data.killLedger);
    Toast.show('Kill removed', 'success');
  },

  _applyMyLedger(pid, ledger) {
    const p = (this._battle.participants || []).find(x => x.participantId === pid);
    if (p && ledger) p.killLedger = ledger;
    const panel = document.getElementById('tab-battle');
    if (panel && panel.querySelector('.battle-player')) this._renderPlayerView(panel);
  },

  async _myMorale(delta) {
    const res = await API.post('/api/battle/my-morale', { delta });
    if (!res.ok) { Toast.show(res.error || 'Failed to adjust morale', 'error'); return; }
    this._battle.morale = res.data.morale;
    const panel = document.getElementById('tab-battle');
    if (panel && panel.querySelector('.battle-player')) this._renderPlayerView(panel);
  },

  /* ── Player polling (3s while on the battle tab) ────────────── */

  _playerPollTimer: null,
  _renderedState: null,

  _startPlayerPoll() {
    if (this._playerPollTimer) return;
    this._playerPollTimer = setInterval(() => this._playerPollTick(), 3000);
  },

  async _playerPollTick() {
    if (isGM() || document.hidden) return;
    if (typeof APP === 'undefined' || APP._currentTab !== 'battle') return;
    const ae = document.activeElement;
    if (ae && ae.classList && ae.classList.contains('bp-custom-input')) return;
    try {
      const res = await API.get('/api/battle/state');
      if (!res.ok) return;
      const nb = res.data.battle;
      const nstate = nb ? nb.state : 'empty';
      if (nstate !== this._renderedState) { await this.render(); return; }
      if (nstate !== 'active') return;
      if (JSON.stringify(nb) === JSON.stringify(this._battle)) return;
      this._battle = nb;
      const panel = document.getElementById('tab-battle');
      if (panel && panel.querySelector('.battle-player')) this._renderPlayerView(panel);
    } catch (e) { /* silent */ }
  },

  _renderBattleConsole(panel) {
    const b = this._battle;
    panel.innerHTML = `
      <div class="battle-console">
        ${this._renderBattleHeader()}
        <div class="battle-console-grid">
          <div class="battle-console-main">
            ${this._renderMoraleBar()}
            ${this._renderEncounterCard()}
            ${this._renderParticipantCards()}
            ${this._renderRoundNotes()}
          </div>
          <div class="battle-console-sidebar">
            ${this._renderStepsProcedure()}
            ${this._renderFoesReference()}
            ${this._renderRoundLog()}
            ${this._renderKillsSummary()}
            ${this._renderRoundControls()}
          </div>
        </div>
      </div>`;
  },

  _renderBattleHeader() {
    const b = this._battle;
    const fc = b.friendlyCommander || {};
    const ec = b.enemyCommander || {};
    return `
      <div class="battle-header-bar">
        <h2 class="battle-header-name">${esc(b.name)}</h2>
        <span class="battle-header-round">Round ${b.currentRound} / ${b.maxRounds}</span>
        <span class="battle-header-cmdr">${esc(fc.name || '—')} vs ${esc(ec.name || '—')}</span>
      </div>`;
  },

  _renderMoraleBar() {
    const m = this._battle.morale;
    const pct = m.starting > 0 ? Math.min(100, Math.round((m.current / m.starting) * 100)) : (m.current > 0 ? 100 : 0);
    return `
      <div class="bc-morale-wrap">
        <span class="bc-morale-label">Morale</span>
        <div class="bc-morale-btns">
          <button onclick="TabBattle._adjustMorale(-5)" title="-5">−5</button>
          <button onclick="TabBattle._adjustMorale(-1)" title="-1">−1</button>
        </div>
        <div class="bc-morale-track">
          <div class="bc-morale-fill" style="width:${pct}%"></div>
        </div>
        <input type="number" class="bc-morale-input" value="${m.current}"
          onchange="TabBattle._saveMoraleField('current', +this.value)" title="Current morale">
        <span class="bc-morale-sep">/</span>
        <input type="number" class="bc-morale-input" value="${m.starting}"
          onchange="TabBattle._saveMoraleField('starting', +this.value)" title="Starting morale (max)">
        <div class="bc-morale-btns">
          <button onclick="TabBattle._adjustMorale(1)" title="+1">+1</button>
          <button onclick="TabBattle._adjustMorale(5)" title="+5">+5</button>
        </div>
      </div>`;
  },

  async _adjustMorale(delta) {
    const res = await API.post('/api/battle/morale', { delta });
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    this._battle.morale = res.data.morale;
    const wrap = document.querySelector('.bc-morale-wrap');
    if (wrap) wrap.outerHTML = this._renderMoraleBar();
  },

  async _saveMoraleField(field, value) {
    const res = await API.post('/api/battle/morale', { [field]: value });
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    this._battle.morale = res.data.morale;
    const wrap = document.querySelector('.bc-morale-wrap');
    if (wrap) wrap.outerHTML = this._renderMoraleBar();
  },

  _renderEncounterCard() {
    const enc = this._battle.encounter || {};
    const foeOpts = this._battle.foes.map(f =>
      `<option value="${esc(f.foeId)}" ${enc.foeId === f.foeId ? 'selected' : ''}>${esc(f.type)}</option>`
    ).join('');
    return `
      <div class="bc-encounter">
        <div class="bc-encounter-row">
          <label class="bs-label" style="margin:0">Encounter</label>
          <select class="edit-input edit-select bc-pk-select" id="bc-enc-foe" style="flex:1;max-width:220px"
            onchange="TabBattle._saveEncounter()" ${enc.retired ? 'disabled' : ''}>
            <option value="">— Select foe type —</option>
            ${foeOpts}
          </select>
          <label class="bc-retired-label">
            <input type="checkbox" id="bc-enc-retired" ${enc.retired ? 'checked' : ''}
              onchange="TabBattle._saveEncounter()"> Retired to Rear
          </label>
        </div>
        <div class="bc-encounter-row">
          <textarea class="edit-input edit-textarea" id="bc-enc-text" rows="2"
            placeholder="Describe the encounter…" style="flex:1"
            onchange="TabBattle._saveEncounter()">${esc(enc.text || '')}</textarea>
        </div>
      </div>`;
  },

  async _saveEncounter() {
    const foeSel = document.getElementById('bc-enc-foe');
    const retired = document.getElementById('bc-enc-retired');
    const text = document.getElementById('bc-enc-text');
    const body = {
      foeId: foeSel?.value || null,
      retired: retired?.checked || false,
      text: text?.value || '',
    };
    if (body.retired && foeSel) { foeSel.disabled = true; foeSel.value = ''; body.foeId = null; }
    else if (foeSel) { foeSel.disabled = false; }
    const res = await API.patch('/api/battle/encounter', body);
    if (res.ok) this._battle.encounter = res.data.encounter;
  },

  _renderParticipantCards() {
    return `
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:8px">
        <button class="btn btn-sm btn-verdigris" onclick="TabBattle._showAddParticipant()">+ Add Participant</button>
        <button class="btn btn-sm btn-crimson" onclick="TabBattle._showBulkAssign()">Assign Foes to All</button>
      </div>
      ${this._battle.participants.map(p => this._renderPKCard(p)).join('')}`;
  },

  _renderPKCard(p) {
    const b = this._battle;
    const expanded = this._expandedPKs.has(p.participantId);
    const totalGlory = p.killLedger.reduce((s, k) => s + (k.glory || 0), 0);
    const totalKV = p.killLedger.reduce((s, k) => s + (k.kv || 0), 0);
    const kvDisplay = totalKV % 1 === 0 ? totalKV : totalKV.toFixed(2);

    const statusOpts = ['active','major_wound','unconscious','dead','alone','rear'].map(s =>
      `<option value="${s}" ${p.status === s ? 'selected' : ''}>${s.replace('_', ' ')}</option>`
    ).join('');
    const postureOpts = ['','valorous','reckless','prudent','cowardly'].map(v =>
      `<option value="${v}" ${(p.posture || '') === v ? 'selected' : ''}>${v || '— posture —'}</option>`
    ).join('');

    const incapStatuses = { major_wound: 'MW', unconscious: 'KO', dead: 'DEAD', rear: 'REAR', alone: 'ALONE' };
    const statusFlag = incapStatuses[p.status] ? `<span class="bc-status-flag bc-status-${p.status}">${incapStatuses[p.status]}</span>` : '';

    const passionHtml = p.passion
      ? `<span class="bc-passion-badge" title="${esc(p.passion.name)}">${esc(p.passion.result)} (Rd${p.passion.round})</span>`
      : `<button class="btn-icon" onclick="TabBattle._showInvokePassion('${esc(p.participantId)}')" title="Invoke Passion" style="font-size:0.7rem">+P</button>`;

    const activeEnemies = (p.enemies || []).filter(e => e.status === 'active' || e.status === 'major_wound');
    const downedEnemies = (p.enemies || []).filter(e => e.status !== 'active' && e.status !== 'major_wound');

    let body = '';
    if (expanded) {
      body = `
        <div class="bc-pk-body">
          <div class="bc-pk-actions">
            <button class="btn btn-sm btn-crimson" onclick="TabBattle._showAddEnemy('${esc(p.participantId)}')">+ Add Foe</button>
          </div>
          ${activeEnemies.length ? `<div class="bc-enemies-title">Fighting</div>` : ''}
          ${activeEnemies.map(e => this._renderEnemyRow(e, p.participantId)).join('')}
          ${downedEnemies.length ? this._renderDownedEnemies(downedEnemies) : ''}
          ${p.killLedger.length ? this._renderKillLedger(p.killLedger) : ''}
        </div>`;
    }

    return `
      <div class="bc-pk-card ${expanded ? 'expanded' : ''}" data-pid="${esc(p.participantId)}"
        ondragover="TabBattle._onPKDragOver(event)"
        ondragleave="TabBattle._onPKDragLeave(event)"
        ondrop="TabBattle._onPKDrop(event, '${esc(p.participantId)}')">
        <div class="bc-pk-header" role="button" tabindex="0" onclick="TabBattle._togglePK('${esc(p.participantId)}')">
          <span class="bc-pk-name">
            ${esc(p.name)}
            ${p.isPK ? '<span class="bs-pk-badge">PK</span>' : '<span class="bs-npc-badge">NPC</span>'}
            ${b.conroiCommanderId === p.participantId ? '<span class="bs-cmd-badge">CMD</span>' : ''}
            ${statusFlag}
          </span>
          <select class="bc-pk-select" onclick="event.stopPropagation()"
            onchange="TabBattle._setParticipantStatus('${esc(p.participantId)}', this.value)">${statusOpts}</select>
          <select class="bc-pk-select" onclick="event.stopPropagation()"
            onchange="TabBattle._setParticipantPosture('${esc(p.participantId)}', this.value)">${postureOpts}</select>
          ${passionHtml}
          <span class="bc-pk-totals">${totalGlory}gl · ${kvDisplay}KV</span>
          <span class="bc-pk-arrow">▶</span>
        </div>
        ${body}
      </div>`;
  },

  _togglePK(pid) {
    if (this._expandedPKs.has(pid)) this._expandedPKs.delete(pid);
    else this._expandedPKs.add(pid);
    const panel = document.getElementById('tab-battle');
    if (panel) this._renderBattleConsole(panel);
  },

  async _setParticipantStatus(pid, status) {
    const res = await API.patch('/api/battle/participant/' + pid + '/status', { status });
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    const p = this._battle.participants.find(x => x.participantId === pid);
    if (p) p.status = status;
    const panel = document.getElementById('tab-battle');
    if (panel) this._renderBattleConsole(panel);
  },

  async _setParticipantPosture(pid, posture) {
    const res = await API.patch('/api/battle/participant/' + pid + '/posture', { posture: posture || null });
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    const p = this._battle.participants.find(x => x.participantId === pid);
    if (p) p.posture = posture || null;
  },

  _showInvokePassion(pid) {
    Modal.open(`
      <div style="min-width:320px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Invoke Passion</div>
        <div class="bs-row">
          <label class="bs-label">Passion Name</label>
          <input class="edit-input" id="bc-passion-name" placeholder="e.g. Loyalty (Friends)">
        </div>
        <div class="bs-row" style="margin-top:8px">
          <label class="bs-label">Result</label>
          <select class="edit-input edit-select" id="bc-passion-result">
            <option value="inspired">Inspired (success)</option>
            <option value="impassioned">Impassioned (critical)</option>
            <option value="failed">Failed</option>
            <option value="fumbled">Fumbled (despondent)</option>
          </select>
        </div>
        <div class="btn-row" style="margin-top:14px;">
          <button class="btn btn-primary" onclick="TabBattle._doInvokePassion('${esc(pid)}')">Invoke</button>
          <button class="btn btn-muted" onclick="Modal.close()">Cancel</button>
        </div>
      </div>
    `);
  },

  async _doInvokePassion(pid) {
    const name = document.getElementById('bc-passion-name')?.value?.trim();
    const result = document.getElementById('bc-passion-result')?.value;
    if (!name) { Toast.show('Enter passion name', 'error'); return; }
    const res = await API.post('/api/battle/participant/' + pid + '/passion', { name, result });
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    const p = this._battle.participants.find(x => x.participantId === pid);
    if (p) p.passion = res.data.participant.passion;
    Modal.close();
    const panel = document.getElementById('tab-battle');
    if (panel) this._renderBattleConsole(panel);
  },

  _renderEnemyRow(e, pid) {
    const pct = e.maxHp > 0 ? Math.round((e.hp / e.maxHp) * 100) : 0;
    const hpColor = pct > 50 ? 'var(--verdigris)' : pct > 25 ? 'var(--gold)' : 'var(--crimson-mid)';
    const mwFlag = e.status === 'major_wound' ? '<span class="bc-mw-flag">MW</span>' : '';
    return `
      <div class="bc-enemy-row" draggable="true"
        ondragstart="TabBattle._onEnemyDragStart(event, '${esc(e.enemyId)}', '${esc(pid)}')">
        <span class="bc-enemy-label">${esc(e.label || e.type)} ${mwFlag}</span>
        <span class="bc-enemy-weapon">${esc(e.weapon)}</span>
        <div class="bc-enemy-hp">
          <div class="bc-hp-track"><div class="bc-hp-fill" style="width:${pct}%;background:${hpColor}"></div></div>
          <input type="number" class="bc-hp-input" value="${e.hp}" title="Current HP"
            onchange="TabBattle._setEnemyHP('${esc(e.enemyId)}', +this.value)">
          <span class="bc-hp-sep">/ ${e.maxHp}</span>
          <input type="number" class="bc-hp-adj" placeholder="±" title="Type damage (negative) or healing"
            onchange="TabBattle._adjustEnemyHP('${esc(e.enemyId)}', +this.value); this.value=''">
        </div>
        <div class="bc-enemy-actions">
          ${e.status === 'major_wound'
            ? `<button class="bc-action-btn undo" onclick="TabBattle._undoEnemy('${esc(e.enemyId)}')" title="Remove Major Wound">↩</button>`
            : `<button class="bc-action-btn mw" onclick="TabBattle._setEnemyStatus('${esc(e.enemyId)}', 'major_wound')" title="Major Wound">MW</button>`}
          <button class="bc-action-btn" onclick="TabBattle._setEnemyStatus('${esc(e.enemyId)}', 'dead')" title="Dead">Dead</button>
          <button class="bc-action-btn" onclick="TabBattle._setEnemyStatus('${esc(e.enemyId)}', 'captured')" title="Captured">Cap</button>
          <button class="bc-action-btn" onclick="TabBattle._setEnemyStatus('${esc(e.enemyId)}', 'fled')" title="Fled">Fled</button>
          <button class="bc-action-btn reassign" onclick="event.stopPropagation(); TabBattle._showReassignEnemy('${esc(e.enemyId)}', '${esc(pid)}')" title="Reassign to another PK">⇄</button>
        </div>
      </div>`;
  },

  _renderDownedEnemies(enemies) {
    const items = enemies.map(e => {
      const statusClass = e.status === 'dead' ? 'dead' : e.status === 'captured' ? 'captured' : 'fled';
      return `
        <div class="bc-downed-item">
          <span>${esc(e.label || e.type)}</span>
          <span class="bc-downed-status ${statusClass}">${e.status}</span>
          <button class="btn-icon" onclick="TabBattle._undoEnemy('${esc(e.enemyId)}')" title="Undo" style="font-size:0.7rem;margin-left:auto">↩</button>
        </div>`;
    }).join('');
    return `<div class="bc-downed"><div class="bc-enemies-title">Downed</div>${items}</div>`;
  },

  _renderKillLedger(ledger) {
    const entries = ledger.map(k => `
      <div class="bc-kill-entry">
        <span class="bc-kill-type">${esc(k.type)}</span>
        <span class="bc-kill-glory">${k.glory}gl</span>
        <span class="bc-kill-round">Rd${k.round}</span>
      </div>`
    ).join('');
    const totalGlory = ledger.reduce((s, k) => s + (k.glory || 0), 0);
    return `
      <div class="bc-kill-section">
        <div class="bc-enemies-title">Kill Ledger (${totalGlory} Glory)</div>
        ${entries}
      </div>`;
  },

  async _adjustEnemyHP(eid, delta) {
    if (!delta) return;
    const res = await API.patch('/api/battle/enemy/' + eid + '/hp', { delta });
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    this._updateLocalEnemyHP(eid, res.data.enemy.hp);
  },

  async _setEnemyHP(eid, hp) {
    const res = await API.patch('/api/battle/enemy/' + eid + '/hp', { hp });
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    this._updateLocalEnemyHP(eid, res.data.enemy.hp);
  },

  _updateLocalEnemyHP(eid, hp) {
    for (const p of this._battle.participants) {
      const e = (p.enemies || []).find(x => x.enemyId === eid);
      if (e) { e.hp = hp; break; }
    }
    const panel = document.getElementById('tab-battle');
    if (panel) this._renderBattleConsole(panel);
  },

  async _setEnemyStatus(eid, status) {
    const res = await API.post('/api/battle/enemy/' + eid + '/status', { status });
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    for (const p of this._battle.participants) {
      const e = (p.enemies || []).find(x => x.enemyId === eid);
      if (e) {
        e.status = res.data.enemy.status;
        if (res.data.kill) p.killLedger.push(res.data.kill);
        break;
      }
    }
    const panel = document.getElementById('tab-battle');
    if (panel) this._renderBattleConsole(panel);
  },

  async _undoEnemy(eid) {
    const res = await API.post('/api/battle/enemy/' + eid + '/undo');
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    for (const p of this._battle.participants) {
      const idx = (p.enemies || []).findIndex(x => x.enemyId === eid);
      if (idx !== -1) {
        p.enemies[idx].status = 'active';
        const killIdx = (p.killLedger || []).findIndex(k => k.enemyId === eid);
        if (killIdx !== -1) p.killLedger.splice(killIdx, 1);
        break;
      }
    }
    const panel = document.getElementById('tab-battle');
    if (panel) this._renderBattleConsole(panel);
  },

  _showAddEnemy(pid, override) {
    const p = this._battle.participants.find(x => x.participantId === pid);
    const blocked = ['major_wound', 'unconscious', 'dead', 'rear'];
    if (p && blocked.includes(p.status) && !override) {
      Modal.open(`
        <div style="min-width:320px">
          <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Knight Unavailable</div>
          <p style="margin-bottom:14px">${esc(p.name)} ${p.status === 'major_wound' ? 'has a <strong>major wound</strong>' : p.status === 'rear' ? 'is in the <strong>rear</strong>' : p.status === 'alone' ? 'is <strong>separated from the conroi</strong>' : 'is <strong>' + p.status.replace('_', ' ') + '</strong>'} and cannot fight.</p>
          <div class="btn-row">
            <button class="btn btn-crimson" onclick="Modal.close(); TabBattle._showAddEnemy('${esc(pid)}', true)">Override</button>
            <button class="btn btn-muted" onclick="Modal.close()">Cancel</button>
          </div>
        </div>`);
      return;
    }
    const foeOpts = this._battle.foes.map(f =>
      `<option value="${esc(f.foeId)}">${esc(f.type)}</option>`
    ).join('');
    Modal.open(`
      <div style="min-width:380px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Assign Enemy</div>
        <div class="bs-row">
          <label class="bs-label">From Foes Table</label>
          <select class="edit-input edit-select" id="bc-ae-foe" onchange="TabBattle._onAddEnemyFoeChange()">
            <option value="">— Custom —</option>
            ${foeOpts}
          </select>
        </div>
        <div class="bs-row-pair">
          <div class="bs-row">
            <label class="bs-label">Label</label>
            <input class="edit-input" id="bc-ae-label" placeholder="e.g. Heorthgeneat #1">
          </div>
          <div class="bs-row">
            <label class="bs-label">Type</label>
            <input class="edit-input" id="bc-ae-type" placeholder="Foe type">
          </div>
        </div>
        <div class="bs-row-pair">
          <div class="bs-row">
            <label class="bs-label">HP</label>
            <input class="edit-input" id="bc-ae-hp" type="number">
          </div>
          <div class="bs-row">
            <label class="bs-label">Weapon</label>
            <input class="edit-input" id="bc-ae-weapon">
          </div>
        </div>
        <div class="bs-row-pair">
          <div class="bs-row">
            <label class="bs-label">KV</label>
            <input class="edit-input" id="bc-ae-kv" type="number" step="0.0625">
          </div>
          <div class="bs-row">
            <label class="bs-label">Glory</label>
            <input class="edit-input" id="bc-ae-glory" type="number">
          </div>
        </div>
        <div class="btn-row" style="margin-top:14px;">
          <button class="btn btn-primary" onclick="TabBattle._doAddEnemy('${esc(pid)}')">Assign</button>
          <button class="btn btn-muted" onclick="Modal.close()">Cancel</button>
        </div>
      </div>
    `);
  },

  _onAddEnemyFoeChange() {
    const sel = document.getElementById('bc-ae-foe');
    if (!sel || !sel.value) return;
    const foe = this._battle.foes.find(f => f.foeId === sel.value);
    if (!foe) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('bc-ae-type', foe.type);
    set('bc-ae-hp', foe.hp);
    set('bc-ae-weapon', foe.weapon);
    set('bc-ae-kv', foe.kv);
    set('bc-ae-glory', foe.glory);
    const existing = this._battle.participants.flatMap(p =>
      (p.enemies || []).filter(e => e.foeId === foe.foeId)
    );
    set('bc-ae-label', foe.type + ' #' + (existing.length + 1));
  },

  async _doAddEnemy(pid) {
    const v = id => document.getElementById(id)?.value || '';
    const foeId = v('bc-ae-foe') || null;
    const label = v('bc-ae-label').trim();
    const type = v('bc-ae-type').trim();
    if (!type) { Toast.show('Enter a foe type', 'error'); return; }
    const hp = +v('bc-ae-hp') || 0;
    const res = await API.post('/api/battle/participant/' + pid + '/enemy', {
      foeId,
      label: label || type,
      type,
      weapon: v('bc-ae-weapon'),
      hp,
      maxHp: hp,
      kv: +v('bc-ae-kv') || 0,
      glory: +v('bc-ae-glory') || 0,
    });
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    const p = this._battle.participants.find(x => x.participantId === pid);
    if (p) p.enemies.push(res.data.enemy);
    Modal.close();
    const panel = document.getElementById('tab-battle');
    if (panel) this._renderBattleConsole(panel);
  },

  _showBulkAssign() {
    const foeOpts = this._battle.foes.map(f =>
      `<option value="${esc(f.foeId)}">${esc(f.type)}</option>`
    ).join('');
    const blocked = ['major_wound', 'unconscious', 'dead', 'rear'];
    const pkRows = this._battle.participants.map(p => {
      const disabled = blocked.includes(p.status);
      const statusLabel = disabled ? ` (${p.status.replace('_', ' ')})` : '';
      return `
        <label class="bc-bulk-row ${disabled ? 'disabled' : ''}">
          <input type="checkbox" value="${esc(p.participantId)}" ${disabled ? '' : 'checked'}>
          <span>${esc(p.name)}${statusLabel}</span>
        </label>`;
    }).join('');
    Modal.open(`
      <div style="min-width:400px">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Assign Foes to Knights</div>
        <div class="bs-row">
          <label class="bs-label">Foe Type</label>
          <select class="edit-input edit-select" id="bc-ba-foe">
            ${foeOpts}
          </select>
        </div>
        <div class="bs-row">
          <label class="bs-label">Per Knight</label>
          <div style="display:flex;gap:6px;align-items:center">
            ${[1,2,3,4,5].map(n => `<button class="btn btn-sm ${n === 1 ? 'btn-primary' : 'btn-muted'}" onclick="document.getElementById('bc-ba-count').value=${n}; this.parentNode.querySelectorAll('.btn').forEach(b=>b.className='btn btn-sm btn-muted'); this.className='btn btn-sm btn-primary'">${n}</button>`).join('')}
            <input type="number" class="edit-input" id="bc-ba-count" value="1" min="1" style="width:50px;text-align:center">
          </div>
        </div>
        <div class="bs-row">
          <label class="bs-label">Knights</label>
          <div id="bc-ba-pks" style="max-height:180px;overflow-y:auto">${pkRows}</div>
        </div>
        <div class="btn-row" style="margin-top:14px">
          <button class="btn btn-primary" onclick="TabBattle._doBulkAssign()">Assign</button>
          <button class="btn btn-muted" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`);
  },

  async _doBulkAssign() {
    const foeId = document.getElementById('bc-ba-foe')?.value;
    const count = Math.max(1, +document.getElementById('bc-ba-count')?.value || 1);
    const foe = this._battle.foes.find(f => f.foeId === foeId);
    if (!foe) { Toast.show('Select a foe type', 'error'); return; }
    const checks = document.querySelectorAll('#bc-ba-pks input[type=checkbox]:checked');
    const pids = Array.from(checks).map(c => c.value);
    if (!pids.length) { Toast.show('Select at least one knight', 'error'); return; }

    const btn = document.querySelector('#bc-ba-pks .btn-primary');
    if (btn) btn.disabled = true;
    let assigned = 0;
    for (const pid of pids) {
      for (let i = 0; i < count; i++) {
        const existing = this._battle.participants.flatMap(p =>
          (p.enemies || []).filter(e => e.foeId === foe.foeId)
        );
        const label = foe.type + ' #' + (existing.length + 1);
        const res = await API.post('/api/battle/participant/' + pid + '/enemy', {
          foeId: foe.foeId, label, type: foe.type, weapon: foe.weapon,
          hp: foe.hp, maxHp: foe.hp, kv: foe.kv, glory: foe.glory,
        });
        if (res.ok) {
          const p = this._battle.participants.find(x => x.participantId === pid);
          if (p) p.enemies.push(res.data.enemy);
          assigned++;
        }
      }
    }
    Modal.close();
    Toast.show(`Assigned ${assigned} enemies`, 'success');
    const panel = document.getElementById('tab-battle');
    if (panel) this._renderBattleConsole(panel);
  },

  _renderRoundNotes() {
    return `
      <div class="bc-encounter" style="margin-top:14px">
        <label class="bs-label">GM Round Notes</label>
        <textarea class="edit-input edit-textarea" id="bc-round-notes" rows="2"
          placeholder="Notes for this round (GM only)…"
          onchange="TabBattle._saveRoundNotes()">${esc(this._battle.roundNotes || '')}</textarea>
      </div>`;
  },

  async _saveRoundNotes() {
    const notes = document.getElementById('bc-round-notes')?.value || '';
    const res = await API.patch('/api/battle/round-notes', { notes });
    if (!res.ok) Toast.show(res.error || 'Failed to save notes', 'error');
  },

  _renderStepsProcedure() {
    const steps = [
      ['Set the Encounter', 'GM describes what the conroi faces this round'],
      ['Intensity Roll', 'Roll vs Intensity to see if PKs can choose their encounter'],
      ['Battle Roll', 'If Intensity failed, opposed Battle rolls determine encounter'],
      ['Select Encounter', 'PKs choose or GM assigns foe type from the table'],
      ['Reduce Morale', 'Apply morale loss from encounter type (if any)'],
      ['Select Posture', 'Each PK chooses Valorous/Reckless/Prudent/Cowardly'],
      ['Fight!', 'Resolve combat rounds per posture choice'],
      ['Squire Skill Roll', 'Each PK\'s squire rolls their skill'],
      ['Tally Kills & KV', 'Record kills and Knight Values earned this round'],
      ['Next Round', 'End round and advance to the next battle turn'],
    ];
    const open = this._stepsOpen;
    const body = open ? `
      <div class="bc-sidebar-body">
        <ul class="bc-step-list">
          ${steps.map((s, i) => `
            <li class="bc-step-item">
              <span class="bc-step-num">${i + 1}.</span>
              <div><div>${esc(s[0])}</div><div class="bc-step-desc">${esc(s[1])}</div></div>
            </li>`).join('')}
        </ul>
      </div>` : '';
    return `
      <div class="bc-sidebar-panel ${open ? 'open' : ''}">
        <div class="bc-sidebar-title" role="button" tabindex="0" onclick="TabBattle._togglePanel('_stepsOpen')">
          Battle Turn Steps <span class="bc-sidebar-arrow">▶</span>
        </div>
        ${body}
      </div>`;
  },

  _renderFoesReference() {
    const open = this._foesRefOpen;
    const body = open ? `
      <div class="bc-sidebar-body">
        ${this._battle.foes.map(f => `
          <div class="bc-foe-ref">
            <div class="bc-foe-ref-type">${esc(f.type)}</div>
            <div class="bc-foe-ref-stats">
              HP ${f.hp} · Armor ${esc(f.armor)} · Skill ${f.skill} · Dmg ${esc(f.damage)}
              · KV ${f.kv} · Glory ${f.glory} · Per PK: ${f.perPK}
            </div>
            <div class="bc-foe-ref-stats">
              Wpn: ${esc(f.weapon || '—')} · Morale Loss: ${esc(f.moraleLoss || '—')} · Min: ${f.moraleMin || '—'}
            </div>
            ${f.skills ? `<div class="bc-foe-ref-stats">${esc(f.skills)}</div>` : ''}
            ${f.behavior ? `<div class="bc-foe-ref-stats" style="font-style:italic">${esc(f.behavior)}</div>` : ''}
          </div>`).join('')}
        <button class="btn btn-sm btn-muted" onclick="TabBattle._showAddFoe()" style="margin-top:8px;width:100%">+ Add Foe Type</button>
      </div>` : '';
    return `
      <div class="bc-sidebar-panel ${open ? 'open' : ''}">
        <div class="bc-sidebar-title" role="button" tabindex="0" onclick="TabBattle._togglePanel('_foesRefOpen')">
          Foes Table (${this._battle.foes.length}) <span class="bc-sidebar-arrow">▶</span>
        </div>
        ${body}
      </div>`;
  },

  _renderRoundLog() {
    const b = this._battle;
    const open = this._roundLogOpen;
    const downLabels = { major_wound: 'sustained a major wound', unconscious: 'fell unconscious', dead: 'was killed', rear: 'withdrew to the rear', alone: 'was separated from the conroi' };
    const incapStatuses = ['major_wound', 'unconscious', 'dead', 'rear', 'alone'];
    const entries = b.rounds.map((r, idx) => {
      const moraleDelta = r.morale ? r.morale.end - r.morale.start : 0;
      const moraleStr = moraleDelta !== 0 ? `(${moraleDelta > 0 ? '+' : ''}${moraleDelta})` : '';
      const prevStatuses = {};
      if (idx > 0 && b.rounds[idx - 1].snapshot?.participants) {
        for (const sp of b.rounds[idx - 1].snapshot.participants) prevStatuses[sp.participantId] = sp.status;
      }
      const events = [];
      if (r.snapshot?.participants) {
        for (const sp of r.snapshot.participants) {
          const isNew = idx > 0 && !(sp.participantId in prevStatuses);
          if (isNew) { events.push(`${sp.name} has joined the fray!`); continue; }
          const prev = prevStatuses[sp.participantId] || 'active';
          if (sp.status === prev) continue;
          if (sp.status === 'active' && prev === 'alone') {
            events.push(`${sp.name} rejoined the conroi`);
          } else if (sp.status === 'active' && (prev === 'major_wound' || prev === 'unconscious')) {
            events.push(`${sp.name}, while still wounded, has rejoined the fray!`);
          } else if (sp.status === 'active' && prev === 'rear') {
            events.push(`${sp.name} returned from the rear`);
          } else if (downLabels[sp.status]) {
            events.push(`${sp.name} ${downLabels[sp.status]}`);
          }
        }
      }
      const casualtyHtml = events.length
        ? `<div class="bc-round-casualties">${events.map(c => esc(c)).join('; ')}</div>` : '';
      return `
        <div class="bc-round-entry">
          <span class="bc-round-num">Rd ${r.round}</span>
          <span class="bc-round-enc">${esc(r.encounter || '—')}</span>
          ${moraleStr ? `<span class="bc-round-morale">${moraleStr}</span>` : ''}
          ${casualtyHtml}
        </div>`;
    }).join('');
    const current = `
      <div class="bc-round-entry bc-round-current">
        <span class="bc-round-num">Rd ${b.currentRound}</span>
        <span class="bc-round-enc" style="color:var(--gold-text)">In progress…</span>
      </div>`;
    const body = open ? `<div class="bc-sidebar-body">${entries}${current}</div>` : '';
    return `
      <div class="bc-sidebar-panel ${open ? 'open' : ''}">
        <div class="bc-sidebar-title" role="button" tabindex="0" onclick="TabBattle._togglePanel('_roundLogOpen')">
          Round Log <span class="bc-sidebar-arrow">▶</span>
        </div>
        ${body}
      </div>`;
  },

  _renderKillsSummary() {
    const b = this._battle;
    const open = this._killsSummaryOpen;
    let totalGlory = 0;
    let totalKV = 0;
    const allKills = [];
    for (const p of b.participants) {
      for (const k of (p.killLedger || [])) {
        totalGlory += k.glory || 0;
        totalKV += k.kv || 0;
        allKills.push({ ...k, knight: p.name });
      }
    }
    const body = open ? `
      <div class="bc-sidebar-body">
        ${allKills.length === 0 ? '<div class="muted" style="font-size:0.8rem;padding:4px 0">No kills yet</div>' : ''}
        ${b.participants.map(p => {
          const kills = p.killLedger || [];
          if (!kills.length) return '';
          const pGlory = kills.reduce((s, k) => s + (k.glory || 0), 0);
          const pKV = kills.reduce((s, k) => s + (k.kv || 0), 0);
          return `
            <div style="margin-bottom:8px">
              <div style="font-weight:600;font-size:0.8rem;color:var(--ink)">${esc(p.name)}</div>
              ${kills.map(k => `
                <div class="bc-kill-entry">
                  <span class="bc-kill-type">${esc(k.type)}</span>
                  <span class="bc-kill-glory">${k.glory}gl</span>
                  <span class="bc-kill-round">Rd${k.round}</span>
                </div>`).join('')}
              <div style="font-size:0.7rem;color:var(--ink-mid);margin-top:2px">${pGlory} Glory · ${pKV % 1 === 0 ? pKV : pKV.toFixed(2)} KV</div>
            </div>`;
        }).join('')}
      </div>` : '';
    const kvStr = totalKV % 1 === 0 ? totalKV : totalKV.toFixed(2);
    return `
      <div class="bc-sidebar-panel ${open ? 'open' : ''}">
        <div class="bc-sidebar-title" role="button" tabindex="0" onclick="TabBattle._togglePanel('_killsSummaryOpen')">
          Kills (${totalGlory}gl · ${kvStr}KV) <span class="bc-sidebar-arrow">▶</span>
        </div>
        ${body}
      </div>`;
  },

  _renderRoundControls() {
    const b = this._battle;
    const canBack = b.rounds && b.rounds.length > 0;
    return `
      <div class="bc-round-controls">
        <button class="btn btn-sm btn-muted" onclick="TabBattle._goBackRound()" ${canBack ? '' : 'disabled'}>← Back</button>
        <button class="btn btn-sm btn-primary" onclick="TabBattle._endRound()">End Round →</button>
        <button class="btn btn-sm btn-muted" onclick="TabBattle._adjustMaxRounds(-1)" title="Remove a round">− Rd</button>
        <button class="btn btn-sm btn-muted" onclick="TabBattle._adjustMaxRounds(1)" title="Add a round">+ Rd</button>
      </div>
      <div class="bc-round-controls" style="margin-top:8px">
        <button class="btn btn-sm btn-crimson" onclick="TabBattle._endBattle()" style="flex:1">End Battle</button>
        <button class="btn btn-sm btn-muted" onclick="TabBattle._abandonBattle()" title="Discard this battle entirely">Abandon</button>
      </div>`;
  },

  _togglePanel(prop) {
    this[prop] = !this[prop];
    const panel = document.getElementById('tab-battle');
    if (panel) this._renderBattleConsole(panel);
  },

  async _endRound() {
    if (!confirm('End Round ' + this._battle.currentRound + '?')) return;
    const res = await API.post('/api/battle/round/end', { round: this._battle.currentRound });
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    this._battle = res.data.battle;
    this._expandedPKs.clear();
    Toast.show('Round ' + (this._battle.currentRound - 1) + ' complete', 'success');
    const panel = document.getElementById('tab-battle');
    if (panel) this._renderBattleConsole(panel);
  },

  async _goBackRound() {
    if (!confirm('Revert to previous round? Current round changes will be lost.')) return;
    const res = await API.post('/api/battle/round/back');
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    this._battle = res.data.battle;
    Toast.show('Reverted to Round ' + this._battle.currentRound, 'success');
    const panel = document.getElementById('tab-battle');
    if (panel) this._renderBattleConsole(panel);
  },

  async _adjustMaxRounds(delta) {
    const res = await API.patch('/api/battle/max-rounds', { delta });
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    this._battle.maxRounds = res.data.maxRounds;
    const panel = document.getElementById('tab-battle');
    if (panel) this._renderBattleConsole(panel);
  },

  async _endBattle() {
    if (!confirm('End the battle? This will move to the finalization screen.')) return;
    const res = await API.post('/api/battle/finalize');
    if (!res.ok) { Toast.show(res.error || 'Failed', 'error'); return; }
    this._battle = res.data.battle;
    Toast.show('The battle has ended', 'success');
    await this.render();
  },

  async _abandonBattle() {
    if (!confirm('Abandon this battle? All battle data will be permanently discarded.')) return;
    if (!confirm('Are you sure? This cannot be undone.')) return;
    const res = await API.del('/api/battle/abandon');
    if (!res.ok) { Toast.show(res.error || 'Failed to abandon', 'error'); return; }
    this._battle = null;
    Toast.show('Battle abandoned', 'success');
    await this.render();
  },

  _onEnemyDragStart(ev, eid, srcPid) {
    ev.dataTransfer.setData('text/plain', JSON.stringify({ eid, srcPid }));
    ev.dataTransfer.effectAllowed = 'move';
    const el = ev.currentTarget;
    el.style.opacity = '0.5';
    el.addEventListener('dragend', () => { el.style.opacity = ''; }, { once: true });
  },

  _onPKDragOver(ev) {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
    const card = ev.currentTarget;
    if (!card.classList.contains('bc-drop-target')) card.classList.add('bc-drop-target');
  },

  _onPKDragLeave(ev) {
    ev.currentTarget.classList.remove('bc-drop-target');
  },

  async _onPKDrop(ev, targetPid) {
    ev.preventDefault();
    ev.currentTarget.classList.remove('bc-drop-target');
    let payload;
    try { payload = JSON.parse(ev.dataTransfer.getData('text/plain')); } catch { return; }
    if (!payload?.eid || payload.srcPid === targetPid) return;
    await this._doReassignEnemy(payload.eid, targetPid);
  },

  _showReassignEnemy(eid, srcPid) {
    const others = this._battle.participants.filter(p => p.participantId !== srcPid);
    if (!others.length) { Toast.show('No other participants to reassign to', 'error'); return; }
    const enemy = (this._battle.participants.find(p => p.participantId === srcPid)?.enemies || []).find(e => e.enemyId === eid);
    const label = enemy ? (enemy.label || enemy.type) : 'enemy';
    const opts = others.map(p =>
      `<option value="${esc(p.participantId)}">${esc(p.name)}</option>`
    ).join('');
    Modal.open(`
      <div style="min-width:320px">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px">Reassign ${esc(label)}</div>
        <div class="bs-row">
          <label class="bs-label">Move to</label>
          <select class="edit-input edit-select" id="bc-reassign-target">${opts}</select>
        </div>
        <p class="muted" style="margin-top:8px;font-size:.8rem">Kill credit will transfer with the foe.</p>
        <div class="btn-row" style="margin-top:14px">
          <button class="btn btn-primary" onclick="TabBattle._doReassignEnemy('${esc(eid)}', document.getElementById('bc-reassign-target').value)">Reassign</button>
          <button class="btn btn-muted" onclick="Modal.close()">Cancel</button>
        </div>
      </div>
    `);
  },

  async _doReassignEnemy(eid, targetPid) {
    const res = await API.post('/api/battle/enemy/' + eid + '/reassign', { targetPid });
    if (!res.ok) { Toast.show(res.error || 'Reassign failed', 'error'); return; }
    this._battle = res.data.battle;
    Modal.close();
    Toast.show('Foe reassigned', 'success');
    const panel = document.getElementById('tab-battle');
    if (panel) this._renderBattleConsole(panel);
  },

  async _resumeBattle() {
    if (!confirm('Resume the battle? This will return to the active battle console.')) return;
    const res = await API.post('/api/battle/resume');
    if (!res.ok) { Toast.show(res.error || 'Failed to resume', 'error'); return; }
    Toast.show('Battle resumed', 'success');
    await this.render();
  },

  async _loadAndRenderFinalization(panel) {
    const res = await API.get('/api/battle/state');
    if (!res.ok || !res.data.battle) {
      panel.innerHTML = '<p class="muted" style="padding:2rem">Could not load battle state.</p>';
      return;
    }
    this._battle = res.data.battle;
    const b = this._battle;

    const OUTCOME_OPTS = [
      { value: 'decisive_victory', label: 'Decisive Victory' },
      { value: 'victory', label: 'Victory' },
      { value: 'indecisive', label: 'Indecisive' },
      { value: 'defeat', label: 'Defeat' },
      { value: 'decisive_defeat', label: 'Decisive Defeat' },
      { value: 'scripted', label: 'Scripted' },
    ];
    const STATUS_LABELS = {
      active: 'Active', major_wound: 'Major Wound', unconscious: 'Unconscious',
      dead: 'Dead', alone: 'Alone in Field', rear: 'Retired to Rear',
    };
    const STATUS_COLOURS = {
      active: '#208060', major_wound: '#c07820', unconscious: '#c07820',
      dead: '#c03030', alone: '#9040c0', rear: '#707070',
    };

    const sizeLabel = (this.SIZES.find(s => s.value === b.size) || {}).label || b.size;
    const sorted = [...(b.participants || [])].sort((a, b_) => {
      if (a.isPK !== b_.isPK) return a.isPK ? -1 : 1;
      return a.name.localeCompare(b_.name);
    });

    const participantRows = sorted.map(p => {
      const kills = (p.killLedger || []).length;
      const st = STATUS_LABELS[p.status] || p.status;
      const stCol = STATUS_COLOURS[p.status] || '#707070';
      const passionStr = p.passion
        ? `${esc(p.passion.name)} (${esc(p.passion.result)})`
        : '';
      return `
        <tr style="border-bottom:1px solid var(--vellum-deep);">
          <td style="padding:8px 12px;font-weight:${p.isPK ? '700' : '500'};color:var(--ink);">
            ${p.isPK ? '<span style="color:var(--gold-text);">⚜</span> ' : ''}${esc(p.name)}
          </td>
          <td style="padding:8px 12px;text-align:center;font-weight:600;">${kills}</td>
          <td style="padding:8px 12px;">
            <span style="font-size:0.75rem;padding:2px 8px;border-radius:10px;background:${stCol}18;color:${stCol};font-weight:600;">${st}</span>
          </td>
          <td style="padding:8px 12px;font-size:0.8rem;color:var(--ink-soft);font-style:italic;">${passionStr}</td>
        </tr>`;
    }).join('');

    const outcomeRadios = OUTCOME_OPTS.map(o => `
      <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 0;">
        <input type="radio" name="battle-outcome" value="${o.value}">
        <span style="font-size:0.88rem;">${o.label}</span>
      </label>`).join('');

    panel.innerHTML = `
      <div style="max-width:800px;margin:0 auto;padding:24px 16px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div style="font-size:1.6rem;margin-bottom:6px;">⚔</div>
          <h2 style="font-family:var(--font-heading);font-size:1.4rem;letter-spacing:0.12em;color:var(--gold-text);margin:0 0 6px 0;">${esc(b.name)}</h2>
          <div style="font-size:0.8rem;color:var(--ink-soft);">
            ${b.location ? esc(b.location) + ' · ' : ''}${esc(sizeLabel)} · Round ${b.currentRound}/${b.maxRounds}
          </div>
        </div>

        ${isGM() ? `
        <div style="margin-bottom:24px;">
          <div style="font-family:var(--font-heading);font-size:0.7rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--crimson-mid);margin-bottom:10px;">Outcome</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px 16px;">
            ${outcomeRadios}
          </div>
        </div>` : ''}

        <div style="margin-bottom:24px;">
          <div style="font-family:var(--font-heading);font-size:0.7rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold-text);margin-bottom:10px;">The Conroi</div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:2px solid var(--vellum-deep);">
                  <th style="padding:6px 12px;text-align:left;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.1em;color:var(--ink-soft);text-transform:uppercase;">Name</th>
                  <th style="padding:6px 12px;text-align:center;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.1em;color:var(--ink-soft);text-transform:uppercase;">Kills</th>
                  <th style="padding:6px 12px;text-align:left;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.1em;color:var(--ink-soft);text-transform:uppercase;">Status</th>
                  <th style="padding:6px 12px;text-align:left;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.1em;color:var(--ink-soft);text-transform:uppercase;">Passion</th>
                </tr>
              </thead>
              <tbody>${participantRows}</tbody>
            </table>
          </div>
        </div>

        ${isGM() ? `
        <div style="margin-bottom:24px;">
          <div style="font-family:var(--font-heading);font-size:0.7rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold-text);margin-bottom:10px;">GM Narrative</div>
          <textarea id="battle-narrative" class="edit-input" rows="4"
            placeholder="Record what happened in this battle..."
            style="width:100%;resize:vertical;font-size:0.88rem;line-height:1.5;"></textarea>
        </div>

        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="TabBattle._commitBattle()">📜 Commit to Chronicle</button>
          <button class="btn btn-ghost" onclick="TabBattle._resumeBattle()">Resume Battle</button>
          <button class="btn btn-muted" onclick="TabBattle._abandonBattle()">Abandon</button>
        </div>` : `
        <div class="battle-empty">
          <p class="battle-empty-text">The battle is over. The chronicler writes...</p>
        </div>`}
      </div>`;
  },

  async _commitBattle() {
    const outcome = document.querySelector('input[name="battle-outcome"]:checked')?.value;
    if (!outcome) { Toast.show('Please select an outcome', 'error'); return; }
    const gmNarrative = document.getElementById('battle-narrative')?.value?.trim() || '';
    if (!confirm('Commit this battle to the Chronicle? This cannot be undone.')) return;
    const res = await API.post('/api/battle/commit', { outcome, gmNarrative });
    if (!res.ok) { Toast.show(res.error || 'Failed to commit', 'error'); return; }
    this._battle = null;
    Toast.show('Battle committed to the Chronicle', 'success');
    await STORE.loadFromFile();
    await this.render();
  },
};
