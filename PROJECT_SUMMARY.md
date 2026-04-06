# Pendragon GM's Binder — Project Summary
*Last updated: 2026-04-06 | Current version: v2.2.0 | Status: Stable, running on Ubuntu Server 24.04 (Proxmox VM), LAN + Cloudflare Tunnel pending*

> **📦 Source of truth:** https://github.com/Solaire503/pendragon-gm-binder (private repo)
> Clone with `git clone https://github.com/Solaire503/pendragon-gm-binder.git` on any machine.
> Secrets (`secrets.env`, `users.json`) and live runtime state (`binder-save.json`,
> `announcements.json`, `submissions.json`, `backups/`) are **intentionally gitignored** —
> they only exist on the host machine and must be recreated or copied manually on a new install.

> **📌 AI / New Conversation Handoff Notice**
> If you are an AI assistant picking this project up in a fresh conversation, **read this
> entire file first**. It is the master reference. The user (Steve) plans to format the
> C: drive; all persistent project state lives on G: and on GitHub. Claude memory files
> cannot be assumed to exist. Cross-reference these companion docs as needed:
>
> - **`Proxmox-Ubuntu_Plan.md`** — full Linux migration plan (Proxmox VM + Cloudflare Tunnel)
> - **`PHASE1_BRIEF.md`** — v2.0 delivery: Flask + auth + player views (complete)
> - **`PHASE2_BRIEF.md`** — v2.1 roadmap: broadcast + presence (done), chronicle submissions + mobile (pending)
> - **`PHASE3_BRIEF.md`** — v2.2 roadmap: notes + horse system (awaiting survival tables)
> - **`QA_REVIEW.md`** — comprehensive automated audit from 2026-04-05, most issues fixed in v2.1.1
> - **`MULTIPLAYER_NEEDS.md`** — original multiplayer spec that drove v2.0
> - **`claude-npc-instructions.md`** — NPC import schema for Claude.ai-generated NPC JSON

---

## About the User

- **Steve** is the GM of a Pendragon 6e campaign set around 498-499 AD (Arthurian).
- **No coding background.** Keep explanations jargon-free. Walk through changes instead of assuming familiarity with tooling.
- **Linux experience: minimal** — only prior exposure is "fighting with it on my Steam Deck." Any future Linux migration instructions must be copy-paste friendly and explain *why* each step exists.
- **Development style:** Steve directs, the AI implements. He trusts the AI to research, audit, plan, and code, then reviews results. He explicitly values:
  - **Concise responses** — no filler, no restatement of what he said.
  - **Subagents for big research tasks** — QA audits, feature implementation while he sleeps.
  - **Dispatching work in parallel** — e.g. QA review + Phase 2 implementation simultaneously.
  - **Plain-English explanations** of security/infrastructure concepts.
- **Players (PCs):** Zerk (Sir Marrin Blackwood), Dan (Sir Aberthol Cador), Rich (Sir Ceradoc Dawnwell), Tay (Dame Vivienne Westwood). A fifth household (Upavon) has NPCs but no player.

---

## What This Is

A unified, multi-user GM tool for a **Pendragon 6e** tabletop campaign. Originally a single-user localhost app (v1.x); now a full Flask multiplayer web app (v2.x) with GM + player roles, household-scoped personalised views, live broadcast/presence features, and a polished medieval-parchment aesthetic. Covers NPC roster, manor ledger, family trees, winter phase, solo events, and chronicle management in one cross-linked binder.

---

## Tech Stack

- **Backend:** Python 3.14 + Flask (single-file `server.py`), Werkzeug password hashing, `threading.Lock` for concurrent safety
- **Frontend:** Vanilla JS, no frameworks, no build step, loaded via `<script>` tags in explicit order
- **Storage:** Three-tier — localStorage (primary in-memory), `binder-save.json` on disk (source of truth), rolling backups in `backups/` (last 5)
- **Auth:** Session cookies, `@login_required` + `@gm_required` decorators, bcrypt passwords in `users.json`
- **Secrets:** `secrets.env` file (Anthropic API key, Flask secret, `FORCE_HTTP=1` flag) — never served to browser
- **HTTPS:** Currently disabled on LAN (`FORCE_HTTP=1`). Planned: Cloudflare Tunnel provides real HTTPS after Linux migration.
- **AI flavor text:** Anthropic Claude Haiku via `/api/ai` proxy endpoint, GM-only

