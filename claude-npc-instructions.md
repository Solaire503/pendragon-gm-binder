# Pendragon GM's Binder — NPC Import Instructions for Claude.ai

Use these instructions when generating NPCs in Claude.ai that will be imported into the GM's Binder.

---

## How to Import

1. Generate the NPC in Claude.ai using the prompt structure below
2. Copy the JSON output (code fences included — the importer strips them automatically)
3. In the GM's Binder → **Roster tab** → click **"⬇ Import from Claude.ai"**
4. Paste the JSON and click **Import NPC**

---

## Prompt to Add to Your NPC Generator

Add this at the end of your NPC generation request:

> After describing the NPC, output a JSON code block formatted for my Pendragon GM's Binder:
>
> ```json
> {
>   "name": "Full name",
>   "pronoun": "She/her",
>   "role": "Lady",
>   "year_born": 465,
>   "household": "Household name",
>   "faction": "salisbury",
>   "glory": 0,
>   "eligibility": "No",
>   "dowry": "",
>   "notes": "Background, appearance, personality...",
>   "passions": "Love (family) 16, Loyalty (Lord Roderick) 13",
>   "traits": "Chaste 14, Generous 12, Valorous 10",
>   "skills": "Industry 14, Chirurgery 12, Intrigue 13",
>   "stats": "APP 16, CON 13, DEX 12, SIZ 10, STR 9"
> }
> ```

---

## Field Reference

### Required
| Field | Description | Example |
|-------|-------------|---------|
| `name` | Full name of the NPC | `"Rhiannon ferch Cadoc"` |

### Identity
| Field | Accepted values | Notes |
|-------|----------------|-------|
| `pronoun` | `He/him` · `She/her` · `They/them` | Also accepts: `male`/`female`/`m`/`f` |
| `role` | See role list below | Determines rank in the roster |
| `year_born` | Integer year (AD) | e.g. `465` — used for age and childbirth eligibility |
| `age` | Integer | Used only if `year_born` is absent; back-calculates birth year |

**Valid roles:** King · Warlord · Player Knight · Knight Banneret · Vassal Knight · Bachelor Knight · Mercenary Knight · Knight · Lady · Esquire · Squire · Page · Baron · Estate Holder · Steward · Priest · Druid · Merchant · Baby · Other

### Household, Faction & Estate
| Field | Description | Example |
|-------|-------------|---------|
| `household` | Household or family name | `"Dawnwell"` |
| `faction` | Political/regional allegiance — use the id exactly (see list below) | `"salisbury"` |
| `manor` | Manor name (display text) | `"Stapleford"` |
| `eligibility` | Marriage eligibility | `No` · `Yes` · `Widowed` · `Betrothed` · `Kinda?` |
| `dowry` | Dowry description | `"200 libra and a destrier"` |
| `glory` | Glory total (integer) | `1250` |

**Valid faction ids** (omit the field entirely if unknown or not applicable):
`logres` · `salisbury` · `rydychan` · `silchester` · `cambria` · `cumbria` · `north` · `brittany` · `ireland` · `continent` · `saxon` · `independent` · `ladies_of_lake` · `fae`

### Character Detail
| Field | Description | Notes |
|-------|-------------|-------|
| `notes` | Background, appearance, personality, history | Free text; supports long passages |
| `passions` | Passion scores | e.g. `"Love (family) 16, Loyalty (Uther) 13"` |
| `traits` | Trait scores | e.g. `"Chaste 14, Generous 12, Valorous 10"` — merged with Passions on import |
| `skills` | Notable skill scores | e.g. `"Sword 15, Lance 14, Courtesy 13"` |
| `stats` | Core statistics | e.g. `"APP 12, CON 13, DEX 11, SIZ 15, STR 14"` |

### Flags (optional, default false)
| Field | Description |
|-------|-------------|
| `blessed` | `true` if this is a blessed birth |
| `fate_touched` | `true` if fate-touched |
| `came_of_age` | `true` if already come of age |

---

## NPC Card Fields — What Maps Where

The GM's Binder NPC card has these sections. Here's how Claude.ai output maps to each:

```
┌─────────────────────────────────────────────┐
│  [Avatar]  Name                             │
│            Role · Pronoun                   │
│            Glory badge                      │
├─────────────────────────────────────────────┤
│  Born: year_born AD (age X)                 │
│  Eligibility: eligibility                   │
│  Dowry: dowry                               │
├─────────────────────────────────────────────┤
│  Notes         ← notes / background         │
│  Passions & Traits ← passions + traits      │
│  Skills        ← skills                     │
│  Stats         ← stats                      │
├─────────────────────────────────────────────┤
│  Relationships (added manually after import)│
│  Inferred: Siblings / Grandparents /        │
│            Aunts & Uncles / In-Laws         │
└─────────────────────────────────────────────┘
```

---

## Tips for Best Results

- **Passions and Traits are combined** in the Binder under "Passions & Traits". You can output them as one `passions` field or as separate `passions` and `traits` fields — both work.
- **Birth year matters** for the winter childbirth system (women age 18–40 appear in childbirth rolls) and for all age flags. Always provide `year_born` if known.
- **Household** must match an existing household name in your Binder exactly (case-sensitive) to appear grouped correctly in the roster.
- **Relationships** (spouse, children, parents, siblings) are added manually via the Relationships panel after import — they cannot be imported from JSON yet.
- The importer is forgiving: unknown fields are ignored, missing optional fields use safe defaults, and `male`/`female` pronoun values are normalised automatically.

---

## Example Output

```json
{
  "name": "Dame Terrwyn ferch Cadoc",
  "pronoun": "She/her",
  "role": "Lady",
  "year_born": 465,
  "household": "Dawnwell",
  "faction": "salisbury",
  "glory": 85,
  "eligibility": "No",
  "dowry": "",
  "notes": "Daughter of the late Sir Cadoc of Stapleford. Dark-haired and sharp-tongued, Terrwyn manages the Dawnwell estate with quiet competence while her husband campaigns. She holds a deep suspicion of the Church following her mother's death at a priest's mishandled blessing.",
  "passions": "Love (husband) 15, Hate (clergy) 12, Loyalty (household) 16",
  "traits": "Chaste 14, Generous 11, Honest 13, Prudent 15, Valorous 8",
  "skills": "Industry 16, Chirurgery 13, Intrigue 14, Stewardship 15",
  "stats": "APP 15, CON 14, DEX 13, SIZ 11, STR 9"
}
```
