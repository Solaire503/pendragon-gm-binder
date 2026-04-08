/* ══════════════════════════════════════════════════════════════
   COMMENTS — Per-NPC threaded comments with edit/delete/reply
══════════════════════════════════════════════════════════════ */

const Comments = {
  _cache:      {},   // npcId → array of comment objects
  _loading:    {},   // npcId → boolean
  _cacheTime:  {},   // npcId → timestamp of last successful fetch (ms)

  // ── BUILD HTML (sync — returns placeholder if not cached yet) ──
  buildHtml(npcId) {
    const stale = !this._cache[npcId] || (Date.now() - (this._cacheTime[npcId] || 0) > 30000);
    if (stale) {
      // Kick off async load; placeholder will be replaced (or stale data shown briefly)
      this.loadForNpc(npcId);
    }
    if (!this._cache[npcId]) {
      return `<div id="comments-${esc(npcId)}" class="comments-section">
        <div class="text-muted" style="font-style:italic;padding:8px 0;">Loading comments\u2026</div>
      </div>`;
    }
    return this._renderSection(npcId);
  },

  _renderSection(npcId) {
    const comments = this._cache[npcId] || [];
    const topLevel = comments.filter(c => !c.parentId);
    const username = window.__USER__?.username || '';

    const addFormHtml = `
      <div class="comment-add-form" style="margin-bottom:16px;">
        <textarea
          id="comment-new-${esc(npcId)}"
          class="journal-textarea"
          style="min-height:70px;"
          placeholder="Add a comment\u2026 (supports @NPC mentions)"
        ></textarea>
        <div class="btn-row" style="margin-top:6px;">
          <button class="btn btn-primary" style="font-size:0.8rem;" onclick="Comments.post('${esc(npcId)}',null)">Post</button>
        </div>
      </div>`;

    const listHtml = topLevel.length
      ? topLevel.map(c => this._renderComment(c, npcId, comments, username, false)).join('')
      : '<div class="text-muted" style="font-style:italic;padding:4px 0;font-size:0.85rem;">No comments yet.</div>';

    return `<div id="comments-${esc(npcId)}" class="comments-section">
      ${addFormHtml}
      <div class="comments-list">${listHtml}</div>
    </div>`;
  },

  _renderComment(c, npcId, allComments, username, isReply) {
    const replies    = allComments.filter(r => r.parentId === c.id);
    const isOwn      = c.author === username;
    const isDeleted  = !!c.deleted;
    const ts         = this._relTime(c.timestamp);
    const editCount  = Array.isArray(c.history) ? c.history.length - 1 : 0;

    let bodyHtml;
    if (isDeleted) {
      if (isGM()) {
        bodyHtml = `<div class="comment-text comment-deleted"><del>${typeof AtMention !== 'undefined' ? AtMention.render(c.text || '') : esc(c.text || '')}</del> <span style="font-size:0.72rem;color:var(--crimson-mid);">[deleted${c.deletedBy ? ' by ' + esc(c.deletedBy) : ''}]</span></div>`;
      } else {
        bodyHtml = `<div class="comment-text comment-deleted">[Comment removed]</div>`;
      }
    } else {
      bodyHtml = `<div class="comment-text">${typeof AtMention !== 'undefined' ? AtMention.render(c.text || '') : esc(c.text || '')}</div>`;
    }

    // Edit history block (GM only)
    let historyHtml = '';
    if (isGM() && editCount > 0 && Array.isArray(c.history) && !isDeleted) {
      const versionsHtml = c.history.slice(0, -1).reverse().map((v, i) => `
        <div style="padding:4px 0;border-bottom:1px dotted var(--vellum-deep);font-size:0.78rem;color:var(--ink-soft);">
          <span style="font-family:var(--font-heading);font-size:0.55rem;letter-spacing:0.08em;text-transform:uppercase;opacity:0.6;">v${c.history.length - 1 - i}</span>
          <div style="margin-top:2px;">${esc(v.text || '')}</div>
          ${v.timestamp ? `<div style="font-size:0.68rem;opacity:0.5;margin-top:1px;">${this._relTime(v.timestamp)}</div>` : ''}
        </div>`).join('');
      const histId = `comment-hist-${esc(c.id)}`;
      historyHtml = `
        <div class="comment-history">
          <button class="btn btn-ghost" style="font-size:0.65rem;padding:1px 6px;" onclick="document.getElementById('${histId}').hidden=!document.getElementById('${histId}').hidden">
            [edited ${editCount} time${editCount !== 1 ? 's' : ''}]
          </button>
          <div id="${histId}" hidden style="margin-top:6px;padding-left:10px;border-left:2px solid var(--vellum-deep);">
            ${versionsHtml}
          </div>
        </div>`;
    }

    // Action buttons
    const editBtn    = isOwn && !isDeleted
      ? `<button class="btn btn-ghost comment-action-btn" onclick="Comments._openEditForm('${esc(c.id)}','${esc(npcId)}')">Edit</button>`
      : '';
    const deleteBtn  = (isOwn || isGM()) && !isDeleted
      ? `<button class="btn btn-ghost comment-action-btn" style="color:var(--crimson-mid);" onclick="Comments.del('${esc(c.id)}','${esc(npcId)}')">Delete</button>`
      : '';
    const replyBtn   = !isDeleted
      ? `<button class="btn btn-ghost comment-action-btn" onclick="Comments._openReplyForm('${esc(c.id)}','${esc(npcId)}')">Reply</button>`
      : '';
    // Restore: GM always, or player if they deleted their own comment (not if GM deleted it)
    const canRestore = isDeleted && (
      isGM() || (isOwn && c.deletedBy === username)
    );
    const restoreBtn = canRestore
      ? `<button class="btn btn-ghost comment-action-btn" style="color:var(--gold);" onclick="Comments.restore('${esc(c.id)}','${esc(npcId)}')">Restore</button>`
      : '';
    // Shred: GM only, permanently removes
    const shredBtn = isGM() && isDeleted
      ? `<button class="btn btn-ghost comment-action-btn" style="color:var(--crimson);" onclick="Comments.shred('${esc(c.id)}','${esc(npcId)}')">🗑 Shred</button>`
      : '';

    const actionsHtml = (editBtn || deleteBtn || replyBtn || restoreBtn || shredBtn)
      ? `<div class="comment-actions">${replyBtn}${editBtn}${deleteBtn}${restoreBtn}${shredBtn}</div>`
      : '';

    const repliesHtml = replies.length
      ? `<div class="comment-replies">${replies.map(r => this._renderComment(r, npcId, allComments, username, true)).join('')}</div>`
      : '';

    const itemClass = isReply ? 'comment-item comment-reply' : 'comment-item';
    const badgeColour = this._authorColour(c.author || '');

    return `<div class="${itemClass}" id="comment-item-${esc(c.id)}">
      <div class="comment-meta">
        <span class="comment-author-badge" style="background:${badgeColour};">${esc(c.author || 'unknown')}</span>
        <span style="color:var(--ink-soft);font-size:0.72rem;">${ts}</span>
        ${!isDeleted && isGM() && editCount > 0 ? '' : ''}
      </div>
      ${bodyHtml}
      ${historyHtml}
      ${actionsHtml}
      <div id="comment-reply-form-${esc(c.id)}" hidden style="margin-top:8px;">
        <textarea
          id="comment-reply-ta-${esc(c.id)}"
          class="journal-textarea"
          style="min-height:60px;"
          placeholder="Write a reply\u2026"
        ></textarea>
        <div class="btn-row" style="margin-top:4px;">
          <button class="btn btn-primary" style="font-size:0.78rem;" onclick="Comments.post('${esc(npcId)}','${esc(c.id)}')">Post Reply</button>
          <button class="btn btn-ghost"   style="font-size:0.78rem;" onclick="document.getElementById('comment-reply-form-${esc(c.id)}').hidden=true">Cancel</button>
        </div>
      </div>
      <div id="comment-edit-form-${esc(c.id)}" hidden style="margin-top:8px;">
        <textarea
          id="comment-edit-ta-${esc(c.id)}"
          class="journal-textarea"
          style="min-height:60px;"
        >${esc(c.text || '')}</textarea>
        <div class="btn-row" style="margin-top:4px;">
          <button class="btn btn-primary" style="font-size:0.78rem;" onclick="Comments.edit('${esc(c.id)}','${esc(npcId)}')">Save Edit</button>
          <button class="btn btn-ghost"   style="font-size:0.78rem;" onclick="document.getElementById('comment-edit-form-${esc(c.id)}').hidden=true">Cancel</button>
        </div>
      </div>
      ${repliesHtml}
    </div>`;
  },

  // ── LOAD ─────────────────────────────────────────────────────
  async loadForNpc(npcId) {
    if (this._loading[npcId]) return;
    this._loading[npcId] = true;
    try {
      const r = await fetch(`/api/comments/${encodeURIComponent(npcId)}`);
      if (r.ok) {
        const d = await r.json();
        this._cache[npcId] = Array.isArray(d.comments) ? d.comments : [];
        this._cacheTime[npcId] = Date.now();
      } else {
        // Keep existing cache if available rather than showing nothing
        if (!this._cache[npcId]) this._cache[npcId] = [];
      }
    } catch {
      // Keep existing cache if available rather than showing nothing
      if (!this._cache[npcId]) this._cache[npcId] = [];
    }
    this._loading[npcId] = false;
    // Replace placeholder in DOM if present
    this.refresh(npcId);
  },

  // ── REFRESH (replace section in DOM) ────────────────────────
  refresh(npcId) {
    const el = document.getElementById(`comments-${npcId}`);
    if (!el) return;
    const newSection = this._renderSection(npcId);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = newSection;
    const newEl = wrapper.firstElementChild;
    if (newEl) el.replaceWith(newEl);
    // Re-wire AtMention on new textareas
    if (typeof AtMention !== 'undefined') {
      const container = document.getElementById(`comments-${npcId}`);
      if (container) {
        container.querySelectorAll('textarea').forEach(ta => AtMention._attach(ta));
      }
    }
  },

  // ── POST ─────────────────────────────────────────────────────
  async post(npcId, parentId) {
    let taId, text;
    if (parentId) {
      const ta = document.getElementById(`comment-reply-ta-${parentId}`);
      text = ta ? ta.value.trim() : '';
    } else {
      const ta = document.getElementById(`comment-new-${npcId}`);
      text = ta ? ta.value.trim() : '';
    }

    if (!text) { Toast.error('Write something first'); return; }

    try {
      const r = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npcId, text, parentId: parentId || null }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        Toast.error(d.error || 'Failed to post comment');
        return;
      }
      const d = await r.json();
      if (!this._cache[npcId]) this._cache[npcId] = [];
      if (d.comment) this._cache[npcId].push(d.comment);
      this.refresh(npcId);
    } catch {
      Toast.error('Network error \u2014 comment not posted');
    }
  },

  // ── EDIT ─────────────────────────────────────────────────────
  async edit(commentId, npcId) {
    const ta = document.getElementById(`comment-edit-ta-${commentId}`);
    const text = ta ? ta.value.trim() : '';
    if (!text) { Toast.error('Comment cannot be empty'); return; }

    try {
      const r = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        Toast.error(d.error || 'Failed to edit comment');
        return;
      }
      const d = await r.json();
      if (d.comment && this._cache[npcId]) {
        const idx = this._cache[npcId].findIndex(c => c.id === commentId);
        if (idx !== -1) this._cache[npcId][idx] = d.comment;
      }
      this.refresh(npcId);
    } catch {
      Toast.error('Network error \u2014 edit not saved');
    }
  },

  // ── DELETE ───────────────────────────────────────────────────
  async del(commentId, npcId) {
    if (!confirm('Delete this comment?')) return;
    let r;
    try { r = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } }); }
    catch { Toast.error('Network error \u2014 comment not deleted'); return; }
    if (!r.ok) { const d = await r.json().catch(() => ({})); Toast.error(d.error || 'Failed to delete comment'); return; }
    const d = await r.json().catch(() => ({}));
    if (d.comment && this._cache[npcId]) {
      const idx = this._cache[npcId].findIndex(c => c.id === commentId);
      if (idx !== -1) this._cache[npcId][idx] = d.comment;
    }
    this.refresh(npcId);
  },

  // ── RESTORE ──────────────────────────────────────────────────
  async restore(commentId, npcId) {
    let r;
    try { r = await fetch(`/api/comments/${encodeURIComponent(commentId)}/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }); }
    catch { Toast.error('Network error \u2014 comment not restored'); return; }
    if (!r.ok) { const d = await r.json().catch(() => ({})); Toast.error(d.error || 'Failed to restore comment'); return; }
    const d = await r.json().catch(() => ({}));
    if (d.comment && this._cache[npcId]) {
      const idx = this._cache[npcId].findIndex(c => c.id === commentId);
      if (idx !== -1) this._cache[npcId][idx] = d.comment;
    }
    this.refresh(npcId);
  },

  // ── SHRED (permanent, GM only) ────────────────────────────────
  async shred(commentId, npcId) {
    if (!confirm('Permanently delete this comment? This cannot be undone.')) return;
    let r;
    try { r = await fetch(`/api/comments/${encodeURIComponent(commentId)}/shred`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }); }
    catch { Toast.error('Network error \u2014 comment not shredded'); return; }
    if (!r.ok) { const d = await r.json().catch(() => ({})); Toast.error(d.error || 'Failed to shred comment'); return; }
    if (this._cache[npcId]) {
      this._cache[npcId] = this._cache[npcId].filter(c => c.id !== commentId && c.parentId !== commentId);
    }
    this.refresh(npcId);
  },

  // ── FORM TOGGLES ────────────────────────────────────────────
  _openReplyForm(commentId, npcId) {
    const form = document.getElementById(`comment-reply-form-${commentId}`);
    if (!form) return;
    form.hidden = !form.hidden;
    if (!form.hidden) {
      const ta = document.getElementById(`comment-reply-ta-${commentId}`);
      if (ta) ta.focus();
    }
  },

  _openEditForm(commentId, npcId) {
    const form = document.getElementById(`comment-edit-form-${commentId}`);
    if (!form) return;
    form.hidden = !form.hidden;
    if (!form.hidden) {
      const ta = document.getElementById(`comment-edit-ta-${commentId}`);
      if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; }
    }
  },

  // ── HELPERS ──────────────────────────────────────────────────
  // LO-4: _relTime is duplicated in notifications.js. If a shared utils.js is
  // added in future, consolidate both copies there.
  _relTime(ts) {
    if (!ts) return '';
    const diff  = Date.now() - new Date(ts).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return 'just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days  < 30) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  },

  // Deterministic colour from username string
  _authorColour(username) {
    const COLOURS = [
      '#7a1c1c','#1e3a5f','#2d5a4a','#4a3a1e','#4a2070',
      '#5a5040','#1a6a3a','#6a3a20','#3a4a6a','#2a7a5a',
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) | 0;
    return COLOURS[Math.abs(hash) % COLOURS.length];
  },
};
