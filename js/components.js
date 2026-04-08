/* ══════════════════════════════════════════════════════════════
   COMPONENTS.JS — Reusable UI building blocks
══════════════════════════════════════════════════════════════ */

// Role helper — used throughout to gate GM-only UI
const isGM = () => window.__USER__?.role === 'gm';

// HTML escape helper — use whenever interpolating untrusted data into innerHTML
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
window.esc = esc;

// ── TOAST ─────────────────────────────────────────────────────
const Toast = {
  show(msg, type = 'info', duration = 3000) {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; setTimeout(() => t.remove(), 300); }, duration);
  },
  success(msg) { this.show(msg, 'success'); },
  error(msg)   { this.show(msg, 'error'); },
  info(msg)    { this.show(msg, 'info'); },
};

// ── CARD POPUP ────────────────────────────────────────────────
// Secondary overlay that floats above the family tree modal.
// Opening/closing it does not affect the tree underneath.
const CardPopup = {
  open(contentHtml) {
    const overlay = document.getElementById('cardPopupOverlay');
    const content = document.getElementById('cardPopupContent');
    if (!overlay || !content) return;
    content.innerHTML = contentHtml;
    overlay.hidden = false;
  },

  close() {
    const overlay = document.getElementById('cardPopupOverlay');
    if (overlay) overlay.hidden = true;
    const content = document.getElementById('cardPopupContent');
    if (content) content.innerHTML = '';
  },

  isOpen() {
    return !document.getElementById('cardPopupOverlay')?.hidden;
  },

  // Close whichever layer is topmost.
  // Used by inline onclick handlers inside card/form HTML that may run in
  // either the main modal or the card popup.
  closeTop() {
    if (this.isOpen()) this.close();
    else Modal.close();
  },

  initListeners() {
    document.getElementById('cardPopupClose')?.addEventListener('click', () => CardPopup.close());
    document.getElementById('cardPopupOverlay')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) CardPopup.close();
    });
  },
};

// ── MODAL ─────────────────────────────────────────────────────
const Modal = {
  _stack:        [],
  _formDirty:    false,
  _closeCallback: null,
  _dirtyHandler:  null,

  _attachDirtyListeners() {
    const content = document.getElementById('modalContent');
    if (!content) return;
    // Remove any previously attached handler before adding a new one
    if (this._dirtyHandler) {
      content.removeEventListener('input',  this._dirtyHandler, true);
      content.removeEventListener('change', this._dirtyHandler, true);
    }
    this._dirtyHandler = () => { this._formDirty = true; };
    content.addEventListener('input',  this._dirtyHandler, true);
    content.addEventListener('change', this._dirtyHandler, true);
  },

  open(contentHtml, options = {}) {
    document.getElementById('navFateMenu')?.classList.remove('open');
    document.getElementById('navRecordsMenu')?.classList.remove('open');
    const overlay = document.getElementById('modalOverlay');
    const box     = document.getElementById('modalBox');
    const content = document.getElementById('modalContent');
    if (!overlay) return;

    this._formDirty = false;
    content.innerHTML = contentHtml;
    box.className = 'modal-box' + (options.wide ? ' modal-wide' : '') + (options.tree ? ' modal-tree' : '');
    overlay.hidden = false;

    // Track any user edits inside this modal (attach only one listener at a time)
    this._attachDirtyListeners();

    this._closeCallback = options.onClose || null;
    if (options.onOpen) options.onOpen(content);
  },

  // Close without dirty check — call this after a successful save.
  close() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.hidden = true;
    const content = document.getElementById('modalContent');
    if (content) {
      // Remove dirty-tracking listener before clearing content
      if (this._dirtyHandler) {
        content.removeEventListener('input',  this._dirtyHandler, true);
        content.removeEventListener('change', this._dirtyHandler, true);
        this._dirtyHandler = null;
      }
      content.innerHTML = '';
    }
    this._stack     = [];
    this._formDirty = false;
    if (this._closeCallback) { this._closeCallback(); this._closeCallback = null; }
  },

  // Close triggered by user (X button, ESC, overlay click) — warns if dirty.
  closeWithCheck() {
    if (this._formDirty) {
      if (!confirm('You have unsaved changes. Discard them and close?')) return;
    }
    this.close();
  },

  // Push the current modal content onto the stack and show new content.
  // A "← Back" button is prepended so the user can return.
  push(contentHtml, options = {}) {
    const box     = document.getElementById('modalBox');
    const content = document.getElementById('modalContent');
    if (!box || !content) return;
    this._stack.push({ html: content.innerHTML, className: box.className });
    this._formDirty = false;
    content.innerHTML =
      `<button class="btn btn-ghost modal-back-btn" onclick="Modal.pop()">← Back</button>` +
      contentHtml;
    box.className = 'modal-box' +
      (options.wide ? ' modal-wide' : '') +
      (options.tree ? ' modal-tree' : '');
    // Track edits in the new layer (replace any existing dirty listener)
    this._attachDirtyListeners();
  },

  // Restore the previous modal content from the stack.
  // Falls through to closeWithCheck() if the stack is empty.
  pop() {
    if (this._formDirty) {
      if (!confirm('You have unsaved changes. Discard them and go back?')) return;
    }
    if (!this._stack.length) { this.close(); return; }
    const prev    = this._stack.pop();
    const box     = document.getElementById('modalBox');
    const content = document.getElementById('modalContent');
    if (!box || !content) return;
    this._formDirty   = false;
    content.innerHTML = prev.html;
    box.className     = prev.className;
  },

  initListeners() {
    document.getElementById('modalClose')?.addEventListener('click', () => Modal.closeWithCheck());
    document.getElementById('modalOverlay')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) Modal.closeWithCheck();
    });
    // ESC pops one layer first; only fully closes when stack is empty
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (CardPopup.isOpen())       CardPopup.close();
        else if (Modal._stack.length) Modal.pop();
        else                          Modal.closeWithCheck();
      }
    });
    CardPopup.initListeners();
  },
};

// ── HOUSEHOLD COLOUR HELPERS ──────────────────────────────────
function hhColour(name) { return STORE.householdColour(name); }
function hhIcon(name)   { return STORE.householdIcon(name); }

function hhTagHtml(name) {
  if (!name) return '';
  const col = hhColour(name);
  const icon = hhIcon(name);
  return `<span class="hh-tag" style="background:${col};">${icon} ${name}</span>`;
}

// ── FACTIONS ──────────────────────────────────────────────────
const FACTIONS = [
  // Logres & counties
  { id: 'logres',    label: 'Logres',              colour: '#9a7010', icon: '👑' },
  { id: 'salisbury', label: 'Salisbury',           colour: '#8a2020', icon: '🦅' },
  { id: 'rydychan',  label: 'Rydychan',            colour: '#2a6a8a', icon: '⚜' },
  { id: 'silchester',label: 'Silchester',          colour: '#5a3a8a', icon: '🏛' },
  // British kingdoms
  { id: 'cambria',   label: 'Cambria',             colour: '#1a6a3a', icon: '🐉' },
  { id: 'cumbria',   label: 'Cumbria',             colour: '#3a6a1a', icon: '🏔' },
  { id: 'north',     label: 'The North',           colour: '#2a3a6a', icon: '❄' },
  { id: 'brittany',  label: 'Brittany & Cornwall', colour: '#7a2a4a', icon: '⚓' },
  // Foreign
  { id: 'ireland',   label: 'Ireland',             colour: '#1a7a3a', icon: '☘' },
  { id: 'continent', label: 'The Continent',       colour: '#6a5a30', icon: '🌍' },
  { id: 'saxon',     label: 'Saxon',               colour: '#8a3a1a', icon: '⚔' },
  // Special
  { id: 'independent',    label: 'Independent',       colour: '#5a5a5a', icon: '🎭' },
  { id: 'ladies_of_lake', label: 'Ladies of the Lake',colour: '#0a8a8a', icon: '✨' },
  { id: 'fae',            label: 'Fae',               colour: '#2a7a30', icon: '🌿' },
];

function getFaction(id) {
  return FACTIONS.find(f => f.id === id) || null;
}

function factionTagHtml(id) {
  if (!id) return '';
  const f = getFaction(id);
  if (!f) return '';
  return `<span class="hh-tag" style="background:${f.colour};">${f.icon} ${f.label}</span>`;
}

function hhPipStyle(name) {
  return name ? `background:${hhColour(name)};` : '';
}

// ── ROLE → EMOJI MAP ──────────────────────────────────────────
const ROLE_ICONS = {
  'Player Knight':    '⚔',
  'Knight Banneret':  '⚔',
  'Knight':           '⚔',
  'Bachelor Knight':  '⚔',
  'Mercenary Knight': '⚔',
  'Vassal Knight':    '🛡',
  'Squire':           '🏹',
  'Page':             '📖',
  'King':             '♔',
  'Warlord':          '⚔',
  'Baron':            '👑',
  'Estate Holder':    '🏰',
  'Steward':          '📋',
  'Priest':           '✝',
  'Druid':            '🌿',
  'Lady':             '🌸',
  'Baby':             '🍼',
  'Infant':           '🍼',
  'NPC':              '👤',
};

