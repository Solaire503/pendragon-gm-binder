/* ══════════════════════════════════════════════════════════════
   TAB: JOURNAL — Private notes & GM write-to-player
══════════════════════════════════════════════════════════════ */

const TabJournal = {

  async render() {
    const panel = document.getElementById('tab-journal');
    if (!panel) return;

    // Ensure notes are loaded before rendering
    if (typeof Notes !== 'undefined') await Notes.load();

    const generalText = typeof Notes !== 'undefined' ? Notes.getGeneral()    : '';
    const manorText   = typeof Notes !== 'undefined' ? Notes.getManorNotes() : '';

    const gmSectionHtml = isGM() ? this._buildGmSection() : '';

    panel.innerHTML = `
      <div style="max-width:860px;margin:0 auto;padding:28px 24px;">

        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:24px;">
          <div class="page-title">Journal</div>
          <div class="page-subtitle" style="margin:0;">Your private notes</div>
        </div>

        <!-- GENERAL NOTES -->
        <div class="journal-section card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div class="section-title" style="margin-bottom:0;">General Notes</div>
            <span style="font-size:0.72rem;color:var(--ink-soft);font-style:italic;">
              auto-saves as you type &nbsp;<span class="journal-save-status" id="journal-general-status"></span>
            </span>
          </div>
          <div style="font-size:0.78rem;color:var(--ink-soft);margin-bottom:8px;font-style:italic;">
            Use @NPC Name to mention characters.
          </div>
          <textarea
            id="journal-general-ta"
            class="journal-textarea"
            placeholder="Record your thoughts, plans, and observations&#x2026;"
            oninput="TabJournal._onGeneralInput(this.value)"
          >${esc(generalText)}</textarea>
          <div style="margin-top:10px;border-top:1px dotted var(--vellum-deep);padding-top:10px;">
            <div class="section-title" style="font-size:0.7rem;opacity:0.8;margin-bottom:6px;">Preview</div>
            <div class="atm-rendered journal-preview" id="journal-general-preview">${typeof AtMention !== 'undefined' ? AtMention.render(generalText) : esc(generalText)}</div>
          </div>
        </div>

        <!-- MANOR NOTES -->
        <div class="journal-section card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div class="section-title" style="margin-bottom:0;">Manor Notes</div>
            <span style="font-size:0.72rem;color:var(--ink-soft);font-style:italic;">
              auto-saves as you type &nbsp;<span class="journal-save-status" id="journal-manor-status"></span>
            </span>
          </div>
          <div style="font-size:0.78rem;color:var(--ink-soft);margin-bottom:8px;font-style:italic;">
            Notes specific to your demesne &#x2014; steward instructions, upcoming repairs, plans.
          </div>
          <textarea
            id="journal-manor-ta"
            class="journal-textarea"
            placeholder="Manor management notes, plans, reminders&#x2026;"
            oninput="TabJournal._onManorInput(this.value)"
          >${esc(manorText)}</textarea>
          <div style="margin-top:10px;border-top:1px dotted var(--vellum-deep);padding-top:10px;">
            <div class="section-title" style="font-size:0.7rem;opacity:0.8;margin-bottom:6px;">Preview</div>
            <div class="atm-rendered journal-preview" id="journal-manor-preview">${typeof AtMention !== 'undefined' ? AtMention.render(manorText) : esc(manorText)}</div>
          </div>
        </div>

        ${gmSectionHtml}

      </div>`;

    // Wire @mention autocomplete on both textareas
    if (typeof AtMention !== 'undefined') {
      const generalTa = document.getElementById('journal-general-ta');
      const manorTa   = document.getElementById('journal-manor-ta');
      if (generalTa) AtMention._attach(generalTa);
      if (manorTa)   AtMention._attach(manorTa);
    }
  },

  // ── INPUT HANDLERS (debounced save) ──────────────────────────
  _onGeneralInput(value) {
    // Update preview
    const preview = document.getElementById('journal-general-preview');
    if (preview) preview.innerHTML = typeof AtMention !== 'undefined' ? AtMention.render(value) : esc(value);
    if (typeof Notes !== 'undefined') Notes.setGeneral(value, 'journal-general-status');
  },

  _onManorInput(value) {
    const preview = document.getElementById('journal-manor-preview');
    if (preview) preview.innerHTML = typeof AtMention !== 'undefined' ? AtMention.render(value) : esc(value);
    if (typeof Notes !== 'undefined') Notes.setManorNotes(value, 'journal-manor-status');
  },

  // ── GM WRITE-TO-PLAYER SECTION ───────────────────────────────
  _buildGmSection() {
    return `
      <div class="journal-section card" style="border-top:3px solid var(--verdigris-mid);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div class="section-title" style="margin-bottom:0;color:var(--verdigris-mid);">&#x2709; Write to Player</div>
          <span class="journal-save-status" id="journal-send-status"></span>
        </div>
        <div style="font-size:0.78rem;color:var(--ink-soft);margin-bottom:12px;font-style:italic;">
          Send a private note directly to a player&#x27;s journal. They will see it in their notes.
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;">
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-family:var(--font-heading);font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-soft);">Recipient</label>
            <select id="journal-player-select" class="edit-input edit-select" style="min-width:160px;">
              ${this._buildPlayerOptions()}
            </select>
          </div>
          <div style="flex:1;min-width:200px;display:flex;flex-direction:column;gap:4px;">
            <label style="font-family:var(--font-heading);font-size:0.55rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-soft);">Message</label>
            <textarea
              id="journal-player-msg"
              class="journal-textarea"
              style="min-height:100px;"
              placeholder="Write a private note to this player&#x2026;"
            ></textarea>
          </div>
        </div>
        <div class="btn-row" style="margin-top:12px;">
          <button class="btn btn-verdigris" onclick="TabJournal.sendToPlayer()">Send Note</button>
        </div>
      </div>`;
  },

  _buildPlayerOptions() {
    // Try to get player usernames from presence data (Multiplayer) or fall back to manor keys
    let players = [];
    if (typeof Multiplayer !== 'undefined' && Multiplayer._presenceUsers && Multiplayer._presenceUsers.length) {
      players = Multiplayer._presenceUsers
        .filter(u => u.role !== 'gm')
        .map(u => u.username || u.displayName || '');
    }
    // Fall back to manor players list if available
    if (!players.length && typeof STORE !== 'undefined') {
      STORE.manorKeys().forEach(key => {
        const m = STORE.getManor(key);
        if (m && m.player) players.push(m.player);
      });
    }
    // Deduplicate
    players = [...new Set(players.filter(Boolean))];

    if (!players.length) {
      return `<option value="">&#x2014; no players found &#x2014;</option>`;
    }
    return players.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  },

  async sendToPlayer() {
    const select   = document.getElementById('journal-player-select');
    const msgEl    = document.getElementById('journal-player-msg');
    const statusEl = document.getElementById('journal-send-status');

    if (!select || !msgEl) return;
    const username = select.value.trim();
    const message  = msgEl.value.trim();

    if (!username) { Toast.error('Select a player to send to'); return; }
    if (!message)  { Toast.error('Write a message first'); return; }

    if (statusEl) { statusEl.textContent = 'Sending\u2026'; statusEl.hidden = false; }

    try {
      const r = await fetch(`/api/notes/${encodeURIComponent(username)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        Toast.error(d.error || 'Failed to send note');
        if (statusEl) statusEl.textContent = '';
        return;
      }
      msgEl.value = '';
      Toast.success(`Note sent to ${username}`);
      if (statusEl) {
        statusEl.textContent = 'Sent \u2713';
        setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
      }
    } catch {
      Toast.error('Network error \u2014 note not sent');
      if (statusEl) statusEl.textContent = '';
    }
  },
};
