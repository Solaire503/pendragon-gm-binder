# Pendragon GM's Binder — Full QA Report
**Version:** 2.7.1 | **Date:** 2026-04-08 | **Scope:** Binder + Caliburn Bot + Infrastructure

Five parallel review agents examined: Frontend (26 findings), Backend Security (34 findings), Caliburn Bot (25 findings), Data Integrity (23 findings), Infrastructure (15 findings).

Deduplicated and consolidated below. Items that appeared in multiple reports are merged.

---

## CRITICAL — Fix Before Next Session

### CR-1. XSS: Player chronicle submission → template literal injection
**Frontend F-02 | chronicle.js lines 368, 385**
A player submits chronicle text containing `${fetch('...')}`. When the GM clicks "Edit & Approve", the text is embedded in a JS template literal, executing arbitrary code in the GM's browser. Exploitable by any authenticated player.

### CR-2. XSS: `blessed_note` rendered unescaped on NPC cards
**Frontend F-01 | components.js line 472**
`npc.blessed_note` is interpolated raw into innerHTML. The edit form escapes it, but the display path does not. Any HTML/JS in the field executes in every client viewing that card.

### CR-3. Password reset poisoning via X-Forwarded-Host injection
**Backend C4 | server.py lines 604-606**
An attacker sends a forged `X-Forwarded-Host: evil.com` header to `/api/forgot-password`. The reset email contains `https://evil.com/reset/<token>`, capturing the token when the victim clicks. No host allowlist exists.

### CR-4. `/setup` endpoint accessible through Cloudflare Tunnel
**Backend C3 | server.py lines 636-637**
The localhost check (`request.remote_addr in ('127.0.0.1', '::1')`) passes for ALL Cloudflare Tunnel traffic since the tunnel runs locally. If `users.json` is ever deleted/corrupted, any internet user could set all passwords.

### CR-5. Secrets files are world-readable (mode 664)
**Infrastructure | secrets.env, caliburn-bot/.env**
Both files are `-rw-rw-r--`. Any system user can read the Discord token, API keys, Flask secret, SMTP password, and bot key. Should be `600`.

### CR-6. `/api/player-load` fails to strip GM-only NPC fields
**Data Integrity M7 | server.py lines 1002-1008**
The stripping logic looks for `binder.get('npcs')` (a dict), but the save file stores NPCs under `living` and `dead` (arrays). The code silently does nothing — players receive full GM-only data (stats, passions, skills, notes).

### CR-7. "Mark All Read" notifications hits nonexistent endpoint
**Data Integrity C1 | notifications.js line 69**
Client POSTs to `/api/notifications/read-all`, server only defines `/api/notifications/read`. Returns 404. Appears to work locally until next poll reverts all notifications to unread.

### CR-8. Manor notes field name mismatch — data silently lost
**Data Integrity C2 | notes.js lines 74, 91 / server.py lines 1682, 1712**
Client sends `manor`, server expects `manor_notes`. Manor notes are silently discarded on every save and invisible on every load. The feature is completely broken.

### CR-9. Bot: NPC name passed unsanitized into URL path
**Bot C2 | caliburn.py line 485**
`binder.get(f'/api/bot/npc/{name}')` — user input goes directly into the URL. Names containing `/`, `..`, `?`, `#` alter the path. Path traversal risk against the Flask API.

---

## HIGH — Fix Soon

### HI-1. Bot API token vulnerable to timing attack
**Backend C1 | server.py lines 229-231**
Uses `!=` for string comparison instead of `hmac.compare_digest()`. Allows character-by-character brute force.

### HI-2. Bot error messages expose internal details
**Bot H4 | caliburn.py lines 341, 389, 593**
`f"Something went wrong: {e}"` sends raw exception text to Discord — could leak API keys, URLs, stack traces.

### HI-3. `/speak` vulnerable to prompt injection
**Bot H5 | caliburn.py line 578**
User input placed directly into Claude prompt. Users can extract system prompt (including the Artoria easter egg) or bypass character.

