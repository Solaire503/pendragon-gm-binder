# Pendragon GM's Binder — Horse Tracking & Survival
## Phase 3 Reference Document

---

## Horse Data Fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | `horse-{timestamp}` |
| `name` | string | Player-given name |
| `type` | string | See horse type list above |
| `year_born` | number | Auto-calculated from age entered at creation (`campaign_year - age`). Ages up automatically. |
| `year_acquired` | number | Auto-filled with current campaign year. Used to fence manor lifestyle penalties — only years since acquisition count. |
| `notes` | string | Optional freeform notes |
| `alive` | boolean | False if horse died or ruined — kept for history |
| `year_died` | number | Year the horse died/was ruined (if applicable) |
| `death_reason` | string | `'dead'` or `'ruined'` |
| `favorite` | boolean | Pinned to Pet Cemetery permanently; max 10 per player |
| `survivalHistory` | array | `[{ year, roll, modifiers, modified_total, result }]` |

**Derived at render time (never stored):**
- `age` = `STORE.year - year_born`
- `requiresRoll` = type is in War Horses or Riding Horses list

---

## Horse Types

### Require Survival Rolls
**War Horses**
- Hobby
- Charger (Small)
- Charger (Normal)
- Fairy Horse

**Riding Horses**
- Jennet
- Rouncey (Inferior)
- Rouncy (Small)
- Rouncy (Normal)
- Rouncy (Large)
- Courser
- Dales/Irish/Cambrian Pony

### No Survival Roll Required *(players may roll voluntarily)*
**Work Horses**
- Cart Horse
- Cob
- Nag
- Sumpter
- Sumpter (Strong)
- Hackney
- Donkey
- Mule

---

## Creation Form

Shown as italic helper text below the Age field, based on horse type selected:

| Type group | Hint text |
|-----------|-----------|
| War Horses (any) | *"Combat horses are typically fully-fledged at age 8."* |
| Riding Horses (any) | *"Riding horses are typically fully-fledged at age 5."* |
| Work Horses (any) | *"Work horses are typically ready at age 4."* |

Fields: Name, Type (dropdown), Age (number input), Notes (optional).
No weakened field — removed from design.

---

## Survival Roll Mechanics

### The Roll
Roll **1d20**, apply all modifiers, read result.

---

### Modifiers

| Condition | Modifier | Notes |
|-----------|---------|-------|
| Horse older than 7 | −1 per year over 7 | e.g. age 10 → −3 |
| Impoverished (current winter) | −15 | From manor history lifestyle field |
| Poor (current winter) | −3 | From manor history lifestyle field |
| Consecutive years poor OR impoverished | −3 per consecutive year | Counts consecutive years in manor history since `year_acquired`. e.g. 3 consecutive years → −9 additional |

**Winter phase order:** Solo/Events → Experience → Aging → **Economic Circumstances (Record Year)** → **Stable Rolls** → Family Rolls. This means when stable rolls happen, the current year's manor history entry already exists with its lifestyle value. The roll reads that entry directly.

**Manor data dependency:** Pulled from `manor.history[]` entries where `h.lifestyle === 'Poor'` or `h.lifestyle === 'Impoverished'`. Confirmed stored values: `'Impoverished'`, `'Poor'`, `'Normal'`, `'Rich'`, `'Extravagant'`.

**Consecutive year logic:** Count backward from the current year through manor history (only years ≥ `horse.year_acquired`), counting how many consecutive years were Poor OR Impoverished (including the current year). Stop counting at the first year that was Normal or better.

**If no history entry exists for the current year** (Economic Circumstances not yet recorded): warn the player — "Record Year must be completed before rolling horse survival."

**All modifiers stack.** Example — 3 consecutive poor years including current year (age 10 horse):
- Current year Poor: −3
- Consecutive (3 years × −3): −9  
- Age penalty (age 10, over 7 by 3): −3
- **Total modifier: −15**

---

### Results

| Modified Roll | Result |
|--------------|--------|
| **1 or less** | **Dead** — horse dies, breaks a leg, or is otherwise rendered unusable. Cannot be sold even as a nag. |
| **2** | **Ruined** — horse is no longer serviceable |
| **3–20** | **Healthy** — horse survives the year |

---

### Roll Record per Horse
Each survival roll stored in `survivalHistory`:
```json
{
  "year": 499,
  "roll": 14,
  "modifiers": {
    "age_penalty": -3,
    "impoverished": 0,
    "poor": -3,
    "consecutive": -6
  },
  "modified_total": 2,
  "result": "ruined"
}
```

---

## Storage
- Per-player: `player_data/{username}/horses.json`
- Array of horse objects (living and dead together, filtered at render time)
- GM can read/write all players' stables via `/api/player-data/{username}/horses`

Add `favorite` boolean field to horse object (default `false`).

---

## UI Layout — Stables Subtab

### Active Stables
Living horses. Add horse button. Roll survival buttons during winter.

### Pet Cemetery *(or equally grim name)*
Dead and ruined horses, shown beneath the active stables.

**Display rules:**
- Show the **30 most recent** dead/ruined horses (sorted by `year_died` descending)
- Horses beyond 30 are hidden from display but remain in the JSON (not deleted)
- **Exception: Favorites** — a horse marked as favourite is always shown regardless of age/position
- Players can mark any dead horse as favourite (☆ / ★ toggle on the card)
- Maximum **10 favourites** per player. If at 10, the ★ button is disabled on non-favourites with a small tooltip: "Remove a favourite to add another (10/10)"

**Visual treatment:** Faded cards, muted colours, small epitaph-style layout. Show name, type, years lived (`year_born – year_died`), cause (`Dead` or `Ruined`), and any notes.
