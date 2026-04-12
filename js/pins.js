/* ══════════════════════════════════════════════════════════════
   PINS — Persons of Interest
   Per-user list of pinned NPC IDs, persisted server-side.
══════════════════════════════════════════════════════════════ */

const PinsManager = {
  _pins: null,      // null = not yet loaded
  _loading: false,
  _queue: [],       // resolve callbacks waiting on initial load

  async load(force = false) {
    if (this._pins !== null && !force) return this._pins;
    if (this._loading) {
      return new Promise(res => this._queue.push(res));
    }
    this._loading = true;
    const res = await API.get('/api/pins');
    this._pins = (res.ok && Array.isArray(res.data?.pins)) ? res.data.pins : (this._pins || []);
    this._loading = false;
    this._queue.forEach(cb => cb(this._pins));
    this._queue = [];
    return this._pins;
  },

  async _save() {
    await API.post('/api/pins', { pins: this._pins }); // fire-and-forget
  },

  isPinned(npcId) {
    return Array.isArray(this._pins) && this._pins.includes(npcId);
  },

  // Toggle pin, refresh the NPC card in place, and refresh the dashboard widget.
  async toggleAndRefreshCard(npcId) {
    await this.load();
    const idx = this._pins.indexOf(npcId);
    if (idx === -1) {
      this._pins.push(npcId);
    } else {
      this._pins.splice(idx, 1);
    }
    this._save(); // fire-and-forget
    // Re-render the card to update the pin button state
    if (typeof Components !== 'undefined') {
      const npc = STORE.getNpc(npcId);
      if (npc) {
        if (CardPopup.isOpen()) {
          CardPopup.open(buildNpcCardHtml(npc));
        } else {
          Modal.open(buildNpcCardHtml(npc), { wide: true });
        }
      }
    }
    // Refresh dashboard pins widget
    if (typeof TabDashboard !== 'undefined') TabDashboard.render();
  },
};
