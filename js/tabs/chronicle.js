/* ══════════════════════════════════════════════════════════════
   CHRONICLE.JS — Year in Review
   Each year auto-collects deaths, births, and marriages from the
   stored data, plus freeform GM entries the user can add/remove.
══════════════════════════════════════════════════════════════ */

const CHRONICLE_CATS = {
  campaign:     { label: 'Campaign',     colour: '#c07820' },
  battle:       { label: 'Battle',       colour: '#c03030' },
  political:    { label: 'Political',    colour: '#2878c0' },
  personal:     { label: 'Personal',     colour: '#208060' },
  supernatural: { label: 'Supernatural', colour: '#9040c0' },
  other:        { label: 'Other',        colour: '#707070' },
};

const TabChronicle = {

  _year: null,

  // ── HELPERS ─────────────────────────────────────────────────
  _ensureYear() {
    if (this._year === null) this._year = STORE.year;
  },

  _findNpc(id) {
    return [...STORE.living, ...STORE.dead].find(n => n.id === id) || null;
  },

  // Returns all years that have at least one auto or manual event, plus
  // current year, sorted ascending.
  _allYears() {
    const years = new Set([STORE.year]);
    STORE.dead.forEach(n => { if (n.year_died) years.add(n.year_died); });
    [...STORE.living, ...STORE.dead].forEach(n => { if (n.year_born) years.add(n.year_born); });
    Object.keys(STORE.chronicle || {}).forEach(y => { const n = parseInt(y); if (!isNaN(n)) years.add(n); });
    STORE.relationships.forEach(r => {
      if (r.type === 'Spouse' && r.notes) {
        const m = r.notes.match(/Married (\d+) AD/);
        if (m) years.add(parseInt(m[1]));
      }
    });
    return [...years].sort((a, b) => a - b);
  },

  // ── NAVIGATION ──────────────────────────────────────────────
  prevYear() {
    const all = this._allYears();
    const idx = all.indexOf(this._year);
    if (idx > 0) { this._year = all[idx - 1]; this.render(); }
  },

  nextYear() {
    const all = this._allYears();
    const idx = all.indexOf(this._year);
    if (idx < all.length - 1) { this._year = all[idx + 1]; this.render(); }
  },

  goToYear(val) {
    const n = parseInt(val);
    if (!isNaN(n)) { this._year = n; this.render(); }
  },

  // ── DATA COLLECTION ─────────────────────────────────────────
  _getDeaths(year) {
    return STORE.dead
      .filter(n => n.year_died === year)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  _getBirths(year) {
    return [...STORE.living, ...STORE.dead]
      .filter(n => n.year_born === year)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  _getMarriages(year) {
    return STORE.relationships
      .filter(r => {
        if (r.type !== 'Spouse') return false;
        const m = r.notes && r.notes.match(/Married (\d+) AD/);
        return m && parseInt(m[1]) === year;
      })
      .map(r => ({
        rel:  r,
        npcA: this._findNpc(r.sourceId),
        npcB: this._findNpc(r.targetId),
      }))
      .filter(m => m.npcA || m.npcB);
  },

  _getCustom(year) {
    return (STORE.chronicle[String(year)] || [])
      .slice()
      .sort((a, b) => (a.ts || 0) - (b.ts || 0));
  },

  // ── CUSTOM EVENT CRUD ────────────────────────────────────────
  addEvent() {
    const text = document.getElementById('chron-new-text')?.value?.trim();
    const cat  = document.getElementById('chron-new-cat')?.value  || 'campaign';
    if (!text) { document.getElementById('chron-new-text')?.focus(); return; }
    if (!STORE.chronicle) STORE.chronicle = {};
    const key = String(this._year);
    if (!STORE.chronicle[key]) STORE.chronicle[key] = [];
    STORE.chronicle[key].push({ id: 'ev-' + Date.now(), text, cat, ts: Date.now() });
    STORE.save();
    this.render();
  },

  deleteEvent(year, id) {
    const list = STORE.chronicle?.[String(year)];
    if (!list) return;
    const idx = list.findIndex(e => e.id === id);
    if (idx !== -1) { list.splice(idx, 1); STORE.save(); this.render(); }
  },

  // ── EXPORT ───────────────────────────────────────────────────
  exportYear(year) {
    const deaths    = this._getDeaths(year);
    const births    = this._getBirths(year);
    const marriages = this._getMarriages(year);
    const custom    = this._getCustom(year);

    const lines = [
      `# ${year} AD — Year in Review`,
      '',
    ];

    if (deaths.length) {
      lines.push('## ⚔ The Fallen');
      deaths.forEach(n => {
        lines.push(`- **${n.name}**${n.role ? ' — ' + n.role : ''}${n.household ? ', ' + n.household : ''}`);
      });
      lines.push('');
    }

    if (births.length) {
      lines.push('## 👶 Born This Year');
      births.forEach(n => {
        lines.push(`- **${n.name}**${n.household ? ' of ' + n.household : ''}${n.blessed ? ' ✦' : ''}`);
      });
      lines.push('');
    }

    if (marriages.length) {
      lines.push('## 💒 Marriages');
      marriages.forEach(m => {
        const a = m.npcA?.name || '(unknown)';
        const b = m.npcB?.name || '(unknown)';
        lines.push(`- **${a}** & **${b}**`);
      });
      lines.push('');
    }

    if (custom.length) {
      lines.push('## 📜 Chronicle');
      custom.forEach(e => {
        const cat = CHRONICLE_CATS[e.cat] || CHRONICLE_CATS.other;
        lines.push(`- [${cat.label}] ${e.text}`);
      });
      lines.push('');
    }

    if (!deaths.length && !births.length && !marriages.length && !custom.length) {
      lines.push('*No events recorded for this year.*');
    }

    return lines.join('\n');
  },

  copyExport(year) {
    navigator.clipboard.writeText(this.exportYear(year))
      .then(() => Toast.success('Copied to clipboard!'));
  },

  // ── RENDER ───────────────────────────────────────────────────
  render() {
    this._ensureYear();
    const el = document.getElementById('tab-chronicle');
    if (!el) return;

    const year      = this._year;
    const deaths    = this._getDeaths(year);
    const births    = this._getBirths(year);
    const marriages = this._getMarriages(year);
    const custom    = this._getCustom(year);
    const all       = this._allYears();
    const idx       = all.indexOf(year);
    const hasPrev   = idx > 0;
    const hasNext   = idx < all.length - 1;
    const total     = deaths.length + births.length + marriages.length + custom.length;

    el.innerHTML = `
      <div style="max-width:800px;margin:0 auto;padding:24px 16px;">

        <div id="chron-submissions-panel"></div>

        <!-- ── Year navigation ── -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px;flex-wrap:wrap;">
          <button class="btn btn-ghost" style="padding:5px 16px;font-size:1.1rem;line-height:1;"
            onclick="TabChronicle.prevYear()" ${hasPrev ? '' : 'disabled'}>‹</button>

          <div style="flex:1;text-align:center;min-width:140px;">
            <div style="font-family:var(--font-heading);font-size:1.6rem;letter-spacing:0.14em;color:var(--gold);line-height:1;">${year} AD</div>
            <div style="font-size:0.65rem;color:var(--ink-soft);margin-top:4px;letter-spacing:0.1em;text-transform:uppercase;">
              ${total === 0 ? 'No recorded events' : `${total} event${total !== 1 ? 's' : ''} recorded`}
            </div>
          </div>

          <button class="btn btn-ghost" style="padding:5px 16px;font-size:1.1rem;line-height:1;"
            onclick="TabChronicle.nextYear()" ${hasNext ? '' : 'disabled'}>›</button>

          <select class="edit-input" style="width:auto;padding:5px 10px;font-size:0.8rem;"
            onchange="TabChronicle.goToYear(this.value)">
            ${all.map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y} AD</option>`).join('')}
          </select>

          <button class="btn btn-ghost" style="font-size:0.72rem;padding:5px 12px;"
            onclick="TabChronicle.copyExport(${year})" title="Copy this year as markdown">⎘ Export</button>
        </div>

        ${this._renderDeaths(deaths)}
        ${this._renderBirths(births)}
        ${this._renderMarriages(marriages)}
        ${this._renderCustom(custom, year)}

      </div>
    `;

    // For GM: async-load pending submissions and inject into panel
    if (isGM()) this._renderSubmissionsPanel();
  },

  // ── SECTION RENDERERS ────────────────────────────────────────

  _npcPill(npc) {
    if (!npc) return `<span style="color:var(--ink-soft);font-style:italic;">(unknown)</span>`;
    const isDead = !!STORE.dead.find(d => d.id === npc.id);
    const col = isDead ? '#a02020' : '#6a3a10';
    return `<span style="cursor:pointer;color:${col};text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;font-weight:600;"
      onclick="Components.openNpcCard('${npc.id}')">${npc.name}</span>`;
  },

  _sectionHeader(icon, label, count, colour) {
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="font-family:var(--font-heading);font-size:0.65rem;letter-spacing:0.14em;text-transform:uppercase;color:${colour};text-shadow:0 1px 3px rgba(0,0,0,0.15);">${icon} ${label}</div>
      <div style="flex:1;height:1px;background:${colour}66;"></div>
      <div style="font-family:var(--font-heading);font-size:0.6rem;color:${colour};">${count}</div>
    </div>`;
  },

  _renderDeaths(deaths) {
    if (!deaths.length) return '';
    return `
      <div style="margin-bottom:28px;">
        ${this._sectionHeader('⚔', 'The Fallen', deaths.length, '#c03030')}
        <div style="display:flex;flex-direction:column;gap:5px;">
          ${deaths.map(n => `
            <div style="display:flex;align-items:center;gap:10px;padding:9px 14px;background:var(--vellum-mid);border:1px solid rgba(192,48,48,0.25);border-left:3px solid rgba(192,48,48,0.7);border-radius:var(--radius);">
              <span style="color:#c03030;font-size:0.85rem;flex-shrink:0;font-weight:bold;">†</span>
              <div style="flex:1;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
                <span style="font-size:0.9rem;font-weight:600;color:var(--ink);">${this._npcPill(n)}</span>
                ${n.role ? `<span style="font-family:var(--font-heading);font-size:0.58rem;letter-spacing:0.08em;color:#5a3a2a;">${n.role}</span>` : ''}
              </div>
              ${n.household ? `<span style="font-family:var(--font-heading);font-size:0.58rem;color:#5a3a2a;flex-shrink:0;">${n.household}</span>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
  },

  _renderBirths(births) {
    if (!births.length) return '';
    return `
      <div style="margin-bottom:28px;">
        ${this._sectionHeader('🍼', 'Born This Year', births.length, '#1a8a40')}
        <div style="display:flex;flex-direction:column;gap:5px;">
          ${births.map(n => `
            <div style="display:flex;align-items:center;gap:10px;padding:9px 14px;background:var(--vellum-mid);border:1px solid rgba(26,138,64,0.25);border-left:3px solid rgba(26,138,64,0.65);border-radius:var(--radius);">
              <div style="flex:1;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;">
                <span style="font-size:0.9rem;font-weight:600;color:var(--ink);">${this._npcPill(n)}</span>
                ${n.blessed ? `<span title="Blessed Birth" style="color:var(--gold);font-size:0.75rem;">✦</span>` : ''}
                ${n.fate_touched ? `<span title="Fate-Touched" style="color:#1a8a40;font-size:0.75rem;">◈</span>` : ''}
              </div>
              ${n.household ? `<span style="font-family:var(--font-heading);font-size:0.58rem;color:#5a3a2a;flex-shrink:0;">${n.household}</span>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
  },

  _renderMarriages(marriages) {
    if (!marriages.length) return '';
    return `
      <div style="margin-bottom:28px;">
        ${this._sectionHeader('💒', 'Marriages', marriages.length, '#8030a0')}
        <div style="display:flex;flex-direction:column;gap:5px;">
          ${marriages.map(m => `
            <div style="display:flex;align-items:center;gap:10px;padding:9px 14px;background:var(--vellum-mid);border:1px solid rgba(128,48,160,0.25);border-left:3px solid rgba(128,48,160,0.65);border-radius:var(--radius);">
              <span style="font-size:0.85rem;flex-shrink:0;">💒</span>
              <div style="flex:1;font-size:0.9rem;font-weight:600;color:var(--ink);">
                ${this._npcPill(m.npcA)}
                <span style="color:#5a3a2a;margin:0 6px;font-weight:400;">&amp;</span>
                ${this._npcPill(m.npcB)}
              </div>
            </div>`).join('')}
        </div>
      </div>`;
  },

  _renderCustom(events, year) {
    const catOptions = Object.entries(CHRONICLE_CATS)
      .map(([k, v]) => `<option value="${k}">${v.label}</option>`)
      .join('');

    const rows = events.map(e => {
      const c = CHRONICLE_CATS[e.cat] || CHRONICLE_CATS.other;
      // Escape single quotes in the id for the inline onclick
      const safeId = e.id.replace(/'/g, "\\'");
      return `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:9px 14px;background:var(--vellum-mid);border:1px solid var(--vellum-deep);border-left:3px solid ${c.colour}88;border-radius:var(--radius);">
          <span style="font-family:var(--font-heading);font-size:0.58rem;letter-spacing:0.07em;color:#fff;background:${c.colour};padding:2px 8px;border-radius:10px;white-space:nowrap;margin-top:2px;flex-shrink:0;">${c.label}</span>
          <div style="flex:1;font-size:0.88rem;line-height:1.55;color:var(--ink);font-weight:500;">${AtMention.render(e.text)}</div>
          ${isGM() ? `<button class="btn btn-ghost" style="padding:2px 8px;font-size:0.65rem;flex-shrink:0;opacity:0.6;"
            onclick="TabChronicle.deleteEvent(${year},'${safeId}')">✕</button>` : ''}
        </div>`;
    }).join('');

    return `
      <div style="margin-bottom:28px;">
        ${this._sectionHeader('📜', 'Chronicle Events', events.length || '', '#a07020')}
        ${!isGM() ? `
        <div style="margin-bottom:12px;">
          <button class="btn btn-verdigris" style="font-size:0.78rem;padding:6px 18px;"
            onclick="TabChronicle.submitEntry()">📜 Submit Chronicle Entry</button>
        </div>` : ''}
        ${rows || `<div style="font-size:0.8rem;color:var(--ink-soft);font-style:italic;padding:6px 2px;margin-bottom:10px;">No entries yet for this year.</div>`}
        ${isGM() ? `
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center;">
          <select class="edit-input" id="chron-new-cat" style="width:auto;padding:5px 8px;font-size:0.78rem;">
            ${catOptions}
          </select>
          <input class="edit-input" id="chron-new-text"
            placeholder="Record an event for ${year} AD…"
            style="flex:1;min-width:200px;"
            onkeydown="if(event.key==='Enter')TabChronicle.addEvent()">
          <button class="btn btn-primary" style="font-size:0.75rem;padding:6px 14px;"
            onclick="TabChronicle.addEvent()">+ Add</button>
        </div>` : ''}
      </div>`;
  },

  // ── SUBMISSIONS — GM review panel ────────────────────────────
  _renderSubmissionsPanel() {
    fetch('/api/submissions')
      .then(r => r.json())
      .then(subs => {
        const panel = document.getElementById('chron-submissions-panel');
        if (!panel) return;
        if (!subs.length) { panel.innerHTML = ''; return; }
        panel.innerHTML = this._buildSubmissionsHtml(subs);
      })
      .catch(() => {});
  },

  _buildSubmissionsHtml(subs) {
    const rows = subs.map(s => {
      const cat   = CHRONICLE_CATS[s.cat] || CHRONICLE_CATS.other;
      const safeId = s.id.replace(/'/g, "\\'");
      const escapedText = s.text.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
      const escapedCat  = (s.cat || 'personal').replace(/'/g, "\\'");
      return `
        <div style="padding:12px 16px;background:var(--vellum);border:1px solid rgba(184,134,11,0.3);border-left:3px solid ${cat.colour};border-radius:var(--radius);margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
            <span style="font-family:var(--font-heading);font-size:0.58rem;letter-spacing:0.07em;color:#fff;background:${cat.colour};padding:2px 8px;border-radius:10px;">${cat.label}</span>
            <span style="font-family:var(--font-heading);font-size:0.6rem;color:var(--ink-soft);letter-spacing:0.06em;">${esc(s.playerUsername)}</span>
            <span style="font-family:var(--font-heading);font-size:0.6rem;color:var(--ink-mid);">·</span>
            <span style="font-family:var(--font-heading);font-size:0.6rem;color:var(--ink-soft);">${esc(s.subjectName || '(no subject)')}</span>
            <span style="font-family:var(--font-heading);font-size:0.6rem;color:var(--ink-mid);">·</span>
            <span style="font-family:var(--font-heading);font-size:0.6rem;color:var(--gold-pale);">${s.year} AD</span>
          </div>
          <div style="font-size:0.9rem;line-height:1.6;color:var(--ink);margin-bottom:12px;">${AtMention.render(s.text)}</div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary" style="font-size:0.7rem;padding:4px 14px;"
              onclick="TabChronicle.approveSubmission('${safeId}')">✓ Approve</button>
            <button class="btn btn-ghost" style="font-size:0.7rem;padding:4px 14px;"
              onclick="TabChronicle.editApproveSubmission('${safeId}', \`${escapedText}\`, '${escapedCat}')">✎ Edit & Approve</button>
            <button class="btn btn-ghost" style="font-size:0.7rem;padding:4px 14px;opacity:0.6;"
              onclick="TabChronicle.dismissSubmission('${safeId}')">✕ Dismiss</button>
          </div>
        </div>`;
    }).join('');

    return `
      <div style="margin-bottom:28px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <div style="font-family:var(--font-heading);font-size:0.65rem;letter-spacing:0.14em;text-transform:uppercase;color:#b87820;">📜 Pending Player Submissions</div>
          <div style="flex:1;height:1px;background:rgba(184,120,32,0.4);"></div>
          <div style="font-family:var(--font-heading);font-size:0.6rem;color:#b87820;">${subs.length}</div>
        </div>
        ${rows}
      </div>`;
  },

  approveSubmission(id) {
    fetch(`/api/submissions/${encodeURIComponent(id)}/approve`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(r => r.json())
      .then(res => {
        if (res.ok) {
          Toast.success('Approved and added to Chronicle');
          STORE.loadFromFile().then(() => TabChronicle.render());
        } else {
          Toast.error(res.error || 'Failed to approve');
        }
      }).catch(() => Toast.error('Network error'));
  },

  editApproveSubmission(id, currentText, currentCat) {
    const catOptions = Object.entries(CHRONICLE_CATS)
      .map(([k, v]) => `<option value="${k}" ${k === currentCat ? 'selected' : ''}>${v.label}</option>`)
      .join('');
    Modal.open(`
      <h2 style="font-family:var(--font-heading);font-size:1.1rem;letter-spacing:0.1em;color:var(--gold);margin-bottom:16px;">Edit Submission</h2>
      <div style="margin-bottom:10px;">
        <label style="font-family:var(--font-heading);font-size:0.65rem;letter-spacing:0.08em;color:var(--ink-soft);display:block;margin-bottom:5px;">CATEGORY</label>
        <select class="edit-input" id="sub-edit-cat" style="width:auto;padding:5px 8px;font-size:0.78rem;">${catOptions}</select>
      </div>
      <div style="margin-bottom:16px;">
        <label style="font-family:var(--font-heading);font-size:0.65rem;letter-spacing:0.08em;color:var(--ink-soft);display:block;margin-bottom:5px;">NARRATIVE</label>
        <textarea class="edit-input" id="sub-edit-text" rows="7"
          style="width:100%;resize:vertical;">${currentText.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="TabChronicle._confirmApprove('${id.replace(/'/g,"\\'")}')">✓ Approve</button>
      </div>
    `);
  },

  _confirmApprove(id) {
    const text = document.getElementById('sub-edit-text')?.value?.trim();
    const cat  = document.getElementById('sub-edit-cat')?.value || 'personal';
    if (!text) return;
    fetch(`/api/submissions/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, cat }),
    }).then(r => r.json()).then(res => {
      if (res.ok) {
        Modal.close();
        Toast.success('Approved and added to Chronicle');
        STORE.loadFromFile().then(() => TabChronicle.render());
      } else {
        Toast.error(res.error || 'Failed to approve');
      }
    }).catch(() => Toast.error('Network error'));
  },

  dismissSubmission(id) {
    fetch(`/api/submissions/${encodeURIComponent(id)}/dismiss`, { method: 'POST' })
      .then(r => r.json())
      .then(res => {
        if (res.ok) {
          Toast.success('Submission dismissed');
          this._renderSubmissionsPanel();
        }
      }).catch(() => {});
  },

  // ── SUBMISSIONS — Player submit modal ────────────────────────
  submitEntry() {
    const user      = window.__USER__ || {};
    const household = user.household  || '';
    const members   = (STORE.householdMembers ? STORE.householdMembers(household) : [])
                      .filter(m => m.status !== 'Dead');
    const pk        = members.find(m => m.role === 'Player Knight');

    const catOptions = Object.entries(CHRONICLE_CATS)
      .map(([k, v]) => `<option value="${k}" ${k === 'personal' ? 'selected' : ''}>${v.label}</option>`)
      .join('');

    const subjectOptions = members.length
      ? members.map(m => {
          const sel = pk && m.id === pk.id ? 'selected' : '';
          return `<option value="${m.id}" data-name="${m.name.replace(/"/g,'&quot;')}" ${sel}>${m.name} — ${m.role || 'NPC'}</option>`;
        }).join('')
      : `<option value="">No household members found</option>`;

    Modal.open(`
      <h2 style="font-family:var(--font-heading);font-size:1.1rem;letter-spacing:0.1em;color:var(--gold);margin-bottom:18px;">Submit Chronicle Entry</h2>
      <div class="sub-form-2col" style="gap:12px;margin-bottom:12px;">
        <div>
          <label style="font-family:var(--font-heading);font-size:0.65rem;letter-spacing:0.08em;color:var(--ink-soft);display:block;margin-bottom:5px;">SUBJECT</label>
          <select class="edit-input" id="sub-subject" style="width:100%;">${subjectOptions}</select>
        </div>
        <div>
          <label style="font-family:var(--font-heading);font-size:0.65rem;letter-spacing:0.08em;color:var(--ink-soft);display:block;margin-bottom:5px;">YEAR</label>
          <input class="edit-input" type="number" id="sub-year" value="${STORE.year}" min="400" max="700" style="width:100%;">
          <div style="font-size:0.65rem;color:var(--ink-soft);margin-top:3px;font-style:italic;">current campaign year: ${STORE.year} AD</div>
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-family:var(--font-heading);font-size:0.65rem;letter-spacing:0.08em;color:var(--ink-soft);display:block;margin-bottom:5px;">CATEGORY</label>
        <select class="edit-input" id="sub-cat" style="width:auto;">${catOptions}</select>
      </div>
      <div style="margin-bottom:16px;">
        <label style="font-family:var(--font-heading);font-size:0.65rem;letter-spacing:0.08em;color:var(--ink-soft);display:block;margin-bottom:5px;">NARRATIVE — type @ to mention characters</label>
        <textarea class="edit-input" id="sub-text" rows="7"
          style="width:100%;resize:vertical;"
          placeholder="Write your chronicle entry from your knight's perspective…"></textarea>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="TabChronicle._submitConfirm()">📜 Submit for Review</button>
      </div>
    `);
  },

  _submitConfirm() {
    const subjectEl  = document.getElementById('sub-subject');
    const subjectId  = subjectEl?.value || '';
    const subjectName = subjectEl?.selectedOptions?.[0]?.dataset?.name || subjectEl?.selectedOptions?.[0]?.text?.split(' — ')[0] || '';
    const year       = parseInt(document.getElementById('sub-year')?.value);
    const cat        = document.getElementById('sub-cat')?.value || 'personal';
    const text       = document.getElementById('sub-text')?.value?.trim();

    if (!text)             { Toast.error('Please write your entry before submitting.'); return; }
    if (!year || isNaN(year)) { Toast.error('Please enter a valid year.'); return; }

    fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectId, subjectName, year, cat, text }),
    }).then(r => r.json()).then(res => {
      if (res.ok) {
        Modal.close();
        Toast.success('Entry submitted — awaiting GM approval.');
      } else {
        Toast.error(res.error || 'Submission failed.');
      }
    }).catch(() => Toast.error('Network error.'));
  },

};