---

## Hosting & Deployment State (as of 2026-04-06)

### Current (Ubuntu Server on Proxmox — v2.2.0+)
- Running on Ubuntu Server 24.04 LTS VM inside Proxmox VE on `192.168.1.43`
- Managed as a systemd service (`pendragon.service`): auto-starts on boot, restarts on failure
- App files: `/home/solaire503/pendragon/`
- LAN URL: `http://192.168.1.43:8765`
- Logs: `sudo journalctl -u pendragon.service -f`
- Restart: `sudo systemctl restart pendragon.service`

### Next Step (Cloudflare Tunnel)
- `cloudflared` is installed; quick tunnel was tested and confirmed working
- Waiting on: domain pointed at Cloudflare, then `cloudflared tunnel login` → `cloudflared tunnel create pendragon` → config YAML → `cloudflared.service` systemd unit
- Result: stable public HTTPS URL, no port forwarding, no cert management

---

## File Structure

```
Pendragon GM's Binder/
  index.html                     — app shell, nav, script load order
  offline.html                   — Pendragon-themed fallback page (flickering candle)
  sw.js                          — service worker, caches offline.html
  server.py                      — Flask server: auth, routes, save/load, multiplayer state
  config.json                    — active save file path (per-machine)
  secrets.env                    — API keys, Flask secret, FORCE_HTTP flag (NEVER commit)
  users.json                     — hashed user accounts (GM + players)
  binder-save.json               — the actual campaign data (living, dead, manors, chronicle, etc.)
  backups/                       — rotating 5 most-recent save backups
  cert.pem / key.pem             — auto-generated self-signed cert (unused while FORCE_HTTP=1)
  css/
    style.css                    — full stylesheet, medieval parchment aesthetic
  js/
    app.js                       — APP object, tab routing, patch notes, features guide, boot
    store.js                     — STORE object, localStorage + file sync, migrations
    components.js                — NPC cards, edit forms, relationship modal, HoverCard, Toast, Modal
    at-mention.js                — @[Name](id) token rendering and peekCard modal stack
    multiplayer.js               — broadcasts, presence/heartbeat polling, presence widget
    data/
      seed-npcs.js               — starter NPC data
      seed-manors.js             — starter manor data
    tabs/
      dashboard.js               — GM dashboard + personalised player dashboard + succession flow
      roster.js                  — NPC roster, sidebar filters
      manors.js                  — manor management (GM-editable, player read-only)
      families.js                — household detail + family tree launcher
      tree.js                    — family tree SVG renderer (drag/pan/zoom, pinned positions)
      winter.js                  — Winter Phase (survival + childbirth + events)
      solos.js                   — yearly/solo/kin events rolls + AI flavor
      mausoleum.js               — dead NPCs + Roll of the Fallen PNG export
      chronicle.js               — year-by-year event log

  PROJECT_SUMMARY.md             — this file (master reference)
  Proxmox-Ubuntu_Plan.md         — Linux migration plan
  PHASE1_BRIEF.md                — v2.0 delivery doc (multiplayer / auth)
  PHASE2_BRIEF.md                — v2.1 roadmap
  PHASE3_BRIEF.md                — v2.2 roadmap
  QA_REVIEW.md                   — automated audit report
  MULTIPLAYER_NEEDS.md           — original v2.0 spec
  claude-npc-instructions.md     — Claude.ai NPC import guide
```

---

## Data Model (store.js)

**Top-level collections:**
- `STORE.living[]`, `STORE.dead[]` — NPC arrays
- `STORE.relationships[]` — `{id, sourceId, targetId, type, notes}`, directional
- `STORE.households[]` — string array
- `STORE.manors{}` — object keyed by household name
- `STORE.treePos{}` — user-pinned family tree positions (persist)
- `STORE.chronicle{}` — object keyed by year (string), value is **flat array** of `{id, text, cat, ts}` (NOT nested under `.events`)
- `STORE.year` — current campaign year (integer)

