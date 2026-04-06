# Pendragon GM's Binder — v2.1 / v2.2 Roadmap
## Phase 2 · Live Session Features
### Status: COMPLETE (delivered across v2.1.0, v2.1.1, v2.2.0)

---

## What v2.1 Is

Phase 1 gave everyone a login and a personalised view of their data.
Phase 2 makes the app feel like a shared table — the GM can push messages to players,
see who's online, and players can contribute to the Chronicle.

---

## Features Planned

### ✅ GM Broadcast / Announcement Banner
- GM types a message in a small panel (GM dashboard or persistent header control)
- Message appears as a dismissible banner at the top of every player's screen on next refresh
- GM can clear it at any time
- Storage: single `announcements.json` (or lightweight field appended to save)
- Use cases: "Winter phase starting", "Check the Chronicle", "Session in 10 min"

### ✅ Presence Indicator
- GM-only panel showing who is currently online
- A player is "online" if they've polled the server within the last 60 seconds
  (Phase 1 auto-refresh provides this heartbeat for free — no extra client code needed)
- Green dot = online, grey dot = offline, shown next to each username
- Storage: in-memory dict on the server — no database needed, resets on restart

### ✅ Chronicle Submissions
- Players see a **Submit Entry** button on the Chronicle tab
- Free-text field — player writes a short account from their knight's perspective
- Submissions queue in a GM-only review panel (GM dashboard or Chronicle tab)
- GM approves (adds to Chronicle), edits before approving, or dismisses
- Nothing goes live without GM sign-off — GM controls the canon
- Storage: `submissions.json`, append-only from the player side

### ✅ Mobile-Responsive Layout
- Responsive CSS pass — app reflows cleanly for phones and tablets
- Tab navigation converts to compact bottom bar or hamburger menu on small screens
- Key views prioritised for mobile: Dashboard, Roster, Chronicle
- GM gets the same treatment — useful for checking things at the table on a phone

---

## Files Changing
| File | What Changes |
|------|-------------|
| `server.py` | New endpoints: `/api/announce`, `/api/presence`, `/api/submissions` |
| `announcements.json` | NEW — current GM broadcast message |
| `submissions.json` | NEW — Chronicle submissions queue |
| `index.html` | Announcement banner, submission form, mobile meta tags |
| `js/app.js` | Broadcast UI, presence display, submission form wiring |
| `js/tabs/chronicle.js` | Submit Entry button for players, GM review panel |
| `css/style.css` | Mobile-responsive layout pass |

---

## What Players Gain in v2.1
| Feature | Player Experience |
|---------|-----------------|
| Announcement banner | Sees GM messages at the top of their screen |
| Chronicle submission | Can contribute their knight's perspective to the record |
| Mobile layout | Full usability on phone or tablet |

---

## Steps in Order
1. `/api/announce` endpoint + GM broadcast UI
2. `/api/presence` endpoint + GM online panel
3. `/api/submissions` endpoints + player submission form + GM review panel
4. Mobile CSS pass across all views
5. Test all features across GM + player accounts
6. Test on an actual phone / tablet

---

## Notes
- Presence is nearly free — Phase 1 polling is already a heartbeat. Server just needs
  to log the timestamp of each `/api/load` call per user.
- Broadcast banner auto-dismisses on player screens when GM clears it
  (caught on next 30-second poll — no WebSocket needed).
- Chronicle submissions are append-only from the player side.
  Players cannot edit or delete their own queued entries.
