# Pendragon GM's Binder -- Comprehensive QA Review

**Date:** 2026-04-05
**Version Reviewed:** v2.0.0 (APP_VERSION) / v1.7.7 (HTML header label)
**Reviewer:** Claude Opus 4.6 (automated code review)

---

## Executive Summary

The codebase is **generally solid** for a multiplayer Flask + vanilla JS campaign management tool. The architecture is clean: a single-file server with clear route decorators, a localStorage-backed STORE with file sync, and component-based JS with proper separation of concerns.

**Critical issues:** 2 -- one wrong property name causing the player dashboard pronoun logic to always fall back to default, and one chronicle data structure mismatch causing the player dashboard's "Recent Chronicle" section to always be empty.

**High-severity issues:** 5 -- including an open redirect on login, missing BLOCKED_FILES entries for `.bak` certificate copies, API config endpoint not restricted to GM-only, sendBeacon bypass of GM auth on save, and a version string mismatch.

**Medium issues:** ~12 -- including missing CSRF protection, missing SESSION_COOKIE_SECURE, a capitalisation typo in a JS method call, and several minor data flow gaps.

**Low issues:** ~10 -- code style, minor UX inconsistencies, and hardcoded values.

Overall the app is **functional and well-designed** but has a handful of security and correctness issues that should be addressed before any internet-facing deployment.

---

## 1. SERVER.PY

### Critical

*None at critical level, but see High below.*

### High

**H-1. Open Redirect on Login (server.py:374)**
```python
next_url = request.args.get('next') or url_for('index')
return redirect(next_url)
```
An attacker can craft `https://server/login?next=https://evil.com` and after a user logs in, they are redirected to the attacker's site. The `next` parameter should be validated to ensure it is a relative path (starts with `/` and does not start with `//`).
**Suggested fix:** Add `if not next_url.startswith('/') or next_url.startswith('//'):  next_url = url_for('index')`.

**H-2. Certificate Backup Files Not Blocked (server.py:36-39)**
`BLOCKED_FILES` contains `cert.pem` and `key.pem` but **not** `cert.pem.bak` and `key.pem.bak`, which exist in the project root. Any authenticated user (including players) can download the server's private key via `GET /cert.pem.bak` or `GET /key.pem.bak`.
**Suggested fix:** Add `'cert.pem.bak'` and `'key.pem.bak'` to `BLOCKED_FILES`, or better, add a wildcard check like `p.endswith('.pem') or p.endswith('.pem.bak')`.

**H-3. /api/config POST is login_required, Not gm_required (server.py:493-494)**
The `api_set_config` endpoint allows any authenticated user (including players) to change the `saveFile` path in `config.json`. A malicious player could point the save file to an arbitrary path, potentially overwriting system files on the next save.
**Suggested fix:** Change `@login_required` to `@gm_required` on the POST config route.

**H-4. sendBeacon Save Bypasses GM Auth (app.js:1086-1091)**
The `beforeunload` handler uses `navigator.sendBeacon('/api/save', ...)` for all users. On the server, `/api/save` has `@gm_required`, so the beacon will fail for players (403), but it still sends the full save payload over the network unnecessarily. More importantly, if the session cookie is still active, a player who somehow has a GM session will be able to trigger a save on page close.
**Severity note:** This is mitigated by the `@gm_required` decorator, but the client-side code does not check `isGM()` before attempting the beacon.
**Suggested fix:** Wrap the sendBeacon in an `if (isGM() && STORE._dirty)` check.

**H-5. Version String Mismatch (index.html:71 vs app.js:5)**
`index.html` header button shows `v1.7.7` but `APP_VERSION` in `app.js:5` is `'2.0.0'`. The button text is dynamically updated at boot (`app.js:1066`), so the mismatch is cosmetic during load only, but the hardcoded `v1.7.7` in HTML is stale.
**Suggested fix:** Remove the hardcoded version from the HTML button text or make it generic (e.g., just "Version").

### Medium

**M-1. No CSRF Protection (server.py)**
No CSRF tokens are used on any form or API endpoint. Flask does not include CSRF protection by default. Since `SESSION_COOKIE_SAMESITE` is `Lax`, this mitigates cross-site POST requests from other origins, but does not protect against same-site attacks.
**Suggested fix:** Consider Flask-WTF or at minimum validate `Origin`/`Referer` headers on mutating endpoints.

