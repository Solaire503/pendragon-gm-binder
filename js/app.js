/* ══════════════════════════════════════════════════════════════
   APP.JS — Init, routing, global wiring
══════════════════════════════════════════════════════════════ */

const APP_VERSION = '2.9.1';


// ── FILE SYNC STATUS INDICATOR ────────────────────────────────
const FileSync = {
  _states: {
    saved:   { icon: '✓', label: 'Saved',   colour: '#2a8a40' },
    unsaved: { icon: '●', label: 'Unsaved', colour: '#c08010' },
    saving:  { icon: '↑', label: 'Saving…', colour: '#b8860b' },
    error:   { icon: '✕', label: 'Error',   colour: '#9a2424' },
    offline: { icon: '◌', label: 'Local',   colour: '#7a7060' },
  },

  setStatus(state) {
    const icon  = document.getElementById('syncIcon');
    const label = document.getElementById('syncLabel');
    const wrap  = document.getElementById('syncStatus');
    const s     = this._states[state] || this._states.offline;
    if (icon)  { icon.textContent  = s.icon;  icon.style.color  = s.colour; }
    if (label) { label.textContent = s.label; label.style.color = s.colour; }
    if (wrap)  { wrap.title = `File sync: ${s.label}`; wrap.dataset.status = state; }
  },
};

