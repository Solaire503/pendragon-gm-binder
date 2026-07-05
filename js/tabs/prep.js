/* ══════════════════════════════════════════════════════════════
   TAB: SESSION PREP (GM only)
   The game-night screen: "previously", arcs in play, staged NPCs,
   open questions, GM notes. Backed by /api/prep — shared with the
   MCP bridge, so Claude can draft a prep and Steve refines it here.
══════════════════════════════════════════════════════════════ */

const TabPrep = {
  _view:    'list',    // 'list' | 'detail'
  _preps:   [],
  _arcs:    [],        // for titles + the arc picker
  _current: null,

  STATUS_META: {
    draft:  { label: 'Draft',  colour: '#5a7a99' },
    ready:  { label: 'Ready',  colour: '#208060' },
    played: { label: 'Played', colour: '#707070' },
  },
  RELEVANCE_META: {
    'on-the-table': { label: 'On the Table', colour: '#a03030' },
    'may-surface':  { label: 'May Surface',  colour: '#8a6d1d' },
    'background':   { label: 'Background',   colour: '#707070' },
  },

  /* ── Entry points ─────────────────────────────────────────── */

  async render() {
    const panel = document.getElementById('tab-prep');
    if (!panel) return;
    if (!isGM()) {
      panel.innerHTML = '<p class="muted" style="padding:2rem">The GM keeps these pages close.</p>';
      return;
    }
    const [prepRes, arcRes] = await Promise.all([
      API.get('/api/prep'),
      API.get('/api/arcs'),
    ]);
    if (!prepRes.ok) {
      panel.innerHTML = `<p class="muted" style="padding:2rem">Could not load session prep: ${esc(prepRes.error || '')}</p>`;
      return;
    }
    this._preps = prepRes.data.preps || [];
    this._arcs = arcRes.ok ? (arcRes.data.arcs || []) : [];
    if (this._view === 'detail' && this._preps.some(p => p.id === this._current)) {
      this._renderDetail(panel);
    } else {
      this._view = 'list';
      this._renderList(panel);
    }
  },

  openPrep(id) {
    this._view = 'detail';
    this._current = id;
    if (typeof APP !== 'undefined' && APP._currentTab !== 'prep') {
      APP.switchTab('prep');
    } else {
      this.render();
    }
  },

  /* ── List view ────────────────────────────────────────────── */

  _renderList(panel) {
    const preps = [...this._preps].sort((a, b) => (b.session_number || 0) - (a.session_number || 0));
    const rows = preps.map(p => {
      const m = this.STATUS_META[p.status] || { label: p.status, colour: '#707070' };
      const arcCount = (p.arcs_in_play || []).length;
      return `
        <div class="arc-row" role="button" tabindex="0" onclick="TabPrep.openPrep('${p.id}')"
          onkeydown="if(event.key==='Enter')TabPrep.openPrep('${p.id}')">
          <div class="arc-row-head">
            <span class="arc-row-title">Session ${p.session_number}${p.game_year ? ` — ${esc(p.game_year)}` : ''}</span>
            <span class="arc-pill" style="background:${m.colour}18;color:${m.colour};">${esc(m.label)}</span>
          </div>
          <div class="arc-row-meta">
            ${p.location ? `<span>${esc(p.location)}</span>` : ''}
            ${arcCount ? `<span>${arcCount} arc${arcCount !== 1 ? 's' : ''} in play</span>` : ''}
            ${(p.npcs_staged || []).length ? `<span>${p.npcs_staged.length} NPCs staged</span>` : ''}
          </div>
        </div>`;
    }).join('');

    panel.innerHTML = `
      <div class="arcs-layout">
        <div class="arcs-header">
          <div class="page-title">🕮 Session Prep</div>
          <div class="arcs-epitaph">"Prepare situations, not outcomes."</div>
          <div class="arcs-toolbar">
            <button class="btn btn-primary arc-new-btn" onclick="TabPrep.newPrepModal()">+ New Prep</button>
          </div>
        </div>
        ${rows || `
          <div class="arc-empty">
            <div class="arc-empty-icon">🕮</div>
            <p>No session prep yet. Start one here, or ask Claude to draft the next
            session's prep from your active arcs — it lands in this list either way.</p>
          </div>`}
      </div>`;
  },

  newPrepModal() {
    const next = Math.max(0, ...this._preps.map(p => p.session_number || 0)) + 1;
    Modal.open(`
      <h2 class="modal-title">New Session Prep</h2>
      <div style="display:flex;gap:10px;">
        <div style="flex:0 0 130px;">
          <label class="edit-label">Session #</label>
          <input class="edit-input" id="prep-new-num" type="number" min="1" value="${next}">
        </div>
        <div style="flex:1;">
          <label class="edit-label">Game year-season</label>
          <input class="edit-input" id="prep-new-year" maxlength="40" placeholder="${esc(String(STORE.year || ''))}-autumn">
        </div>
      </div>
      <label class="edit-label" style="margin-top:10px;">Location</label>
      <input class="edit-input" id="prep-new-loc" maxlength="200" placeholder="Salisbury">
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">
        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="TabPrep.createPrep()">Create</button>
      </div>`);
  },

  async createPrep() {
    const session_number = parseInt(document.getElementById('prep-new-num')?.value, 10);
    if (!session_number || session_number < 1) { Toast.show('Session number is required', 'error'); return; }
    const body = {
      session_number,
      game_year: document.getElementById('prep-new-year')?.value.trim() || '',
      location: document.getElementById('prep-new-loc')?.value.trim() || '',
      status: 'draft',
    };
    const res = await API.post('/api/prep', body);
    if (!res.ok) { Toast.show(res.error || 'Failed to create prep', 'error'); return; }
    Modal.close();
    Toast.show('Session prep created', 'success');
    this.openPrep(res.data.id);
  },

  /* ── Detail view (the game-night dashboard) ───────────────── */

  _prep() { return this._preps.find(p => p.id === this._current); },
  _arcTitle(id) { return (this._arcs.find(a => a.id === id) || {}).title || id; },

  backToList() {
    this._view = 'list';
    this._current = null;
    this.render();
  },

  _renderDetail(panel) {
    const p = this._prep();
    if (!p) { this.backToList(); return; }

    const statusBtns = Object.entries(this.STATUS_META).map(([s, m]) => `
      <button class="arc-status-btn${p.status === s ? ' active' : ''}"
        style="${p.status === s ? `background:${m.colour}22;color:${m.colour};border-color:${m.colour};` : ''}"
        onclick="TabPrep.setStatus('${s}')">${esc(m.label)}</button>`).join('');

    const relOrder = { 'on-the-table': 0, 'may-surface': 1, 'background': 2 };
    const arcRows = [...(p.arcs_in_play || [])]
      .sort((a, b) => (relOrder[a.relevance] ?? 3) - (relOrder[b.relevance] ?? 3))
      .map((ap, i) => {
        const m = this.RELEVANCE_META[ap.relevance] || { label: ap.relevance || '—', colour: '#707070' };
        const relOpts = Object.entries(this.RELEVANCE_META).map(([r, rm]) =>
          `<option value="${r}" ${ap.relevance === r ? 'selected' : ''}>${rm.label}</option>`).join('');
        return `
          <div class="prep-arc-card" style="border-left-color:${m.colour};">
            <div class="prep-arc-head">
              <span class="prep-arc-title" role="button" tabindex="0"
                onclick="TabArcs.openArc('${ap.arc_id}')">${esc(this._arcTitle(ap.arc_id))}</span>
              <select class="arc-obj-status" style="color:${m.colour};"
                onchange="TabPrep.setArcField(${i}, 'relevance', this.value)">${relOpts}</select>
              <button class="arc-chip-x" title="Remove from tonight" onclick="TabPrep.removeArc(${i})">✕</button>
            </div>
            <input class="edit-input prep-context-input" value="${esc(ap.context || '')}" maxlength="500"
              placeholder="Context for tonight…"
              onchange="TabPrep.setArcField(${i}, 'context', this.value)">
          </div>`;
      }).join('');

    const npcRows = (p.npcs_staged || []).map((ns, i) => {
      const npc = STORE.getNpc(ns.npc_id);
      return `
        <div class="prep-npc-row">
          <span class="prep-npc-name" role="button" tabindex="0"
            onclick="Components.openNpcCard('${ns.npc_id}')">${esc(npc ? npc.name : ns.npc_id)}</span>
          <input class="edit-input prep-context-input" value="${esc(ns.context || '')}" maxlength="500"
            placeholder="Their stance tonight…"
            onchange="TabPrep.setNpcField(${i}, this.value)">
          <button class="arc-chip-x" title="Unstage" onclick="TabPrep.removeNpc(${i})">✕</button>
        </div>`;
    }).join('');

    const questions = (p.open_questions || []).map((q, i) => `
      <div class="prep-list-row">
        <span class="prep-list-bullet">?</span>
        <input class="edit-input prep-context-input" value="${esc(q)}" maxlength="1000"
          onchange="TabPrep.setListItem('open_questions', ${i}, this.value)">
        <button class="arc-chip-x" onclick="TabPrep.removeListItem('open_questions', ${i})">✕</button>
      </div>`).join('');

    const notes = (p.gm_notes || []).map((n, i) => `
      <div class="prep-list-row">
        <span class="prep-list-bullet">✦</span>
        <textarea class="edit-input edit-textarea prep-context-input" rows="2" maxlength="4000"
          onchange="TabPrep.setListItem('gm_notes', ${i}, this.value)">${esc(n)}</textarea>
        <button class="arc-chip-x" onclick="TabPrep.removeListItem('gm_notes', ${i})">✕</button>
      </div>`).join('');

    panel.innerHTML = `
      <div class="arcs-layout arc-detail">
        <div class="arc-detail-top">
          <button class="btn btn-ghost" onclick="TabPrep.backToList()">‹ All Sessions</button>
          <div class="arc-status-toggle">${statusBtns}</div>
        </div>
        <div class="arc-detail-head">
          <h2 class="arc-detail-title">Session ${p.session_number}</h2>
          <div class="prep-head-fields">
            <input class="edit-input" value="${esc(p.game_year || '')}" maxlength="40" placeholder="year-season"
              style="max-width:150px;" onchange="TabPrep.saveField('game_year', this.value)">
            <input class="edit-input" value="${esc(p.location || '')}" maxlength="200" placeholder="Location"
              style="max-width:240px;" onchange="TabPrep.saveField('location', this.value)">
          </div>
        </div>

        <div class="arc-section prep-previously">
          <div class="arc-section-title">Previously…</div>
          <textarea class="edit-input edit-textarea prep-previously-text" rows="4"
            placeholder="You stood before Countess Jenna's summer court as… (player-facing recap, second person)"
            onchange="TabPrep.saveField('previously', this.value)">${esc(p.previously || '')}</textarea>
        </div>

        <div class="ornament-divider-sm"></div>

        <div class="arc-section">
          <div class="arc-section-title">Arcs in Play
            <button class="btn btn-ghost arc-add-btn" onclick="TabPrep.addArcModal()">+ Add Arc</button>
          </div>
          ${arcRows || '<div class="muted" style="font-size:0.83rem;padding:4px 0;">No arcs staged for tonight.</div>'}
        </div>

        <div class="arc-section">
          <div class="arc-section-title">Staged NPCs
            <button class="btn btn-ghost arc-add-btn" onclick="TabPrep.addNpcModal()">+ Stage NPC</button>
          </div>
          ${npcRows || '<div class="muted" style="font-size:0.83rem;padding:4px 0;">No NPCs staged.</div>'}
        </div>

        <div class="arc-section">
          <div class="arc-section-title">Open Questions <span class="arc-hint">(watching for — never predictions of the PKs)</span></div>
          ${questions}
          <div class="arc-add-row">
            <input class="edit-input" id="prep-new-question" placeholder="What am I watching for…" maxlength="1000"
              onkeydown="if(event.key==='Enter')TabPrep.addListItem('open_questions','prep-new-question')">
            <button class="btn btn-ghost" onclick="TabPrep.addListItem('open_questions','prep-new-question')">Add</button>
          </div>
        </div>

        <div class="arc-section">
          <div class="arc-section-title">GM Notes <span class="arc-hint">(scenes, triggers, contingencies)</span></div>
          ${notes}
          <div class="arc-add-row">
            <input class="edit-input" id="prep-new-note" placeholder="Add a note…" maxlength="4000"
              onkeydown="if(event.key==='Enter')TabPrep.addListItem('gm_notes','prep-new-note')">
            <button class="btn btn-ghost" onclick="TabPrep.addListItem('gm_notes','prep-new-note')">Add</button>
          </div>
        </div>

        <div class="arc-detail-footer">
          <button class="btn btn-muted" onclick="TabPrep.deletePrep()">Delete Prep</button>
        </div>
      </div>`;
  },

  /* ── Detail actions ───────────────────────────────────────── */

  async _put(body) {
    const res = await API.put(`/api/prep/${this._current}`, body);
    if (!res.ok) { Toast.show(res.error || 'Save failed', 'error'); return null; }
    const idx = this._preps.findIndex(x => x.id === this._current);
    if (idx >= 0 && res.data.prep) this._preps[idx] = res.data.prep;
    return res.data.prep;
  },

  async saveField(field, value) {
    const prep = await this._put({ [field]: value });
    if (prep) Toast.show('Saved', 'success');
  },

  async setStatus(status) {
    const prep = await this._put({ status });
    if (prep) { Toast.show(`Prep marked ${status}`, 'success'); this.render(); }
  },

  async deletePrep() {
    const p = this._prep();
    if (!p) return;
    if (!confirm(`Delete the prep for Session ${p.session_number}? This cannot be undone.`)) return;
    const res = await API.del(`/api/prep/${this._current}`);
    if (!res.ok) { Toast.show(res.error || 'Delete failed', 'error'); return; }
    Toast.show('Prep deleted', 'success');
    this.backToList();
  },

  /* Arcs in play — whole-array updates */

  addArcModal() {
    const p = this._prep();
    const staged = new Set((p.arcs_in_play || []).map(a => a.arc_id));
    const options = this._arcs.filter(a => !staged.has(a.id) && a.status !== 'complete');
    if (!options.length) { Toast.show('Every open arc is already staged', 'error'); return; }
    const rows = options.map(a => `
      <div class="arc-picker-row" role="button" tabindex="0"
        onclick="TabPrep._chooseArc('${a.id}')"
        onkeydown="if(event.key==='Enter')TabPrep._chooseArc('${a.id}')">
        <span>${esc(a.title)}</span>
        <span class="arc-picker-role">${esc(a.status)}</span>
      </div>`).join('');
    Modal.open(`
      <h2 class="modal-title">Add an arc to tonight's session</h2>
      <label class="edit-label">Relevance</label>
      <select class="edit-input edit-select" id="prep-arc-rel">
        <option value="on-the-table">On the Table — tonight's focus</option>
        <option value="may-surface">May Surface — depends on the players</option>
        <option value="background">Background — pressure, not spotlight</option>
      </select>
      <label class="edit-label" style="margin-top:10px;">Context for tonight</label>
      <input class="edit-input" id="prep-arc-ctx" maxlength="500" placeholder="Where this thread stands…">
      <div class="arc-picker-list" style="margin-top:12px;">${rows}</div>`);
  },

  async _chooseArc(arcId) {
    const p = this._prep();
    const entry = {
      arc_id: arcId,
      relevance: document.getElementById('prep-arc-rel')?.value || 'may-surface',
      context: document.getElementById('prep-arc-ctx')?.value.trim() || '',
    };
    const prep = await this._put({ arcs_in_play: [...(p.arcs_in_play || []), entry] });
    if (prep) { Modal.close(); this.render(); }
  },

  async setArcField(index, field, value) {
    const p = this._prep();
    const arr = [...(p.arcs_in_play || [])];
    if (!arr[index]) return;
    arr[index] = { ...arr[index], [field]: value };
    const prep = await this._put({ arcs_in_play: arr });
    if (prep && field === 'relevance') this.render();
  },

  async removeArc(index) {
    const p = this._prep();
    const arr = [...(p.arcs_in_play || [])];
    arr.splice(index, 1);
    const prep = await this._put({ arcs_in_play: arr });
    if (prep) this.render();
  },

  /* Staged NPCs */

  addNpcModal() {
    TabArcs._npcPicker('Stage an NPC for tonight', (npcId) => {
      const context = document.getElementById('prep-npc-ctx')?.value.trim() || '';
      TabPrep._stageNpc(npcId, context);
    }, `<label class="edit-label" style="margin-top:10px;">Context for tonight</label>
        <input class="edit-input" id="prep-npc-ctx" maxlength="500" placeholder="Their stance or situation…">`);
  },

  async _stageNpc(npcId, context) {
    const p = this._prep();
    if ((p.npcs_staged || []).some(n => n.npc_id === npcId)) {
      Toast.show('Already staged', 'error');
      return;
    }
    const prep = await this._put({ npcs_staged: [...(p.npcs_staged || []), { npc_id: npcId, context }] });
    if (prep) { Modal.close(); this.render(); }
  },

  async setNpcField(index, value) {
    const p = this._prep();
    const arr = [...(p.npcs_staged || [])];
    if (!arr[index]) return;
    arr[index] = { ...arr[index], context: value };
    await this._put({ npcs_staged: arr });
  },

  async removeNpc(index) {
    const p = this._prep();
    const arr = [...(p.npcs_staged || [])];
    arr.splice(index, 1);
    const prep = await this._put({ npcs_staged: arr });
    if (prep) this.render();
  },

  /* Open questions & GM notes — plain string arrays */

  async addListItem(field, inputId) {
    const input = document.getElementById(inputId);
    const value = input?.value.trim();
    if (!value) return;
    const p = this._prep();
    const prep = await this._put({ [field]: [...(p[field] || []), value] });
    if (prep) this.render();
  },

  async setListItem(field, index, value) {
    const p = this._prep();
    const arr = [...(p[field] || [])];
    if (index >= arr.length) return;
    arr[index] = value;
    await this._put({ [field]: arr });
  },

  async removeListItem(field, index) {
    const p = this._prep();
    const arr = [...(p[field] || [])];
    arr.splice(index, 1);
    const prep = await this._put({ [field]: arr });
    if (prep) this.render();
  },
};
