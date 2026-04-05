/* ══════════════════════════════════════════════════════════════
   TAB: MAUSOLEUM
   The honoured dead. Sorted by year of death descending.
══════════════════════════════════════════════════════════════ */

const TabMausoleum = {
  _search:  '',
  _hh:      '',
  _subTab:  'fallen',   // 'fallen' | 'oos'

  render() {
    const panel = document.getElementById('tab-mausoleum');
    if (!panel) return;

    const hhChips = STORE.households.map(h =>
      `<button class="filter-chip${this._hh===h.name?' active':''}" data-hh="${h.name}" onclick="TabMausoleum.setHH('${h.name}')">${h.icon} ${h.name}</button>`
    ).join('');

    const oosCount  = STORE.living.filter(n => n.out_of_story).length;
    const deadCount = STORE.dead.length;

    panel.innerHTML = `
      <div class="mausoleum-layout">
        <div class="mausoleum-header">
          <div class="page-title">${this._subTab === 'oos' ? '🌫 Out of Story' : '🕯 The Mausoleum'}</div>
          <div class="mausoleum-epitaph">${this._subTab === 'oos'
            ? '"Some threads simply vanish from the tapestry."'
            : '"They shall not be forgotten in the songs of Logres."'
          }</div>
          <nav style="display:flex;gap:8px;justify-content:center;margin-top:14px;">
            <button class="winter-subtab${this._subTab==='fallen'?' active':''}"
              onclick="TabMausoleum.switchSubTab('fallen')">🕯 The Fallen${deadCount ? ' ('+deadCount+')' : ''}</button>
            <button class="winter-subtab${this._subTab==='oos'?' active':''}"
              onclick="TabMausoleum.switchSubTab('oos')">🌫 Out of Story${oosCount ? ' ('+oosCount+')' : ''}</button>
          </nav>
          <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
            <input class="search-input" id="maulSearch" placeholder="${this._subTab==='oos' ? 'Search out of story…' : 'Search the fallen…'}"
              style="max-width:300px;background:var(--vellum);"
              value="${this._search}">
          </div>
          ${this._subTab === 'fallen' ? `
          <div style="margin-top:10px;display:flex;align-items:center;gap:8px;justify-content:center;flex-wrap:wrap;">
            <label style="font-family:var(--font-heading);font-size:0.58rem;letter-spacing:0.1em;color:var(--ink-soft);">YEAR</label>
            <input class="edit-input" id="maulExportYear" type="number" value="${STORE.year}"
              style="width:72px;text-align:center;padding:3px 6px;">
            <button class="btn btn-ghost" style="font-size:0.6rem;" onclick="TabMausoleum.exportRollOfFallen(parseInt(document.getElementById('maulExportYear').value))">
              📜 Export Roll of the Fallen
            </button>
          </div>` : ''}
          <div style="margin-top:8px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
            <button class="filter-chip${!this._hh?' active':''}" onclick="TabMausoleum.setHH('')">All</button>
            ${hhChips}
          </div>
        </div>
        <div class="dead-grid" id="maulGrid"></div>
      </div>`;

    document.getElementById('maulSearch')?.addEventListener('input', e => {
      this._search = e.target.value;
      this._subTab === 'oos' ? this._renderOos() : this._renderGrid();
    });

    this._subTab === 'oos' ? this._renderOos() : this._renderGrid();
  },

  switchSubTab(name) {
    this._subTab = name;
    this._search = '';
    this.render();
  },

  _filtered() {
    const q = this._search.toLowerCase().trim();
    return STORE.dead.filter(n => {
      if (this._hh && n.household !== this._hh) return false;
      if (q && ![n.name, n.role, n.notes].some(f => f && f.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a,b) => (b.year_died||0) - (a.year_died||0));
  },

  _filteredOos() {
    const q = this._search.toLowerCase().trim();
    return STORE.living.filter(n => {
      if (!n.out_of_story) return false;
      if (this._hh && n.household !== this._hh) return false;
      if (q && ![n.name, n.role, n.notes, n.out_of_story_note].some(f => f && f.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  },

  _renderGrid() {
    const grid = document.getElementById('maulGrid');
    if (!grid) return;
    const dead = this._filtered();
    if (!dead.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">🕯</div><div class="empty-state-text">None here yet</div></div>';
      return;
    }

    grid.innerHTML = dead.map(n => {
      const hh = STORE.getHousehold(n.household);
      const col = hh ? hh.colour : '#5a5040';
      const born  = n.year_born ? n.year_born + ' AD' : '?';
      const died  = n.year_died ? n.year_died + ' AD' : '?';
      const lived = (n.year_born && n.year_died) ? ` · aged ${n.year_died - n.year_born}` : '';
      const notePrev = n.notes ? n.notes.slice(0, 120) + (n.notes.length > 120 ? '…' : '') : '';

      return `<div class="dead-card" style="border-top-color:${col};" data-npc-hover="${n.id}" onclick="Components.openNpcCard('${n.id}')">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;">
          <div class="dead-name">${n.name}</div>
          ${hh ? `<span style="font-size:0.8rem;">${hh.icon}</span>` : ''}
        </div>
        <div class="dead-dates">${n.role||'—'} · ${born} – ${died}${lived}</div>
        ${notePrev ? `<div class="dead-notes">${notePrev}</div>` : ''}
        ${n.glory ? `<div style="margin-top:6px;font-family:var(--font-heading);font-size:0.6rem;color:var(--gold);">${n.glory.toLocaleString()} glory</div>` : ''}
      </div>`;
    }).join('');
  },

  _renderOos() {
    const grid = document.getElementById('maulGrid');
    if (!grid) return;
    const npcs = this._filteredOos();
    if (!npcs.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">🌫</div><div class="empty-state-text">No one has left the story yet</div></div>';
      return;
    }

    grid.innerHTML = npcs.map(n => {
      const hh  = STORE.getHousehold(n.household);
      const col = hh ? hh.colour : '#7a6a4a';
      const age = n.year_born ? STORE.year - n.year_born : null;
      const ageStr = age !== null ? `b. ${n.year_born} AD · age ${age}` : '';

      return `<div class="dead-card" style="border-top-color:${col};opacity:0.82;" data-npc-hover="${n.id}" onclick="Components.openNpcCard('${n.id}')">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px;">
          <div class="dead-name" style="color:var(--ink-soft);">${n.name}</div>
          ${hh ? `<span style="font-size:0.8rem;">${hh.icon}</span>` : ''}
        </div>
        <div class="dead-dates">${n.role||'—'}${ageStr ? ' · ' + ageStr : ''}</div>
        ${n.out_of_story_note ? `<div class="dead-notes" style="color:#8a7a5a;font-style:italic;">🌫 ${n.out_of_story_note}</div>` : ''}
        ${n.household ? `<div style="margin-top:4px;font-family:var(--font-heading);font-size:0.58rem;color:var(--ink-soft);">${n.household}</div>` : ''}
      </div>`;
    }).join('');
  },

  setHH(name) {
    this._hh = this._hh === name ? '' : name;
    this.render();
  },

  // ── ROLL OF THE FALLEN — PNG EXPORT ───────────────────────
  exportRollOfFallen(year) {
    if (!year || isNaN(year)) { Toast.error('Enter a valid year'); return; }

    const fallen = [...STORE.dead]
      .filter(n => n.year_died === year)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!fallen.length) {
      Toast.show(`No soul was taken from Logres in ${year} AD — let the feasting continue! 🎉`, 'success');
      return;
    }

    const W = 700, PAD = 44;

    // ── Helpers ───────────────────────────────────────────────
    const wrapText = (ctx, text, maxW, font) => {
      ctx.font = font;
      const words = text.split(' ');
      const lines = [];
      let line = '';
      words.forEach(w => {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) {
          lines.push(line); line = w;
        } else { line = test; }
      });
      if (line) lines.push(line);
      return lines;
    };

    const extractDeathNote = notes => {
      if (!notes) return '';
      const match = notes.match(/†\s*(.+)/);
      return match ? match[1].split('\n')[0].trim() : '';
    };

    // ── Pre-measure entries ───────────────────────────────────
    const measure = document.createElement('canvas').getContext('2d');
    const NOTE_W  = W - PAD * 2 - 20;

    const entries = fallen.map(n => {
      const note      = extractDeathNote(n.notes);
      const noteLines = note ? wrapText(measure, note, NOTE_W, 'italic 14px serif') : [];
      const hh        = STORE.getHousehold(n.household);
      return { n, note, noteLines, hh };
    });

    // ── Calculate canvas height ───────────────────────────────
    const HEADER_H   = 130;
    const FOOTER_H   = 52;
    const ENTRY_GAP  = 24;
    let bodyH = 0;
    entries.forEach((e, i) => {
      bodyH += 28 + 22;                               // name + dates line
      if (e.noteLines.length) bodyH += e.noteLines.length * 20 + 6;
      if (e.n.glory) bodyH += 18;
      if (i < entries.length - 1) bodyH += ENTRY_GAP; // divider gap
    });

    const canvas    = document.createElement('canvas');
    canvas.width    = W;
    canvas.height   = HEADER_H + bodyH + FOOTER_H + PAD * 2;
    const ctx       = canvas.getContext('2d');

    // ── Background ────────────────────────────────────────────
    ctx.fillStyle = '#f0e6cc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Faint texture lines
    ctx.strokeStyle = 'rgba(160,130,70,0.07)';
    ctx.lineWidth = 1;
    for (let y = 0; y < canvas.height; y += 16) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // ── Outer border ─────────────────────────────────────────
    ctx.strokeStyle = '#3a1a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, W - 20, canvas.height - 20);
    ctx.strokeStyle = 'rgba(120,60,60,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(16, 16, W - 32, canvas.height - 32);

    // ── Header band ───────────────────────────────────────────
    ctx.fillStyle = '#1e0d0d';
    ctx.fillRect(10, 10, W - 20, HEADER_H - 10);

    // Candle emoji flanking title
    ctx.font = 'bold 24px serif';
    ctx.fillStyle = '#e8d48a';
    ctx.textAlign = 'center';
    ctx.fillText(`🕯  The Roll of the Fallen  🕯`, W / 2, 52);

    ctx.font = 'bold 17px serif';
    ctx.fillStyle = 'rgba(232,212,138,0.85)';
    ctx.fillText(`${year} AD`, W / 2, 78);

    ctx.font = 'italic 12px serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText('"They shall not be forgotten in the songs of Logres."', W / 2, 104);

    // ── Entries ───────────────────────────────────────────────
    let cy = HEADER_H + PAD;
    ctx.textAlign = 'left';

    entries.forEach((e, idx) => {
      const { n, noteLines, hh } = e;
      const accentCol = hh?.colour || '#5a3a3a';

      // Left accent bar
      ctx.fillStyle = accentCol;
      const barH = 24 + 20 + (noteLines.length ? noteLines.length * 20 + 6 : 0) + (n.glory ? 18 : 0);
      ctx.fillRect(PAD - 10, cy - 2, 4, barH + 4);

      // Name
      ctx.font = 'bold 20px serif';
      ctx.fillStyle = '#1a0a0a';
      ctx.fillText(n.name, PAD, cy + 20);

      // Household icon
      if (hh?.icon) {
        ctx.font = '14px serif';
        ctx.fillStyle = accentCol;
        const nameW = ctx.measureText(n.name).width;
        ctx.fillText(hh.icon, PAD + nameW + 8, cy + 18);
      }
      cy += 28;

      // Dates + role line
      const born   = n.year_born ? `b. ${n.year_born} AD` : '';
      const died   = n.year_died ? `† ${n.year_died} AD` : '';
      const aged   = (n.year_born && n.year_died) ? ` (aged ${n.year_died - n.year_born})` : '';
      const role   = n.role || '';
      const dates  = [role, [born, died].filter(Boolean).join(' – ')].filter(Boolean).join('  ·  ') + aged;
      ctx.font = '13px serif';
      ctx.fillStyle = '#5a3a20';
      ctx.fillText(dates, PAD, cy + 14);
      cy += 22;

      // Death note
      if (noteLines.length) {
        ctx.font = 'italic 13px serif';
        ctx.fillStyle = '#7a2020';
        noteLines.forEach(line => {
          ctx.fillText(line, PAD + 4, cy + 14);
          cy += 20;
        });
        cy += 6;
      }

      // Glory
      if (n.glory) {
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#8a7020';
        ctx.fillText(`✦ ${n.glory.toLocaleString()} glory`, PAD, cy + 12);
        cy += 18;
      }

      // Ornamental divider between entries
      if (idx < entries.length - 1) {
        cy += 10;
        ctx.strokeStyle = 'rgba(120,60,60,0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(PAD, cy); ctx.lineTo(W - PAD, cy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = '12px serif';
        ctx.fillStyle = 'rgba(120,60,60,0.4)';
        ctx.textAlign = 'center';
        ctx.fillText('✦', W / 2, cy + 10);
        ctx.textAlign = 'left';
        cy += ENTRY_GAP;
      }
    });

    // ── Footer ────────────────────────────────────────────────
    const footerY = canvas.height - FOOTER_H;
    ctx.fillStyle = 'rgba(30,13,13,0.08)';
    ctx.fillRect(16, footerY, W - 32, FOOTER_H - 16);
    ctx.font = 'italic 11px serif';
    ctx.fillStyle = 'rgba(80,40,20,0.55)';
    ctx.textAlign = 'center';
    ctx.fillText(`Pendragon GM's Binder · ${fallen.length} soul${fallen.length !== 1 ? 's' : ''} remembered · ${year} AD`, W / 2, footerY + 22);

    // ── Download ──────────────────────────────────────────────
    const link      = document.createElement('a');
    link.download   = `roll-of-the-fallen-${year}-AD.png`;
    link.href       = canvas.toDataURL('image/png');
    link.click();
    Toast.success(`Exported Roll of the Fallen — ${year} AD`);
  },
};
