# Pendragon GM's Binder

A web-based campaign management tool for a Pendragon 6th Edition tabletop RPG. Single GM (Steve), 4 active players, hosted on Ubuntu Server via Proxmox.

## Tech Stack

- **Backend:** Python 3.12, Flask 3.1.0, single-file `server.py` (3,780 lines)
- **Frontend:** Vanilla JS (no frameworks, no build step), single `index.html` entry point
- **Storage:** JSON files on disk — no database
- **CSS:** Single `css/style.css` (91 KB)
- **Auth:** Werkzeug bcrypt, session-based, roles: GM / Player / Observer
- **Dependencies:** `requirements.txt` — Flask, Werkzeug, bcrypt (that's it)

## Running Locally

```bash
cd /home/solaire503/pendragon
source .venv/bin/activate
python3 server.py
# Runs on http://localhost:8765
```

Production runs as `pendragon.service` (systemd). Restart: `sudo systemctl restart pendragon.service`

## Project Layout

```
pendragon/
  server.py                  Flask backend (all routes, auth, file I/O)
  index.html                 SPA entry point
  sw.js                      Service worker (offline fallback, cache v17)
  config.json                Save file path config
  requirements.txt           Python deps
  css/style.css              All styles
  js/
    store.js                 Client state management (STORE global)
    components.js            Shared UI (Modal, CardPopup, API helper, esc())
    app.js                   App init, tab switching, polling bootstrap
    at-mention.js            @mention autocomplete in text fields
    statblock-templates.js   NPC stat block rendering
    multiplayer.js           Heartbeat, presence, broadcast polling
    pins.js                  Persons of Interest (pinned NPCs)
    event-staging.js         Event staging list (GM-only, localStorage)
    tasks.js                 Tasks & Reminders widget
    notifications.js         Notification bell + dropdown
    notes.js                 Player notes (general, manor, impressions)
    comments.js              NPC comment threads
    data/
      seed-npcs.js           Default NPC data
      seed-manors.js         Default manor data
      patch-notes.js         FEATURES + PATCH_NOTES arrays
    tabs/
      dashboard.js           Player/GM dashboard
      roster.js              NPC roster grid
      manors.js              Manor management (3,122 lines, largest)
      families.js            Family/household view
      tree.js                Canvas-based family tree
      winter.js              Winter phase mechanics
      solos.js               Solo adventures
      mausoleum.js           Dead knight archive
      chronicle.js           Year-by-year campaign chronicle
      journal.js             Player journal
  player_data/{username}/    Per-player: horses.json, pins.json, notes.json, notifications.json, tasks.json
  backups/                   Rolling last-5 saves
  planning/                  Design docs (gitignored)
```

## Script Load Order (matters)

Scripts load in `index.html` in this exact order — later scripts depend on earlier ones:

```
seed-npcs → seed-manors → patch-notes →
store → at-mention → statblock-templates → components →
dashboard → roster → manors → families → tree → winter →
solos → mausoleum → chronicle → npc-manors → battle →
pins → event-staging → tasks → notifications → notes → comments → journal →
arcs → prep → multiplayer → app
```

## Key Globals

- `APP` — main app object (all caps)
- `STORE` — client data store, loaded from server on init
- `window.esc()` — HTML escape helper, use on ALL untrusted data in innerHTML
- `isGM()` / `isObserver()` — role check helpers (components.js)
- `hhColour()` / `roleColour()` — household/role color helpers (components.js)
- `API.get/post/put/patch/del` — fetch wrapper returning `{ok, data, status, error}` (components.js)
- `Components` — shared UI factory (Modal, CardPopup, NPC cards, confirm dialogs)
- `EventStaging` — GM-only event staging list (localStorage, event-staging.js). Guard with `typeof EventStaging !== 'undefined'`
- `PinsManager` — Persons of Interest pin system (server-side, pins.js). Guard with `typeof PinsManager !== 'undefined'`

## Server Helpers

- `_read_json(path)` / `_write_json(path, data)` — use instead of raw json.loads/Path.read_text
- `_atomic_write(path, content)` — safe file writes with temp + rename
- `_safe_npc(npc, is_gm)` — strips GM-only fields for player/bot responses (intentionally keeps `notes`)
- `_serialize_comment(c, is_gm)` — always use when returning comment data from any endpoint
- `_csrf_check()` — call on all state-changing routes

## Auth Decorators

- `@login_required` — any authenticated user
- `@gm_required` — GM role only
- `@bot_required` — Caliburn bot Bearer token auth

## Data Model

- **Main save:** `binder-save.json` — NPCs in `living` (list) and `dead` (list), NOT an `npcs` dict
- **Chronicle:** `STORE.chronicle` is singular; values are flat arrays, not objects with `.events`
- **NPC fields:** `pronoun` (singular), `year_born` (not birth_year)
- **IDs:** Chronicle/solo IDs use `crypto.randomUUID()`, not `Date.now()`. Vassal IDs use `Date.now() + random suffix`
- **Manor DV:** Total DV = `m.dvBase` (manual) + sum of `improvement.dvMod` — not a single stored field
- **Manor Treasury:** Comes from latest history entry (`m.history[last].treasury`), NOT a direct field on the manor
- **NPC Training fields:** `page_type` (Page/Oblate/Druidic Initiate), `page_placed` (year), `page_court` (location), `training_path` (Squire/Steward/Clergy/Druid), `training_where`/`training_npc_id`, `came_of_age` (year)
- **Training path locks:** Oblate → Clergy only, Druidic Initiate → Druid only, Page → Squire/Steward/Clergy
- **Record Year persistence:** In-progress recording saved to `localStorage('pendragon_record_year')` with `_recordingKey` tracking which manor is recording
- **Players poll** `/api/player-load`; **GM polls** `/api/load` — never merge these
- `/setup` is localhost-only

## Critical Rules

- **HTML escaping:** Always use `esc()` on user data in innerHTML
- **onclick attributes:** NEVER use `JSON.stringify(stringVar)` inside `onclick="..."` — double quotes conflict with HTML attribute quotes. Use template literal with single quotes: `'${varName}'`
- **GM-only UI:** Add `.gm-only` class (has `display: none !important` for non-GM)
- **CardPopup vs Modal:** `Components.openNpcCardPopup(id)` always opens CardPopup (stacks on Modal). `Components.openNpcCard(id)` opens CardPopup if one is open, otherwise Modal
- **NPC delete cascade:** Client calls `STORE.deleteNpc(id)` then `API.post('/api/npc/<id>/purge')` — purge cleans server-side orphans
- **`addRelationship()` returns null on rejection** — callers should handle null
- **CSRF:** Every state-changing endpoint must call `_csrf_check()`
- **Versions:** `APP_VERSION` in server.py — bump on releases, keep SW cache name in sync

## CSS Conventions

- CSS custom properties for z-index scale: `--z-pocket` through `--z-popover`
- Medieval palette tokens: `--parchment`, `--oak`, `--verdigris-*`, `--crimson-*`, `--gold-*`
- Mobile breakpoint: 640px
- `@media (hover: none)` for touch-specific overrides

## Git / Deploy

- **Branch:** main
- **Remote:** https://github.com/Solaire503/pendragon-gm-binder (private)
- **Gitignored:** secrets.env, users.json, binder-save.json, player_data/, backups/, planning/, .claude/
- **Deploy:** push to main, then `sudo systemctl restart pendragon.service` on the server
- **Backups:** Nightly 3 AM cron → tar → rclone to Google Drive (30-day retention)

## Project Tracker (storybloq)

Battle Records work is tracked in storybloq (MCP). At session start, run `storybloq_status` + `storybloq_handover_latest` for current state. When you complete a ticket's work, mark it complete with `storybloq_ticket_update` and leave a handover before ending the session — a stale tracker is worse than none.

## Testing

No test suite. Verify changes with:
- `python3 -m py_compile server.py` — syntax check backend
- `node -c <file.js>` — syntax check frontend files
- `curl` against running server for API endpoints
- Browser testing for UI changes (Steve does this)

## Caliburn Discord Bot

Separate project at `/home/solaire503/caliburn-bot/`. Runs as `caliburn.service`. Talks to the binder via `/api/bot/*` endpoints using a Bearer token. Commands: /roll, /skill, /passion, /oppose, /trait, /damage, /feast, /justice, /speak, /npc, /chronicle, /year, /bugreport, /help.
