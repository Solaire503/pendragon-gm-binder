/* ══════════════════════════════════════════════════════════════
   NPC-MANORS.JS — NPC Manor tracking for the GM
   Simple ledger of non-player manors with title holder tracking.
   When a holder dies, the manor is flagged for reassignment.
   Players can view but not edit.
══════════════════════════════════════════════════════════════ */

const TabNpcManors = {

  _filter: 'all', // 'all' | 'vacant' | 'held'
  _sort:   'name',

  render() {
    const panel = document.getElementById('tab-npc-manors');
    if (!panel) return;
    const scrollEl = document.getElementById('npc-manors-scroll');
    const scrollTop = scrollEl ? scrollEl.scrollTop : 0;

    const gm = isGM();
    const manors = STORE.npcManors || [];
    const vacant = manors.filter(m => this._isVacant(m));

    const filterBtns = ['all','vacant','held'].map(f =>
      `<button class="btn ${this._filter===f?'btn-primary':'btn-ghost'}" style="font-size:0.58rem;" onclick="TabNpcManors.setFilter('${f}')">${f.charAt(0).toUpperCase()+f.slice(1)}${f==='vacant'&&vacant.length?' ('+vacant.length+')':''}</button>`
    ).join('');

    const sortBtns = ['name','location','faction'].map(s =>
      `<button class="btn ${this._sort===s?'btn-primary':'btn-ghost'}" style="font-size:0.52rem;" onclick="TabNpcManors.setSort('${s}')">${s.charAt(0).toUpperCase()+s.slice(1)}</button>`
    ).join('');

    let filtered = manors;
    if (this._filter === 'vacant') filtered = manors.filter(m => this._isVacant(m));
    if (this._filter === 'held')   filtered = manors.filter(m => !this._isVacant(m));

    filtered = [...filtered].sort((a, b) => {
      if (this._sort === 'name')     return (a.name||'').localeCompare(b.name||'');
      if (this._sort === 'location') return (a.location||'').localeCompare(b.location||'');
      if (this._sort === 'faction')  return (a.faction||'').localeCompare(b.faction||'');
      return 0;
    });

    const cardsHtml = filtered.length
      ? filtered.map(m => this._renderCard(m, gm)).join('')
      : `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--ink-soft);font-style:italic;">
          ${this._filter === 'vacant' ? 'No vacant manors.' : this._filter === 'held' ? 'No held manors.' : 'No NPC manors yet.' + (gm ? ' Click "+ Add Manor" to begin.' : '')}
        </div>`;

    panel.innerHTML = `
      <div style="padding:16px 20px 0;">
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
          <div class="page-title" style="margin:0;">NPC Manors</div>
          <div class="page-subtitle" style="margin:0;">${manors.length} manor${manors.length!==1?'s':''}${vacant.length ? ` · <span style="color:var(--crimson-mid);">${vacant.length} vacant</span>` : ''}</div>
          <div style="margin-left:auto;display:flex;gap:6px;">
            ${filterBtns}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;">
          <span style="font-family:var(--font-heading);font-size:0.46rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--ink-soft);">Sort</span>
          ${sortBtns}
          ${gm ? `<button class="btn btn-verdigris" style="margin-left:auto;font-size:0.6rem;" onclick="TabNpcManors.openAdd()">+ Add Manor</button>` : ''}
        </div>
      </div>
      <div id="npc-manors-scroll" style="padding:0 20px 24px;overflow-y:auto;flex:1;">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
          ${cardsHtml}
        </div>
      </div>`;
    requestAnimationFrame(() => {
      const el = document.getElementById('npc-manors-scroll');
      if (el) el.scrollTop = scrollTop;
    });
  },

  _isVacant(m) {
    if (!m.holderId) return true;
    const npc = STORE.getNpc(m.holderId);
    return !npc || npc.status === 'Dead';
  },

  _isOfAge(npc) {
    if (!npc) return false;
    if (npc.came_of_age) return true;
    const age = npc.year_born ? STORE.year - npc.year_born : null;
    return age !== null && age >= 21;
  },

  _renderCard(m, gm) {
    const holder = m.holderId ? STORE.getNpc(m.holderId) : null;
    const vacant = this._isVacant(m);
    const holderDead = holder && holder.status === 'Dead';
    const trustee = m.trusteeId ? STORE.getNpc(m.trusteeId) : null;
    const inTrust = !!(m.trusteeId && holder && !holderDead);
    const holderOfAge = holder && this._isOfAge(holder);
    const trustReady = inTrust && holderOfAge;

    const borderColor = vacant ? 'var(--crimson-mid)' : trustReady ? 'var(--gold)' : 'var(--vellum-deep)';

    const ageNote = holder && !holderDead && !holderOfAge
      ? `<span style="font-size:0.68rem;color:var(--gold);margin-left:4px;font-style:italic;">(Not of age)</span>` : '';

    const holderHtml = holder
      ? `<span class="npc-inline-link" data-npc-hover="${holder.id}" role="button" tabindex="0" onclick="event.stopPropagation();Components.openNpcCard('${holder.id}')" style="${holderDead ? 'text-decoration:line-through;color:var(--ink-soft);' : ''}">${esc(holder.name)}</span>
         ${holderDead ? `<span style="font-size:0.7rem;color:var(--crimson-mid);margin-left:4px;">† ${holder.year_died || 'deceased'}</span>` : ''}
         ${holder.role ? `<span style="font-size:0.7rem;color:var(--ink-soft);margin-left:4px;">(${esc(holder.role)})</span>` : ''}
         ${ageNote}`
      : '<span style="opacity:0.4;font-style:italic;">None assigned</span>';

    const trustHtml = inTrust && trustee ? `
      <div class="manor-key-val">
        <span class="key">Held in Trust by</span>
        <span class="val">
          <span class="npc-inline-link" data-npc-hover="${trustee.id}" role="button" tabindex="0" onclick="event.stopPropagation();Components.openNpcCard('${trustee.id}')">${esc(trustee.name)}</span>
        </span>
      </div>` : '';

    const badgeHtml = vacant
      ? '<div style="position:absolute;top:6px;right:8px;font-size:0.52rem;font-family:var(--font-heading);letter-spacing:0.1em;text-transform:uppercase;color:var(--crimson-mid);background:var(--crimson-mid)11;padding:2px 6px;border-radius:4px;">Vacant</div>'
      : inTrust && !trustReady
        ? '<div style="position:absolute;top:6px;right:8px;font-size:0.52rem;font-family:var(--font-heading);letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);background:var(--gold-tint-1);padding:2px 6px;border-radius:4px;">In Trust</div>'
        : trustReady
          ? '<div style="position:absolute;top:6px;right:8px;font-size:0.52rem;font-family:var(--font-heading);letter-spacing:0.1em;text-transform:uppercase;color:var(--verdigris-mid);background:var(--verdigris-pale);padding:2px 6px;border-radius:4px;">Ready to Assume</div>'
          : '';

    const notesHtml = m.notes ? `<div style="font-size:0.75rem;color:var(--ink-soft);margin-top:6px;font-style:italic;border-top:1px dotted var(--vellum-deep);padding-top:6px;white-space:pre-line;" class="atm-rendered">${AtMention.render(m.notes)}</div>` : '';

    const related = (m.relatedNpcs || []).map((r, idx) => {
      const npc = STORE.getNpc(r.npcId);
      if (!npc) return '';
      const dead = npc.status === 'Dead';
      const noteRendered = r.notes ? `<div style="font-size:0.7rem;color:var(--ink-soft);font-style:italic;margin-left:20px;white-space:pre-line;" class="atm-rendered">${AtMention.render(r.notes)}</div>` : '';
      return `<div style="margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:4px;font-size:0.78rem;">
          <span class="npc-inline-link" data-npc-hover="${npc.id}" role="button" tabindex="0" onclick="event.stopPropagation();Components.openNpcCard('${npc.id}')" style="${dead ? 'text-decoration:line-through;color:var(--ink-soft);' : ''}">${esc(npc.name)}</span>
          ${r.role ? `<span style="color:var(--ink-soft);font-size:0.7rem;">(${esc(r.role)})</span>` : ''}
          ${gm ? `<span style="margin-left:auto;display:flex;gap:2px;">
            <button class="btn btn-ghost" style="font-size:0.45rem;padding:1px 4px;" onclick="event.stopPropagation();TabNpcManors.openEditRelated('${m.id}',${idx})">Edit</button>
            <button class="btn btn-ghost" style="font-size:0.45rem;padding:1px 4px;color:var(--crimson-mid);" onclick="event.stopPropagation();TabNpcManors.removeRelatedNpc('${m.id}','${npc.id}')">✕</button>
          </span>` : ''}
        </div>
        ${noteRendered}
      </div>`;
    }).filter(Boolean).join('');

    const relatedSection = related || gm ? `
      <div style="margin-top:6px;border-top:1px dotted var(--vellum-deep);padding-top:6px;">
        <div style="font-family:var(--font-heading);font-size:0.46rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:4px;">Related NPCs</div>
        ${related || '<span style="font-size:0.75rem;opacity:0.4;font-style:italic;">None</span>'}
        ${gm ? `<button class="btn btn-ghost" style="font-size:0.5rem;padding:2px 6px;margin-top:4px;" onclick="TabNpcManors.openAddRelated('${m.id}')">+ Add</button>` : ''}
      </div>` : '';

    const hasLivingHolder = holder && !holderDead;
    const buttonsHtml = gm ? `
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
          ${holderDead ? `<button class="btn btn-primary" style="font-size:0.55rem;padding:3px 8px;" onclick="TabNpcManors.openSuccession('${m.id}')">Trigger Succession</button>` : ''}
          ${vacant && !holderDead ? `<button class="btn btn-verdigris" style="font-size:0.55rem;padding:3px 8px;" onclick="TabNpcManors.openAssign('${m.id}')">Assign Holder</button>` : ''}
          ${hasLivingHolder && !inTrust ? `<button class="btn btn-ghost" style="font-size:0.55rem;padding:3px 8px;" onclick="TabNpcManors.openAbdicate('${m.id}')">Abdicate</button>` : ''}
          ${trustReady ? `<button class="btn btn-verdigris" style="font-size:0.55rem;padding:3px 8px;" onclick="TabNpcManors.openEndTrust('${m.id}')">End Trust</button>` : ''}
          <button class="btn btn-ghost" style="font-size:0.55rem;padding:3px 8px;" onclick="TabNpcManors.openEdit('${m.id}')">Edit</button>
          <button class="btn btn-ghost" style="font-size:0.55rem;padding:3px 8px;color:var(--crimson-mid);" onclick="TabNpcManors.confirmDelete('${m.id}')">Delete</button>
        </div>` : '';

    return `
      <div class="manor-stat-block" style="border:1px solid ${borderColor};${vacant ? 'border-left:3px solid var(--crimson-mid);' : trustReady ? 'border-left:3px solid var(--gold);' : ''}position:relative;cursor:default;">
        ${badgeHtml}
        <div style="font-family:var(--font-display);font-size:0.88rem;color:var(--ink);margin-bottom:6px;">${esc(m.name)}</div>
        <div class="manor-key-val"><span class="key">Holder</span><span class="val">${holderHtml}</span></div>
        ${trustHtml}
        <div class="manor-key-val"><span class="key">Status</span><span class="val">${this._statusWithTip(m.status)}</span></div>
        <div class="manor-key-val"><span class="key">Location</span><span class="val">${esc(m.location || '—')}</span></div>
        <div class="manor-key-val"><span class="key">Faction</span><span class="val">${esc(m.faction || '—')}</span></div>
        ${relatedSection}
        ${notesHtml}
        ${buttonsHtml}
      </div>`;
  },

  setFilter(f) { this._filter = f; this.render(); },
  setSort(s)   { this._sort = s; this.render(); },

  openAdd() {
    Modal.open(`
      <div style="min-width:400px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Add NPC Manor</div>
        <div class="detail-field mb-8"><div class="detail-label">Manor Name</div><input class="edit-input" id="nm-name" placeholder="e.g. Ebble Manor"></div>
        <div class="detail-field mb-8"><div class="detail-label">Location</div><input class="edit-input" id="nm-location" placeholder="e.g. Salisbury"></div>
        <div class="detail-field mb-8">
          <div class="detail-label">Status</div>
          <select class="edit-input edit-select" id="nm-status">
            <option>Granted</option><option>Gifted</option><option>Seized</option><option>Purchased</option><option>Escheated</option><option>Other</option>
          </select>
        </div>
        <div class="detail-field mb-8"><div class="detail-label">Faction</div><input class="edit-input" id="nm-faction" placeholder="e.g. Royalist"></div>
        <div class="detail-field mb-8">
          <div class="detail-label">Title Holder</div>
          <input class="edit-input" id="nm-holder-search" placeholder="Search NPC by name…" autocomplete="off">
          <input type="hidden" id="nm-holder-id">
          <div id="nm-holder-results" class="npc-search-results" style="display:none;"></div>
        </div>
        <div class="detail-field mb-8"><div class="detail-label">Year Granted</div><input class="edit-input" id="nm-year" type="number" value="${STORE.year}" style="width:100px;"></div>
        <div class="detail-field mb-8"><div class="detail-label">Notes</div><textarea class="edit-input edit-textarea" id="nm-notes" placeholder="Optional notes…"></textarea></div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabNpcManors._saveAdd()">Add</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`, { onOpen: () => this._initHolderSearch('nm-holder-search', 'nm-holder-id', 'nm-holder-results') });
  },

  _saveAdd() {
    const name = document.getElementById('nm-name')?.value?.trim();
    if (!name) { Toast.error('Manor name required'); return; }
    const holderId = document.getElementById('nm-holder-id')?.value || '';
    const yearGranted = parseInt(document.getElementById('nm-year')?.value, 10) || STORE.year;
    const status = document.getElementById('nm-status')?.value || 'Granted';
    const manor = {
      id:       'nm-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
      name,
      location: document.getElementById('nm-location')?.value?.trim() || '',
      status,
      faction:  document.getElementById('nm-faction')?.value?.trim() || '',
      holderId,
      yearGranted,
      notes:    document.getElementById('nm-notes')?.value?.trim() || '',
    };
    if (!STORE.npcManors) STORE.npcManors = [];
    STORE.npcManors.push(manor);
    if (holderId) this._addChronicleEntry(holderId, name, status, yearGranted);
    STORE.save();
    Toast.success(`${esc(name)} added`);
    Modal.close();
    this.render();
  },

  openEdit(id) {
    const m = (STORE.npcManors || []).find(x => x.id === id);
    if (!m) return;
    const holder = m.holderId ? STORE.getNpc(m.holderId) : null;
    const statusOpts = ['Granted','Gifted','Seized','Purchased','Escheated','Other'].map(v =>
      `<option${v===m.status?' selected':''}>${v}</option>`).join('');

    Modal.open(`
      <div style="min-width:400px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Edit — ${esc(m.name)}</div>
        <div class="detail-field mb-8"><div class="detail-label">Manor Name</div><input class="edit-input" id="em-name" value="${esc(m.name)}"></div>
        <div class="detail-field mb-8"><div class="detail-label">Location</div><input class="edit-input" id="em-location" value="${esc(m.location || '')}"></div>
        <div class="detail-field mb-8">
          <div class="detail-label">Status</div>
          <select class="edit-input edit-select" id="em-status">${statusOpts}</select>
        </div>
        <div class="detail-field mb-8"><div class="detail-label">Faction</div><input class="edit-input" id="em-faction" value="${esc(m.faction || '')}"></div>
        <div class="detail-field mb-8">
          <div class="detail-label">Title Holder</div>
          <input class="edit-input" id="em-holder-search" placeholder="Search NPC by name…" autocomplete="off" value="${holder ? esc(holder.name) : ''}">
          <input type="hidden" id="em-holder-id" value="${m.holderId || ''}">
          <div id="em-holder-results" class="npc-search-results" style="display:none;"></div>
          ${holder ? `<div id="em-holder-display" style="font-size:0.75rem;color:var(--ink-soft);margin-top:3px;">Current: ${esc(holder.name)}${holder.status==='Dead'?' (deceased)':''} <button class="btn btn-ghost" style="font-size:0.5rem;padding:1px 4px;" onclick="document.getElementById('em-holder-id').value='';document.getElementById('em-holder-search').value='';this.parentElement.remove();">✕ Clear</button></div>` : ''}
        </div>
        <div class="detail-field mb-8"><div class="detail-label">Notes</div><textarea class="edit-input edit-textarea" id="em-notes">${esc(m.notes || '')}</textarea></div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabNpcManors._saveEdit('${m.id}')">Save</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`, { onOpen: () => this._initHolderSearch('em-holder-search', 'em-holder-id', 'em-holder-results') });
  },

  _saveEdit(id) {
    const m = (STORE.npcManors || []).find(x => x.id === id);
    if (!m) return;
    const name = document.getElementById('em-name')?.value?.trim();
    if (!name) { Toast.error('Manor name required'); return; }
    const newHolderId = document.getElementById('em-holder-id')?.value || '';
    const holderChanged = newHolderId && newHolderId !== m.holderId;

    m.name     = name;
    m.location = document.getElementById('em-location')?.value?.trim() || '';
    m.status   = document.getElementById('em-status')?.value || 'Granted';
    m.faction  = document.getElementById('em-faction')?.value?.trim() || '';
    m.holderId = newHolderId;
    m.notes    = document.getElementById('em-notes')?.value?.trim() || '';

    const npc = newHolderId ? STORE.getNpc(newHolderId) : null;
    if (holderChanged && npc && !this._isOfAge(npc)) {
      STORE.save();
      Modal.close();
      this._openTrustSetupForAssign(id, newHolderId, m.yearGranted || STORE.year, m.status);
      return;
    }

    STORE.save();
    Toast.success('Manor updated');
    Modal.close();
    this.render();
  },

  openAssign(id) {
    const m = (STORE.npcManors || []).find(x => x.id === id);
    if (!m) return;
    Modal.open(`
      <div style="min-width:380px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Assign Holder — ${esc(m.name)}</div>
        <div class="detail-field mb-8">
          <div class="detail-label">Title Holder</div>
          <input class="edit-input" id="as-holder-search" placeholder="Search NPC by name…" autocomplete="off">
          <input type="hidden" id="as-holder-id">
          <div id="as-holder-results" class="npc-search-results" style="display:none;"></div>
          <button class="btn btn-ghost" style="font-size:0.55rem;margin-top:4px;" onclick="TabNpcManors._openQuickCreate('as-holder-search','as-holder-id')">+ Create New NPC</button>
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Year Granted</div>
          <input class="edit-input" id="as-year" type="number" value="${STORE.year}" style="width:100px;">
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Status</div>
          <select class="edit-input edit-select" id="as-status">
            <option>Granted</option><option>Gifted</option><option>Seized</option><option>Purchased</option><option>Escheated</option><option>Other</option>
          </select>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabNpcManors._saveAssign('${m.id}')">Assign</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`, { onOpen: () => this._initHolderSearch('as-holder-search', 'as-holder-id', 'as-holder-results') });
  },

  _saveAssign(id) {
    const m = (STORE.npcManors || []).find(x => x.id === id);
    if (!m) return;
    const holderId = document.getElementById('as-holder-id')?.value;
    if (!holderId) { Toast.error('Select an NPC'); return; }
    const yearGranted = parseInt(document.getElementById('as-year')?.value, 10) || STORE.year;
    const status = document.getElementById('as-status')?.value || m.status || 'Granted';
    const npc = STORE.getNpc(holderId);

    if (npc && !this._isOfAge(npc)) {
      m.status = status;
      m.yearGranted = yearGranted;
      Modal.close();
      this._openTrustSetupForAssign(id, holderId, yearGranted, status);
      return;
    }

    m.holderId = holderId;
    m.yearGranted = yearGranted;
    m.status = status;
    this._addChronicleEntry(holderId, m.name, status, yearGranted);
    STORE.save();
    Toast.success(`${esc(npc?.name || 'NPC')} assigned to ${esc(m.name)}`);
    Modal.close();
    this.render();
  },

  _openTrustSetupForAssign(manorId, holderId, year, status) {
    const m = (STORE.npcManors || []).find(x => x.id === manorId);
    if (!m) return;
    const holder = STORE.getNpc(holderId);
    const holderName = holder?.name || 'the holder';
    const holderAge = holder?.year_born ? STORE.year - holder.year_born : '?';

    Modal.open(`
      <div style="min-width:440px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:6px;">Holder Not of Age — ${esc(m.name)}</div>
        <p style="margin:0 0 14px;font-size:0.85rem;color:var(--ink-soft);">
          ${esc(holderName)} (age ${holderAge}) has not come of age. The manor must be held in trust.
        </p>
        <div class="detail-field mb-8">
          <div class="detail-label">Has ${esc(holderName)} come of age?</div>
          <select class="edit-input edit-select" id="ta-of-age" onchange="TabNpcManors._onTrustAssignOfAgeChange()">
            <option value="no" selected>No — appoint a trustee</option>
            <option value="yes">Yes — mark as of age now</option>
          </select>
        </div>
        <div id="ta-trustee-section">
          <div class="detail-field mb-8">
            <div class="detail-label">Who holds the manor in trust?</div>
            <input class="edit-input" id="ta-trustee-search" placeholder="Search NPC by name…" autocomplete="off">
            <input type="hidden" id="ta-trustee-id">
            <div id="ta-trustee-results" class="npc-search-results" style="display:none;"></div>
            <button class="btn btn-ghost" style="font-size:0.55rem;margin-top:4px;" onclick="TabNpcManors._openQuickCreate('ta-trustee-search','ta-trustee-id')">+ Create New NPC</button>
          </div>
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Notes</div>
          <textarea class="edit-input edit-textarea" id="ta-notes" placeholder="Optional notes…"></textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabNpcManors._saveTrustAssign('${manorId}','${holderId}',${year},'${esc(status)}')">Confirm</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`, { onOpen: () => this._initHolderSearch('ta-trustee-search', 'ta-trustee-id', 'ta-trustee-results') });
  },

  _onTrustAssignOfAgeChange() {
    const val = document.getElementById('ta-of-age')?.value;
    const section = document.getElementById('ta-trustee-section');
    if (section) section.style.display = val === 'yes' ? 'none' : 'block';
  },

  _saveTrustAssign(manorId, holderId, year, status) {
    const m = (STORE.npcManors || []).find(x => x.id === manorId);
    if (!m) return;
    const holder = STORE.getNpc(holderId);
    const holderName = holder?.name || 'Unknown';
    const holderRole = holder?.role || 'holder';
    const ofAge = document.getElementById('ta-of-age')?.value;
    const notes = document.getElementById('ta-notes')?.value?.trim() || '';

    m.holderId = holderId;
    m.yearGranted = year;
    m.notes = notes;

    if (ofAge === 'yes') {
      if (holder) holder.came_of_age = true;
      m.trusteeId = '';
      this._writeChronicle(year, `${holderName} became ${holderRole} of ${m.name} (${status.toLowerCase()})`);
      STORE.save();
      Toast.success(`${esc(holderName)} assigned to ${esc(m.name)}`);
    } else {
      const trusteeId = document.getElementById('ta-trustee-id')?.value;
      if (!trusteeId) { Toast.error('Select a trustee'); return; }
      const trustee = STORE.getNpc(trusteeId);
      m.trusteeId = trusteeId;
      this._writeChronicle(year, `${holderName} granted ${m.name} (${status.toLowerCase()}); manor held in trust by ${trustee?.name || 'Unknown'} until ${holderName} comes of age`);
      STORE.save();
      Toast.success(`${esc(m.name)} held in trust for ${esc(holderName)}`);
    }
    Modal.close();
    this.render();
  },

  openSuccession(id) {
    const m = (STORE.npcManors || []).find(x => x.id === id);
    if (!m) return;
    const prev = m.holderId ? STORE.getNpc(m.holderId) : null;
    const prevName = prev ? esc(prev.name) : 'the previous holder';
    const prevDied = prev?.year_died || '?';

    Modal.open(`
      <div style="min-width:440px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:6px;">Succession — ${esc(m.name)}</div>
        <p style="margin:0 0 14px;font-size:0.85rem;color:var(--ink-soft);">
          ${prevName} has fallen (${prevDied} AD). What becomes of ${esc(m.name)}?
        </p>
        <div class="detail-field mb-8">
          <div class="detail-label">Outcome</div>
          <select class="edit-input edit-select" id="sc-outcome" onchange="TabNpcManors._onSuccessionOutcomeChange()">
            <option value="inherit">Heir Inherits</option>
            <option value="escheat">Escheat to Liege</option>
          </select>
        </div>
        <div id="sc-heir-section">
          <div class="detail-field mb-8">
            <div class="detail-label">New Holder</div>
            <input class="edit-input" id="sc-holder-search" placeholder="Search NPC by name…" autocomplete="off">
            <input type="hidden" id="sc-holder-id">
            <div id="sc-holder-results" class="npc-search-results" style="display:none;"></div>
            <button class="btn btn-ghost" style="font-size:0.55rem;margin-top:4px;" onclick="TabNpcManors._openQuickCreate('sc-holder-search','sc-holder-id')">+ Create New NPC</button>
          </div>
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Year</div>
          <input class="edit-input" id="sc-year" type="number" value="${STORE.year}" style="width:100px;">
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Notes</div>
          <textarea class="edit-input edit-textarea" id="sc-notes" placeholder="e.g. Inherited after ${prevName}'s death, held in trust by…">${prev ? `Inherited after ${prev.name}'s death` : ''}</textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabNpcManors._saveSuccession('${m.id}')">Confirm</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`, { onOpen: () => this._initHolderSearch('sc-holder-search', 'sc-holder-id', 'sc-holder-results') });
  },

  _onSuccessionOutcomeChange() {
    const outcome = document.getElementById('sc-outcome')?.value;
    const heirSection = document.getElementById('sc-heir-section');
    if (heirSection) heirSection.style.display = outcome === 'escheat' ? 'none' : 'block';
  },

  _saveSuccession(id) {
    const m = (STORE.npcManors || []).find(x => x.id === id);
    if (!m) return;
    const outcome = document.getElementById('sc-outcome')?.value;
    const year = parseInt(document.getElementById('sc-year')?.value, 10) || STORE.year;
    const notes = document.getElementById('sc-notes')?.value?.trim() || '';
    const prev = m.holderId ? STORE.getNpc(m.holderId) : null;
    const prevName = prev?.name || 'the previous holder';

    if (outcome === 'escheat') {
      m.holderId = '';
      m.trusteeId = '';
      m.status = 'Escheated';
      m.yearGranted = year;
      m.notes = notes;
      this._writeChronicle(year, `${m.name} escheated to the liege after ${prevName}'s death`);
      STORE.save();
      Toast.success(`${esc(m.name)} escheated`);
      Modal.close();
      this.render();
      return;
    }

    const holderId = document.getElementById('sc-holder-id')?.value;
    if (!holderId) { Toast.error('Select the heir'); return; }
    const heir = STORE.getNpc(holderId);

    if (heir && !this._isOfAge(heir)) {
      Modal.close();
      this._openTrustSetup(id, holderId, year, notes);
      return;
    }

    m.holderId = holderId;
    m.trusteeId = '';
    m.status = 'Granted';
    m.yearGranted = year;
    m.notes = notes;
    const heirRole = heir?.role || 'holder';
    this._writeChronicle(year, `${heir?.name || 'Unknown'} inherited ${m.name} after ${prevName}'s death, becoming ${heirRole} of ${m.name}`);
    STORE.save();
    Toast.success(`${esc(heir?.name || 'Heir')} inherits ${esc(m.name)}`);
    Modal.close();
    this.render();
  },

  _openTrustSetup(manorId, heirId, year, existingNotes) {
    const m = (STORE.npcManors || []).find(x => x.id === manorId);
    if (!m) return;
    const heir = STORE.getNpc(heirId);
    const heirName = heir?.name || 'the heir';
    const heirAge = heir?.year_born ? STORE.year - heir.year_born : '?';

    Modal.open(`
      <div style="min-width:440px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:6px;">Heir Not of Age — ${esc(m.name)}</div>
        <p style="margin:0 0 14px;font-size:0.85rem;color:var(--ink-soft);">
          ${esc(heirName)} (age ${heirAge}) has not come of age. The manor must be held in trust.
        </p>
        <div class="detail-field mb-8">
          <div class="detail-label">Has ${esc(heirName)} come of age?</div>
          <select class="edit-input edit-select" id="ts-of-age" onchange="TabNpcManors._onTrustOfAgeChange()">
            <option value="no" selected>No — appoint a trustee</option>
            <option value="yes">Yes — mark as of age now</option>
          </select>
        </div>
        <div id="ts-trustee-section">
          <div class="detail-field mb-8">
            <div class="detail-label">Who holds the manor in trust?</div>
            <input class="edit-input" id="ts-trustee-search" placeholder="Search NPC by name…" autocomplete="off">
            <input type="hidden" id="ts-trustee-id">
            <div id="ts-trustee-results" class="npc-search-results" style="display:none;"></div>
            <button class="btn btn-ghost" style="font-size:0.55rem;margin-top:4px;" onclick="TabNpcManors._openQuickCreate('ts-trustee-search','ts-trustee-id')">+ Create New NPC</button>
          </div>
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Notes</div>
          <textarea class="edit-input edit-textarea" id="ts-notes">${esc(existingNotes || '')}</textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabNpcManors._saveTrustSetup('${manorId}','${heirId}',${year})">Confirm</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`, { onOpen: () => this._initHolderSearch('ts-trustee-search', 'ts-trustee-id', 'ts-trustee-results') });
  },

  _onTrustOfAgeChange() {
    const val = document.getElementById('ts-of-age')?.value;
    const section = document.getElementById('ts-trustee-section');
    if (section) section.style.display = val === 'yes' ? 'none' : 'block';
  },

  _saveTrustSetup(manorId, heirId, year) {
    const m = (STORE.npcManors || []).find(x => x.id === manorId);
    if (!m) return;
    const heir = STORE.getNpc(heirId);
    const heirName = heir?.name || 'Unknown';
    const heirRole = heir?.role || 'holder';
    const prev = m.holderId ? STORE.getNpc(m.holderId) : null;
    const prevName = prev?.name || 'the previous holder';
    const ofAge = document.getElementById('ts-of-age')?.value;
    const notes = document.getElementById('ts-notes')?.value?.trim() || '';

    m.holderId = heirId;
    m.status = 'Granted';
    m.yearGranted = year;
    m.notes = notes;

    if (ofAge === 'yes') {
      if (heir) heir.came_of_age = true;
      m.trusteeId = '';
      this._writeChronicle(year, `${heirName} inherited ${m.name} after ${prevName}'s death, becoming ${heirRole} of ${m.name}`);
      STORE.save();
      Toast.success(`${esc(heirName)} inherits ${esc(m.name)}`);
    } else {
      const trusteeId = document.getElementById('ts-trustee-id')?.value;
      if (!trusteeId) { Toast.error('Select a trustee'); return; }
      const trustee = STORE.getNpc(trusteeId);
      m.trusteeId = trusteeId;
      this._writeChronicle(year, `${heirName} inherited ${m.name} after ${prevName}'s death; manor held in trust by ${trustee?.name || 'Unknown'} until ${heirName} comes of age`);
      STORE.save();
      Toast.success(`${esc(m.name)} held in trust for ${esc(heirName)}`);
    }
    Modal.close();
    this.render();
  },

  openEndTrust(id) {
    const m = (STORE.npcManors || []).find(x => x.id === id);
    if (!m) return;
    const holder = m.holderId ? STORE.getNpc(m.holderId) : null;
    const trustee = m.trusteeId ? STORE.getNpc(m.trusteeId) : null;
    const holderName = holder?.name || 'the holder';
    const trusteeName = trustee?.name || 'the trustee';

    Modal.open(`
      <div style="min-width:400px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:6px;">End Trust — ${esc(m.name)}</div>
        <p style="margin:0 0 14px;font-size:0.85rem;color:var(--ink-soft);">
          ${esc(holderName)} has come of age. End the trust held by ${esc(trusteeName)} and confirm ${esc(holderName)} as full holder of ${esc(m.name)}?
        </p>
        <div class="detail-field mb-8">
          <div class="detail-label">Year</div>
          <input class="edit-input" id="et-year" type="number" value="${STORE.year}" style="width:100px;">
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Notes</div>
          <textarea class="edit-input edit-textarea" id="et-notes" placeholder="Optional notes…"></textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabNpcManors._saveEndTrust('${m.id}')">End Trust</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`);
  },

  _saveEndTrust(id) {
    const m = (STORE.npcManors || []).find(x => x.id === id);
    if (!m) return;
    const holder = m.holderId ? STORE.getNpc(m.holderId) : null;
    const trustee = m.trusteeId ? STORE.getNpc(m.trusteeId) : null;
    const holderName = holder?.name || 'Unknown';
    const trusteeName = trustee?.name || 'the trustee';
    const year = parseInt(document.getElementById('et-year')?.value, 10) || STORE.year;
    const notes = document.getElementById('et-notes')?.value?.trim() || '';

    if (holder) holder.came_of_age = true;
    m.trusteeId = '';
    if (notes) m.notes = notes;

    this._writeChronicle(year, `${holderName} came of age and assumed full control of ${m.name}, ending the trust held by ${trusteeName}`);
    STORE.save();
    Toast.success(`${esc(holderName)} assumes ${esc(m.name)}`);
    Modal.close();
    this.render();
  },

  openAbdicate(id) {
    const m = (STORE.npcManors || []).find(x => x.id === id);
    if (!m) return;
    const holder = m.holderId ? STORE.getNpc(m.holderId) : null;
    const holderName = holder ? esc(holder.name) : 'the current holder';
    const isGifted = (m.status || '').toLowerCase() === 'gifted';

    Modal.open(`
      <div style="min-width:440px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:6px;">Abdication — ${esc(m.name)}</div>
        <p style="margin:0 0 14px;font-size:0.85rem;color:var(--ink-soft);">
          ${holderName} is stepping down from ${esc(m.name)}.${isGifted ? ' As a gifted manor, the land reverts to the liege unless reassigned.' : ''}
        </p>
        <div class="detail-field mb-8">
          <div class="detail-label">Reason</div>
          <input class="edit-input" id="ab-reason" placeholder="e.g. Infirmity, retirement, took holy orders…">
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Outcome</div>
          <select class="edit-input edit-select" id="ab-outcome" onchange="TabNpcManors._onAbdicateOutcomeChange()">
            <option value="successor">Name a Successor</option>
            <option value="revert">Revert to Liege</option>
          </select>
        </div>
        <div id="ab-successor-section">
          <div class="detail-field mb-8">
            <div class="detail-label">Successor</div>
            <input class="edit-input" id="ab-holder-search" placeholder="Search NPC by name…" autocomplete="off">
            <input type="hidden" id="ab-holder-id">
            <div id="ab-holder-results" class="npc-search-results" style="display:none;"></div>
            <button class="btn btn-ghost" style="font-size:0.55rem;margin-top:4px;" onclick="TabNpcManors._openQuickCreate('ab-holder-search','ab-holder-id')">+ Create New NPC</button>
          </div>
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Year</div>
          <input class="edit-input" id="ab-year" type="number" value="${STORE.year}" style="width:100px;">
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Notes</div>
          <textarea class="edit-input edit-textarea" id="ab-notes" placeholder="Optional notes… use @ to mention NPCs"></textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabNpcManors._saveAbdicate('${m.id}')">Confirm</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`, { onOpen: () => this._initHolderSearch('ab-holder-search', 'ab-holder-id', 'ab-holder-results') });
  },

  _onAbdicateOutcomeChange() {
    const outcome = document.getElementById('ab-outcome')?.value;
    const section = document.getElementById('ab-successor-section');
    if (section) section.style.display = outcome === 'revert' ? 'none' : 'block';
  },

  _saveAbdicate(id) {
    const m = (STORE.npcManors || []).find(x => x.id === id);
    if (!m) return;
    const outcome = document.getElementById('ab-outcome')?.value;
    const year = parseInt(document.getElementById('ab-year')?.value, 10) || STORE.year;
    const reason = document.getElementById('ab-reason')?.value?.trim() || 'abdication';
    const notes = document.getElementById('ab-notes')?.value?.trim() || '';
    const prev = m.holderId ? STORE.getNpc(m.holderId) : null;
    const prevName = prev?.name || 'the previous holder';

    if (outcome === 'revert') {
      m.holderId = '';
      m.trusteeId = '';
      m.status = 'Escheated';
      m.yearGranted = year;
      if (notes) m.notes = notes;
      this._writeChronicle(year, `${prevName} abdicated ${m.name} (${reason}); manor reverted to the liege`);
      STORE.save();
      Toast.success(`${esc(m.name)} reverted to liege`);
      Modal.close();
      this.render();
      return;
    }

    const holderId = document.getElementById('ab-holder-id')?.value;
    if (!holderId) { Toast.error('Select a successor'); return; }
    const heir = STORE.getNpc(holderId);

    if (heir && !this._isOfAge(heir)) {
      m.yearGranted = year;
      if (notes) m.notes = notes;
      STORE.save();
      Modal.close();
      this._openTrustSetupForAssign(id, holderId, year, m.status);
      return;
    }

    const heirName = heir?.name || 'Unknown';
    const heirRole = heir?.role || 'holder';
    m.holderId = holderId;
    m.trusteeId = '';
    m.yearGranted = year;
    if (notes) m.notes = notes;
    this._writeChronicle(year, `${prevName} abdicated ${m.name} (${reason}); ${heirName} succeeded as ${heirRole} of ${m.name}`);
    STORE.save();
    Toast.success(`${esc(heirName)} succeeds at ${esc(m.name)}`);
    Modal.close();
    this.render();
  },

  openAddRelated(id) {
    const m = (STORE.npcManors || []).find(x => x.id === id);
    if (!m) return;
    Modal.open(`
      <div style="min-width:380px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Add Related NPC — ${esc(m.name)}</div>
        <div class="detail-field mb-8">
          <div class="detail-label">NPC</div>
          <input class="edit-input" id="rn-search" placeholder="Search NPC by name…" autocomplete="off">
          <input type="hidden" id="rn-npc-id">
          <div id="rn-results" class="npc-search-results" style="display:none;"></div>
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Role at Manor</div>
          <input class="edit-input" id="rn-role" placeholder="e.g. Household Knight, Chaplain, Steward…">
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Notes</div>
          <textarea class="edit-input edit-textarea" id="rn-notes" placeholder="Optional notes… use @ to mention NPCs"></textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabNpcManors._saveAddRelated('${m.id}')">Add</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`, { onOpen: () => this._initHolderSearch('rn-search', 'rn-npc-id', 'rn-results') });
  },

  _saveAddRelated(id) {
    const m = (STORE.npcManors || []).find(x => x.id === id);
    if (!m) return;
    const npcId = document.getElementById('rn-npc-id')?.value;
    if (!npcId) { Toast.error('Select an NPC'); return; }
    const role = document.getElementById('rn-role')?.value?.trim() || '';
    const notes = document.getElementById('rn-notes')?.value?.trim() || '';
    if (!m.relatedNpcs) m.relatedNpcs = [];
    if (m.relatedNpcs.some(r => r.npcId === npcId)) { Toast.error('Already linked'); return; }
    m.relatedNpcs.push({ npcId, role, notes });
    STORE.save();
    const npc = STORE.getNpc(npcId);
    Toast.success(`${esc(npc?.name || 'NPC')} linked to ${esc(m.name)}`);
    Modal.close();
    this.render();
  },

  openEditRelated(manorId, idx) {
    const m = (STORE.npcManors || []).find(x => x.id === manorId);
    if (!m || !m.relatedNpcs || !m.relatedNpcs[idx]) return;
    const r = m.relatedNpcs[idx];
    const npc = STORE.getNpc(r.npcId);
    const npcName = npc ? esc(npc.name) : 'Unknown NPC';
    Modal.open(`
      <div style="min-width:380px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Edit Related NPC — ${npcName}</div>
        <div class="detail-field mb-8">
          <div class="detail-label">NPC</div>
          <input class="edit-input" id="er-search" placeholder="Search NPC by name…" autocomplete="off" value="${npcName}">
          <input type="hidden" id="er-npc-id" value="${r.npcId}">
          <div id="er-results" class="npc-search-results" style="display:none;"></div>
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Role at Manor</div>
          <input class="edit-input" id="er-role" value="${esc(r.role || '')}" placeholder="e.g. Household Knight, Chaplain, Steward…">
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Notes</div>
          <textarea class="edit-input edit-textarea" id="er-notes" placeholder="Optional notes… use @ to mention NPCs">${esc(r.notes || '')}</textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabNpcManors._saveEditRelated('${manorId}',${idx})">Save</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`, { onOpen: () => this._initHolderSearch('er-search', 'er-npc-id', 'er-results') });
  },

  _saveEditRelated(manorId, idx) {
    const m = (STORE.npcManors || []).find(x => x.id === manorId);
    if (!m || !m.relatedNpcs || !m.relatedNpcs[idx]) return;
    const npcId = document.getElementById('er-npc-id')?.value;
    if (!npcId) { Toast.error('Select an NPC'); return; }
    m.relatedNpcs[idx].npcId = npcId;
    m.relatedNpcs[idx].role = document.getElementById('er-role')?.value?.trim() || '';
    m.relatedNpcs[idx].notes = document.getElementById('er-notes')?.value?.trim() || '';
    STORE.save();
    Toast.success('Updated');
    Modal.close();
    this.render();
  },

  removeRelatedNpc(manorId, npcId) {
    const m = (STORE.npcManors || []).find(x => x.id === manorId);
    if (!m || !m.relatedNpcs) return;
    m.relatedNpcs = m.relatedNpcs.filter(r => r.npcId !== npcId);
    STORE.save();
    this.render();
  },

  _openQuickCreate(searchInputId, hiddenInputId) {
    CardPopup.open(`
      <div style="min-width:360px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Quick Create NPC</div>
        <div class="detail-field mb-8"><div class="detail-label">Name</div><input class="edit-input" id="qc-name" placeholder="e.g. Sir Gareth ap Owain"></div>
        <div class="detail-field mb-8">
          <div class="detail-label">Role</div>
          <select class="edit-input edit-select" id="qc-role">
            <option>Knight</option><option>Vassal Knight</option><option>Estate Holder</option>
            <option>Baron</option><option>Banneret</option><option>Steward</option>
            <option>Baby</option><option>Child</option><option>Page</option><option>Squire</option>
            <option>Priest</option><option>Druid</option><option>Other</option>
          </select>
        </div>
        <div class="detail-field mb-8"><div class="detail-label">Year Born</div><input class="edit-input" id="qc-year-born" type="number" placeholder="e.g. 470" style="width:100px;"></div>
        <div class="detail-field mb-8">
          <div class="detail-label">Pronoun</div>
          <select class="edit-input edit-select" id="qc-pronoun">
            <option>He/him</option><option>She/her</option><option>They/Them</option>
          </select>
        </div>
        <div class="detail-field mb-8"><div class="detail-label">Household</div><input class="edit-input" id="qc-household" placeholder="Optional"></div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabNpcManors._saveQuickCreate('${searchInputId}','${hiddenInputId}')">Create & Select</button>
          <button class="btn btn-ghost" onclick="CardPopup.closeTop()">Cancel</button>
        </div>
      </div>`);
  },

  _saveQuickCreate(searchInputId, hiddenInputId) {
    const name = document.getElementById('qc-name')?.value?.trim();
    if (!name) { Toast.error('Name required'); return; }
    const npc = {
      status: 'Alive',
      name,
      role: document.getElementById('qc-role')?.value || 'Knight',
      year_born: parseInt(document.getElementById('qc-year-born')?.value, 10) || null,
      pronoun: document.getElementById('qc-pronoun')?.value || 'He/him',
      household: document.getElementById('qc-household')?.value?.trim() || '',
      glory: 0, year_died: null, age: null,
      manor: '', eligibility: '', dowry: '', notes: '',
      passions: '', skills: '', stats: '', statblock_template: '',
      blessed: false, blessed_note: '', fate_touched: false,
      page_placed: false, page_court: '',
      training_path: '', training_where: '',
      came_of_age: false, retired: false,
      treeX: null, treeY: null,
    };
    const id = STORE.addNpc(npc);
    STORE.save();
    const searchInput = document.getElementById(searchInputId);
    const hiddenInput = document.getElementById(hiddenInputId);
    if (searchInput) searchInput.value = name;
    if (hiddenInput) hiddenInput.value = id;
    CardPopup.closeTop();
    Toast.success(`${esc(name)} created & selected`);
  },

  confirmDelete(id) {
    const m = (STORE.npcManors || []).find(x => x.id === id);
    if (!m) return;
    Modal.open(`
      <div style="min-width:320px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Delete Manor</div>
        <p style="margin:0 0 16px;font-size:0.88rem;">Remove <strong>${esc(m.name)}</strong> from the NPC manor ledger?</p>
        <div class="btn-row">
          <button class="btn btn-danger" onclick="TabNpcManors._doDelete('${m.id}')">Delete</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
        </div>
      </div>`);
  },

  _doDelete(id) {
    STORE.npcManors = (STORE.npcManors || []).filter(x => x.id !== id);
    STORE.save();
    Toast.success('Manor removed');
    Modal.close();
    this.render();
  },

  _initHolderSearch(searchId, hiddenId, resultsId) {
    const input   = document.getElementById(searchId);
    const hidden  = document.getElementById(hiddenId);
    const results = document.getElementById(resultsId);
    if (!input || !results) return;

    const allNpcs = STORE.allNpcs().sort((a, b) => a.name.localeCompare(b.name));

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) { results.style.display = 'none'; return; }
      const matches = allNpcs.filter(n => {
        const dead = n.status === 'Dead';
        if (dead) return false;
        return n.name.toLowerCase().includes(q) ||
               (n.role || '').toLowerCase().includes(q) ||
               (n.household || '').toLowerCase().includes(q);
      }).slice(0, 10);
      if (!matches.length) { results.style.display = 'none'; return; }
      results.innerHTML = matches.map(n =>
        `<div class="npc-search-item" data-id="${n.id}" style="cursor:pointer;padding:6px 10px;">
          <span class="npc-search-name">${esc(n.name)}</span>
          ${n.role ? `<span class="npc-search-role">${esc(n.role)}</span>` : ''}
          ${n.household ? `<span class="npc-search-hh" style="color:${STORE.householdColour(n.household)}">${STORE.householdIcon(n.household)}</span>` : ''}
        </div>`).join('');
      results.style.display = 'block';
      results.querySelectorAll('.npc-search-item').forEach(item => {
        item.addEventListener('click', () => {
          const npc = STORE.getNpc(item.dataset.id);
          if (npc) {
            input.value = npc.name;
            hidden.value = npc.id;
          }
          results.style.display = 'none';
        });
      });
    });

    input.addEventListener('blur', () => setTimeout(() => { results.style.display = 'none'; }, 200));
    input.addEventListener('focus', () => { if (input.value.trim().length >= 2) input.dispatchEvent(new Event('input')); });
  },

  _STATUS_TIPS: {
    'Granted':   'Granted Manor — a fief given that will be inherited by the holder’s heir. The eldest child (or legitimate heir) inherits the manor.',
    'Gifted':    'Gifted Manor — a Life Fief, held for the lifetime of the recipient. When that recipient dies, the land reverts to the liege lord. Children do not inherit.',
    'Escheated': 'Escheated Manor — reverted to the liege lord, typically because the previous holder died without an heir or committed a serious offence.',
  },

  _statusWithTip(status) {
    const tip = this._STATUS_TIPS[status];
    if (!tip) return esc(status || '—');
    return `<span style="cursor:help;border-bottom:1px dotted var(--ink-soft);" title="${esc(tip)}">${esc(status)}</span>`;
  },

  _addChronicleEntry(holderId, manorName, status, year) {
    const npc = STORE.getNpc(holderId);
    if (!npc) return;
    const role = npc.role || 'holder';
    const verb = (status || 'Granted').toLowerCase();
    const text = `${npc.name} became ${role} of ${manorName} (${verb})`;
    this._writeChronicle(year, text);
  },

  _writeChronicle(year, text) {
    if (!STORE.chronicle) STORE.chronicle = {};
    const key = String(year);
    if (!STORE.chronicle[key]) STORE.chronicle[key] = [];
    STORE.chronicle[key].push({ id: 'ev-' + crypto.randomUUID(), text, cat: 'political', ts: Date.now() });
  },

  getVacantCount() {
    return (STORE.npcManors || []).filter(m => this._isVacant(m)).length;
  },

  getVacantManors() {
    return (STORE.npcManors || []).filter(m => this._isVacant(m));
  },
};