**Data version:** `DATA_VERSION = 6` with migration chain.

**NPC fields:**
`id, status ('Alive'|'Dead'), name, role, pronoun, household, manor, year_born, year_died, age, glory, eligibility, dowry, notes, passions, skills, stats, blessed, blessed_note, fate_touched, con (default 13), barren, came_of_age, out_of_story, out_of_story_note, round_table, page_court, training_path, training_where, personality_note, soloEvents[]`

**Relationship types:**
Spouse · Betrothed · Lover · Former Spouse · Child · Adopted Child · Bastard · Parent · Adoptive Parent · Sibling · Half-Sibling · Vassal · Squire · Page · Ward · Guardian · Aunt/Uncle · Niece/Nephew · Grandparent · Grandchild · Cousin · Sworn Brother/Sister · Other

**Direction convention:** Child/Bastard/Adopted → `sourceId=child`, `targetId=parent`. Automatic direction correction based on `year_born`.

**Inferred relationships (computed, never stored):**
- `STORE.inferredSiblings(npcId)` — Full/Half/Step/Sibling
- `STORE.inferredGrandparents(npcId)` — Grandparent/Grandchild
- `STORE.inferredAuntsUncles(npcId)` — Aunt/Uncle/Niece/Nephew
- `STORE.inferredInLaws(npcId)` — Good-Father/Mother/Son/Daughter/Brother/Sister (pronoun-aware)

**Manor fields:** `baseHarvest, lord_id, steward_id, heir_id, history[], improvements[], propertyDamage[], vassals[]`. Also legacy `notes` field with "Steward: Name" regex fallback (for stewards not linked by ID).

**Key STORE methods:**
```js
STORE.addNpc(npc), STORE.getNpc(id), STORE.updateNpc(id, changes),
STORE.killNpc(id, year, notes), STORE.addRelationship(rel),
STORE.getRelationships(npcId), STORE.householdMembers(name) // case-insensitive,
STORE.save(), STORE.syncToFile(), STORE.loadFromFile(), STORE.setYear(y)
```

---

