/* ══════════════════════════════════════════════════════════════
   AT-MENTION  — @Name autocomplete + linked mentions throughout
   the GM Binder.

   Usage:
     AtMention.init()           — call once on app startup;
                                  auto-attaches to all future textareas
                                  via MutationObserver.

     AtMention.render(rawText)  — call wherever note text is displayed.
                                  Converts @[Name](id) tokens to
                                  hoverable, clickable spans. Handles
                                  its own HTML escaping for surrounding text.

   Storage format:  @[Sir Beautrix Thurgwin](npc-abc123)
   The ID is canonical; the name inside [] is a snapshot that falls
   back gracefully if the NPC is later deleted or renamed.
══════════════════════════════════════════════════════════════ */

const AtMention = {

  _dropdown:   null,
  _tooltip:    null,
  _target:     null,   // the textarea currently being typed in
  _atStart:    -1,     // char index of the @ that triggered the search

  // ── INIT — call once; auto-attaches via MutationObserver ──
  init() {
    this._injectStyles();

    // Auto-attach to any textarea/text-input added to the DOM from now on
    const obs = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.matches('textarea, input[type="text"]')) {
            this._attach(node);
          }
          node.querySelectorAll('textarea, input[type="text"]').forEach(el => {
            this._attach(el);
          });
        });
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // Also catch any textareas already in the DOM at init time
    document.querySelectorAll('textarea, input[type="text"]').forEach(el => {
      this._attach(el);
    });
  },

  // ── ATTACH ────────────────────────────────────────────────
  _attach(input) {
    if (input._atMentionBound) return;
    input._atMentionBound = true;

    input.addEventListener('input', e => this._onInput(e));
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') this._hide();
      // Arrow keys to navigate dropdown — future enhancement slot
    });
    input.addEventListener('blur', () => {
      // Slight delay so mousedown on dropdown fires first
      setTimeout(() => this._hide(), 160);
    });
  },

  // ── INPUT HANDLER ─────────────────────────────────────────
  _onInput(e) {
    const input = e.target;
    const val   = input.value;
    const pos   = input.selectionStart;

    // Walk back from cursor to find a bare @
    let atIdx = -1;
    for (let i = pos - 1; i >= 0; i--) {
      if (val[i] === '@') { atIdx = i; break; }
      // Stop at whitespace or newline — the @ must be contiguous
      if (val[i] === ' ' || val[i] === '\n' || val[i] === '\t') break;
    }

    if (atIdx === -1) { this._hide(); return; }

    const query = val.slice(atIdx + 1, pos).toLowerCase();
    this._atStart = atIdx;
    this._target  = input;

    // Search living + dead
    const all = [
      ...(STORE.living || []),
      ...(STORE.dead   || []),
    ];
    const matches = all
      .filter(n => n.name && n.name.toLowerCase().includes(query))
      .sort((a, b) => {
        // Prefer starts-with over contains
        const aq = a.name.toLowerCase().startsWith(query) ? 0 : 1;
        const bq = b.name.toLowerCase().startsWith(query) ? 0 : 1;
        return aq - bq || a.name.localeCompare(b.name);
      })
      .slice(0, 10);

    if (!matches.length) { this._hide(); return; }
    this._showDropdown(matches, input);
  },

  // ── DROPDOWN ──────────────────────────────────────────────
  _showDropdown(matches, input) {
    const dd = this._ensureDropdown();
    dd.innerHTML = matches.map(n => {
      const isDead = !!(STORE.dead || []).find(d => d.id === n.id);
      return `<div class="atm-item" data-id="${n.id}" data-name="${this._esc(n.name)}">
        <span class="atm-item-name${isDead ? ' atm-dead' : ''}">${this._esc(n.name)}</span>
        ${n.role      ? `<span class="atm-item-role">${this._esc(n.role)}</span>` : ''}
        ${isDead      ? `<span class="atm-item-dead">✝</span>` : ''}
      </div>`;
    }).join('');
    dd.style.display = 'block';
    this._positionDropdown(dd, input);
  },

  _positionDropdown(dd, input) {
    const rect = input.getBoundingClientRect();
    const W    = 270;
    let left   = rect.left + window.scrollX;
    const top  = rect.bottom + window.scrollY + 3;
    if (left + W > window.innerWidth - 8) left = window.innerWidth - W - 8;
    dd.style.left  = left + 'px';
    dd.style.top   = top  + 'px';
    dd.style.width = W    + 'px';
  },

  _hide() {
    if (this._dropdown) this._dropdown.style.display = 'none';
    this._atStart = -1;
    this._target  = null;
  },

  _ensureDropdown() {
    if (!this._dropdown) {
      const dd = document.createElement('div');
      dd.id        = 'atm-dropdown';
      dd.className = 'atm-dropdown';
      dd.addEventListener('mousedown', e => {
        const item = e.target.closest('.atm-item');
        if (!item) return;
        e.preventDefault();
        this._insert(item.dataset.id, item.dataset.name);
      });
      document.body.appendChild(dd);
      this._dropdown = dd;
    }
    return this._dropdown;
  },

  // ── INSERT TOKEN ──────────────────────────────────────────
  _insert(id, name) {
    const input  = this._target;
    if (!input) return;
    const val    = input.value;
    const pos    = input.selectionStart;
    const before = val.slice(0, this._atStart);
    const after  = val.slice(pos);
    const token  = `@[${name}](${id})`;
    input.value  = before + token + after;
    const newPos = before.length + token.length;
    input.selectionStart = input.selectionEnd = newPos;
    // Fire input event so any listeners (e.g. Vue/React — not used here, but good practice) pick up the change
    input.dispatchEvent(new Event('input', { bubbles: true }));
    this._hide();
  },

  // ── RENDER ────────────────────────────────────────────────
  // Converts raw stored text that may contain @[Name](id) tokens
  // into safe HTML with clickable, hoverable mention spans.
  // Also handles escaping of all surrounding text.
  // Pass this function INSTEAD of a plain escape wherever note
  // fields are displayed.
  render(rawText) {
    if (!rawText) return '';
    const TOKEN = /@\[([^\]]*)\]\(([^)]+)\)/g;
    let result  = '';
    let last    = 0;
    let m;
    while ((m = TOKEN.exec(rawText)) !== null) {
      // Escape the plain text before this token
      result += this._escNl(rawText.slice(last, m.index));
      const storedName = m[1];
      const id         = m[2];
      // Always resolve name from store — handles renames gracefully
      const npc         = STORE.getNpc && STORE.getNpc(id);
      const displayName = npc ? npc.name : storedName;
      result += `<span class="npc-mention" data-npc-id="${this._esc(id)}" role="button" tabindex="0" ` +
        `onmouseenter="AtMention._showTooltip(event,'${this._esc(id)}')" ` +
        `onmouseleave="AtMention._hideTooltip()" ` +
        `onclick="AtMention.peekCard('${this._esc(id)}')" ` +
        `>@${this._esc(displayName)}</span>`;
      last = m.index + m[0].length;
    }
    result += this._escNl(rawText.slice(last));
    return result;
  },

  // ── PEEK CARD ─────────────────────────────────────────────
  // Opens an NPC card from an @mention click.
  // • Always hides the hover tooltip first (fixes tooltip-stuck bug).
  // • If a modal is already open, pushes the current content onto
  //   Modal._stack so the user can hit ← Back (fixes card-closes bug).
  peekCard(id) {
    this._hideTooltip();
    const overlay = document.getElementById('modalOverlay');
    const content = document.getElementById('modalContent');
    const box     = document.getElementById('modalBox');
    if (overlay && !overlay.hidden && content && content.innerHTML.trim()) {
      // Modal is already open — save its state, then let openNpcCard replace it
      Modal._stack.push({ html: content.innerHTML, className: box ? box.className : 'modal-box' });
      Components.openNpcCard(id);
      // Inject the ← Back button at the very top of the freshly-rendered card
      content.insertAdjacentHTML('afterbegin',
        '<button class="btn btn-ghost modal-back-btn" onclick="Modal.pop()" ' +
        'style="margin-bottom:12px;">← Back</button>');
    } else {
      Components.openNpcCard(id);
    }
  },

  // ── TOOLTIP ───────────────────────────────────────────────
  _showTooltip(evt, id) {
    const npc = STORE.getNpc && STORE.getNpc(id);
    if (!npc) return;
    const tt = this._ensureTooltip();

    const age   = npc.year_born ? `${STORE.year - npc.year_born} yrs` : null;
    const glory = npc.glory     ? `${Number(npc.glory).toLocaleString()} Glory` : null;
    const isDead = !!(STORE.dead || []).find(d => d.id === id);

    // Find spouse from relationships if available
    let spouseName = null;
    if (STORE.getRelationships) {
      const rels = STORE.getRelationships(npc.id);
      const sp   = rels.find(r => r.type === 'Spouse' || r.type === 'Betrothed');
      if (sp) {
        const spId  = sp.sourceId === npc.id ? sp.targetId : sp.sourceId;
        const spNpc = STORE.getNpc(spId);
        spouseName  = spNpc ? spNpc.name : null;
      }
    }

    const rows = [
      npc.role    ? `<div class="atm-tt-row"><span class="atm-tt-k">Role</span><span>${this._esc(npc.role)}</span></div>` : '',
      age         ? `<div class="atm-tt-row"><span class="atm-tt-k">Age</span><span>${age}${isDead ? ' ✝' : ''}</span></div>` : '',
      glory       ? `<div class="atm-tt-row"><span class="atm-tt-k">Glory</span><span>${glory}</span></div>` : '',
      npc.household ? `<div class="atm-tt-row"><span class="atm-tt-k">House</span><span>${this._esc(npc.household)}</span></div>` : '',
      spouseName  ? `<div class="atm-tt-row"><span class="atm-tt-k">Spouse</span><span>${this._esc(spouseName)}</span></div>` : '',
      (npc.personalityNote) ? `<div class="atm-tt-traits">${this._esc(npc.personalityNote.slice(0, 90))}${npc.personalityNote.length > 90 ? '…' : ''}</div>` : '',
    ].filter(Boolean).join('');

    tt.innerHTML = `
      <div class="atm-tt-name${isDead ? ' atm-tt-dead' : ''}">${this._esc(npc.name)}</div>
      ${rows}
      <div class="atm-tt-hint">Click to open card</div>`;
    tt.style.display = 'block';
    this._positionTooltip(tt, evt);
  },

  _hideTooltip() {
    if (this._tooltip) this._tooltip.style.display = 'none';
  },

  _ensureTooltip() {
    if (!this._tooltip) {
      const tt     = document.createElement('div');
      tt.id        = 'atm-tooltip';
      tt.className = 'atm-tooltip';
      tt.style.display = 'none';
      document.body.appendChild(tt);
      this._tooltip = tt;
    }
    return this._tooltip;
  },

  _positionTooltip(tt, evt) {
    const tw = tt.offsetWidth  || 210;
    const th = tt.offsetHeight || 110;
    let x    = evt.clientX + 14;
    let y    = evt.clientY + 14;
    if (x + tw > window.innerWidth  - 8) x = evt.clientX - tw - 8;
    if (y + th > window.innerHeight - 8) y = evt.clientY - th - 8;
    tt.style.left = x + 'px';
    tt.style.top  = y + 'px';
  },

  // ── UTILITIES ─────────────────────────────────────────────
  _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  // Like _esc but also converts newlines to <br> for display
  _escNl(s) {
    return this._esc(s).replace(/\n/g, '<br>');
  },

  // ── STYLES ────────────────────────────────────────────────
  _injectStyles() {
    if (document.getElementById('atm-styles')) return;
    const s   = document.createElement('style');
    s.id      = 'atm-styles';
    s.textContent = `
/* ── MENTION SPAN (rendered in display text) ──── */
.npc-mention {
  display: inline;
  color: var(--gold, #c8a84b);
  font-weight: 600;
  cursor: pointer;
  border-bottom: 1px dotted var(--gold, #c8a84b);
  transition: color 0.12s, border-color 0.12s;
}
.npc-mention:hover {
  color: #8a5a00;
  border-bottom-color: #8a5a00;
}

/* ── AUTOCOMPLETE DROPDOWN ────────────────────── */
.atm-dropdown {
  position: absolute;
  z-index: 10000;
  background: #fffcf0;
  border: 1px solid var(--gold, #c8a84b);
  border-radius: 4px;
  box-shadow: 0 4px 18px rgba(0,0,0,0.18);
  overflow: hidden;
  font-family: var(--font-body, 'EB Garamond', serif);
  font-size: 0.88rem;
}

.atm-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  cursor: pointer;
  transition: background 0.1s;
  border-bottom: 1px solid #f0e8d0;
}
.atm-item:last-child { border-bottom: none; }
.atm-item:hover { background: #f5ead8; }

.atm-item-name {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ink, #2a1e0e);
  flex: 1;
}
.atm-item-name.atm-dead { color: var(--ink-soft, #7a6a4a); font-style: italic; }

.atm-item-role {
  font-size: 0.72rem;
  color: var(--ink-soft, #7a6a4a);
  flex-shrink: 0;
}
.atm-item-dead {
  font-size: 0.72rem;
  color: var(--ink-soft, #7a6a4a);
  flex-shrink: 0;
}

/* ── HOVER TOOLTIP ───────────────────────────── */
.atm-tooltip {
  position: fixed;
  z-index: 10001;
  background: #fffcf0;
  border: 1px solid var(--gold, #c8a84b);
  border-radius: 5px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  padding: 10px 13px 8px;
  min-width: 180px;
  max-width: 260px;
  font-family: var(--font-body, 'EB Garamond', serif);
  font-size: 0.84rem;
  color: var(--ink, #2a1e0e);
  pointer-events: none;
}
.atm-tt-name {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.82rem;
  font-weight: 700;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--gold, #c8a84b);
  padding-bottom: 4px;
}
.atm-tt-name.atm-tt-dead {
  font-style: italic;
  color: var(--ink-soft, #7a6a4a);
}
.atm-tt-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 0.8rem;
  margin-bottom: 2px;
}
.atm-tt-k {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--ink-soft, #7a6a4a);
  flex-shrink: 0;
  padding-top: 1px;
}
.atm-tt-traits {
  margin-top: 5px;
  font-size: 0.76rem;
  font-style: italic;
  color: var(--ink-soft, #7a6a4a);
  border-top: 1px solid #e8dcc8;
  padding-top: 4px;
  line-height: 1.3;
}
.atm-tt-hint {
  margin-top: 6px;
  font-size: 0.64rem;
  font-family: var(--font-heading, 'Cinzel', serif);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--gold, #c8a84b);
  text-align: center;
}
`;
    document.head.appendChild(s);
  },

};
