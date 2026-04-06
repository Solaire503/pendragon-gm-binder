# Pendragon GM's Binder — v2.0 Release
## Phase 1 · Flask Server, Auth & Player Views
### Status: COMPLETE

---

## What v2.0 Is

v1.0 was a single-module Python `http.server` — no auth, localhost-only, GM-only.

v2.0 is a full Flask application with user accounts, role-based access, HTTP(S), and a
dedicated player-facing experience. The GM's workflow is unchanged. Players now have
their own live view of their household, manor, and chronicle.

> **Hosting note (updated 2026-04-06):** The app migrated to Ubuntu Server 24.04 on
> Proxmox (v2.2.0). It now runs as a systemd service at `192.168.1.43:8765`. The
> self-signed certificate flow and Windows console restart pattern are replaced by
> `sudo systemctl restart pendragon.service`. Cloudflare Tunnel for public HTTPS is
> the next infrastructure step — see `Proxmox-Ubuntu_Plan.md`.

---

## What Was Delivered

### Infrastructure
- Flask server replacing `http.server`, binding to `0.0.0.0` (LAN + internet accessible)
- Optional self-signed HTTPS (`cert.pem` / `key.pem`, auto-generated) — **disabled on
  LAN via `FORCE_HTTP=1` in `secrets.env`** to avoid browser HTTPS-upgrade friction.
  Will be replaced entirely by Cloudflare Tunnel TLS termination after Linux migration.
- Session-based auth with Werkzeug password hashing (bcrypt)
- Login rate limiting (5 attempts per 5-minute window), with periodic pruning of stale IPs
- Role enforcement: `login_required` and `gm_required` decorators on all API routes
- API key and Flask secret moved to `secrets.env` (never served to browser)
- `window.__USER__` injected server-side before page render — no flash of GM content
- `html.is-gm` / `html.is-player` CSS classes applied synchronously in `<head>`
- Console command listener: `restart`, `status`, `users`, `help` (Windows-only pattern;
  becomes `sudo systemctl restart pendragon` + `journalctl -u pendragon` under systemd)
- Deferred restart: typing `restart` during a save queues it until the write completes
- Werkzeug access log suppressed + stderr filter for low-level HTTP parser noise
- Per-save `threading.Lock` prevents file corruption if restart is triggered mid-write
- Per-user-file `threading.Lock` prevents concurrent password-change races

### Player Experience
- **Player Dashboard** — personalized per household:
  - Daily-rotating Arthurian greeting addressed to the Player Knight by name and title
  - Manor snapshot: treasury, harvest result, net income, active improvements, damage (expandable)
  - Attention items panel (pronoun-aware title — My Lord / My Lady / My Liege):
    - Treasury deficit
    - No steward assigned
    - No heir designated
    - Overdue property repairs
    - Household members ready for age transition (page training, squire, knighting)
    - Family members (sibling / child of PK) eligible for marriage
    - Betrothed pairs where both parties are now of age — ready to wed
  - Household roster: expandable, sortable by rank / age / A–Z
  - Recent deaths (own household first, in crimson)
  - Recent chronicle (last 5 events across last 2 years)
- **Change Player Knight** — multi-step succession modal:
  - Step 1: What happened? Died / Retired / Just Switching
  - Died: records cause and year, moves NPC to the Mausoleum
  - Retired: logs a life event ("Retired from Questing"), demotes to Knight
  - Select new PK from household member grid (name, role, age)
  - Confirm summary → POSTs to `/api/succession`, saves server-side, reloads live
- **Read-only manor view** — players see their full manor overview without edit controls
- **Read-only roster, chronicle, mausoleum** — players can browse but not edit
- **Player auto-refresh** — data reloads every 30 seconds; GM saves appear without manual refresh

### GM Dashboard Enhancements
- **Pending Age Transitions** card — scans all living NPCs across all households:
  - Baby / Child age 7+ → ready for page training
  - Page age 15+ → ready to become a Squire
  - Squire age 21+ → ready to be Knighted
  - Each entry clickable, opens NPC card directly
- **Eligible for Marriage** card — Steward-role family members (sibling / child of PK), age 18+,
  no spouse yet; betrothed pairs where both are 18+ flagged separately as "ready to wed"

### Access Control Summary
| Tab / Feature          | GM Steve | Players |
|------------------------|----------|---------|
| Dashboard              | Full GM view | Personalised household view |
| Roster                 | Full — edit, add, import | Read-only |
| Manors                 | Full — edit, record year | Read-only own manor |
| Families               | Full | Hidden |
| Winter                 | Full | Hidden |
| Mausoleum              | Full | Read-only |
| Chronicle              | Full — add / delete events | Read-only |
| Export / Import        | Visible | Hidden |
| API Key button         | Visible | Hidden |
| New NPC                | Yes | No |
| Change Player Knight   | N/A | Yes (own household only) |
| `/api/save`            | Yes | Blocked (403) |
| `/api/succession`      | Yes | Yes (own household only) |
| `/api/ai`              | Yes | Blocked (403) |
| `/api/browse`          | Yes | Blocked (403) |

---

## Files Changed
| File | What Changed |
|------|-------------|
| `server.py` | Full rewrite — Flask, HTTPS, auth, role enforcement, succession endpoint, console listener |
| `secrets.env` | NEW — API key + Flask secret, never served |
| `users.json` | NEW — hashed user accounts |
| `config.json` | API key removed |
| `index.html` | Role-aware nav, player banner, GM-only classes |
| `js/app.js` | `window.__USER__`, role restrictions, player auto-refresh |
| `js/components.js` | `isGM()` helper, edit buttons gated, modal dirty tracking |
| `js/tabs/dashboard.js` | Player dashboard, succession modal, GM age/marriage panels |
| `js/tabs/manors.js` | Player read-only view, `_renderPlayerView()`, `readOnly` flag |
| `js/tabs/roster.js` | Add NPC / Import gated to GM |
| `js/tabs/chronicle.js` | Add / delete events gated to GM |
| `css/style.css` | `gm-only`, `is-player` rules, player banner, form input classes |
| `cert.pem` / `key.pem` | NEW — self-signed certificate (generated once) |

---

## Completion Checklist
- [x] Python version confirmed — 3.14.3
- [x] `flask pyopenssl` installed
- [x] `secrets.env` created
- [x] `server.py` rewritten
- [x] `users.json` created (passwords set via `/setup`)
- [x] Certificate generated (later retired in favour of `FORCE_HTTP=1`)
- [x] `index.html` + `js/app.js` updated for role-aware rendering
- [x] Tested on server PC
- [x] Tested from laptop over LAN (`http://192.168.1.42:8765`)
- [x] Pendragon-themed offline / error page (`offline.html` + `sw.js`)
- [x] QA audit + fixes (see `QA_REVIEW.md`, v2.1.1 patch notes)

### Deferred to Linux Migration
The following were originally scoped for Phase 1 on Windows but are now folded
into the Proxmox/Ubuntu + Cloudflare Tunnel cutover (see `Proxmox-Ubuntu_Plan.md`):
- [ ] External access — will be provided by Cloudflare Tunnel, **no router port
  forwarding required**. Tunnel gives a real trusted HTTPS URL automatically.
- [ ] Production-grade process supervision — will be handled by systemd on Ubuntu.
- [ ] Real TLS cert — handled by Cloudflare at the edge; Flask stays on plain
  HTTP bound to `127.0.0.1` behind the tunnel.