function roleIcon(role) {
  if (!role) return '👤';
  for (const [k, v] of Object.entries(ROLE_ICONS)) {
    if (role.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return '👤';
}

// ── ROLE → CSS COLOUR ─────────────────────────────────────────
const ROLE_COLOURS = {
  'Player Knight':    '#7a1c1c',
  'Knight Banneret':  '#6a0f0f',
  'Knight':           '#7a1c1c',
  'Vassal Knight':    '#9a2424',
  'Bachelor Knight':  '#b03030',
  'Mercenary Knight': '#7a5020',
  'Squire':           '#6030a0',
  'Page':             '#4060a0',
  'King':             '#c09000',
  'Warlord':          '#8a4010',
  'Baron':            '#b8860b',
  'Estate Holder':    '#7a6030',
  'Steward':          '#2d5a4a',
  'Priest':           '#1e3a5f',
  'Druid':            '#2d5a4a',
  'Lady':             '#803060',
  'Baby':             '#806040',
  'Infant':           '#806040',
};

function roleColour(role) {
  if (!role) return '#5a5040';
  for (const [k, v] of Object.entries(ROLE_COLOURS)) {
    if (role.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return '#5a5040';
}

// ── NPC CARD HTML (for modal) ─────────────────────────────────
function buildNpcCardHtml(npc, opts = {}) {
  const col = npc.household ? hhColour(npc.household) : roleColour(npc.role);
  const icon = roleIcon(npc.role);
  const calcAge = npc.year_born
    ? (npc.year_died ? npc.year_died - npc.year_born : STORE.year - npc.year_born)
    : null;
  const age = calcAge !== null ? `${calcAge} yrs` : (npc.age ? `${npc.age} yrs` : '—');
  const gloryNum = Number(npc.glory);
  const glory = (Number.isFinite(gloryNum) && gloryNum > 0) ? gloryNum.toLocaleString() + ' gl.' : '';

  // Find linked manor
  const manorKey = npc.manor ? STORE.manorKeys().find(k => npc.manor.toLowerCase().includes(k.toLowerCase())) : null;
  const manorLinkHtml = manorKey
    ? `<span class="manor-link" onclick="APP.goToManor('${manorKey}')">${hhIcon(manorKey)} ${manorKey} Manor</span>`
    : (npc.manor ? `<span style="font-size:0.9rem;color:var(--ink-soft)">${esc(npc.manor)}</span>` : '');

  // Relationships
  const REL_PRIORITY = {
    'Spouse': 1, 'Betrothed': 2, 'Lover': 3, 'Former Spouse': 4,
    'Child': 5, 'Adopted Child': 6, 'Bastard': 7,
    'Parent': 8, 'Adoptive Parent': 9,
    'Sibling': 10, 'Half-Sibling': 11,
    'Aunt/Uncle': 12, 'Niece/Nephew': 13, 'Cousin': 14,
    'Grandparent': 15, 'Grandchild': 16,
    'Sworn Brother/Sister': 17,
    'Vassal': 18,
    'Squire': 19, 'Former Squire': 20, 'Page': 21,
    'Ward': 22, 'Guardian': 23,
    'Other': 99,
  };
  // Active-present types that upgrade to "Former X" when the other person dies
  const BECOMES_FORMER = new Set(['Spouse', 'Betrothed', 'Lover']);
  // Asymmetric types: [label when this npc is SOURCE, label when this npc is TARGET]
  // Convention: Child/Adopted Child/Bastard → source=child, target=parent
  //             Parent/Adoptive Parent      → source=parent, target=child
  //             Squire/Former Squire/Page   → source=senior(knight), target=junior
  //             Vassal                      → source=vassal, target=liege
  //             Ward                        → source=ward, target=guardian
  //             Guardian                    → source=guardian, target=ward
  const REL_DIRECTED = {
    'Child':           ['Child of',               'Parent of'],
    'Adopted Child':   ['Adopted child of',        'Adoptive parent of'],
    'Bastard':         ['Bastard of',                 'Parent of'],
    'Parent':          ['Parent of',               'Child of'],
    'Adoptive Parent': ['Adoptive parent of',      'Adopted child of'],
    'Aunt/Uncle':      ['Aunt/Uncle of',            'Niece/Nephew of'],
    'Niece/Nephew':    ['Niece/Nephew of',          'Aunt/Uncle of'],
    'Grandparent':     ['Grandparent of',           'Grandchild of'],
    'Grandchild':      ['Grandchild of',            'Grandparent of'],
    'Squire':          ['Squire',                   'Squired under'],
    'Former Squire':   ['Former squire',            'Formerly squired under'],
    'Page':            ['Page',                     'Page under'],
    'Vassal':          ['Vassal of',                'Liege of'],
    'Ward':            ['Ward of',                  'Guardian of'],
    'Guardian':        ['Guardian of',              'Ward of'],
  };

  // Squire/Page/Former Squire rels shown in Training History once came_of_age — hide from main rels then
  const TRAINING_TYPES = new Set(['Squire', 'Former Squire', 'Page']);
  const rels = STORE.getRelationships(npc.id)
    .filter(r => !(npc.came_of_age && TRAINING_TYPES.has(r.type)))
    .slice()
    .sort((a, b) => (REL_PRIORITY[a.type] || 50) - (REL_PRIORITY[b.type] || 50));

  const relHtml = rels.length ? rels.map(r => {
    const isSource = r.sourceId === npc.id;
    const otherId  = isSource ? r.targetId : r.sourceId;
    const other    = STORE.getNpc(otherId);
    if (!other) return '';

    const isDead = other.status === 'Dead';

    // Derive display label — directional if applicable
    const dirPair = REL_DIRECTED[r.type];
    let displayType = dirPair ? dirPair[isSource ? 0 : 1] : r.type;

    // Upgrade active romantic types to "Former X" when other is deceased
    let deathNote = '';
    if (isDead) {
      if (BECOMES_FORMER.has(r.type)) displayType = 'Former ' + r.type;
      deathNote = other.year_died
        ? `<span class="rel-death-note">† ${other.year_died}</span>`
        : `<span class="rel-death-note">† deceased</span>`;
    }

    const nameStyle = isDead ? 'color:var(--ink-soft);text-decoration:line-through;' : '';

    // Bastard acknowledgement badge
    let bastardBadge = '';
    if (r.type === 'Bastard') {
      const bStatus = parseBastardStatus(r.notes);
      const bStyle  = bStatus === 'Legitimized'    ? 'background:#b8960a;color:#fff;'
                    : bStatus === 'Acknowledged'   ? 'background:#3a7a4a;color:#fff;'
                    :                               'background:#7a7a7a;color:#fff;';
      const bSymbol = bStatus === 'Legitimized' ? '⚜' : bStatus === 'Acknowledged' ? '◈' : '✗';
      bastardBadge = `<span class="bastard-ack-badge" style="${bStyle}">${bSymbol} ${bStatus}</span>`;
    }

    return `<div class="family-member-item" onclick="Components.openNpcCard('${other.id}')">
      <span class="family-member-role" style="background:${roleColour(r.type)}">${displayType}</span>
      <span class="family-member-name" style="${nameStyle}">${esc(other.name)}</span>
      ${bastardBadge}
      ${deathNote}
      <span class="family-member-age">${esc(other.role || '')}</span>
      <button class="rel-edit-btn" title="Edit relationship" onclick="event.stopPropagation();Components.openEditRelationship('${r.id}','${npc.id}')">✎</button>
    </div>`;
  }).join('') : '<div class="text-muted italic" style="font-size:0.85rem;padding:4px 0;">No recorded relationships</div>';

  // Inferred siblings — derived from parent records, never stored
  const inferredSibs = STORE.inferredSiblings(npc.id);
  const inferredSibsHtml = inferredSibs.length ? `
    <div class="section-title mt-16" style="opacity:0.85;">Siblings
      <span style="font-size:0.58rem;font-style:italic;color:var(--ink-soft);font-family:var(--font-body);text-transform:none;letter-spacing:0;margin-left:6px;">inferred from parent records</span>
    </div>
    <div class="family-member-list">
      ${inferredSibs.map(({npc: s, sibType}) => {
        const dead = s.status === 'Dead';
        const nameStyle = dead ? 'color:var(--ink-soft);text-decoration:line-through;' : '';
        const deathNote = dead && s.year_died ? `<span class="rel-death-note">† ${s.year_died}</span>` : '';
        const sAge = s.year_born ? (dead && s.year_died ? s.year_died - s.year_born : STORE.year - s.year_born) : null;
        const sibColour = sibType === 'Full Sibling' ? '#5a4a7a' : sibType === 'Half-Sibling' ? '#6a5a3a' : '#4a5a6a';
        return `<div class="family-member-item" onclick="Components.openNpcCard('${s.id}')">
          <span class="family-member-role" style="background:${sibColour};">${sibType}</span>
          <span class="family-member-name" style="${nameStyle}">${esc(s.name)}</span>
          ${deathNote}
          <span class="family-member-age">${esc(s.role || '')}${sAge != null ? ' · '+sAge : ''}</span>
        </div>`;
      }).join('')}
    </div>` : '';

  // ── Shared renderer for inferred sections ─────────────────────
  const mkInferredHtml = (items, title, tag, colorFn) => {
    if (!items.length) return '';
    const rows = items.map(({npc: s, role}) => {
      const dead = s.status === 'Dead';
      const nameStyle = dead ? 'color:var(--ink-soft);text-decoration:line-through;' : '';
      const deathNote = dead && s.year_died ? `<span class="rel-death-note">† ${s.year_died}</span>` : '';
      const sAge = s.year_born ? (dead && s.year_died ? s.year_died - s.year_born : STORE.year - s.year_born) : null;
      // Bastard badge — prefer most notable status if multiple bastard relationships exist
      const bastardRels = STORE.relationships.filter(r => r.type === 'Bastard' && r.sourceId === s.id);
      const bastardRel  = bastardRels.find(r => parseBastardStatus(r.notes) === 'Unacknowledged')
                       || bastardRels.find(r => parseBastardStatus(r.notes) === 'Legitimized')
                       || bastardRels[0];
      let bastardBadge = '';
      if (bastardRel) {
        const bStatus = parseBastardStatus(bastardRel.notes);
        const bStyle  = bStatus === 'Legitimized'  ? 'background:#b8960a;color:#fff;'
                      : bStatus === 'Acknowledged' ? 'background:#3a7a4a;color:#fff;'
                      :                              'background:#7a7a7a;color:#fff;';
        const bSymbol = bStatus === 'Legitimized' ? '⚜' : bStatus === 'Acknowledged' ? '◈' : '✗';
        bastardBadge = `<span class="bastard-ack-badge" style="${bStyle}">${bSymbol} ${bStatus}</span>`;
      }
      return `<div class="family-member-item" onclick="Components.openNpcCard('${s.id}')">
        <span class="family-member-role" style="background:${colorFn(role)};">${role}</span>
        <span class="family-member-name" style="${nameStyle}">${esc(s.name)}</span>
        ${bastardBadge}
        ${deathNote}
        <span class="family-member-age">${esc(s.role || '')}${sAge != null ? ' · '+sAge : ''}</span>
      </div>`;
    }).join('');
    return `<div class="section-title mt-16" style="opacity:0.85;">${title}
      <span style="font-size:0.58rem;font-style:italic;color:var(--ink-soft);font-family:var(--font-body);text-transform:none;letter-spacing:0;margin-left:6px;">${tag}</span>
    </div><div class="family-member-list">${rows}</div>`;
  };

  const gpColour  = r => r === 'Grandchild' ? '#3a6a4a' : '#7a4a3a';
  const auColour  = r => r === 'Niece/Nephew' ? '#3a6a6a' : '#4a3a7a';
  const ilColour  = r => {
    if (r === 'Good-Father' || r === 'Good-Mother' || r === 'Good-Parent') return '#5a4a3a';
    if (r === 'Good-Son'    || r === 'Good-Daughter' || r === 'Good-Child') return '#3a4a6a';
    return '#6a3a5a'; // Good-Brother / Good-Sister / Good-Sibling
  };

  const inferredGpHtml = mkInferredHtml(
    STORE.inferredGrandparents(npc.id), 'Grandparents & Grandchildren', 'inferred from parent records', gpColour);
  const inferredAuHtml = mkInferredHtml(
    STORE.inferredAuntsUncles(npc.id), 'Aunts, Uncles & Nieces/Nephews', 'inferred from parent records', auColour);
  const inferredIlHtml = mkInferredHtml(
    STORE.inferredInLaws(npc.id), 'In-Laws', 'inferred from spouse & children records', ilColour);

  // Head of House badge
  const hhData = npc.household ? STORE.getHousehold(npc.household) : null;
  const isHouseholdHead = hhData?.household_head === npc.id;
  const headHtml = isHouseholdHead
    ? `<div class="detail-block" style="border-left:3px solid var(--crimson);">
        <div class="detail-label" style="color:var(--crimson);">⚜ Head of House ${npc.household}</div>
       </div>`
    : '';

  const blessedHtml = npc.blessed
    ? `<div class="detail-block" style="border-left:3px solid var(--gold);">
        <div class="detail-label" style="color:var(--gold);">✦ Blessed Birth</div>
        <div class="detail-value">${esc(npc.blessed_note) || '—'}</div>
       </div>`
    : '';
  const fateTouchedHtml = npc.fate_touched
    ? `<div class="detail-block" style="border-left:3px solid #2a8a40;">
        <div class="detail-label" style="color:#2a8a40;">◈ Fate-Touched</div>
       </div>`
    : '';

  // ── Age flag ────────────────────────────────────────────────
  const calcAgeNow = npc.year_born ? STORE.year - npc.year_born : null;
  const ageFlag = (() => {
    if (!calcAgeNow || npc.came_of_age) return null;
    const role = (npc.role || '').toLowerCase();
    if (calcAgeNow >= 7  && calcAgeNow < 14 && ['baby','infant',''].includes(role) && !npc.page_placed) return 'page';
    if (calcAgeNow >= 14 && role === 'page')    return 'training';
    if (calcAgeNow >= 21 && role === 'squire')  return 'adult';
    if (calcAgeNow >= 18 && ['steward','priest','druid'].includes(role)) return 'adult';
    return null;
  })();

  const ageFlagHtml = ageFlag === 'page'
    ? `<div class="npc-age-flag npc-age-flag-amber">⚑ Needs Page Placement — age ${calcAgeNow}</div>`
    : ageFlag === 'training'
    ? `<div class="npc-age-flag npc-age-flag-cobalt">⚑ Needs Training Path — age ${calcAgeNow}</div>`
    : ageFlag === 'adult'
    ? `<div class="npc-age-flag npc-age-flag-verdigris">
         ⚑ Came of Age — age ${calcAgeNow}
         ${isGM() ? `<button class="btn btn-ghost" style="font-size:0.6rem;padding:2px 8px;margin-left:10px;" onclick="Components._confirmCameOfAge('${npc.id}')">✓ Confirm</button>` : ''}
       </div>`
    : npc.came_of_age
    ? `<div class="npc-age-flag npc-age-flag-done">✓ Came of Age${calcAgeNow ? ' (age ' + calcAgeNow + ')' : ''}</div>`
    : '';

  // ── Training history block ───────────────────────────────────
  // Only show Squire/Page in Training History after came_of_age — before that they live in Relationships
  const trainingRels = npc.came_of_age
    ? STORE.getRelationships(npc.id).filter(r => r.type === 'Squire' || r.type === 'Former Squire' || r.type === 'Page')
    : [];

  const trainingRelHtml = trainingRels.map(r => {
    const isJunior  = r.targetId === npc.id;
    const otherId   = isJunior ? r.sourceId : r.targetId;
    const other     = STORE.getNpc(otherId);
    const isDead    = other?.status === 'Dead';
    const label     = isJunior
      ? (r.type === 'Squire' || r.type === 'Former Squire' ? 'Squire under' : 'Page at')
      : (r.type === 'Squire' || r.type === 'Former Squire' ? 'Squire' : 'Page');
    const name      = other ? other.name : (r.notes || '—');
    const sub       = other ? other.role : '';
    const nameStyle = isDead ? 'color:var(--ink-soft);text-decoration:line-through;' : '';
    const deathNote = isDead ? `<span class="rel-death-note">† ${other.year_died || 'deceased'}</span>` : '';
    const noteText  = r.notes ? `<span style="font-size:0.78rem;color:var(--ink-soft);font-style:italic;"> — ${AtMention.render(r.notes)}</span>` : '';
    return `<div class="family-member-item" ${other ? `onclick="Components.openNpcCard('${other.id}')"` : ''}>
      <span class="family-member-role" style="background:var(--violet-mid);color:#fff;">${label}</span>
      <span class="family-member-name" style="${nameStyle}">${esc(name)}${noteText}</span>
      ${deathNote}
      <span class="family-member-age">${esc(sub)}</span>
    </div>`;
  }).join('');

  const hasTrainingHistory = trainingRels.length || npc.page_court || npc.training_where;
  const trainingHistoryHtml = hasTrainingHistory ? `
    <div class="section-title mt-12">Training History</div>
    <div class="family-member-list">
      ${npc.page_court ? `<div class="family-member-item">
        <span class="family-member-role" style="background:var(--cobalt-mid);color:#fff;">${(npc.role||'').toLowerCase().includes('page') ? 'Paging at' : 'Paged at'}</span>
        <span class="family-member-name">${esc(npc.page_court)}</span>
      </div>` : ''}
      ${npc.training_where && !npc.training_npc_id ? (() => {
        // Determine training type: training_path field is authoritative; if absent,
        // check whether a Squire relationship exists (target = this NPC); finally fall back to role.
        const tp = (npc.training_path || '').toLowerCase();
        const role = (npc.role || '').toLowerCase();
        const hasSquireRel = STORE.getRelationships(npc.id)
          .some(r => r.type === 'Squire' && r.targetId === npc.id);
        const path = tp || (hasSquireRel ? 'squire' : role);
        let trainLabel, trainColour;
        if (path.includes('priest') || path.includes('druid') || path.includes('nun') || path.includes('monk') || path.includes('clergy')) {
          trainLabel = npc.came_of_age ? 'Studied with the Clergy at' : 'Studying with the Clergy at'; trainColour = 'var(--cobalt-mid)';
        } else if (path.includes('steward') || path.includes('seneschal')) {
          trainLabel = npc.came_of_age ? 'Learned Stewardship under' : 'Learning Stewardship under'; trainColour = 'var(--amber-mid)';
        } else if (path.includes('squire')) {
          trainLabel = npc.came_of_age ? 'Squired under' : 'Squire under'; trainColour = 'var(--violet-mid)';
        } else if (path.includes('page')) {
          trainLabel = npc.came_of_age ? 'Paged at' : 'Paging at'; trainColour = 'var(--cobalt-mid)';
        } else {
          trainLabel = 'Trained under'; trainColour = 'var(--cobalt-mid)';
        }
        return `<div class="family-member-item">
          <span class="family-member-role" style="background:${trainColour};color:#fff;">${trainLabel}</span>
          <span class="family-member-name">${esc(npc.training_where)}</span>
        </div>`;
      })() : ''}
      ${trainingRelHtml}
    </div>` : '';

  const isDead = npc.status === 'Dead';
  const deathLine = isDead
    ? `<div style="color:var(--crimson-mid);font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.15em;margin-top:4px;">† DECEASED ${npc.year_died ? npc.year_died + ' AD' : ''}</div>`
    : '';

  const impressionText = typeof Notes !== 'undefined' ? Notes.getImpression(npc.id) : '';

  return `
    <div class="npc-card-layout">
    <div class="npc-detail">
      <div class="npc-detail-header">
        <div class="npc-avatar" style="background:${col}22;border-color:${col};">${icon}</div>
        <div class="npc-header-text">
          <div class="npc-name" ${npc.round_table ? 'style="color:var(--gold);text-shadow:0 0 12px rgba(184,134,11,0.4);"' : ''}>
            ${esc(npc.name)}
            ${npc.blessed      ? '<span class="blessed-pip-lg" title="Blessed Birth">✦</span>' : ''}
            ${npc.fate_touched ? '<span class="fate-pip-lg"    title="Fate-Touched">◈</span>'  : ''}
            ${npc.round_table  ? '<span title="Knight of the Round Table" style="font-size:0.75rem;color:var(--gold);margin-left:2px;">⊕</span>' : ''}
          </div>
          ${npc.out_of_story ? `<div style="margin-top:3px;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.08em;color:#8a7a5a;background:rgba(138,122,90,0.12);border:1px solid rgba(138,122,90,0.3);padding:2px 8px;border-radius:4px;display:inline-block;">🌫 Out of Story${npc.out_of_story_note ? ' — ' + esc(npc.out_of_story_note) : ''}</div>` : ''}
          <div class="npc-role-line">${esc(npc.role) || '—'}${npc.pronoun ? ' · ' + esc(npc.pronoun) : ''}</div>
          ${deathLine}
          ${glory ? `<div class="npc-glory-badge">${glory}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0;">
          ${npc.household ? hhTagHtml(npc.household) : ''}
          ${npc.faction   ? factionTagHtml(npc.faction) : ''}
          ${manorLinkHtml}
        </div>
      </div>

      <div class="npc-detail-grid">
        <div class="detail-field">
          <div class="detail-label">Born</div>
          <div class="detail-value">${npc.year_born ? npc.year_born + ' AD' : '—'} ${calcAge !== null ? '(age ' + calcAge + ')' : (npc.age ? '(age ' + npc.age + ')' : '')}</div>
        </div>
        ${isDead ? `<div class="detail-field"><div class="detail-label">Died</div><div class="detail-value">${npc.year_died ? npc.year_died + ' AD' : '—'}</div></div>` : ''}
        <div class="detail-field">
          <div class="detail-label">Eligibility</div>
          <div class="detail-value">${esc(npc.eligibility) || '—'}</div>
        </div>
        ${npc.dowry ? `<div class="detail-field"><div class="detail-label">Dowry</div><div class="detail-value">${esc(npc.dowry)}</div></div>` : ''}
      </div>

      ${ageFlagHtml}
      ${npc.notes    ? `<div class="detail-block"><div class="detail-label">Notes</div><div class="detail-value atm-rendered">${AtMention.render(npc.notes)}</div></div>` : ''}
      ${isGM() && npc.passions ? `<div class="detail-block"><div class="detail-label">Passions &amp; Traits</div><div class="detail-value atm-rendered">${AtMention.render(npc.passions)}</div></div>` : ''}
      ${isGM() && npc.skills   ? `<div class="detail-block"><div class="detail-label">Skills</div><div class="detail-value atm-rendered">${AtMention.render(npc.skills)}</div></div>` : ''}
      ${isGM() && npc.stats    ? `<div class="detail-block"><div class="detail-label">Stats</div><div class="detail-value atm-rendered">${AtMention.render(npc.stats)}</div></div>` : ''}
      ${isGM() && npc.statblock_template ? `<div class="detail-block" style="border-left:3px solid var(--cobalt);"><div class="detail-label" style="color:var(--cobalt-mid);">📋 Template</div><div class="detail-value" style="font-family:var(--font-heading);font-size:0.78rem;">${esc(npc.statblock_template)}</div></div>` : ''}
      ${headHtml}${blessedHtml}${fateTouchedHtml}
      ${trainingHistoryHtml}

      <div class="section-title mt-16">Relationships</div>
      <div class="family-member-list">${relHtml}</div>
      ${inferredSibsHtml}
      ${inferredGpHtml}
      ${inferredAuHtml}
      ${inferredIlHtml}
      ${buildSoloChronicleHtml(npc)}

      <div class="btn-row">
        ${isGM() ? `
          <button class="btn btn-primary" onclick="Components.openEditNpc('${npc.id}')">Edit</button>
          <button class="btn btn-verdigris" onclick="Components.openAddRelationship('${npc.id}')">+ Relationship</button>
          <button class="btn btn-ghost" onclick="Components.promptChronicleNpc('${npc.id}')">📜 Chronicle</button>
          ${!isDead
            ? `<button class="btn btn-danger" onclick="Components.confirmKill('${npc.id}')">Mark Deceased</button>`
            : `<button class="btn btn-ghost" onclick="Components.confirmRestore('${npc.id}')">Restore to Living</button>`}
        ` : ''}
        <button class="btn btn-ghost pin-btn${typeof PinsManager !== 'undefined' && PinsManager.isPinned(npc.id) ? ' pin-active' : ''}"
                onclick="PinsManager.toggleAndRefreshCard('${npc.id}')"
                title="${typeof PinsManager !== 'undefined' && PinsManager.isPinned(npc.id) ? 'Remove from Persons of Interest' : 'Add to Persons of Interest'}">
          ${typeof PinsManager !== 'undefined' && PinsManager.isPinned(npc.id) ? '★' : '☆'} Pin
        </button>
        ${opts.inline
          ? `<button class="btn btn-ghost" style="margin-left:auto;" onclick="TabRoster.deselect()">Close</button>`
          : `<button class="btn btn-ghost" style="margin-left:auto;" onclick="CardPopup.closeTop()">Close</button>`}
      </div>
    </div>

    <!-- SIDEBAR: Impressions + Comments -->
    <div class="npc-card-sidebar" id="npc-sidebar-${esc(npc.id)}">
      <button class="npc-sidebar-close" onclick="Components._closeSidebar('${esc(npc.id)}')" title="Close">✕</button>

      <div class="npc-sidebar-section">
        <div class="section-title" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
          <span>My Impressions</span>
          <span style="font-size:0.65rem;color:var(--ink-soft);font-style:italic;font-weight:400;font-family:var(--font-body);">private</span>
        </div>
        <textarea
          id="impression-ta-${esc(npc.id)}"
          class="journal-textarea"
          style="min-height:100px;"
          placeholder="Your private thoughts on ${esc(npc.name)}\u2026"
          oninput="Components._onImpressionInput('${esc(npc.id)}', this.value)"
        >${esc(impressionText)}</textarea>
        <div style="text-align:right;font-size:0.65rem;color:var(--ink-soft);font-style:italic;margin-top:3px;">
          auto-saves &nbsp;<span id="impression-status-${esc(npc.id)}" class="journal-save-status"></span>
        </div>
      </div>

      <div class="npc-sidebar-section">
        <div class="section-title" style="margin-bottom:8px;">Comments</div>
        <div id="comments-${esc(npc.id)}" class="comments-section">
          ${typeof Comments !== 'undefined' ? Comments.buildHtml(npc.id) : '<div class="text-muted">Loading\u2026</div>'}
        </div>
      </div>
    </div>

    <!-- Mobile sidebar toggle -->
    <button class="npc-sidebar-toggle" id="npc-sidebar-toggle-${esc(npc.id)}" onclick="Components._openSidebar('${esc(npc.id)}')">
      📝 Notes &amp; Comments${(() => { const cached = typeof Comments !== 'undefined' && Comments._cache[npc.id]; const count = cached ? cached.filter(c => !c.deleted).length : 0; return count > 0 ? ` (${count})` : ''; })()}
    </button>

    </div>`;
}

// ── NPC EDIT FORM HTML ────────────────────────────────────────
function buildNpcEditHtml(npc, isNew = false) {
  const roles = ['King','Warlord','Player Knight','Knight Banneret','Vassal Knight','Bachelor Knight','Mercenary Knight','Knight','Lady','Esquire','Squire','Page','Baron','Estate Holder','Steward','Priest','Druid','Baby','Merchant','Other'];
  const eligOpts = ['No','Yes','Kinda?','Widowed','Betrothed'];
  const pronouns = ['He/him','She/her','They/them',''];

  function sel(opts, val) {
    return opts.map(o => `<option value="${o}" ${o===val?'selected':''}>${o}</option>`).join('');
  }
  function hhSel(val) {
    const opts = ['', ...STORE.households.map(h => h.name)];
    return opts.map(o => `<option value="${o}" ${o===val?'selected':''}>${o||'— Unassigned —'}</option>`).join('');
  }
  function manorSel(val) {
    const opts = ['', ...STORE.manorKeys()];
    return opts.map(o => `<option value="${o}" ${o===val?'selected':''}>${o||'— None —'}</option>`).join('');
  }

  return `
    <div style="min-width:500px;max-width:660px;">
      <div class="page-title" style="font-size:1.1rem;margin-bottom:16px;">Edit — ${esc(npc.name)}</div>
      <div class="npc-detail-grid">
        <div class="detail-field">
          <div class="detail-label">Name</div>
          <input class="edit-input" id="ef-name" value="${esc(npc.name || '')}">
        </div>
        <div class="detail-field">
          <div class="detail-label">Role</div>
          <select class="edit-input edit-select" id="ef-role"><option value="">(choose)</option>${sel(roles, npc.role)}</select>
        </div>
        <div class="detail-field">
          <div class="detail-label">Pronoun</div>
          <select class="edit-input edit-select" id="ef-pronoun">${sel(pronouns, npc.pronoun)}</select>
        </div>
        <div class="detail-field">
          <div class="detail-label">Glory</div>
          <input class="edit-input" id="ef-glory" type="number" value="${npc.glory || 0}">
        </div>
        <div class="detail-field">
          <div class="detail-label">Year Born</div>
          <input class="edit-input" id="ef-year-born" type="number" value="${npc.year_born || ''}"
            oninput="Components._syncFromYear()" placeholder="e.g. 465">
        </div>
        <div class="detail-field">
          <div class="detail-label">Age <span style="font-size:0.65em;font-style:italic;opacity:0.7;">↔ infers birth year</span></div>
          <input class="edit-input" id="ef-age" type="number" value="${npc.year_born ? STORE.year - npc.year_born : (npc.age || '')}"
            oninput="Components._syncFromAge()" placeholder="e.g. 33">
        </div>
        <div class="detail-field">
          <div class="detail-label">Household</div>
          <select class="edit-input edit-select" id="ef-household">${hhSel(npc.household)}</select>
        </div>
        <div class="detail-field">
          <div class="detail-label">Faction / Organization</div>
          <select class="edit-input edit-select" id="ef-faction">
            <option value="">— none —</option>
            ${FACTIONS.map(f => `<option value="${f.id}"${npc.faction===f.id?' selected':''}>${f.icon} ${f.label}</option>`).join('')}
          </select>
        </div>
        <div class="detail-field">
          <div class="detail-label">Manor (linked)</div>
          <select class="edit-input edit-select" id="ef-manor-link">${manorSel(npc.manor)}</select>
        </div>
        <div class="detail-field">
          <div class="detail-label">Manor (display text)</div>
          <input class="edit-input" id="ef-manor" value="${esc(npc.manor || '')}">
        </div>
        <div class="detail-field">
          <div class="detail-label">Eligibility</div>
          <select class="edit-input edit-select" id="ef-eligibility">${sel(eligOpts, npc.eligibility)}</select>
        </div>
        <div class="detail-field">
          <div class="detail-label">Dowry</div>
          <input class="edit-input" id="ef-dowry" value="${esc(npc.dowry || '')}">
        </div>
      </div>
      <div class="detail-field mt-8 mb-8">
        <div class="detail-label">Notes</div>
        <textarea class="edit-input edit-textarea" id="ef-notes">${esc(npc.notes || '')}</textarea>
      </div>
      <div class="detail-field mb-8">
        <div class="detail-label">Passions &amp; Traits</div>
        <textarea class="edit-input edit-textarea" id="ef-passions">${esc(npc.passions || '')}</textarea>
      </div>
      <div class="detail-field mb-8">
        <div class="detail-label">Skills</div>
        <textarea class="edit-input edit-textarea" id="ef-skills">${esc(npc.skills || '')}</textarea>
      </div>
      <div class="detail-field mb-8">
        <div class="detail-label">Stats</div>
        <textarea class="edit-input edit-textarea" id="ef-stats">${esc(npc.stats || '')}</textarea>
      </div>
      <input type="hidden" id="ef-statblock-template" value="${esc(npc.statblock_template || '')}">
      <div style="margin-bottom:12px;">
        <button class="btn btn-ghost" style="font-size:0.68rem;width:100%;border-style:dashed;" onclick="Components.openStatblockPicker()">
          📋 ${npc.statblock_template ? 'Template: ' + esc(npc.statblock_template) + ' — Change' : 'Attach Template Stat Block'}
        </button>
      </div>
      <div class="detail-field mb-8">
        <div class="detail-label">Training History</div>
        <div style="display:flex;flex-direction:column;gap:6px;padding:8px;background:var(--vellum-mid);border:1px solid var(--vellum-deep);border-radius:var(--radius);">
          <div class="detail-field">
            <div class="detail-label">Paged at</div>
            <input class="edit-input" id="ef-page-court" placeholder="e.g. Court of Sarum…" value="${esc(npc.page_court || '')}">
          </div>
          <div class="detail-field">
            <div class="detail-label">Training Path</div>
            <input class="edit-input" id="ef-training-path" placeholder="squire / priest / steward…" value="${esc(npc.training_path || '')}">
          </div>
          <div class="detail-field">
            <div class="detail-label">Trained / Squired under</div>
            <div style="font-family:var(--font-heading);font-size:0.5rem;letter-spacing:0.1em;color:var(--ink-soft);opacity:0.7;margin-bottom:4px;">Search for an NPC in the binder — saves a Squire/Page relationship automatically.</div>
            ${buildNpcSearchHtml('ef-training-npc-search', 'ef-training-npc-id', 'Search for knight or trainer…')}
            <div style="font-family:var(--font-heading);font-size:0.5rem;letter-spacing:0.1em;color:var(--ink-soft);opacity:0.7;margin:6px 0 4px;">Not in the binder? Type a name instead:</div>
            <input class="edit-input" id="ef-training-where" placeholder="e.g. Sir Elad of Woodford…" value="${esc(npc.training_where || '')}">
          </div>
        </div>
      </div>
      <div class="detail-field mb-8">
        <div class="detail-label">Flags</div>
        <div style="display:flex;flex-direction:column;gap:8px;padding:8px;background:var(--vellum-mid);border:1px solid var(--vellum-deep);border-radius:var(--radius);">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="ef-came-of-age" ${npc.came_of_age?'checked':''}>
            <span style="font-family:var(--font-heading);font-size:0.62rem;letter-spacing:0.1em;">Came of Age</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="ef-blessed" ${npc.blessed?'checked':''} onchange="document.getElementById('ef-blessed-note-wrap').style.display=this.checked?'block':'none'">
            <span class="blessed-pip">✦</span>
            <span style="font-family:var(--font-heading);font-size:0.62rem;letter-spacing:0.1em;">Blessed Birth</span>
          </label>
          <div id="ef-blessed-note-wrap" style="display:${npc.blessed?'block':'none'};padding-left:20px;">
            <input class="edit-input" id="ef-blessed-note" placeholder="Blessed birth note…" value="${esc(npc.blessed_note || '')}">
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="ef-fate-touched" ${npc.fate_touched?'checked':''}>
            <span class="fate-pip">◈</span>
            <span style="font-family:var(--font-heading);font-size:0.62rem;letter-spacing:0.1em;">Fate-Touched</span>
          </label>
          <div style="border-top:1px solid var(--vellum-deep);margin-top:4px;padding-top:8px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <div id="ef-con-wrap" style="display:flex;align-items:center;gap:6px;${npc.barren?'display:none;':''}">
              <span style="font-family:var(--font-heading);font-size:0.62rem;letter-spacing:0.1em;color:var(--ink-soft);">CON</span>
              <input class="edit-input" id="ef-con" type="number" min="1" max="30"
                value="${npc.con || 13}"
                style="width:56px;text-align:center;padding:3px 6px;"
                title="Constitution — used for childbirth rolls (default 13)">
            </div>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="ef-barren" ${npc.barren?'checked':''}
                onchange="document.getElementById('ef-con-wrap').style.display=this.checked?'none':'flex'">
              <span style="font-family:var(--font-heading);font-size:0.62rem;letter-spacing:0.1em;color:var(--crimson-mid);">Barren</span>
            </label>
          </div>
          <div style="border-top:1px solid var(--vellum-deep);margin-top:4px;padding-top:8px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="ef-out-of-story" ${npc.out_of_story?'checked':''}
                onchange="document.getElementById('ef-oos-note-wrap').style.display=this.checked?'block':'none'">
              <span style="font-family:var(--font-heading);font-size:0.62rem;letter-spacing:0.1em;color:#8a7a5a;">🌫 Out of Story</span>
            </label>
            <div id="ef-oos-note-wrap" style="display:${npc.out_of_story?'block':'none'};padding-left:20px;margin-top:6px;">
              <input class="edit-input" id="ef-oos-note" placeholder="Why did they leave? e.g. Became an Esquire, took ship to the continent…" value="${esc(npc.out_of_story_note || '')}">
            </div>
          </div>
          ${['knight','king','warlord','baron'].some(r => (npc.role||'').toLowerCase().includes(r)) ? `
          <div style="border-top:1px solid var(--vellum-deep);margin-top:4px;padding-top:8px;">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="ef-round-table" ${npc.round_table?'checked':''}>
              <span style="font-family:var(--font-heading);font-size:0.62rem;letter-spacing:0.1em;color:var(--gold);">⊕ Knight of the Round Table</span>
            </label>
          </div>` : ''}
        </div>
      </div>
      <div class="btn-row">
        ${isNew
          ? `<button class="btn btn-primary" onclick="Components.saveNewNpc()">Add to Roster</button>
             <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>`
          : `<button class="btn btn-primary" onclick="Components.saveEditNpc('${npc.id}')">Save</button>
             <button class="btn btn-ghost" onclick="Components.openNpcCard('${npc.id}')">Cancel</button>
             <button class="btn btn-danger" style="margin-left:auto;" onclick="Components.confirmDeleteNpc('${npc.id}')">Delete NPC</button>`
        }
      </div>
    </div>`;
}

// ── NPC SEARCH AUTOCOMPLETE ───────────────────────────────────
// Returns HTML string for a search-as-you-type NPC picker.
// textId   = id for the visible text input
// hiddenId = id for the hidden input that stores the chosen npc id
function buildNpcSearchHtml(textId, hiddenId, placeholder = 'Search by name or role…') {
  return `
    <div class="npc-search-wrap" id="${textId}-wrap">
      <input class="edit-input npc-search-input" id="${textId}" autocomplete="off" placeholder="${placeholder}">
      <input type="hidden" id="${hiddenId}">
      <div class="npc-search-results" id="${textId}-results" style="display:none;"></div>
    </div>`;
}

// Wire up live-filter behaviour for a search input created by buildNpcSearchHtml.
// allNpcs = array of npc objects to search against.
function initNpcSearch(textId, hiddenId, allNpcs) {
  const input   = document.getElementById(textId);
  const hidden  = document.getElementById(hiddenId);
  const results = document.getElementById(textId + '-results');
  if (!input || !hidden || !results) return;

  function showResults(list) {
    if (!list.length) { results.style.display = 'none'; return; }
    results.innerHTML = list.slice(0, 12).map(n =>
      `<div class="npc-search-item" data-id="${n.id}">
        <span class="npc-search-name">${esc(n.name)}</span>
        ${n.role ? `<span class="npc-search-role">${esc(n.role)}</span>` : ''}
        ${n.household ? `<span class="npc-search-hh" style="color:${STORE.householdColour(n.household)}">${STORE.householdIcon(n.household)}</span>` : ''}
      </div>`
    ).join('');
    results.style.display = '';
  }

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    hidden.value = '';
    if (!q) { results.style.display = 'none'; return; }
    const filtered = allNpcs.filter(n =>
      (n.name  && n.name.toLowerCase().includes(q)) ||
      (n.role  && n.role.toLowerCase().includes(q)) ||
      (n.manor && n.manor.toLowerCase().includes(q))
    );
    showResults(filtered);
  });

  results.addEventListener('mousedown', e => {
    const item = e.target.closest('.npc-search-item');
    if (!item) return;
    e.preventDefault();
    const npc = allNpcs.find(n => n.id === item.dataset.id);
    if (!npc) return;
    hidden.value  = npc.id;
    input.value   = npc.name + (npc.role ? ' (' + npc.role + ')' : '');
    results.style.display = 'none';
  });

  input.addEventListener('blur', () => {
    // Short delay so mousedown on a result fires first
    setTimeout(() => { results.style.display = 'none'; }, 150);
  });
  input.addEventListener('focus', () => {
    if (input.value.trim()) input.dispatchEvent(new Event('input'));
  });
}

// ── ADD RELATIONSHIP FORM ─────────────────────────────────────
function parseBastardStatus(notes) {
  const n = (notes || '').toLowerCase();
  if (n.includes('legitimized'))    return 'Legitimized';
  if (n.includes('unacknowledged')) return 'Unacknowledged';
  if (n.includes('acknowledged'))   return 'Acknowledged';
  return 'Unacknowledged';
}

function stripBastardStatus(notes) {
  return (notes || '')
    .replace(/^(Legitimized|Acknowledged|Unacknowledged)\s*[.—\-]?\s*/i, '')
    .trim();
}

function bastardStatusRadios(name, selected) {
  return ['Unacknowledged', 'Acknowledged', 'Legitimized'].map(v =>
    `<label style="font-size:0.82rem;cursor:pointer;display:flex;align-items:center;gap:4px;">
      <input type="radio" name="${name}" value="${v}" ${v === selected ? 'checked' : ''}> ${v}
    </label>`
  ).join('');
}

function buildAddRelHtml(npcId) {
  const npc = STORE.getNpc(npcId);
  if (!npc) return '';
  const typeOpts = RELATION_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
  return `
    <div style="min-width:400px;">
      <div class="page-title" style="font-size:1rem;margin-bottom:14px;">Add Relationship — ${esc(npc.name)}</div>
      <div class="detail-field mb-8">
        <div class="detail-label">Relationship Type</div>
        <select class="edit-input edit-select" id="rel-type"
          onchange="Components._toggleBastardOpts(this.value,'rel-bastard-opts')">${typeOpts}</select>
      </div>
      <div id="rel-bastard-opts" class="detail-field mb-8" hidden>
        <div class="detail-label">Acknowledgement</div>
        <div style="display:flex;gap:16px;margin-top:4px;flex-wrap:wrap;">
          ${bastardStatusRadios('rel-bastard-status', 'Unacknowledged')}
        </div>
      </div>
      <div class="detail-field mb-8">
        <div class="detail-label">People</div>
        <div id="rel-targets-list">
          <div class="rel-target-row" id="rel-row-0" style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            ${buildNpcSearchHtml('rel-target-search-0', 'rel-target-0', 'Search by name, role, manor…')}
          </div>
        </div>
        <button class="btn btn-ghost" style="margin-top:2px;font-size:0.7rem;" onclick="Components.addRelTarget('${npcId}')">+ Add Another Person</button>
      </div>
      <div class="detail-field mb-8">
        <div class="detail-label">Notes (optional)</div>
        <input class="edit-input" id="rel-notes" placeholder="e.g. Married 490 AD">
      </div>
      <input type="hidden" id="rel-row-count" value="1">
      <div class="btn-row">
        <button class="btn btn-primary" onclick="Components.saveRelationship('${npcId}')">Add</button>
        <button class="btn btn-ghost" onclick="Components.openNpcCard('${npcId}')">Cancel</button>
      </div>
    </div>`;
}

// ── LIFE EVENTS SECTION ──────────────────────────────────────
function buildSoloChronicleHtml(npc) {
  const events = npc.soloEvents || [];
  const SHOW_FIRST = 3;

  const user = window.__USER__;
  const canEdit = isGM() || (user && npc.household &&
    npc.household.toLowerCase() === (user.household || '').toLowerCase());

  const renderEvt = ev => {
    const season = ev.season ? ev.season.charAt(0).toUpperCase() + ev.season.slice(1) : '';
    const dateLine = [season, ev.year ? ev.year + ' AD' : ''].filter(Boolean).join(' · ');
    return `<div class="solo-chr-item">
      <div class="solo-chr-header">
        <span class="solo-chr-date">${esc(dateLine)}</span>
        <span class="solo-chr-title">${esc(ev.title || '')}</span>
        ${canEdit ? `<button class="btn btn-ghost solo-chr-edit-btn" onclick="Components.editSoloEvent('${npc.id}','${ev.id}')">Edit</button>` : ''}
        ${isGM() ? `<button class="btn btn-ghost solo-chr-edit-btn" onclick="Components.promptChronicleEvent('${npc.id}','${ev.id}')">📜</button>` : ''}
      </div>
      ${ev.mechDesc   ? `<div class="solo-chr-mech">${esc(ev.mechDesc)}</div>` : ''}
      ${ev.flavorText ? `<div class="solo-chr-flavor">${esc(ev.flavorText)}</div>` : ''}
      ${ev.userNotes  ? `<div class="solo-chr-notes atm-rendered">${AtMention.render(ev.userNotes)}</div>` : ''}
    </div>`;
  };

  const visible = events.slice(0, SHOW_FIRST);
  const rest    = events.slice(SHOW_FIRST);
  const uid     = npc.id.replace(/[^a-z0-9]/g, '');

  return `
    <div class="section-title mt-16" style="display:flex;align-items:center;justify-content:space-between;">
      <span>Life Events ${events.length ? `<span style="font-size:0.65rem;opacity:0.55;font-family:var(--font-body);letter-spacing:0;font-weight:400;">(${events.length})</span>` : ''}</span>
      ${canEdit ? `<button class="btn btn-ghost" style="font-size:0.62rem;padding:2px 9px;" onclick="Components.addLifeEvent('${npc.id}')">+ Add Event</button>` : ''}
    </div>
    <div class="solo-chr-list">
      ${events.length ? `
        ${visible.map(renderEvt).join('')}
        ${rest.length ? `
          <div id="solo-chr-more-${uid}" hidden>${rest.map(renderEvt).join('')}</div>
          <button class="btn btn-ghost solo-chr-more-btn"
            onclick="const el=document.getElementById('solo-chr-more-${uid}');el.hidden=!el.hidden;this.textContent=el.hidden?'Show ${rest.length} more ▾':'Collapse ▴'">
            Show ${rest.length} more ▾
          </button>` : ''}
      ` : `<div style="font-size:0.78rem;color:var(--ink-soft);font-style:italic;padding:4px 0;">No events recorded yet.</div>`}
    </div>`;
}

// ── COMPONENTS NAMESPACE ──────────────────────────────────────
const Components = {
  _onImpressionInput(npcId, value) {
    if (typeof Notes !== 'undefined') Notes.setImpression(npcId, value, `impression-status-${npcId}`);
  },

  _openSidebar(npcId) {
    const sidebar = document.getElementById(`npc-sidebar-${npcId}`);
    if (sidebar) sidebar.classList.add('npc-sidebar-open');
  },

  _closeSidebar(npcId) {
    const sidebar = document.getElementById(`npc-sidebar-${npcId}`);
    if (sidebar) sidebar.classList.remove('npc-sidebar-open');
  },

  openNpcCard(id) {
    const npc = STORE.getNpc(id);
    if (!npc) return;
    // If the card popup is already open (i.e. we're browsing from the tree),
    // navigate within the popup rather than replacing the tree modal.
    if (CardPopup.isOpen()) {
      CardPopup.open(buildNpcCardHtml(npc));
    } else {
      Modal.open(buildNpcCardHtml(npc), { wide: true });
    }
    if (typeof Comments !== 'undefined') Comments.loadForNpc(id);
  },

  // Called by the family tree — always uses the popup overlay.
  openNpcCardInTree(id) {
    const npc = STORE.getNpc(id);
    if (!npc) return;
    CardPopup.open(buildNpcCardHtml(npc));
    if (typeof Comments !== 'undefined') Comments.loadForNpc(id);
  },

  // Always opens in CardPopup — used by Persons of Interest dashboard widget.
  openNpcCardPopup(id) {
    const npc = STORE.getNpc(id);
    if (!npc) return;
    CardPopup.open(buildNpcCardHtml(npc));
    if (typeof Comments !== 'undefined') Comments.loadForNpc(id);
  },

  openEditNpc(id) {
    const npc = STORE.getNpc(id);
    if (!npc) return;
    const allNpcs = STORE.allNpcs().filter(n => n.id !== id).sort((a, b) => a.name.localeCompare(b.name));
    Modal.open(buildNpcEditHtml(npc), { wide: true, onOpen: () => {
      initNpcSearch('ef-training-npc-search', 'ef-training-npc-id', allNpcs);
      // Pre-populate picker if NPC already linked
      if (npc.training_npc_id) {
        const linked = STORE.getNpc(npc.training_npc_id);
        if (linked) {
          const searchEl = document.getElementById('ef-training-npc-search');
          const hiddenEl = document.getElementById('ef-training-npc-id');
          if (searchEl) searchEl.value = linked.name;
          if (hiddenEl) hiddenEl.value = linked.id;
        } else {
          Toast.show(`${npc.name}'s linked trainer no longer exists in the binder — link cleared on next save.`, 'warning');
        }
      }
    }});
  },

  // ── Import NPC from Claude.ai JSON ───────────────────────────
  openImportNpc() {
    const snippet = [
      'After describing the NPC, output a JSON code block for my Pendragon GM\'s Binder:',
      '',
      '```json',
      '{',
      '  "name": "Full name",',
      '  "pronoun": "She/her",',
      '  "role": "Lady",',
      '  "year_born": 465,',
      '  "household": "Household name",',
      '  "faction": "salisbury",',
      '  "glory": 0,',
      '  "eligibility": "No",',
      '  "dowry": "",',
      '  "notes": "Background, appearance, personality...",',
      '  "passions": "Love (family) 16, Loyalty (Lord Roderick) 13",',
      '  "traits": "Chaste 14, Generous 12, Valorous 10",',
      '  "skills": "Industry 14, Chirurgery 12, Intrigue 13",',
      '  "stats": "APP 16, CON 13, DEX 12, SIZ 10, STR 9"',
      '}',
      '```',
      '',
      'Pronoun values: He/him · She/her · They/them',
      'Role values: King · Warlord · Player Knight · Knight · Lady · Esquire · Squire · Page · Baron · Priest · Druid · Steward · Merchant · Baby · Other',
      'Eligibility values: No · Yes · Widowed · Betrothed · Kinda?',
      'Faction values (use the id exactly): logres · salisbury · rydychan · silchester · cambria · cumbria · north · brittany · ireland · continent · saxon · independent · ladies_of_lake · fae · (omit field if unknown)',
    ].join('\n');

    Modal.open(`
      <div class="section-title" style="margin-bottom:12px;">Import NPC from Claude.ai</div>
      <div style="font-size:0.8rem;color:var(--ink-soft);margin-bottom:14px;line-height:1.5;">
        Generate an NPC in Claude.ai, then paste the JSON output below. The importer handles markdown code fences automatically.
      </div>
      <details style="margin-bottom:14px;background:var(--vellum-mid);border:1px solid var(--vellum-deep);border-radius:var(--radius);padding:8px 12px;">
        <summary style="font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.12em;cursor:pointer;user-select:none;color:var(--ink-mid);">📋 Prompt snippet for Claude.ai</summary>
        <div style="margin-top:10px;">
          <div style="font-size:0.75rem;color:var(--ink-soft);margin-bottom:8px;">Add this to your NPC generator conversation:</div>
          <pre id="claudeSnippet" style="font-size:0.67rem;background:var(--vellum-deep);padding:10px;border-radius:4px;white-space:pre-wrap;line-height:1.6;margin:0;color:var(--ink-mid);">${snippet.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
          <button class="btn btn-ghost" style="margin-top:8px;font-size:0.65rem;"
            onclick="navigator.clipboard.writeText(document.getElementById('claudeSnippet').textContent).then(()=>Toast.success('Copied to clipboard!'))">📋 Copy snippet</button>
        </div>
      </details>
      <textarea id="npcImportJson" class="edit-input edit-textarea"
        style="font-family:monospace;font-size:0.72rem;min-height:180px;margin-bottom:10px;"
        placeholder='Paste Claude.ai JSON here — code fences included, e.g. { &quot;name&quot;: &quot;Rhiannon&quot;, &quot;pronoun&quot;: &quot;She/her&quot;, ... }'></textarea>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <button class="btn btn-primary" onclick="Components._doImportNpc()">⬇ Import NPC</button>
        <button class="btn btn-ghost" style="font-size:0.72rem;" onclick="Components._importNpcFile()">📂 Load .json file…</button>
        <button class="btn btn-ghost" style="margin-left:auto;" onclick="Modal.close()">Cancel</button>
      </div>
    `, { wide: true });
  },

  _importNpcFile() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const ta = document.getElementById('npcImportJson');
        if (ta) { ta.value = ev.target.result; ta.focus(); }
      };
      reader.readAsText(file);
    };
    input.click();
  },

  _doImportNpc() {
    const raw = document.getElementById('npcImportJson')?.value?.trim();
    if (!raw) { Toast.error('Paste some JSON first'); return; }

    let data;
    try {
      // Extract JSON from markdown fences if present, else grab first {...} block
      let jsonStr = raw;
      const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      } else {
        const objMatch = raw.match(/\{[\s\S]*\}/);
        if (objMatch) jsonStr = objMatch[0];
      }
      data = JSON.parse(jsonStr);
      // Support array of one
      if (Array.isArray(data)) data = data[0];
    } catch(e) {
      Toast.error('Could not parse JSON — check for missing quotes or commas');
      return;
    }

    if (!data || !data.name || !String(data.name).trim()) {
      Toast.error('JSON must include a "name" field');
      return;
    }

    // Normalise pronoun (accepts She/her · female · f · she · etc.)
    const rawPronoun = String(data.pronoun || data.gender || data.sex || '').toLowerCase();
    const pronoun = rawPronoun.includes('she') || rawPronoun === 'female' || rawPronoun === 'f' ? 'She/her'
                  : rawPronoun.includes('they') || rawPronoun.includes('them')                  ? 'They/them'
                  : 'He/him';

    // Resolve birth year (year_born beats age)
    const yearBorn = parseInt(data.year_born || data.birth_year || data.yearBorn, 10) || null;
    const ageVal   = parseInt(data.age, 10) || null;
    const resolvedYear = yearBorn || (ageVal ? STORE.year - ageVal : null);

    // Merge traits into passions field if provided separately
    let passions = String(data.passions || '').trim();
    const traits = String(data.traits || '').trim();
    if (traits && passions) passions = passions + '\n' + traits;
    else if (traits)        passions = traits;

    const npcData = {
      status:         'Alive',
      name:           String(data.name).trim(),
      pronoun,
      role:           String(data.role || data.class || data.occupation || '').trim(),
      glory:          parseInt(data.glory, 10) || 0,
      year_born:      resolvedYear,
      year_died:      null,
      age:            resolvedYear ? null : ageVal,
      household:      String(data.household || data.house || data.family || '').trim(),
      manor:          String(data.manor || '').trim(),
      eligibility:    String(data.eligibility || 'No').trim(),
      dowry:          String(data.dowry || '').trim(),
      notes:          String(data.notes || data.background || data.description || '').trim(),
      passions,
      skills:         String(data.skills || '').trim(),
      stats:          String(data.stats || data.attributes || '').trim(),
      blessed:        !!data.blessed,
      blessed_note:   String(data.blessed_note || '').trim(),
      fate_touched:   !!(data.fate_touched || data.fateTouched),
      page_placed:    false,
      page_court:     String(data.page_court || '').trim(),
      training_path:  String(data.training_path || '').trim(),
      training_where: String(data.training_where || '').trim(),
      came_of_age:    !!data.came_of_age,
      retired:        false,
      treeX: null, treeY: null,
    };

    const id = STORE.addNpc(npcData);
    Modal.close();
    Toast.success(`${npcData.name} added to the roster`);
    APP.switchTab('roster');
    setTimeout(() => {
      TabRoster._selectedId = id;
      TabRoster.render();
      Components.openNpcCard(id);
    }, 60);
  },

  // ── Two-way birth year ↔ age sync ─────────────────────────────
  _syncFromYear() {
    const yEl = document.getElementById('ef-year-born');
    const aEl = document.getElementById('ef-age');
    if (!yEl || !aEl) return;
    const y = parseInt(yEl.value, 10);
    aEl.value = (!isNaN(y) && y > 0) ? STORE.year - y : '';
  },
  _syncFromAge() {
    const yEl = document.getElementById('ef-year-born');
    const aEl = document.getElementById('ef-age');
    if (!yEl || !aEl) return;
    const a = parseInt(aEl.value, 10);
    yEl.value = (!isNaN(a) && a > 0) ? STORE.year - a : '';
  },

  saveEditNpc(id) {
    const npc = STORE.getNpc(id);
    if (!npc) return;
    const g = id => document.getElementById(id);
    const changes = {
      name:         g('ef-name')?.value?.trim() || npc.name,
      role:         g('ef-role')?.value || npc.role,
      pronoun:      g('ef-pronoun')?.value || npc.pronoun,
      glory:        parseInt(g('ef-glory')?.value, 10) || 0,
      year_born:    parseInt(g('ef-year-born')?.value, 10) || null,
      age:          parseInt(g('ef-age')?.value, 10) || null,
      household:    g('ef-household')?.value || '',
      faction:      g('ef-faction')?.value || '',
      manor:        g('ef-manor-link')?.value?.trim() || g('ef-manor')?.value?.trim() || '',
      eligibility:  g('ef-eligibility')?.value || '',
      dowry:        g('ef-dowry')?.value?.trim() || '',
      notes:        g('ef-notes')?.value?.trim() || '',
      passions:     g('ef-passions')?.value?.trim() || '',
      skills:       g('ef-skills')?.value?.trim() || '',
      stats:        g('ef-stats')?.value?.trim() || '',
      blessed:        g('ef-blessed')?.checked ?? false,
      blessed_note:   g('ef-blessed-note')?.value?.trim() || '',
      fate_touched:     g('ef-fate-touched')?.checked ?? false,
      con:              parseInt(g('ef-con')?.value, 10) || 13,
      barren:           g('ef-barren')?.checked ?? false,
      came_of_age:      g('ef-came-of-age')?.checked ?? false,
      out_of_story:     g('ef-out-of-story')?.checked ?? false,
      out_of_story_note: g('ef-oos-note')?.value?.trim() || '',
      round_table:      g('ef-round-table')?.checked ?? false,
      page_court:         g('ef-page-court')?.value?.trim() || '',
      training_path:      g('ef-training-path')?.value?.trim() || '',
      statblock_template: g('ef-statblock-template')?.value?.trim() || '',
    };

    const trainingNpcId = g('ef-training-npc-id')?.value?.trim() || '';
    if (trainingNpcId) {
      // Linked to a real NPC — store ID, clear free text, auto-create relationship
      changes.training_npc_id = trainingNpcId;
      changes.training_where  = '';
      const path = changes.training_path.toLowerCase();
      const relType = path.includes('page') ? 'Page' : 'Squire';
      const alreadyLinked = STORE.relationships.some(r =>
        r.type === relType &&
        ((r.sourceId === trainingNpcId && r.targetId === id) ||
         (r.sourceId === id && r.targetId === trainingNpcId))
      );
      if (!alreadyLinked) {
        // sourceId = trainer/knight, targetId = squire/page
        STORE.addRelationship(trainingNpcId, id, relType, '');
      }
    } else {
      // Free text — clear any previously linked NPC
      changes.training_npc_id = '';
      changes.training_where  = g('ef-training-where')?.value?.trim() || '';
    }

    STORE.updateNpc(id, changes);
    Toast.success('Saved');
    APP.refreshCurrentTab();
    this.openNpcCard(id);
  },

  openAddRelationship(id) {
    const allNpcs = STORE.allNpcs().filter(n => n.id !== id).sort((a,b) => a.name.localeCompare(b.name));
    const html = buildAddRelHtml(id);
    if (CardPopup.isOpen()) {
      CardPopup.open(html);
      initNpcSearch('rel-target-search-0', 'rel-target-0', allNpcs);
    } else {
      Modal.open(html, { onOpen: () => initNpcSearch('rel-target-search-0', 'rel-target-0', allNpcs) });
    }
  },

  addRelTarget(npcId) {
    const countEl = document.getElementById('rel-row-count');
    const idx = parseInt(countEl.value, 10);
    countEl.value = idx + 1;
    const list = document.getElementById('rel-targets-list');
    const row = document.createElement('div');
    row.className = 'rel-target-row';
    row.id = `rel-row-${idx}`;
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;';
    row.innerHTML = buildNpcSearchHtml(`rel-target-search-${idx}`, `rel-target-${idx}`, 'Search by name, role, manor…')
      + `<button class="btn btn-ghost" style="padding:3px 8px;flex-shrink:0;font-size:0.8rem;" onclick="this.closest('.rel-target-row').remove()" title="Remove">✕</button>`;
    list.appendChild(row);
    const allNpcs = STORE.allNpcs().filter(n => n.id !== npcId).sort((a,b) => a.name.localeCompare(b.name));
    initNpcSearch(`rel-target-search-${idx}`, `rel-target-${idx}`, allNpcs);
  },

  saveRelationship(sourceId) {
    const type  = document.getElementById('rel-type')?.value;
    let   notes = document.getElementById('rel-notes')?.value?.trim() || '';
    if (type === 'Bastard') {
      const bStatus = document.querySelector('input[name="rel-bastard-status"]:checked')?.value || 'Unacknowledged';
      notes = bStatus + (notes ? ` — ${notes}` : '');
    }
    const count = parseInt(document.getElementById('rel-row-count')?.value || '1', 10);

    // Collect all filled-in target IDs from the multi-row list
    const targetIds = [];
    for (let i = 0; i < count; i++) {
      const v = document.getElementById(`rel-target-${i}`)?.value;
      if (v) targetIds.push(v);
    }
    if (!targetIds.length) { Toast.error('Choose at least one person from the search results'); return; }

    // Enforce storage convention for directional types using year_born as heuristic.
    // Child/Bastard/Adopted Child → source=child (younger), target=parent (older)
    // Parent/Adoptive Parent      → source=parent (older),  target=child (younger)
    // Squire/Page                 → source=senior (older),  target=junior (younger)
    // Vassal                      → source=vassal (younger), target=liege (older)
    // Ward                        → source=ward (younger),  target=guardian (older)
    // Guardian                    → source=guardian (older), target=ward (younger)
    const childTypes  = new Set(['Child', 'Adopted Child', 'Bastard']);
    const parentTypes = new Set(['Parent', 'Adoptive Parent']);
    // senior-first: source should be the older NPC
    const seniorFirst = new Set(['Squire', 'Former Squire', 'Guardian']);
    // junior-first: source should be the younger NPC
    const juniorFirst = new Set(['Page', 'Vassal', 'Ward']);
    const srcNpc  = STORE.getNpc(sourceId);
    const srcBorn = srcNpc?.year_born ? parseInt(srcNpc.year_born, 10) : null;

    const added = [];
    const skipped = [];

    targetIds.forEach(targetId => {
      // Do the direction swap first so we get canonical source/target
      let finalSrc = sourceId, finalTgt = targetId;
      const tgtNpc  = STORE.getNpc(targetId);
      const tgtBorn = tgtNpc?.year_born ? parseInt(tgtNpc.year_born, 10) : null;
      if (srcBorn !== null && tgtBorn !== null && !isNaN(srcBorn) && !isNaN(tgtBorn)) {
        if (childTypes.has(type)  && srcBorn < tgtBorn) { finalSrc = targetId; finalTgt = sourceId; }
        if (parentTypes.has(type) && srcBorn > tgtBorn) { finalSrc = targetId; finalTgt = sourceId; }
        // Senior-first: source must be older — swap if source is younger
        if (seniorFirst.has(type) && srcBorn > tgtBorn) { finalSrc = targetId; finalTgt = sourceId; }
        // Junior-first: source must be younger — swap if source is older
        if (juniorFirst.has(type) && srcBorn < tgtBorn) { finalSrc = targetId; finalTgt = sourceId; }
      }

      // Duplicate check — catches re-adds from either NPC's card.
      // Also checks mirror types so that Child/Parent and Adopted Child/Adoptive Parent
      // pairs are treated as the same relationship regardless of which type the user chose.
      const TYPE_MIRRORS = {
        'Child':           'Parent',
        'Parent':          'Child',
        'Adopted Child':   'Adoptive Parent',
        'Adoptive Parent': 'Adopted Child',
        'Bastard':         'Parent',
      };
      const mirrorType = TYPE_MIRRORS[type] || null;
      const alreadyExists = STORE.relationships.some(r => {
        const typeMatch = r.type === type || (mirrorType && r.type === mirrorType);
        return typeMatch && (
          (r.sourceId === finalSrc && r.targetId === finalTgt) ||
          (r.sourceId === finalTgt && r.targetId === finalSrc)
        );
      });
      if (alreadyExists) {
        skipped.push(STORE.getNpc(targetId)?.name || targetId);
        return;
      }

      STORE.addRelationship(finalSrc, finalTgt, type, notes);
      added.push(targetId);
    });

    if (added.length) {
      Toast.success(added.length === 1 ? 'Relationship added' : `${added.length} relationships added`);
    }
    if (skipped.length) {
      Toast.show(`Already exists: ${skipped.join(', ')}`, 'error', 5000);
    }
    if (added.length) {
      APP.refreshCurrentTab();
      this.openNpcCard(sourceId);
    }
  },

  confirmKill(id) {
    const npc = STORE.getNpc(id);
    if (!npc) return;
    Modal.open(`
      <div style="min-width:340px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:12px;">Mark as Deceased — ${esc(npc.name)}</div>
        <div class="detail-field mb-8">
          <div class="detail-label">Year of Death</div>
          <input class="edit-input" id="kill-year" type="number" value="${STORE.year}">
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Cause / Notes</div>
          <input class="edit-input" id="kill-notes" placeholder="Died in battle at Bedegraine…">
        </div>
        <div class="btn-row">
          <button class="btn btn-danger" onclick="Components._doKill('${id}')">Confirm Death</button>
          <button class="btn btn-ghost" onclick="Components.openNpcCard('${id}')">Cancel</button>
        </div>
      </div>`);
  },

  _doKill(id) {
    const year  = parseInt(document.getElementById('kill-year')?.value, 10) || STORE.year;
    const notes = document.getElementById('kill-notes')?.value?.trim();
    const npc   = STORE.getNpc(id);
    STORE.killNpc(id, year, notes);
    Toast.success(`${npc?.name} moved to the Mausoleum`);
    Modal.close();
    APP.refreshCurrentTab();
  },

  confirmRestore(id) {
    const npc = STORE.getNpc(id);
    if (!npc) return;
    if (!confirm(`Restore ${npc.name} to the living roster?`)) return;
    STORE.restoreNpc(id);
    Toast.success('Restored to living roster');
    Modal.close();
    APP.refreshCurrentTab();
  },

  _confirmCameOfAge(id) {
    const npc = STORE.getNpc(id);
    if (!npc) return;
    STORE.updateNpc(id, { came_of_age: true });
    Toast.success(`${npc.name} marked as having come of age`);
    APP.refreshCurrentTab();
  },

  openEditRelationship(relId, npcId) {
    const rel = STORE.relationships.find(r => r.id === relId);
    if (!rel) return;
    const src = STORE.getNpc(rel.sourceId);
    const tgt = STORE.getNpc(rel.targetId);
    const typeOpts = RELATION_TYPES.map(t =>
      `<option value="${t}" ${t === rel.type ? 'selected' : ''}>${t}</option>`).join('');
    const isBastard    = rel.type === 'Bastard';
    const bStatus      = isBastard ? parseBastardStatus(rel.notes) : 'Unacknowledged';
    const strippedNotes = isBastard ? stripBastardStatus(rel.notes) : (rel.notes || '');
    const html = `
      <div style="min-width:340px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:12px;">Edit Relationship</div>
        <div style="font-size:0.9rem;margin-bottom:12px;color:var(--ink-soft);">${src?.name || '?'} ↔ ${tgt?.name || '?'}</div>
        <div class="detail-field mb-8">
          <div class="detail-label">Relationship Type</div>
          <select class="edit-input edit-select" id="erel-type"
            onchange="Components._toggleBastardOpts(this.value,'erel-bastard-opts')">${typeOpts}</select>
        </div>
        <div id="erel-bastard-opts" class="detail-field mb-8" ${isBastard ? '' : 'hidden'}>
          <div class="detail-label">Acknowledgement</div>
          <div style="display:flex;gap:16px;margin-top:4px;flex-wrap:wrap;">
            ${bastardStatusRadios('erel-bastard-status', bStatus)}
          </div>
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Notes</div>
          <input class="edit-input" id="erel-notes" value="${strippedNotes.replace(/"/g,'&quot;')}" placeholder="Optional notes">
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="Components.saveEditRelationship('${relId}','${npcId}')">Save</button>
          <button class="btn btn-ghost"   onclick="Components.openNpcCard('${npcId}')">Cancel</button>
          <button class="btn btn-danger"  style="margin-left:auto;" onclick="Components.deleteRelationship('${relId}','${npcId}')">Remove</button>
        </div>
      </div>`;
    // If we're in the tree (CardPopup is open), stay in CardPopup so the tree
    // underneath isn't destroyed and the NPC card doesn't end up buried beneath.
    if (CardPopup.isOpen()) CardPopup.open(html);
    else Modal.open(html);
  },

  saveEditRelationship(relId, npcId) {
    const type  = document.getElementById('erel-type')?.value;
    let   notes = document.getElementById('erel-notes')?.value?.trim() || '';
    if (type === 'Bastard') {
      const bStatus = document.querySelector('input[name="erel-bastard-status"]:checked')?.value || 'Unacknowledged';
      notes = bStatus + (notes ? ` — ${notes}` : '');
    }
    STORE.updateRelationship(relId, { type, notes });
    Toast.success('Relationship updated');
    APP.refreshCurrentTab();
    this.openNpcCard(npcId);
  },

  deleteRelationship(relId, npcId) {
    if (!confirm('Remove this relationship?')) return;
    STORE.removeRelationship(relId);
    Toast.success('Relationship removed');
    APP.refreshCurrentTab();
    this.openNpcCard(npcId);
  },

  confirmDeleteNpc(id) {
    const npc = STORE.getNpc(id);
    if (!npc) return;
    if (!confirm(`Permanently delete ${npc.name}? This cannot be undone.`)) return;
    STORE.deleteNpc(id);
    Toast.success('NPC deleted');
    Modal.close();
    APP.refreshCurrentTab();
  },

  saveNewNpc() {
    const g = id => document.getElementById(id);
    const name = g('ef-name')?.value?.trim();
    if (!name) { Toast.error('Name is required'); return; }
    const npc = {
      status:       'Alive',
      name,
      role:         g('ef-role')?.value || '',
      pronoun:      g('ef-pronoun')?.value || '',
      glory:        parseInt(g('ef-glory')?.value, 10) || 0,
      year_born:    parseInt(g('ef-year-born')?.value, 10) || null,
      age:          parseInt(g('ef-age')?.value, 10) || null,
      household:    g('ef-household')?.value || '',
      faction:      g('ef-faction')?.value || '',
      manor:        g('ef-manor-link')?.value?.trim() || g('ef-manor')?.value?.trim() || '',
      eligibility:  g('ef-eligibility')?.value || '',
      dowry:        g('ef-dowry')?.value?.trim() || '',
      notes:        g('ef-notes')?.value?.trim() || '',
      passions:     g('ef-passions')?.value?.trim() || '',
      skills:       g('ef-skills')?.value?.trim() || '',
      stats:        g('ef-stats')?.value?.trim() || '',
      blessed:        g('ef-blessed')?.checked ?? false,
      blessed_note:   g('ef-blessed-note')?.value?.trim() || '',
      fate_touched:     g('ef-fate-touched')?.checked ?? false,
      con:              parseInt(g('ef-con')?.value, 10) || 13,
      barren:           g('ef-barren')?.checked ?? false,
      came_of_age:      g('ef-came-of-age')?.checked ?? false,
      out_of_story:     g('ef-out-of-story')?.checked ?? false,
      out_of_story_note: g('ef-oos-note')?.value?.trim() || '',
      round_table:      g('ef-round-table')?.checked ?? false,
      page_court:         g('ef-page-court')?.value?.trim() || '',
      training_path:      g('ef-training-path')?.value?.trim() || '',
      statblock_template: g('ef-statblock-template')?.value?.trim() || '',
    };
    const trainingNpcId = g('ef-training-npc-id')?.value?.trim() || '';
    if (trainingNpcId) {
      npc.training_npc_id = trainingNpcId;
      npc.training_where  = '';
    } else {
      npc.training_npc_id = '';
      npc.training_where  = g('ef-training-where')?.value?.trim() || '';
    }
    const id = STORE.addNpc(npc);
    if (trainingNpcId) {
      const path = npc.training_path.toLowerCase();
      const relType = path.includes('page') ? 'Page' : 'Squire';
      const alreadyLinked = STORE.relationships.some(r =>
        r.type === relType &&
        ((r.sourceId === trainingNpcId && r.targetId === id) ||
         (r.sourceId === id && r.targetId === trainingNpcId))
      );
      if (!alreadyLinked) STORE.addRelationship(trainingNpcId, id, relType, '');
    }
    Toast.success(`${name} added to the roster`);
    APP.refreshCurrentTab();
    this.openNpcCard(id);
  },

  openAddNpc() {
    const template = {
      status: 'Alive', role: '', name: '', glory: 0,
      year_born: null, year_died: null, age: null,
      pronoun: 'He/him', household: '', manor: '',
      eligibility: 'No', dowry: '', notes: '',
      passions: '', skills: '', stats: '',
      statblock_template: '',
      blessed: false, blessed_note: '', fate_touched: false,
      page_placed: false, page_court: '',
      training_path: '', training_where: '',
      came_of_age: false, retired: false,
      treeX: null, treeY: null,
    };
    const allNpcs = STORE.allNpcs().sort((a, b) => a.name.localeCompare(b.name));
    Modal.open(buildNpcEditHtml(template, true), { wide: true, onOpen: () => {
      initNpcSearch('ef-training-npc-search', 'ef-training-npc-id', allNpcs);
    }});
  },

  // ── STAT BLOCK TEMPLATE PICKER ────────────────────────────

  openStatblockPicker() {
    const existing = document.getElementById('ef-statblock-template')?.value?.trim();
    if (existing) {
      // Warn before showing the picker — confirm step happens here
      CardPopup.open(`
        <div style="min-width:320px;padding:4px 0;">
          <div style="font-family:var(--font-display);font-size:0.95rem;margin-bottom:10px;">📋 Replace Template?</div>
          <div style="font-size:0.82rem;color:var(--ink-soft);margin-bottom:18px;">
            This NPC already has <strong>${esc(existing)}</strong> attached.<br><br>
            Selecting a new template will overwrite the Stats, Passions &amp; Traits, and Skills fields.<br>
            <span style="color:var(--verdigris-mid);">Notes are never touched.</span>
          </div>
          <div class="btn-row">
            <button class="btn btn-verdigris" onclick="Components._showStatblockGrid()">Browse Templates</button>
            <button class="btn btn-ghost" onclick="CardPopup.closeTop()">Cancel</button>
          </div>
        </div>`);
    } else {
      this._showStatblockGrid();
    }
  },

  _showStatblockGrid() {
    const categories = [...new Set(STAT_BLOCK_TEMPLATES.map(t => t.category))];
    const gridHtml = categories.map(cat => {
      const templates = STAT_BLOCK_TEMPLATES.filter(t => t.category === cat);
      const cards = templates.map(t => `
        <div class="statblock-card" onclick="Components._applyStatblockTemplate('${esc(t.name)}')">
          <div style="font-family:var(--font-display);font-size:0.85rem;color:var(--ink);margin-bottom:3px;">${esc(t.name)}</div>
          <div style="font-size:0.72rem;color:var(--ink-soft);font-style:italic;margin-bottom:6px;">${esc(t.description)}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${t.glory !== '—' ? `<span style="font-family:var(--font-heading);font-size:0.55rem;color:var(--gold);background:rgba(184,134,11,0.1);border:1px solid rgba(184,134,11,0.3);padding:1px 6px;border-radius:8px;">Glory ${t.glory}</span>` : ''}
            <span style="font-family:var(--font-heading);font-size:0.55rem;color:var(--ink-soft);background:var(--vellum-deep);padding:1px 6px;border-radius:8px;">${esc(t.naturalAge)}</span>
            ${t.magicalTalents ? `<span style="font-family:var(--font-heading);font-size:0.55rem;color:#4a8a5a;background:rgba(74,138,90,0.12);border:1px solid rgba(74,138,90,0.3);padding:1px 6px;border-radius:8px;">✦ Magical</span>` : ''}
          </div>
        </div>`).join('');
      return `
        <div style="margin-bottom:16px;">
          <div style="font-family:var(--font-heading);font-size:0.58rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid var(--vellum-deep);">${esc(cat)}</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;">${cards}</div>
        </div>`;
    }).join('');

    CardPopup.open(`
      <div style="min-width:480px;max-width:720px;">
        <div style="font-family:var(--font-display);font-size:1rem;margin-bottom:16px;">📋 Choose a Template</div>
        ${gridHtml}
        <div class="btn-row" style="margin-top:8px;">
          <button class="btn btn-ghost" onclick="CardPopup.closeTop()">Cancel</button>
        </div>
      </div>`);
  },

  _applyStatblockTemplate(name) {
    const t = STAT_BLOCK_TEMPLATES.find(x => x.name === name);
    if (!t) return;
    const g = id => document.getElementById(id);
    let skills = t.skills || '';
    if (t.magicalTalents) skills += (skills ? '\n' : '') + 'Magical Talents: ' + t.magicalTalents;
    if (g('ef-stats'))    g('ef-stats').value    = t.stats    || '';
    if (g('ef-passions')) g('ef-passions').value = t.passions || '';
    if (g('ef-skills'))   g('ef-skills').value   = skills;
    if (g('ef-statblock-template')) g('ef-statblock-template').value = name;
    // Update the button label in the edit form
    const btn = document.querySelector('button[onclick="Components.openStatblockPicker()"]');
    if (btn) btn.textContent = `📋 Template: ${name} — Change`;
    CardPopup.closeTop();
    Toast.success(`Applied: ${name}`);
  },

  _toggleBastardOpts(type, divId) {
    const el = document.getElementById(divId);
    if (el) el.hidden = type !== 'Bastard';
  },

  // ── LIFE EVENTS ──────────────────────────────────────────────
  addLifeEvent(npcId) {
    const npc = STORE.getNpc(npcId);
    if (!npc) return;
    const seasons = ['spring','summer','autumn','winter'];
    Modal.open(`
      <div style="min-width:min(420px,90vw);">
        <div class="page-title" style="font-size:1rem;margin-bottom:16px;">Add Life Event — ${npc.name}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="detail-field">
            <div class="detail-label">Year</div>
            <input class="edit-input" id="lev-year" type="number" value="${STORE.year}">
          </div>
          <div class="detail-field">
            <div class="detail-label">Season</div>
            <select class="edit-input" id="lev-season">
              <option value="">—</option>
              ${seasons.map(s => `<option value="${s}">${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Event</div>
          <input class="edit-input" id="lev-title" placeholder="What happened?">
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Notes</div>
          <textarea class="edit-input" id="lev-notes" rows="3" placeholder="Details…" style="resize:vertical;"></textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="Components.saveNewLifeEvent('${npcId}')">Save</button>
          <button class="btn btn-ghost"   onclick="Modal.close()">Cancel</button>
        </div>
      </div>`);
  },

  saveNewLifeEvent(npcId) {
    const year     = parseInt(document.getElementById('lev-year')?.value, 10) || STORE.year;
    const season   = document.getElementById('lev-season')?.value || '';
    const title    = document.getElementById('lev-title')?.value?.trim() || '';
    const userNotes= document.getElementById('lev-notes')?.value?.trim() || '';
    if (!title) { Toast.show('Enter an event name.', 'warning'); return; }
    STORE.addSoloEvent(npcId, { year, season, title, mechDesc: '', flavorText: null, userNotes });
    Toast.success('Event added.');
    this.openNpcCard(npcId);
  },

  editSoloEvent(npcId, eventId) {
    const npc = STORE.getNpc(npcId);
    if (!npc || !npc.soloEvents) return;
    const ev = npc.soloEvents.find(e => e.id === eventId);
    if (!ev) return;
    const seasons = ['spring','summer','autumn','winter'];
    Modal.open(`
      <div style="min-width:min(480px,90vw);">
        <div class="page-title" style="font-size:1rem;margin-bottom:16px;">Edit Life Event</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
          <div class="detail-field">
            <div class="detail-label">Year</div>
            <input class="edit-input" id="sev-year" type="number" value="${ev.year || STORE.year}">
          </div>
          <div class="detail-field">
            <div class="detail-label">Season</div>
            <select class="edit-input" id="sev-season">
              ${seasons.map(s => `<option value="${s}" ${ev.season===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Event Title</div>
          <input class="edit-input" id="sev-title" value="${(ev.title||'').replace(/"/g,'&quot;')}">
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Mechanical Outcome</div>
          <textarea class="edit-input" id="sev-mech" rows="2" style="resize:vertical;">${ev.mechDesc||''}</textarea>
        </div>
        <div class="detail-field mb-8">
          <div class="detail-label">Notes</div>
          <textarea class="edit-input" id="sev-notes" rows="3" placeholder="Personal notes about this event…" style="resize:vertical;">${ev.userNotes||''}</textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary"  onclick="Components.saveSoloEventEdit('${npcId}','${eventId}')">Save</button>
          <button class="btn btn-ghost"    onclick="Modal.close()">Cancel</button>
          <button class="btn btn-danger"   style="margin-left:auto;" onclick="Components.deleteSoloEvent('${npcId}','${eventId}')">Delete</button>
        </div>
      </div>`);
  },

  saveSoloEventEdit(npcId, eventId) {
    const year    = parseInt(document.getElementById('sev-year')?.value, 10) || STORE.year;
    const season  = document.getElementById('sev-season')?.value || 'summer';
    const title   = document.getElementById('sev-title')?.value?.trim() || '';
    const mechDesc= document.getElementById('sev-mech')?.value?.trim() || '';
    const userNotes = document.getElementById('sev-notes')?.value?.trim() || '';
    STORE.updateSoloEvent(npcId, eventId, { year, season, title, mechDesc, userNotes });
    Toast.success('Event updated.');
    this.openNpcCard(npcId);
  },

  deleteSoloEvent(npcId, eventId) {
    if (!confirm('Delete this solo event from the chronicle?')) return;
    STORE.deleteSoloEvent(npcId, eventId);
    Toast.show('Event deleted.', 'success');
    this.openNpcCard(npcId);
  },

  promptChronicleEvent(npcId, eventId) {
    const npc = STORE.getNpc(npcId);
    if (!npc) return;
    const ev = (npc.soloEvents || []).find(e => e.id === eventId);
    if (!ev) return;
    const year = ev.year || STORE.year;
    const key  = String(year);

    // Duplicate check — look for this exact event ID in the chronicle
    const entries = (STORE.chronicle && STORE.chronicle[key]) || [];
    const allEntries = Object.values(STORE.chronicle || {}).flat();
    const alreadyPenned = allEntries.some(e => e.sourceEventId === eventId);

    if (alreadyPenned) {
      Modal.open(`
        <div style="max-width:400px;text-align:center;padding:8px 0;">
          <div style="font-size:2rem;margin-bottom:12px;">📜</div>
          <p style="font-family:var(--font-body,'EB Garamond',serif);font-size:1rem;line-height:1.6;font-style:italic;color:var(--ink);">
            This tale hath already been penned in the annals of Logres for the year ${year} AD.
            The chronicler's quill is still. Seek not to write what is already writ.
          </p>
          <button class="btn btn-ghost" style="margin-top:16px;" onclick="Modal.close()">So be it</button>
        </div>`);
      return;
    }

    // Pre-fill: knight name + flavor text if available, else title + mechDesc
    const prefill = ev.flavorText
      ? `${npc.name} — ${ev.flavorText}`
      : `${npc.name} — ${ev.title || ''}${ev.mechDesc ? ': ' + ev.mechDesc : ''}`;

    Modal.open(`
      <div style="min-width:340px;max-width:520px;">
        <div class="modal-header">
          <h2 style="margin:0;font-size:1rem;font-family:var(--font-heading,'Cinzel',serif);">📜 Chronicle — ${esc(npc.name)}, ${year} AD</h2>
        </div>
        <p style="font-size:0.82rem;color:var(--ink-soft);margin:8px 0 12px;line-height:1.5;">
          Edit this entry before committing it to the Chronicle of Logres.
        </p>
        <textarea id="npc-chron-text" class="edit-input" rows="4"
          style="width:100%;resize:vertical;font-family:var(--font-body,'EB Garamond',serif);font-size:0.9rem;line-height:1.5;"
        >${esc(prefill)}</textarea>
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" onclick="Components._commitNpcChronicle(${year},'${esc(eventId)}')">Commit to Chronicle</button>
        </div>
      </div>`);
  },

  promptChronicleNpc(npcId) {
    const npc  = STORE.getNpc(npcId);
    if (!npc) return;
    const year = STORE.year;
    const key  = String(year);

    // Duplicate check — has this NPC's name already been recorded this year?
    const entries = (STORE.chronicle && STORE.chronicle[key]) || [];
    const nameStr = npc.name.toLowerCase();
    const alreadyPenned = entries.some(e => (e.text || '').toLowerCase().includes(nameStr));

    if (alreadyPenned) {
      Modal.open(`
        <div style="max-width:400px;text-align:center;padding:8px 0;">
          <div style="font-size:2rem;margin-bottom:12px;">📜</div>
          <p style="font-family:var(--font-body,'EB Garamond',serif);font-size:1rem;line-height:1.6;font-style:italic;color:var(--ink);">
            This tale hath already been penned in the annals of Logres for the year ${year} AD.
            The chronicler's quill is still. Seek not to write what is already writ.
          </p>
          <button class="btn btn-ghost" style="margin-top:16px;" onclick="Modal.close()">So be it</button>
        </div>`);
      return;
    }

    Modal.open(`
      <div style="min-width:340px;max-width:520px;">
        <div class="modal-header">
          <h2 style="margin:0;font-size:1rem;font-family:var(--font-heading,'Cinzel',serif);">📜 Chronicle — ${esc(npc.name)}, ${year} AD</h2>
        </div>
        <p style="font-size:0.82rem;color:var(--ink-soft);margin:8px 0 12px;line-height:1.5;">
          Record this tale in the Chronicle of Logres. Edit as you see fit before committing.
        </p>
        <textarea id="npc-chron-text" class="edit-input" rows="4"
          style="width:100%;resize:vertical;font-family:var(--font-body,'EB Garamond',serif);font-size:0.9rem;line-height:1.5;"
          placeholder="${esc(npc.name)} — "></textarea>
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" onclick="Components._commitNpcChronicle(${year})">Commit to Chronicle</button>
        </div>
      </div>`);
    // Pre-focus
    setTimeout(() => {
      const ta = document.getElementById('npc-chron-text');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }, 50);
  },

  _commitNpcChronicle(year, sourceEventId) {
    const text = document.getElementById('npc-chron-text')?.value?.trim();
    if (!text) return;
    if (!STORE.chronicle) STORE.chronicle = {};
    const key = String(year);
    if (!STORE.chronicle[key]) STORE.chronicle[key] = [];
    const entry = { id: 'ev-' + Date.now(), text, cat: 'personal', ts: Date.now() };
    if (sourceEventId) entry.sourceEventId = sourceEventId;
    STORE.chronicle[key].push(entry);
    STORE.save();
    Modal.close();
    Toast.success('Entry committed to the Chronicle of Logres.');
  },
};

// ── HARVEST BADGE HTML ────────────────────────────────────────
function harvestBadge(result) {
  if (!result) return '—';
  const cls = result.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '');
  return `<span class="harvest-badge ${cls}">${result}</span>`;
}

// ── NPC HOVER CARD ────────────────────────────────────────────
// Lightweight floating summary shown when mousing over any element
// with a data-npc-hover="npcId" attribute.
const HoverCard = {
  _el:      null,
  _current: null,   // id currently shown
  _timer:   null,

  init() {
    this._el = document.getElementById('npcHoverCard');
    if (!this._el) return;

    document.addEventListener('mouseover', e => {
      const target = e.target.closest('[data-npc-hover]');
      if (!target) { this._hide(); return; }
      const id = target.dataset.npcHover;
      if (id === this._current) return;
      clearTimeout(this._timer);
      this._timer = setTimeout(() => this._show(id, e.clientX, e.clientY), 180);
    });

    document.addEventListener('mousemove', e => {
      if (!this._current) return;
      this._positionAt(e.clientX, e.clientY);
    });

    document.addEventListener('mouseout', e => {
      const target = e.target.closest('[data-npc-hover]');
      if (!target) return;
      // Hide only if we actually left the hover element
      const related = e.relatedTarget;
      if (related && target.contains(related)) return;
      clearTimeout(this._timer);
      this._hide();
    });
  },

  _show(id, x, y) {
    const npc = STORE.getNpc(id);
    if (!npc || !this._el) return;
    this._current = id;
    this._el.innerHTML = this._buildContent(npc);
    this._el.hidden = false;
    // Force reflow then make visible
    this._el.getBoundingClientRect();
    this._positionAt(x, y);
    this._el.classList.add('visible');
  },

  _hide() {
    this._current = null;
    clearTimeout(this._timer);
    if (!this._el) return;
    this._el.classList.remove('visible');
    // Hide after transition
    setTimeout(() => {
      if (!this._current) { this._el.hidden = true; this._el.innerHTML = ''; }
    }, 130);
  },

  _positionAt(x, y) {
    if (!this._el) return;
    const GAP = 14;
    const W = this._el.offsetWidth  || 260;
    const H = this._el.offsetHeight || 120;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x + GAP;
    let top  = y + GAP;
    if (left + W > vw - 8) left = x - W - GAP;
    if (top  + H > vh - 8) top  = y - H - GAP;
    if (left < 8) left = 8;
    if (top  < 8) top  = 8;
    this._el.style.left = left + 'px';
    this._el.style.top  = top  + 'px';
  },

  _buildContent(npc) {
    const icon  = roleIcon(npc.role);
    const col   = npc.household ? hhColour(npc.household) : roleColour(npc.role);
    const isDead = npc.status === 'Dead';

    // Age
    const age = npc.year_born
      ? (isDead && npc.year_died
          ? `${npc.year_born} AD · aged ${npc.year_died - npc.year_born}`
          : `${npc.year_born} AD · age ${STORE.year - npc.year_born}`)
      : (npc.age ? `age ${npc.age}` : null);

    // Spouse
    const spRel = STORE.getRelationships(npc.id).find(r => r.type === 'Spouse');
    let spouseLine = null;
    if (spRel) {
      const spId  = spRel.sourceId === npc.id ? spRel.targetId : spRel.sourceId;
      const sp    = STORE.getNpc(spId);
      if (sp) spouseLine = sp.status === 'Dead' ? `† ${sp.name}` : sp.name;
    }

    // Glory
    const glory = npc.glory && npc.glory !== 0 ? npc.glory.toLocaleString() : null;

    // Notes preview
    const notes = npc.notes ? npc.notes.slice(0, 90) + (npc.notes.length > 90 ? '…' : '') : null;

    const pips = (npc.blessed ? ' <span class="blessed-pip" title="Blessed Birth" style="font-size:0.7rem;">✦</span>' : '')
               + (npc.fate_touched ? ' <span class="fate-pip" title="Fate-Touched" style="font-size:0.7rem;">◈</span>' : '');

    const hhTag = npc.household
      ? `<span class="nhc-hh" style="background:${col};">${hhIcon(npc.household)} ${npc.household}</span>`
      : '';

    const rolePronouns = [icon + ' ' + (npc.role || 'NPC'), npc.pronoun].filter(Boolean).join(' · ');

    const rows = [];
    if (age)       rows.push(`<div class="nhc-row"><span class="nhc-row-label">BORN</span><span>${age}</span></div>`);
    if (spouseLine)rows.push(`<div class="nhc-row"><span class="nhc-row-label">SPOUSE</span><span>${spouseLine}</span></div>`);
    if (glory)     rows.push(`<div class="nhc-row"><span class="nhc-row-label">GLORY</span><span>${glory}</span></div>`);

    return `
      ${isDead ? `<div class="nhc-deceased">† DECEASED${npc.year_died ? ' ' + npc.year_died + ' AD' : ''}</div>` : ''}
      <div class="nhc-name">${npc.name}${pips}</div>
      <div class="nhc-role" style="color:${col};">${rolePronouns}</div>
      ${hhTag}${npc.faction ? ' ' + factionTagHtml(npc.faction) : ''}
      ${rows.length ? `<hr class="nhc-divider">${rows.join('')}` : ''}
      ${notes ? `<hr class="nhc-divider"><div class="nhc-notes">${notes}</div>` : ''}
    `;
  },
};

// ── CONFLICT BADGE HTML ───────────────────────────────────────
function conflictBadge(conflict) {
  if (!conflict || conflict === 'No Result') return `<span class="conflict-badge none">None</span>`;
  const cls = conflict.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '');
  return `<span class="conflict-badge ${cls}">${conflict}</span>`;
}

// ── FORMAT LIBRA ──────────────────────────────────────────────
function fmtL(val) {
  if (val === undefined || val === null || val === '') return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  if (n === 0) return '0 L';
  return (n > 0 ? '+' : '') + n + ' L';
}
function fmtLPlain(val) {
  if (val === undefined || val === null || val === '') return '—';
  const n = parseFloat(val);
  return isNaN(n) ? '—' : n + ' L';
}
