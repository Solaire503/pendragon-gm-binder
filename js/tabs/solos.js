/* ══════════════════════════════════════════════════════════════
   TAB: SOLOS  (sub-tab of Winter Phase)
   Book of Solos homebrew for Pendragon 6e
   Requires globals: STORE, Toast, Modal, TabWinter
══════════════════════════════════════════════════════════════ */

const TabSolos = {

  // ── STATE ─────────────────────────────────────────────────
  _ledger:    [],          // cards, newest first
  _knightIds: [],          // selected knight IDs
  _tier:      'I',         // 'I' | 'II'
  _wed:       'unwed',     // 'wed' | 'unwed'
  _season:    'summer',    // 'summer' | 'winter'
  _kinSize:   'normal',    // 'small' | 'normal' | 'large'
  _rollingYear: null,      // null = use STORE.year; set when user edits the input
  _cardCtr:   0,

  // ── DICE HELPERS ──────────────────────────────────────────
  _rollD20()       { return Math.floor(Math.random() * 20) + 1; },
  _rollD6()        { return Math.floor(Math.random() * 6)  + 1; },
  _rollD6x(n)      { let t = 0; for (let i = 0; i < n; i++) t += this._rollD6(); return t; },
  _rollDie(sides)  { return Math.floor(Math.random() * sides) + 1; },

  // ── KNIGHT LIST ───────────────────────────────────────────
  _getKnights() {
    return STORE.living.filter(n => {
      const r = (n.role || '').toLowerCase();
      return r.includes('knight') || r.includes('player');
    }).sort((a, b) => a.name.localeCompare(b.name));
  },

  _isLanded(npc) {
    if (!npc) return false;
    const r = (npc.role || '').toLowerCase();
    return r.includes('landed') || r.includes('lord');
  },

  _isKnight(npc) {
    if (!npc) return false;
    const r = (npc.role || '').toLowerCase();
    return r.includes('knight');
  },

  // ── RENDER ────────────────────────────────────────────────
  render() {
    const panel = document.getElementById('solosPanel');
    if (!panel) return;

    const pillsHtml = this._knightIds.map(id => {
      const npc = STORE.getNpc(id);
      if (!npc) return '';
      const hasNote = !!(npc.personalityNote && npc.personalityNote.trim());
      return `<span class="solos-knight-pill">` +
          `<span class="solos-pill-name" ` +
            `onclick="Components.openNpcCard('${id}')" ` +
            `onmouseenter="TabSolos._showPillTooltip(event,'${id}')" ` +
            `onmouseleave="TabSolos._hidePillTooltip()" ` +
            `title="Click to open full card">` +
            `${esc(npc.name)}` +
          `</span>` +
          `<button class="solos-pill-trait${hasNote?' has-note':''}" onclick="TabSolos._editKnightNote('${id}')" title="${hasNote ? 'Edit personality note' : 'Add personality note'}">✎</button>` +
          `<button class="solos-pill-remove" onclick="TabSolos._removeKnight('${id}')" title="Remove">×</button>` +
        `</span>`;
    }).join('');

    panel.innerHTML = `
      <div class="solos-layout">
        <div class="solos-controls">
          <!-- Shared: Knights + Marital Status + Year -->
          <div class="solos-shared-row">
            <div class="solos-field solos-knight-field">
              <label class="solos-label">Knights</label>
              <div class="npc-search-wrap" id="solosKnightSearch-wrap">
                <input class="edit-input npc-search-input" id="solosKnightSearch" autocomplete="off" placeholder="Search by name…">
                <div class="npc-search-results" id="solosKnightSearch-results" style="display:none;"></div>
              </div>
              ${pillsHtml ? `<div class="solos-knight-pills">${pillsHtml}</div>` : ''}
            </div>
            <div class="solos-field">
              <label class="solos-label">Status</label>
              <div class="solos-toggle-group">
                <button class="solos-toggle${this._wed==='wed'?' active':''}" onclick="TabSolos._setWed('wed')">Wed</button>
                <button class="solos-toggle${this._wed==='unwed'?' active':''}" onclick="TabSolos._setWed('unwed')">Unwed</button>
              </div>
            </div>
            <div class="solos-field">
              <label class="solos-label">Year</label>
              <input class="solos-year-input" id="solosYear" type="number"
                value="${this._rollingYear ?? STORE.year}"
                min="400" max="700"
                oninput="TabSolos._rollingYear = parseInt(this.value,10) || null">
            </div>
          </div>
          <!-- Three roll-type action blocks -->
          <div class="solos-action-blocks">
            <div class="solos-action-block">
              <div class="solos-action-title">📅 Yearly Event</div>
              <div class="solos-action-sub">1d20 — Yearly Events table → sub-tables</div>
              <div class="solos-field">
                <label class="solos-label">Tier</label>
                <div class="solos-toggle-group">
                  <button class="solos-toggle${this._tier==='I'?' active':''}" onclick="TabSolos._setTier('I')">I — Named</button>
                  <button class="solos-toggle${this._tier==='II'?' active':''}" onclick="TabSolos._setTier('II')">II — Minor</button>
                </div>
              </div>
              <button class="btn btn-primary solos-cast-btn" onclick="TabSolos._castYearly()" ${!this._knightIds.length ? 'disabled' : ''}>
                Roll Yearly Event
              </button>
            </div>
            <div class="solos-action-block">
              <div class="solos-action-title">⚄ Solo Event</div>
              <div class="solos-action-sub">1d6 — Summer / Winter adventure chain</div>
              <div class="solos-field">
                <label class="solos-label">Season</label>
                <div class="solos-toggle-group">
                  <button class="solos-toggle${this._season==='summer'?' active':''}" onclick="TabSolos._setSeason('summer')">Summer</button>
                  <button class="solos-toggle${this._season==='winter'?' active':''}" onclick="TabSolos._setSeason('winter')">Winter</button>
                </div>
              </div>
              ${this._season==='winter' ? `<div class="solos-season-note">❄ +1£/rider · Horse: Frail · No stewardship or healing</div>` : ''}
              <button class="btn btn-primary solos-cast-btn" onclick="TabSolos._castSolo()" ${!this._knightIds.length ? 'disabled' : ''}>
                Roll Solo Event
              </button>
            </div>
            <div class="solos-action-block">
              <div class="solos-action-title">⚅ Kin Events</div>
              <div class="solos-action-sub">Frequency roll — kin table</div>
              <div class="solos-field">
                <label class="solos-label">Kin Size</label>
                <div class="solos-toggle-group">
                  <button class="solos-toggle${this._kinSize==='small'?' active':''}" onclick="TabSolos._setKinSize('small')">Small (&lt;15)</button>
                  <button class="solos-toggle${this._kinSize==='normal'?' active':''}" onclick="TabSolos._setKinSize('normal')">Normal</button>
                  <button class="solos-toggle${this._kinSize==='large'?' active':''}" onclick="TabSolos._setKinSize('large')">Large (&gt;25)</button>
                </div>
              </div>
              <button class="btn solos-kin-btn" onclick="TabSolos._castKinEvents()" ${!this._knightIds.length ? 'disabled' : ''}>
                Roll Kin Events
              </button>
            </div>
          </div>
        </div>
        <div class="solos-divider"></div>
        <div class="solos-ledger-header">
          <span class="solos-ledger-title">Results Ledger</span>
          ${this._ledger.length ? `<button class="btn btn-ghost solos-reset-btn" onclick="TabSolos._resetAll()">↺ Reset All</button>` : ''}
        </div>
        <div class="solos-ledger" id="solosLedger">
          ${this._ledger.length
            ? this._ledger.map(c => this._renderCard(c)).join('')
            : `<div class="solos-empty"><div class="solos-empty-icon">📜</div><div class="solos-empty-text">The ledger awaits the first casting of lots.</div></div>`
          }
        </div>
      </div>`;

    this._initKnightSearch();
  },

  // ── CONTROL HANDLERS ──────────────────────────────────────
  _initKnightSearch() {
    const input   = document.getElementById('solosKnightSearch');
    const results = document.getElementById('solosKnightSearch-results');
    if (!input || !results) return;

    const available = () => this._getKnights().filter(n => !this._knightIds.includes(n.id));

    const showResults = list => {
      if (!list.length) { results.style.display = 'none'; return; }
      results.innerHTML = list.slice(0, 12).map(n =>
        `<div class="npc-search-item" data-id="${n.id}">
          <span class="npc-search-name">${esc(n.name)}</span>
          ${n.role ? `<span class="npc-search-role">${esc(n.role)}</span>` : ''}
          ${n.household ? `<span class="npc-search-hh" style="color:${STORE.householdColour ? STORE.householdColour(n.household) : ''}">${STORE.householdIcon ? STORE.householdIcon(n.household) : ''}</span>` : ''}
        </div>`
      ).join('');
      results.style.display = '';
    };

    input.addEventListener('focus', () => {
      const q = input.value.toLowerCase().trim();
      showResults(q ? available().filter(n => n.name.toLowerCase().includes(q)) : available());
    });

    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      showResults(q ? available().filter(n => n.name.toLowerCase().includes(q)) : available());
    });

    results.addEventListener('mousedown', e => {
      const item = e.target.closest('.npc-search-item');
      if (!item) return;
      e.preventDefault();
      TabSolos._addKnight(item.dataset.id);
    });

    input.addEventListener('blur', () => {
      setTimeout(() => { results.style.display = 'none'; }, 150);
    });
  },

  _addKnight(id) {
    if (!id || this._knightIds.includes(id)) return;
    this._knightIds.push(id);
    this.render();
  },

  _removeKnight(id) {
    this._knightIds = this._knightIds.filter(x => x !== id);
    this.render();
  },

  _setTier(t)    { this._tier    = t; this.render(); },
  _setWed(w)     { this._wed     = w; this.render(); },
  _setSeason(s)  { this._season  = s; this.render(); },
  _setKinSize(k) { this._kinSize = k; this.render(); },

  // ── YEARLY EVENT ROLL ─────────────────────────────────────
  _castYearly() {
    if (!this._knightIds.length) return;
    const flavorJobs = [];

    this._knightIds.forEach(knightId => {
      const npc = STORE.getNpc(knightId);
      if (!npc) return;

      const id         = 'solo-' + (++this._cardCtr);
      const year       = this._rollingYear ?? STORE.year;
      const tier       = this._tier;
      const wed        = this._wed;
      const season     = this._season;
      const knightName = npc.name;
      const landed     = this._isLanded(npc);
      const isKnight   = this._isKnight(npc);

      let event, tableRolls;
      if (tier === 'II') {
        const yRoll = this._rollD20();
        event = this._resolveYearlyEventsTierII(yRoll);
        tableRolls = { yearly: yRoll };
      } else {
        const yRoll = this._rollD20();
        event = this._resolveYearlyEvents(yRoll, wed, knightName, isKnight, landed);
        tableRolls = { yearly: yRoll };
      }

      const card = {
        id, knightId, year, tier, wed, season,
        rollMode:      'yearly',
        tableRolls,
        eventType:     event.eventType,
        eventTitle:    event.title,
        mechDesc:      event.mechDesc,
        flavorText:    null,
        flavorLoading: tier === 'I',
        flags:         event.flags  || [],
        chainResults:  event.chainResults || [],
        state:         'fresh',
      };

      this._ledger.unshift(card);
      if (tier === 'I') flavorJobs.push({ cardId: id, knightName, wed, event, personalityNote: npc.personalityNote || '' });
    });

    this.render();

    // Fire flavor fetches after render so card elements exist in DOM
    flavorJobs.forEach(({ cardId, knightName, wed, event, personalityNote }) => {
      this._fetchFlavor(cardId, knightName, wed === 'wed', event.eventType, event.title, event.mechDesc, personalityNote);
    });
  },

  // ── SOLO EVENT ROLL (1d6 adventure chain) ─────────────────
  _castSolo() {
    if (!this._knightIds.length) return;
    const flavorJobs = [];

    this._knightIds.forEach(knightId => {
      const npc = STORE.getNpc(knightId);
      if (!npc) return;

      const id         = 'solo-' + (++this._cardCtr);
      const year       = this._rollingYear ?? STORE.year;
      const wed        = this._wed;
      const season     = this._season;
      const knightName = npc.name;
      const landed     = this._isLanded(npc);
      const isKnight   = this._isKnight(npc);

      const topD6      = this._rollD6();
      const event      = this._resolveTopLevel(topD6, wed, knightName, isKnight, landed);
      const tableRolls = { topD6, topChain: event.topChain || 'Unknown' };

      const card = {
        id, knightId, year, tier: 'I', wed, season,
        rollMode:      'solo',
        tableRolls,
        eventType:     event.eventType,
        eventTitle:    event.title,
        mechDesc:      event.mechDesc,
        flavorText:    null,
        flavorLoading: true,
        flags:         event.flags  || [],
        chainResults:  event.chainResults || [],
        state:         'fresh',
      };

      this._ledger.unshift(card);
      flavorJobs.push({ cardId: id, knightName, wed, event, personalityNote: npc.personalityNote || '' });
    });

    this.render();

    flavorJobs.forEach(({ cardId, knightName, wed, event, personalityNote }) => {
      this._fetchFlavor(cardId, knightName, wed === 'wed', event.eventType, event.title, event.mechDesc, personalityNote);
    });
  },

  // ── KIN EVENTS CAST ───────────────────────────────────────
  _castKinEvents() {
    if (!this._knightIds.length) return;

    this._knightIds.forEach(knightId => {
      const npc = STORE.getNpc(knightId);
      if (!npc) return;

      const year      = this._rollingYear ?? STORE.year;
      const isKnight  = this._isKnight(npc);
      const landed    = this._isLanded(npc);
      const kinSize   = this._kinSize;

      // Frequency roll: base d6 + modifiers
      let freqMod = 0;
      if (kinSize === 'normal') freqMod += 1;
      if (kinSize === 'large')  freqMod += 2;
      if (isKnight) freqMod += 5;
      if (landed)   freqMod += 5;
      const freqRoll = this._rollD6() + freqMod;

      let numEvents = 0;
      if (freqRoll >= 7) numEvents = 2;
      else if (freqRoll >= 5) numEvents = 1;

      if (numEvents === 0) {
        const id = 'solo-' + (++this._cardCtr);
        this._ledger.unshift({
          id, knightId, year, tier: this._tier, wed: this._wed, season: this._season,
          rollMode: 'kin',
          tableRolls: { yearly: freqRoll },
          eventType: 'Kin Event', eventTitle: 'Kin — Quiet Season',
          mechDesc: `Frequency roll: ${freqRoll} (modifier +${freqMod}) — no kin event this year.`,
          flavorText: null, flavorLoading: false, flags: [], chainResults: [], state: 'fresh',
        });
      } else {
        for (let i = 0; i < numEvents; i++) {
          const id = 'solo-' + (++this._cardCtr);
          const kinRoll = this._rollD20();
          const event   = this._tableKinEvent(kinRoll, isKnight, landed);
          this._ledger.unshift({
            id, knightId, year, tier: this._tier, wed: this._wed, season: this._season,
            rollMode: 'kin',
            tableRolls: { yearly: kinRoll },
            eventType: 'Kin Event', eventTitle: event.title,
            mechDesc: `Freq: ${freqRoll} (+${freqMod}) → ${numEvents} event(s). Kin roll: ${kinRoll}. ${event.mechDesc}`,
            flavorText: null, flavorLoading: false, flags: event.flags||[], chainResults: event.chainResults||[], state: 'fresh',
          });
        }
      }
    });

    this.render();
  },

  // ── TIER II RESOLUTION (simple) ───────────────────────────
  _resolveYearlyEventsTierII(roll) {
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    let cat, sentence;
    if (roll <= 5) {
      cat = 'Good Fortune';
      sentence = pick([
        'Fortune smiles briefly upon the knight — a small boon comes his way before winter closes in.',
        'The season turns in the knight\'s favour; a modest gain eases the household\'s burdens.',
        'Luck walks beside the knight this year — some petty windfall lifts his spirits considerably.',
        'An unexpected benefit finds the knight; the year closes better than it began.',
      ]);
    } else if (roll <= 7) {
      cat = 'Friend';
      sentence = pick([
        'A chance meeting on the road brings a useful acquaintance into the knight\'s life.',
        'A shared fire and honest words forge the beginning of a new alliance.',
        'Someone of worth takes note of the knight\'s deeds and offers their good regard.',
        'An unlikely friendship is struck — the bond may yet prove its worth.',
      ]);
    } else if (roll <= 12) {
      cat = 'Relations';
      sentence = pick([
        'Matters of the heart stir; the knight\'s household knows joy or quiet tension alike.',
        'The season brings domestic entanglement — love or strife, the year is not uneventful.',
        'A glance across the hall, a whispered word — affairs of the heart do not stand still.',
        'The hearth burns warm or cold this season; the knight\'s household is never quite as it was.',
      ]);
    } else if (roll === 13) {
      cat = 'Saga Event';
      sentence = pick([
        'An omen passes through the knight\'s dreams — its meaning grows clear only in hindsight.',
        'Something stirs in the world beyond the ordinary; the knight feels its distant weight.',
        'Fate marks this year quietly in the knight\'s saga; what it portends is not yet known.',
        'A sign — subtle but unmistakable — crosses the knight\'s path before the year is out.',
      ]);
    } else if (roll <= 15) {
      cat = 'Enemy';
      sentence = pick([
        'A cold glance exchanged at court lingers; someone nurses a new grievance against the knight.',
        'Old frictions harden into something more dangerous; a rival quietly notes the knight\'s name.',
        'Not all battles are fought with swords — a new enmity takes root in the season\'s soil.',
        'An insult given or received festers; the wound may not show yet, but it is there.',
      ]);
    } else {
      cat = 'Bad Fortune';
      sentence = pick([
        'Ill luck dogs the knight\'s steps — a minor loss or inconvenience mars the season.',
        'The season deals poorly with the knight; a setback arrives without warning.',
        'Fortune turns its back; something the knight relied upon is taken or diminished.',
        'A run of misfortune leaves the knight slightly worse off than he began the year.',
      ]);
    }
    return { eventType: cat, title: cat, mechDesc: sentence, flags: [], chainResults: [] };
  },

  // ── YEARLY EVENTS TABLE ───────────────────────────────────
  _resolveYearlyEvents(roll, wed, knightName, isKnight, landed) {
    // +5 for knights, +10 for landed knights (on Good Fortune & Bad Fortune)
    const baseRoll = roll;
    let adjRoll = roll;
    if (isKnight)  adjRoll += 5;
    if (landed)    adjRoll += 5; // stacks to +10 for landed

    let cat;
    if      (roll <= 5)  cat = 'Good Fortune';
    else if (roll <= 7)  cat = 'Friend';
    else if (roll <= 12) cat = 'Relations';
    else if (roll === 13) cat = 'Saga Event';
    else if (roll <= 15) cat = 'Enemy';
    else                  cat = 'Bad Fortune';

    let result;
    switch (cat) {
      case 'Good Fortune': result = this._tableGoodFortune(adjRoll); break;
      case 'Friend':       result = this._tableFriend(isKnight, landed); break;
      case 'Relations':    result = this._tableRelations(wed); break;
      case 'Saga Event':   result = this._tableSagaEvent(adjRoll); break;
      case 'Enemy':        result = this._tableEnemy(); break;
      case 'Bad Fortune':  result = this._tableBadFortune(adjRoll); break;
      default:             result = { title: cat, mechDesc: 'No result.', flags: [], chainResults: [] };
    }

    result.eventType = cat;
    return result;
  },

  // ── GOOD FORTUNE TABLE (34) ───────────────────────────────
  _tableGoodFortune(adjRoll) {
    // Cap at 20 for direct lookup; handle 13 special
    let r = Math.min(adjRoll, 20);
    // If base roll landed on 13, auto-reroll twice
    if (r === 13) {
      let r1, r2;
      do { r1 = this._rollD20(); } while (r1 === 13);
      do { r2 = this._rollD20(); } while (r2 === 13);
      const a = this._goodFortuneEntry(r1);
      const b = this._goodFortuneEntry(r2);
      return {
        title: 'Good Fortune — Double Roll (auto)',
        mechDesc: `[Roll 1: ${r1}] ${a.mechDesc}  |  [Roll 2: ${r2}] ${b.mechDesc}`,
        flags: [...(a.flags||[]), ...(b.flags||[])],
        chainResults: [...(a.chainResults||[]), ...(b.chainResults||[])],
      };
    }
    return this._goodFortuneEntry(r);
  },

  _goodFortuneEntry(r) {
    const roll = r <= 0 ? 1 : r > 20 ? 20 : r;
    const GF = [
      null, // 0 placeholder
      { t:'Small Windfall',          m:`Gain ${this._rollD6()}£ worth of goods.` },
      { t:'Courser Gifted',          m:'A fine courser is gifted to the knight.' },
      { t:'Chainmail Gifted',        m:'A suit of chainmail is presented as a gift.' },
      { t:'Trial of Valour',         m:'+1 Honor, +1 Valour checks at year end.' },
      { t:'Claim Inherited',         m:'A dormant manor claim surfaces — record for future play.' },
      { t:'Plunder Gained',          m:'Roll Loot (d6£ base).', flags:['loot'] },
      { t:'Household Healed',        m:'All Frail conditions in the household are cleared.' },
      { t:'Mentor Found — Courtly',  m:`Over the next ${this._rollD6x(2)} years gain +3 to a courtly skill.` },
      { t:'Master Found — Weapon',   m:`Over the next ${this._rollD6x(2)} years gain +3 to a weapon skill.` },
      { t:'New Skill Begins',        m:'Knight begins training a new skill of the GM\'s choice.' },
      { t:'Allowance Raised',        m:'+2£ per year added to income.' },
      { t:'Manor Gifted',            m:'A small manor is granted. Record and celebrate.' },
      { t:'Roll Twice (auto)',       m:'Auto-rerolled twice above.' },
      { t:'Toll Gift',               m:'+1£ per year from a road toll or market right.' },
      { t:'Luck from Liege',         m:'The liege bestows a favour — one reroll any time this year.' },
      { t:'Blessed Until Yule',      m:'+1 to all rolls until Yule.' },
      { t:'Wise Hermit',             m:'A hermit grants 6 trait checks of the knight\'s choice.' },
      { t:'Three Kin Events',        m:'Roll three kin events, keep the best outcome.' },
      { t:'New Passion Stirs',       m:'Knight develops a new Passion — GM and player choose together.' },
      { t:'Five Servants Gifted',    m:'Five loyal servants join the household.' },
    ];
    const entry = GF[Math.min(roll, 20)];
    if (!entry) return { title: 'Good Fortune', mechDesc: 'Good fortune smiles.', flags: [], chainResults: [] };
    return { title: entry.t, mechDesc: entry.m, flags: entry.flags || [], chainResults: [] };
  },

  // ── FRIEND TABLE (35) ─────────────────────────────────────
  _tableFriend(isKnight, landed) {
    let base = this._rollD6();
    if (isKnight) base += 2;
    if (landed)   base += 4;
    const r = Math.min(base, 10);
    const FR = [
      null,
      { t:'Skilled Cook',         m:'+1 to one stat (GM choice) from superb cuisine.' },
      { t:'Gossiping Maid',       m:'Gain a useful court rumour — GM reveals one secret.' },
      { t:'Named Rider',          m:'A loyal companion rider joins the household.' },
      { t:'Mentor — Courtly',     m:'Gain 3 skill points per year in courtly skills for the season.' },
      { t:'Mercenary',            m:'A mercenary owes three favours — track as resource.' },
      { t:'Companion',            m:'A deep bond companion is gained (table 27). Offer to log in STORE.', flags:['companion'] },
      { t:'Master Burgher',       m:'A wealthy burgher offers trade connections and discounts.' },
      { t:'Named Knight',         m:'A named knight offers open friendship — potential ally.' },
      { t:'Liege\'s Son',         m:'A political opportunity through the liege\'s heir.' },
      { t:'Neighbour Pact',       m:'A neighbouring lord offers mutual aid — log as relationship.' },
    ];
    const e = FR[Math.min(r, 10)] || FR[1];
    return { title: e.t, mechDesc: e.m, flags: e.flags || [], chainResults: [] };
  },

  // ── RELATIONS TABLE (36) ─────────────────────────────────
  _tableRelations(wed) {
    if (wed === 'wed') {
      // Roll [Chaste] or [Love Wife]
      const r = this._rollD20();
      let title, mechDesc, flags = [], chain = [];
      if (r === 20) {
        // Fumble
        const t = this._tableTragedy();
        title = 'Relations — Fumble → Tragedy';
        mechDesc = t.mechDesc;
        chain = [t];
      } else if (r >= 16) {
        // Fail
        const f = this._tableFlirt('wed');
        title = 'Relations — Fail → Flirt';
        mechDesc = f.mechDesc;
        flags = f.flags; chain = [f];
      } else if (r >= 6) {
        // Success
        const j = this._tableJoy();
        title = 'Relations — Success → Joy';
        mechDesc = j.mechDesc;
        chain = [j];
      } else {
        // Critical
        const b = this._tableBliss();
        title = 'Relations — Critical → Bliss';
        mechDesc = b.mechDesc;
        chain = [b];
      }
      return { title, mechDesc, flags, chainResults: chain };
    } else {
      // Unwed: Roll [Lustful]
      const r = this._rollD20();
      let title, mechDesc, flags = [], chain = [];
      if (r === 20) {
        const c = this._tableCourting();
        title = 'Relations — Fumble → Courting';
        mechDesc = c.mechDesc; chain = [c];
      } else if (r >= 16) {
        const w = this._tableWoo();
        title = 'Relations — Fail → Woo';
        mechDesc = w.mechDesc; chain = [w];
      } else if (r >= 6) {
        const f = this._tableFlirt('unwed');
        title = 'Relations — Success → Flirt';
        mechDesc = f.mechDesc; flags = f.flags; chain = [f];
      } else {
        const a = this._tableAffair('unwed');
        title = 'Relations — Critical → Affair';
        mechDesc = a.mechDesc; flags = a.flags; chain = [a];
      }
      return { title, mechDesc, flags, chainResults: chain };
    }
  },

  // ── SAGA EVENT TABLE (37) ────────────────────────────────
  _tableSagaEvent(adjRoll) {
    const r = Math.min(adjRoll, 30);
    const SAGA = [
      null,
      'The lord who knighted him shall die horribly — an omen of blood.',
      'A miracle accompanies his knighting — whispered of for years.',
      'Warning: an eye for an eye shall come to pass.',
      'Prediction: this knight shall own land before his end.',
      'Prediction: he shall lose all he owns.',
      'A child of his blood receives a fairy godmother\'s gift.',
      'A child of his blood receives a fairy godmother\'s curse.',
      'The knight carries the fairy sign — fate watches him closely.',
      'Warning: he shall betray his lord — the manner is unclear.',
      'A great passion will save his life at a critical moment.',
      'Warning: he must not fight this year, or rue it.',
      'His horse displays unnatural intelligence — a destrier with a soul.',
      'Make penance before Yule, or death follows.',
      'Prediction: go on pilgrimage before five years pass.',
      'Warning: watch the wife — something stirs behind her eyes.',
      'A sign from the divine marks him — clergy take notice.',
      'Warning: his son will die if ever he is knighted.',
      'His highest trait flips from defeat to victory in the next great battle.',
      'Prediction: he shall die alone, far from kin.',
      'An object of destiny enters his possession — record it.',
      'In the next war he shall fall — unless fate is defied.',
      'Trust in fate; do not struggle against the tide.',
      'His kin shall deny him in his hour of greatest need.',
      'His squire shall become a greater hero than the knight himself.',
      'A friend shall deny him thrice before sunrise.',
      'Ten years of peace lie ahead — if he keeps his sword sheathed.',
      'A future famine is foretold — prepare the larder now.',
      'He must build a chapel or an oath goes unfulfilled.',
      'The clergy flee his presence — a spiritual stain clings to him.',
      'His land becomes a place of pilgrimage — for ill or good.',
    ];
    const text = SAGA[Math.min(r, 30)] || SAGA[13];
    return { title: 'Saga Event', mechDesc: text, flags: ['saga-record'], chainResults: [] };
  },

  // ── ENEMY TABLE (38) — five sub-rolls ────────────────────
  _tableEnemy() {
    const who = this._rollD6();
    const power = this._rollD6();
    const where = this._rollD6();
    const whoAngry = this._rollD6();
    const howAngry = this._rollD6();

    const WHO = ['','Romantic rival','Ambition rival','Revenge seeker','Someone of slighted high passion','Family enemy/feud','Ex-friend, lover, or companion'];
    const POWER = ['','Servant or burgher','Lower station','Lower station','Equal station','Equal station','Higher station'];
    const WHERE = ['','Your own household','Liege\'s court','Liege\'s court','King\'s court','Foreign court','Barbarian court'];
    const WHO_ANGRY = ['','','','They hate you','They hate you','You hate each other','You hate each other'];
    const HOW_ANGRY = ['','Seeks your death — now','Seeks your death — at the right time','Open hate — will thwart you always','Hidden hate — plots for years','Backstabs only indirectly','Righteous animosity — openly hostile'];

    const desc = `Enemy arises: ${WHO[who]} | Power: ${POWER[power]} | Location: ${WHERE[where]} | ${WHO_ANGRY[whoAngry]||'You hate each other'} | ${HOW_ANGRY[howAngry]}`;
    return { title: 'Enemy Gained', mechDesc: desc, flags: ['record-enemy'], chainResults: [] };
  },

  // ── BAD FORTUNE TABLE (39) ───────────────────────────────
  _tableBadFortune(adjRoll) {
    const r = Math.min(adjRoll, 30);
    const BF = [
      null,
      { t:'Sword Lost',           m:'Roll Energetic or suffer Insult (table 13).', flags:['roll-tragedy'] },
      { t:'Gambling Loss',        m:`Lost ${this._rollD6x(2) * 10} denarii at dice or cards.` },
      { t:'Horses Ailing',        m:'All horses gain +2 Frail conditions.' },
      { t:'Skills Neglected',     m:`Lose ${this._rollD6()} skill points from a skill of GM choice.` },
      { t:'Friend Estranged',     m:'A valued friend grows distant — relationship strained.' },
      { t:'Debt Falls Due',       m:'Full maintenance cost falls due immediately.' },
      { t:'Household Sickness',   m:'All household members gain Frail +1.' },
      { t:'Accident — Scarred',   m:'-1 APP permanently.' },
      { t:'No Training',          m:'No skill progress possible this year.' },
      { t:'Disease',              m:'-1 CON permanently.' },
      { t:'Rumour or Lost Love',  m:'A damaging rumour spreads, or a relationship sours.' },
      { t:'Strength Sapped',      m:'-1 STR permanently.' },
      { t:'Cursed Until Yule',    m:'-1 to all rolls until Yule.' },
      { t:'Stores Ruined',        m:'All stored goods are halved.' },
      { t:'Emotional Blow',       m:'Roll on Stricken table (8).', flags:['stricken'] },
      { t:'Hurt in Accident',     m:'Roll on Hurt table (7).', flags:['hurt'] },
      { t:'Horse Lamed',          m:'Best horse is lamed — requires costly care or replacement.' },
      { t:'Heirloom Lost',        m:'A family heirloom has been misplaced or stolen.' },
      { t:'Horse Dies',           m:'Best horse dies this year.' },
      { t:'Companion Dies',       m:'A named companion or household member dies.' },
      { t:'Debt to Moneylender',  m:'A debt to a moneylender comes due with interest.' },
      { t:'Rusting Armour',       m:'Armour is rusted and needs refurbishment.' },
      { t:'All Horses Frail',     m:'All horses in the stable gain Frail.' },
      { t:'Pay or Lose Armour',   m:'Pay maintenance or lose a piece of armour.' },
      { t:'Pay or Lose Horse',    m:'Pay immediately or lose the best horse.' },
      { t:`Year\'s Loss`,         m:`Income reduced by ${this._rollD6()}£ this year.` },
      { t:'Fight or Pay',         m:'A challenge demands satisfaction — fight or pay 1d6£.' },
      { t:'Fortification Damaged',m:'A fortification on estate is damaged — must be repaired.' },
      { t:'Fire in Demesne',      m:'Fire damages demesne buildings — costly repairs needed.' },
      { t:'Blood Feud',           m:'A blood feud is declared against the knight\'s family.', flags:['record-enemy'] },
    ];
    const e = BF[Math.min(r, 30)] || BF[1];
    return { title: e.t, mechDesc: e.m, flags: e.flags || [], chainResults: [] };
  },

  // ── ROMANCE CHAIN ─────────────────────────────────────────

  _tableWoo() {
    // Roll [Loyalty][Honour][Courtesy]
    const r = this._rollD20();
    let t, m, flags = [], chain = [];
    if (r === 20) {
      const en = this._tableEnemy(); t = 'Woo — Fumble → Enemy'; m = en.mechDesc; flags = ['record-enemy']; chain = [en];
    } else if (r >= 16) {
      t = 'Woo — Lord\'s Query'; m = 'The lord inquires about marrying a commoner. Relations strained briefly.';
    } else if (r >= 11) {
      const c = this._tableCourting(); t = 'Woo — Brother\'s Test → Courting'; m = `Brother challenges to test worthiness (Challenge, table 28). ${c.mechDesc}`; chain = [c];
    } else {
      const c = this._tableCourting(); t = 'Woo — Deemed Worthy → Courting'; m = `Knight is deemed worthy. ${c.mechDesc}`; chain = [c];
    }
    return { title: t, mechDesc: m, flags, chainResults: chain };
  },

  _tableCourting() {
    // Lady status d20
    const sr = this._rollD20();
    let ladyStatus;
    if      (sr === 1)  ladyStatus = 'Commoner (named)';
    else if (sr <= 3)   ladyStatus = 'Lower station';
    else if (sr <= 6)   ladyStatus = 'Lower station (named)';
    else if (sr <= 10)  ladyStatus = 'Same station';
    else if (sr <= 14)  ladyStatus = 'Same station (named)';
    else if (sr <= 17)  ladyStatus = 'Higher station';
    else if (sr <= 19)  ladyStatus = 'Higher station (named)';
    else                ladyStatus = 'Real lady (named)';

    // Roll Flirt±App±Status, Romance±App±Status, Chaste
    const rollFlirt   = this._rollD20();
    const rollRomance = this._rollD20();
    const rollChaste  = this._rollD20();

    let outcome;
    const best = Math.min(rollFlirt, rollRomance, rollChaste);
    if (best === 20)          outcome = 'Fumble — courtship collapses in embarrassment.';
    else if (best >= 16)      outcome = 'Failure — lady is unimpressed; try again next season.';
    else if (best >= 6)       outcome = 'Success — lady shows interest; proceed to Deed (table 42).';
    else                      outcome = 'Critical — lady is enraptured; skip to Proposal (table 43).';

    return {
      title: `Courting (Lady: ${ladyStatus})`,
      mechDesc: `Flirt ${rollFlirt} · Romance ${rollRomance} · Chaste ${rollChaste} → ${outcome}`,
      flags: [], chainResults: [],
    };
  },

  _tableDeed() {
    const r = this._rollD6();
    const DEEDS = [
      null,
      'Prove worth in Tournament (table 25).',
      'Accept a Challenge (table 28).',
      'Pass three skill tests of the lady\'s choosing.',
      'Pass three skill tests of the lady\'s choosing.',
      'Roll Devotion — succeed to proceed.',
      `Gift the lady ${this._rollD6()}£ in fine presents.`,
    ];
    const r2 = this._rollD20();
    let outcome;
    if (r2 === 20)        outcome = 'Fumble → Dejection (table 47).';
    else if (r2 >= 16)    outcome = 'Failure → Dejection (table 47).';
    else                  outcome = 'Success → Proposal (table 43).';

    return {
      title: 'Deed of Courtship',
      mechDesc: `Deed: ${DEEDS[r]} Roll: ${r2} → ${outcome}`,
      flags: [], chainResults: [],
    };
  },

  _tableProposal() {
    const r = this._rollD20();
    let t, m;
    if (r === 20)      { t = 'Proposal — Fumble';        m = 'Cascade to Fumble table (6). Proposal fails badly.'; }
    else if (r >= 16)  { t = 'Proposal — Rejected';       m = 'She says no. Honour intact, heart bruised.'; }
    else if (r >= 11)  { t = 'Proposal — Try Again';      m = 'Undecided. Knight may try again next season.'; }
    else if (r >= 6)   { t = 'Proposal — Family Accepts'; m = 'The family agrees. Begin betrothal negotiations.'; }
    else               { t = 'Proposal — She Accepts';    m = 'She accepts for love. A joyous match.'; }
    return { title: t, mechDesc: m, flags: [], chainResults: [] };
  },

  _tableFlirt(wed) {
    const r = this._rollD20();
    let t, m, flags = [], chain = [];
    if (wed === 'wed') {
      if (r === 20)        { t = 'Flirt — Peasant Incident'; m = 'An embarrassing encounter with a peasant woman. Rumours fly.'; }
      else if (r >= 16)    { t = 'Flirt — Bastard Risk';     m = 'A brief dalliance; bastard risk looms.'; flags = ['bastard-possible']; }
      else if (r >= 6)     { const a = this._tableAffair('wed'); t = 'Flirt → Affair'; m = a.mechDesc; flags = a.flags; chain = [a]; }
      else                 { t = 'Flirt — Rich Widow';        m = 'A wealthy widow takes an interest; social opportunities arise.'; }
    } else {
      if (r === 20)        { t = 'Flirt — Insulted';          m = 'Knight is publicly rebuffed (table 13 — Insulted). Honour check.'; }
      else if (r >= 16)    { t = 'Flirt — Village Children';  m = `${this._rollD6() > 3 ? 2 : 1} children may exist in a village. Rumours possible.`; }
      else if (r >= 6)     { const a = this._tableAffair('unwed'); t = 'Flirt → Bastard Risk'; m = a.mechDesc; flags = a.flags; chain = [a]; }
      else {
        const subR = this._rollD6();
        if (subR <= 3)      { const a = this._tableAffair('unwed'); t = 'Flirt → Affair'; m = a.mechDesc; flags = a.flags; chain = [a]; }
        else if (subR <= 5) { const w = this._tableWoo();           t = 'Flirt → Woo';   m = w.mechDesc; chain = [w]; }
        else                { const c = this._tableCourting();      t = 'Flirt → Courting'; m = c.mechDesc; chain = [c]; }
      }
    }
    return { title: t, mechDesc: m, flags, chainResults: chain };
  },

  _tableJoy() {
    const r = this._rollD20();
    let t, m, flags = [];
    if (r === 20)      { t = 'Joy — Wife Blooms'; m = 'Wife gains +1 APP from happiness.'; }
    else if (r >= 16)  { t = 'Joy — Pregnancy';  m = 'A healthy pregnancy commences. Childbirth roll at year end.'; flags = ['childbirth-roll']; }
    else if (r >= 6)   { t = 'Joy — Love Grows'; m = 'Love Wife passion increases by +1 for the knight.'; }
    else               { const b = this._tableBliss(); t = 'Joy → Bliss'; m = b.mechDesc; }
    return { title: t, mechDesc: m, flags, chainResults: [] };
  },

  _tableAffair(wed) {
    const r = this._rollD20();
    let t, m, flags = [], chain = [];
    if (wed === 'wed') {
      if (r === 20)      { const en = this._tableEnemy(); t = 'Affair Wed — Caught → Enemy'; m = 'Caught red-handed. Enemy created (table 38).'; flags = ['record-enemy']; chain = [en]; }
      else if (r >= 16)  { t = 'Affair Wed — Caught → Tragedy'; m = 'Caught. Roll on Tragedy table (51).', flags = ['roll-tragedy']; }
      else if (r >= 6)   { t = 'Affair Wed — Discreet';         m = 'Discreet affair. Costs 500 Glory in gifts and discretion.'; }
      else               { t = 'Affair Wed — High Paramour';    m = 'A high-born paramour. Costs 1000 Glory; great social risk and reward.'; }
    } else {
      if (r === 20)      { t = 'Affair Unwed — Caught/Challenged';      m = 'Caught — face a challenge from her guardian.'; }
      else if (r >= 16)  { t = 'Affair Unwed — Challenged';             m = 'She or her family challenges the knight.'; }
      else if (r >= 6)   { t = 'Affair Unwed — Child Born';             m = 'She births a child. Costs 250 Glory. Bastard risk.'; flags = ['bastard-possible']; }
      else               { t = 'Affair Unwed — High Paramour';          m = 'High-born paramour. Costs 500 Glory. Bastard risk.'; flags = ['bastard-possible']; }
    }
    return { title: t, mechDesc: m, flags, chainResults: chain };
  },

  _tableBliss() {
    const r = this._rollDie(10);
    const BLISS = [
      null,
      'Happily married — a season of peace and contentment.',
      'Both knight and wife gain +3 Chaste.',
      `Wife\'s APP increases by ${this._rollD6()} from radiant happiness.`,
      'Five free servants gifted by the lady\'s family.',
      `A song is written about their love — worth 250 Glory in social prestige.`,
      'The last-born child is blessed.',
      `Wife gains ${this._rollD6x(2)} skill points across her accomplishments.`,
      'Heir rolls on Good Fortune table (34) this year.',
      'Three family rerolls may be stored for any future roll.',
      'Roll Love Wife passion — a moment of transcendent joy.',
    ];
    const extra = r <= 2 ? '+2' : '+4';
    return {
      title: `Bliss (${extra} modifier this season)`,
      mechDesc: BLISS[r],
      flags: [], chainResults: [],
    };
  },

  _tableDejection() {
    const r = this._rollD20();
    let t, m;
    if (r === 20)      { t = 'Dejection — Gain Hate'; m = 'Gain a Hate passion toward the lost lady or her kin.'; }
    else if (r >= 16)  { t = 'Dejection — Forget Her'; m = `Knight tries to forget. Bastard risk from reckless consolation.`; }
    else if (r >= 6)   { t = 'Dejection — Come Back'; m = 'She offers a second chance — the courtship may resume.'; }
    else               { t = 'Dejection — Fall in Love'; m = 'He falls for another — begin new romance chain.'; }
    return { title: t, mechDesc: m, flags: [], chainResults: [] };
  },

  _tableTragedy() {
    const r = this._rollD6();
    const T = [
      null,
      'She becomes a nun — the love is ended forever.',
      'Rumours spread: she is said to have a secret lover (table 50).',
      'Poison claims her life — foul play suspected.',
      'Love becomes hate — a fierce enemy is born.',
      'She runs away — destination unknown.',
      'Divorce proceedings begin (table 52).',
    ];
    return { title: 'Tragedy', mechDesc: T[r], flags: [], chainResults: [] };
  },

  // ── COMBAT / ACTIVITY CHAINS ─────────────────────────────

  _tableGeneric() {
    const r = this._rollD6();
    const G = [
      null,
      '3 skill checks, 3 trait checks, 3 passion checks.',
      '6 skill checks, 2 trait checks, 1 passion check.',
      `10 Glory income; 6 skill checks, 2 trait checks.`,
      `25 Glory income; 5 skill checks, 2 trait checks.`,
      `50 Glory income; 4 skill checks, 3 trait checks.`,
      `75 Glory income; 3 skill checks, 4 trait checks.`,
    ];
    return { title: 'Generic Adventure', mechDesc: G[r], flags: [], chainResults: [] };
  },

  _tableFumble() {
    // Three-level cascade
    const r1 = this._rollD6();
    const first = ['Common mistake — minor embarrassment.',
                   'Ordinary failure — nothing lost.',
                   'Comical failure — laughter at the knight\'s expense.',
                   'Pain — lose 1 HP.',
                   'Insulted (table 13). Solo ends in shame.',
                   'Roll again.'][r1 - 1];
    if (r1 === 6) {
      const r2 = this._rollD6();
      const second = ['End in shame — Modest check.',
                      'End in shame — Pious check.',
                      'End in shame — Vengeful trait rises.',
                      'End in shame — Honour check required.',
                      'End in shame — Arbitrary trait rises.',
                      'Roll again — cascade continues.'][r2 - 1];
      if (r2 === 6) {
        const r3 = this._rollD6();
        const third = ['Directed negative trait increases by 1.',
                       'Disheartened — lose 3 from a skill.',
                       'Misery — lose 1 from a Passion.',
                       'Aging roll required.',
                       'Loss of Honour −1.',
                       'Hurt (7) or Stricken (8) — GM choice.'][r3 - 1];
        return { title: 'Fumble Cascade', mechDesc: `${first} → ${second} → ${third}`, flags: [], chainResults: [] };
      }
      return { title: 'Fumble Cascade', mechDesc: `${first} → ${second}`, flags: [], chainResults: [] };
    }
    return { title: 'Fumble', mechDesc: first, flags: [], chainResults: [] };
  },

  _tableHurt() {
    const r = this._rollD6();
    const H = [null,'Major wound requiring care.','Scarred — 1d6 HP lost, −1 APP.','-1 DEX permanently.','-1 CON permanently.','-1 STR permanently.','Aging roll required.'];
    return { title: 'Hurt (table 7)', mechDesc: H[r], flags: [], chainResults: [] };
  },

  _tableStricken() {
    const r = this._rollD6();
    const S = [null,'−2 from a Passion.','-3 APP.','Re-roll highest trait with 3d6.','Insanity for 1d6 months.','Gain 1 in Lazy, Cruel, or Vengeful.','Aging roll required.'];
    return { title: 'Stricken (table 8)', mechDesc: S[r], flags: [], chainResults: [] };
  },

  _tableLoot() {
    const base = this._rollD6();
    const m = `Base loot: ${base}£ in goods.`;
    // LO-2: Extended loot block removed — base is a d6 (1-6) so base > 6 was unreachable.
    return { title: 'Loot', mechDesc: m, flags: [], chainResults: [] };
  },

  // ── TOP-LEVEL SUMMER/WINTER SOLO ROUTING (d6) ────────────
  _resolveTopLevel(d6Roll, wed, knightName, isKnight, landed) {
    let chain, result;
    switch (d6Roll) {
      case 1: chain = 'Generic';             result = this._tableGeneric();                          break;
      case 2: chain = 'Vassal Duty';         result = this._tableVassalDuty(isKnight, landed);       break;
      case 3: chain = 'Liege Court';         result = this._tableLiegeCourt(isKnight, landed);        break;
      case 4: chain = 'Adventure';           result = this._tableAdventure(isKnight, landed, wed);   break;
      case 5:
        if (wed === 'unwed') { chain = 'Love';     result = this._tableLove(wed);                    }
        else                 { chain = 'Questing'; result = this._tableQuesting(isKnight, landed);   }
        break;
      case 6:
      default:
        chain = 'Adventure (GM pick)';
        result = this._tableAdventure(isKnight, landed, wed);
        break;
    }
    result.topChain = chain;
    if (!result.eventType) result.eventType = chain;
    return result;
  },

  // ── VASSAL DUTY (1) — 1d6 (+2 knight, +4 landed) ────────
  _tableVassalDuty(isKnight, landed) {
    let base = this._rollD6();
    if (isKnight) base += 2;
    if (landed)   base += 4;
    const r = Math.min(base, 10);
    let title, mechDesc, flags = [], chain = [];
    switch (r) {
      case 1:  { const pass = this._rollD20() <= 10; const sub = pass ? this._tableBandits() : this._tableChore();   title = `Vassal Duty — ${pass?'Bandits Spotted':'Chore (Aware failed)'}`; mechDesc = sub.mechDesc; flags = sub.flags||[]; chain = [sub]; break; }
      case 2:  { const g = this._tableGeneric();   title = 'Vassal Duty — Serve a Knight';    mechDesc = g.mechDesc; chain = [g]; break; }
      case 3:  { const pass = this._rollD20() <= 10; const sub = pass ? this._tablePatrol() : this._tableChore();    title = `Vassal Duty — ${pass?'Patrol':'Chore (Horse failed)'}`; mechDesc = sub.mechDesc; chain = [sub]; break; }
      case 4:  { const g = this._tableGeneric(); const l = this._tableLoot(); title = 'Vassal Duty — Bout and Loot'; mechDesc = g.mechDesc; chain = [g, l]; break; }
      case 5:  { const pass = this._rollD20() <= 10; const sub = pass ? this._tableGarrison() : this._tableGeneric(); title = `Vassal Duty — ${pass?'Garrison':'Generic (Valor failed)'}`; mechDesc = sub.mechDesc; chain = [sub]; break; }
      case 6:  { const g = this._tableGeneric();   title = 'Vassal Duty — Guard Duty';         mechDesc = g.mechDesc; chain = [g]; break; }
      case 7:  { const c = this._tableConflict();  title = 'Vassal Duty — Conflict or Generic (GM choice)'; mechDesc = c.mechDesc; chain = [c]; break; }
      case 8:  { const g = this._tableGeneric();   title = 'Vassal Duty — Fight Barbarians';   mechDesc = g.mechDesc; chain = [g]; break; }
      case 9:  { const m = this._tableMuster();    title = 'Vassal Duty — Muster';             mechDesc = m.mechDesc; chain = [m]; break; }
      default: { const g = this._tableGeneric(); const en = this._tableEnemy(); title = 'Vassal Duty — Generic + Enemy'; mechDesc = g.mechDesc; flags = ['record-enemy']; chain = [g, en]; break; }
    }
    return { title, mechDesc, flags, chainResults: chain, eventType: 'Vassal Duty' };
  },

  // ── LIEGE COURT (2) — 1d6 (+2 knight, +4 landed) ────────
  _tableLiegeCourt(isKnight, landed) {
    let base = this._rollD6();
    if (isKnight) base += 2;
    if (landed)   base += 4;
    const r = Math.min(base, 10);
    let title, mechDesc, flags = [], chain = [];
    switch (r) {
      case 1:  { title = 'Liege Court — Courtly Training';          mechDesc = `Gain ${this._rollD6()} points in a courtly skill below 10.`; break; }
      case 2:  { const g = this._tableGeneric(); title = 'Liege Court — Help the Servants'; mechDesc = g.mechDesc; chain = [g]; break; }
      case 3:  { const pass = this._rollD20() <= 10; const sub = pass ? this._tableAmuse() : this._tableChore(); title = `Liege Court — ${pass?'Amuse':'Chore (Court failed)'}`; mechDesc = sub.mechDesc; chain = [sub]; break; }
      case 4:  { const g = this._tableGeneric(); title = 'Liege Court — Gift of Luck';       mechDesc = `${g.mechDesc} A boon of luck is bestowed by the lord.`; chain = [g]; break; }
      case 5:  { const pass = this._rollD20() <= 10; const sub = pass ? this._tableGuest() : this._tableGeneric(); title = `Liege Court — ${pass?'Guest of the Lord':'Generic (Lord test failed)'}`; mechDesc = sub.mechDesc; chain = [sub]; break; }
      case 6:  { const g = this._tableGeneric(); title = 'Liege Court — Entertain the Lord'; mechDesc = g.mechDesc; chain = [g]; break; }
      case 7:  { const a = this._tableAmuse(); title = 'Liege Court — Amuse or Garrison (GM choice)'; mechDesc = a.mechDesc; chain = [a]; break; }
      case 8:  { const g = this._tableGeneric(); title = 'Liege Court — Feast (no combat)';  mechDesc = `${g.mechDesc} No combat this event.`; chain = [g]; break; }
      case 9:  { const c = this._tableConflict(); title = 'Liege Court — Conflict or Patrol (GM choice)'; mechDesc = c.mechDesc; chain = [c]; break; }
      default: { const g = this._tableGeneric(); title = 'Liege Court — Demesne +1£';        mechDesc = `${g.mechDesc} Demesne income increases by 1£ this year.`; chain = [g]; break; }
    }
    return { title, mechDesc, flags, chainResults: chain, eventType: 'Liege Court' };
  },

  // ── ADVENTURE (3) — 1d6 (+2 knight, +4 landed) ───────────
  _tableAdventure(isKnight, landed, wed) {
    let base = this._rollD6();
    if (isKnight) base += 2;
    if (landed)   base += 4;
    const r = Math.min(base, 10);
    let title, mechDesc, flags = [], chain = [];
    switch (r) {
      case 1:  { const b = this._tableBandits(); title = 'Adventure — Bandits or Patrol (GM choice)'; mechDesc = b.mechDesc; flags = b.flags||[]; chain = [b]; break; }
      case 2:  { const g = this._tableGeneric(); title = 'Adventure — Helping a Knight'; mechDesc = g.mechDesc; chain = [g]; break; }
      case 3:  { const h = this._tableHideout(); title = 'Adventure — Hideout or Garrison (GM choice)'; mechDesc = h.mechDesc; chain = [h]; break; }
      case 4:  { const g = this._tableGeneric(); const rel = this._tableRelations(wed||'unwed'); title = 'Adventure — Duel + Relations'; mechDesc = g.mechDesc; flags = rel.flags||[]; chain = [g, rel]; break; }
      case 5:  { const pass = this._rollD20() <= 10; const sub = pass ? this._tableHunt() : this._tableGeneric(); title = `Adventure — ${pass?'Hunt':'Generic (Court test failed)'}`; mechDesc = sub.mechDesc; chain = [sub]; break; }
      case 6:  { const g = this._tableGeneric(); title = 'Adventure — Religious Trial'; mechDesc = `${g.mechDesc} A test of faith and conviction.`; chain = [g]; break; }
      case 7:  { const t = this._tableTournament(); title = 'Adventure — Liege\'s Tournament'; mechDesc = t.mechDesc; flags = t.flags||[]; chain = [t]; break; }
      case 8:  { const g = this._tableGeneric(); title = 'Adventure — Making it Right'; mechDesc = g.mechDesc; chain = [g]; break; }
      case 9:  { const q = this._tableQuesting(isKnight, landed); title = 'Adventure → Questing'; mechDesc = q.mechDesc; chain = [q]; break; }
      default: { const g = this._tableGeneric(); title = 'Adventure — Companion Opportunity'; mechDesc = g.mechDesc; flags = ['companion']; chain = [g]; break; }
    }
    return { title, mechDesc, flags, chainResults: chain, eventType: 'Adventure' };
  },

  // ── QUESTING (4) — 1d6 (+2 knight, +4 landed) ────────────
  _tableQuesting(isKnight, landed) {
    let base = this._rollD6();
    if (isKnight) base += 2;
    if (landed)   base += 4;
    const r = Math.min(base, 10);
    const QUESTS = [
      null,
      { t: 'Quest of Knighthood',   m: 'A quest to prove personal worth — valor and loyalty tested before any reward is given.' },
      { t: 'Quest for Guenevere',   m: 'Adventure in service of the Queen. Generic adventure + glory for the court.' },
      { t: 'Quest of Challenge',    m: 'A formal challenge must be answered. Resolve as Challenge (28).', f: ['challenge'] },
      { t: 'Quest + Good Fortune',  m: 'A quest that yields unexpected fortune alongside the adventure.' },
      { t: 'Quest of Chivalry',     m: 'The highest test of knightly virtue — Valor, Honor, and Mercy are all called upon.' },
      { t: 'Quest for the King',    m: 'Adventure in Arthur\'s name. Generic adventure + 25 Glory awarded.' },
      { t: 'Quest of Tournament',   m: 'A tournament quest — glory and prizes await the victorious knight.' },
      { t: 'Quest for Arthur',      m: 'A high-stakes charge directly from the King. Generic adventure + 100 Glory.' },
      { t: 'Quest of Victory',      m: 'A decisive quest — victory wins great renown and the notice of lords.' },
      { t: 'Quest for Arthur — Royal Commission', m: 'The king\'s greatest charge. Generic adventure + 500 Glory.' },
    ];
    const e = QUESTS[Math.min(r, 10)] || QUESTS[5];
    return { title: `Questing — ${e.t}`, mechDesc: e.m, flags: e.f||[], chainResults: [], eventType: 'Questing' };
  },

  // ── LOVE (10) ─────────────────────────────────────────────
  _tableLove(wed) {
    const r = this._rollD20();
    let title, mechDesc, flags = [], chain = [];
    if (wed === 'unwed') {
      if (r === 20)     { const g = this._tableGeneric(); const c = this._tableCourting(); title = 'Love — Fumble (−3) → Generic + Courting'; mechDesc = g.mechDesc; chain = [g, c]; }
      else if (r >= 16) { const g = this._tableGeneric(); const w = this._tableWoo(); title = 'Love — Fail (−3) → Generic + Woo'; mechDesc = g.mechDesc; chain = [g, w]; }
      else if (r >= 6)  { const g = this._tableGeneric(); const f = this._tableFlirt('unwed'); title = 'Love — Pass → Generic + Flirt'; mechDesc = g.mechDesc; flags = f.flags||[]; chain = [g, f]; }
      else              { const g = this._tableGeneric(); const a = this._tableAffair('unwed'); title = 'Love — Critical → Generic + Affair'; mechDesc = g.mechDesc; flags = a.flags||[]; chain = [g, a]; }
    } else {
      if (r === 20)     { const f = this._tableFumble(); const d = this._tableDejection(); title = 'Love Wed — Fumble + Dejection (−3)'; mechDesc = f.mechDesc; chain = [f, d]; }
      else if (r >= 16) { const g = this._tableGeneric(); const f = this._tableFlirt('wed'); title = 'Love Wed — Fail → Generic + Flirt (−3)'; mechDesc = g.mechDesc; flags = f.flags||[]; chain = [g, f]; }
      else if (r >= 11) { const g = this._tableGeneric(); const d = this._tableDeed(); title = 'Love Wed — Pass → Generic + Deed'; mechDesc = g.mechDesc; chain = [g, d]; }
      else              { const g = this._tableGeneric(); const p = this._tableProposal(); title = 'Love Wed — Critical → Generic + Proposal'; mechDesc = g.mechDesc; chain = [g, p]; }
    }
    return { title, mechDesc, flags, chainResults: chain, eventType: 'Love' };
  },

  // ── BANDITS (11) ──────────────────────────────────────────
  _tableBandits() {
    const r = this._rollD20();
    let title, mechDesc, flags = [], chain = [];
    if (r === 20)     { const f = this._tableFumble(); title = 'Bandits — Fumble'; mechDesc = f.mechDesc; chain = [f]; }
    else if (r >= 16) { const g = this._tableGeneric(); title = 'Bandits — Generic (escaped)'; mechDesc = `${g.mechDesc} The bandits escape uncaught.`; chain = [g]; }
    else if (r >= 6)  { const f = this._tableFight(); title = 'Bandits — Fight to Catch'; mechDesc = f.mechDesc; chain = [f]; }
    else              { const fi = this._tableFight(); const hi = this._tableHideout(); title = 'Bandits — Caught: Fight or Hideout (GM choice)'; mechDesc = `Fight: ${fi.mechDesc} | Hideout: ${hi.mechDesc}`; chain = [fi]; }
    return { title, mechDesc, flags, chainResults: chain, eventType: 'Bandits' };
  },

  // ── CHORE (12) ────────────────────────────────────────────
  _tableChore() {
    const r = this._rollD20();
    let title, mechDesc, chain = [];
    if (r === 20)     { const i = this._tableInsulted(); title = 'Chore — Fumble → Insulted'; mechDesc = i.mechDesc; chain = [i]; }
    else if (r >= 16) { title = 'Chore — Kept Away'; mechDesc = 'Kept from duty. Lazy +1.'; }
    else if (r >= 6)  { title = 'Chore — Humble Service'; mechDesc = 'Humble check. +1 in the rolled skill.'; }
    else              { title = 'Chore — Generic Duties'; mechDesc = '3 skill checks, 2 trait checks, 1 passion check. No glory.'; }
    return { title, mechDesc, flags: [], chainResults: chain, eventType: 'Chore' };
  },

  // ── INSULTED (13) ─────────────────────────────────────────
  _tableInsulted() {
    const r = this._rollD20();
    let title, mechDesc, flags = [], chain = [];
    if (r === 20)     { const f = this._tableFumble(); title = 'Insulted — Fumble Cascade'; mechDesc = f.mechDesc; chain = [f]; }
    else if (r >= 16) { title = 'Insulted — Honour Wounded'; mechDesc = '−3 Honour. [Proud] check or gain an Enemy.'; flags = ['record-enemy']; }
    else if (r >= 6)  { title = 'Insulted — Integrity Holds'; mechDesc = 'Honour check granted. Dignity maintained under pressure.'; }
    else              { const fr = this._tableFriend(false, false); title = 'Insulted — Gain Friend (Energetic check)'; mechDesc = fr.mechDesc; chain = [fr]; }
    return { title, mechDesc, flags, chainResults: chain, eventType: 'Insulted' };
  },

  // ── LOSS (14) ─────────────────────────────────────────────
  _tableLoss() {
    const r = this._rollD20();
    let title, mechDesc;
    if (r >= 16)      { title = 'Loss — Loyalty Suffers'; mechDesc = 'Loyalty Lord −1. A poor showing before the liege.'; }
    else if (r >= 11) { title = 'Loss — Skill Setback'; mechDesc = '−1 in one skill (GM choice). A humbling lesson.'; }
    else if (r >= 6)  { title = 'Loss — Damages Owed'; mechDesc = `Owe ${this._rollD6()}£ in damages. The law is satisfied.`; }
    else              { title = 'Loss — Forgiven'; mechDesc = '+25 Glory. Forgiveness freely given — a rare act of grace.'; }
    return { title, mechDesc, flags: [], chainResults: [], eventType: 'Loss' };
  },

  // ── CONFLICT (15) ─────────────────────────────────────────
  _tableConflict() {
    const r = this._rollD20();
    let title, mechDesc, chain = [];
    if (r === 20)     { const c = this._tableChore(); title = 'Conflict — Fumble → Chore'; mechDesc = c.mechDesc; chain = [c]; }
    else if (r >= 16) { const g = this._tableGarrison(); title = 'Conflict — Fail → Garrison'; mechDesc = g.mechDesc; chain = [g]; }
    else if (r >= 6)  { const s = this._tableSkirmish(); const l = this._tableLoot(); title = 'Conflict — Win Skirmish + Loot'; mechDesc = s.mechDesc; chain = [s, l]; }
    else              { const c = this._tableConquest(); title = 'Conflict — Critical → Conquest'; mechDesc = c.mechDesc; chain = [c]; }
    return { title, mechDesc, flags: [], chainResults: chain, eventType: 'Conflict' };
  },

  // ── GUEST (16) ────────────────────────────────────────────
  _tableGuest() {
    const r = this._rollD20();
    let title, mechDesc, chain = [], flags = [];
    if (r === 20)     { const f = this._tableFumble(); title = 'Guest — Fumble → Insulted'; mechDesc = `Hospitality −1. ${f.mechDesc}`; chain = [f]; }
    else if (r >= 16) { const h = this._tableHunt(); title = 'Guest — 30 Glory + Hunt'; mechDesc = `30 Glory awarded. ${h.mechDesc}`; chain = [h]; }
    else if (r >= 6)  { const t = this._tableTournament(); title = 'Guest — 50 Glory + Tournament'; mechDesc = `50 Glory awarded. ${t.mechDesc}`; chain = [t]; }
    else              { const g = this._tableGeneric(); const gf = this._tableGoodFortune(this._rollD20()); title = 'Guest — Generic + Good Fortune'; mechDesc = g.mechDesc; chain = [g, gf]; }
    return { title, mechDesc, flags, chainResults: chain, eventType: 'Guest' };
  },

  // ── AMUSE (17) ────────────────────────────────────────────
  _tableAmuse() {
    const r = this._rollD20();
    let title, mechDesc, chain = [];
    if (r === 20)     { const f = this._tableFumble(); title = 'Amuse — Fumble'; mechDesc = f.mechDesc; chain = [f]; }
    else if (r >= 16) { const g = this._tableGeneric(); title = 'Amuse — Boring'; mechDesc = `${g.mechDesc} The lord is unimpressed.`; chain = [g]; }
    else if (r >= 6)  { const h = this._tableHunt(); title = 'Amuse — Hunt Invitation'; mechDesc = h.mechDesc; chain = [h]; }
    else              { const gu = this._tableGuest(); title = 'Amuse — Join as Guest'; mechDesc = gu.mechDesc; chain = [gu]; }
    return { title, mechDesc, flags: [], chainResults: chain, eventType: 'Amuse' };
  },

  // ── GARRISON (18) — 6 phases ──────────────────────────────
  _tableGarrison() {
    const phases = [];
    // Phase 1 — Lordly Visit [Hospitality]
    const r1 = this._rollD20();
    if      (r1 <= 5)  { const g = this._tableGuest(); phases.push(`Phase 1 (Lordly Visit): All courtly passes → ${g.title}: ${g.mechDesc}`); }
    else if (r1 <= 15) { phases.push(`Phase 1 (Lordly Visit): d20 ${r1} — Hospitality check. Play/Orate/Court for glory.`); }
    else               { const i = this._tableInsulted(); phases.push(`Phase 1 (Lordly Visit): Proud check failed → ${i.title}: ${i.mechDesc}`); }
    // Phase 2 — Guard Duty [Energetic]
    const r2 = this._rollD20();
    if (r2 <= 10) { const p = this._tablePatrol(); phases.push(`Phase 2 (Guard Duty): Trouble spotted → ${p.title}`); }
    else          { phases.push(`Phase 2 (Guard Duty): d20 ${r2} — 3× weapon checks or ${this._rollDie(6)} HP.`); }
    // Phase 3 — Administer Justice [Just]
    const r3 = this._rollD20();
    if      (r3 <= 5)  { phases.push('Phase 3 (Justice): All mercy passes → Companion gained.'); }
    else if (r3 <= 15) { phases.push(`Phase 3 (Justice): d20 ${r3} — Honour +1 check or pay ${this._rollD6()}£.`); }
    else               { phases.push(`Phase 3 (Justice): Failed — pay ${this._rollD6()}£.`); }
    // Phase 4 — Feast [Courtesy]
    const r4 = this._rollD20();
    if      (r4 <= 7)  { const h = this._tableHunt(); phases.push(`Phase 4 (Feast): Modest pass → Hunt: ${h.title}`); }
    else if (r4 <= 14) { phases.push('Phase 4 (Feast): Lustful check → Flirt opportunity arises.'); }
    else               { const i = this._tableInsulted(); phases.push(`Phase 4 (Feast): Indulgent → ${i.title}: ${i.mechDesc}`); }
    // Phase 5 — Foreigners [Trusting]
    const r5 = this._rollD20();
    if (r5 <= 10) { phases.push('Phase 5 (Foreigners): Pass → 2d6 Suspicious check. Then Fight (19) or Loss (14).'); }
    else          { const b = this._tableBandits(); phases.push(`Phase 5 (Foreigners): Fail → +20 Glory + Bandits: ${b.mechDesc}`); }
    // Phase 6 — Thieves [Awareness]
    const r6 = this._rollD20();
    if (r6 <= 10) { phases.push('Phase 6 (Thieves): Pass → Honour +1 or Loot roll.'); }
    else          { const b = this._tableBandits(); phases.push(`Phase 6 (Thieves): Fail → Bandits: ${b.mechDesc}`); }
    return { title: 'Garrison Duty (6 phases)', mechDesc: phases.join(' ◆ '), flags: [], chainResults: [], eventType: 'Garrison' };
  },

  // ── FIGHT (19) ────────────────────────────────────────────
  _tableFight() {
    const r = this._rollD20();
    let title, mechDesc, chain = [];
    if (r === 20)     { const f = this._tableFumble(); title = 'Fight — Fumble'; mechDesc = `5× weapon checks or ${this._rollDie(6)} HP lost. ${f.mechDesc}`; chain = [f]; }
    else if (r >= 16) { title = 'Fight — Draw'; mechDesc = `A hard draw. 3× weapon checks or ${this._rollDie(6)} HP lost.`; }
    else if (r >= 6)  { title = 'Fight — Victory'; mechDesc = `Victory! 25 Glory and ${this._rollD6()} goods.`; }
    else              { const l = this._tableLoot(); title = 'Fight — Decisive Victory + Loot'; mechDesc = `50 Glory. ${l.mechDesc}`; chain = [l]; }
    return { title, mechDesc, flags: [], chainResults: chain, eventType: 'Fight' };
  },

  // ── HIDEOUT (20) ──────────────────────────────────────────
  _tableHideout() {
    const r = this._rollD20();
    let title, mechDesc, flags = [], chain = [];
    if (r === 20)     { const f = this._tableFumble(); title = 'Hideout — Fumble'; mechDesc = `Hurt or Honour −1. ${f.mechDesc}`; flags = ['hurt']; chain = [f]; }
    else if (r >= 16) { title = 'Hideout — Fail'; mechDesc = `Forced withdrawal. 3× weapon checks or ${this._rollDie(6)} HP lost.`; }
    else if (r >= 6)  { const l = this._tableLoot(); title = 'Hideout — Win'; mechDesc = `50 Glory, 3 checks, ${this._rollDie(6)} HP. ${l.mechDesc}`; chain = [l]; }
    else              { const l = this._tableLoot(); title = 'Hideout — Complete Victory'; mechDesc = `75 Glory, 6 checks, ${this._rollDie(6)} HP. Select Loot or Luck.`; chain = [l]; }
    return { title, mechDesc, flags, chainResults: chain, eventType: 'Hideout' };
  },

  // ── SKIRMISH (21) ─────────────────────────────────────────
  _tableSkirmish() {
    const r = this._rollD20();
    let title, mechDesc, flags = [], chain = [];
    if (r === 20)     { const f = this._tableFumble(); title = 'Skirmish — Fumble → Prisoner'; mechDesc = `Taken prisoner. ${f.mechDesc}`; chain = [f]; }
    else if (r >= 16) { title = 'Skirmish — Repulsed'; mechDesc = `Driven back. 3× weapon checks or ${this._rollDie(6)} HP.`; }
    else if (r >= 6)  { title = 'Skirmish — Victory'; mechDesc = `30 Glory, ${this._rollDie(6)} HP, 4 checks.`; }
    else              { title = 'Skirmish — Decisive Victory'; mechDesc = '50 Glory, d6 HP, 6 checks. Select Companion (27) or Luck.'; flags = ['companion']; }
    return { title, mechDesc, flags, chainResults: chain, eventType: 'Skirmish' };
  },

  // ── CONQUEST (22) ─────────────────────────────────────────
  _tableConquest() {
    const r = this._rollD20();
    let title, mechDesc, chain = [];
    if (r === 20)     { const c = this._tableChore();    title = 'Conquest — Fumble → Chore';           mechDesc = c.mechDesc; chain = [c]; }
    else if (r >= 16) { const fi = this._tableFight();   title = 'Conquest — Fail → Fight + Luck';      mechDesc = fi.mechDesc; chain = [fi]; }
    else if (r >= 6)  { const s = this._tableSkirmish(); const l = this._tableLoot(); title = 'Conquest — Win Skirmish + Loot'; mechDesc = s.mechDesc; chain = [s, l]; }
    else              { const h = this._tableHideout();  title = 'Conquest — Critical → Hideout + Manor!'; mechDesc = `${h.mechDesc} A small manor is awarded!`; chain = [h]; }
    return { title, mechDesc, flags: [], chainResults: chain, eventType: 'Conquest' };
  },

  // ── MUSTER (23) ───────────────────────────────────────────
  _tableMuster() {
    const r = this._rollD20();
    let title, mechDesc, chain = [];
    if (r === 20)     { const c = this._tableChore();    title = 'Muster — Fumble → Chore';    mechDesc = c.mechDesc; chain = [c]; }
    else if (r >= 16) { const g = this._tableGarrison(); title = 'Muster — Fail → Garrison';   mechDesc = g.mechDesc; chain = [g]; }
    else if (r >= 6)  { title = 'Muster — Select Fight or Skirmish'; mechDesc = 'GM selects between Fight (19) and Skirmish (21).'; }
    else              { title = 'Muster — Critical: Select Conquest or Patrol'; mechDesc = 'GM selects between Conquest (22) and Patrol (24).'; }
    return { title, mechDesc, flags: [], chainResults: chain, eventType: 'Muster' };
  },

  // ── PATROL (24) — 6 phases ────────────────────────────────
  _tablePatrol() {
    const phases = [];
    // Phase 1 — Visit manor [Temperate]
    const r1 = this._rollD20();
    if      (r1 <= 5)  { const fr = this._tableFriend(false,false); phases.push(`Phase 1 (Manor Visit): All passes → Friend: ${fr.title}: ${fr.mechDesc}`); }
    else if (r1 <= 15) { phases.push(`Phase 1 (Manor Visit): d20 ${r1} — Honour, Valor, Humble checks made.`); }
    else               { const i = this._tableInsulted(); phases.push(`Phase 1 (Manor Visit): Selfish/Suspicious → ${i.title}: ${i.mechDesc}`); }
    // Phase 2 — Spotted [Aware]
    const r2 = this._rollD20();
    if (r2 <= 10) { const b = this._tableBandits(); phases.push(`Phase 2 (Spotted): Bandits or Hideout → ${b.title}: ${b.mechDesc}`); }
    else          { const fi = this._tableFight(); phases.push(`Phase 2 (Spotted): Fail → Fight or Loss: ${fi.mechDesc}`); }
    // Phase 3 — Spoor [Hunt]
    const r3 = this._rollD20();
    if (r3 <= 10) { phases.push(`Phase 3 (Spoor): Pass → ${this._rollD6()}£ goods from quarry.`); }
    else          { phases.push(`Phase 3 (Spoor): Fail → ${this._rollDie(6)} HP + Loss (14).`); }
    // Phase 4 — Barbarians [Prudent]
    const r4 = this._rollD20();
    if (r4 <= 10) { const fi = this._tableFight(); phases.push(`Phase 4 (Barbarians): Pass → Fight: ${fi.mechDesc}`); }
    else          { const s = this._tableSkirmish(); phases.push(`Phase 4 (Barbarians): Fail → Win Skirmish + Loot: ${s.mechDesc}`); }
    // Phase 5 — Old lady [Fairy]
    const r5 = this._rollD20();
    if (r5 <= 10) { const gf = this._tableGoodFortune(this._rollD20()); phases.push(`Phase 5 (Old Lady): Pass → Good Fortune: ${gf.mechDesc}`); }
    else          { phases.push('Phase 5 (Old Lady): Fail — Pious/Generous both failed → Bad Fortune (39).'); }
    // Phase 6 — Enemies
    const r6 = this._rollD20();
    if (r6 <= 10) { const s = this._tableSkirmish(); phases.push(`Phase 6 (Enemies): Win Skirmish + Loot: ${s.mechDesc}`); }
    else          { const s2 = this._tableSkirmish(); phases.push(`Phase 6 (Enemies): Fail → Skirmish or Loss: ${s2.mechDesc}`); }
    return { title: 'Patrol (6 phases)', mechDesc: phases.join(' ◆ '), flags: [], chainResults: [], eventType: 'Patrol' };
  },

  // ── TOURNAMENT (25) ───────────────────────────────────────
  _tableTournament() {
    const r = this._rollD20();
    let title, mechDesc, chain = [];
    if (r === 20) {
      const i = this._tableInsulted(); title = 'Tournament — Withdraws → Insulted'; mechDesc = i.mechDesc; chain = [i];
    } else if (r >= 16) {
      const tilt = this._rollD20();
      if (tilt === 20)     { const f = this._tableFumble(); title = 'Tournament — Tilt Fumble'; mechDesc = `Pay 1£. Badly unhorsed. ${f.mechDesc}`; chain = [f]; }
      else if (tilt >= 11) { title = 'Tournament — Tilt Loss'; mechDesc = 'Pay 1£ entry fee. Unhorsed — no glory this pass.'; }
      else                 { title = 'Tournament — Tilt Win'; mechDesc = `Pay 1£. Victory in the tilt! +3 glory. May re-run.`; }
    } else if (r >= 6) {
      const tiltR = this._rollD20(); const meleeR = this._rollD20();
      const tiltRes  = tiltR <= 5 ? `Critical — +100 Glory, ${this._rollD6x(3)} goods` : tiltR <= 15 ? 'Win, +glory, re-run' : 'Lost the tilt';
      const meleeRes = meleeR <= 5 ? 'Take prisoner — 50 Glory' : meleeR <= 15 ? `Knight yields — 25 Glory + Loot` : meleeR >= 18 ? 'Hurt (7)' : `Ouch — ${this._rollDie(6)*2} HP wound`;
      title = 'Tournament — Tilt and Melee';
      mechDesc = `Tilt (d20:${tiltR}): ${tiltRes} | Melee (d20:${meleeR}): ${meleeRes}`;
    } else {
      title = 'Tournament — Outstanding Triumph';
      mechDesc = `Tilt critical! +100 Glory, ${this._rollD6x(3)} goods. Full invitation to the melee.`;
    }
    return { title, mechDesc, flags: [], chainResults: chain, eventType: 'Tournament' };
  },

  // ── HUNT (26) ─────────────────────────────────────────────
  _tableHunt() {
    const r = this._rollD20();
    let title, mechDesc, chain = [];
    if (r === 20) {
      const rel = this._tableRelations('unwed'); title = 'Hunt — Left Behind with Ladies'; mechDesc = `Left behind. ${rel.mechDesc}`; chain = [rel];
    } else if (r >= 16) {
      title = 'Hunt — Assisted'; mechDesc = '5 Glory. Awareness and Compose checks.';
    } else if (r >= 6) {
      title = 'Hunt — Good Showing'; mechDesc = `3 Horn calls, ${this._rollD6()}£ goods, 10 Glory. Awareness, First Aid.`;
    } else {
      const falcR = this._rollD20();
      let falcResult;
      if (falcR === 20)     { const f = this._tableFumble(); const i = this._tableInsulted(); falcResult = `Fumble → ${f.mechDesc} + Insulted: ${i.mechDesc}`; }
      else if (falcR >= 16) { falcResult = 'Falconry feast — Generic adventure.'; }
      else if (falcR >= 6)  { falcResult = `+50 Glory. Generic adventure.`; }
      else                  { const gf = this._tableGoodFortune(this._rollD20()); falcResult = `Critical! Good Fortune: ${gf.mechDesc}`; }
      title = 'Hunt — Excelled + Falconry Invitation';
      mechDesc = `20 Glory, ${this._rollD6()}£ goods. Falconry with the lords: ${falcResult}`;
    }
    return { title, mechDesc, flags: [], chainResults: chain, eventType: 'Hunt' };
  },

  // ── CHALLENGE (28) ────────────────────────────────────────
  _tableChallenge() {
    const r = this._rollD20();
    let title, mechDesc, chain = [];
    if (r === 20)     { const i = this._tableInsulted(); title = 'Challenge — Fumble → Insulted'; mechDesc = i.mechDesc; chain = [i]; }
    else if (r >= 16) { title = 'Challenge — Dishonour Avoided'; mechDesc = 'A close call — honour maintained, no glory gained.'; }
    else if (r >= 6)  { title = 'Challenge — Honour Maintained'; mechDesc = 'A worthy contest. Honour check passed. +20 Glory.'; }
    else              { title = 'Challenge — Victor'; mechDesc = 'Decisive win. Honour checked. +50 Glory.'; }
    return { title, mechDesc, flags: [], chainResults: chain, eventType: 'Challenge' };
  },

  // ── KIN MEMBER TABLE — 1d20 ───────────────────────────────
  _tableKinMember() {
    const r = this._rollD20();
    if      (r <= 2)  return 'Grandparent';
    else if (r <= 4)  return 'Parent';
    else if (r <= 6)  return 'Sibling';
    else if (r <= 8)  return 'Sibling of parent (aunt/uncle)';
    else if (r <= 12) return 'Cousin';
    else if (r <= 16) return 'Distant cousin';
    else              return 'In-laws or half-kin';
  },

  // ── KIN KNIGHT MUSTER — 1d6 ──────────────────────────────
  _tableKinKnightMuster() {
    const r = this._rollD6();
    const RESULTS = [null,
      'Garrison duty — safe, boring, uneventful.',
      'Garrison duty — safe, boring, uneventful.',
      'Garrison duty — safe, boring, uneventful.',
      'Lightly wounded — recovers fully.',
      'Lightly wounded — recovers fully.',
      `Major wound — roll chirurgery or mortal. Roll: d6=${this._rollD6()} (5+ = prisoner).`,
    ];
    return RESULTS[Math.min(r,6)] || RESULTS[3];
  },

  // ── KIN EVENTS TABLE — 1d20 + modifiers (up to 40) ───────
  _tableKinEvent(roll, isKnight, landed) {
    const r = Math.min(Math.max(roll, 1), 40);
    const km  = () => this._tableKinMember();
    const kkm = () => this._tableKinKnightMuster();

    const KIN = [
      null,
      { t: 'Disputed Betrothal',          m: `A knight seeks to marry a betrothed kin daughter. Wed her to him: kin knight gained, Family & Arbitrary check, Honour −3. Honour the betrothal: gain an Enemy, Just & Honour check.` },
      { t: 'Kin Gift',                    m: `Kin has saved up — a gift of chainmail or a courser for you. A generous gesture of family solidarity.` },
      { t: 'Lord Wants Kin for Concubine',m: `A lord wants a distant kin ${km()} for his concubine. Yield: Family −1, gain a charger. Refuse: Honour check.` },
      { t: 'Arranged Marriage Pressure',  m: `Kin wants to arrange your marriage. Accept: wed immediately. Refuse: Selfish or Proud check.`, f: !landed ? [] : [] },
      { t: 'Kin Needs Coin',              m: `Kin needs 60 denarii. Give 60d: Just check. Refuse: Prudent check. Give 120d: Generous check.` },
      { t: 'Kin Marries',                 m: `A kin member weds. Roll d6: [1–3] +1 lineage man; [4–5] +2 lineage men; [6] +1 young kin knight. Roll: d6=${this._rollD6()}.` },
      { t: 'Refused Arranged Match',      m: `A kin ${km()} refuses an arranged marriage. −1 to one of: Love Family / Love (amor) / Just; +check to the others.` },
      { t: 'Kin Takes Profession',        m: () => { const p=['scribe','scribe','herald','healer','priest','steward'][this._rollD6()-1]; return `A kin ${km()} takes a profession: ${p}.`; } },
      { t: 'Notable Kin Dies',            m: `The eldest notable kin dies. If no direct heir, the kin leader inherits. Roll Luck if inheritance is uncertain.` },
      { t: 'Lead the Way',               m: `For each pass — Honour, Valor, Battle, Siege — gain a check and +1 lineage man.` },
      { t: 'Rumour Taints Kin Daughter', m: `A would-be in-law refuses marriage after rumours. Options: add 2£ (Generous & Humble); duel for her name (Proud & Honour); find new match (Energetic & Love); seek truth (Family −3, Just & Honest); take to court (½£, Loyalty & Courtesy).` },
      { t: 'Arrange a Marriage',          m: `Choice: Selfish check → gain 2d6£ (rolled: ${this._rollD6x(2)}£); Prudent check → gain kin knight; Honour check → the right outcome.` },
      { t: 'Disaster at Muster',          m: `Kin mustered for battle. Kin Knight Muster result: ${kkm()}.`, f: ['kin-muster'] },
      { t: 'Kin Leader Gains Luck',       m: `The kin leader receives a Luck roll, gifted by the family for the betterment of all.` },
      { t: 'Kin Needs Dowry Help',        m: `Kin needs help with a dowry. Refuse: Family −3. Pay 1£: Generous check. Pay 3£: Honour check.` },
      { t: 'Kin Becomes a Squire',        m: `A kin ${km()} becomes a squire. Each winter roll d6: [1] died in battle; [6] became a knight.` },
      { t: 'Claim Your Bastard',          m: `A kin ${km()} asks you to claim his bastard as your own. Accept: Love Family check. Refuse: Honour check.` },
      { t: 'Kin Weds Above Station',      m: () => { const age=['young','young','young','young','middle-aged','old'][this._rollD6()-1]; return `Kin weds above their stature. Gain one ${age} kin knight.`; } },
      { t: 'Scandal in Kin',              m: `Roll for Scandal in Kin. If knighted, you may champion for the kin\'s good name before the lord.` },
      { t: 'Kin Knight Quests',           m: `Select a kin knight who leaves on a quest for ${this._rollD6x(3)} years. He receives 2£/year and 300 Glory/year, then returns enriched.` },
      { t: 'Kin Needs a Champion',        m: `Kin needs a champion (Duel) to resolve a dispute. Accept: Honour check. Refuse: −1 lineage men.` },
      { t: 'Wardenship of Widow',         m: `You as warden decide the marriage of a landed widow with only a daughter. Marry her (Selfish +1); give her to a kin (Love Family & Proud check); choose rightly (+1 Honour).` },
      { t: 'Thinning of Middle-Aged Knights', m: () => { const knights = this._rollD6(); const die = this._rollD6(); return `Roll d6 vs number of middle-aged knights: die=${die}, knights~${knights}. If die < knights, one is slain. Otherwise gain Loot.`; } },
      { t: 'Underage Kin Inherits',       m: `An underage kin ${km()} receives a land gift of 3£/year. You are appointed warden for ${this._rollD6x(2)} winters.` },
      { t: 'Shelter from Vengeance',      m: `Refugees seek shelter. Choose which gets −1 and which gets a check: Love Family, Honour, or Loyalty Lord.` },
      { t: 'Young Kin Show Promise',      m: `The young kin show potential. Choice: +1 lineage men; take a squire; spend 1£ to add ${this._rollD6()} lineage men.` },
      { t: 'Squire Request',              m: `A kin youngling asks you to help him become a squire. Accept: Love Family check. Refuse: Temperate check.` },
      { t: 'Kin Widow Needs Shelter',     m: `A kin widow with orphans needs shelter at ½£/winter. Refuse: Family −1. Arrange marriage (Pious & Proud or Prudent & Selfish). Shelter yourself: Generous & Family check. Each winter d6: [1] sons grow into lineage men; [6] 2£ stolen, Suspicious check.` },
      { t: 'Notable Kin Dies (again)',    m: `The eldest notable kin dies. If no direct heir, kin leader inherits. Roll Luck if unclear.` },
      { t: 'Inspire Your Kin',            m: `For each success — Orate, Compose, Sing, Play — gain a check and +1 lineage man.` },
      { t: 'Slain Without Mercy',         m: `An offending kin ${km()} slain without mercy by a neighbouring knight. Roll Love Family vs Just. If Just > settle by arms in lord\'s court. If Family > start blood feud: each year d6, 1 = kin dies, 6 = theirs dies.`, f: ['record-enemy'] },
      { t: 'Kin Excels at Court',         m: `Kin excels at the liege lord\'s court. Gain ${this._rollDie(3)} new young knights.` },
      { t: 'Kin Mustered Again',          m: `Disaster when kin is mustered. Kin Knight Muster result: ${kkm()}.`, f: ['kin-muster'] },
      { t: 'Distant Relatives Flee',      m: `Distant relatives flee to your lands. Pay 2£ to gain 1 population, ${this._rollD20()} levy men, and Hospitality check.` },
      { t: 'Raving Madman',               m: `A kin knight becomes a raving madman. Each winter: pay 1£ and roll d6 — on 4+ he heals.` },
      { t: 'Two Sons Knighted',           m: `An old kin knight dies leaving enough for two sons to become young knights. The line continues.` },
      { t: 'Kin Held for Ransom',         m: `A kin knight is held for ransom. His lord refuses to negotiate with "barbarians." GM decides the fallout.` },
      { t: 'Elderly Kin Remarries',       m: `An elderly kin knight remarries, joining his new wife\'s smaller kin — ${this._rollD6()} knights and a manor added.` },
      { t: 'Newly Spurred Bastard Brother', m: `A newly spurred knight claims to be your bastard brother. Settle by arms (Prudent & Just); send away (Proud & Suspicious); embrace him (Trusting & Love Family) — gain 1 kin knight.` },
      { t: 'Child Inherits Manor',        m: `A kin child inherits a manor. You are asked to care for it as warden until he comes of age in ${this._rollD6x(2)} winters.` },
    ];

    const entry = KIN[r];
    if (!entry) return { title: 'Kin Event', mechDesc: 'Unusual kin situation — GM interprets.', flags: [], chainResults: [] };
    const mechDesc = typeof entry.m === 'function' ? entry.m() : entry.m;
    return { title: entry.t, mechDesc, flags: entry.f||[], chainResults: [] };
  },

  // ── CARD RENDER ───────────────────────────────────────────
  _renderCard(card) {
    const npc   = STORE.getNpc(card.knightId);
    const name  = npc ? npc.name : 'Unknown Knight';
    const stateClass = card.state === 'resolved' ? 'solos-card-resolved'
                     : card.state === 'dismissed' ? 'solos-card-dismissed'
                     : '';

    const catBadgeStyle = this._catBadgeStyle(card.eventType);

    const rollMode = card.rollMode || 'yearly';
    const rollModeLabel = rollMode === 'solo'
      ? `Solo · ${card.season === 'winter' ? '❄ Winter' : '☀ Summer'}`
      : rollMode === 'kin'
      ? 'Kin Events'
      : card.tier === 'II' ? 'Yearly · Minor' : 'Yearly';

    const stampHtml = card.state === 'resolved'
      ? `<span class="solos-stamp solos-stamp-resolved">✓ Resolved</span>`
      : card.state === 'dismissed'
        ? `<span class="solos-stamp solos-stamp-dismissed">✗ Dismissed</span>`
        : '';

    const wantsFlavor = rollMode === 'solo' || (rollMode === 'yearly' && card.tier === 'I');
    const flavorHtml = wantsFlavor
      ? card.flavorLoading
        ? `<div class="solos-flavor solos-flavor-loading">The scribe is writing…</div>`
        : card.flavorText
          ? `<div class="solos-flavor">${esc(card.flavorText)}</div>`
          : `<div class="solos-flavor solos-flavor-nokey">No AI flavor — set an API key via <strong>🔑 AI Key</strong> in the header.</div>`
      : '';

    const flagsHtml = card.flags.length
      ? `<div class="solos-flags">${card.flags.map(f => this._renderFlag(card.id, f)).join('')}</div>`
      : '';

    const chainHtml = card.chainResults && card.chainResults.length
      ? `<div class="solos-chain">${card.chainResults.map(cr => `
          <div class="solos-chain-entry">
            <span class="solos-chain-arrow">↳</span>
            <strong>${esc(cr.title)}</strong>
            <span class="solos-chain-desc">${esc(cr.mechDesc || '')}</span>
          </div>`).join('')}</div>`
      : '';

    const chronicleBtn = card.state === 'resolved' && card.flavorText
      ? `<button class="btn btn-ghost solos-chronicle-btn" onclick="TabSolos._promptAddToChronicle('${card.id}')">📜 Add to Chronicle</button>`
      : '';
    const buttonsHtml = card.state === 'fresh' ? `
      <div class="solos-card-actions">
        <button class="btn btn-primary solos-resolve-btn" onclick="TabSolos._resolveCard('${card.id}')">✓ Resolve</button>
        <button class="btn btn-ghost solos-dismiss-btn"  onclick="TabSolos._dismissCard('${card.id}')">✗ Dismiss</button>
      </div>` : chronicleBtn ? `<div class="solos-card-actions">${chronicleBtn}</div>` : '';

    return `
      <div class="solos-card ${stateClass}" id="solos-card-${card.id}">
        <div class="solos-card-header">
          <div class="solos-card-meta">
            <span class="solos-card-name">${esc(name)}</span>
            <span class="solos-card-year">${card.year} AD</span>
            <span class="solos-card-mode">${rollModeLabel}</span>
            <span class="solos-card-wed">${card.wed === 'wed' ? 'Wed' : 'Unwed'}</span>
          </div>
          <div class="solos-card-roll-badge">
            ${card.tableRolls.topD6
              ? `<span class="solos-d20">d6: ${card.tableRolls.topD6} → ${esc(card.tableRolls.topChain||'')}</span>`
              : `<span class="solos-d20">d20: ${card.tableRolls.yearly}</span>`}
            <span class="solos-cat-badge" style="${catBadgeStyle}">${esc(card.eventType)}</span>
          </div>
          ${stampHtml}
        </div>
        <div class="solos-card-body">
          <div class="solos-event-title">${esc(card.eventTitle)}</div>
          <div class="solos-mech-desc">${esc(card.mechDesc)}</div>
          ${flavorHtml}
          ${flagsHtml}
          ${chainHtml}
        </div>
        ${buttonsHtml}
      </div>`;
  },

  _catBadgeStyle(type) {
    const MAP = {
      'Good Fortune': 'background:var(--gold);color:#3a2a00;',
      'Bad Fortune':  'background:var(--crimson,#8a1c1c);color:#fff;',
      'Enemy':        'background:var(--crimson,#8a1c1c);color:#fff;',
      'Relations':    'background:#3a5a8a;color:#fff;',
      'Friend':       'background:#3a7a5a;color:#fff;',
      'Saga Event':   'background:#8a7a1c;color:#fff;',
      'Vassal Duty':  'background:#5a3a1a;color:#fff;',
      'Liege Court':  'background:#4a3a6a;color:#fff;',
      'Adventure':    'background:#1a5a3a;color:#fff;',
      'Questing':     'background:#1a3a6a;color:#fff;',
      'Love':         'background:#7a3a5a;color:#fff;',
      'Generic':      'background:#4a4a4a;color:#fff;',
      'Kin Event':    'background:#2a5a2a;color:#fff;',
      'Fight':        'background:var(--crimson,#8a1c1c);color:#fff;',
      'Skirmish':     'background:var(--crimson,#8a1c1c);color:#fff;',
      'Conquest':     'background:#6a1a1a;color:#fff;',
      'Tournament':   'background:#6a4a1a;color:#fff;',
      'Garrison':     'background:#3a3a5a;color:#fff;',
      'Patrol':       'background:#2a4a2a;color:#fff;',
      'Hunt':         'background:#4a5a1a;color:#fff;',
    };
    return MAP[type] || 'background:var(--ink-soft);color:#fff;';
  },

  _renderFlag(cardId, flag) {
    const MAP = {
      'bastard-possible': { label:'⚠ Bastard possible',  style:'background:#c87800;color:#fff;', action:`TabSolos._flagBastard('${cardId}')` },
      'roll-tragedy':     { label:'⚡ Roll tragedy',      style:'background:var(--crimson,#8a1c1c);color:#fff;', action:`TabSolos._flagTragedy('${cardId}')` },
      'record-enemy':     { label:'⚔ Record enemy',      style:'background:var(--crimson,#8a1c1c);color:#fff;', action:`TabSolos._flagEnemy('${cardId}')` },
      'childbirth-roll':  { label:'🍼 Childbirth roll',   style:'background:#3a7a3a;color:#fff;', action:`TabSolos._flagChildbirth('${cardId}')` },
      'companion':        { label:'🤝 Companion gained',  style:'background:#3a5a8a;color:#fff;', action:`TabSolos._flagCompanion('${cardId}')` },
      'saga-record':      { label:'📜 Saga — record this',style:'background:var(--gold);color:#3a2a00;', action:`TabSolos._flagSaga('${cardId}')` },
      'loot':             { label:'💰 Roll Loot',         style:'background:#5a4a2a;color:#fff;', action:`TabSolos._flagLoot('${cardId}')` },
      'hurt':             { label:'🩸 Hurt roll',         style:'background:var(--crimson,#8a1c1c);color:#fff;', action:`TabSolos._flagHurt('${cardId}')` },
      'stricken':         { label:'💔 Stricken roll',     style:'background:#7a3a7a;color:#fff;', action:`TabSolos._flagStricken('${cardId}')` },
      'kin-muster':       { label:'⚔ Kin Knight Muster',  style:'background:#2a5a2a;color:#fff;', action:`TabSolos._flagKinMuster('${cardId}')` },
      'challenge':        { label:'⚔ Challenge (28)',     style:'background:#5a3a1a;color:#fff;', action:`TabSolos._flagChallenge('${cardId}')` },
    };
    const f = MAP[flag];
    if (!f) return '';
    return `<button class="solos-flag-pill" style="${f.style}" onclick="${f.action}">${f.label}</button>`;
  },

  // ── FLAG ACTIONS ──────────────────────────────────────────

  _flagBastard(cardId) {
    const card = this._getCard(cardId);
    if (!card) return;
    const npc = STORE.getNpc(card.knightId);
    if (!npc) return;
    // Use TabWinter._rollConception — create a dummy mother NPC object
    const dummyMother = { id: 'solo-bastard-temp', pronoun: 'she/her', year_born: STORE.year - 25, con: 13 };
    const result = TabWinter._rollConception(dummyMother, true);

    let childDesc = 'No birth.';
    if (result.children && result.children.length) {
      childDesc = result.children.map(c => `${c.blessed ? 'Blessed ' : ''}${c.sex === 'boy' ? 'Boy' : 'Girl'}`).join(' & ');
    }

    Modal.open(`
      <div style="min-width:360px;">
        <div class="modal-header"><h2 style="margin:0;font-size:1rem;">Bastard Birth Roll — ${npc.name}</h2></div>
        <div style="padding:16px 20px;">
          <p style="margin:0 0 8px;font-size:0.85rem;color:var(--ink-soft);">
            Roll: [${result.rolls.join(' → ')}] — <strong>${result.result}</strong>
            ${result.fumbleType ? ` (${result.fumbleType})` : ''}
          </p>
          ${result.children && result.children.length ? `
            <p style="margin:0 0 12px;font-size:0.9rem;">Outcome: <strong>${childDesc}</strong></p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div class="detail-field">
                <div class="detail-label">Bastard's name</div>
                <input class="edit-input" id="bastardName" placeholder="Name…">
              </div>
              <div class="detail-field">
                <div class="detail-label">Pronoun</div>
                <select class="edit-input" id="bastardPronoun">
                  <option value="he/him"${result.children[0].sex === 'boy' ? ' selected' : ''}>he/him</option>
                  <option value="she/her"${result.children[0].sex === 'girl' ? ' selected' : ''}>she/her</option>
                  <option value="they/them">they/them</option>
                </select>
              </div>
            </div>
            <div class="detail-field mb-8">
              <div class="detail-label">Mother's name / description</div>
              <input class="edit-input" id="bastardMother" placeholder="Unnamed woman…">
            </div>
            <div class="detail-field mb-12">
              <div class="detail-label">Acknowledged?</div>
              <select class="solos-select" id="bastardAck">
                <option value="Unacknowledged" selected>Unacknowledged</option>
                <option value="Acknowledged">Acknowledged</option>
              </select>
            </div>
            <div class="btn-row">
              <button class="btn btn-primary" onclick="TabSolos._applyBastard('${cardId}', '${result.children[0].sex}', '${result.children[0].blessed}')">Apply — Add to Roster</button>
              <button class="btn btn-ghost"   onclick="Modal.close()">Cancel</button>
            </div>
          ` : `
            <p style="margin:0 0 12px;font-size:0.9rem;color:var(--ink-soft);">No live birth resulted.</p>
            <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
          `}
        </div>
      </div>`);
  },

  _applyBastard(cardId, sex, blessed) {
    const card = this._getCard(cardId);
    if (!card) return;
    const knight   = STORE.getNpc(card.knightId);
    const childName = document.getElementById('bastardName')?.value?.trim() || 'Unknown Bastard';
    const motherDesc = document.getElementById('bastardMother')?.value?.trim() || 'Unknown woman';
    const ack = document.getElementById('bastardAck')?.value || 'Unacknowledged';

    const pronoun = document.getElementById('bastardPronoun')?.value
                  || (sex === 'boy' ? 'he/him' : 'she/her');
    const childId = STORE.addNpc({
      name:       childName,
      role:       'Baby',
      year_born:  STORE.year,
      pronoun,
      blessed:    blessed === 'true' || blessed === true,
      household:  knight ? knight.household : '',
      notes:      `Bastard child of ${knight ? knight.name : 'unknown knight'} and ${motherDesc}. ${ack}.`,
    });

    if (knight) {
      STORE.addRelationship(childId, knight.id, 'Bastard', `${ack}. Mother: ${motherDesc}`);
    }

    Toast.success(`${childName} added to roster as bastard of ${knight ? knight.name : 'knight'}.`);
    Modal.close();
  },

  _flagTragedy(cardId) {
    const t = this._tableTragedy();
    Modal.open(`
      <div style="min-width:320px;">
        <div class="modal-header"><h2 style="margin:0;font-size:1rem;">Tragedy (table 51)</h2></div>
        <div style="padding:16px 20px;">
          <p style="font-size:0.9rem;margin:0 0 12px;"><strong>${t.mechDesc}</strong></p>
          <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        </div>
      </div>`);
  },

  _flagEnemy(cardId) {
    const card = this._getCard(cardId);
    if (!card) return;
    const knight = STORE.getNpc(card.knightId);
    Modal.open(`
      <div style="min-width:360px;">
        <div class="modal-header"><h2 style="margin:0;font-size:1rem;">Record Enemy</h2></div>
        <div style="padding:16px 20px;">
          <p style="margin:0 0 10px;font-size:0.85rem;color:var(--ink-soft);">
            Name or describe the enemy. This will be logged as a note on ${knight ? knight.name : 'the knight'}.
          </p>
          <div class="detail-field mb-8">
            <div class="detail-label">Enemy name / description</div>
            <input class="edit-input" id="enemyName" placeholder="Sir Mordred, a jealous rival…">
          </div>
          <div class="detail-field mb-12">
            <div class="detail-label">Nature of enmity</div>
            <input class="edit-input" id="enemyNature" placeholder="Blood feud, rivalry, betrayal…">
          </div>
          <div class="btn-row">
            <button class="btn btn-danger" onclick="TabSolos._applyEnemy('${cardId}')">Log Enemy</button>
            <button class="btn btn-ghost"  onclick="Modal.close()">Cancel</button>
          </div>
        </div>
      </div>`);
  },

  _applyEnemy(cardId) {
    const card = this._getCard(cardId);
    if (!card) return;
    const knight     = STORE.getNpc(card.knightId);
    const enemyName  = document.getElementById('enemyName')?.value?.trim() || 'Unknown enemy';
    const nature     = document.getElementById('enemyNature')?.value?.trim() || '';

    if (knight) {
      const note = `Enemy (${STORE.year} AD): ${enemyName}${nature ? ' — ' + nature : ''}.`;
      STORE.updateNpc(knight.id, { notes: (knight.notes ? knight.notes + '\n\n' : '') + note });
    }

    Toast.success(`Enemy "${enemyName}" logged on ${knight ? knight.name : 'knight'}.`);
    Modal.close();
  },

  _flagChildbirth(cardId) {
    const card = this._getCard(cardId);
    if (!card) return;
    const knight = STORE.getNpc(card.knightId);
    // Find spouse via relationships
    let mother = null;
    if (knight) {
      const rels = STORE.getRelationships(knight.id).filter(r => r.type === 'Spouse' || r.type === 'Betrothed');
      if (rels.length) {
        const spId = rels[0].sourceId === knight.id ? rels[0].targetId : rels[0].sourceId;
        mother = STORE.getNpc(spId);
      }
    }
    if (!mother) {
      Toast.warn('No wife found in STORE for childbirth roll. Roll manually.');
      return;
    }
    // Delegate to TabWinter flow
    TabWinter.rollOneBirth(mother.id);
    Toast.success(`Childbirth roll delegated to Winter Phase for ${mother.name}.`);
    Modal.close && Modal.close();
  },

  _flagCompanion(cardId) {
    const card = this._getCard(cardId);
    if (!card) return;
    const knight = STORE.getNpc(card.knightId);
    Modal.open(`
      <div style="min-width:340px;">
        <div class="modal-header"><h2 style="margin:0;font-size:1rem;">Companion Gained (table 27)</h2></div>
        <div style="padding:16px 20px;">
          <p style="margin:0 0 10px;font-size:0.85rem;color:var(--ink-soft);">
            A deep bond companion enters ${knight ? knight.name + '\'s' : 'the knight\'s'} life.
            Link to an existing NPC or note the companion's name for later creation.
          </p>
          <div class="detail-field mb-8">
            <div class="detail-label">Companion name (new or existing)</div>
            <input class="edit-input" id="companionName" placeholder="Name…">
          </div>
          <div class="detail-field mb-12">
            <div class="detail-label">Nature of bond</div>
            <input class="edit-input" id="companionBond" placeholder="Shield-brother, rescued prisoner…">
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" onclick="TabSolos._applyCompanion('${cardId}')">Log Companion</button>
            <button class="btn btn-ghost"   onclick="Modal.close()">Cancel</button>
          </div>
        </div>
      </div>`);
  },

  _applyCompanion(cardId) {
    const card = this._getCard(cardId);
    if (!card) return;
    const knight = STORE.getNpc(card.knightId);
    const compName = document.getElementById('companionName')?.value?.trim() || 'Unknown companion';
    const bond     = document.getElementById('companionBond')?.value?.trim() || '';

    if (knight) {
      const note = `Companion gained (${STORE.year} AD): ${compName}${bond ? ' — ' + bond : ''}.`;
      STORE.updateNpc(knight.id, { notes: (knight.notes ? knight.notes + '\n\n' : '') + note });
    }

    Toast.success(`Companion "${compName}" logged on ${knight ? knight.name : 'knight'}.`);
    Modal.close();
  },

  _flagSaga(cardId) {
    const card = this._getCard(cardId);
    if (!card) return;
    Modal.open(`
      <div style="min-width:320px;">
        <div class="modal-header"><h2 style="margin:0;font-size:1rem;">Saga — Record This</h2></div>
        <div style="padding:16px 20px;">
          <p style="margin:0 0 10px;font-size:0.85rem;color:var(--ink-soft);">
            Note this saga event in the chronicles for future reference.
          </p>
          <div style="background:var(--vellum-dark,#e8dcc8);padding:10px;border-radius:4px;font-style:italic;font-size:0.88rem;margin-bottom:14px;">
            ${esc(card.mechDesc)}
          </div>
          <p style="font-size:0.8rem;color:var(--ink-soft);margin:0 0 10px;">
            Tip: copy this to your campaign notes for a future session hook.
          </p>
          <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        </div>
      </div>`);
  },

  _flagLoot(cardId) {
    const loot = this._tableLoot();
    Modal.open(`
      <div style="min-width:300px;">
        <div class="modal-header"><h2 style="margin:0;font-size:1rem;">Loot Roll</h2></div>
        <div style="padding:16px 20px;">
          <p style="font-size:0.9rem;margin:0 0 12px;"><strong>${loot.mechDesc}</strong></p>
          <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        </div>
      </div>`);
  },

  _flagHurt(cardId) {
    const h = this._tableHurt();
    Modal.open(`
      <div style="min-width:300px;">
        <div class="modal-header"><h2 style="margin:0;font-size:1rem;">Hurt (table 7)</h2></div>
        <div style="padding:16px 20px;">
          <p style="font-size:0.9rem;margin:0 0 12px;"><strong>${h.mechDesc}</strong></p>
          <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        </div>
      </div>`);
  },

  _flagStricken(cardId) {
    const s = this._tableStricken();
    Modal.open(`
      <div style="min-width:300px;">
        <div class="modal-header"><h2 style="margin:0;font-size:1rem;">Stricken (table 8)</h2></div>
        <div style="padding:16px 20px;">
          <p style="font-size:0.9rem;margin:0 0 12px;"><strong>${s.mechDesc}</strong></p>
          <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        </div>
      </div>`);
  },

  _flagKinMuster(cardId) {
    const result = this._tableKinKnightMuster();
    Modal.open(`
      <div style="min-width:300px;">
        <div class="modal-header"><h2 style="margin:0;font-size:1rem;">Kin Knight Muster</h2></div>
        <div style="padding:16px 20px;">
          <p style="font-size:0.9rem;margin:0 0 12px;"><strong>${result}</strong></p>
          <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        </div>
      </div>`);
  },

  _flagChallenge(cardId) {
    const result = this._tableChallenge();
    Modal.open(`
      <div style="min-width:300px;">
        <div class="modal-header"><h2 style="margin:0;font-size:1rem;">Challenge (table 28)</h2></div>
        <div style="padding:16px 20px;">
          <p style="font-size:0.9rem;margin:0 0 12px;"><strong>${result.mechDesc}</strong></p>
          <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        </div>
      </div>`);
  },

  // ── RESOLVE / DISMISS ─────────────────────────────────────
  _resolveCard(cardId) {
    const card = this._getCard(cardId);
    if (!card || card.state !== 'fresh') return;
    card.state = 'resolved';

    // Save to the knight's Solo Chronicle
    STORE.addSoloEvent(card.knightId, {
      year:       card.year,
      season:     card.season,
      title:      card.eventTitle,
      mechDesc:   card.mechDesc,
      flavorText: card.flavorText || null,
      userNotes:  '',
    });

    // Auto-apply Glory if mechDesc mentions a Glory amount
    const gloryMatches = (card.mechDesc || '').match(/(\d[\d,]*)\s*Glory/gi);
    if (gloryMatches) {
      const total = gloryMatches.reduce((sum, m) => {
        return sum + parseInt(m.replace(/[^\d]/g, ''), 10);
      }, 0);
      if (total > 0) {
        const npc = STORE.getNpc(card.knightId);
        if (npc) {
          const newGlory = (parseInt(npc.glory, 10) || 0) + total;
          STORE.updateNpc(card.knightId, { glory: newGlory });
          Toast.show(`+${total} Glory added to ${npc.name}.`, 'success');
        }
      }
    }

    this._reRenderCard(cardId);
  },

  _dismissCard(cardId) {
    const card = this._getCard(cardId);
    if (!card || card.state !== 'fresh') return;
    card.state = 'dismissed';
    this._reRenderCard(cardId);
  },

  _reRenderCard(cardId) {
    const card = this._getCard(cardId);
    if (!card) return;
    const el = document.getElementById(`solos-card-${cardId}`);
    if (!el) return;
    el.outerHTML = this._renderCard(card);
  },

  // ── RESET ALL ─────────────────────────────────────────────
  _resetAll() {
    Modal.open(`
      <div style="min-width:320px;">
        <div class="modal-header"><h2 style="margin:0;font-size:1rem;">Clear the Ledger?</h2></div>
        <div style="padding:16px 20px;">
          <p style="margin:0 0 14px;font-size:0.9rem;color:var(--ink-soft);">
            All unresolved outcomes will be lost. No STORE changes are made.
          </p>
          <div class="btn-row">
            <button class="btn btn-danger" onclick="TabSolos._doReset()">Clear Ledger</button>
            <button class="btn btn-ghost"  onclick="Modal.close()">Cancel</button>
          </div>
        </div>
      </div>`);
  },

  _doReset() {
    this._ledger  = [];
    this._cardCtr = 0;
    Modal.close();
    this.render();
  },

  // ── AI FLAVOR TEXT ────────────────────────────────────────

  // Rotate through distinct angles so Haiku doesn't default to the same clichés.
  _flavorAngles: [
    { angle: 'POV: a minor bystander (servant, stablehand, priest) who witnessed it.',         avoid: 'Do NOT write about weather, cold, snow, frost, ice, mist, wind, or landscape at all.' },
    { angle: 'Focus: one specific object present in the scene — a cup, a sword, a letter.',    avoid: 'Do NOT mention weather, cold, season, or any outdoor scenery.' },
    { angle: 'Focus: the knight\'s private emotion or unspoken thought in this moment.',        avoid: 'No weather. No landscape. No riding. Entirely internal.' },
    { angle: 'Open with a snippet of overheard speech or rumour about this event.',            avoid: 'No weather description whatsoever. Stay in the hall or village.' },
    { angle: 'Capture one specific physical gesture or action that reveals character.',        avoid: 'No weather. No scenery. No riding through anything.' },
    { angle: 'Voice: a steward\'s terse ledger note — dry, factual, with one dark undercurrent.', avoid: 'No weather, no landscape, no poetic imagery.' },
    { angle: 'Focus on aftermath — what someone said later, what changed, what went unspoken.', avoid: 'No snow, ice, frost, cold, mist, wind, wolves, moorland.' },
    { angle: 'Anchor in a smell, a fire, a sound inside a building — entirely indoors.',       avoid: 'Absolutely no outdoor scenery, weather, or cold.' },
    { angle: 'Frame as a household proverb this event inspired, then name the knight.',        avoid: 'No weather words. No frost, snow, cold, or mist.' },
    { angle: 'A bard\'s two-line tavern verse about this event — punchy, slightly irreverent.', avoid: 'No weather clichés. No frost, snow, wolves, or moorland.' },
  ],
  _flavorAngleIdx: 0,

  async _fetchFlavor(cardId, name, married, eventType, outcomeTitle, mechanicalDesc, personalityNote) {
    const slot  = this._flavorAngles[this._flavorAngleIdx % this._flavorAngles.length];
    this._flavorAngleIdx++;

    const system = [
      'You are a chronicler writing in the manner of Thomas Malory\'s Le Morte d\'Arthur and the Lancelot-Grail Vulgate Cycle.',
      'Write 2–3 sentences of flavor text for a Pendragon RPG event set in ~499 AD Britain.',
      'Style: plain, grave, third-person narration; archaic cadence without being impenetrable; matter-of-fact about strange or violent things; the unhurried tone of someone setting events to parchment for posterity.',
      'Use Malory\'s hallmarks: "And so it befell", "it is told", "Thus did", "wherefore", "worshipful", periodic asides on honour or fate — but sparingly, not all at once.',
      'CRITICAL: The actual event must be clear from the prose. A reader who has not seen the mechanical summary must be able to understand what happened — a wound taken, a kinsman lost, a marriage made, a fortune gained. Weave the substance into the style; do not let atmosphere swallow the event.',
      'Under 90 words total. No preamble. No surrounding quotation marks. Write nothing but the flavor text itself.',
      `Approach: ${slot.angle}`,
      `Hard constraint: ${slot.avoid}`,
      'Also forbidden anywhere: snow, frost, ice, frozen, chill, cold, bitter, moorland, wolf/wolves, mist, fog, rode through, rode forth, rampart, blizzard.',
    ].join(' ');

    try {
      const resp = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 220,
          system,
          messages: [{
            role:    'user',
            content: [
              `Knight: ${name}`,
              `Marital status: ${married ? 'married' : 'unmarried'}`,
              personalityNote ? `Personality & traits: ${personalityNote}` : null,
              `Event: ${eventType} — ${outcomeTitle}`,
              `Context: ${mechanicalDesc}`,
            ].filter(Boolean).join('\n'),
          }],
        }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const text = data?.content?.[0]?.text?.trim() || null;

      const card = this._getCard(cardId);
      if (card) {
        card.flavorText    = text;
        card.flavorLoading = false;
        this._reRenderCard(cardId);
      }
    } catch (err) {
      const card = this._getCard(cardId);
      if (card) { card.flavorLoading = false; card.flavorText = null; this._reRenderCard(cardId); }
    }
  },

  // ── ADD TO CHRONICLE ─────────────────────────────────────
  _promptAddToChronicle(cardId) {
    const card = this._getCard(cardId);
    if (!card) return;
    const npc  = STORE.getNpc(card.knightId);
    const name = npc ? npc.name : 'Unknown Knight';
    const year = card.year;
    const text = card.flavorText || '';

    Modal.open(`
      <div style="min-width:340px;max-width:520px;">
        <div class="modal-header">
          <h2 style="margin:0;font-size:1rem;font-family:var(--font-heading,'Cinzel',serif);">📜 Add to Chronicle — ${year} AD</h2>
        </div>
        <p style="font-size:0.82rem;color:var(--ink-soft);margin:8px 0 12px;line-height:1.5;">
          Edit the entry below before committing it to the Chronicle of Logres.
        </p>
        <textarea id="solos-chron-text" class="edit-input" rows="5"
          style="width:100%;resize:vertical;font-family:var(--font-body,'EB Garamond',serif);font-size:0.9rem;line-height:1.5;"
        >${esc(name + ' — ' + text)}</textarea>
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" onclick="TabSolos._commitToChronicle(${year})">Commit to Chronicle</button>
        </div>
      </div>`);
  },

  _commitToChronicle(year) {
    const text = document.getElementById('solos-chron-text')?.value?.trim();
    if (!text) return;
    if (!STORE.chronicle) STORE.chronicle = {};
    const key = String(year);
    if (!STORE.chronicle[key]) STORE.chronicle[key] = [];
    STORE.chronicle[key].push({ id: 'ev-' + crypto.randomUUID(), text, cat: 'personal', ts: Date.now() });
    STORE.save();
    Modal.close();
    Toast.success('Entry committed to the Chronicle of Logres.');
  },

  // ── KNIGHT PERSONALITY NOTE ───────────────────────────────
  _editKnightNote(id) {
    const npc = STORE.getNpc(id);
    if (!npc) return;
    Modal.open(`
      <div style="min-width:360px;max-width:480px;">
        <div class="modal-header">
          <h2 style="margin:0;font-size:1rem;font-family:var(--font-heading,'Cinzel',serif);">
            Personality Note — ${esc(npc.name)}
          </h2>
        </div>
        <div style="padding:16px 20px;">
          <p style="margin:0 0 10px;font-size:0.82rem;color:var(--ink-soft,#7a6a4a);line-height:1.45;">
            Describe this knight's personality, dominant traits, flaws, and reputation.
            This note is included verbatim in every AI flavor text prompt for this knight,
            so Haiku knows who it's actually writing about.
          </p>
          <textarea id="knightNoteText" class="edit-input" rows="4"
            style="width:100%;resize:vertical;font-family:var(--font-body,'EB Garamond',serif);font-size:0.9rem;"
            placeholder="e.g. Cruel, short-tempered, covetous of glory. Contemptuous of peasants and clergy alike. Respected for valor, feared for her tongue. Will betray an ally for the right price."
          >${esc(npc.personalityNote || '')}</textarea>
          <p style="margin:8px 0 14px;font-size:0.72rem;color:var(--ink-soft,#7a6a4a);font-style:italic;">
            Tip: include dominant traits, vices, reputation at court, and any notable grudges or passions.
          </p>
          <div class="btn-row">
            <button class="btn btn-primary" onclick="TabSolos._saveKnightNote('${id}')">Save</button>
            <button class="btn btn-ghost"   onclick="Modal.close()">Cancel</button>
            ${npc.personalityNote ? `<button class="btn btn-ghost" style="margin-left:auto;color:var(--crimson,#8a1c1c);" onclick="TabSolos._clearKnightNote('${id}')">Clear</button>` : ''}
          </div>
        </div>
      </div>`);
  },

  _saveKnightNote(id) {
    const text = document.getElementById('knightNoteText')?.value?.trim() || '';
    STORE.updateNpc(id, { personalityNote: text });
    Modal.close();
    this.render();
    Toast.success(text ? 'Personality note saved.' : 'Note cleared.');
  },

  _clearKnightNote(id) {
    STORE.updateNpc(id, { personalityNote: '' });
    Modal.close();
    this.render();
    Toast.success('Note cleared.');
  },

  // ── PILL TOOLTIP ──────────────────────────────────────────
  _ensureTooltip() {
    let tt = document.getElementById('solos-pill-tooltip');
    if (!tt) {
      tt = document.createElement('div');
      tt.id = 'solos-pill-tooltip';
      tt.className = 'solos-pill-tooltip';
      tt.style.display = 'none';
      document.body.appendChild(tt);
    }
    return tt;
  },

  _showPillTooltip(evt, id) {
    const npc = STORE.getNpc(id);
    if (!npc) return;
    const tt = this._ensureTooltip();

    const age     = npc.year_born ? (STORE.year - npc.year_born) + ' yrs' : null;
    const glory   = npc.glory     ? `${Number(npc.glory).toLocaleString()} Glory` : null;
    const hh      = npc.household || null;
    const notes   = npc.notes     ? npc.notes.replace(/\n/g,' ').slice(0, 80) + (npc.notes.length > 80 ? '…' : '') : null;
    const rels    = STORE.getRelationships ? STORE.getRelationships(npc.id) : [];
    const spouse  = rels.find(r => r.type === 'Spouse');
    let spouseName = null;
    if (spouse) {
      const spId  = spouse.sourceId === npc.id ? spouse.targetId : spouse.sourceId;
      const sp    = STORE.getNpc(spId);
      spouseName  = sp ? sp.name : null;
    }

    const personality = npc.personalityNote ? npc.personalityNote.slice(0, 100) + (npc.personalityNote.length > 100 ? '…' : '') : null;

    const rows = [
      npc.role    ? `<div class="spt-row"><span class="spt-key">Role</span><span class="spt-val">${esc(npc.role)}</span></div>` : '',
      age         ? `<div class="spt-row"><span class="spt-key">Age</span><span class="spt-val">${age}</span></div>` : '',
      glory       ? `<div class="spt-row"><span class="spt-key">Glory</span><span class="spt-val">${glory}</span></div>` : '',
      hh          ? `<div class="spt-row"><span class="spt-key">Household</span><span class="spt-val">${esc(hh)}</span></div>` : '',
      spouseName  ? `<div class="spt-row"><span class="spt-key">Spouse</span><span class="spt-val">${esc(spouseName)}</span></div>` : '',
      personality ? `<div class="spt-personality"><span class="spt-key" style="display:block;margin-bottom:2px;">Traits</span>${esc(personality)}</div>` : '',
      notes       ? `<div class="spt-notes">${esc(notes)}</div>` : '',
    ].filter(Boolean).join('');

    tt.innerHTML = `
      <div class="spt-name">${esc(npc.name)}</div>
      ${rows}
      <div class="spt-hint">Click name to open full card</div>`;
    tt.style.display = 'block';
    this._positionTooltip(tt, evt);
  },

  _positionTooltip(tt, evt) {
    tt.style.display = 'block';
    const tw = tt.offsetWidth  || 220;
    const th = tt.offsetHeight || 120;
    let x = evt.clientX + 12;
    let y = evt.clientY + 12;
    if (x + tw > window.innerWidth  - 8) x = evt.clientX - tw - 8;
    if (y + th > window.innerHeight - 8) y = evt.clientY - th - 8;
    tt.style.left = x + 'px';
    tt.style.top  = y + 'px';
  },

  _hidePillTooltip() {
    const tt = document.getElementById('solos-pill-tooltip');
    if (tt) tt.style.display = 'none';
  },

  // ── UTILITIES ─────────────────────────────────────────────
  _getCard(id)   { return this._ledger.find(c => c.id === id) || null; },

};

