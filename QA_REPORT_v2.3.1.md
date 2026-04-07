# Pendragon GM's Binder — Pre-Cloudflare Audit Report
## v2.3.1 — Compiled 2026-04-07

Five specialist agents audited the full codebase: Security, Frontend JS, CSS/UI, API/Data Integrity, and Architecture. This report deduplicates and prioritizes their combined findings.

---

## CRITICAL — Must Fix Before Cloudflare

### SEC-1: CSRF Protection Completely Disabled Behind Cloudflare Tunnel
**Files:** `server.py:140-141, 136-149`
**Found by:** Security, API/Data

Behind Cloudflare Tunnel, ALL requests arrive from `127.0.0.1` because `cloudflared` forwards locally. The CSRF check has:
```python
if request.remote_addr in ('127.0.0.1', '::1'):
    return None  # always allow localhost
```
This means **every CSRF check is bypassed** once behind Cloudflare. Additionally, if the `Origin` header is absent (some form submissions, redirects), the check passes even without the localhost bypass.

**Fix:**
1. Remove the localhost bypass entirely (or gate it behind a `BEHIND_PROXY` config flag)
2. When no `Origin` header is present, fall back to checking `Referer`. If neither exists on a POST, reject the request
3. Add CSRF checks to the 3 POST endpoints currently missing them: `/api/new`, `/api/submissions/<id>/approve`, `/api/submissions/<id>/dismiss`

---

### SEC-2: `/api/new` — Arbitrary File Write (No Path Validation)
**File:** `server.py:715-735`
**Found by:** Security, API/Data

Unlike `/api/config` (which validates path is within `$HOME` and ends in `.json`), `/api/new` accepts any path from the request body and writes to it. It also calls `mkdir(parents=True)`, creating arbitrary directories. A compromised GM session could write files anywhere the process user has access.

**Fix:** Apply the same validation as `/api/config`:
```python
resolved = Path(save_file).resolve()
home = Path.home()
if not str(resolved).startswith(str(home)) or resolved.suffix != '.json':
    return jsonify({'error': 'Path must be within home directory and end in .json'}), 400
```

---

### SEC-3: Bind to `127.0.0.1` When Behind Cloudflare
**File:** `server.py:1308`
**Found by:** Security, Architecture

Currently `host='0.0.0.0'` — directly reachable by anyone who discovers the server's real IP, bypassing Cloudflare entirely (WAF, rate limiting, DDoS protection, the lot).

**Fix:** Add a `BIND_HOST` setting to `secrets.env`. Default to `0.0.0.0` for LAN, switch to `127.0.0.1` for Cloudflare deployment.

---

### SEC-4: No Cache Busting on Static Assets
**File:** `index.html:130-147`, `server.py` (static serving)
**Found by:** Architecture

All 17 script tags and the CSS link load with bare URLs (`src="js/store.js"`). Cloudflare and browsers will cache these aggressively. After any update, players **will** get stale JavaScript until they hard-refresh.

**Fix:** Append `?v={version}` to all asset URLs. Either:
- Inject it server-side when serving `index.html`
- Or use a template variable in the HTML

---

## HIGH — Should Fix Before Cloudflare

### HIGH-1: `/api/browse` Exposes Full Filesystem Listing
**File:** `server.py:895-922`
**Found by:** Security, API/Data

GM-only, but a compromised session allows full directory enumeration of the server (`/etc/`, `/home/`, SSH keys, etc.).

**Fix:** Restrict browsable paths to `$HOME` or a configured whitelist.

### HIGH-2: `/api/player-load` Returns Full Campaign Data to Players
**File:** `server.py:661-677`
**Found by:** Security, API/Data

Players get the entire save file — GM notes, NPC stats, passions, skills, every household's private data. The client hides these with `isGM()` checks, but any player can `fetch('/api/player-load')` and see everything.

**Fix:** Filter the response server-side before returning to players. Strip GM-only NPC fields (stats, passions, skills, notes) and other households' private data.

### HIGH-3: `FORCE_HTTP=1` and Session Cookie Secure Flag
**File:** `secrets.env`, `server.py:104`
**Found by:** Security

Currently `SESSION_COOKIE_SECURE = False` because `FORCE_HTTP=1`. Behind Cloudflare, clients connect via HTTPS (Cloudflare terminates TLS), so the `Secure` flag should be `True` to prevent cookie leakage. The local leg being HTTP doesn't matter — the flag refers to the browser-side connection.

**Fix:** Set `SESSION_COOKIE_SECURE = True` when deploying behind Cloudflare (remove `FORCE_HTTP=1` or add a separate flag).

