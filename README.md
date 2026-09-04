# Pendragon GM's Binder

A web-based campaign management tool for **King Arthur Pendragon 6th Edition**, built to run a single long-form tabletop campaign with one GM and a small group of players. It tracks NPCs, manors, family trees, yearly chronicles, battles, and the full sweep of a multi-generational Arthurian saga through a medieval-themed single-page app that the whole table connects to during and between sessions.

This is not a general-purpose VTT or a generic TTRPG tool. It was purpose-built for one campaign and the specific needs of Pendragon's dynastic, domain-management-heavy gameplay. That said, if you're running Pendragon and you're comfortable reading someone else's codebase, there may be useful ideas in here.

## What It Does

**NPC Roster & Character Cards:** Track stats, skills, passions, relationships, household membership, training, and life events, with stat block templates and JSON import. Glory can be an exact score, N/A, or a renown category with its Glory range (Non-knight through Legendary). Public background notes and private GM notes are separate; players can view and edit supported fields on their own household's characters. @mentions link characters throughout the app.

**Households & Family Trees:** SVG-rendered dynasty trees with drag, pan, zoom, household colours, founder and head-of-house flags, and PNG export. Track marriages, children, heirs, and inferred extended family. Players can manage their household relationships, progress eligible characters through training and knighting, and switch player knights through a succession flow.

**Manor Management:** Annual ledgers covering harvest, income, expenses, treasury, and demesne value. Manage improvements, fortifications, enhancements, damage and repairs, vassal holdings, and household personnel. Record Year includes conflict helpers and Book of the Manor reference tables; past-year edits can carry treasury changes forward. Export annual summaries as PNGs.

**NPC Manors & Succession:** A separate realm-wide holdings ledger tracks title holders, vacancies, succession, abdication, trustees for underage heirs, and associated NPCs. Changes of holder can write directly to the Chronicle.

**Stables:** Per-household horses with types, ages, riders, survival rolls, and histories. Dead or ruined horses remain in a Pet Cemetery with favourites.

**Winter Phase:** Survival, childbirth, and marriage rolls, with eligibility checks, modifiers, birth recording, and confirmation of deaths. Dashboard reminders highlight household training transitions and other matters requiring attention.

**Chronicle & Mausoleum:** A year-by-year campaign record with event categories, player submissions for GM approval, and entries drawn from NPC life events and completed battles. The Mausoleum preserves deceased characters and exports a Roll of the Fallen; an Out of Story view tracks absent living NPCs.

**Yearly & Solo Events:** Roll yearly, solo-adventure, and kin events for multiple knights, with optional AI-written flavour text. Resolved events become character life events and can be added to the campaign Chronicle. Solo Glory awards add to exact scores; N/A and renown categories stay unchanged, with the award recorded in the Solo Chronicle.

**Battle Records:** A GM console and player battle views for setup, commanders, participants, foes, morale, intensity, postures, passions, wounds, and kill/Glory tracking. Supports weapon selection, knocked-down flags, foe reassignment, live polling, round snapshots and undo, commander changes, and finalization into Chronicle records sized to the battle.

**Story Arcs & Session Prep:** GM-only plot threads with objectives, timelines, linked NPCs, and active/cold/complete states. Session prep gathers recaps, arcs in play, staged NPCs, open questions, and GM notes, moving from draft to ready to played. Both are shared with the MCP bridge for AI-assisted preparation.

**Personal Tools & Multiplayer:** GM, Player, and Observer roles; household dashboards; pinned Persons of Interest; tasks and reminders; private impressions and journals; GM-to-player notes; public NPC comment threads; notifications; broadcasts; and online presence. Polling refreshes connected clients during play.

