/* ==============================================================
   MULTIPLAYER.JS — Broadcast messages, presence / who's online
   Polling-based (no WebSockets). Loaded before app.js.
============================================================== */

const Multiplayer = {

  // ── STATE ────────────────────────────────────────────────────
  _broadcastSince:   0,       // timestamp of last broadcast seen
  _broadcastTimer:   null,
  _heartbeatTimer:   null,
  _presenceTimer:    null,
  _presenceUsers:    [],      // cached list from last poll
  _presenceExpanded: false,

  // ── INIT ─────────────────────────────────────────────────────
  init() {
    // Heartbeat — tell the server we're here (every 15s)
    this._sendHeartbeat();
    this._heartbeatTimer = setInterval(() => this._sendHeartbeat(), 15000);

    // Poll broadcasts (every 10s)
    this._pollBroadcasts();
    this._broadcastTimer = setInterval(() => this._pollBroadcasts(), 10000);

    // Poll presence (every 15s, offset from heartbeat)
    setTimeout(() => {
      this._pollPresence();
      this._presenceTimer = setInterval(() => this._pollPresence(), 15000);
    }, 3000);

    // Render presence widget in header
    this._injectPresenceWidget();

    // Pause timers when tab is backgrounded (battery / data on mobile).
    // Resume + run an immediate poll when the tab returns to foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
        if (this._broadcastTimer) { clearInterval(this._broadcastTimer); this._broadcastTimer = null; }
        if (this._presenceTimer)  { clearInterval(this._presenceTimer);  this._presenceTimer  = null; }
      } else {
        if (!this._heartbeatTimer) {
          this._sendHeartbeat();
          this._heartbeatTimer = setInterval(() => this._sendHeartbeat(), 15000);
        }
        if (!this._broadcastTimer) {
          this._pollBroadcasts();
          this._broadcastTimer = setInterval(() => this._pollBroadcasts(), 10000);
        }
        if (!this._presenceTimer) {
          this._pollPresence();
          this._presenceTimer = setInterval(() => this._pollPresence(), 15000);
        }
      }
    });

    // Render broadcast input on GM dashboard (deferred — dashboard may not be rendered yet)
    // This is called from TabDashboard.render() instead.
  },

  // ── HEARTBEAT ────────────────────────────────────────────────
  async _sendHeartbeat() {
    try {
      await fetch('/api/heartbeat', { method: 'POST' });
    } catch (e) { /* silent */ }
  },

  // ── BROADCASTS ───────────────────────────────────────────────
  async _pollBroadcasts() {
    try {
      const r = await fetch('/api/broadcasts?since=' + this._broadcastSince);
      if (!r.ok) return;
      const data = await r.json();
      if (data.broadcasts && data.broadcasts.length) {
        data.broadcasts.forEach(b => this._showBroadcast(b));
        // Update since to the latest timestamp
        const latest = data.broadcasts[data.broadcasts.length - 1];
        this._broadcastSince = latest.timestamp;
      }
    } catch (e) { /* silent */ }
  },

  _showBroadcast(b) {
    // Show as a prominent banner at the top of the page
    const existing = document.getElementById('broadcast-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'broadcast-banner';
    banner.className = 'broadcast-banner';
    banner.innerHTML =
      '<span class="broadcast-icon">\uD83D\uDCE3</span>' +
      '<span class="broadcast-text">' + this._escHtml(b.message) + '</span>' +
      '<span class="broadcast-sender">-- ' + this._escHtml(b.sender) + '</span>' +
      '<button class="broadcast-dismiss" onclick="Multiplayer.dismissBroadcast()" title="Dismiss">\u2715</button>';

    // Insert after header, before main
    const header = document.querySelector('.app-header');
    if (header && header.nextSibling) {
      header.parentNode.insertBefore(banner, header.nextSibling);
    } else {
      document.getElementById('app')?.prepend(banner);
    }

    // Also show a toast for extra visibility
    Toast.show('\uD83D\uDCE3 ' + b.message, 'broadcast', 6000);
  },

  dismissBroadcast() {
    const el = document.getElementById('broadcast-banner');
    if (el) el.remove();
  },

  // ── BROADCAST SEND (GM) ──────────────────────────────────────
  async sendBroadcast() {
    const input = document.getElementById('broadcast-input');
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) { Toast.error('Enter a message to broadcast'); return; }

    try {
      const r = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      if (!r.ok) {
        const data = await r.json();
        Toast.error(data.error || 'Broadcast failed');
        return;
      }
      input.value = '';
      Toast.success('Broadcast sent');
    } catch (e) {
      Toast.error('Failed to send broadcast');
    }
  },

  /** Returns HTML for the GM broadcast input, injected into the dashboard. */
  gmBroadcastHtml() {
    if (!isGM()) return '';
    return '<div class="card broadcast-card" style="border-top:3px solid var(--gold);">' +
      '<div class="section-title">\uD83D\uDCE3 Send Broadcast</div>' +
      '<div class="broadcast-form">' +
        '<input id="broadcast-input" class="broadcast-field" type="text" ' +
          'placeholder="Announce something to all players\u2026" maxlength="500" ' +
          'onkeydown="if(event.key===\'Enter\')Multiplayer.sendBroadcast()">' +
        '<button class="btn btn-primary broadcast-send-btn" onclick="Multiplayer.sendBroadcast()">Send</button>' +
      '</div>' +
    '</div>';
  },

  // ── PRESENCE ─────────────────────────────────────────────────
  async _pollPresence() {
    try {
      const r = await fetch('/api/presence');
      if (!r.ok) return;
      const data = await r.json();
      this._presenceUsers = data.users || [];
      this._renderPresenceWidget();
    } catch (e) { /* silent */ }
  },

  _injectPresenceWidget() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight) return;

    // Insert before the first child (leftmost position in header-right)
    const widget = document.createElement('div');
    widget.className = 'presence-widget';
    widget.id = 'presenceWidget';
    widget.innerHTML = '<span class="presence-dot"></span><span class="presence-count">…</span>';
    widget.title = 'Online users';
    widget.addEventListener('click', () => {
      this._presenceExpanded = !this._presenceExpanded;
      this._renderPresenceWidget();
    });
    headerRight.prepend(widget);
  },

  _renderPresenceWidget() {
    const widget = document.getElementById('presenceWidget');
    if (!widget) return;

    const users  = this._presenceUsers;
    const count  = users.length;

    widget.innerHTML =
      '<span class="presence-dot"></span>' +
      '<span class="presence-count">' + count + ' online</span>';

    // Remove existing dropdown
    const oldDrop = document.getElementById('presenceDropdown');
    if (oldDrop) oldDrop.remove();

    if (this._presenceExpanded && count > 0) {
      const drop = document.createElement('div');
      drop.id = 'presenceDropdown';
      drop.className = 'presence-dropdown';

      const listHtml = users.map(u => {
        const roleLabel = u.role === 'gm' ? 'GM' : '';
        return '<div class="presence-user">' +
          '<span class="presence-dot-sm"></span>' +
          '<span class="presence-name">' + this._escHtml(u.displayName) + '</span>' +
          (roleLabel ? '<span class="presence-role">' + roleLabel + '</span>' : '') +
        '</div>';
      }).join('');

      drop.innerHTML = '<div class="presence-header">Who\'s Online</div>' + listHtml;
      widget.appendChild(drop);

      // Close on outside click
      const closer = (e) => {
        if (!widget.contains(e.target)) {
          this._presenceExpanded = false;
          this._renderPresenceWidget();
          document.removeEventListener('click', closer);
        }
      };
      setTimeout(() => document.addEventListener('click', closer), 0);
    }
  },

  // ── UTIL ─────────────────────────────────────────────────────
  _escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },
};
