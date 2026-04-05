# Pendragon GM's Binder — Multiplayer Build: Things Needed from the GM

This document lists everything needed from you before each phase can be built.
Answer what you can now; the rest can come later when that phase starts.

---

## 🔐 Phase 1 — Server & Auth

### Network setup
- [ ] **How do players access it?** Local home network only (same Wi-Fi), or do you want it reachable from outside your house (port forwarding / VPN)?
- [ ] **Server machine OS** — is the old PC running Windows, Linux, or something else?
- [ ] **Python version** — run `python --version` on the server machine and tell me what it says. (Flask requires 3.8+)

### User accounts
- [ ] **How many players?** List their names (or usernames they'd like) and which household/character they're tied to.
  - Example: `Zerk → House Blackwood (Sir Aldric)`
- [ ] **Username style** — real names, character names, or chosen handles?
- [ ] **GM username** — what do you want your own login to be?
- [ ] **Password setup** — do you want to set passwords yourself and hand them out, or have players set their own on first login?

---

## 👁 Phase 2 — Role-Based Views

### What players can see
- [ ] **Family Trees tab** — read-only for players, or GM-only entirely?
- [ ] **Dashboard** — hide completely from players, or show a stripped-down "campaign status" version?
- [ ] **Chronicle** — can players add their own entries (from their character's POV), or is it GM-written only?
- [ ] **NPC notes field** — is the full notes/background text on NPC cards visible to players, or only the name/role/household?

### Household assignment
- [ ] For each player, which **exact household name** (as it appears in the Binder) are they tied to?
- [ ] Can a player be tied to **more than one household** (e.g. their character's household + a parent household)?

---

## 💬 Phase 3 — Player Interactions

### Comments
- [ ] Are NPC comments **visible to all players**, or only the player who wrote them + GM?
- [ ] Can players **delete their own comments**, or only GM can delete?
- [ ] Should comments show the **player's username**, the **character name**, or both?

### Edit permissions
- [ ] When a player edits a household NPC, should the change apply **immediately** (with a GM notification), or should it be **held for GM approval** first?
- [ ] What fields should players be allowed to edit on household NPCs? Suggestions:
  - Notes / background text
  - Skills / stats / passions
  - Glory
  - Eligibility / relationships?
- [ ] Should players be able to **add new NPCs** to their household, or only edit existing ones?

### Player notes
- [ ] Should player notes be **private to each player** (only they and GM can see), or **shared** (all players can read each other's notes)?

---

## ⚔ Phase 4 — Winter: Player View

### Survival rolls
- [ ] When the GM rolls Survival for the whole roster, do you want players to **see results in real time** (auto-refresh), or only when they next open the app?
- [ ] Should players be able to see **survival roll results for other households**, or only their own?

---

## 🐴 Phase 5 — Horse Survival

This phase needs the most input. Please provide:

### Horse stat fields
What information is tracked per horse? Expected fields (correct/add as needed):
- [ ] Horse name
- [ ] Breed / type (Charger, Rouncey, Sumpter, etc.)
- [ ] Owner (linked to player character NPC)
- [ ] Year acquired
- [ ] CON (Constitution — for survival rolls)
- [ ] Damage / wounds (if tracked)
- [ ] Special traits or notes
- [ ] Status (Alive / Dead / Retired / Lost)
- [ ] Any other stats from the rulebook?

### Survival tables
- [ ] Please paste or describe the **Horse Survival roll tables** from the rulebook. Needed:
  - What is rolled (d20? d6? modified?)
  - What modifiers apply (breed, season, campaign, etc.)
  - What each result range means (survives / injured / dies / etc.)

### History
- [ ] Should horse deaths be logged somewhere (like a "horse mausoleum")?
- [ ] Should horses appear in the **Chronicle** when they die or are acquired?

---

## 🔑 Security Reminder

Before the server opens to the network:
- **Rotate your Anthropic API key** at console.anthropic.com — the current key is stored in plaintext in `config.json` and should be replaced once the server is network-accessible.
- The new build will store keys in environment variables, not config files.

---

## 📋 Quick-reference checklist (fill in & hand back)

```
Players:
  1. Zerk    → Blackwood  → active PK NPC name: ← STILL NEEDED
  2. Dan     → Cador      → active PK NPC name: ← STILL NEEDED
  3. Rich    → Dawnwell   → active PK NPC name: ← STILL NEEDED
  4. Tay     → Westwood   → active PK NPC name: ← STILL NEEDED

GM username: Steve
Network: [x] External access
Server OS: Windows 10/11
Python version:            ← STILL NEEDED (run: python --version)

Family Trees: [ ] Player read-only  [ ] GM only
Dashboard: [ ] Hidden from players  [ ] Stripped-down version
Chronicle entries by players: [ ] Yes  [ ] No
NPC notes visible to players: [ ] Yes  [ ] No
Comments visible to: [ ] All players  [ ] Author + GM only
Edits: [ ] Apply immediately (GM notified)  [ ] Hold for GM approval
Player notes: [ ] Private  [ ] Shared

Horse CON field: [ ] Yes  [ ] No
Horse damage tracking: [ ] Yes  [ ] No
[Paste survival table here when ready]
```