**Caliburn (Discord Bot):** A companion bot ([separate repo](https://github.com/Solaire503/caliburn-bot)) uses the Binder API for NPC lookups and campaign records alongside Pendragon dice commands, feast/justice events, bug reports, and GM-triggered patch-note announcements.

**MCP Bridge:** An authenticated companion server exposes campaign lookups and targeted edits to NPCs, relationships, life events, Chronicle entries, story arcs, and session prep for connected AI tools.

The in-app **Features Guide & Patch Notes** provides more detail. Its content lives in [js/data/patch-notes.js](js/data/patch-notes.js).

## Tech Stack

- **Backend:** Python 3.12, Flask 3.1.0, single `server.py` file
- **Frontend:** Vanilla JavaScript, no frameworks or build step; scripts load in dependency order
- **Storage:** JSON files on disk, with atomic writes, save backups, and per-user data; no database
- **Styles:** Single CSS file with a parchment, gold, crimson, and verdigris palette
- **Auth:** Session-based accounts with Werkzeug and bcrypt, role checks, and CSRF protection
- **AI:** Optional Anthropic-powered event prose and battle summaries
- **Offline:** Network-first page navigation with a cached offline fallback; API and asset requests pass through to the network
- **MCP:** Separate Python companion using the MCP SDK and HTTPX

The deliberate constraints here are the point. No ORM, no React, no webpack, no Docker. The app runs on a single Ubuntu VM and deploys by updating the checkout and restarting a systemd service. Core dependencies are listed in [requirements.txt](requirements.txt): Flask, Werkzeug, bcrypt, and the Anthropic SDK. The MCP companion has its own environment and dependencies.

## Running It

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 server.py
```

The server listens on port **8765** and prints its address at startup. It attempts to use a local self-signed certificate; certificate generation requires `pyOpenSSL`. For local HTTP development, set `FORCE_HTTP=1` in `secrets.env` and open `http://localhost:8765`. The hosted installation uses a Cloudflare Tunnel for external HTTPS.

First-time setup is at `/setup` (localhost only) to create the GM account. Player and Observer accounts are created by the GM from within the app. Optional AI features use `ANTHROPIC_KEY` in `secrets.env`.

Production runs as `pendragon.service`; the MCP companion runs as `pendragon-mcp.service`. Caliburn is deployed separately. Campaign saves, credentials, per-player data, backups, and planning materials are local data rather than repository content.

## Project Structure

```text
server.py              Flask backend (routes, auth, file I/O, bot/MCP APIs)
mcp_server.py          MCP tools for campaign lookup and editing
index.html             SPA entry point and script load order
sw.js                  Service worker for offline fallback
offline.html          Offline page and cache-recovery controls
css/style.css          All styles
requirements.txt       Core Python dependencies
tests/                 Focused Glory/renown regression tests
js/
  store.js             Client state management (STORE global)
  components.js        Shared UI, NPC cards/editors, API wrapper, escaping
  app.js               App init, tab switching, polling
  multiplayer.js       Heartbeat, presence, broadcasts
  at-mention.js        NPC mentions and previews
  statblock-templates.js NPC stat block templates
  pins.js              Persons of Interest
  event-staging.js      GM event staging
  tasks.js             Tasks and reminders
  notifications.js     Notification bell and panel
  notes.js             Personal notes and impressions
  comments.js          NPC comment threads
  tabs/
    dashboard.js       Player and GM dashboards
    roster.js          NPC roster
    manors.js          Manor ledgers, improvements, damage, stables
    npc-manors.js      Realm holdings and succession
    families.js        Household view
    tree.js            SVG family trees and PNG export
    winter.js          Winter phase mechanics
    chronicle.js       Year-by-year campaign chronicle
    solos.js           Yearly, solo, and kin events
    mausoleum.js       Deceased and out-of-story characters
    journal.js         Private journal and GM-to-player notes
    battle.js          GM console and player battle views
    arcs.js            GM story arcs
    prep.js            GM session prep
  data/
    seed-npcs.js       Default NPC data
    seed-manors.js     Default manor data
    manor-tables.js    Manor rules reference tables
    patch-notes.js     In-app feature guide and changelog
```

## Validation & Status

Focused Glory/renown regression checks run with:

```bash
node tests/glory.test.cjs
.venv/bin/python -m unittest discover -s tests
```

The Python tests use a temporary server copy and temporary campaign data. They do not read or modify the live save. These checks cover Glory display/input handling, solo awards, and MCP API persistence and validation; they are not a comprehensive application test suite. Other changes rely on syntax checks, targeted API checks, and browser verification. There is no CI configured in this repository.

This is an active personal project, not a supported product. App versions and changes are recorded in the in-app patch notes. Issues and PRs from curious Pendragon GMs are welcome, but response times will reflect the reality that this is a hobby project maintained by one person between sessions.

## AI Use

This project was built with heavy AI assistance through Claude Code, with ongoing development also assisted by Codex. It's a hobby project, a learning exercise, and a love letter to a game I've been running for years, in roughly equal measure.

## License

MIT. See [LICENSE](LICENSE) for details.