const APP = {
  _currentTab: 'dashboard',
  currentUser: null,

  async init() {
    FileSync.setStatus('saving');

    // User identity injected by server at page load (window.__USER__)
    this.currentUser = window.__USER__ || null;

    // Wire modal first so the welcome screen can use it
    Modal.initListeners();
    HoverCard.init();
    AtMention.init();  // @mention autocomplete — must be after DOM ready

    // Try loading from configured save file
    const loadResult = await STORE.loadFromFile();

    if (loadResult === 'loaded') {
      // Great — data loaded from file, proceed normally

    } else if (loadResult === 'no_config' || loadResult === 'file_missing') {
      // No save file configured on this computer yet — show welcome screen
      // Seed localStorage so there's something to save
      STORE.init();
      await this._showWelcome(loadResult);
      return; // welcome flow calls location.reload() on confirm, which re-runs init() → _boot()

    } else if (loadResult === 'corrupt') {
      // Save file failed to parse — fall back to localStorage (same as offline).
      // Toast already shown by importJSON; do NOT silently continue as if nothing happened.
      STORE.init();
      FileSync.setStatus('error');

    } else {
      // Server offline — fall back to localStorage silently
      STORE.init();
    }

    this._boot();
  },

  // Shared boot — wires up controls, renders first tab.
  // Called after data is ready (either from file, localStorage, or post-welcome).
  _boot() {
    // Pre-load pins so the dashboard widget and NPC card pin buttons are ready.
    if (typeof PinsManager !== 'undefined') PinsManager.load();
    if (typeof Notes !== 'undefined') Notes.load();
    if (typeof Notifications !== 'undefined') Notifications.startPolling();
    // Prompt for email if not set — deferred so the UI is fully ready
    setTimeout(() => this._promptEmailIfMissing(), 1500);
    // Wire nav tabs
    document.querySelectorAll('.nav-tab').forEach(btn => {
      if (btn.dataset.tab) btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Wire Fate dropdown
    const fateTrigger = document.getElementById('navFateBtn');
    const fateMenu    = document.getElementById('navFateMenu');
    if (fateTrigger && fateMenu) {
      fateTrigger.addEventListener('click', e => {
        e.stopPropagation();
        const opening = !fateMenu.classList.contains('open');
        fateMenu.classList.toggle('open');
        if (opening) document.getElementById('navRecordsMenu')?.classList.remove('open');
      });
      fateMenu.querySelectorAll('.nav-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          this.switchTab(item.dataset.tab);
          fateMenu.classList.remove('open');
        });
      });
      document.addEventListener('click', () => fateMenu.classList.remove('open'));
    }

    // Wire Records dropdown
    const recordsTrigger = document.getElementById('navRecordsBtn');
    const recordsMenu    = document.getElementById('navRecordsMenu');
    if (recordsTrigger && recordsMenu) {
      recordsTrigger.addEventListener('click', e => {
        e.stopPropagation();
        const opening = !recordsMenu.classList.contains('open');
        recordsMenu.classList.toggle('open');
        if (opening) document.getElementById('navFateMenu')?.classList.remove('open');
      });
      recordsMenu.querySelectorAll('.nav-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          this.switchTab(item.dataset.tab);
          recordsMenu.classList.remove('open');
        });
      });
      document.addEventListener('click', () => recordsMenu.classList.remove('open'));
    }

    // Wire Archive dropdown
    const archiveTrigger = document.getElementById('hdrArchiveBtn');
    const archiveMenu    = document.getElementById('hdrArchiveMenu');
    if (archiveTrigger && archiveMenu) {
      archiveTrigger.addEventListener('click', e => {
        e.stopPropagation();
        archiveMenu.classList.toggle('open');
      });
      document.addEventListener('click', () => archiveMenu.classList.remove('open'));
    }

    // Year controls
    document.getElementById('currentYear').textContent = STORE.year;
    document.getElementById('yearUp').addEventListener('click', () => {
      STORE.setYear(STORE.year + 1);
      document.getElementById('currentYear').textContent = STORE.year;
      document.title = `Pendragon GM's Binder — ${STORE.year} AD`;
      this.refreshCurrentTab();
    });
    document.getElementById('yearDown').addEventListener('click', () => {
      if (STORE.year <= 1) return;
      STORE.setYear(STORE.year - 1);
      document.getElementById('currentYear').textContent = STORE.year;
      document.title = `Pendragon GM's Binder — ${STORE.year} AD`;
      this.refreshCurrentTab();
    });

    // Export
    document.getElementById('btnExport').addEventListener('click', () => {
      const json = STORE.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
      a.href = url; a.download = `pendragon_binder_${date}.json`; a.click();
      URL.revokeObjectURL(url);
      Toast.success('Exported');
    });

    // Import
    document.getElementById('btnImport').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json';
      input.onchange = e => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async ev => {
          if (STORE.importJSON(ev.target.result)) {
            Toast.success('Imported — saving…');
            // Push imported data to the server file so reload loads the right data
            await STORE.syncToFile().catch(() => {});
            setTimeout(() => location.reload(), 400);
          } else { Toast.error('Import failed — invalid file'); }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    // "Change Save File" link in sync status — GM only
    if (this.currentUser?.role === 'gm') {
      document.getElementById('syncStatus')?.addEventListener('dblclick', () => {
        this._showFilePicker('change');
      });
      document.getElementById('syncStatus').title = 'Double-click to change save file';
    }

    // Patch notes button — keep label in sync with APP_VERSION constant
    const patchBtn = document.getElementById('btnPatchNotes');
    if (patchBtn) {
      patchBtn.textContent = 'v' + APP_VERSION;
      patchBtn.addEventListener('click', () => { this.showPatchNotes(); });
    }

    // Features guide button
    document.getElementById('btnFeatures')?.addEventListener('click', () => { this.showFeatures(); });

    // AI key button — reflect saved key state on load
    const aiKeyBtn = document.getElementById('btnApiKey');
    if (aiKeyBtn) {
      aiKeyBtn.addEventListener('click', () => { this.showApiKeySettings(); });
      fetch('/api/config').then(r => r.json()).then(cfg => {
        if (cfg.hasApiKey) aiKeyBtn.classList.add('key-set');
      }).catch(() => {});
    }

    document.getElementById('btnUsers')?.addEventListener('click', () => this._openUserMgmt());

    document.title = isGM()
      ? `Pendragon GM's Binder — ${STORE.year} AD`
      : `Pendragon Binder — ${STORE.year} AD`;
    STORE.startPeriodicSync();

    // Multiplayer: broadcasts, presence, heartbeat
    Multiplayer.init();

    // Best-effort flush on page close — sendBeacon fires even during unload.
    // GM only: players are read-only and /api/save is @gm_required server-side.
    window.addEventListener('beforeunload', () => {
      if (isGM() && STORE._dirty) {
        try {
          navigator.sendBeacon('/api/save', new Blob([STORE.exportJSON()], { type: 'application/json' }));
        } catch(e) {}
      }
    });

    this._applyRoleRestrictions();
    this.switchTab('dashboard');
  },

  // ── ROLE-BASED UI ───────────────────────────────────────────
  _applyRoleRestrictions() {
    const user = this.currentUser;

    // Inject user display + account/logout links into header
    const headerRight = document.querySelector('.header-right');
    if (headerRight && user) {
      const userEl = document.createElement('div');
      userEl.className = 'header-user';
      userEl.innerHTML =
        `<span class="header-username">${user.username}</span>` +
        `<a href="/account" class="hdr-btn hdr-btn-outline" title="Change passphrase">🗝</a>` +
        `<form method="POST" action="/logout" style="display:inline;margin:0;">
  <button type="submit" class="hdr-btn hdr-btn-outline" title="Sign out">Sign out</button>
</form>`;
      headerRight.prepend(userEl);
    }

    if (!user || user.role === 'gm') return;

    // CSS class already set server-side (html.is-player) — hides GM-only elements
    // and shows the read-only banner with no flash.

    // Start auto-refresh so players see GM changes without manual reload
    this._startPlayerRefresh();
  },

  _startPlayerRefresh() {
    setInterval(async () => {
      // Skip expensive polls when tab is hidden
      if (document.hidden) return;
      // HI-7: never clobber a player who is mid-edit. A full-file refresh
      // calls importJSON() + re-renders the tab, which wipes textareas,
      // closes open forms, and aborts in-progress drags. Bail if any
      // signal says the user has unsaved or in-flight work — the next
      // tick will try again.
      if (!this._playerRefreshIsSafe()) return;
      const result = await STORE.loadFromFile();
      if (result === 'loaded') this.refreshCurrentTab();
    }, 30 * 1000);
  },

  // Returns false when a background refresh would destroy in-progress
  // player work (HI-7 guard). Any one signal is enough to skip.
  _playerRefreshIsSafe() {
    // 1. Local STORE has unsaved edits — the 3s debounced sync will
    //    flush them shortly; don't race it with an inbound overwrite.
    if (STORE._dirty) return false;
    // 2. Notes has a pending debounced save (2s).
    if (typeof Notes !== 'undefined' && Notes._saveTimer) return false;
    // 3. Modal or CardPopup open — player is mid-action in a form.
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay && !modalOverlay.hidden) return false;
    if (typeof CardPopup !== 'undefined' && CardPopup.isOpen()) return false;
    // 4. Text input currently focused — player is typing.
    const ae = document.activeElement;
    if (ae) {
      const tag = ae.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || ae.isContentEditable) return false;
    }
    // 5. Family-tree drag in progress.
    if (typeof TabTree !== 'undefined' && TabTree._dragging) return false;
    return true;
  },

  // ── WELCOME SCREEN ──────────────────────────────────────────
  async _showWelcome(reason) {
    const main = document.getElementById('app');
    const reasonMsg = reason === 'file_missing'
      ? '<div style="background:rgba(122,28,28,0.1);border:1px solid rgba(122,28,28,0.3);border-radius:4px;padding:10px 14px;margin-bottom:20px;font-size:0.9rem;color:var(--crimson-mid);">⚠ The previous save file could not be found at its saved location.<br>Please locate it or create a new one.</div>'
      : '';

    main.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--ink);background-image:radial-gradient(ellipse at 20% 50%,#2a1a08 0%,#0f0a04 100%);">
        <div style="background:var(--vellum);border:2px solid var(--gold);border-radius:12px;padding:48px 52px;max-width:520px;width:90%;box-shadow:0 24px 64px rgba(0,0,0,0.6);text-align:center;">
          <div style="font-family:var(--font-display);font-size:1.6rem;color:var(--ink);margin-bottom:6px;">Pendragon</div>
          <div style="font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.35em;text-transform:uppercase;color:var(--gold);margin-bottom:32px;">GM's Binder</div>

          ${reasonMsg}

          <div style="font-family:var(--font-heading);font-size:0.62rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:20px;opacity:0.7;">Choose how to proceed</div>

          <div style="display:flex;flex-direction:column;gap:12px;">
            <button class="btn btn-primary" style="padding:14px;font-size:0.7rem;letter-spacing:0.15em;" onclick="APP._showFilePicker('open')">
              📂 &nbsp; Open Existing Save File
              <div style="font-family:var(--font-body);font-size:0.78rem;font-weight:normal;letter-spacing:0;text-transform:none;margin-top:4px;opacity:0.8;">Load your binder-save.json from Google Drive or anywhere else</div>
            </button>
            <button class="btn btn-verdigris" style="padding:14px;font-size:0.7rem;letter-spacing:0.15em;" onclick="APP._showFilePicker('new')">
              ✦ &nbsp; Create New Save File
              <div style="font-family:var(--font-body);font-size:0.78rem;font-weight:normal;letter-spacing:0;text-transform:none;margin-top:4px;opacity:0.8;">Start fresh or save your current data to a new location</div>
            </button>
          </div>

          <div style="margin-top:24px;font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.12em;color:var(--ink-soft);opacity:0.45;text-transform:uppercase;">Your data is safe in this browser until you choose</div>
        </div>
      </div>`;
  },

  // ── FILE PICKER ─────────────────────────────────────────────
  async _showFilePicker(mode) {
    // mode: 'open' | 'new' | 'change'
    const title = mode === 'new'    ? 'Create New Save File'
                : mode === 'change' ? 'Change Save File'
                :                    'Open Existing Save File';

    // Fetch initial browse listing and drive list in parallel
    let browseData, drivesData;
    try {
      const [br, dr] = await Promise.all([
        fetch('/api/browse').then(r => r.json()),
        fetch('/api/drives').then(r => r.json()).catch(() => ({ base_dir: '', drives: [] })),
      ]);
      browseData = br;
      drivesData = dr;
    } catch(e) {
      Toast.error('Cannot browse — is the server running?');
      return;
    }

    const renderEntries = (data) => {
      const list = document.getElementById('fpList');
      if (!list) return;
      document.getElementById('fpCurrentPath').textContent = data.current;
      // Escape a filesystem path for embedding inside a single-quoted JS string
      // inside a double-quoted HTML attribute. Covers \, ', ", <, > to prevent
      // malformed directory names from breaking out of the attribute.
      const escP = p => p.replace(/\\/g,'\\\\').replace(/'/g,"\\'")
                        .replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const escText = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      list.innerHTML = data.entries.map(e => {
        const isJson = e.type === 'file' && e.ext === '.json';
        const icon   = e.type === 'dir' ? '📁' : (isJson ? '📄' : '—');
        const style  = e.type === 'file' && !isJson ? 'opacity:0.4;pointer-events:none;' : '';
        const click  = e.type === 'dir'
          ? `APP._fpNavigate('${escP(e.path)}')`
          : (isJson ? `APP._fpSelectFile('${escP(e.path)}')` : '');
        return `<div class="fp-entry" style="${style}" onclick="${click}">
          <span class="fp-icon">${icon}</span>
          <span class="fp-name">${escText(e.name)}</span>
        </div>`;
      }).join('') || '<div style="padding:12px;opacity:0.5;font-style:italic;">Empty folder</div>';
    };

    // Build shortcuts bar: Binder folder + detected drives
    const binderShortcut = drivesData.base_dir
      ? `<button class="fp-shortcut" title="${drivesData.base_dir}"
           onclick="APP._fpNavigate('${drivesData.base_dir.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')">
           📂 Binder Folder
         </button>` : '';
    const driveButtons = (drivesData.drives || []).map(d =>
      `<button class="fp-shortcut"
         onclick="APP._fpNavigate('${d.path.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')">
         💾 ${d.label}
       </button>`
    ).join('');

    APP._fpCurrentPath = browseData.current;

    Modal.open(`
      <div style="min-width:min(540px,92vw);">
        <div class="page-title" style="font-size:1rem;margin-bottom:12px;">${title}</div>

        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          ${binderShortcut}${driveButtons}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;">
          <input class="edit-input" id="fpGoTo" placeholder="Paste a path and press Enter…"
            style="flex:1;font-size:0.8rem;padding:5px 8px;"
            onkeydown="if(event.key==='Enter'){APP._fpNavigate(this.value.trim());}">
          <button class="btn btn-ghost" style="padding:5px 10px;font-size:0.7rem;white-space:nowrap;"
            onclick="APP._fpNavigate(document.getElementById('fpGoTo').value.trim())">Go</button>
        </div>

        <div style="font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--ink-soft);opacity:0.6;margin-bottom:3px;">Current Folder</div>
        <div id="fpCurrentPath" style="font-size:0.78rem;color:var(--ink-soft);margin-bottom:8px;padding:5px 8px;background:var(--vellum-mid);border-radius:4px;word-break:break-all;">${browseData.current}</div>
        <div id="fpList" style="height:260px;overflow-y:auto;border:1px solid var(--vellum-deep);border-radius:4px;background:var(--vellum);margin-bottom:12px;"></div>
        ${mode === 'new' ? `
          <div class="detail-field mb-12">
            <div class="detail-label">File name</div>
            <input class="edit-input" id="fpFilename" placeholder="binder-save.json" value="binder-save.json">
          </div>` : ''}
        <div style="font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-soft);opacity:0.55;margin-bottom:6px;">Selected</div>
        <input class="edit-input" id="fpSelected" placeholder="${mode === 'new' ? 'Navigate to a folder, then confirm below' : 'Click a .json file above to select it'}" style="margin-bottom:14px;">
        <div class="btn-row">
          <button class="btn btn-primary" onclick="APP._fpConfirm('${mode}')">${mode === 'new' ? 'Create Here' : 'Open'}</button>
          <button class="btn btn-ghost" onclick="Modal.close()${mode !== 'change' ? ';APP._showWelcome(\"no_config\")' : ''}">Cancel</button>
        </div>
      </div>`, { wide: false });

    // Add CSS for file picker entries + shortcut buttons
    if (!document.getElementById('fpStyle')) {
      const s = document.createElement('style');
      s.id = 'fpStyle';
      s.textContent = [
        `.fp-entry{display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:pointer;border-bottom:1px solid var(--vellum-mid);transition:background 0.1s;font-size:0.9rem;}`,
        `.fp-entry:hover{background:var(--vellum-mid);}`,
        `.fp-icon{font-size:1rem;flex-shrink:0;}`,
        `.fp-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}`,
        `.fp-shortcut{font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.06em;padding:4px 10px;border:1px solid var(--vellum-deep);border-radius:4px;background:var(--vellum-mid);color:var(--ink-soft);cursor:pointer;white-space:nowrap;}`,
        `.fp-shortcut:hover{background:var(--vellum-dark);color:var(--ink);}`,
      ].join('');
      document.head.appendChild(s);
    }

    renderEntries(browseData);
  },

  _fpCurrentPath: '',

  async _fpNavigate(path) {
    this._fpCurrentPath = path;
    let data;
    try {
      const r = await fetch('/api/browse?path=' + encodeURIComponent(path));
      data = await r.json();
    } catch(e) { return; }

    const list = document.getElementById('fpList');
    const cur  = document.getElementById('fpCurrentPath');
    if (!list || !cur) return;

    cur.textContent = data.current;
    this._fpCurrentPath = data.current;

    // Clear the go-to input now that navigation succeeded
    const goTo = document.getElementById('fpGoTo');
    if (goTo) goTo.value = '';

    // Update selected field with folder path for new-file mode
    const sel = document.getElementById('fpSelected');
    const fname = document.getElementById('fpFilename');
    if (sel && fname) {
      sel.value = data.current + '\\' + (fname.value || 'binder-save.json');
    }

    const escP2 = p => p.replace(/\\/g,'\\\\').replace(/'/g,"\\'")
                        .replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const escText2 = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    list.innerHTML = data.entries.map(e => {
      const isJson = e.type === 'file' && e.ext === '.json';
      const icon   = e.type === 'dir' ? '📁' : (isJson ? '📄' : '—');
      const style  = e.type === 'file' && !isJson ? 'opacity:0.4;pointer-events:none;' : '';
      const click  = e.type === 'dir'
        ? `APP._fpNavigate('${escP2(e.path)}')`
        : (isJson ? `APP._fpSelectFile('${escP2(e.path)}')` : '');
      return `<div class="fp-entry" style="${style}" onclick="${click}">
        <span class="fp-icon">${icon}</span>
        <span class="fp-name">${escText2(e.name)}</span>
      </div>`;
    }).join('') || '<div style="padding:12px;opacity:0.5;font-style:italic;">Empty folder</div>';
  },

  _fpSelectFile(path) {
    const sel = document.getElementById('fpSelected');
    if (sel) sel.value = path;
  },

  async _fpConfirm(mode) {
    const sel   = document.getElementById('fpSelected')?.value?.trim();
    const fname = document.getElementById('fpFilename')?.value?.trim() || 'binder-save.json';

    let finalPath = sel;
    if (mode === 'new' && !sel) {
      finalPath = this._fpCurrentPath + '\\' + fname;
    } else if (mode === 'new' && sel && !sel.endsWith('.json')) {
      finalPath = sel + '\\' + fname;
    }

    if (!finalPath) { Toast.error('Please select a location'); return; }

    Modal.close();

    if (mode === 'new') {
      // Create new file, seed with current data
      FileSync.setStatus('saving');
      try {
        const res = await fetch('/api/new', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ saveFile: finalPath }),
        });
        if (!res.ok) throw new Error();
        // Now write actual current data to it
        await STORE.saveToNewFile(finalPath);
        Toast.success('Save file created!');
      } catch(e) {
        Toast.error('Could not create file — check the path');
        return;
      }
    } else {
      // Open existing — set config then reload
      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ saveFile: finalPath }),
        });
        if (!res.ok) throw new Error();
      } catch(e) {
        Toast.error('Could not set save file');
        return;
      }
    }

    // Reload to apply
    Toast.success('Save file set — loading…');
    setTimeout(() => location.reload(), 800);
  },

  switchTab(name) {
    this._currentTab = name;

    // Update nav
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === name);
    });
    // Fate dropdown button: active when winter or mausoleum is showing
    const fateBtn = document.getElementById('navFateBtn');
    if (fateBtn) fateBtn.classList.toggle('active', name === 'winter' || name === 'mausoleum');
    // Records dropdown button: active when chronicle or journal is showing
    const recordsBtn = document.getElementById('navRecordsBtn');
    if (recordsBtn) recordsBtn.classList.toggle('active', name === 'chronicle' || name === 'journal');
    // Close dropdowns on any tab switch
    const fateMenu = document.getElementById('navFateMenu');
    if (fateMenu) fateMenu.classList.remove('open');
    const recordsMenu = document.getElementById('navRecordsMenu');
    if (recordsMenu) recordsMenu.classList.remove('open');

    // Show/hide panels
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === 'tab-' + name);
    });

    // Render the tab
    this._renderTab(name);
  },

  _renderTab(name) {
    switch (name) {
      case 'dashboard':  TabDashboard.render();  break;
      case 'roster':     TabRoster.render();     break;
      case 'manors':     TabManors.render();     break;
      case 'families':   TabFamilies.render();   break;
      case 'winter':     TabWinter.render();     break;
      case 'mausoleum':  TabMausoleum.render();   break;
      case 'chronicle':  TabChronicle.render();   break;
      case 'journal':    if (typeof TabJournal !== 'undefined') TabJournal.render(); break;
    }
  },

  refreshCurrentTab() {
    this._renderTab(this._currentTab);
  },

  // ── PATCH NOTES ───────────────────────────────────────────
  showPatchNotes() {
    const sectionsHtml = (sections) => sections.map(s => `
      <div style="margin-bottom:16px;">
        <div style="font-family:var(--font-heading);font-size:0.58rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);margin-bottom:8px;">${s.heading}</div>
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:5px;">
          ${s.items.map(i => `<li style="font-size:0.88rem;color:var(--ink-soft);">${i}</li>`).join('')}
        </ul>
      </div>`).join('');

    const notesHtml = PATCH_NOTES.map(n => `
      <div style="margin-bottom:28px;">
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--vellum-deep);">
          <span style="font-family:var(--font-display);font-size:1rem;color:var(--ink);">v${n.version}</span>
          <span style="font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--ink-soft);opacity:0.5;">${n.date}</span>
        </div>
        ${sectionsHtml(n.sections)}
      </div>`).join('');

    Modal.open(`
      <div style="min-width:min(580px,90vw);max-height:75vh;overflow-y:auto;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <div class="page-title" style="font-size:1rem;margin:0;">Pendragon GM's Binder</div>
          <span style="font-family:var(--font-heading);font-size:0.55rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold);background:rgba(184,134,11,0.1);border:1px solid rgba(184,134,11,0.3);padding:2px 8px;border-radius:20px;">v${APP_VERSION}</span>
        </div>
        ${notesHtml}
        <div class="btn-row" style="margin-top:8px;">
          <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        </div>
      </div>`);
  },

  // ── FEATURES GUIDE ────────────────────────────────────────
  showFeatures() {
    // For players, only show entries up to (but not including) the GM divider
    let featureList = FEATURES;
    if (!isGM()) {
      const gmDividerIdx = FEATURES.findIndex(f => f.divider && f.label && f.label.includes('GM Feature'));
      if (gmDividerIdx !== -1) featureList = FEATURES.slice(0, gmDividerIdx);
    }
    const featuresHtml = featureList.map(f => {
      if (f.divider) return `
        <div style="display:flex;align-items:center;gap:12px;margin:28px 0 18px;">
          <div style="flex:1;height:1px;background:var(--gold);opacity:0.3;"></div>
          <div style="font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--gold);white-space:nowrap;">${f.label}</div>
          <div style="flex:1;height:1px;background:var(--gold);opacity:0.3;"></div>
        </div>`;
      return `
        <div style="margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--vellum-deep);">
            <span style="font-size:1.1rem;">${f.icon}</span>
            <span style="font-family:var(--font-heading);font-size:0.8rem;font-weight:700;letter-spacing:0.06em;color:var(--ink);">${f.heading}</span>
          </div>
          <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;">
            ${f.items.map(i => `<li style="font-size:0.87rem;color:var(--ink-soft);line-height:1.55;">${i}</li>`).join('')}
          </ul>
        </div>`;
    }).join('');

    Modal.open(`
      <div style="min-width:min(620px,90vw);max-height:78vh;overflow-y:auto;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <div class="page-title" style="font-size:1rem;margin:0;">📖 Features Guide</div>
          <span style="font-family:var(--font-heading);font-size:0.55rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold);background:rgba(184,134,11,0.1);border:1px solid rgba(184,134,11,0.3);padding:2px 8px;border-radius:20px;">v${APP_VERSION}</span>
        </div>
        <p style="font-size:0.82rem;color:var(--ink-soft);margin-bottom:4px;line-height:1.6;">Your Player Knight section is at the top. Scroll down to see the full GM feature set.</p>
        ${featuresHtml}
        <div class="btn-row" style="margin-top:8px;">
          <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        </div>
      </div>`);
  },

  showApiKeySettings() {
    Modal.open(`
      <div style="min-width:min(420px,90vw);">
        <div class="page-title" style="font-size:1rem;margin-bottom:16px;">🔑 Anthropic API Key</div>
        <p style="font-size:0.83rem;color:var(--ink-soft);line-height:1.6;margin-bottom:18px;">
          Used to generate AI flavor text in the Solos tab. The key is stored in
          <code style="font-size:0.78rem;background:var(--vellum-deep);padding:1px 5px;border-radius:3px;">config.json</code>
          on your local machine and never leaves your network — all requests are proxied through the local server.
        </p>
        <label style="display:block;font-size:0.78rem;font-family:var(--font-heading);letter-spacing:0.06em;color:var(--ink-soft);margin-bottom:6px;">API KEY</label>
        <input id="apiKeyInput" type="password" placeholder="sk-ant-…"
          style="width:100%;box-sizing:border-box;padding:8px 10px;font-size:0.85rem;font-family:monospace;background:var(--vellum-deep);border:1px solid var(--vellum-mid);border-radius:4px;color:var(--ink);margin-bottom:6px;">
        <div style="font-size:0.72rem;color:var(--ink-soft);margin-bottom:18px;" id="apiKeyStatus">Loading…</div>
        <div class="btn-row">
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" onclick="APP.saveApiKey()">Save Key</button>
          <button class="btn btn-ghost" style="color:#c0392b;border-color:rgba(192,57,43,0.3);" onclick="APP.clearApiKey()">Clear Key</button>
        </div>
      </div>`);

    // Check current key status
    fetch('/api/config').then(r => r.json()).then(cfg => {
      const el = document.getElementById('apiKeyStatus');
      if (el) el.textContent = cfg.hasApiKey ? '✔ A key is currently saved.' : 'No key saved yet.';
    }).catch(() => {});
  },

  saveApiKey() {
    const val = (document.getElementById('apiKeyInput')?.value || '').trim();
    if (!val) { Toast.show('Enter a key first.', 'warning'); return; }
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anthropicKey: val }),
    }).then(r => {
      if (!r.ok) throw new Error('Server returned ' + r.status);
      return r.json();
    }).then(data => {
      if (!data.ok) throw new Error(data.error || 'Unknown error');
      document.getElementById('btnApiKey')?.classList.add('key-set');
      Toast.show('API key saved.', 'success');
      Modal.close();
    }).catch(e => Toast.show('Failed to save key: ' + e.message, 'error'));
  },

  clearApiKey() {
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anthropicKey: '' }),
    }).then(r => {
      if (!r.ok) throw new Error('Server returned ' + r.status);
      return r.json();
    }).then(() => {
      document.getElementById('btnApiKey')?.classList.remove('key-set');
      Toast.show('API key cleared.', 'success');
      Modal.close();
    }).catch(e => Toast.show('Failed to clear key: ' + e.message, 'error'));
  },

  // ── EMAIL PROMPT ───────────────────────────────────────────
  async _promptEmailIfMissing() {
    try {
      const r = await fetch('/api/me');
      if (!r.ok) return;
      const d = await r.json();
      if (d.hasEmail) return;
    } catch { return; }

    Modal.open(`
      <div style="max-width:360px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:6px;">📧 Add Your Email</div>
        <div style="font-size:0.85rem;color:var(--ink-soft);margin-bottom:16px;line-height:1.5;">
          Add an email address so you can reset your passphrase if you ever get locked out.
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <input id="email-prompt-1" type="email" class="edit-input" placeholder="your@email.com" autocomplete="email">
          <input id="email-prompt-2" type="email" class="edit-input" placeholder="Confirm email" autocomplete="email">
          <div id="email-prompt-err" style="color:var(--crimson-mid);font-size:0.8rem;display:none;"></div>
        </div>
        <div class="btn-row" style="margin-top:14px;">
          <button class="btn btn-primary" onclick="APP._saveEmailPrompt()">Save Email</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Skip for now</button>
        </div>
      </div>`);
  },

  async _saveEmailPrompt() {
    const e1 = document.getElementById('email-prompt-1')?.value.trim();
    const e2 = document.getElementById('email-prompt-2')?.value.trim();
    const errEl = document.getElementById('email-prompt-err');
    if (!e1 || !e1.includes('@')) { errEl.textContent = 'Enter a valid email.'; errEl.style.display='block'; return; }
    if (e1 !== e2) { errEl.textContent = 'Emails do not match.'; errEl.style.display='block'; return; }
    try {
      const r = await fetch('/api/me/email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e1 }),
      });
      const d = await r.json();
      if (!r.ok) { errEl.textContent = d.error || 'Could not save email.'; errEl.style.display='block'; return; }
      Modal.close();
      Toast.success('Email saved — you can now use password reset.');
    } catch { errEl.textContent = 'Network error.'; errEl.style.display='block'; }
  },

  // ── USER MANAGEMENT ───────────────────────────────────────
  async _openUserMgmt() {
    let users;
    try {
      const r = await fetch('/api/users');
      if (!r.ok) throw new Error('Failed to load users');
      users = await r.json();
    } catch(e) {
      Toast.error('Could not load users');
      return;
    }
    Modal.open(this._buildUserMgmtHtml(users));
    this._wireUserMgmt();
  },

  async _refreshUserMgmt() {
    let users;
    try {
      const r = await fetch('/api/users');
      if (!r.ok) throw new Error();
      users = await r.json();
    } catch(e) {
      Toast.error('Could not refresh users');
      return;
    }
    const content = document.getElementById('modalContent');
    if (content) {
      content.innerHTML = this._buildUserMgmtHtml(users);
      this._wireUserMgmt();
    }
  },

  _buildUserMgmtHtml(users) {
    const manors = typeof STORE !== 'undefined' ? STORE.manorKeys() : [];
    const householdOpts = (selected) =>
      `<option value="">— none —</option>` +
      manors.map(k => `<option value="${esc(k)}" ${(selected||'').toLowerCase()===k.toLowerCase()?'selected':''}>${esc(k)}</option>`).join('');
    const fmtDate = ts => {
      if (!ts) return '<span style="color:var(--ink-soft);font-style:italic;">Never</span>';
      try {
        return new Date(ts).toLocaleString();
      } catch(e) { return ts; }
    };
    const roleBadge = role => role === 'gm'
      ? `<span style="background:rgba(184,134,11,0.15);border:1px solid rgba(184,134,11,0.4);color:var(--gold);border-radius:20px;padding:1px 8px;font-size:0.62rem;letter-spacing:0.1em;font-family:var(--font-heading);">GM</span>`
      : `<span style="background:rgba(60,100,180,0.12);border:1px solid rgba(60,100,180,0.3);color:#7090d0;border-radius:20px;padding:1px 8px;font-size:0.62rem;letter-spacing:0.1em;font-family:var(--font-heading);">Player</span>`;

    const inputSty = 'font-size:0.82rem;padding:3px 6px;';
    const rows = users.map(u => `
      <tr data-username="${esc(u.username)}" style="border-bottom:1px solid var(--vellum-deep);">
        <td style="padding:8px 6px;">
          <input class="edit-input um-field" data-username="${esc(u.username)}" data-field="username"
            value="${esc(u.username)}" style="width:110px;${inputSty}">
        </td>
        <td style="padding:8px 6px;">
          <select class="edit-select um-field" data-username="${esc(u.username)}" data-field="role"
            style="width:90px;${inputSty}">
            <option value="player"   ${u.role === 'player'   ? 'selected' : ''}>Player</option>
            <option value="gm"       ${u.role === 'gm'       ? 'selected' : ''}>GM</option>
            <option value="observer" ${u.role === 'observer' ? 'selected' : ''}>Observer</option>
          </select>
        </td>
        <td style="padding:8px 6px;">
          <select class="edit-select um-field" data-username="${esc(u.username)}" data-field="household"
            style="width:120px;${inputSty}">
            ${householdOpts(u.household)}
          </select>
        </td>
        <td style="padding:8px 6px;">
          <input class="edit-input um-field" data-username="${esc(u.username)}" data-field="email"
            value="${esc(u.email || '')}" placeholder="no email" style="width:150px;${inputSty}">
        </td>
        <td style="padding:8px 6px;font-size:0.78rem;color:var(--ink-soft);">${fmtDate(u.lastLogin)}</td>
        <td style="padding:8px 6px;">
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            <button class="btn btn-ghost um-save-row" data-username="${esc(u.username)}" style="padding:3px 10px;font-size:0.72rem;">Save</button>
            <button class="btn btn-ghost um-reset-pw" data-username="${esc(u.username)}" style="padding:3px 10px;font-size:0.72rem;">Reset PW</button>
            <button class="btn btn-danger um-delete" data-username="${esc(u.username)}" style="padding:3px 10px;font-size:0.72rem;">Remove</button>
          </div>
        </td>
      </tr>`).join('');

    return `
      <div style="min-width:min(760px,92vw);max-height:80vh;overflow-y:auto;">
        <div class="page-title" style="font-size:1rem;margin-bottom:4px;">👥 User Management</div>
        <div style="font-size:0.75rem;color:var(--ink-soft);font-style:italic;margin-bottom:16px;">Household and role changes take effect on the player's next login.</div>
        <div id="umInlineForm" style="display:none;padding:12px;background:var(--vellum-deep);border-radius:4px;margin-bottom:12px;"></div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid var(--vellum-mid);">
              <th style="padding:6px 8px;text-align:left;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.1em;color:var(--ink-soft);">USERNAME</th>
              <th style="padding:6px 8px;text-align:left;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.1em;color:var(--ink-soft);">ROLE</th>
              <th style="padding:6px 8px;text-align:left;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.1em;color:var(--ink-soft);">HOUSEHOLD</th>
              <th style="padding:6px 8px;text-align:left;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.1em;color:var(--ink-soft);">EMAIL</th>
              <th style="padding:6px 8px;text-align:left;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.1em;color:var(--ink-soft);">LAST SEEN</th>
              <th style="padding:6px 8px;"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--vellum-deep);">
          <div class="section-title" style="margin-bottom:14px;">Add User</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
            <div>
              <div class="detail-label">Username</div>
              <input class="edit-input" id="umNewUser" placeholder="username" style="width:100%;">
            </div>
            <div>
              <div class="detail-label">Password</div>
              <input class="edit-input" id="umNewPw" type="password" placeholder="10+ chars" style="width:100%;">
            </div>
            <div>
              <div class="detail-label">Role</div>
              <select class="edit-select" id="umNewRole" style="width:100%;">
                <option value="player">Player</option>
                <option value="gm">GM</option>
                <option value="observer">Observer</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
            <div>
              <div class="detail-label">Household (optional)</div>
              <select class="edit-select" id="umNewHousehold" style="width:100%;">
                ${householdOpts('')}
              </select>
            </div>
            <div>
              <div class="detail-label">Email (optional)</div>
              <input class="edit-input" id="umNewEmail" type="email" placeholder="user@example.com" style="width:100%;">
            </div>
          </div>
          <button class="btn btn-primary" id="umAddBtn" style="width:auto;padding:6px 20px;">Add User</button>
        </div>

        <div class="btn-row" style="margin-top:16px;">
          <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        </div>
      </div>`;
  },

  _wireUserMgmt() {
    // Save row (username, role, household, email all at once)
    document.querySelectorAll('.um-save-row').forEach(btn => {
      btn.addEventListener('click', async () => {
        const oldUname = btn.dataset.username;
        const get = field => document.querySelector(`.um-field[data-username="${oldUname}"][data-field="${field}"]`)?.value.trim() ?? '';
        const payload = { username: get('username'), role: get('role'), household: get('household'), email: get('email') };
        try {
          const r = await fetch(`/api/users/${encodeURIComponent(oldUname)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || 'Failed');
          Toast.success('User updated');
          this._refreshUserMgmt();
        } catch(e) { Toast.error(e.message || 'Could not save changes'); }
      });
    });

    // Reset password buttons
    document.querySelectorAll('.um-reset-pw').forEach(btn => {
      btn.addEventListener('click', () => {
        const uname = btn.dataset.username;
        const inlineDiv = document.getElementById('umInlineForm');
        if (!inlineDiv) return;
        inlineDiv.style.display = 'block';
        inlineDiv.innerHTML = `
          <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
            <div>
              <div class="detail-label">New password for <strong>${uname}</strong></div>
              <input class="edit-input" id="umPwField" type="password" placeholder="10+ chars" style="width:200px;">
            </div>
            <button class="btn btn-primary" id="umPwSaveBtn" style="padding:5px 16px;">Set Password</button>
            <button class="btn btn-ghost" onclick="document.getElementById('umInlineForm').style.display='none';" style="padding:5px 12px;">Cancel</button>
          </div>`;
        document.getElementById('umPwSaveBtn').addEventListener('click', async () => {
          const pw = (document.getElementById('umPwField')?.value || '').trim();
          if (pw.length < 10) { Toast.error('Password must be at least 10 characters'); return; }
          try {
            const r = await fetch(`/api/users/${encodeURIComponent(uname)}/reset-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: pw }),
            });
            const d = await r.json();
            if (!d.ok) throw new Error(d.error || 'Failed');
            Toast.success(`Password reset for ${uname}`);
            inlineDiv.style.display = 'none';
          } catch(e) { Toast.error(e.message || 'Could not reset password'); }
        });
      });
    });

    // Delete buttons
    document.querySelectorAll('.um-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uname = btn.dataset.username;
        if (!confirm(`Remove user "${uname}"? This cannot be undone.`)) return;
        try {
          const r = await fetch(`/api/users/${encodeURIComponent(uname)}`, { method: 'DELETE' });
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || 'Failed');
          Toast.success(`${uname} removed`);
          this._refreshUserMgmt();
        } catch(e) { Toast.error(e.message || 'Could not remove user'); }
      });
    });

    // Add user
    document.getElementById('umAddBtn')?.addEventListener('click', async () => {
      const username  = (document.getElementById('umNewUser')?.value || '').trim();
      const password  = (document.getElementById('umNewPw')?.value || '');
      const role      = document.getElementById('umNewRole')?.value || 'player';
      const household = (document.getElementById('umNewHousehold')?.value || '').trim();
      const email     = (document.getElementById('umNewEmail')?.value || '').trim();
      if (!username || !password) { Toast.error('Username and password are required'); return; }
      try {
        const r = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, role, household: household || null, email: email || null }),
        });
        const d = await r.json();
        if (!d.ok) throw new Error(d.error || 'Failed');
        Toast.success(`${username} added`);
        this._refreshUserMgmt();
      } catch(e) { Toast.error(e.message || 'Could not add user'); }
    });
  },

  // ── CROSS-TAB NAVIGATION ──────────────────────────────────
  goToManor(key) {
    Modal.close();
    this.switchTab('manors');
    setTimeout(() => TabManors.selectManor(key), 50);
  },

  goToNpc(id) {
    Modal.close();
    this.switchTab('roster');
    setTimeout(() => TabRoster.select(id), 50);
  },

  goToFamily(name) {
    Modal.close();
    this.switchTab('families');
    setTimeout(() => TabFamilies.selectHousehold(name), 50);
  },
};

// ── BOOT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => APP.init());

// ── IDLE SESSION WARNING ───────────────────────────────────────
// After 4 hours of no keyboard/mouse/touch activity, show a banner
// prompting the user to stay logged in. Clicking it hits /api/keep-alive
// to reset the server-side 24-hour session lifetime.
(function () {
  const IDLE_WARN_MS  = 4 * 60 * 60 * 1000;  // 4 hours
  const CHECK_EVERY   = 60 * 1000;             // check every minute

  let _lastActivity = Date.now();
  let _warnShown    = false;

  function _resetActivity() {
    _lastActivity = Date.now();
    if (_warnShown) {
      _warnShown = false;
      const el = document.getElementById('_idleBanner');
      if (el) el.remove();
    }
  }

  ['mousemove', 'keydown', 'click', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, _resetActivity, { passive: true }));

  function _showBanner() {
    if (document.getElementById('_idleBanner')) return;
    const el = document.createElement('div');
    el.id = '_idleBanner';
    el.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
      'background:var(--ink)', 'color:var(--vellum)', 'border:1px solid var(--gold)',
      'border-radius:var(--radius)', 'padding:14px 20px', 'z-index:9998',
      'font-family:var(--font-body)', 'font-size:0.95rem',
      'display:flex', 'align-items:center', 'gap:14px',
      'box-shadow:0 4px 24px rgba(0,0,0,0.55)',
    ].join(';');
    el.innerHTML = `
      <span>⏳ Still at the table? Your session will expire soon.</span>
      <button onclick="window._keepAlive()" style="
        background:var(--gold);color:var(--ink);border:none;
        border-radius:var(--radius);padding:7px 16px;cursor:pointer;
        font-family:var(--font-heading);font-size:0.7rem;
        letter-spacing:0.08em;font-weight:600;
      ">Stay Logged In</button>`;
    document.body.appendChild(el);
  }

  window._keepAlive = async function () {
    try {
      await fetch('/api/keep-alive', { method: 'POST' });
    } catch { /* silent */ }
    _resetActivity();
  };

  setInterval(() => {
    if (!_warnShown && Date.now() - _lastActivity >= IDLE_WARN_MS) {
      _warnShown = true;
      _showBanner();
    }
  }, CHECK_EVERY);
})();
