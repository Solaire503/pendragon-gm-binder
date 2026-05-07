/* ══════════════════════════════════════════════════════════════
   TAB: FAMILY TREE
   SVG freeform node-graph — hover connect button, pan/zoom,
   outside-family nodes shown with dashed border + household pip,
   dynasty layout with generational rows and founder crown
══════════════════════════════════════════════════════════════ */

const FAMILY_REL_TYPES = new Set([
  'Child','Adopted Child','Bastard','Parent','Adoptive Parent',
  'Sibling','Half-Sibling','Spouse','Betrothed','Former Spouse',
]);

const TabTree = {
  _household: '',
  _nodes: {},
  _dragging: null,
  _panning: false,
  _panStart: null,
  _viewX: 0, _viewY: 0,
  _scale: 1,
  _svg: null,
  _connectSource: null,  // npcId waiting for a target click
  _wrap: null,
  _locked: false,

  currentHousehold() { return this._household; },

  // True if the current user may edit this tree (GM always can; players only for their own household).
  _canEdit() {
    if (isGM()) return true;
    const playerHH = APP.currentUser?.household;
    return !!(playerHH && this._household &&
              playerHH.toLowerCase() === this._household.toLowerCase());
  },

  NODE_W: 148,
  NODE_H: 58,
  NODE_R: 6,

  // ── OPEN ──────────────────────────────────────────────────
  open(householdName) {
    this._household    = householdName;
    this._connectSource = null;
    this._dragging     = null;
    this._panning      = false;
    this._scale        = 1;
    this._viewX        = 0;
    this._viewY        = 0;

    const hh   = STORE.getHousehold(householdName);
    const col  = hh ? hh.colour : '#5a5040';
    const icon = hh ? hh.icon : '◆';

    Modal.open(`
      <div class="tree-modal-body">
        <div class="tree-toolbar">
          <span style="font-family:var(--font-display);font-size:0.9rem;color:var(--ink);margin-right:8px;">${icon} ${householdName} · Family Tree</span>
          <button class="btn btn-ghost" id="treeBtnLayout" title="Grid auto-arrange">Auto Layout</button>
          <button class="btn btn-ghost" id="treeBtnDynasty" title="Arrange by generation from the dynasty founder">Dynasty Layout</button>
          ${isGM() ? `<button class="btn btn-ghost" id="treeBtnBulkAdd" title="Bulk-link multiple people at once">Bulk Add</button>` : ''}
          <button class="btn btn-ghost" id="treeBtnZoomIn">＋</button>
          <button class="btn btn-ghost" id="treeBtnZoomOut">－</button>
          <button class="btn btn-ghost" id="treeBtnReset">Reset View</button>
          <button class="btn btn-ghost" id="treeBtnExport" title="Export as PNG image">Export PNG</button>
          <button class="btn btn-ghost" id="treeBtnPocket" title="Toggle unplaced members panel">Unplaced ▸</button>
          <span id="treeFounderBadge" style="margin-left:4px;font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.12em;color:var(--gold);display:none;"></span>
          <span id="treeHeadBadge" style="margin-left:4px;font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.12em;color:var(--crimson);display:none;"></span>
          <span style="margin-left:auto;font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.15em;color:var(--ink-soft);opacity:0.7;" id="treeStatus">
            ${this._canEdit() ? 'Hover a node and click ⊕ to connect · Drag nodes · Scroll to zoom' : 'Click a name to view · Drag nodes · Scroll to zoom'}
          </span>
        </div>
        <div class="tree-canvas-wrap" id="treeCanvasWrap" style="position:relative;">
          <svg id="treeSvg" width="100%" height="100%">
            <defs>
              <marker id="arrowGold" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="rgba(184,134,11,0.5)"/>
              </marker>
            </defs>
            <g id="treeRoot">
              <g id="treeEdges"></g>
              <g id="treeNodes"></g>
            </g>
          </svg>
          <div class="tree-pocket" id="treePocket" style="display:none;">
            <div class="tree-pocket-hdr">Unplaced Members</div>
            <div class="tree-pocket-hint">Drag onto the tree to place</div>
            <div class="tree-pocket-list" id="treePocketList"></div>
          </div>
          <button class="btn btn-ghost" id="treeLockBtn" title="Tree unlocked — click to lock and protect your manual positions" style="position:absolute;bottom:12px;right:12px;font-size:1rem;line-height:1;">🔓</button>
        </div>
      </div>
    `, { tree: true, onOpen: () => this._init(householdName), onClose: () => { this._household = ''; this._locked = false; } });
  },

  _init(householdName) {
    this._svg  = document.getElementById('treeSvg');
    this._wrap = document.getElementById('treeCanvasWrap');
    if (!this._svg || !this._wrap) return;

    this._loadPositions(householdName);
    this._locked = STORE.treeLock[householdName] === true;
    this._updateFounderBadge();
    this._updateHeadBadge();
    this._updateLockBtn();
    this._draw(householdName);
    this._fitToView();

    document.getElementById('treeLockBtn')?.addEventListener('click', () => {
      this._toggleLock();
    });

    // ── SCROLL ZOOM ──────────────────────────────────────
    this._wrap.addEventListener('wheel', e => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.1 : 0.9;
      this._scale = Math.max(0.25, Math.min(3.5, this._scale * f));
      this._applyTransform();
    }, { passive: false });

    // ── PAN ──────────────────────────────────────────────
    this._wrap.addEventListener('mousedown', e => {
      if (e.target.closest('[data-npc-node]')) return;
      if (e.target.closest('#treePocket')) return;   // don't pan when interacting with pocket
      if (e.button !== 0) return;
      this._panning = true;
      this._panStart = { x: e.clientX - this._viewX, y: e.clientY - this._viewY };
      this._wrap.style.cursor = 'grabbing';
    });

    const onMove = e => {
      if (this._dragging) {
        const pt = this._svgPoint(e.clientX, e.clientY);
        this._nodes[this._dragging.id].x = pt.x - this._dragging.offX;
        this._nodes[this._dragging.id].y = pt.y - this._dragging.offY;
        this._draw(this._household);
      } else if (this._panning && this._panStart) {
        this._viewX = e.clientX - this._panStart.x;
        this._viewY = e.clientY - this._panStart.y;
        this._applyTransform();
      }
    };
    const onUp = () => {
      if (this._dragging) {
        const id = this._dragging.id;
        STORE.setTreePos(id, this._nodes[id].x, this._nodes[id].y);
        STORE.treePos[id].userPlaced = true;
        STORE.save();
      }
      this._dragging = null;
      this._panning  = false;
      if (this._wrap) this._wrap.style.cursor = 'grab';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    // Clean up listeners when modal closes
    const observer = new MutationObserver(() => {
      if (!document.getElementById('treeSvg')) {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // ── TOOLBAR ──────────────────────────────────────────
    document.getElementById('treeBtnLayout')?.addEventListener('click', () => {
      this._autoLayout(householdName);
      this._draw(householdName);
      this._fitToView();
    });
    document.getElementById('treeBtnDynasty')?.addEventListener('click', () => {
      const hh = STORE.getHousehold(householdName);
      if (!hh?.dynasty_founder) {
        Toast.show('Right-click a node and choose "Set as Dynasty Founder" first.', 'info');
        return;
      }
      this._dynastyLayout(householdName);
      this._draw(householdName);
      this._fitToView();
    });
    document.getElementById('treeBtnBulkAdd')?.addEventListener('click', () => {
      this._promptBulkAdd();
    });
    document.getElementById('treeBtnZoomIn')?.addEventListener('click', () => {
      this._scale = Math.min(3.5, this._scale * 1.2); this._applyTransform();
    });
    document.getElementById('treeBtnZoomOut')?.addEventListener('click', () => {
      this._scale = Math.max(0.25, this._scale * 0.8); this._applyTransform();
    });
    document.getElementById('treeBtnReset')?.addEventListener('click', () => {
      this._scale = 1; this._viewX = 0; this._viewY = 0; this._applyTransform();
    });
    document.getElementById('treeBtnExport')?.addEventListener('click', () => {
      this._exportPng();
    });
    document.getElementById('treeBtnPocket')?.addEventListener('click', () => {
      const pocket = document.getElementById('treePocket');
      const btn    = document.getElementById('treeBtnPocket');
      if (!pocket) return;
      const isOpen = pocket.style.display !== 'none';
      pocket.style.display = isOpen ? 'none' : 'flex';
      const count = document.getElementById('treePocketList')?.children.length || 0;
      const label = count > 0 ? `Unplaced (${count})` : 'Unplaced';
      btn.textContent = isOpen ? `${label} ▸` : `${label} ◂`;
    });

    // ── POCKET DRAG-TO-CANVAS ─────────────────────────────
    this._wrap.addEventListener('dragover', e => e.preventDefault());
    this._wrap.addEventListener('drop', e => {
      e.preventDefault();
      const npcId = e.dataTransfer.getData('text/plain');
      if (!npcId) return;
      const pt = this._svgPoint(e.clientX, e.clientY);
      // pinned = true so it stays on canvas even without family relationships
      STORE.treePos[npcId] = { x: pt.x, y: pt.y, pinned: true };
      STORE.save();
      this._nodes[npcId] = { x: pt.x, y: pt.y };
      this._renderPocket(householdName);
      this._draw(householdName);
    });

    this._renderPocket(householdName);
  },

  _renderPocket(householdName) {
    const pocketEl = document.getElementById('treePocket');
    const listEl   = document.getElementById('treePocketList');
    const btn      = document.getElementById('treeBtnPocket');
    if (!pocketEl || !listEl) return;

    const pocketIds = this._getPocketIds(householdName);

    if (btn) {
      const label  = pocketIds.size > 0 ? `Unplaced (${pocketIds.size})` : 'Unplaced';
      const isOpen = pocketEl.style.display !== 'none';
      btn.textContent   = isOpen ? `${label} ◂` : `${label} ▸`;
      btn.style.display = pocketIds.size > 0 ? '' : 'none';
    }

    const all = this._getMembers(householdName);
    listEl.innerHTML = '';
    all.filter(n => pocketIds.has(n.id)).forEach(n => {
      const col  = n.household ? STORE.householdColour(n.household) : '#5a5040';
      const item = document.createElement('div');
      item.className   = 'tree-pocket-item';
      item.draggable   = true;
      item.innerHTML   = `<span class="tree-pocket-pip" style="background:${col};"></span>
        <span class="tree-pocket-name">${esc(n.name)}</span>
        <span class="tree-pocket-role">${esc(n.role || '')}</span>`;
      item.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', n.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      listEl.appendChild(item);
    });
  },

  _svgPoint(cx, cy) {
    const rect = this._svg.getBoundingClientRect();
    return {
      x: (cx - rect.left - this._viewX) / this._scale,
      y: (cy - rect.top  - this._viewY) / this._scale,
    };
  },

  _applyTransform() {
    document.getElementById('treeRoot')?.setAttribute('transform',
      `translate(${this._viewX},${this._viewY}) scale(${this._scale})`);
  },

  // Zoom and pan so all placed nodes fit inside the visible canvas with padding.
  // Called after any layout that repositions nodes. Uses rAF so the wrap has
  // its final dimensions (matters when called right after the modal opens).
  _fitToView() {
    requestAnimationFrame(() => {
      const positions = Object.values(this._nodes);
      if (!positions.length || !this._wrap) return;

      const NW = this.NODE_W, NH = this.NODE_H;
      const PAD = 48;
      const minX = Math.min(...positions.map(p => p.x)) - PAD;
      const minY = Math.min(...positions.map(p => p.y)) - PAD;
      const maxX = Math.max(...positions.map(p => p.x + NW)) + PAD;
      const maxY = Math.max(...positions.map(p => p.y + NH)) + PAD;
      const bbW  = maxX - minX;
      const bbH  = maxY - minY;

      const wrapW = this._wrap.clientWidth;
      const wrapH = this._wrap.clientHeight;
      if (!wrapW || !wrapH) return;

      // Scale to fit; never zoom in past 100% so nodes don't look huge for tiny trees.
      const scale = Math.min(1.0, wrapW / bbW, wrapH / bbH);
      this._scale = scale;
      this._viewX = (wrapW - bbW * scale) / 2 - minX * scale;
      this._viewY = (wrapH - bbH * scale) / 2 - minY * scale;
      this._applyTransform();
    });
  },

  _updateFounderBadge() {
    const badge = document.getElementById('treeFounderBadge');
    if (!badge) return;
    const hh = STORE.getHousehold(this._household);
    const founderId = hh?.dynasty_founder;
    if (founderId) {
      const npc = STORE.getNpc(founderId);
      if (npc) { badge.textContent = `♛ Founder: ${npc.name}`; badge.style.display = ''; return; }
    }
    badge.style.display = 'none';
  },

  _updateHeadBadge() {
    const badge = document.getElementById('treeHeadBadge');
    if (!badge) return;
    const hh = STORE.getHousehold(this._household);
    const headId = hh?.household_head;
    if (headId) {
      const npc = STORE.getNpc(headId);
      if (npc) { badge.textContent = `⚜ Head: ${npc.name}`; badge.style.display = ''; return; }
    }
    badge.style.display = 'none';
  },

  _updateLockBtn() {
    const btn = document.getElementById('treeLockBtn');
    if (!btn) return;
    btn.textContent = this._locked ? '🔒' : '🔓';
    btn.title = this._locked
      ? 'Tree locked — layouts won\'t move your manually placed nodes. Click to unlock.'
      : 'Tree unlocked — layouts may rearrange nodes. Click to lock your positions.';
  },

  _toggleLock() {
    this._locked = !this._locked;
    STORE.treeLock[this._household] = this._locked;
    STORE.save();
    this._updateLockBtn();
    Toast.show(
      this._locked
        ? 'Tree locked — auto-layout will respect your manual positions.'
        : 'Tree unlocked — layouts will rearrange freely.',
      'info'
    );
  },

  // ── POSITIONS ─────────────────────────────────────────
  _loadPositions(householdName) {
    const members = this._getCanvasMembers(householdName);
    this._nodes = {};
    const unplaced = [];
    members.forEach(n => {
      const saved = STORE.getTreePos(n.id);
      if (saved && saved.x !== null) {
        this._nodes[n.id] = { x: saved.x, y: saved.y };
      } else {
        unplaced.push(n);
      }
    });
    if (unplaced.length) {
      // If no nodes placed yet, do a full layout; otherwise tuck unplaced below existing nodes
      const hasAny = members.length > unplaced.length;
      if (!hasAny) {
        const hh = STORE.getHousehold(householdName);
        if (hh?.dynasty_founder) {
          this._dynastyLayout(householdName);
        } else {
          this._autoLayout(householdName);
        }
      } else {
        const hh = STORE.getHousehold(householdName);
        if (hh?.dynasty_founder) {
          // Run dynasty layout so new members land in the correct generational row,
          // not in a pile below — this also repositions existing nodes cleanly.
          this._dynastyLayout(householdName);
        } else {
          // No founder: stack unplaced below existing nodes
          const maxY = Math.max(...Object.values(this._nodes).map(p => p.y));
          const padX = this.NODE_W + 56;
          const padY = this.NODE_H + 56;
          unplaced.forEach((n, i) => {
            this._nodes[n.id] = { x: 60 + i * padX, y: maxY + padY };
          });
        }
      }
    }
  },

  _householdAll(householdName) {
    return STORE.allNpcs().filter(n => n.household === householdName);
  },

  _getMembers(householdName) {
    const primary    = this._householdAll(householdName);
    const primaryIds = new Set(primary.map(n => n.id));
    const extras     = [];
    STORE.relationships.forEach(r => {
      const aIn = primaryIds.has(r.sourceId);
      const bIn = primaryIds.has(r.targetId);
      if (aIn && !bIn) {
        const n = STORE.getNpc(r.targetId);
        if (n && !extras.find(e => e.id === n.id)) extras.push(n);
      } else if (bIn && !aIn) {
        const n = STORE.getNpc(r.sourceId);
        if (n && !extras.find(e => e.id === n.id)) extras.push(n);
      }
    });
    return [...primary, ...extras];
  },

  _isExternal(npcId) {
    return !this._householdAll(this._household).some(m => m.id === npcId);
  },

  // NPCs with no family relationships go to the pocket unless explicitly pinned to canvas.
  // Pinned = dragged from pocket and dropped on canvas (saved.pinned === true).
  // Explicitly sent to pocket via right-click → Send to Pocket sets pinned:false + null coords —
  // that overrides even having family relationships, so the user's choice is respected.
  _getPocketIds(householdName) {
    const all    = this._getMembers(householdName);
    const allIds = new Set(all.map(n => n.id));
    const hasFamily = new Set();
    STORE.relationships.forEach(r => {
      if (!FAMILY_REL_TYPES.has(r.type)) return;
      if (allIds.has(r.sourceId)) hasFamily.add(r.sourceId);
      if (allIds.has(r.targetId)) hasFamily.add(r.targetId);
    });
    const pocket = new Set();
    all.forEach(n => {
      const saved = STORE.getTreePos(n.id);
      // Explicitly sent to pocket: pinned===false and no valid position saved
      const explicitlyPocketed = saved && saved.pinned === false && saved.x == null;
      if (explicitlyPocketed) { pocket.add(n.id); return; }
      if (hasFamily.has(n.id)) return;
      if (!saved?.pinned) pocket.add(n.id);
    });
    return pocket;
  },

  _getCanvasMembers(householdName) {
    const pocket = this._getPocketIds(householdName);
    return this._getMembers(householdName).filter(n => !pocket.has(n.id));
  },

  // ── GRID AUTO LAYOUT ──────────────────────────────────
  _autoLayout(householdName) {
    const members = this._getCanvasMembers(householdName);
    const cols    = Math.max(1, Math.ceil(Math.sqrt(members.length)));
    const padX    = this.NODE_W + 56;
    const padY    = this.NODE_H + 56;
    let i = 0;
    members.forEach(n => {
      if (this._locked && STORE.treePos[n.id]) return;
      this._nodes[n.id] = {
        x: 60 + (i % cols) * padX,
        y: 60 + Math.floor(i / cols) * padY,
      };
      i++;
    });
  },

  // ── DYNASTY LAYOUT ────────────────────────────────────
  // Children centered under their parents. Spouses placed beside their partner.
  // Disconnected nodes wrapped into rows below the connected tree.
  _dynastyLayout(householdName) {
    const members   = this._getCanvasMembers(householdName);
    const memberIds = new Set(members.map(n => n.id));
    const hh        = STORE.getHousehold(householdName);
    const founderId = hh?.dynasty_founder;

    const PAD_X = this.NODE_W + 64;
    const PAD_Y = this.NODE_H + 100;
    const ORIGIN_X = 80;
    const ORIGIN_Y = 60;
    const FLOAT_COLS = 5;

    // ── Build relationship maps ────────────────────────
    const childrenOf = {};
    const parentsOf  = {};
    const spousesOf  = {};
    const siblingsOf = {};
    members.forEach(n => {
      childrenOf[n.id] = []; parentsOf[n.id] = [];
      spousesOf[n.id]  = []; siblingsOf[n.id] = [];
    });

    STORE.relationships.forEach(r => {
      if (!memberIds.has(r.sourceId) || !memberIds.has(r.targetId)) return;
      if (r.type === 'Child' || r.type === 'Adopted Child' || r.type === 'Bastard') {
        // source = child, target = parent
        childrenOf[r.targetId]?.push(r.sourceId);
        parentsOf[r.sourceId]?.push(r.targetId);
      } else if (r.type === 'Parent' || r.type === 'Adoptive Parent') {
        // source = parent, target = child
        childrenOf[r.sourceId]?.push(r.targetId);
        parentsOf[r.targetId]?.push(r.sourceId);
      } else if (['Spouse','Betrothed','Former Spouse'].includes(r.type)) {
        spousesOf[r.sourceId]?.push(r.targetId);
        spousesOf[r.targetId]?.push(r.sourceId);
      } else if (r.type === 'Sibling' || r.type === 'Half-Sibling') {
        siblingsOf[r.sourceId]?.push(r.targetId);
        siblingsOf[r.targetId]?.push(r.sourceId);
      }
    });

    // ── BFS to assign generations ──────────────────────
    const genOf   = {};
    const visited = new Set();

    let roots = founderId && memberIds.has(founderId)
      ? [founderId]
      : members.filter(n => parentsOf[n.id].length === 0).map(n => n.id);
    if (!roots.length && members.length) roots = [members[0].id];

    roots.forEach(id => { genOf[id] = 0; visited.add(id); });
    const bfsQ = [...roots];
    while (bfsQ.length) {
      const id = bfsQ.shift();
      const g  = genOf[id];
      // Spouses and siblings share the same generation as the current node
      (spousesOf[id] || []).forEach(sid => {
        if (!visited.has(sid)) { genOf[sid] = g; visited.add(sid); bfsQ.push(sid); }
      });
      (siblingsOf[id] || []).forEach(sid => {
        if (!visited.has(sid)) { genOf[sid] = g; visited.add(sid); bfsQ.push(sid); }
      });
      (childrenOf[id] || []).forEach(cid => {
        if (!visited.has(cid)) { genOf[cid] = g + 1; visited.add(cid); bfsQ.push(cid); }
      });
    }

    // Second pass: float nodes that are parents of connected nodes upward.
    // Handles cases like a spouse's parents being on the canvas — the downward
    // BFS never reaches them, but they belong ABOVE their child's generation.
    let anyResolved = true;
    while (anyResolved) {
      anyResolved = false;
      members.forEach(n => {
        if (genOf[n.id] !== undefined) return;
        const childGens = (childrenOf[n.id] || [])
          .filter(cid => genOf[cid] !== undefined)
          .map(cid => genOf[cid]);
        if (childGens.length) {
          genOf[n.id] = Math.min(...childGens) - 1;
          anyResolved = true;
        }
      });
    }

    // Normalize: shift all gen values so the minimum is 0.
    // (Upward-pass parents can end up with negative gens, which the
    //  placement loop below can't handle — this makes them row 0.)
    const assignedGens = members.map(n => genOf[n.id]).filter(g => g !== undefined);
    if (assignedGens.length) {
      const minGen = Math.min(...assignedGens);
      if (minGen < 0) {
        members.forEach(n => { if (genOf[n.id] !== undefined) genOf[n.id] -= minGen; });
      }
    }

    // Separate connected vs floating
    const connected    = members.filter(n => genOf[n.id] !== undefined);
    const floating     = members.filter(n => genOf[n.id] === undefined);

    // ── Group connected nodes by generation ───────────
    const byGen = {};
    connected.forEach(n => {
      const g = genOf[n.id];
      if (!byGen[g]) byGen[g] = [];
      byGen[g].push(n);
    });
    const sortedGens = Object.keys(byGen).map(Number).sort((a, b) => a - b);

    // ── Place gen 0: founder/roots + their spouses ────
    if (byGen[0]) {
      const placed  = new Set();
      const ordered = [];
      const addNode = id => {
        if (placed.has(id)) return;
        const n = members.find(m => m.id === id);
        if (!n) return;
        ordered.push(n); placed.add(id);
        // Place spouses immediately to the right
        (spousesOf[id] || []).forEach(sid => {
          if (!placed.has(sid) && genOf[sid] === 0) addNode(sid);
        });
      };
      // Founder/roots first, then any remaining gen-0 nodes
      roots.forEach(addNode);
      byGen[0].forEach(n => addNode(n.id));
      ordered.forEach((n, i) => {
        if (!this._locked || !STORE.treePos[n.id]) {
          this._nodes[n.id] = { x: ORIGIN_X + i * PAD_X, y: ORIGIN_Y };
        }
      });
    }

    // ── Place subsequent generations ──────────────────
    // Sort each row by the average x of their parents, then space evenly,
    // centering the group over the span of their parents.
    sortedGens.filter(g => g > 0).forEach((gen, rowIdx) => {
      const row = byGen[gen];
      const y   = ORIGIN_Y + (rowIdx + 1) * PAD_Y;

      // Sort by average parent x so siblings cluster together
      const parentAvgX = n => {
        const xs = parentsOf[n.id].map(pid => this._nodes[pid]?.x ?? ORIGIN_X);
        return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : ORIGIN_X;
      };
      row.sort((a, b) => parentAvgX(a) - parentAvgX(b));

      // Try to center the row over all its parents' span
      const allParentXs = row.flatMap(n => parentsOf[n.id].map(pid => this._nodes[pid]?.x ?? ORIGIN_X));
      let startX;
      if (allParentXs.length) {
        const minPX  = Math.min(...allParentXs);
        const maxPX  = Math.max(...allParentXs);
        const centerX = (minPX + maxPX) / 2 + this.NODE_W / 2;
        startX = Math.max(ORIGIN_X, centerX - (row.length * PAD_X) / 2);
      } else {
        startX = ORIGIN_X;
      }

      // Group spouses adjacent to each other (same logic as gen-0).
      // Without this, a spouse's sibling can slip between the couple.
      const rowPlaced = new Set();
      const rowOrdered = [];
      const addWithSpouses = n => {
        if (rowPlaced.has(n.id)) return;
        rowOrdered.push(n); rowPlaced.add(n.id);
        (spousesOf[n.id] || []).forEach(sid => {
          if (!rowPlaced.has(sid)) {
            const sn = row.find(m => m.id === sid);
            if (sn) addWithSpouses(sn);
          }
        });
      };
      row.forEach(n => addWithSpouses(n));

      rowOrdered.forEach((n, i) => {
        if (!this._locked || !STORE.treePos[n.id]) {
          this._nodes[n.id] = { x: startX + i * PAD_X, y };
        }
      });

      // Nudge apart any overlapping nodes (simple left-to-right pass)
      for (let i = 1; i < rowOrdered.length; i++) {
        if (this._locked && STORE.treePos[rowOrdered[i].id]) continue;
        const prev = this._nodes[rowOrdered[i - 1].id];
        const cur  = this._nodes[rowOrdered[i].id];
        if (cur.x < prev.x + PAD_X) cur.x = prev.x + PAD_X;
      }
    });

    // ── Place floating (disconnected) nodes in a grid below ──
    if (floating.length) {
      const maxY = connected.length
        ? Math.max(...connected.map(n => this._nodes[n.id]?.y ?? 0))
        : ORIGIN_Y - PAD_Y;
      floating.forEach((n, i) => {
        if (!this._locked || !STORE.treePos[n.id]) {
          this._nodes[n.id] = {
            x: ORIGIN_X + (i % FLOAT_COLS) * PAD_X,
            y: maxY + PAD_Y + Math.floor(i / FLOAT_COLS) * PAD_Y,
          };
        }
      });
    }

    // Save positions (preserve pinned + userPlaced flags)
    members.forEach(n => {
      if (this._nodes[n.id]) {
        const pinned     = STORE.treePos[n.id]?.pinned     ?? false;
        const userPlaced = STORE.treePos[n.id]?.userPlaced ?? false;
        STORE.treePos[n.id] = { x: this._nodes[n.id].x, y: this._nodes[n.id].y, pinned, userPlaced };
      }
    });
    STORE.save();
  },

  // ── SET FOUNDER ───────────────────────────────────────
  _setFounder(npcId) {
    const hh = STORE.getHousehold(this._household);
    if (!hh) return;
    const npc = STORE.getNpc(npcId);
    if (!npc) return;

    const alreadySet = hh.dynasty_founder === npcId;
    if (alreadySet) {
      // Toggle off
      hh.dynasty_founder = null;
      STORE.save();
      Toast.show(`${npc.name} is no longer the dynasty founder.`);
    } else {
      hh.dynasty_founder = npcId;
      STORE.save();
      Toast.success(`${npc.name} set as dynasty founder. Run Dynasty Layout to arrange by generation.`);
    }
    this._updateFounderBadge();
    this._draw(this._household);
  },

  _setHead(npcId) {
    const hh = STORE.getHousehold(this._household);
    if (!hh) return;
    const npc = STORE.getNpc(npcId);
    if (!npc) return;
    const alreadySet = hh.household_head === npcId;
    if (alreadySet) {
      hh.household_head = null;
      STORE.save();
      Toast.show(`${npc.name} is no longer the household head.`);
    } else {
      hh.household_head = npcId;
      STORE.save();
      Toast.success(`${npc.name} set as household head.`);
    }
    this._updateHeadBadge();
    this._draw(this._household);
  },

  // ── DRAW ──────────────────────────────────────────────
  _draw(householdName) {
    const edgesG = document.getElementById('treeEdges');
    const nodesG = document.getElementById('treeNodes');
    if (!edgesG || !nodesG) return;
    edgesG.innerHTML = '';
    nodesG.innerHTML = '';

    const members   = this._getCanvasMembers(householdName);
    const memberIds = new Set(members.map(n => n.id));
    const hh        = STORE.getHousehold(householdName);
    const hhCol     = hh ? hh.colour : '#5a5040';
    const founderId = hh?.dynasty_founder || null;

    // ── EDGES ─────────────────────────────────────────
    const rels = STORE.relationships.filter(r =>
      memberIds.has(r.sourceId) && memberIds.has(r.targetId)
    );

    this._drawFamilyEdges(edgesG, memberIds, rels);

    // ── NODES ─────────────────────────────────────────
    members.forEach(n => {
      const pos      = this._nodes[n.id];
      if (!pos) return;
      const isExt    = this._isExternal(n.id);
      const extHH    = isExt ? STORE.getHousehold(n.household) : null;
      const col      = isExt ? (extHH ? extHH.colour : '#5a5040') : hhCol;
      const isPK     = (n.role || '').toLowerCase().includes('player');
      const isSource = this._connectSource === n.id;
      const isFounder = n.id === founderId;
      const isHead    = n.id === (hh?.household_head || null);

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'tree-node-card' + (isExt ? ' tree-node-external' : '') + (isFounder ? ' tree-node-founder' : '') + (n.status === 'Dead' ? ' tree-node-dead' : ''));
      g.setAttribute('transform', `translate(${pos.x},${pos.y})`);
      g.setAttribute('data-npc-node', n.id);
      if (n.status === 'Dead') g.setAttribute('opacity', '0.55');

      // ── Founder: outer glow ring ─────────────────────
      if (isFounder) {
        const glow = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        glow.setAttribute('x', -4); glow.setAttribute('y', -4);
        glow.setAttribute('width',  this.NODE_W + 8);
        glow.setAttribute('height', this.NODE_H + 8);
        glow.setAttribute('rx', this.NODE_R + 3);
        glow.setAttribute('fill',         'none');
        glow.setAttribute('stroke',       '#d4a017');
        glow.setAttribute('stroke-width', '2');
        glow.setAttribute('opacity',      '0.7');
        g.appendChild(glow);
      }

      // Card background
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('width',  this.NODE_W);
      bg.setAttribute('height', this.NODE_H);
      bg.setAttribute('rx',     this.NODE_R);
      bg.setAttribute('fill',   isExt ? '#f5f0e8' : '#f2e8d0');
      bg.setAttribute('stroke', isSource ? '#2a8a40' : isFounder ? '#d4a017' : col);
      bg.setAttribute('stroke-width', isPK ? '3' : isFounder ? '2.5' : isExt ? '1' : '1.5');
      if (isExt) bg.setAttribute('stroke-dasharray', '5,3');
      g.appendChild(bg);

      // Colour bar
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bar.setAttribute('width',  this.NODE_W);
      bar.setAttribute('height', 7);
      bar.setAttribute('rx',     this.NODE_R);
      bar.setAttribute('fill',   isFounder ? '#d4a017' : isHead ? '#8b1c1c' : col);
      bar.setAttribute('opacity', isExt ? '0.6' : '1');
      g.appendChild(bar);

      // ── Founder crown ♛ on the colour bar ───────────
      if (isFounder) {
        const crown = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        crown.setAttribute('x', this.NODE_W / 2);
        crown.setAttribute('y', 6.5);
        crown.setAttribute('text-anchor', 'middle');
        crown.setAttribute('font-size',   '7');
        crown.setAttribute('fill',        '#1a1208');
        crown.setAttribute('opacity',     '0.85');
        crown.setAttribute('font-family', 'serif');
        crown.textContent = '♛ DYNASTY FOUNDER ♛';
        g.appendChild(crown);
      }

      // ── Head of House ⚜ label on the colour bar ─────
      if (isHead && !isFounder) {
        const headLbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        headLbl.setAttribute('x', this.NODE_W / 2);
        headLbl.setAttribute('y', 6.5);
        headLbl.setAttribute('text-anchor', 'middle');
        headLbl.setAttribute('font-size',   '7');
        headLbl.setAttribute('fill',        '#fff');
        headLbl.setAttribute('opacity',     '0.9');
        headLbl.setAttribute('font-family', 'serif');
        headLbl.textContent = '⚜ HEAD OF HOUSE ⚜';
        g.appendChild(headLbl);
      }

      // External household pip (small coloured dot top-right)
      if (isExt && extHH) {
        const pip = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        pip.setAttribute('cx', this.NODE_W - 10);
        pip.setAttribute('cy', 18);
        pip.setAttribute('r',  5);
        pip.setAttribute('fill', extHH.colour);
        g.appendChild(pip);
        const pipTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        pipTxt.setAttribute('x', this.NODE_W - 10);
        pipTxt.setAttribute('y', 22);
        pipTxt.setAttribute('text-anchor', 'middle');
        pipTxt.setAttribute('font-size', '6');
        pipTxt.textContent = extHH.icon;
        g.appendChild(pipTxt);
      }

      // Role icon
      const iconTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      iconTxt.setAttribute('x', 11); iconTxt.setAttribute('y', 33);
      iconTxt.setAttribute('font-size', '15');
      iconTxt.textContent = roleIcon(n.role);
      g.appendChild(iconTxt);

      // Name
      const name    = n.name.length > 15 ? n.name.slice(0, 13) + '…' : n.name;
      const nameTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      nameTxt.setAttribute('x', 30); nameTxt.setAttribute('y', 27);
      nameTxt.setAttribute('font-family', "'Cinzel', serif");
      nameTxt.setAttribute('font-size', '9.5');
      nameTxt.setAttribute('fill', isFounder ? '#8a5800' : isExt ? '#3a3020' : '#1a1208');
      nameTxt.setAttribute('font-weight', isFounder ? '700' : 'normal');
      nameTxt.setAttribute('font-style',  isExt ? 'italic' : 'normal');
      nameTxt.textContent = name;
      g.appendChild(nameTxt);

      // Role text
      const roleTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      roleTxt.setAttribute('x', 30); roleTxt.setAttribute('y', 40);
      roleTxt.setAttribute('font-family', "'EB Garamond', serif");
      roleTxt.setAttribute('font-size', '8');
      roleTxt.setAttribute('fill', '#6a6050');
      roleTxt.textContent = n.role || '';
      g.appendChild(roleTxt);

      // Year born
      const dateX = this.NODE_W - (isExt && extHH ? 22 : 6);
      if (n.year_born) {
        const yrTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        yrTxt.setAttribute('x', dateX);
        yrTxt.setAttribute('y', n.status === 'Dead' && n.year_died ? 36 : 40);
        yrTxt.setAttribute('text-anchor', 'end');
        yrTxt.setAttribute('font-family', "'Cinzel', serif");
        yrTxt.setAttribute('font-size', '7');
        yrTxt.setAttribute('fill', isFounder ? '#d4a017' : col);
        yrTxt.textContent = 'b.' + n.year_born;
        g.appendChild(yrTxt);
      }

      // Deceased dagger + death year
      if (n.status === 'Dead') {
        const dag = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        dag.setAttribute('x', this.NODE_W - (isExt && extHH ? 22 : 6));
        dag.setAttribute('y', 22);
        dag.setAttribute('text-anchor', 'end');
        dag.setAttribute('font-size', '11');
        dag.setAttribute('fill', '#7a1c1c');
        dag.textContent = '†';
        g.appendChild(dag);

        if (n.year_died) {
          const dyTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          dyTxt.setAttribute('x', dateX);
          dyTxt.setAttribute('y', 46);
          dyTxt.setAttribute('text-anchor', 'end');
          dyTxt.setAttribute('font-family', "'Cinzel', serif");
          dyTxt.setAttribute('font-size', '7');
          dyTxt.setAttribute('fill', '#7a1c1c');
          dyTxt.textContent = '† ' + n.year_died;
          g.appendChild(dyTxt);
        }
      }

      // Blessed star
      if (n.blessed) {
        const bl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        bl.setAttribute('x', 30); bl.setAttribute('y', 52);
        bl.setAttribute('font-size', '9'); bl.setAttribute('fill', '#d4a017');
        bl.textContent = '✦';
        g.appendChild(bl);
      }

      // Fate-touched marker
      if (n.fate_touched) {
        const ft = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        ft.setAttribute('x', n.blessed ? 42 : 30); ft.setAttribute('y', 52);
        ft.setAttribute('font-size', '9'); ft.setAttribute('fill', '#2a8a40');
        ft.textContent = '◈';
        g.appendChild(ft);
      }

      // ── HOVER CONNECT BUTTON (⊕) — GM or own-household player ──────────
      if (this._canEdit()) {
        const connBtn = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        connBtn.setAttribute('class', 'tree-connect-btn');
        connBtn.style.cursor  = 'crosshair';
        connBtn.style.opacity = '0';
        connBtn.setAttribute('transform', `translate(${this.NODE_W + 4}, ${this.NODE_H / 2 - 9})`);

        const connCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        connCircle.setAttribute('cx', 9); connCircle.setAttribute('cy', 9);
        connCircle.setAttribute('r', 9);
        connCircle.setAttribute('fill',         '#2a8a40');
        connCircle.setAttribute('stroke',       'white');
        connCircle.setAttribute('stroke-width', '1.5');
        connBtn.appendChild(connCircle);

        const connTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        connTxt.setAttribute('x', 9); connTxt.setAttribute('y', 13);
        connTxt.setAttribute('text-anchor', 'middle');
        connTxt.setAttribute('font-size', '12');
        connTxt.setAttribute('fill', 'white');
        connTxt.setAttribute('font-family', 'sans-serif');
        connTxt.textContent = '⊕';
        connBtn.appendChild(connTxt);

        connBtn.setAttribute('title', 'Connect to another person');
        g.appendChild(connBtn);

        // Show/hide connect button on node hover
        g.addEventListener('mouseenter', () => { connBtn.style.opacity = '1'; });
        g.addEventListener('mouseleave', () => { connBtn.style.opacity = '0'; });

        // ── CONNECT BUTTON CLICK ──────────────────────
        connBtn.addEventListener('mousedown', e => {
          e.stopPropagation();
          if (this._connectSource === n.id) {
            this._connectSource = null;
            document.getElementById('treeStatus').textContent = 'Hover a node and click ⊕ to connect · Drag nodes · Scroll to zoom';
            this._draw(householdName);
          } else {
            const prevSrc = this._connectSource;
            this._connectSource = n.id;
            document.getElementById('treeStatus').textContent = `Connecting from ${n.name} — now click another node…`;
            if (prevSrc) {
              const prevG = document.querySelector(`[data-npc-node="${prevSrc}"] rect`);
              if (prevG) { prevG.setAttribute('stroke', prevG.getAttribute('data-orig-stroke') || '#5a5040'); prevG.removeAttribute('data-orig-stroke'); }
            }
            const thisBg = g.querySelector('rect');
            if (thisBg) { thisBg.setAttribute('data-orig-stroke', thisBg.getAttribute('stroke')); thisBg.setAttribute('stroke', '#2a8a40'); thisBg.setAttribute('stroke-width', '3'); }
            connBtn.style.opacity = '1';
          }
        });
      }

      // ── NODE DRAG & CLICK ───────────────────────────
      g.addEventListener('mousedown', e => {
        if (e.target.closest('.tree-connect-btn')) return;
        if (e.button !== 0) return;
        e.stopPropagation();

        // If we're in connect mode, clicking a node sets it as target
        if (this._connectSource && this._connectSource !== n.id) {
          const src = this._connectSource;
          this._connectSource = null;
          document.getElementById('treeStatus').textContent = 'Hover a node and click ⊕ to connect · Drag nodes · Scroll to zoom';
          this._promptEdgeType(src, n.id);
          return;
        }

        // Otherwise start dragging
        const pt = this._svgPoint(e.clientX, e.clientY);
        this._dragging = { id: n.id, offX: pt.x - pos.x, offY: pt.y - pos.y };
      });

      // Single click (no drag) → open NPC card
      let _clickPos = null;
      g.addEventListener('mousedown', e => { if (e.button === 0) _clickPos = { x: e.clientX, y: e.clientY }; });
      g.addEventListener('mouseup', e => {
        if (e.button !== 0 || !_clickPos) return;
        const moved = Math.abs(e.clientX - _clickPos.x) + Math.abs(e.clientY - _clickPos.y) > 4;
        if (!moved && !this._connectSource) {
          Components.openNpcCardInTree(n.id);
        }
        _clickPos = null;
      });

      // Right-click context menu — GM or own-household player
      if (this._canEdit()) {
        g.addEventListener('contextmenu', e => {
          e.preventDefault();
          this._nodeContextMenu(n.id, e.clientX, e.clientY);
        });
      }

      nodesG.appendChild(g);
    });

    this._applyTransform();
  },

  // ── FAMILY EDGE DRAWING ───────────────────────────────
  // Draws parent-child groups as proper tree brackets (couple bar → spine →
  // distribution bar → per-child drops). All other rel types as straight lines.
  _drawFamilyEdges(edgesG, memberIds, rels) {
    const NW = this.NODE_W, NH = this.NODE_H;
    const PARENT_CHILD = new Set(['Child','Adopted Child','Bastard','Parent','Adoptive Parent']);

    const mkPath = (d, cls, opts = {}) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      if (cls) p.setAttribute('class', cls);
      if (opts.dash)  p.setAttribute('stroke-dasharray', opts.dash);
      if (opts.width) p.setAttribute('stroke-width', String(opts.width));
      if (opts.click) { p.style.cursor = 'pointer'; p.addEventListener('click', opts.click); }
      return p;
    };

    const mkLabel = (x, y, text) => {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', x); t.setAttribute('y', y);
      t.setAttribute('class', 'rel-label');
      t.textContent = text;
      return t;
    };

    // ── Build child→parents map from raw rels ───────────────
    // Convention: source = child, target = parent
    const childParentsMap = {};   // childId → [{parentId, type, relId}]
    const handledRelIds   = new Set();

    rels.forEach(r => {
      if (!PARENT_CHILD.has(r.type)) return;
      // Child/Adopted Child/Bastard → source=child, target=parent
      // Parent/Adoptive Parent     → source=parent, target=child
      const childFirst = (r.type === 'Child' || r.type === 'Adopted Child' || r.type === 'Bastard');
      const cId = childFirst ? r.sourceId : r.targetId;
      const pId = childFirst ? r.targetId : r.sourceId;
      if (!childParentsMap[cId]) childParentsMap[cId] = [];
      childParentsMap[cId].push({ parentId: pId, type: r.type, relId: r.id });
      handledRelIds.add(r.id);
    });

    // ── Group children by their (sorted) parent-set ──────────
    const familyUnits = {};   // key → { parentIds, children:[{id, rels}] }
    Object.entries(childParentsMap).forEach(([childId, parents]) => {
      const sortedPids = [...new Set(parents.map(p => p.parentId))].sort();
      const key = sortedPids.join('|');
      if (!familyUnits[key]) familyUnits[key] = { parentIds: sortedPids, children: [] };
      familyUnits[key].children.push({ id: childId, rels: parents });
    });

    // ── Draw each family unit as a tree bracket ───────────────
    Object.values(familyUnits).forEach(unit => {
      const { parentIds, children } = unit;

      const pItems = parentIds
        .map(pid => ({ id: pid, pos: this._nodes[pid] }))
        .filter(p => p.pos);
      const cItems = children
        .map(c  => ({ ...c, pos: this._nodes[c.id] }))
        .filter(c => c.pos);
      if (!pItems.length || !cItems.length) return;

      // Anchor points
      const pAnchors = pItems.map(p => ({ id: p.id, x: p.pos.x + NW/2, y: p.pos.y + NH }));
      const cAnchors = cItems.map(c => ({
        id: c.id, rels: c.rels,
        x: c.pos.x + NW/2, topY: c.pos.y,
      }));

      const maxParentBotY = Math.max(...pAnchors.map(p => p.y));
      const minChildTopY  = Math.min(...cAnchors.map(c => c.topY));

      // ── CASE A: single parent, single child → simple L-shape ──
      if (pAnchors.length === 1 && cAnchors.length === 1) {
        const pa = pAnchors[0], ca = cAnchors[0];
        const midY      = (pa.y + ca.topY) / 2;
        const rel       = ca.rels[0];
        const isAdopted = ca.rels.some(r => r.type === 'Adopted Child' || r.type === 'Adoptive Parent');
        const isBastard = ca.rels.some(r => r.type === 'Bastard');
        const cls  = isAdopted ? 'rel-adopted-child' : 'rel-child';
        const dash = isAdopted ? '5,3' : isBastard ? '3,4' : null;

        edgesG.appendChild(mkPath(
          `M${pa.x},${pa.y} V${midY} H${ca.x} V${ca.topY}`,
          cls, { dash, click: () => this._editEdge(rel.relId) }
        ));
        if (isAdopted) edgesG.appendChild(mkLabel(Math.min(pa.x, ca.x) + 4, midY - 3, 'Adopted'));
        else if (isBastard) edgesG.appendChild(mkLabel(Math.min(pa.x, ca.x) + 4, midY - 3, 'Bastard'));
        return;
      }

      // ── CASE B: two parents OR multiple children ────────────
      const coupleBarY = maxParentBotY + 14;
      const junctionY  = Math.max(coupleBarY + 14,
                           Math.min((coupleBarY + minChildTopY) / 2, minChildTopY - 10));

      // Couple bar (2 parents)
      let spineX;
      if (pAnchors.length >= 2) {
        const pa = pAnchors[0], pb = pAnchors[1];
        spineX = (pa.x + pb.x) / 2;
        const leftX  = Math.min(pa.x, pb.x);
        const rightX = Math.max(pa.x, pb.x);

        edgesG.appendChild(mkPath(`M${pa.x},${pa.y} V${coupleBarY}`, 'rel-family-struct', {}));
        edgesG.appendChild(mkPath(`M${pb.x},${pb.y} V${coupleBarY}`, 'rel-family-struct', {}));
        edgesG.appendChild(mkPath(`M${leftX},${coupleBarY} H${rightX}`, 'rel-family-struct', {}));

        // Coupling dot at midpoint
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', spineX); dot.setAttribute('cy', coupleBarY);
        dot.setAttribute('r', '3'); dot.setAttribute('class', 'rel-couple-dot');
        edgesG.appendChild(dot);
      } else {
        spineX = pAnchors[0].x;
        edgesG.appendChild(mkPath(
          `M${spineX},${pAnchors[0].y} V${junctionY}`,
          'rel-family-struct', {}
        ));
      }

      // Spine from couple bar down to junction
      if (pAnchors.length >= 2) {
        edgesG.appendChild(mkPath(
          `M${spineX},${coupleBarY} V${junctionY}`,
          'rel-family-struct', {}
        ));
      }

      // Distribution bar (multiple children).
      // Always extend to include spineX so the bar connects to the spine
      // even when children are positioned far to one side of their parents.
      if (cAnchors.length > 1) {
        const leftX  = Math.min(spineX, ...cAnchors.map(c => c.x));
        const rightX = Math.max(spineX, ...cAnchors.map(c => c.x));
        edgesG.appendChild(mkPath(
          `M${leftX},${junctionY} H${rightX}`,
          'rel-family-struct', {}
        ));
      }

      // Drops to each child
      cAnchors.forEach(c => {
        const isAdopted = c.rels.some(r => r.type === 'Adopted Child' || r.type === 'Adoptive Parent');
        const isBastard = c.rels.some(r => r.type === 'Bastard');
        const relId     = c.rels[0].relId;
        const cls  = isAdopted ? 'rel-adopted-child' : 'rel-child';
        const dash = isAdopted ? '5,3' : isBastard ? '3,4' : null;
        const dropX = cAnchors.length === 1 ? spineX : c.x;

        edgesG.appendChild(mkPath(
          cAnchors.length === 1
            ? `M${spineX},${junctionY} H${c.x} V${c.topY}`
            : `M${c.x},${junctionY} V${c.topY}`,
          cls, { dash, click: () => this._editEdge(relId) }
        ));

        if (isAdopted) edgesG.appendChild(mkLabel(dropX + 4, (junctionY + c.topY) / 2, 'Adopted'));
        else if (isBastard) edgesG.appendChild(mkLabel(dropX + 4, (junctionY + c.topY) / 2, 'Bastard'));
      });
    });

    // ── Draw all non-parent-child relationships ──
    // Pre-pass: collect sibling rels, sort by span so wider brackets stack higher.
    // Helper: true if both nodes already hang from the same visible parent — in that
    // case the parent-child bracket already implies the sibling relationship, so the
    // explicit sibling line would just be redundant clutter.
    const shareVisibleParent = (idA, idB) => {
      const parentsA = (childParentsMap[idA] || []).map(p => p.parentId).filter(pid => this._nodes[pid]);
      if (!parentsA.length) return false;
      const parentsB = new Set((childParentsMap[idB] || []).map(p => p.parentId).filter(pid => this._nodes[pid]));
      return parentsA.some(pid => parentsB.has(pid));
    };

    const drawnPairs = new Set();
    const siblingQueue = []; // { rel, pairKey }
    rels.forEach(rel => {
      if (handledRelIds.has(rel.id)) return;
      const isSibling = rel.type === 'Sibling' || rel.type === 'Half-Sibling';
      if (!isSibling) return;
      // Suppress bracket when the shared parent is already visible in the tree
      if (shareVisibleParent(rel.sourceId, rel.targetId)) { handledRelIds.add(rel.id); return; }
      const pairKey = [rel.sourceId, rel.targetId].sort().join('|') + '|' + rel.type;
      if (drawnPairs.has(pairKey)) return;
      const a = this._nodes[rel.sourceId], b = this._nodes[rel.targetId];
      if (!a || !b) return;
      drawnPairs.add(pairKey);
      siblingQueue.push({ rel, pairKey, span: Math.abs((a.x + NW/2) - (b.x + NW/2)) });
    });
    // Sort ascending by span so index 0 = shortest; draw shortest bracket lowest (closest to nodes).
    siblingQueue.sort((p, q) => p.span - q.span);
    // Compute bracket heights: each level is 24px above the previous.
    const siblingBracketY = new Map();
    if (siblingQueue.length) {
      const minNodeTop = Math.min(...siblingQueue.map(({ rel }) => {
        const a = this._nodes[rel.sourceId], b = this._nodes[rel.targetId];
        return Math.min(a.y, b.y);
      }));
      siblingQueue.forEach(({ pairKey }, i) => {
        siblingBracketY.set(pairKey, minNodeTop - 20 - i * 24);
      });
    }
    // Draw siblings as orthogonal brackets.
    siblingQueue.forEach(({ rel, pairKey }) => {
      const a = this._nodes[rel.sourceId], b = this._nodes[rel.targetId];
      const ax = a.x + NW/2, bx = b.x + NW/2;
      const nodeTopA = a.y, nodeTopB = b.y;
      const bracketY = siblingBracketY.get(pairKey);
      const extEdge = this._isExternal(rel.sourceId) || this._isExternal(rel.targetId);
      const cls = this._relClass(rel.type);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M${ax},${nodeTopA} V${bracketY} H${bx} V${nodeTopB}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('class', cls);
      if (extEdge) path.setAttribute('stroke-dasharray', '6,4');
      if (rel.type === 'Half-Sibling') path.setAttribute('stroke-dasharray', '4,3');
      path.style.cursor = 'pointer';
      path.addEventListener('click', () => this._editEdge(rel.id));
      edgesG.appendChild(path);

      const midX = (ax + bx) / 2;
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', String(midX));
      txt.setAttribute('y', String(bracketY - 4));
      txt.setAttribute('class', 'rel-label');
      txt.textContent = rel.type;
      edgesG.appendChild(txt);
    });

    // Draw remaining non-sibling, non-parent-child relationships.
    rels.forEach(rel => {
      if (handledRelIds.has(rel.id)) return;
      const isSibling = rel.type === 'Sibling' || rel.type === 'Half-Sibling';
      if (isSibling) return; // already drawn above
      const pairKey = [rel.sourceId, rel.targetId].sort().join('|') + '|' + rel.type;
      if (drawnPairs.has(pairKey)) return;
      drawnPairs.add(pairKey);
      const a = this._nodes[rel.sourceId];
      const b = this._nodes[rel.targetId];
      if (!a || !b) return;

      const ax = a.x + NW/2, ay = a.y + NH/2;
      const bx = b.x + NW/2, by = b.y + NH/2;
      const extEdge = this._isExternal(rel.sourceId) || this._isExternal(rel.targetId);
      const cls = this._relClass(rel.type);

      {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', ax); line.setAttribute('y1', ay);
        line.setAttribute('x2', bx); line.setAttribute('y2', by);
        line.setAttribute('stroke-width', '2');
        line.setAttribute('class', cls);
        if (extEdge) line.setAttribute('stroke-dasharray', '6,4');
        line.style.cursor = 'pointer';
        line.addEventListener('click', () => this._editEdge(rel.id));
        edgesG.appendChild(line);

        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', (ax + bx) / 2);
        txt.setAttribute('y', (ay + by) / 2 - 5);
        txt.setAttribute('class', 'rel-label');
        txt.textContent = rel.type;
        edgesG.appendChild(txt);
      }
    });
  },

  _relClass(type) {
    const map = {
      'Spouse':              'rel-spouse',
      'Betrothed':           'rel-betrothed',
      'Lover':               'rel-lover',
      'Former Spouse':       'rel-former-spouse',
      'Child':               'rel-child',
      'Adopted Child':       'rel-adopted-child',
      'Bastard':             'rel-child',
      'Parent':              'rel-child',
      'Adoptive Parent':     'rel-adopted-child',
      'Sibling':             'rel-sibling',
      'Half-Sibling':        'rel-half-sibling',
      'Aunt/Uncle':          'rel-sibling',
      'Niece/Nephew':        'rel-sibling',
      'Cousin':              'rel-sibling',
      'Grandparent':         'rel-child',
      'Grandchild':          'rel-child',
      'Sworn Brother/Sister':'rel-sworn',
      'Squire':              'rel-ward',
      'Former Squire':       'rel-ward',
      'Page':                'rel-ward',
      'Vassal':              'rel-cobalt',
      'Ward':                'rel-ward',
      'Guardian':            'rel-ward',
      'Other':               'rel-other',
    };
    return map[type] || 'rel-other';
  },

  _promptEdgeType(sourceId, targetId) {
    const src      = STORE.getNpc(sourceId);
    const tgt      = STORE.getNpc(targetId);
    const typeOpts = RELATION_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
    // Members on canvas (for second parent picker), excluding the two already in this connection
    const canvasIds = new Set(this._getCanvasMembers(this._household).map(n => n.id));
    const p2Npcs = STORE.allNpcs()
      .filter(n => n.id !== sourceId && n.id !== targetId && canvasIds.has(n.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    Modal.open(`
      <div style="min-width:360px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:12px;">Add Relationship</div>
        <div style="font-size:0.9rem;margin-bottom:14px;color:var(--ink-soft);">
          <strong>${src?.name}</strong> ↔ <strong>${tgt?.name}</strong>
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Relationship Type</div>
          <select class="edit-input edit-select" id="tree-rel-type" onchange="TabTree._onRelTypeChange()">${typeOpts}</select>
        </div>
        <div class="detail-field mb-8" id="tree-parent2-field" style="display:none;">
          <div class="detail-label">Second Parent (optional)</div>
          <div class="detail-hint" style="font-size:0.78rem;color:var(--ink-soft);margin-bottom:4px;">
            Who is the other parent of <strong>${src?.name}</strong>? Leave blank if unknown.
          </div>
          ${buildNpcSearchHtml('tree-rel-parent2-search', 'tree-rel-parent2', 'Search by name or role…')}
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Notes (optional)</div>
          <input class="edit-input" id="tree-rel-notes" placeholder="e.g. Married 490 AD">
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabTree._saveEdge('${sourceId}','${targetId}')">Add</button>
          <button class="btn btn-ghost" onclick="Modal.close();TabTree.open('${TabTree._household}')">Cancel</button>
        </div>
      </div>`, {
      onOpen: () => {
        TabTree._onRelTypeChange();
        initNpcSearch('tree-rel-parent2-search', 'tree-rel-parent2', p2Npcs);
      },
    });
  },

  // ── BULK ADD ──────────────────────────────────────────────
  _bulkSelected: [],

  _promptBulkAdd(presetParentId = null) {
    this._bulkSelected = [];
    const allNpcs  = STORE.allNpcs().sort((a, b) => a.name.localeCompare(b.name));
    const typeOpts = RELATION_TYPES.map(t =>
      `<option value="${t}" ${t === 'Child' ? 'selected' : ''}>${t}</option>`).join('');

    CardPopup.open(`
      <div style="min-width:480px;max-width:580px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:4px;">Bulk Add Relationships</div>
        <div style="font-size:0.82rem;color:var(--ink-soft);margin-bottom:14px;">
          Link multiple people with the same relationship in one step.
        </div>

        <div class="detail-field mb-8">
          <div class="detail-label">Relationship Type</div>
          <select class="edit-input edit-select" id="bulk-rel-type" onchange="TabTree._bulkRelTypeChange()">${typeOpts}</select>
        </div>

        <div id="bulk-parents-section">
          <div class="detail-field mb-8">
            <div class="detail-label">Parent 1</div>
            ${buildNpcSearchHtml('bulk-p1-search', 'bulk-p1', 'Search for parent…')}
          </div>
          <div class="detail-field mb-8">
            <div class="detail-label">Parent 2 <span style="opacity:0.5;font-weight:normal;">(optional)</span></div>
            ${buildNpcSearchHtml('bulk-p2-search', 'bulk-p2', 'Search for second parent…')}
          </div>
        </div>

        <div id="bulk-other-section" style="display:none;">
          <div class="detail-field mb-8">
            <div class="detail-label">Other Person</div>
            ${buildNpcSearchHtml('bulk-other-search', 'bulk-other', 'Search…')}
          </div>
        </div>

        <div class="detail-field mb-4">
          <div class="detail-label">People to Link</div>
          ${buildNpcSearchHtml('bulk-member-search', 'bulk-member-hidden', 'Type a name to add…')}
        </div>
        <div class="bulk-chips-wrap" id="bulk-chips"></div>

        <div class="btn-row" style="margin-top:16px;">
          <button class="btn btn-primary" onclick="TabTree._saveBulkAdd()">Add All</button>
          <button class="btn btn-ghost" onclick="CardPopup.close()">Cancel</button>
          <span id="bulk-count-note" style="font-size:0.78rem;color:var(--ink-soft);align-self:center;margin-left:6px;"></span>
        </div>
      </div>`);

    // Wire standard NPC searches
    initNpcSearch('bulk-p1-search', 'bulk-p1', allNpcs);
    initNpcSearch('bulk-p2-search', 'bulk-p2', allNpcs);
    initNpcSearch('bulk-other-search', 'bulk-other', allNpcs);

    // Pre-seed parent 1 when launched from context menu
    if (presetParentId) {
      const p = STORE.getNpc(presetParentId);
      if (p) {
        document.getElementById('bulk-p1').value = p.id;
        document.getElementById('bulk-p1-search').value = p.name + (p.role ? ' (' + p.role + ')' : '');
      }
    }

    // Wire multi-select member search
    this._initBulkMemberSearch(allNpcs);
    this._bulkRelTypeChange();
  },

  _bulkRelTypeChange() {
    const type = document.getElementById('bulk-rel-type')?.value;
    const childTypes = new Set(['Child', 'Adopted Child', 'Bastard']);
    const parentsSection = document.getElementById('bulk-parents-section');
    const otherSection   = document.getElementById('bulk-other-section');
    if (!parentsSection || !otherSection) return;
    const showParents = childTypes.has(type);
    parentsSection.style.display = showParents ? '' : 'none';
    otherSection.style.display   = showParents ? 'none' : '';
  },

  _initBulkMemberSearch(allNpcs) {
    const input   = document.getElementById('bulk-member-search');
    const results = document.getElementById('bulk-member-search-results');
    if (!input || !results) return;

    const refresh = () => {
      const q = input.value.toLowerCase().trim();
      if (!q) { results.style.display = 'none'; return; }
      const filtered = allNpcs
        .filter(n => !this._bulkSelected.some(s => s.id === n.id))
        .filter(n =>
          (n.name  && n.name.toLowerCase().includes(q)) ||
          (n.role  && n.role.toLowerCase().includes(q)) ||
          (n.manor && n.manor.toLowerCase().includes(q))
        );
      if (!filtered.length) { results.style.display = 'none'; return; }
      results.innerHTML = filtered.slice(0, 12).map(n =>
        `<div class="npc-search-item" data-id="${n.id}">
          <span class="npc-search-name">${esc(n.name)}</span>
          ${n.role      ? `<span class="npc-search-role">${esc(n.role)}</span>` : ''}
          ${n.household ? `<span class="npc-search-hh" style="color:${STORE.householdColour(n.household)}">${STORE.householdIcon(n.household)}</span>` : ''}
        </div>`
      ).join('');
      results.style.display = '';
    };

    input.addEventListener('input', refresh);

    results.addEventListener('mousedown', e => {
      const item = e.target.closest('.npc-search-item');
      if (!item) return;
      e.preventDefault();
      const npc = allNpcs.find(n => n.id === item.dataset.id);
      if (npc) this._addBulkChip(npc);
      input.value = '';
      results.style.display = 'none';
      input.focus();
    });

    input.addEventListener('blur',  () => setTimeout(() => { results.style.display = 'none'; }, 150));
    input.addEventListener('focus', refresh);
  },

  _addBulkChip(npc) {
    if (this._bulkSelected.some(s => s.id === npc.id)) return;
    this._bulkSelected.push({ id: npc.id, name: npc.name, role: npc.role || '' });
    this._renderBulkChips();
  },

  _removeBulkChip(id) {
    this._bulkSelected = this._bulkSelected.filter(s => s.id !== id);
    this._renderBulkChips();
  },

  _renderBulkChips() {
    const wrap = document.getElementById('bulk-chips');
    const note = document.getElementById('bulk-count-note');
    if (!wrap) return;
    wrap.innerHTML = this._bulkSelected.map(s =>
      `<span class="bulk-chip">
        <span class="bulk-chip-name">${esc(s.name)}</span>
        ${s.role ? `<span class="bulk-chip-role">${esc(s.role)}</span>` : ''}
        <button class="bulk-chip-remove" onclick="TabTree._removeBulkChip('${s.id}')" title="Remove">×</button>
      </span>`
    ).join('');
    if (note) note.textContent = this._bulkSelected.length ? `${this._bulkSelected.length} selected` : '';
  },

  _saveBulkAdd() {
    const type       = document.getElementById('bulk-rel-type')?.value;
    const childTypes = new Set(['Child', 'Adopted Child', 'Bastard']);
    const isChild    = childTypes.has(type);

    if (!this._bulkSelected.length) { Toast.error('No people selected'); return; }

    let p1Id, p2Id, otherId;
    if (isChild) {
      p1Id = document.getElementById('bulk-p1')?.value || '';
      p2Id = document.getElementById('bulk-p2')?.value || '';
      if (!p1Id) { Toast.error('Select at least one parent'); return; }
    } else {
      otherId = document.getElementById('bulk-other')?.value || '';
      if (!otherId) { Toast.error('Select the other person'); return; }
    }

    // Helper: skip if an identical (source, target, type) relationship already exists
    const relExists = (srcId, tgtId, t) =>
      STORE.relationships.some(r => r.type === t &&
        ((r.sourceId === srcId && r.targetId === tgtId) ||
         (r.sourceId === tgtId && r.targetId === srcId)));

    let added = 0;
    this._bulkSelected.forEach(s => {
      if (isChild) {
        if (!relExists(s.id, p1Id, type)) { STORE.addRelationship(s.id, p1Id, type, ''); added++; }
        if (p2Id && !relExists(s.id, p2Id, type)) { STORE.addRelationship(s.id, p2Id, type, ''); }
      } else {
        if (!relExists(s.id, otherId, type)) { STORE.addRelationship(s.id, otherId, type, ''); added++; }
      }
    });

    const hh = STORE.getHousehold(this._household);

    if (!added) {
      Toast.info('No new relationships — all already existed. Refreshing layout…');
    } else {
      Toast.success(`${added} ${type.toLowerCase()} relationship${added !== 1 ? 's' : ''} added`);
    }
    this._bulkSelected = [];
    CardPopup.close();

    // Stay inside the open tree — reload positions for the new nodes then re-layout
    // so they appear under their parents rather than in a pile.
    // Always run even when added=0 so stranded nodes (with existing rels) get repositioned.
    // Always run _dynastyLayout (not just when a founder exists) so that newly added
    // children are placed in the correct generation row beneath their parents.
    // _dynastyLayout handles the no-founder case by choosing root nodes automatically.
    this._loadPositions(this._household);
    this._dynastyLayout(this._household);
    this._draw(this._household);
    this._renderPocket(this._household);
    this._fitToView();
  },

  _onRelTypeChange() {
    const type = document.getElementById('tree-rel-type')?.value;
    const p2   = document.getElementById('tree-parent2-field');
    if (!p2) return;
    const childTypes = new Set(['Child', 'Adopted Child', 'Bastard']);
    p2.style.display = childTypes.has(type) ? '' : 'none';
  },

  _saveEdge(sourceId, targetId) {
    const type    = document.getElementById('tree-rel-type')?.value;
    const notes   = document.getElementById('tree-rel-notes')?.value?.trim();
    const parent2 = document.getElementById('tree-rel-parent2')?.value || '';

    const INVERSE = {
      'Child': 'Parent',           'Parent': 'Child',
      'Adopted Child': 'Adoptive Parent', 'Adoptive Parent': 'Adopted Child',
      'Bastard': 'Parent',
      'Sibling': 'Sibling',        'Half-Sibling': 'Half-Sibling',
      'Spouse': 'Spouse',          'Betrothed': 'Betrothed',
      'Lover': 'Lover',            'Former Spouse': 'Former Spouse',
      'Aunt/Uncle': 'Niece/Nephew','Niece/Nephew': 'Aunt/Uncle',
      'Cousin': 'Cousin',
      'Grandparent': 'Grandchild', 'Grandchild': 'Grandparent',
      'Sworn Brother/Sister': 'Sworn Brother/Sister',
      'Squire': 'Squire',          'Former Squire': 'Former Squire',
      'Page': 'Page',
      'Vassal': 'Vassal',
      'Ward': 'Guardian',          'Guardian': 'Ward',
      'Other': 'Other',
    };

    const relExists = (s, t, tp) => STORE.relationships.some(r => r.type === tp &&
      ((r.sourceId === s && r.targetId === t) || (r.sourceId === t && r.targetId === s)));

    const inverseExists = (s, t, tp) => {
      const inv = INVERSE[tp];
      return inv ? STORE.relationships.some(r => r.type === inv &&
        ((r.sourceId === s && r.targetId === t) || (r.sourceId === t && r.targetId === s))) : false;
    };

    if (relExists(sourceId, targetId, type) || inverseExists(sourceId, targetId, type)) {
      Toast.error('A relationship of this type already exists between these two.');
      Modal.close();
      this.open(this._household);
      return;
    }

    STORE.addRelationship(sourceId, targetId, type, notes);
    // If a second parent was chosen for a child-type relationship, add that link too
    if (parent2 && ['Child', 'Adopted Child', 'Bastard'].includes(type)) {
      if (!relExists(sourceId, parent2, type)) {
        STORE.addRelationship(sourceId, parent2, type, notes);
      }
    }
    Toast.success('Relationship added');
    this.open(this._household);
  },

  _editEdge(relId) {
    if (!this._canEdit()) return;
    const rel = STORE.relationships.find(r => r.id === relId);
    if (!rel) return;
    const src      = STORE.getNpc(rel.sourceId);
    const tgt      = STORE.getNpc(rel.targetId);
    const typeOpts = RELATION_TYPES.map(t =>
      `<option value="${t}" ${t === rel.type ? 'selected' : ''}>${t}</option>`).join('');
    Modal.open(`
      <div style="min-width:340px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:12px;">Edit Relationship</div>
        <div style="font-size:0.9rem;margin-bottom:12px;color:var(--ink-soft);">${esc(src?.name||'')} ↔ ${esc(tgt?.name||'')}</div>
        <div class="detail-field mb-8">
          <div class="detail-label">Type</div>
          <select class="edit-input edit-select" id="edit-rel-type">${typeOpts}</select>
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Notes</div>
          <input class="edit-input" id="edit-rel-notes" value="${esc(rel.notes || '')}">
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="TabTree._updateEdge('${relId}')">Save</button>
          <button class="btn btn-danger"  onclick="TabTree._deleteEdge('${relId}')">Delete</button>
          <button class="btn btn-ghost"   onclick="Modal.close();TabTree.open('${this._household}')">Cancel</button>
        </div>
      </div>`);
  },

  _updateEdge(relId) {
    const type  = document.getElementById('edit-rel-type')?.value;
    const notes = document.getElementById('edit-rel-notes')?.value?.trim();
    STORE.updateRelationship(relId, { type, notes });
    Toast.success('Updated');
    this.open(this._household);
  },

  _deleteEdge(relId) {
    if (!confirm('Remove this relationship?')) return;
    STORE.removeRelationship(relId);
    Toast.success('Removed');
    this.open(this._household);
  },

  _nodeContextMenu(npcId, cx, cy) {
    const npc = STORE.getNpc(npcId);
    if (!npc) return;
    document.getElementById('treeCtxMenu')?.remove();

    const hh        = STORE.getHousehold(this._household);
    const isFounder = hh?.dynasty_founder === npcId;
    const isHead    = hh?.household_head   === npcId;

    const menu = document.createElement('div');
    menu.id = 'treeCtxMenu';
    const menuW = 185;
    const menuH = 320;
    const safeX = Math.max(8, Math.min(cx, window.innerWidth  - menuW - 8));
    const safeY = Math.max(8, Math.min(cy, window.innerHeight - menuH - 8));
    menu.style.cssText = `position:fixed;top:${safeY}px;left:${safeX}px;background:var(--vellum);border:1px solid var(--gold);border-radius:var(--radius);box-shadow:0 4px 16px var(--shadow);z-index:9999;min-width:185px;overflow:hidden;`;

    const items = [
      { label: '👤 Open NPC Card',    action: () => Components.openNpcCardInTree(npcId) },
      ...(isGM() ? [{ label: '✏️  Edit NPC', action: () => Components.openEditNpc(npcId) }] : []),
      { label: isFounder ? '♛ Remove Founder Mark' : '♛ Set as Dynasty Founder',
        action: () => this._setFounder(npcId) },
      { label: isHead ? '⚜ Remove Head of House' : '⚜ Set as Head of House',
        action: () => this._setHead(npcId) },
      { label: '⊕  Start Connection',  action: () => {
          this._connectSource = npcId;
          document.getElementById('treeStatus').textContent = `Connecting from ${npc.name} — click any other node…`;
          this._draw(this._household);
      }},
      { label: '👨‍👩‍👧 Bulk Add Children', action: () => this._promptBulkAdd(npcId) },
      { label: '🗑  Send to Pocket', action: () => {
          STORE.treePos[npcId] = { x: null, y: null, pinned: false };
          STORE.save();
          delete this._nodes[npcId];
          this._renderPocket(this._household);
          this._draw(this._household);
      }},
    ];

    items.forEach(item => {
      const btn = document.createElement('button');
      btn.style.cssText = 'display:block;width:100%;padding:8px 14px;text-align:left;background:none;border:none;font-family:var(--font-body);font-size:0.9rem;color:var(--ink);cursor:pointer;transition:background 0.1s;border-bottom:1px solid var(--vellum-mid);';
      btn.textContent       = item.label;
      btn.onmouseenter      = () => btn.style.background = 'var(--vellum-mid)';
      btn.onmouseleave      = () => btn.style.background = 'none';
      btn.onclick           = () => { menu.remove(); item.action(); };
      menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', function close() {
        menu.remove();
      }, { once: true });
    }, 0);
  },

  // ── PNG EXPORT ────────────────────────────────────────
  _exportPng() {
    if (!Object.keys(this._nodes).length) { Toast.error('Nothing on the canvas to export'); return; }

    // Capture and serialize the SVG NOW — Modal.open() will replace the tree content
    const positions = Object.values(this._nodes);
    const NW = this.NODE_W, NH = this.NODE_H, PAD = 48;
    const minX = Math.min(...positions.map(p => p.x)) - PAD;
    const minY = Math.min(...positions.map(p => p.y)) - PAD;
    const maxX = Math.max(...positions.map(p => p.x + NW)) + PAD;
    const maxY = Math.max(...positions.map(p => p.y + NH)) + PAD;
    const bbW  = maxX - minX;
    const bbH  = maxY - minY;

    const svgEl = document.getElementById('treeSvg');
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('viewBox', `${minX} ${minY} ${bbW} ${bbH}`);
    clone.setAttribute('width',  String(bbW));
    clone.setAttribute('height', String(bbH));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const rootG = clone.querySelector('#treeRoot');
    if (rootG) rootG.setAttribute('transform', '');
    clone.querySelectorAll('.tree-connect-btn').forEach(el => el.remove());

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', String(minX)); bg.setAttribute('y', String(minY));
    bg.setAttribute('width', String(bbW)); bg.setAttribute('height', String(bbH));
    bg.setAttribute('fill', '#f2e8d0');
    clone.insertBefore(bg, clone.firstChild);

    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `
      .rel-spouse        { stroke: #7a1c1c; stroke-width: 2; fill: none; }
      .rel-betrothed     { stroke: #c04040; stroke-width: 2; stroke-dasharray: 5,3; fill: none; }
      .rel-lover         { stroke: #c04040; stroke-width: 2; stroke-dasharray: 2,3; fill: none; }
      .rel-former-spouse { stroke: #7a6030; stroke-width: 2; stroke-dasharray: 4,4; fill: none; }
      .rel-child         { stroke: #b8860b; stroke-width: 2; fill: none; }
      .rel-adopted-child { stroke: #b8860b; stroke-width: 2; stroke-dasharray: 5,3; fill: none; }
      .rel-sibling       { stroke: #5080b0; stroke-width: 2; fill: none; }
      .rel-half-sibling  { stroke: #5080b0; stroke-width: 2; stroke-dasharray: 4,3; fill: none; }
      .rel-sworn         { stroke: #60a882; stroke-width: 2; fill: none; }
      .rel-ward          { stroke: #9060d0; stroke-width: 2; fill: none; }
      .rel-cobalt        { stroke: #5080b0; stroke-width: 2; fill: none; }
      .rel-other         { stroke: #c8b878; stroke-width: 2; stroke-dasharray: 3,3; fill: none; }
      .rel-family-struct { stroke: rgba(180,140,10,0.38); stroke-width: 1.5; fill: none; }
      .rel-couple-dot    { fill: rgba(180,140,10,0.55); stroke: rgba(180,140,10,0.3); stroke-width: 1; }
      .rel-label         { font-family: 'Cinzel', 'Times New Roman', serif; font-size: 9px;
                           fill: #2e2010; text-anchor: middle; opacity: 0.7; }
      .tree-connect-btn  { display: none; }
    `;
    clone.insertBefore(styleEl, clone.firstChild);

    // Store prepared data so _doExportPng can use it after the modal replaces tree content
    this._pendingExport = {
      svgStr: new XMLSerializer().serializeToString(clone),
      bbW, bbH,
      household: this._household,
    };

    Modal.open(`
      <div style="min-width:300px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:16px;">Export Family Tree</div>
        <div class="detail-field mb-8">
          <div class="detail-label">Resolution</div>
          <select class="edit-input" id="export-scale">
            <option value="2">Normal (2×)</option>
            <option value="3" selected>High-res (3×)</option>
            <option value="4">Print quality (4×)</option>
          </select>
        </div>
        <div class="btn-row" style="margin-top:16px;">
          <button class="btn btn-primary" onclick="TabTree._doExportPng()">Export</button>
          <button class="btn btn-ghost" onclick="Modal.close();TabTree._pendingExport=null;">Cancel</button>
        </div>
      </div>
    `);
  },

  _doExportPng() {
    const scale = parseInt(document.getElementById('export-scale')?.value || '3', 10);
    Modal.close();

    const p = this._pendingExport;
    if (!p) return;
    this._pendingExport = null;

    const blob = new Blob([p.svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = p.bbW * scale;
      canvas.height = p.bbH * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f2e8d0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, p.bbW * scale, p.bbH * scale);

      const link = document.createElement('a');
      link.download = `${p.household}-family-tree.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      URL.revokeObjectURL(url);
      Toast.success('Family tree exported!');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      Toast.error('Export failed — try a different browser');
    };
    img.src = url;
  },

  currentHousehold() { return this._household; },
};