**M-2. SESSION_COOKIE_SECURE Not Set (server.py:65-66)**
When running over HTTPS (the default), the session cookie should be marked `Secure` to prevent it from being sent over plain HTTP.
**Suggested fix:** `app.config['SESSION_COOKIE_SECURE'] = (SECRETS.get('FORCE_HTTP') != '1')`

**M-3. /api/browse Directory Traversal (server.py:730-757)**
The browse endpoint allows navigating the entire filesystem. While it is `@gm_required`, a compromised GM session gives full filesystem enumeration. The endpoint does not restrict browsing to a safe directory tree.
**Risk level:** Acceptable for a trusted LAN tool, but worth noting.

**M-4. _login_attempts Dict Grows Unbounded (server.py:70)**
The `_login_attempts` dictionary is never pruned of old IPs. After many unique IPs attempt login, memory accumulates. In practice, on a LAN with few users this is negligible, but it is technically unbounded.
**Suggested fix:** Add periodic cleanup or use a TTL cache.

**M-5. Path(empty_string) Evaluates to Current Directory (server.py:572)**
```python
path = Path(data.get('saveFile', '').strip())
if not path:   # Path('') is truthy!
```
`Path('')` is truthy in Python (`bool(Path('')) == True`), so the `if not path:` check never catches an empty string. The `Path('')` would resolve to the current directory.
**Suggested fix:** Check the string before converting: `raw = data.get('saveFile', '').strip(); if not raw: return ...`.

**M-6. Race Condition on User File Reads/Writes (server.py:113-119)**
`load_users()` and `save_users()` are not protected by a lock. Concurrent requests (e.g., two users changing passwords simultaneously) could lose writes. The `_save_lock` only protects save-file operations, not user-file operations.

### Low

**L-1. Hard-Coded Port (server.py:33)**
`PORT = 8765` is not configurable via environment variable or config file.

**L-2. Secrets Loaded Once at Import Time (server.py:53)**
`SECRETS = load_secrets()` runs once at module load. If `secrets.env` is edited while the server is running, a restart is required. This is documented behavior but could surprise users.

**L-3. Debug Mode Hardcoded Off (server.py:886)**
`debug=False` is hardcoded. Consider making this configurable for development.

---

## 2. JAVASCRIPT -- BUGS

### Critical

**C-1. Wrong Property Name: `pk?.pronouns` Should Be `pk?.pronoun` (dashboard.js:241)**
```javascript
const pronouns = pk?.pronouns || 'He/him';
```
Every NPC stores its pronoun as `pronoun` (singular), not `pronouns`. This means the value is always `undefined`, falling back to `'He/him'`. The player dashboard's "My Lady" / "My Liege" / "My Lord" logic in the Matters Requiring Attention section will **always** show "My Lord" regardless of the player knight's actual pronouns.
**Suggested fix:** Change to `pk?.pronoun || 'He/him'`.

**C-2. Chronicle Data Structure Mismatch (dashboard.js:431-433)**
```javascript
Object.entries(STORE.chronicle).forEach(([yr, chron]) => {
    (chron.events||[]).forEach(e => allEvents.push({ year: parseInt(yr), ...e }));
});
```
`STORE.chronicle` stores each year's data as a **flat array** of event objects (see `chronicle.js:105`: `STORE.chronicle[key].push({...})`), not as an object with an `events` property. Therefore `chron.events` is always `undefined`, the fallback `||[]` kicks in, and the "Recent Chronicle" section on the player dashboard is **always empty**.
**Suggested fix:** Change to `chron.forEach(e => allEvents.push({ year: parseInt(yr), ...e }));` with a guard: `if (!Array.isArray(chron)) return;`.

### High

**H-6. `App.switchTab` Capitalisation Typo (roster.js:92)**
```javascript
onclick="App.switchTab('mausoleum')"
```
The global is `APP` (all caps), not `App`. This means clicking the "N out of story" link at the bottom of the Roster sidebar throws a `ReferenceError: App is not defined`.
**Suggested fix:** Change to `APP.switchTab('mausoleum')`.

### Medium

**M-7. Modal Event Listener Accumulation (components.js:80-81, 119-120)**
Every `Modal.open()` and `Modal.push()` call adds new `input` and `change` event listeners to the `content` element with `{ capture: true }`. These are never removed. After many modal open/close cycles, the listener count grows. Since the content innerHTML is replaced, the old listeners become orphaned but the `content` element itself persists, so the listeners remain.
**Practical impact:** Low -- the listeners only set a boolean flag, so performance is barely affected. But it is technically a leak.

