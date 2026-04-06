# Pendragon GM's Binder — v2.4 Roadmap
## Phase 4 · Caliburn Discord Bot Integration
### Status: PLANNING

---

## What Phase 4 Is

Caliburn is the campaign's Discord bot — currently running standalone on Steve's desktop,
doing dice rolls, horse survival, feast descriptors, and winter phase guides.

Phase 4 has two goals:
1. **Move Caliburn to the Ubuntu server** so it runs alongside the Binder, always-on,
   no desktop required.
2. **Connect Caliburn to the Binder's data** so it can answer live questions about the
   campaign — NPCs, manors, chronicle, current year — directly from the source of truth.

A third, optional goal: **Chaos Mode** — a toggleable personality that makes Caliburn
dramatically, entertainingly unreliable when the table wants a laugh.

---

## What Caliburn Currently Does (standalone)

| Command | Description | Fate |
|---------|-------------|------|
| Dice rolls | Standard RPG dice (d6, d20, etc.) | Stay in Caliburn |
| Horse survival | Per-horse CON survival rolls | **Move to Binder** (Phase 3) then Caliburn calls Binder |
| Feast descriptors | Random course / food flavour | Stay in Caliburn, optionally enriched |
| Winter phase guides | Rules reference for winter events | Stay in Caliburn; could pull live year from Binder |

---

## Feature Scope

### ✅ Prerequisites (must land first)
- Phase 3: Horse survival system in the Binder (so Caliburn has something to query)
- Cloudflare Tunnel or LAN access between Caliburn and the Binder API

---

### 🔲 Move Caliburn to Ubuntu Server
**Status: Not started**

Run Caliburn as a second systemd service alongside `pendragon.service`:
- `caliburn.service` — same pattern: venv, auto-start, restart-on-failure, log file
- Both services share the same machine; Caliburn talks to the Binder via
  `http://127.0.0.1:8765/api/...` — no network hop, no auth friction
- Discord token stored in `caliburn.env` (never committed)

Benefit: bot stays online even when Steve's desktop is off. Session-night reliability.

---

### 🔲 Binder Read API for Caliburn
**Status: Not started**

A lightweight read-only endpoint the bot can call without a full user session:

```
GET /api/bot?key=<BOT_KEY>&query=<type>&...
```

Or alternatively, Caliburn authenticates as a dedicated `caliburn` user (bot role, read-only).

**Queries to support (in priority order):**

| Query | What Caliburn Returns in Discord |
|-------|----------------------------------|
| `npc/<name>` | Name, role, household, glory, key traits — formatted for Discord |
| `manor/<household>` | Treasury, harvest, steward name, active improvements |
| `year` | Current campaign year |
| `chronicle/<year>` | Events logged for that year |
| `roster/<household>` | Living members of a household, ranked |
| `horse/<name>` | Horse stats + last survival roll result (Phase 3 dependency) |
| `random/npc` | A random living NPC — good for chaos prompts |

Example Discord output:
```
/binder npc Terrwyn
───────────────────────
Dame Terrwyn ferch Cadoc · Lady · Dawnwell
Born 465 AD (age 33) · Glory: 85
Passions: Love (husband) 15, Hate (clergy) 12
Skills: Industry 16, Chirurgery 13, Intrigue 14
───────────────────────
```

---

### 🔲 Binder-Aware Commands
**Status: Not started**

Replace or upgrade Caliburn's existing static commands with live Binder data:

| Command | Current | With Binder |
|---------|---------|-------------|
| `/winter` | Static rules guide | Pulls current campaign year, contextualises the guide |
| `/horse <name>` | Rolls against stored CON | Pulls horse CON from Binder, logs result back |
| `/manor <household>` | Not implemented | Live treasury + harvest summary |
| `/npc <name>` | Not implemented | Full NPC card summary |
| `/year` | Not implemented | Current campaign year from Binder |

---