### HIGH-4: Non-Atomic File Writes — Data Corruption Risk
**Files:** `server.py:185, 212, 230, 241, 699, 728, 886, 1024, 1146`
**Found by:** API/Data

All writes use `Path.write_text()` which is NOT atomic. A crash mid-write truncates the file to 0 bytes or partial JSON — permanent data loss.

**Fix:** Write-to-temp-then-rename pattern:
```python
import tempfile
tmp = path.with_suffix('.tmp')
tmp.write_text(data, encoding='utf-8')
os.replace(str(tmp), str(path))  # atomic on Linux
```

### HIGH-5: Succession Endpoint TOCTOU Race
**File:** `server.py:814, 883-886`
**Found by:** API/Data

Reads the binder file WITHOUT holding `_save_lock` (line 814), then writes WITH the lock (line 883). If the GM saves between read and write, the succession write overwrites the GM's changes.

**Fix:** Hold `_save_lock` for the entire read-modify-write cycle.

### HIGH-6: Security Headers Missing
**Found by:** Architecture

No `Content-Security-Policy`, `X-Frame-Options`, or `X-Content-Type-Options` headers. The app could be framed by a malicious site.

**Fix:** Add to the index route response:
```python
resp.headers['X-Frame-Options'] = 'DENY'
resp.headers['X-Content-Type-Options'] = 'nosniff'
resp.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com"
```

---

## MEDIUM — Fix When Convenient

### MED-1: BUG — POI Widget Shows All Pinned NPCs as Dead
**File:** `js/tabs/dashboard.js:208`
**Found by:** Frontend JS

```js
const dead = !n.alive;   // n.alive is always undefined — should be n.status === 'Dead'
```
Every pinned NPC shows with `†` prefix and dimmed opacity. **One-line fix.**

### MED-2: Systemic XSS — NPC Names Not Escaped in innerHTML
**Files:** components.js, dashboard.js, roster.js, winter.js, mausoleum.js, tree.js, solos.js, manors.js, chronicle.js, families.js (~80+ locations)
**Found by:** Frontend JS, Security

NPC names, notes, and free-text fields are interpolated into `innerHTML` without `esc()` across virtually the entire codebase. The `esc()` function exists and is used in some newer code (pins, at-mention, stat blocks) but not in the original NPC rendering paths.

**Practical risk:** Low on LAN with 5 trusted users, but an NPC name containing `<script>` or `<img onerror=...>` would execute in every view. Becomes real if players can ever edit NPCs directly, or if imported JSON contains malicious names.

**Fix:** Global pass wrapping all user data in `esc()`. Priority locations: `components.js` (NPC card header, relationship lists), `dashboard.js` (attention items, roster rows), `roster.js` (list items).

### MED-3: Horses/Pins Writes Have No Lock Protection
**Files:** `server.py:200-212, 1132-1146`
**Found by:** API/Data

No threading lock on per-player file I/O. Simultaneous writes (GM + player editing same stable) could cause lost data.

**Fix:** Add a per-user lock (or a single `_player_data_lock`).

### MED-4: Error Messages Leak Internal Paths
**Files:** `server.py:641, 658, 677, 710, 735, 782, 922`
**Found by:** Security, API/Data

`return jsonify({'error': str(e)})` can expose filesystem paths and Python internals.

**Fix:** Log exceptions server-side, return generic messages to clients.

### MED-5: No Session Expiry
**File:** `server.py`
**Found by:** Security

Sessions never expire. A stolen cookie works indefinitely.

**Fix:** Add `app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=8)` and `session.permanent = True` in login.

### MED-6: `/api/pins` — Unbounded Pin List
**File:** `server.py:1156-1167`
**Found by:** API/Data

No limit on number of pins. Malicious client could POST thousands of IDs.

**Fix:** Cap at 200 or similar.

### MED-7: `/api/horses` — No Validation of Horse Objects
**File:** `server.py:1092-1102`
**Found by:** API/Data

Checks that `horses` is a list but not what's inside. Could be filled with arbitrary data up to 16MB.

**Fix:** Validate expected fields and cap array length.

### MED-8: `/api/ai` — No Rate Limiting
**File:** `server.py:738-782`
**Found by:** Security

GM-only, but no per-minute rate limit. Stolen session could rack up API charges.

**Fix:** Simple in-memory counter (e.g., 20 requests/minute).

---

## LOW — Nice to Have / Polish

### CSS/UI Issues