## Server API Endpoints (server.py)

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/` | GET | login | Serves `index.html` with `window.__USER__` injected |
| `/setup` | GET/POST | public (only when users.json missing) | Initial password setup |
| `/login` | GET/POST | public | Login form + session creation (validates `next` param to prevent open redirect) |
| `/logout` | GET | login | Clears session |
| `/sw.js` | GET | public | Service worker file |
| `/offline.html` | GET | public | Offline fallback page |
| `/<path:filename>` | GET | login | Static asset serving with BLOCKED_FILES + BLOCKED_SUFFIXES check |
| `/api/me` | GET | login | Current user info |
| `/api/config` | GET | login | Current save file path + `exists` + `hasApiKey` |
| `/api/config` | POST | **gm** | Update save file path |
| `/api/load` | GET | login | Returns save file JSON |
| `/api/save` | POST | **gm** | Writes JSON body to save file (thread-locked) |
| `/api/new` | POST | **gm** | Creates empty save file |
| `/api/ai` | POST | **gm** | Proxies to Anthropic API for flavor text |
| `/api/drives` | GET | **gm** | Drive letters (Windows) — needs Linux adaptation |
| `/api/browse` | GET | **gm** | Directory listing for file picker |
| `/api/succession` | POST | login | Player Knight succession — players limited to own household |
| `/api/broadcast` | POST | **gm** | GM sends announcement |
| `/api/broadcasts` | GET | login | Poll for new broadcasts (`?since=<ts>`) |
| `/api/heartbeat` | POST | login | Updates presence record |
| `/api/presence` | GET | login | Returns users seen in last 60s |

**Polling intervals (multiplayer.js):**
- Broadcasts: every 10 seconds
- Heartbeat: every 15 seconds (from boot)
- Presence: every 15 seconds (offset 3s from boot)
- Player data refresh (`/api/load`): every 30 seconds (for players; auto-picks up GM saves)

**Key server patterns:**
- `_save_lock` threading.Lock around all save-file writes + rotation
- `_users_lock` around user file reads/writes
- `_mp_lock` around in-memory broadcast/presence state
- `_restart_pending` Event; `restart` console command sets this, an active save clears it by deferring
- `SECRETS` dict loaded once at import from `secrets.env`
- `SESSION_COOKIE_SECURE` auto-toggled based on `FORCE_HTTP` flag

---

## Access Control Summary

| Tab / Feature | GM Steve | Players |
|---|---|---|
| Dashboard | Full GM view + broadcast + pending age + marriage | Personalised household view |
| Roster | Full — edit, add, import | Read-only |
| Manors | Full — edit, record year | Read-only own manor |
| Families | Full | Hidden |
| Winter | Full | Hidden |
| Mausoleum | Full | Read-only |
| Chronicle | Full — add/delete events | Read-only |
| Export / Import | Visible | Hidden |
| API Key button | Visible | Hidden |
| Add NPC / Import | Yes | No |
| Change Player Knight (succession) | N/A | Yes (own household only) |
| Send Broadcast | Yes | No |
| Presence indicator | Sees all | Sees all |

---

## CSS Design Tokens

```css
--vellum / --vellum-mid / --vellum-dark / --vellum-deep   (parchment backgrounds)
--gold / --gold-bright / --gold-pale / --gold-faint
--crimson / --crimson-mid / --crimson-pale / --crimson-faint
--verdigris / --verdigris-mid / --verdigris-pale / --verdigris-faint
--cobalt / --cobalt-mid                (blue tones)
--violet-mid                           (squire/training colour)
--amber-mid                            (steward colour)
--ink / --ink-soft / --ink-mid         (text)
--font-display: 'Cinzel Decorative'
--font-heading: 'Cinzel'
--font-body:    'EB Garamond'
```

**Household colours:** Blackwood=#7a1c1c (crimson), Cador=#1e3a5f (cobalt), Dawnwell=#2d5a4a (verdigris), Westwood=#4a3a1e (amber), Upavon=#4a2070 (violet).

---

## Major Feature Areas

### Player Dashboard (v2.0+)
- Daily-rotating Arthurian greeting addressed by name and title
- Pronoun-aware title: "My Lord" / "My Lady" / "My Liege" (fixed in v2.1.1 — was reading `pronouns` instead of `pronoun`)
- Manor snapshot (treasury, harvest, income, improvements, damage)
- Attention items: treasury deficit, no steward, no heir, overdue repairs, age transitions, marriage eligibility, betrothal-ready-to-wed
- Household roster (sortable by rank/age/A-Z)
- Recent deaths (own household in crimson)
- Recent chronicle — last 5 events across last 2 years (fixed in v2.1.1 — was reading `.events` on a flat array)

### Succession Flow (v2.0+)
Multi-step modal:
1. What happened? Died / Retired / Just Switching
2. Died: cause + year, moves NPC to Mausoleum. Retired: logs "Retired from Questing" life event, demotes to Knight.
3. Pick new PK from household grid
4. Confirm → `POST /api/succession` → server-side save → reload

### GM Broadcast + Presence (v2.1)
- GM types in a card on dashboard → appears as gold-bordered dismissible banner + toast on all connected clients
- Green-dot presence widget in header → click to expand list of online users
- 60-second stale timeout

### NPC Cards & Relationships
- All fields, Blessed (✦) and Fate-Touched (◈) flags, age flags (auto-detects page/squire/knighting thresholds)
- Two-way Age ↔ Birth Year sync in edit form
- Relationships with direction auto-correction and duplicate detection
- @mention system: `@[Name](id)` tokens in text fields render as clickable links, open NPC cards via `Modal.push()` stack
- HoverCard: `data-npc-hover="id"` attribute → floating tooltip globally
- Import from Claude.ai: copyable prompt + paste/file picker, parses markdown fences, normalises pronouns

### Family Tree (families.js + tree.js)
- SVG drag/pan/zoom, Dynasty Layout (BFS from founder) + Force Layout
- User-pinned positions (persisted in `treePos`), click badge to release all
- Right-click menu: Set Dynasty Founder, Set Head of House, Start Connection, Bulk-Add Children, Send to Pocket
- Sibling brackets (orthogonal arcs; dashes for half-siblings), bastard dashed drop line, adopted dash pattern
- Head of House = crimson colour bar + ⚜ HEAD OF HOUSE ⚜ label
- PNG export at 2×/3×/4×

### Manor Management
- Lord/Steward (with Stewardship skill)/Heir pickers
- Passion bars: Hatred of Landlord, Care for Commoners (/20, CRIT pill at 20+)
- Record Year modal: full ledger (harvest, steward industry, improvement income, vassal income, discretionary, extras; lifestyle, maintenance, family, build, misc expenses; misfortune factors)
- Year Summary PNG export per history row

### Winter Phase (three sub-tabs)
- **Survival rolls:** Infant/Child/Women/Adult/Elder/Very Old categories with auto-exempt logic
- **Childbirth rolls:** CON-based d20, fumble/crit tables, record birth creates linked child, resolve tragedy applies outcomes
- **Yearly/Solo/Kin Events:** Tier I/II toggles, d6/d20 tables, AI flavor text (Claude Haiku, Malory style, 10-slot rotation, banned clichés)

### Mausoleum
- Grid of dead NPCs, household filter, click → card
- Roll of the Fallen PNG export (gothic parchment style, per year)

### Chronicle
- Per-year event log, add/delete (GM only), year navigation, event categories

---

## Modal Stack System

```js
Modal._stack: []                    // array of { html, className } snapshots
Modal.open(html, opts)              // base modal
Modal.push(html, opts)              // saves current, shows new with ← Back button
Modal.pop()                         // restores previous; empty stack → close()
Modal.close()                       // closes overlay, clears stack
```

`Modal._formDirty` tracks unsaved edits. Close/pop with dirty state prompts confirmation. Listeners for `input`/`change` attached with `{capture: true}` — known minor leak across open/close cycles (M-7 in QA).

ESC: pops one layer if stack has entries; otherwise closes.

`AtMention.peekCard(id)` — if a modal is already open, pushes it to stack then opens linked NPC card. Otherwise opens directly.

---

## Patch History (abbreviated)

| Version | Date | Summary |
|---|---|---|
| v1.0 – v1.7.4 | Various | Single-user GM app: roster, manors, families, tree, winter, solos, mausoleum, chronicle, AI flavor, @mentions, inferred relationships, Claude.ai import |
| **v2.0.0** | 2026-04-04 | **Multiplayer release:** Flask server, user accounts (GM + 4 players), role-based access, HTTPS, player dashboard, succession flow, read-only player views, GM dashboard attention panels |
| **v2.1.0** | 2026-04-05 | **Live session features:** GM broadcast messages, player presence/who's-online indicator, heartbeat polling |
| **v2.1.1** | 2026-04-05 | **QA pass + security hardening:** C-1/C-2 critical bugs (pronoun, chronicle data structure), H-1 through H-6 highs (open redirect, cert backups, gm_required gaps, sendBeacon check, version mismatch, `App`→`APP` typo), plus ~10 medium fixes — see QA_REVIEW.md |
| **v2.2.0** | 2026-04-06 | **Ubuntu migration + player tools:** Migrated to Ubuntu Server 24.04 on Proxmox (systemd service), Fate nav dropdown (Winter + Mausoleum grouped), Archive header dropdown (Export + Import grouped), player chronicle submissions (submit → GM review/approve), mobile layout pass for ~360px screens, year arrows GM-only |

---

## Known Limitations & Deferred Work

### Not Yet Implemented
- **Phase 3 (v2.3):** Per-player notes system, horse tracking — waiting on survival tables from Steve
- **Cloudflare Tunnel:** Server is ready; tunnel setup pending (domain + cloudflared config)
- **CSRF protection:** Not implemented. Mitigated by `SESSION_COOKIE_SAMESITE='Lax'`. Acceptable for trusted LAN use; revisit before any public-facing deployment.
- **Conflict resolution on concurrent saves:** Last write wins. Backup rotation provides recovery. Not an issue with single GM.
- **`/api/browse` directory traversal:** Full FS enumeration for GM; fine for local trusted tool.

### Intentional Design Choices
- **Vassal manors excluded from family tree** — feudal relationship, not bloodline
- **Inferred family sections are display-only** — never written to `STORE.relationships`, never drawn as tree lines
- **Relationships not imported via Claude.ai JSON** — must be added manually after import
- **Manual repositioning of dynasty founder** not yet implemented
- **Good-Brother/Sister inference deliberately limited** — uses stored siblings only, no deep chains

### QA Review Items Deferred (low ROI / bigger refactor)
See `QA_REVIEW.md` for full detail. Deferred: M-1 CSRF, M-3 `/api/browse` FS traversal, M-7 modal listener accumulation, plus most Low-severity items.

---

## How to Run (Current — Ubuntu Server via Proxmox)

1. `pendragon.service` auto-starts on boot — nothing needed for normal operation
2. LAN URL: `http://192.168.1.43:8765`
3. Logs: `sudo journalctl -u pendragon.service -f`
4. Restart: `sudo systemctl restart pendragon.service`
5. Login with GM credentials (`/setup` on first run to create passwords)

