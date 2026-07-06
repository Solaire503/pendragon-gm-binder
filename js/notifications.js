/* ══════════════════════════════════════════════════════════════
   NOTIFICATIONS — Bell badge, panel, polling
══════════════════════════════════════════════════════════════ */

const Notifications = {
  _data:         [],    // array of notification objects from server
  _timer:        null,
  _loading:      false,

  // ── POLLING ──────────────────────────────────────────────────
  startPolling() {
    this.load();
    this._timer = setInterval(() => this.load(), 30000);
  },

  stopPolling() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  },

  // ── LOAD ─────────────────────────────────────────────────────
  async load() {
    // Skip expensive polls when tab is hidden
    if (document.hidden) return;
    if (this._loading) return;
    this._loading = true;
    const res = await API.get('/api/notifications');
    if (res.ok) {
      this._data = Array.isArray(res.data?.notifications) ? res.data.notifications : [];
      this._updateBadge();
    }
    this._loading = false;
  },

  // ── BADGE ────────────────────────────────────────────────────
  _updateBadge() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const unread = this._data.filter(n => !n.read).length;
    if (unread > 0) {
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  },

  // ── MARK READ ────────────────────────────────────────────────
  async markRead(ids) {
    if (!ids || !ids.length) return;
    const res = await API.post('/api/notifications/read', { ids });
    if (!res.ok) return;
    ids.forEach(id => {
      const n = this._data.find(x => x.id === id);
      if (n) n.read = true;
    });
    this._updateBadge();
  },

  async markAllRead() {
    const ids = this._data.filter(n => !n.read).map(n => n.id);
    if (!ids.length) return;
    const res = await API.post('/api/notifications/read', { all: true });
    if (!res.ok) {
      Toast.error('Could not mark all as read');
      return;
    }
    this._data.forEach(n => { n.read = true; });
    this._updateBadge();
    // Re-render panel if open
    const panelEl = document.getElementById('notif-panel-list');
    if (panelEl) panelEl.innerHTML = this._buildListHtml();
  },

  // ── PANEL ────────────────────────────────────────────────────
  openPanel() {
    const html = `
      <div style="min-width:min(400px,92vw);max-height:70vh;display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div class="page-title" style="font-size:1rem;margin:0;">🔔 Notifications</div>
          <button class="btn btn-ghost" style="font-size:0.72rem;" onclick="Notifications._panelMarkAll()">Mark all read</button>
        </div>
        <div id="notif-panel-list" style="overflow-y:auto;flex:1;">
          ${this._buildListHtml()}
        </div>
        <div class="btn-row" style="margin-top:12px;">
          <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        </div>
      </div>`;
    Modal.open(html);
  },

  async _panelMarkAll() {
    await this.markAllRead();
    const panelEl = document.getElementById('notif-panel-list');
    if (panelEl) panelEl.innerHTML = this._buildListHtml();
  },

  _buildListHtml() {
    if (!this._data.length) {
      return '<div class="text-muted" style="padding:20px;text-align:center;font-style:italic;">No notifications yet.</div>';
    }
    return this._data.slice().reverse().map(n => {
      const icon = n.type === 'comment'    ? '💬'
                 : n.type === 'note'       ? '📝'
                 : n.type === 'chronicle'  ? '📜'
                 : n.type === 'npc_edit'   ? '✎'
                 : '🔔';
      const ts = relTime(n.timestamp);
      const unreadClass = n.read ? '' : ' notif-unread';
      const clickHandler = n.link
        ? `onclick="Notifications._openNotif('${esc(n.id)}','${esc(n.link || '')}')"`
        : `onclick="Notifications._openNotif('${esc(n.id)}','')"`;
      return `<div class="notif-item${unreadClass}" role="button" tabindex="0" ${clickHandler}>
        <span class="notif-icon">${icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.88rem;color:var(--ink);line-height:1.4;">${esc(n.text || '')}</div>
          <div style="font-size:0.72rem;color:var(--ink-soft);margin-top:2px;">${ts}</div>
        </div>
        ${!n.read ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--gold);flex-shrink:0;margin-top:4px;"></span>' : ''}
      </div>`;
    }).join('');
  },

  async _openNotif(id, link) {
    await this.markRead([id]);
    // Refresh panel if open
    const panelEl = document.getElementById('notif-panel-list');
    if (panelEl) panelEl.innerHTML = this._buildListHtml();
    // If there's an NPC link, open the card
    if (link) {
      Modal.close();
      if (typeof Components !== 'undefined') Components.openNpcCard(link);
    }
  },

};