| ID | Issue | File | Fix |
|----|-------|------|-----|
| UI-1 | Missing `.mb-6` utility class (used 10 times in manors.js) | style.css | Add `.mb-6 { margin-bottom: 6px; }` |
| UI-2 | Modal `min-width:500px` overflows 360px mobile | components.js:655 | Use `width:min(500px, 100%)` |
| UI-3 | `.pk-cards` grid still 2-col on 360px screens | style.css:926 | Add `1fr` rule at 640px breakpoint |
| UI-4 | Tiny button touch targets (20-24px) from inline padding overrides | manors.js (11 places) | Create `.btn-xs` class |
| UI-5 | `--parchment-light` CSS variable referenced but never defined | style.css:2081 | Remove fallback overrides |
| UI-6 | Hardcoded hex colors bypass design tokens | style.css + JS files (~15 locations) | Replace with `var(--token)` |
| UI-7 | 5 unused CSS selectors | style.css | Remove `.two-pane-wide`, `.hdr-btn-crimson`, `.card-grid`, `.sr-only`, `.broadcast-card` |

### Architecture / Performance

| ID | Issue | File | Fix |
|----|-------|------|-----|
| ARCH-1 | FEATURES + PATCH_NOTES = 1,160 lines (63% of app.js) | app.js | Move to separate lazy-loaded file |
| ARCH-2 | `STORE.getNpc()` is O(n) linear scan, called pervasively | store.js:192 | Add `_npcById` Map index |
| ARCH-3 | Player refresh reloads entire save every 30s with full DOM rebuild | app.js:1391 | Add ETag/hash check to skip re-render when unchanged |
| ARCH-4 | 3 separate poll endpoints (heartbeat, broadcast, presence) | multiplayer.js | Consolidate into single `/api/poll` |
| ARCH-5 | `STORE.save()` writes all 8 localStorage keys on every mutation | store.js:176 | Debounce or write only changed keys |
| ARCH-6 | `player_data/` not in `.gitignore` | .gitignore | Add `player_data/` |
| ARCH-7 | Modal event listeners accumulate (never removed) | components.js:90-91 | Use named handlers, remove in `close()` |

---

## WHAT'S SOLID — Things Already Done Well

The audit team flagged these as strong:

- **Password hashing** — werkzeug scrypt with good parameters
- **Session cookie flags** — HttpOnly, SameSite=Lax both set
- **Sensitive file blocking** — comprehensive blocked-files list with suffix and path-component checks
- **AI proxy lockdown** — model hardcoded, tokens capped, key never exposed to client
- **Rate limiting on login** — 5 attempts per 5-minute window with CF-Connecting-IP support
- **Open redirect prevention** — `next` parameter validated
- **`/setup` localhost-only** — prevents remote account takeover
- **Input size limits** — 16MB request cap, field-level length clamping on succession/broadcast/submissions
- **Tab system** — only active tab renders, no wasted work
- **Modal/CardPopup stacking** — ESC dismisses topmost layer, dirty-form guard prevents data loss
- **File sync** — 3s debounced writes, 5m periodic sync, threading lock, rolling backups
- **Data migrations** — versioned, idempotent, handles file-sync re-runs
- **Service worker** — minimal offline-only design, won't cause stale-code nightmares
- **Role-based security** — CSS class injection server-side + API enforcement = defense in depth
- **AtMention module** — best-coded module in the codebase, proper escaping throughout
- **Multiplayer module** — all user data properly escaped
- **Typography hierarchy** — three font families used consistently via CSS variables
- **Responsive architecture** — three breakpoint tiers with progressive collapse

---

## Recommended Fix Order

### Before Cloudflare (session 1):
1. **SEC-1** — Fix CSRF (remove localhost bypass, add Referer fallback, add missing checks)
2. **SEC-2** — Path validation on `/api/new`
3. **SEC-3** — Configurable bind address
4. **SEC-4** — Cache busting on asset URLs
5. **HIGH-4** — Atomic file writes
6. **HIGH-5** — Succession TOCTOU lock fix
7. **HIGH-6** — Security headers
8. **MED-1** — Fix `n.alive` bug in POI widget (one-liner)
9. **ARCH-6** — Add `player_data/` to `.gitignore`

### Before Cloudflare (session 2, if time):
10. **HIGH-1** — Restrict `/api/browse` to `$HOME`
11. **HIGH-2** — Filter `/api/player-load` response
12. **HIGH-3** — Cookie Secure flag for Cloudflare
13. **MED-3** — Player data file locks
14. **MED-4** — Generic error messages
15. **MED-5** — Session expiry

### When convenient:
16. **MED-2** — XSS escaping pass
17. **MED-6/7** — Validate and cap pins/horses
18. **UI-1 through UI-7** — CSS polish
19. **ARCH-1 through ARCH-5** — Performance improvements

---

*Report compiled from 5 specialist audits. Total tokens consumed: ~443,760. Total tool calls: 234. Total audit time: ~13 minutes.*