### HI-4. `/year` command missing `defer()` — times out after 3s
**Bot H3 | caliburn.py lines 543-550**
Every other binder command defers; this one doesn't. If binder takes >3s, interaction fails.

### HI-5. `NpcSelectView.on_timeout` never updates Discord message
**Bot H1 | caliburn.py lines 473-475**
Buttons disabled on Python objects but `edit_original_response()` never called. Buttons remain clickable in Discord after 60s, producing "interaction failed" errors.

### HI-6. `AtMention.wire()` does not exist — throws TypeError
**Frontend F-08, F-09 | journal.js lines 81-82, comments.js line 190**
`AtMention.wire(ta)` is called but the method doesn't exist. Throws uncaught TypeError every time a journal or comment textarea renders.

### HI-7. Player poll overwrites unsaved local edits
**Data Integrity H1 | app.js lines 1707-1710, store.js lines 829-858**
`loadFromFile()` every 30s replaces all in-memory data. If a debounced save hasn't fired yet, edits are silently lost. No dirty-data check.

### HI-8. No lock on notifications/pins/notes read-modify-write
**Data Integrity H3-H5 | server.py**
`_push_notification()`, `_read_pins()`/`_write_pins()`, `_read_notes()`/`_write_notes()` have no threading lock. Concurrent requests can lose data.

### HI-9. Comments read-modify-write race condition
**Backend H7 | server.py lines 1846-1890**
Lock protects individual reads/writes but not the full transaction. Between read and write, another request can modify the file.

### HI-10. `/api/ai` proxies unvalidated `messages` array to Anthropic
**Backend H1 | server.py lines 1190-1195**
No validation that messages is a list with expected structure, no size limit. Could burn API credits.

### HI-11. No rate limiting on `/api/forgot-password`
**Backend H2 | server.py lines 733-744**
Allows email enumeration (timing side-channel), Gmail spam (SMTP lockout), and unbounded `_reset_tokens` dict growth.

### HI-12. Zero ARIA attributes across entire codebase
**Frontend F-17 | All files**
No `role`, `aria-label`, `aria-expanded`, `aria-modal`, or `aria-live` on any element. Modals, dropdowns, tabs, and interactive spans are all inaccessible to screen readers.

