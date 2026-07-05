/* ══════════════════════════════════════════════════════════════
   TAB: STORY ARCS (GM only)
   Ongoing plot threads — the campaign's memory layer.
   List view + detail view over /api/arcs. Data is shared with the
   MCP bridge, so Claude prep conversations read/write the same arcs.
══════════════════════════════════════════════════════════════ */

const TabArcs = {
  _view:    'list',     // 'list' | 'detail'
  _arcs:    [],
  _current: null,       // arc id when in detail view
  _filter:  'all',      // 'all' | 'active' | 'cold' | 'complete'

  STATUS_META: {
    active:   { label: 'Active',   colour: '#208060' },
    cold:     { label: 'Cold',     colour: '#5a7a99' },
    complete: { label: 'Complete', colour: '#8a6d1d' },
  },
  OBJ_META: {
    active:   { icon: '◉', label: 'Active',   colour: '#208060' },
    pending:  { icon: '◌', label: 'Pending',  colour: '#707070' },
    complete: { icon: '✓', label: 'Complete', colour: '#8a6d1d' },
  },

  /* ── Entry points ─────────────────────────────────────────── */

  async render() {
    const panel = document.getElementById('tab-arcs');
    if (!panel) return;
    if (!isGM()) {
      panel.innerHTML = '<p class="muted" style="padding:2rem">The GM keeps these pages close.</p>';
      return;
    }
    const res = await API.get('/api/arcs');
    if (!res.ok) {
      panel.innerHTML = `<p class="muted" style="padding:2rem">Could not load story arcs: ${esc(res.error || '')}</p>`;
      return;
    }
    this._arcs = res.data.arcs || [];
    if (this._view === 'detail' && this._arcs.some(a => a.id === this._current)) {
      this._renderDetail(panel);
    } else {
      this._view = 'list';
      this._renderList(panel);
    }
  },

  // Open a specific arc from anywhere (prep view, NPC card, etc.)
  openArc(id) {
    this._view = 'detail';
    this._current = id;
    if (typeof APP !== 'undefined' && APP._currentTab !== 'arcs') {
      APP.switchTab('arcs');
    } else {
      this.render();
    }
  },

  /* ── List view ────────────────────────────────────────────── */

  _renderList(panel) {
    const order = { active: 0, cold: 1, complete: 2 };
    let arcs = [...this._arcs].sort((a, b) =>
      (order[a.status] ?? 3) - (order[b.status] ?? 3) ||
      String(b.last_advanced || '').localeCompare(String(a.last_advanced || '')));
    if (this._filter !== 'all') arcs = arcs.filter(a => a.status === this._filter);

    const chips = ['all', 'active', 'cold', 'complete'].map(f => {
      const n = f === 'all' ? this._arcs.length : this._arcs.filter(a => a.status === f).length;
      return `<button class="filter-chip${this._filter === f ? ' active' : ''}"
        onclick="TabArcs.setFilter('${f}')">${f === 'all' ? 'All' : this.STATUS_META[f].label} (${n})</button>`;
    }).join('');

    const rows = arcs.map(a => {
      const meta = this.STATUS_META[a.status] || { label: a.status, colour: '#707070' };
      const objs = a.objectives || [];
      const done = objs.filter(o => o.status === 'complete').length;
      const summary = (a.summary || '').length > 180 ? a.summary.slice(0, 180) + '…' : (a.summary || '');
      return `
        <div class="arc-row" role="button" tabindex="0" onclick="TabArcs.openArc('${a.id}')"
          onkeydown="if(event.key==='Enter')TabArcs.openArc('${a.id}')">
          <div class="arc-row-head">
            <span class="arc-row-title">${esc(a.title)}</span>
            <span class="arc-pill" style="background:${meta.colour}18;color:${meta.colour};">${esc(meta.label)}</span>
          </div>
          ${summary ? `<div class="arc-row-summary">${esc(summary)}</div>` : ''}
          <div class="arc-row-meta">
            ${a.last_advanced ? `<span>Last advanced: ${esc(a.last_advanced)}</span>` : ''}
            ${objs.length ? `<span>Objectives: ${done}/${objs.length}</span>` : ''}
            ${(a.linked_npcs || []).length ? `<span>${a.linked_npcs.length} linked NPC${a.linked_npcs.length !== 1 ? 's' : ''}</span>` : ''}
          </div>
        </div>`;
    }).join('');

    panel.innerHTML = `
      <div class="arcs-layout">
        <div class="arcs-header">
          <div class="page-title">🧵 Story Arcs</div>
          <div class="arcs-epitaph">"Every thread woven now shall be seen in the tapestry entire."</div>
          <div class="arcs-toolbar">
            ${chips}
            <button class="btn btn-primary arc-new-btn" onclick="TabArcs.newArcModal()">+ New Arc</button>
          </div>
        </div>
        ${rows || `
          <div class="arc-empty">
            <div class="arc-empty-icon">🧵</div>
            <p>No story arcs yet. Weave the first thread here, or ask Claude to
            record your ongoing plots during a prep conversation — arcs created
            either way appear in both places.</p>
          </div>`}
      </div>`;
  },

  setFilter(f) {
    this._filter = f;
    const panel = document.getElementById('tab-arcs');
    if (panel) this._renderList(panel);
  },

  newArcModal() {
    Modal.open(`
      <h2 class="modal-title">New Story Arc</h2>
      <label class="edit-label">Title</label>
      <input class="edit-input" id="arc-new-title" maxlength="200" placeholder="The Brennus Crisis">
      <label class="edit-label" style="margin-top:10px;">Summary (current state of the thread)</label>
      <textarea class="edit-input edit-textarea" id="arc-new-summary" rows="3"
        placeholder="What is happening, and why it can't be ignored…"></textarea>
      <label class="edit-label" style="margin-top:10px;">Began (game year-season)</label>
      <input class="edit-input" id="arc-new-created" maxlength="40" placeholder="${esc(String(STORE.year || '')) }-spring" style="max-width:200px;">
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">
        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="TabArcs.createArc()">Create Arc</button>
      </div>`);
  },

  async createArc() {
    const title = document.getElementById('arc-new-title')?.value.trim();
    if (!title) { Toast.show('Give the arc a title', 'error'); return; }
    const body = {
      title,
      summary: document.getElementById('arc-new-summary')?.value.trim() || '',
      created: document.getElementById('arc-new-created')?.value.trim() || '',
      status: 'active',
    };
    const res = await API.post('/api/arcs', body);
    if (!res.ok) { Toast.show(res.error || 'Failed to create arc', 'error'); return; }
    Modal.close();
    Toast.show('Arc created', 'success');
    this.openArc(res.data.id);
  },

  /* ── Detail view ──────────────────────────────────────────── */

  _arc() { return this._arcs.find(a => a.id === this._current); },

  backToList() {
    this._view = 'list';
    this._current = null;
    this.render();
  },

  _renderDetail(panel) {
    const a = this._arc();
    if (!a) { this.backToList(); return; }

    const statusBtns = Object.entries(this.STATUS_META).map(([s, m]) => `
      <button class="arc-status-btn${a.status === s ? ' active' : ''}"
        style="${a.status === s ? `background:${m.colour}22;color:${m.colour};border-color:${m.colour};` : ''}"
        onclick="TabArcs.setStatus('${s}')">${esc(m.label)}</button>`).join('');

    const npcChips = (a.linked_npcs || []).map(l => {
      const npc = STORE.getNpc(l.npc_id);
      const name = npc ? npc.name : l.npc_id;
      return `
        <span class="arc-npc-chip">
          <span class="arc-npc-chip-name" role="button" tabindex="0"
            onclick="Components.openNpcCard('${l.npc_id}')">${esc(name)}</span>
          ${l.role ? `<span class="arc-npc-chip-role">${esc(l.role)}</span>` : ''}
          <button class="arc-chip-x" title="Unlink" onclick="TabArcs.unlinkNpc('${l.npc_id}')">✕</button>
        </span>`;
    }).join('');

    const objRows = (a.objectives || []).map(o => {
      const m = this.OBJ_META[o.status] || this.OBJ_META.pending;
      const opts = Object.entries(this.OBJ_META).map(([s, om]) =>
        `<option value="${s}" ${o.status === s ? 'selected' : ''}>${om.icon} ${om.label}</option>`).join('');
      return `
        <div class="arc-obj-row${o.status === 'complete' ? ' arc-obj-done' : ''}">
          <select class="arc-obj-status" style="color:${m.colour};"
            onchange="TabArcs.setObjectiveStatus('${o.id}', this.value)">${opts}</select>
          <div class="arc-obj-body">
            <div class="arc-obj-text">${esc(o.text)}${o.completed ? ` <span class="arc-obj-completed">(${esc(String(o.completed))})</span>` : ''}</div>
            ${o.notes ? `<div class="arc-obj-notes">${esc(o.notes)}</div>` : ''}
          </div>
          <button class="arc-chip-x" title="Remove objective" onclick="TabArcs.deleteObjective('${o.id}')">✕</button>
        </div>`;
    }).join('');

    const timeline = [...(a.timeline || [])].map(t => `
      <div class="arc-time-row">
        <span class="arc-time-year">${esc(t.year)}</span>
        <div class="arc-time-body">
          ${esc(t.description)}
          ${t.session_id ? `<span class="arc-time-session">${esc(t.session_id)}</span>` : ''}
        </div>
      </div>`).join('');

    panel.innerHTML = `
      <div class="arcs-layout arc-detail">
        <div class="arc-detail-top">
          <button class="btn btn-ghost" onclick="TabArcs.backToList()">‹ All Arcs</button>
          <div class="arc-status-toggle">${statusBtns}</div>
        </div>
        <div class="arc-detail-head">
          <h2 class="arc-detail-title" id="arc-title-view">${esc(a.title)}
            <button class="arc-edit-title" title="Rename" onclick="TabArcs.editTitle()">✎</button>
          </h2>
          <div class="arc-detail-dates">
            ${a.created ? `Began ${esc(a.created)}` : ''}${a.created && a.last_advanced ? ' · ' : ''}${a.last_advanced ? `Last advanced ${esc(a.last_advanced)}` : ''}
          </div>
        </div>

        <div class="arc-section">
          <div class="arc-section-title">Summary</div>
          <textarea class="edit-input edit-textarea" rows="3" id="arc-summary"
            placeholder="The current state of this thread…"
            onchange="TabArcs.saveField('summary', this.value)">${esc(a.summary || '')}</textarea>
        </div>

        <div class="arc-section">
          <div class="arc-section-title">Dramatis Personae
            <button class="btn btn-ghost arc-add-btn" onclick="TabArcs.linkNpcModal()">+ Link NPC</button>
          </div>
          <div class="arc-npc-chips">${npcChips || '<span class="muted" style="font-size:0.83rem;">No NPCs linked yet.</span>'}</div>
        </div>

        <div class="arc-section">
          <div class="arc-section-title">Objectives</div>
          ${objRows || '<div class="muted" style="font-size:0.83rem;padding:4px 0;">No objectives yet.</div>'}
          <div class="arc-add-row">
            <input class="edit-input" id="arc-new-obj" placeholder="Add an objective…" maxlength="2000"
              onkeydown="if(event.key==='Enter')TabArcs.addObjective()">
            <button class="btn btn-ghost" onclick="TabArcs.addObjective()">Add</button>
          </div>
        </div>

        <div class="arc-section">
          <div class="arc-section-title">Timeline</div>
          <div class="arc-timeline">${timeline || '<div class="muted" style="font-size:0.83rem;padding:4px 0;">Nothing recorded yet.</div>'}</div>
          <div class="arc-add-row arc-time-add">
            <input class="edit-input" id="arc-time-year" placeholder="${esc(String(STORE.year || ''))}-summer" maxlength="40" style="max-width:140px;">
            <input class="edit-input" id="arc-time-desc" placeholder="What advanced this session…" maxlength="4000"
              onkeydown="if(event.key==='Enter')TabArcs.addTimeline()">
            <button class="btn btn-ghost" onclick="TabArcs.addTimeline()">Add</button>
          </div>
        </div>

        <div class="arc-section">
          <div class="arc-section-title">GM Notes <span class="arc-hint">(@mentions work here)</span></div>
          <textarea class="edit-input edit-textarea" rows="6" id="arc-notes"
            placeholder="Design intent, contingencies, secrets…"
            onchange="TabArcs.saveField('notes', this.value)">${esc(a.notes || '')}</textarea>
        </div>

        <div class="arc-detail-footer">
          <button class="btn btn-muted" onclick="TabArcs.deleteArc()">Delete Arc</button>
        </div>
      </div>`;
  },

  /* ── Detail actions ───────────────────────────────────────── */

  async _put(body) {
    const res = await API.put(`/api/arcs/${this._current}`, body);
    if (!res.ok) { Toast.show(res.error || 'Save failed', 'error'); return null; }
    const idx = this._arcs.findIndex(x => x.id === this._current);
    if (idx >= 0 && res.data.arc) this._arcs[idx] = res.data.arc;
    return res.data.arc;
  },

  async saveField(field, value) {
    const arc = await this._put({ [field]: value });
    if (arc) Toast.show('Saved', 'success');
  },

  async setStatus(status) {
    const arc = await this._put({ status });
    if (arc) { Toast.show(`Arc marked ${status}`, 'success'); this.render(); }
  },

  editTitle() {
    const a = this._arc();
    const el = document.getElementById('arc-title-view');
    if (!a || !el) return;
    el.outerHTML = `
      <div class="arc-add-row" id="arc-title-edit" style="margin-bottom:6px;">
        <input class="edit-input" id="arc-title-input" maxlength="200" value="${esc(a.title)}"
          onkeydown="if(event.key==='Enter')TabArcs.saveTitle()">
        <button class="btn btn-primary" onclick="TabArcs.saveTitle()">Save</button>
      </div>`;
    document.getElementById('arc-title-input')?.focus();
  },

  async saveTitle() {
    const title = document.getElementById('arc-title-input')?.value.trim();
    if (!title) { Toast.show('Title cannot be empty', 'error'); return; }
    const arc = await this._put({ title });
    if (arc) this.render();
  },

  async deleteArc() {
    const a = this._arc();
    if (!a) return;
    if (!confirm(`Delete "${a.title}"? This removes the whole thread — objectives, timeline, and all. It cannot be undone.`)) return;
    const res = await API.del(`/api/arcs/${this._current}`);
    if (!res.ok) { Toast.show(res.error || 'Delete failed', 'error'); return; }
    Toast.show('Arc deleted', 'success');
    this.backToList();
  },

  /* Objectives */

  async addObjective() {
    const input = document.getElementById('arc-new-obj');
    const text = input?.value.trim();
    if (!text) return;
    const res = await API.post(`/api/arcs/${this._current}/objectives`, { text, status: 'active' });
    if (!res.ok) { Toast.show(res.error || 'Failed to add objective', 'error'); return; }
    await this.render();
  },

  async setObjectiveStatus(objId, status) {
    const body = { status };
    if (status === 'complete') body.completed = String(STORE.year || '');
    else body.completed = null;
    const res = await API.put(`/api/arcs/${this._current}/objectives/${objId}`, body);
    if (!res.ok) { Toast.show(res.error || 'Failed to update objective', 'error'); return; }
    await this.render();
  },

  async deleteObjective(objId) {
    if (!confirm('Remove this objective?')) return;
    const res = await API.del(`/api/arcs/${this._current}/objectives/${objId}`);
    if (!res.ok) { Toast.show(res.error || 'Failed to remove objective', 'error'); return; }
    await this.render();
  },

  /* Timeline */

  async addTimeline() {
    const year = document.getElementById('arc-time-year')?.value.trim();
    const description = document.getElementById('arc-time-desc')?.value.trim();
    if (!year || !description) { Toast.show('Year and description are both needed', 'error'); return; }
    const res = await API.post(`/api/arcs/${this._current}/timeline`, { year, description });
    if (!res.ok) { Toast.show(res.error || 'Failed to add entry', 'error'); return; }
    await this.render();
  },

  /* NPC links */

  linkNpcModal() {
    TabArcs._npcPicker('Link an NPC to this arc', (npcId) => {
      const role = document.getElementById('arc-link-role')?.value.trim() || '';
      TabArcs._linkNpc(npcId, role);
    }, `<label class="edit-label" style="margin-top:10px;">Role in this arc</label>
        <input class="edit-input" id="arc-link-role" maxlength="100" placeholder="antagonist, authority, witness…">`);
  },

  async _linkNpc(npcId, role) {
    const res = await API.post(`/api/arcs/${this._current}/npcs`, { npc_id: npcId, role });
    if (!res.ok) { Toast.show(res.error || 'Failed to link NPC', 'error'); return; }
    Modal.close();
    await this.render();
  },

  async unlinkNpc(npcId) {
    const res = await API.del(`/api/arcs/${this._current}/npcs/${npcId}`);
    if (!res.ok) { Toast.show(res.error || 'Failed to unlink NPC', 'error'); return; }
    await this.render();
  },

  /* Shared NPC picker — search across living NPCs, click to choose.
     extraHtml renders above the list (e.g. a role input). */
  _npcPicker(title, onPick, extraHtml = '') {
    this._pickerCallback = onPick;
    Modal.open(`
      <h2 class="modal-title">${esc(title)}</h2>
      ${extraHtml}
      <input class="edit-input" id="arc-npc-search" placeholder="Search NPCs…" style="margin-top:10px;"
        oninput="TabArcs._pickerFilter(this.value)">
      <div class="arc-picker-list" id="arc-npc-picker-list">${this._pickerRows('')}</div>`);
    document.getElementById('arc-npc-search')?.focus();
  },

  _pickerRows(q) {
    const needle = q.toLowerCase();
    const list = (STORE.living || [])
      .filter(n => !needle || (n.name || '').toLowerCase().includes(needle))
      .slice(0, 40);
    if (!list.length) return '<div class="muted" style="padding:10px;font-size:0.85rem;">No NPCs match.</div>';
    return list.map(n => `
      <div class="arc-picker-row" role="button" tabindex="0"
        onclick="TabArcs._pickerChoose('${n.id}')"
        onkeydown="if(event.key==='Enter')TabArcs._pickerChoose('${n.id}')">
        <span>${esc(n.name)}</span>
        <span class="arc-picker-role">${esc(n.role || '')}</span>
      </div>`).join('');
  },

  _pickerFilter(q) {
    const el = document.getElementById('arc-npc-picker-list');
    if (el) el.innerHTML = this._pickerRows(q);
  },

  _pickerChoose(npcId) {
    if (this._pickerCallback) this._pickerCallback(npcId);
  },
};