/* ── CSS ──────────────────────────────────────────────────────
   Injected once on first load.
   Uses design tokens: --vellum, --gold, --crimson, --ink, --ink-soft,
   --font-body (EB Garamond), --font-heading (Cinzel).
─────────────────────────────────────────────────────────────── */
(function _injectSolosStyles() {
  if (document.getElementById('solos-styles')) return;
  const s = document.createElement('style');
  s.id = 'solos-styles';
  s.textContent = `
/* ── LAYOUT ─────────────────────────────────────────── */
.solos-layout {
  display: flex;
  flex-direction: column;
  gap: 0;
  font-family: var(--font-body, 'EB Garamond', serif);
  color: var(--ink, #2a1e0e);
}

/* ── CONTROLS ───────────────────────────────────────── */
.solos-controls {
  background: var(--vellum, #f5ead8);
  border-bottom: 1px solid var(--gold, #c8a84b);
  padding: 14px 18px 12px;
}

.solos-control-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 14px;
}

.solos-shared-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 14px;
  margin-bottom: 14px;
}

.solos-action-blocks {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.solos-action-block {
  background: var(--vellum-mid, #ede0c4);
  border: 1px solid var(--gold, #c8a84b);
  border-radius: 5px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.solos-action-title {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink, #2a1e0e);
}

.solos-action-sub {
  font-family: var(--font-body, 'EB Garamond', serif);
  font-size: 0.78rem;
  color: var(--ink-soft, #7a6a4a);
  font-style: italic;
  margin-top: -4px;
}

.solos-card-mode {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.58rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: var(--vellum-deep, #d8c898);
  color: var(--ink, #2a1e0e);
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.solos-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.solos-label {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: var(--ink-soft, #7a6a4a);
  text-transform: uppercase;
}

.solos-select {
  font-family: var(--font-body, 'EB Garamond', serif);
  font-size: 0.88rem;
  padding: 5px 10px;
  border: 1px solid var(--gold, #c8a84b);
  background: var(--vellum, #f5ead8);
  color: var(--ink, #2a1e0e);
  border-radius: 3px;
  cursor: pointer;
  min-width: 180px;
}

.solos-year-input {
  font-family: var(--font-body, 'EB Garamond', serif);
  font-size: 0.88rem;
  padding: 5px 8px;
  border: 1px solid var(--gold, #c8a84b);
  background: var(--vellum, #f5ead8);
  color: var(--ink, #2a1e0e);
  border-radius: 3px;
  width: 72px;
  text-align: center;
}

.solos-knight-field {
  flex: 1 1 220px;
  min-width: 180px;
}

.solos-knight-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
}

.solos-knight-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--gold, #c8a84b);
  color: #3a2a00;
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  padding: 3px 7px 3px 9px;
  border-radius: 12px;
}

.solos-pill-name {
  cursor: pointer;
  border-bottom: 1px dotted rgba(58,42,0,0.4);
  transition: border-color 0.15s;
}
.solos-pill-name:hover {
  border-bottom-color: rgba(58,42,0,1);
}

.solos-pill-trait {
  background: none;
  border: none;
  cursor: pointer;
  color: #3a2a00;
  font-size: 0.78rem;
  line-height: 1;
  padding: 0 2px;
  opacity: 0.45;
  transition: opacity 0.15s, color 0.15s;
}
.solos-pill-trait:hover { opacity: 1; }
.solos-pill-trait.has-note {
  opacity: 0.9;
  color: #6a4a00;
}

.solos-pill-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: #3a2a00;
  font-size: 0.85rem;
  line-height: 1;
  padding: 0 1px;
  opacity: 0.6;
}
.solos-pill-remove:hover { opacity: 1; }

/* ── PILL TOOLTIP ────────────────────────────────────── */
.solos-pill-tooltip {
  position: fixed;
  z-index: 9999;
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
.spt-name {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--ink, #2a1e0e);
  margin-bottom: 6px;
  border-bottom: 1px solid var(--gold, #c8a84b);
  padding-bottom: 4px;
}
.spt-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 2px;
  font-size: 0.8rem;
}
.spt-key {
  color: var(--ink-soft, #7a6a4a);
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.62rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  flex-shrink: 0;
  padding-top: 1px;
}
.spt-val {
  color: var(--ink, #2a1e0e);
  text-align: right;
}
.spt-personality {
  margin-top: 5px;
  font-size: 0.78rem;
  color: var(--ink, #2a1e0e);
  border-top: 1px solid #e8dcc8;
  padding-top: 4px;
  line-height: 1.35;
}
.spt-notes {
  margin-top: 5px;
  font-size: 0.76rem;
  color: var(--ink-soft, #7a6a4a);
  font-style: italic;
  border-top: 1px solid #e8dcc8;
  padding-top: 4px;
  line-height: 1.35;
}
.spt-hint {
  margin-top: 6px;
  font-size: 0.66rem;
  font-family: var(--font-heading, 'Cinzel', serif);
  letter-spacing: 0.05em;
  color: var(--gold, #c8a84b);
  text-align: center;
  text-transform: uppercase;
}

.solos-toggle-group {
  display: flex;
  gap: 0;
  border: 1px solid var(--gold, #c8a84b);
  border-radius: 3px;
  overflow: hidden;
}

.solos-toggle {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  padding: 5px 12px;
  background: var(--vellum, #f5ead8);
  color: var(--ink-soft, #7a6a4a);
  border: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.solos-toggle:not(:last-child) {
  border-right: 1px solid var(--gold, #c8a84b);
}

.solos-toggle.active,
.solos-toggle:hover {
  background: var(--gold, #c8a84b);
  color: #3a2a00;
}

.solos-cast-btn {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  padding: 7px 18px;
}

.solos-season-note {
  margin-top: 8px;
  font-size: 0.78rem;
  color: var(--ink-soft, #7a6a4a);
  font-style: italic;
}

.solos-kin-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 14px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--gold, #c8a84b);
}

.solos-kin-btn {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  padding: 7px 18px;
  background: var(--vellum, #f5ead8);
  border: 1px solid var(--gold, #c8a84b);
  color: var(--ink, #2a1e0e);
  cursor: pointer;
  border-radius: 3px;
  transition: background 0.15s, color 0.15s;
}
.solos-kin-btn:hover:not(:disabled) {
  background: #2a5a2a;
  color: #fff;
  border-color: #2a5a2a;
}
.solos-kin-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── DIVIDER ─────────────────────────────────────────── */
.solos-divider {
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--gold, #c8a84b), transparent);
  margin: 0;
}

/* ── LEDGER HEADER ──────────────────────────────────── */
.solos-ledger-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px 6px;
  background: var(--vellum, #f5ead8);
}

.solos-ledger-title {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  color: var(--ink-soft, #7a6a4a);
  text-transform: uppercase;
}

.solos-reset-btn {
  font-size: 0.58rem;
  padding: 3px 10px;
}

/* ── LEDGER ──────────────────────────────────────────── */
.solos-ledger {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 18px 24px;
  max-height: 70vh;
  overflow-y: auto;
  background: var(--vellum, #f5ead8);
}

.solos-empty {
  text-align: center;
  padding: 48px 0;
}

.solos-empty-icon {
  font-size: 2rem;
  margin-bottom: 10px;
  opacity: 0.5;
}

.solos-empty-text {
  font-style: italic;
  color: var(--ink-soft, #7a6a4a);
  font-size: 0.9rem;
}

/* ── CARD ────────────────────────────────────────────── */
.solos-card {
  background: #fffcf5;
  border: 1px solid var(--gold, #c8a84b);
  border-left: 4px solid var(--gold, #c8a84b);
  border-radius: 4px;
  padding: 12px 14px 10px;
  position: relative;
  transition: opacity 0.2s;
}

.solos-card-resolved {
  opacity: 0.7;
  border-left-color: var(--gold, #c8a84b);
}

.solos-card-dismissed {
  opacity: 0.4;
  border-left-color: #aaa;
  filter: grayscale(0.4);
}

/* ── CARD HEADER ─────────────────────────────────────── */
.solos-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 6px;
}

.solos-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.solos-card-name {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--ink, #2a1e0e);
}

.solos-card-year,
.solos-card-tier,
.solos-card-wed,
.solos-card-season {
  font-size: 0.72rem;
  color: var(--ink-soft, #7a6a4a);
  font-family: var(--font-heading, 'Cinzel', serif);
}

.solos-card-roll-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.solos-d20 {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.72rem;
  color: var(--ink-soft, #7a6a4a);
  background: #e8dcc8;
  padding: 2px 8px;
  border-radius: 10px;
}

.solos-cat-badge {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  padding: 2px 9px;
  border-radius: 10px;
  text-transform: uppercase;
}

/* ── STAMP ───────────────────────────────────────────── */
.solos-stamp {
  position: absolute;
  top: 10px;
  right: 12px;
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  padding: 3px 10px;
  border-radius: 10px;
  pointer-events: none;
}

.solos-stamp-resolved {
  background: var(--gold, #c8a84b);
  color: #3a2a00;
}

.solos-stamp-dismissed {
  background: #aaa;
  color: #fff;
}

/* ── CARD BODY ───────────────────────────────────────── */
.solos-card-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.solos-event-title {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--ink, #2a1e0e);
  line-height: 1.3;
}

.solos-mech-desc {
  font-style: italic;
  font-size: 0.88rem;
  color: var(--ink-soft, #7a6a4a);
  line-height: 1.5;
}

/* ── FLAVOR TEXT ─────────────────────────────────────── */
.solos-flavor {
  font-family: var(--font-body, 'EB Garamond', serif);
  font-size: 0.92rem;
  color: var(--ink, #2a1e0e);
  line-height: 1.6;
  border-left: 2px solid var(--gold, #c8a84b);
  padding-left: 10px;
  margin-top: 4px;
}

.solos-flavor-loading {
  color: var(--ink-soft, #7a6a4a);
  font-style: italic;
  animation: solos-pulse 1.5s ease-in-out infinite;
}

.solos-flavor-nokey {
  font-size: 0.72rem;
  font-style: italic;
  color: var(--ink-soft, #7a6a4a);
  opacity: 0.65;
  border-left-color: rgba(138,92,199,0.3);
}

@keyframes solos-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

/* ── FLAGS ───────────────────────────────────────────── */
.solos-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.solos-flag-pill {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.58rem;
  letter-spacing: 0.06em;
  padding: 3px 10px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  transition: filter 0.15s;
}

.solos-flag-pill:hover {
  filter: brightness(1.15);
}

/* ── CHAIN ───────────────────────────────────────────── */
.solos-chain {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
  padding-left: 10px;
  border-left: 2px solid #ddd;
}

.solos-chain-entry {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}

.solos-chain-arrow {
  color: var(--ink-soft, #7a6a4a);
  font-size: 0.8rem;
  flex-shrink: 0;
}

.solos-chain-entry strong {
  font-family: var(--font-heading, 'Cinzel', serif);
  font-size: 0.75rem;
  color: var(--ink, #2a1e0e);
}

.solos-chain-desc {
  font-style: italic;
  font-size: 0.8rem;
  color: var(--ink-soft, #7a6a4a);
}

/* ── CARD ACTIONS ────────────────────────────────────── */
.solos-card-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #e8dcc8;
}

.solos-resolve-btn { font-size: 0.65rem; padding: 4px 14px; }
.solos-dismiss-btn { font-size: 0.65rem; padding: 4px 14px; }
  `;
  document.head.appendChild(s);
})();