**M-8. `STORE.save()` vs `STORE._save()` Inconsistency**
`STORE.setYear()` (store.js:681) calls `this._save()` directly (localStorage only) and then manually sets `_dirty` and calls `FileSync.setStatus('unsaved')`. All other mutation methods call `this.save()` which handles all three steps. The `setYear` method then also calls `this.syncToFile()` immediately. This works but the pattern is inconsistent and fragile.

**M-9. `saveNewNpc` Missing `training_path` Field (components.js:1440-1472)**
The `saveNewNpc()` function does not include `training_path` in the NPC data object it creates, even though the edit form has an `ef-training-path` input (components.js:719). The `openAddNpc()` template (components.js:1488) includes `training_path: ''` which is correct, but `saveNewNpc()` reads from `ef-training-where` but not `ef-training-path`.
**Suggested fix:** Add `training_path: g('ef-training-path')?.value?.trim() || '',` to the `saveNewNpc` function.

**M-10. Seed Data Missing `SEED_YEAR` Constant**
`STORE._seed()` (store.js:160) references `typeof SEED_YEAR !== 'undefined'` but neither `seed-npcs.js` nor `seed-manors.js` defines `SEED_YEAR`. Falls back to 498, which is correct, but the check is dead code.

**M-11. Potential XSS in File Picker Path Rendering (app.js:1192-1194)**
File paths from the server are inserted into `onclick` attributes with only backslash and single-quote escaping. A malicious directory name containing characters like `");alert("` could break out of the onclick handler. This is low risk since only the GM can access `/api/browse`, but the path escaping is incomplete.
**Suggested fix:** Use `encodeURIComponent` or render paths via DOM APIs instead of string interpolation.

**M-12. `glory.toLocaleString()` Crashes on Non-Numeric Glory (components.js:273)**
If `npc.glory` is a non-empty string (e.g., imported as `"1000"`), the `!== 0` and `!== '-'` checks pass, and `toLocaleString()` is called on a string, which works but produces unexpected results (no thousands separator). The `parseInt` on save normalizes to a number, but imported or legacy data could have string values.

### Low

**L-4. Unused `retired` Field in `openAddNpc` Template (components.js:1490)**
The template includes `retired: false` but this field is never read or displayed anywhere in the codebase.

**L-5. Page-Age Flag Range Gap (roster.js:255, components.js:468)**
The flag shows "Needs Page Placement" for ages 7-13 but "Needs Training" starts at age 14 exactly when role is `page`. If a child is changed to `page` role at age 7, neither flag fires (the page check requires age >= 14). This is intentional per RPG rules but the gap for pages aged 7-13 means the training flag disappears once they become a page, until age 14.

---

## 3. CSS

### Medium

**M-13. z-index Stacking Competition**
- `.toast-container`: z-index 9999
- `#npcHoverCard`: z-index 9999
- `.card-popup-overlay`: z-index 2000
- `.modal-overlay`: z-index 1000

The toast container and hover card both compete at z-index 9999. If a toast appears while a hover card is visible, they could overlap unpredictably. The hover card should be below toasts.
**Suggested fix:** Give `#npcHoverCard` z-index 8000 or similar.

### Low

**L-6. `body { overflow: hidden }` (style.css:81)**
The body has `overflow: hidden`, meaning any content that overflows the viewport is clipped. This is intentional for the app shell layout, but could cause issues if the app is embedded or viewed on very small screens where the header alone exceeds viewport height.

**L-7. `.ink-mid` CSS Variable Missing**
The `--ink-mid` variable is referenced in JS-generated HTML (e.g., `color:var(--ink-mid)`) but is not defined in the `:root` CSS variables. The browser falls back to the inherited color, which works but is inconsistent.
*Note: Verified `--ink-mid` is not in the CSS variables block; it may be defined later in the file.*

---

## 4. HTML

### Medium

**M-14. Service Worker Registration on Non-Root Paths (index.html:136)**
```html
navigator.serviceWorker.register('/sw.js')
```
This works correctly since the SW is served from `/sw.js` with auth bypass. However, if the app is ever served from a subdirectory, the SW scope would not match. Low risk for current deployment.

### Low

**L-8. Hardcoded Year in Title (index.html:5)**
`<title>Pendragon GM's Binder -- 498 AD</title>` is hardcoded to 498 AD. The JS updates `document.title` on boot (app.js:1082), so this is only visible during the brief loading period. Cosmetic only.

