# Pendragon GM's Binder

A web-based campaign management tool for **King Arthur Pendragon 6th Edition**, built to run a single long-form tabletop campaign with one GM and a small group of players. It tracks NPCs, manors, family trees, yearly chronicles, and the full sweep of a multi-generational Arthurian saga, all through a medieval-themed single-page app that the whole table connects to during and between sessions.

This is not a general-purpose VTT or a generic TTRPG tool. It was purpose-built for one campaign and the specific needs of Pendragon's dynastic, domain-management-heavy gameplay. That said, if you're running Pendragon and you're comfortable reading someone else's codebase, there may be useful ideas in here.

## What It Does

**NPC Roster:** Full stat blocks, relationship tracking, household membership, and @mention-linked references across the app. Supports GM-only fields that stay hidden from player views.

**Manor Management:** The largest module. Tracks demesne value, improvements, treasury, annual income, and year-over-year history for each knight's holdings. Handles the economic layer that Pendragon leans on heavily.

**Family Trees:** Canvas-rendered dynasty trees with household grouping. Tracks marriages, children, heirs, and the generational throughline that *is* a Pendragon campaign.

**Winter Phase:** Mechanical support for Pendragon's end-of-year phase: aging, childbirth, training, economic rolls, and the events that accumulate between adventures.

**Chronicle:** Year-by-year campaign record. What happened, who was there, what changed. The long memory of the campaign.

**Solo Adventures:** A space for between-session solo play and downtime scenes.

**Multiplayer:** Role-based access (GM, Player, Observer) with session-based auth, heartbeat presence tracking, and broadcast polling so changes propagate across connected clients without a page refresh.

**Caliburn (Discord Bot):** A companion Discord bot ([separate repo](https://github.com/Solaire503/caliburn-bot)) that talks to the Binder's API for dice rolls, skill checks, NPC lookups, chronicle entries, and feast/justice mini-games, so players can interact with campaign data without leaving Discord.

## Tech Stack

- **Backend:** Python 3.12, Flask 3.1.0, single `server.py` file
- **Frontend:** Vanilla JavaScript, no frameworks, no build step, just script tags in load-order
- **Storage:** JSON files on disk, no database
- **Styles:** Single CSS file with custom properties for a medieval palette (`--parchment`, `--oak`, `--verdigris`, `--crimson`, `--gold`)
- **Auth:** Werkzeug + bcrypt, session-based
- **Offline:** Service worker with cache-first strategy and offline fallback page

The deliberate constraints here are the point. No ORM, no React, no webpack, no Docker. The app runs on a single Ubuntu VM, stores data in flat JSON, and deploys by pushing to main and restarting a systemd service. The entire dependency list is Flask, Werkzeug, and bcrypt.

## Running It

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 server.py
# → http://localhost:8765
```

First-time setup is at `/setup` (localhost only) to create the GM account. Player accounts are created by the GM from within the app.

## Project Structure

```
server.py              Flask backend (all routes, auth, file I/O)
index.html             SPA entry point
sw.js                  Service worker
css/style.css          All styles
js/
  store.js             Client state management (STORE global)
  components.js        Shared UI (modals, cards, API wrapper, escaping)
  app.js               App init, tab switching, polling
  multiplayer.js       Heartbeat, presence, broadcast polling
  tabs/
    dashboard.js       Player and GM dashboards
    roster.js          NPC roster grid
    manors.js          Manor management (largest module)
    families.js        Family/household view
    tree.js            Canvas-based family tree renderer
    winter.js          Winter phase mechanics
    chronicle.js       Year-by-year campaign chronicle
    solos.js           Solo adventures
    mausoleum.js       Dead knight archive
    journal.js         Player journal
  data/
    seed-npcs.js       Default NPC data
    seed-manors.js     Default manor data
    patch-notes.js     In-app changelog
```

## Status

This is an active personal project, not a supported product. There are no tests, no CI, no versioned releases. It works well for the campaign it was built for. Issues and PRs from curious Pendragon GMs are welcome, but response times will reflect the reality that this is a hobby project maintained by one person between sessions.

## AI Use

This project is developed with heavy AI assistance (Claude Code). It's a hobby project, a learning exercise, and a love letter to a game I've been running for years, in roughly equal measure.

## License

MIT. See [LICENSE](LICENSE) for details.
