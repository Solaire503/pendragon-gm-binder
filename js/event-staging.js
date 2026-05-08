/* ══════════════════════════════════════════════════════════════
   EVENT-STAGING.JS — Stage NPCs for winter phase event rolls
   localStorage-backed, GM-only. Mirrors PinsManager pattern.
══════════════════════════════════════════════════════════════ */

const EventStaging = {
  _KEY: 'pb_event_staging',
  _ids: null,

  load() {
    if (this._ids !== null) return this._ids;
    try {
      const raw = localStorage.getItem(this._KEY);
      const arr = raw ? JSON.parse(raw) : [];
      this._ids = Array.isArray(arr)
        ? arr.filter(id => typeof id === 'string' && STORE.getNpc(id)?.status !== 'Dead')
        : [];
    } catch {
      this._ids = [];
    }
    return this._ids;
  },

  _save() {
    localStorage.setItem(this._KEY, JSON.stringify(this._ids || []));
  },

  isStaged(npcId) {
    this.load();
    return this._ids.includes(npcId);
  },

  toggle(npcId) {
    this.load();
    const idx = this._ids.indexOf(npcId);
    if (idx === -1) {
      this._ids.push(npcId);
    } else {
      this._ids.splice(idx, 1);
    }
    this._save();
  },

  toggleAndRefreshCard(npcId, event) {
    this.toggle(npcId);
    const btn = event?.target?.closest('.stage-btn');
    if (btn) {
      const staged = this.isStaged(npcId);
      btn.classList.toggle('stage-active', staged);
      btn.title = staged ? 'Remove from event staging list' : 'Stage for winter phase events';
      btn.innerHTML = staged ? '🎲 Staged' : '🎲 Stage';
    }
  },

  buildButtonHtml(npcId) {
    if (!isGM()) return '';
    const staged = this.isStaged(npcId);
    return `<button class="btn btn-ghost stage-btn${staged ? ' stage-active' : ''}"
            onclick="EventStaging.toggleAndRefreshCard('${npcId}', event)"
            title="${staged ? 'Remove from event staging list' : 'Stage for winter phase events'}">
      ${staged ? '🎲 Staged' : '🎲 Stage'}
    </button>`;
  },

  getIds() {
    this.load();
    return this._ids.filter(id => {
      const npc = STORE.getNpc(id);
      return npc && npc.status !== 'Dead';
    });
  },

  count() {
    return this.getIds().length;
  },

  clear() {
    this._ids = [];
    this._save();
  },
};