### 🔲 Chaos Mode
**Status: Not started — design only**

A toggleable personality mode. When active, Caliburn becomes dramatic, unreliable,
and entertainingly wrong in ways that are clearly a bit.

**Activation:** `/chaos on` / `/chaos off` (GM only, or any player for session laughs)

**Chaos behaviours (examples):**

- Dice rolls reported with unnecessary gravitas: *"The bones speak... a 14. The ancestors
  are neither impressed nor ashamed."*
- NPC lookup occasionally returns a completely different NPC with a disclaimer:
  *"Ah yes, Sir Aldric. Wait — I'm being told this is actually Dame Terrwyn. My apologies."*
- Manor treasury reported with mild catastrophising:
  *"Dawnwell holds 47 libra. This is either fine or a portent. Probably fine."*
- Random unsolicited omens during dice rolls below 5.
- `/feast` in chaos mode returns increasingly unhinged courses.
- Chaos mode resets at midnight or on `/chaos off`.

**Implementation path:** Claude Haiku via the same `/api/ai` proxy the Binder already uses,
with a chaos-flavoured system prompt. Keeps it consistent and cost-light.

---

### 🔲 Binder → Discord Notifications (stretch goal)
**Status: Not started — lower priority**

The Binder pushes certain events to a Discord channel automatically:

| Trigger | Discord Message |
|---------|----------------|
| GM saves after Winter phase | Summary of deaths, births, notable events |
| GM sends a Broadcast | Mirrors to a #session-table Discord channel |
| NPC death recorded | *"The Roll of the Fallen claims another..."* announcement |
| Chronicle entry added | Posted to #chronicle channel |

Requires a Discord webhook URL stored in `caliburn.env`. No new server-side endpoints
needed — Caliburn polls or the Binder posts directly to the webhook.

---

## Architecture

```
Ubuntu Server (192.168.1.43)
  ├── pendragon.service     → Flask Binder on 127.0.0.1:8765
  └── caliburn.service      → Discord bot, queries 127.0.0.1:8765/api/bot
          ↓
    Discord (gateway connection — outbound only, no port forwarding needed)
```

Both services share the machine. Caliburn never needs to be exposed to the internet —
Discord connections are outbound from the bot, not inbound.

---

## New Server Endpoints Needed

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/bot` | GET | bot key | Read-only binder queries for Caliburn |
| `/api/bot/log` | POST | bot key | Caliburn writes horse roll results back to Binder |

The bot key is a separate secret in `secrets.env` (`BOT_KEY=...`), distinct from the
Anthropic key and Flask secret.

---

## Files Changing / New

| File | Change |
|------|--------|
| `server.py` | New `/api/bot` endpoints (read-only + log-write) |
| `secrets.env` | Add `BOT_KEY` |
| `caliburn/` | New directory — bot code, `caliburn.env`, `requirements.txt` |
| `/etc/systemd/system/caliburn.service` | New systemd unit |
| `PROJECT_SUMMARY.md` | Update when Phase 4 ships |

---

## What Steve Needs to Provide

- [ ] Current Caliburn source code (to assess what's portable as-is)
- [ ] Discord bot token (goes in `caliburn.env`, never committed)
- [ ] Which Discord server / channels Caliburn posts in
- [ ] Chaos Mode: any specific behaviours you want, or happy to let it riff?
- [ ] Binder → Discord notifications: which events matter, which channel?

---

## Steps in Order

1. Copy Caliburn source to `caliburn/` on the server, confirm it runs
2. Create `caliburn.service` systemd unit, test auto-start
3. Add `/api/bot` read endpoint to `server.py` + `BOT_KEY` to `secrets.env`
4. Port existing Caliburn commands to query Binder where applicable
5. Build Chaos Mode (Claude Haiku prompt)
6. Build horse roll logging back to Binder (Phase 3 dependency)
7. Binder → Discord webhook notifications (stretch)