## How to Run (Future — with Cloudflare Tunnel)

Once the tunnel is configured:
1. Service still auto-starts as above; `cloudflared.service` will also run
2. Visit the Cloudflare Tunnel URL from any device on the internet (no VPN needed)
3. See `Proxmox-Ubuntu_Plan.md` for the full tunnel setup steps

---

## Critical Files If Starting Fresh

If an AI assistant is picking this up in a new conversation and needs to understand the project quickly, read in this order:

1. **This file (`PROJECT_SUMMARY.md`)** — big picture, state, tech stack
2. **`PHASE1_BRIEF.md`** — what v2.0 delivered (the multiplayer foundation)
3. **`QA_REVIEW.md`** — known issues and what's been fixed
4. **`server.py`** (top 300 lines minimum) — routes, auth, thread safety patterns
5. **`js/app.js`** — `APP_VERSION`, `PATCH_NOTES` (version history), `FEATURES` (user guide entries), boot sequence
6. **`js/store.js`** — data model, save/load semantics
7. **`js/tabs/dashboard.js`** — player vs GM dashboard rendering, succession flow
8. **`Proxmox-Ubuntu_Plan.md`** — where we're heading next

---

## Conversation Handoff Notes (what to know after a context reset)

- **Latest session (2026-04-06):** Updated all documentation, patch notes, and features guide to reflect v2.2.0. Previous session (2026-04-05): Full QA audit via subagent, all critical + high + most medium fixes (v2.1.1). Multiplayer broadcast + presence (v2.1). Migrated to Ubuntu Server on Proxmox (v2.2.0), delivered Fate/Archive dropdowns, player chronicle submissions, mobile layout pass, year arrows GM-only.
- **Working mode:** Steve often says "go ahead and implement all fixes" — trust him and batch them efficiently. He prefers one summary message at the end over step-by-step narration. When he launches parallel work, respect it: don't duplicate effort across agents.
- **Terminology:** "The binder" = this app. "Phase 1/2/3" = major release milestones. "PK" = Player Knight. "Solos" = solo/yearly/kin event rolls.
- **Common gotchas encountered:**
  - `STORE.chronicle` is **singular** (not `chronicles`) and its values are **flat arrays**, not objects with `.events`
  - NPC age field is **`year_born`**, not `birth_year`
  - NPC pronoun field is **`pronoun`** (singular), not `pronouns`
  - `STORE.householdMembers()` is case-insensitive (fixed earlier)
  - Global is `APP` (all caps), not `App`
  - `isGM()` is a global helper in `components.js`
- **Don't regenerate certs unless asked.** `FORCE_HTTP=1` in `secrets.env` disables them intentionally for LAN use.
- **Don't re-implement features that are already done.** Check `FEATURES` and `PATCH_NOTES` arrays in `js/app.js` first.

---

*End of summary. When updating, bump the "Last updated" line and consider whether the handoff notes need to change.*