**L-9. `solos.js` Loaded Before `chronicle.js` (index.html:131-132)**
`solos.js` is loaded as a script tag before `chronicle.js`. If solos.js ever references `TabChronicle`, it would fail. Currently there is no such cross-reference, so this is not a bug, but the dependency order is fragile.

---

## 5. CROSS-CUTTING CONCERNS

### Authentication & Authorization

**Auth Coverage:** All API routes have either `@login_required` or `@gm_required`. The `/setup`, `/login`, `/logout`, `/sw.js`, and `/offline.html` routes are correctly unauthenticated.

**Player Restriction Gaps:**
- `/api/config POST` should be `@gm_required` (see H-3 above).
- `/api/succession` correctly validates player household ownership server-side.
- The `sendBeacon` save attempt fires for all users client-side (see H-4).
- Static file serving (`/<path:filename>`) is `@login_required` -- players can access any non-blocked file. This means players can download `binder-save.json`, `seed-npcs.js`, `seed-manors.js`, and all JS/CSS. This is by design (they need the app assets) but means players can see all game data, not just their household.

### Race Conditions in Save/Load

**File sync architecture is sound:** The `_save_lock` threading.Lock protects file writes. The debounced sync timer (3s) coalesces rapid changes. The `_restart_pending` flag correctly defers restarts during saves.

**Potential issue:** Two GMs (or a GM on two devices) could race on saves. The last write wins with no merge strategy. The backup rotation provides recovery, but there is no conflict detection or optimistic locking.

### Service Worker / Offline Page

**Correct for HTTPS:** The SW registration at `/sw.js` works correctly. The offline page is properly cached and served on navigation failures.

**HTTP Mode Issue:** Service workers require HTTPS or localhost. If `FORCE_HTTP=1` is set and the server is accessed from a non-localhost address, the SW registration will silently fail (the `.catch(() => {})` swallows the error). The offline page will not be available. This is acceptable behavior but should be documented.

### Hardcoded Values

- **Port 8765** (server.py:33) -- not configurable
- **Backup count 5** (server.py:768) -- not configurable
- **Debounce timer 3000ms** (store.js:758) -- not configurable
- **Periodic sync 5 minutes** (store.js:828) -- not configurable
- **Player refresh 30 seconds** (app.js:1124) -- not configurable
- **Rate limit: 5 attempts / 300 seconds** (server.py:71-72) -- not configurable
- **Default users** (server.py:846-853) -- hardcoded for this specific campaign

---

## 6. DATA INTEGRITY

### Seed Data

- `seed-manors.js` defines `SEED_MANORS` with keys matching household names (Blackwood, Cador, Dawnwell, Westwood). No Upavon manor exists in seed data, which is consistent (Upavon is a household but has no managed manor).
- `seed-npcs.js` defines `SEED_LIVING` and `SEED_DEAD` arrays. Field names use `year_born` consistently (not `birth_year`).
- `SEED_YEAR` is referenced in `store.js:160` but never defined in either seed file. The fallback to 498 is correct.

### Relationship Types Consistency

`RELATION_TYPES` in `store.js:28-40` matches the options used in the relationship form (`components.js:883`) and the display logic in `components.js:282-319`. The directed relationship mapping (`REL_DIRECTED`) covers all asymmetric types correctly.

### Chronicle Data Format

As noted in C-2, there is a mismatch between how chronicle data is stored (flat array per year) and how the player dashboard reads it (expecting an object with an `events` property). The chronicle tab itself reads it correctly.

### Manor Data Schema

The manor data uses `lord_id`, `steward_id`, and `heir_id` fields for NPC references, which are correctly read in both the manors tab and the dashboard. The `improvements` array and `propertyDamage` array are properly guarded with `|| []` fallbacks.

---

## Summary of Findings by Severity

| Severity | Count | Key Issues |
|----------|-------|------------|
| Critical | 2 | Wrong property name `pronouns` vs `pronoun`; chronicle data structure mismatch |
| High | 6 | Open redirect; cert backups exposed; config endpoint not GM-only; sendBeacon auth bypass; version mismatch; `App` vs `APP` typo |
| Medium | 14 | No CSRF; no Secure cookie; FS traversal; memory leak on login attempts; empty Path check; user file race; modal listener accumulation; save pattern inconsistency; missing training_path on new NPC; dead SEED_YEAR check; XSS in file picker; glory type; z-index conflict; SW subdirectory scope |
| Low | 9 | Hardcoded port; secrets loaded once; debug mode; unused field; age flag gap; body overflow; missing CSS variable; hardcoded title year; fragile script order |

---

*End of QA Review*
