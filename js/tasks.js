/* ══════════════════════════════════════════════════════════════
   TASKS & REMINDERS
   Personal task lists + GM broadcast tasks + player→GM assignments.
   Stored in player_data/{username}/tasks.json (personal) and
   broadcast_tasks.json (app root, all users).
══════════════════════════════════════════════════════════════ */

const TasksManager = {
  _personal:     null,   // null = not yet loaded
  _broadcast:    null,
  _loading:      false,
  _queue:        [],
  _showCompleted: false,

  async load(force = false) {
    if (this._personal !== null && !force) return;
    if (this._loading) {
      return new Promise(res => this._queue.push(res));
    }
    this._loading = true;
    try {
      const r = await fetch('/api/tasks');
      const d = await r.json();
      this._personal  = Array.isArray(d.personal)  ? d.personal  : [];
      this._broadcast = Array.isArray(d.broadcast) ? d.broadcast : [];
    } catch {
      this._personal  = this._personal  || [];
      this._broadcast = this._broadcast || [];
    }
    this._loading = false;
    this._queue.forEach(cb => cb());
    this._queue = [];
  },

  async _refreshAndRender() {
    await this.load(true);
    if (typeof TabDashboard !== 'undefined') TabDashboard.render();
  },

  // ── PERSONAL TASKS ────────────────────────────────────────

  async addPersonal(text, priority) {
    if (!text || !text.trim()) return;
    try {
      const r = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), priority: !!priority }),
      });
      if (!r.ok) {
        const d = await r.json();
        Components.toast(d.error || 'Failed to save task', 'error');
        return;
      }
      await this._refreshAndRender();
    } catch {
      Components.toast('Failed to save task', 'error');
    }
  },

  async togglePersonal(id) {
    const task = (this._personal || []).find(t => t.id === id);
    if (!task) return;
    // Optimistic update
    task.completed   = !task.completed;
    task.completedAt = task.completed ? Date.now() / 1000 : null;
    if (typeof TabDashboard !== 'undefined') TabDashboard.render();
    try {
      await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: task.completed }),
      });
    } catch { /* silent — optimistic update stands */ }
  },

  async deletePersonal(id) {
    // Optimistic removal
    if (this._personal) this._personal = this._personal.filter(t => t.id !== id);
    if (typeof TabDashboard !== 'undefined') TabDashboard.render();
    try {
      await fetch(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch { /* silent */ }
  },

  openEditPersonal(id) {
    const task = (this._personal || []).find(t => t.id === id);
    if (!task) return;
    Modal.open(`
      <div class="modal-title">Edit Reminder</div>
      <div style="margin-top:16px;display:flex;flex-direction:column;gap:12px;">
        <textarea id="editTaskText" style="width:100%;min-height:80px;padding:8px;background:var(--vellum-deep);border:1px solid var(--vellum-deepest);border-radius:var(--radius);color:var(--ink);font-family:var(--font-body);font-size:0.9rem;resize:vertical;">${esc(task.text)}</textarea>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-family:var(--font-heading);font-size:0.65rem;letter-spacing:0.08em;color:var(--crimson-mid);">
          <input type="checkbox" id="editTaskPriority" style="accent-color:var(--crimson-mid);" ${task.priority ? 'checked' : ''}> ⚑ HIGH PRIORITY
        </label>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
          <button class="btn btn-ghost" style="padding:6px 16px;" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" style="padding:6px 16px;" onclick="TasksManager._saveEditPersonal('${id}')">Save</button>
        </div>
      </div>`);
  },

  async _saveEditPersonal(id) {
    const text     = document.getElementById('editTaskText')?.value || '';
    const priority = document.getElementById('editTaskPriority')?.checked || false;
    if (!text.trim()) { Components.toast('Task text cannot be empty', 'error'); return; }
    Modal.close();
    try {
      const r = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), priority }),
      });
      if (!r.ok) {
        const d = await r.json();
        Components.toast(d.error || 'Failed to save', 'error');
        return;
      }
      await this._refreshAndRender();
    } catch {
      Components.toast('Failed to save task', 'error');
    }
  },

  // ── BROADCAST TASKS (GM) ──────────────────────────────────

  async completeBroadcast(id) {
    const task = (this._broadcast || []).find(t => t.id === id);
    if (!task) return;
    // Optimistic
    task.completedAt = task.completedAt ? null : Date.now() / 1000;
    if (typeof TabDashboard !== 'undefined') TabDashboard.render();
    try {
      await fetch(`/api/tasks/broadcast/${encodeURIComponent(id)}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch { /* silent */ }
  },

  openAddBroadcast() {
    Modal.open(`
      <div class="modal-title">📢 Broadcast Task to All Players</div>
      <div style="margin-top:4px;font-size:0.85rem;color:var(--ink-soft);margin-bottom:16px;">This task will appear on every player's dashboard.</div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <textarea id="newBcastText" placeholder="What do players need to do?"
          style="width:100%;min-height:80px;padding:8px;background:var(--vellum-deep);border:1px solid var(--vellum-deepest);border-radius:var(--radius);color:var(--ink);font-family:var(--font-body);font-size:0.9rem;resize:vertical;"></textarea>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-family:var(--font-heading);font-size:0.65rem;letter-spacing:0.08em;color:var(--crimson-mid);">
          <input type="checkbox" id="newBcastPriority" style="accent-color:var(--crimson-mid);"> ⚑ HIGH PRIORITY
        </label>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
          <button class="btn btn-ghost" style="padding:6px 16px;" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" style="padding:6px 16px;" onclick="TasksManager._saveBroadcast()">Broadcast</button>
        </div>
      </div>`);
  },

  async _saveBroadcast() {
    const text     = document.getElementById('newBcastText')?.value || '';
    const priority = document.getElementById('newBcastPriority')?.checked || false;
    if (!text.trim()) { Components.toast('Task text cannot be empty', 'error'); return; }
    Modal.close();
    try {
      const r = await fetch('/api/tasks/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), priority }),
      });
      if (!r.ok) {
        const d = await r.json();
        Components.toast(d.error || 'Failed to broadcast', 'error');
        return;
      }
      await this._refreshAndRender();
      Components.toast('Task broadcast to all players', 'success');
    } catch {
      Components.toast('Failed to broadcast task', 'error');
    }
  },

  openEditBroadcast(id) {
    const task = (this._broadcast || []).find(t => t.id === id);
    if (!task) return;
    Modal.open(`
      <div class="modal-title">Edit Broadcast Task</div>
      <div style="margin-top:16px;display:flex;flex-direction:column;gap:12px;">
        <textarea id="editBcastText"
          style="width:100%;min-height:80px;padding:8px;background:var(--vellum-deep);border:1px solid var(--vellum-deepest);border-radius:var(--radius);color:var(--ink);font-family:var(--font-body);font-size:0.9rem;resize:vertical;">${esc(task.text)}</textarea>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-family:var(--font-heading);font-size:0.65rem;letter-spacing:0.08em;color:var(--crimson-mid);">
          <input type="checkbox" id="editBcastPriority" style="accent-color:var(--crimson-mid);" ${task.priority ? 'checked' : ''}> ⚑ HIGH PRIORITY
        </label>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          <button class="btn btn-ghost" style="padding:6px 14px;color:var(--crimson-mid);"
            onclick="if(confirm('Revoke this broadcast task from all players?'))TasksManager._revokeBroadcast('${id}')">✕ Revoke</button>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-ghost" style="padding:6px 16px;" onclick="Modal.close()">Cancel</button>
            <button class="btn btn-primary" style="padding:6px 16px;" onclick="TasksManager._saveEditBroadcast('${id}')">Save</button>
          </div>
        </div>
      </div>`);
  },

  async _saveEditBroadcast(id) {
    const text     = document.getElementById('editBcastText')?.value || '';
    const priority = document.getElementById('editBcastPriority')?.checked || false;
    if (!text.trim()) { Components.toast('Task text cannot be empty', 'error'); return; }
    Modal.close();
    try {
      const r = await fetch(`/api/tasks/broadcast/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), priority }),
      });
      if (!r.ok) {
        const d = await r.json();
        Components.toast(d.error || 'Failed to save', 'error');
        return;
      }
      await this._refreshAndRender();
    } catch {
      Components.toast('Failed to save task', 'error');
    }
  },

  async _revokeBroadcast(id) {
    Modal.close();
    try {
      await fetch(`/api/tasks/broadcast/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revoke: true }),
      });
      await this._refreshAndRender();
      Components.toast('Broadcast task revoked', 'success');
    } catch {
      Components.toast('Failed to revoke task', 'error');
    }
  },

  // ── ASSIGN TO GM (players) ────────────────────────────────

  openAssignToGm() {
    Modal.open(`
      <div class="modal-title">📨 Assign Reminder to GM</div>
      <div style="margin-top:4px;font-size:0.85rem;color:var(--ink-soft);margin-bottom:16px;">This will appear on the GM's task board with your name attached.</div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <textarea id="assignGmText" placeholder="What do you need from the GM?"
          style="width:100%;min-height:80px;padding:8px;background:var(--vellum-deep);border:1px solid var(--vellum-deepest);border-radius:var(--radius);color:var(--ink);font-family:var(--font-body);font-size:0.9rem;resize:vertical;"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">
          <button class="btn btn-ghost" style="padding:6px 16px;" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" style="padding:6px 16px;" onclick="TasksManager._saveAssignToGm()">Send to GM</button>
        </div>
      </div>`);
  },

  async _saveAssignToGm() {
    const text = document.getElementById('assignGmText')?.value || '';
    if (!text.trim()) { Components.toast('Task text cannot be empty', 'error'); return; }
    Modal.close();
    try {
      const r = await fetch('/api/tasks/assign-gm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!r.ok) {
        const d = await r.json();
        Components.toast(d.error || 'Failed to send', 'error');
        return;
      }
      Components.toast('Reminder sent to GM', 'success');
    } catch {
      Components.toast('Failed to send reminder', 'error');
    }
  },

  // ── INLINE ADD FROM WIDGET ────────────────────────────────

  _addFromWidget() {
    const inp = document.getElementById('tasks-new-input');
    const pri = document.getElementById('tasks-new-priority');
    if (!inp || !inp.value.trim()) return;
    const text     = inp.value.trim();
    const priority = pri ? pri.checked : false;
    inp.value = '';
    if (pri) pri.checked = false;
    this.addPersonal(text, priority);
  },

  toggleCompleted() {
    this._showCompleted = !this._showCompleted;
    if (typeof TabDashboard !== 'undefined') TabDashboard.render();
  },

  // ── BUILD DASHBOARD WIDGET ────────────────────────────────

  buildDashboardWidget() {
    if (this._personal === null) {
      this.load().then(() => {
        if (typeof TabDashboard !== 'undefined') TabDashboard.render();
      });
      return '';
    }

    const personal  = this._personal  || [];
    const broadcast = this._broadcast || [];
    const gm        = isGM();

    // Sort: priority first, then newest first
    const sortTasks = arr => [...arr].sort((a, b) => {
      if (a.priority && !b.priority) return -1;
      if (!a.priority && b.priority) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    const activeBcast      = sortTasks(broadcast.filter(t => !t.completedAt));
    const completedBcast   = broadcast.filter(t => !!t.completedAt)
                               .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    const activePersonal   = sortTasks(personal.filter(t => !t.completed));
    const completedPersonal = personal.filter(t => !!t.completed)
                               .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

    const hasActive    = activeBcast.length + activePersonal.length > 0;
    const hasCompleted = completedBcast.length + completedPersonal.length > 0;

    const renderTask = (task, type) => {
      const isDone    = type === 'broadcast' ? !!task.completedAt : !!task.completed;
      const priActive = task.priority && !isDone;

      const toggleFn = type === 'broadcast'
        ? `TasksManager.completeBroadcast('${task.id}')`
        : `TasksManager.togglePersonal('${task.id}')`;

      // Badges
      const assignedBadge = (type === 'personal' && task.assignedBy)
        ? `<span style="font-size:0.55rem;font-family:var(--font-heading);letter-spacing:0.06em;color:var(--gold);margin-left:4px;opacity:0.85;">📨 ${esc(task.assignedBy)}</span>`
        : '';
      const broadcastBadge = type === 'broadcast' && !isDone
        ? `<span style="font-size:0.55rem;font-family:var(--font-heading);letter-spacing:0.06em;color:var(--gold);margin-left:4px;opacity:0.75;">📢</span>`
        : '';

      // Action buttons (shown on hover via CSS) — hidden for observers
      const observer  = typeof isObserver !== 'undefined' && isObserver();
      const actionBtns = observer ? ''
        : type === 'broadcast' && gm
        ? `<button title="Edit" onclick="TasksManager.openEditBroadcast('${task.id}')" class="tasks-action-btn">✎</button>`
        : type === 'personal'
        ? `<button title="Edit" onclick="TasksManager.openEditPersonal('${task.id}')" class="tasks-action-btn">✎</button>
           <button title="Delete" onclick="TasksManager.deletePersonal('${task.id}')" class="tasks-action-btn tasks-action-del">✕</button>`
        : '';

      return `
        <div class="tasks-item${priActive ? ' tasks-item-priority' : ''}">
          <input type="checkbox" ${isDone ? 'checked' : ''} onchange="${toggleFn}"
            style="flex-shrink:0;margin-top:3px;cursor:pointer;accent-color:var(--verdigris-mid);">
          <span style="flex:1;min-width:0;font-size:0.85rem;line-height:1.4;word-break:break-word;${isDone ? 'text-decoration:line-through;opacity:0.42;' : priActive ? 'font-weight:600;color:var(--ink);' : ''}">${esc(task.text)}${assignedBadge}${broadcastBadge}</span>
          <span class="tasks-actions">${actionBtns}</span>
        </div>`;
    };

    const activeRows = [
      ...activeBcast.map(t   => renderTask(t, 'broadcast')),
      ...activePersonal.map(t => renderTask(t, 'personal')),
    ].join('');

    const completedRows = [
      ...completedBcast.map(t   => renderTask(t, 'broadcast')),
      ...completedPersonal.map(t => renderTask(t, 'personal')),
    ].join('');

    const completedSection = hasCompleted ? `
      <div style="margin-top:8px;">
        <button onclick="TasksManager.toggleCompleted()"
          style="background:none;border:none;cursor:pointer;color:var(--ink-soft);font-family:var(--font-heading);font-size:0.55rem;letter-spacing:0.08em;padding:0;display:flex;align-items:center;gap:4px;">
          ${this._showCompleted ? '▴' : '▾'} COMPLETED (${completedBcast.length + completedPersonal.length})
        </button>
        ${this._showCompleted ? `<div style="margin-top:6px;">${completedRows}</div>` : ''}
      </div>` : '';

    const observer = typeof isObserver !== 'undefined' && isObserver();
    const addForm = observer ? '' : `
      <div style="margin-top:10px;padding-top:8px;border-top:1px dotted var(--vellum-deep);">
        <div style="display:flex;gap:6px;align-items:center;">
          <input id="tasks-new-input" type="text" placeholder="New reminder…"
            style="flex:1;min-width:0;padding:4px 8px;background:var(--vellum-deep);border:1px solid var(--vellum-deepest);border-radius:var(--radius);color:var(--ink);font-family:var(--font-body);font-size:0.82rem;"
            onkeydown="if(event.key==='Enter')TasksManager._addFromWidget()">
          <label title="High Priority" style="display:flex;align-items:center;gap:3px;cursor:pointer;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.06em;color:var(--crimson-mid);white-space:nowrap;">
            <input type="checkbox" id="tasks-new-priority" style="accent-color:var(--crimson-mid);"> ⚑
          </label>
          <button onclick="TasksManager._addFromWidget()" class="btn btn-ghost" style="padding:4px 10px;font-size:0.7rem;white-space:nowrap;">Add</button>
        </div>
        <div style="display:flex;gap:12px;margin-top:6px;flex-wrap:wrap;">
          ${gm  ? `<button onclick="TasksManager.openAddBroadcast()" style="background:none;border:none;cursor:pointer;color:var(--gold);font-family:var(--font-heading);font-size:0.55rem;letter-spacing:0.08em;padding:0;">📢 Broadcast to all players</button>` : ''}
          ${!gm ? `<button onclick="TasksManager.openAssignToGm()" style="background:none;border:none;cursor:pointer;color:var(--gold);font-family:var(--font-heading);font-size:0.55rem;letter-spacing:0.08em;padding:0;">📨 Assign task to GM</button>` : ''}
        </div>
      </div>`;

    return `
      <div class="card" style="border-top:3px solid var(--gold);">
        <div class="section-title" style="margin-bottom:10px;">📋 Tasks &amp; Reminders</div>
        ${!hasActive ? `<div style="font-style:italic;color:var(--ink-soft);font-size:0.82rem;padding:2px 0 6px;">No active reminders.</div>` : activeRows}
        ${completedSection}
        ${addForm}
      </div>`;
  },
};