### HI-13. Caliburn bot: no `.gitignore` — `.env` could be committed
**Infrastructure | caliburn-bot/**
No `.gitignore` exists. If the directory is ever git-initialized, live secrets are at risk.

### HI-14. `/api/player-load` exposes full binder beyond NPC fields
**Backend H3 | server.py lines 987-1011**
Strips NPC fields but returns everything else unmodified: all manor financials, chronicle, relationships, tree positions.

### HI-15. Bot creates new aiohttp session per request
**Bot H2 | caliburn.py lines 43-52**
Creates/destroys a `ClientSession` on every call. Wasteful, can leak resources under load.

---

## MEDIUM — Address When Convenient

| ID | Area | Summary |
|----|------|---------|
| MD-1 | Frontend | Manor key with single quote breaks all onclick handlers (manors.js lines 315, 374, 394, etc.) |
| MD-2 | Frontend | Modal event listeners accumulate — never removed on close (components.js lines 92-93) |
| MD-3 | Frontend | Missing `esc()` on NPC names in solos knight search, winter modals, manor faction |
| MD-4 | Frontend | Three different HTML-escape functions — local shadow missing single-quote escaping |
| MD-5 | Frontend | Interactive elements (spans/divs with onclick) not keyboard-accessible |
| MD-6 | Backend | Session role trusted from cookie, never re-verified against users.json |
| MD-7 | Backend | `/api/me` writes users.json on every GET (write-on-read, contention risk) |
| MD-8 | Backend | `/logout` is GET — CSRF vulnerable via `<img src>` |
| MD-9 | Backend | `/api/config` and player-load error leak filesystem paths |
| MD-10 | Backend | `_login_attempts` dict has no threading lock |
| MD-11 | Backend | Impressions dict values have no per-key size limit |
| MD-12 | Backend | Submissions list grows unbounded |
| MD-13 | Backend | Email enumeration via timing on forgot-password |
| MD-14 | Bot | `/chronicle` embed could exceed Discord's 6000-char or 25-field limit |
| MD-15 | Bot | `/damage` doesn't handle negative modifiers or validate sides > 0 |
| MD-16 | Bot | Fuzzy search O(n * SequenceMatcher) — could lag with large NPC lists |
| MD-17 | Bot | Bearer token over HTTP (safe on localhost, fragile if URL changes) |
| MD-18 | Data | Chronicle/solo event IDs use `Date.now()` — millisecond collision risk |
| MD-19 | Data | Comment cache never refreshes — other users' comments invisible until re-open |
| MD-20 | Data | Pin save is fire-and-forget — failures silently lost |
| MD-21 | Data | `loadFromFile` parse error triggers `STORE.init()` — could replace real data with defaults |
| MD-22 | Data | GM save can overwrite player relationship save (last-write-wins race) |
| MD-23 | Infra | No off-host backup strategy |
| MD-24 | Infra | Backups directory has read-only permissions (505) — backups may be silently failing |
| MD-25 | Infra | `users.json` is world-readable (644) — contains password hashes |
| MD-26 | Infra | No structured logging or audit trail |
| MD-27 | Infra | bcrypt 3.2.2 outdated (4.x current) |
| MD-28 | Backend | `_safe_npc` in bot API exposes `notes` field (GM-only data to bot) |

---

## LOW — Nice to Have

| ID | Area | Summary |
|----|------|---------|
| LO-1 | Frontend | Local `esc()` shadow in `buildSoloChronicleHtml` |
| LO-2 | Frontend | `_tableLoot()` has unreachable extended loot (d6 > 6 check) |
| LO-3 | Frontend | Notification/comment polling continues on hidden tabs |
| LO-4 | Frontend | `_relTime` duplicated in comments.js and notifications.js |
| LO-5 | Frontend | FEATURES/PATCH_NOTES static content inflates app.js |
| LO-6 | Backend | No Content-Security-Policy header |
| LO-7 | Backend | `render_template_string` with dynamic content (safe with Jinja2 autoescape) |
| LO-8 | Backend | `get_json(force=True)` bypasses Content-Type checking |
| LO-9 | Backend | Secrets in plaintext env files (no vault/KMS) |
| LO-10 | Bot | `message_content` intent enabled but only used for `!sync` |
| LO-11 | Bot | `load_dotenv` called twice |
| LO-12 | Bot | No rate limiting on `/speak` (API cost risk) |
| LO-13 | Bot | `requirements.txt` uses `>=` not `==` (unpinned deps) |
| LO-14 | Bot | No input length validation on `/speak` message |
| LO-15 | Bot | `setup_hook` doesn't auto-sync commands |
| LO-16 | Data | Notes save failure is completely silent |
| LO-17 | Data | Comment cache set to `[]` on any load failure |
| LO-18 | Data | `deleteNpc` doesn't clean up comments, impressions, or pins |
| LO-19 | Data | Comments file grows unbounded (soft-deletes never purged) |
| LO-20 | Data | Notifications: 100 stored, 50 returned — 50 invisible |
| LO-21 | Infra | Flask dev server in production (fine at 4-player scale) |
| LO-22 | Infra | No `requirements.txt` for the binder |
| LO-23 | Infra | `comments.json` not in `.gitignore` |

---

## TRIAGE RECOMMENDATION

**Immediate (before next game session):**
- CR-1 through CR-9 — security holes and broken features
- HI-6 (AtMention.wire TypeError)
- HI-7 (player poll overwriting edits — if players edit during sessions)

**Next dev session:**
- HI-1 through HI-5 (bot hardening)
- HI-8 through HI-11 (race conditions and validation)
- CR-5 (file permissions — one `chmod 600` command)

**When convenient:**
- MEDIUM items (mostly defense-in-depth and edge cases)
- Accessibility pass (HI-12, MD-5) if players use assistive tech

**Backlog:**
- LOW items
