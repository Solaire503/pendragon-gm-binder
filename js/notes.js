/* ══════════════════════════════════════════════════════════════
   NOTES — Private per-user notes (general, manor, NPC impressions)
══════════════════════════════════════════════════════════════ */

const Notes = {
  _data:     null,   // null = not yet loaded
  _loading:  false,
  _queue:    [],     // resolve callbacks waiting on initial load
  _dirty:    false,
  _saveTimer: null,

  // ── LOAD ─────────────────────────────────────────────────────
  async load(force = false) {
    if (this._data !== null && !force) return this._data;
    if (this._loading) {
      return new Promise(res => this._queue.push(res));
    }
    this._loading = true;
    try {
      const r = await fetch('/api/notes');
      if (r.ok) {
        const d = await r.json();
        this._data = d && typeof d === 'object' ? d : {};
      } else {
        this._data = this._data || {};
      }
    } catch {
      this._data = this._data || {};
    }
    this._loading = false;
    this._queue.forEach(cb => cb(this._data));
    this._queue = [];
    return this._data;
  },

  // ── SAVE ─────────────────────────────────────────────────────
  async save() {
    if (!this._data) return;
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this._data),
      });
      this._dirty = false;
    } catch { /* silent */ }
  },

  // Debounced save — waits 2s after last edit
  _scheduleSave(statusId) {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    if (statusId) {
      const el = document.getElementById(statusId);
      if (el) { el.textContent = 'Saving…'; el.hidden = false; }
    }
    this._saveTimer = setTimeout(async () => {
      await this.save();
      if (statusId) {
        const el = document.getElementById(statusId);
        if (el) {
          el.textContent = 'Saved';
          setTimeout(() => { if (el) el.textContent = ''; }, 2000);
        }
      }
    }, 2000);
  },

  // ── GETTERS / SETTERS ────────────────────────────────────────
  getGeneral() {
    return (this._data && this._data.general) ? this._data.general : '';
  },

  getManorNotes() {
    return (this._data && this._data.manor_notes) ? this._data.manor_notes : '';
  },

  getImpression(npcId) {
    if (!this._data || !this._data.impressions) return '';
    return this._data.impressions[npcId] || '';
  },

  setGeneral(text, statusId) {
    if (!this._data) this._data = {};
    this._data.general = text;
    this._dirty = true;
    this._scheduleSave(statusId);
  },

  setManorNotes(text, statusId) {
    if (!this._data) this._data = {};
    this._data.manor_notes = text;
    this._dirty = true;
    this._scheduleSave(statusId);
  },

  setImpression(npcId, text, statusId) {
    if (!this._data) this._data = {};
    if (!this._data.impressions) this._data.impressions = {};
    this._data.impressions[npcId] = text;
    this._dirty = true;
    this._scheduleSave(statusId);
  },

  // ── DASHBOARD WIDGET ─────────────────────────────────────────
  buildDashboardWidget() {
    if (!this._data) return '';
    const general = this.getGeneral();
    if (!general.trim()) return '';

    const preview = general.length > 200 ? general.slice(0, 200) + '…' : general;
    return `<div class="card" style="border-top:3px solid var(--cobalt-mid);">
      <div class="section-title" style="margin-bottom:10px;">📝 My Notes</div>
      <div style="font-family:'EB Garamond',serif;font-size:0.9rem;color:var(--ink-soft);line-height:1.5;font-style:italic;white-space:pre-wrap;">${esc(preview)}</div>
      <div style="margin-top:10px;">
        <button class="btn btn-ghost" style="width:100%;" onclick="APP.switchTab('journal')">Open Journal →</button>
      </div>
    </div>`;
  },
};
