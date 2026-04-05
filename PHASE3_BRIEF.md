# Pendragon GM's Binder — v2.2 Roadmap
## Phase 3 · Player-Writable Space
### Status: IN PROGRESS

---

## What v2.2 Is

Phase 1 gave players a read-only view of their world.
Phase 2 adds live session tools.
Phase 3 gives players their own writable space — things they own and maintain themselves,
separate from the shared binder the GM controls.

All Phase 3 data is stored **per-player server-side**, never in the shared `binder-save.json`.

---

## Feature Status

### ✅ Player Dashboard (delivered in v2.0)
Built ahead of schedule during Phase 1 extended scope.
- Personalised welcome with cycling Arthurian greeting
- Manor snapshot with expandable damage
- Attention items: treasury, steward, heir, repairs, age transitions, marriage eligibility
- Expandable / sortable household roster
- Recent deaths and recent chronicle
- Fully pronoun-aware (My Lord / My Lady / My Liege)

### ✅ Player Knight Succession (delivered in v2.0)
Built ahead of schedule during Phase 1 extended scope.
- Multi-step modal: Died / Retired / Just Switching
- Died: records cause + year, moves NPC to Mausoleum
- Retired: logs life event, demotes old PK to Knight role
- Select new PK from household member grid
- Saves server-side via `/api/succession` — players cannot write to the main save directly

---

### 🔲 Notes System
**Status: Not started**

Players can write notes visible only to themselves.
GM can write notes visible to a specific player or all players.

Note types:
- **General** — freeform session notes, reminders, theories
- **NPC notes** — player's personal impressions of an NPC (separate from the NPC card)
- **Manor notes** — observations about a manor beyond the official record

Storage: `player_data/{username}/notes.json` — never in the shared save file.

GM view: GM can read/write all player note spaces from a GM-only panel.

---

### 🔲 Horse Tracking & Survival Rolls
**Status: Waiting on survival tables from Steve**

**Location:** Player Manors tab — new "Horses" sub-tab alongside the read-only manor overview.

**What players can do:**
- Add their own horses: name, breed / type, quality, year acquired, notes
- Roll survival for each horse at end of year using the Pendragon horse survival tables
- See a record of past survival rolls per horse

**What the GM can do:**
- Add horses to any player's stable from within the GM Manors tab
- See all players' stables at a glance

Storage: `player_data/{username}/horses.json`

> ⚠ Horse survival tables to be supplied by Steve before implementation begins.

---

## Shared Storage Pattern

Both Notes and Horses use the same `player_data/` directory structure so there is one
consistent persistence approach across all player-owned data:

```
player_data/
  zerk/
    notes.json
    horses.json
  dan/
    notes.json
    horses.json
  ...
```

New server endpoints needed:
- `GET/POST /api/player-data/{type}` — read/write own data
- `GET/POST /api/player-data/{username}/{type}` — GM read/write any player's data

---

## What Players Gain in v2.2
| Feature | Player Experience |
|---------|-----------------|
| Notes | Private scratchpad — NPCs, manors, general session notes |
| Horse tracking | Own and name horses, roll their survival each winter |
| Horse history | See the record of every survival roll, good and bad |

---

## What the GM Gains in v2.2
| Feature | GM Experience |
|---------|--------------|
| Notes (player view) | Can write notes visible to specific players or all players |
| Stable overview | Sees all players' stables from the Manors tab |
| Horse management | Can add / edit horses in any player's stable |

---

## Steps in Order
1. Create `player_data/` directory structure + shared read/write endpoints
2. Build Notes system (storage, player UI, GM view)
3. Receive horse survival tables from Steve
4. Build Horse tracking (player sub-tab, add/edit horses)
5. Build survival roll UI (tables, roll record per horse)
6. Build GM stable overview in Manors tab
