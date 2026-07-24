/* ══════════════════════════════════════════════════════════════
   PATCH-NOTES.JS — Static content for Features Guide & Patch Notes
   Loaded before app.js so FEATURES and PATCH_NOTES are available globally.
══════════════════════════════════════════════════════════════ */

// ── FEATURES GUIDE ────────────────────────────────────────────
// Each entry: { heading, icon, items:[], playerOnly? }
// Entries marked divider:true render as a section break with a label.
const FEATURES = [

  // ── PLAYER KNIGHT FEATURES ────────────────────────────────
  {
    divider: true,
    label: 'Your View — Player Knight Features',
  },
  {
    heading: 'Your Household — Editing',
    icon: '🖋',
    items: [
      'You can edit any NPC in your own household — open their card and use the Edit button.',
      'Editable fields: name, pronoun, passions & traits, skills, and stats. Notes, role changes, deaths, and household moves remain with the GM.',
      'Your household members\' passions, skills, and stats are visible to you on their cards. Notes are visible on every NPC.',
      'Every edit is saved to the shared binder and the GM is notified of who changed what.',
    ],
  },
  {
    heading: 'Tasks & Reminders',
    icon: '📋',
    items: [
      'A sticky task board on your dashboard — write reminders that persist every time you log in.',
      'Check off a task to complete it. Completed tasks collapse into a "Completed" section and disappear after 90 days.',
      'Mark any task as ⚑ High Priority to make it bold with a red left border — hard to miss.',
      'Use "📨 Assign task to GM" to send a reminder directly to the GM\'s board (your name will be attached so they know who sent it).',
      'The GM can also broadcast tasks to all players at once — look for the 📢 badge on shared tasks.',
    ],
  },
  {
    heading: 'Your Dashboard',
    icon: '⚜',
    items: [
      'Your dashboard opens to a personalised welcome addressed to your Player Knight by name and title. The greeting rotates daily through Arthurian phrases.',
      'Manor Snapshot — your treasury balance, base harvest, last year\'s result and net income, active improvements, and any property damage. Click the damage count to expand each item.',
      'Matters Requiring Attention — a living checklist that flags anything your household needs action on: treasury deficits, missing steward or heir, overdue repairs, vassal manors with no knight enfeoffed (or whose knight has fallen), household members ready for an age transition (page → squire → knighting), family members eligible for marriage, and betrothed pairs who are both now of age and ready to wed. The header shows a count of open items.',
      'Household Roster — your full household at a glance. Click any name to open their NPC card. Expand the roster to see everyone, and sort by rank, age, or A–Z.',
      'Recent Deaths — the last three years of deaths across all households, with your own household\'s losses listed first in crimson.',
      'Recent Chronicle — the last five events recorded in the Chronicle across the past two years.',
      'Your data refreshes automatically every 30 seconds — you\'ll see the GM\'s updates without needing to reload.',
    ],
  },
  {
    heading: 'Change Player Knight',
    icon: '⚔',
    items: [
      'The ⚔ Change Player Knight button opens a multi-step succession flow.',
      'Step 1 — What happened to your current knight? Choose Died, Retired, or Just Switching.',
      'Died: record the year and cause of death. The knight is moved to the Mausoleum and their record updated.',
      'Retired: log a life event (pre-filled as "Retired from Questing") with year, season, and notes. The knight\'s role is changed to Knight.',
      'Just Switching: no record changes — the role is simply reassigned.',
      'Step 2 — Select your new Player Knight from a grid of your household members (name, role, age).',
      'Step 3 — Confirm the summary and save. The change is written to the shared binder immediately.',
    ],
  },
  {
    heading: 'Your Manor',
    icon: '🏰',
    items: [
      'The Manors tab opens to a full read-only overview of your manor — all the same detail the GM sees, without the edit controls.',
      'Summary tiles at the top show all active manors so you can see where your household stands relative to others.',
      'Your manor\'s tile has a coloured left border in your household colour.',
    ],
  },
  {
    heading: 'Persons of Interest',
    icon: '★',
    items: [
      'Open any NPC card and click the ☆ Pin button to add them to your Persons of Interest list.',
      'Pinned NPCs appear in a ★ Persons of Interest widget on your dashboard. Clicking any name opens their card without leaving the dashboard.',
      'The pin button turns gold (★) when an NPC is pinned. Click it again to unpin.',
      'Your list is personal — each player and the GM has their own independent list. No limit on how many you can pin.',
    ],
  },
  {
    heading: 'Stables',
    icon: '🐴',
    items: [
      'The Stables subtab lives inside your manor detail. Switch between Overview and Stables using the buttons above your manor section.',
      'Add horses to your stable: give each a name, choose its type (War Horse, Riding Horse, or Work Horse), set its age, assign a rider from your household, and add optional notes.',
      'Age is tracked automatically — set it once at creation and it ages up with the campaign year.',
      'War Horses and Riding Horses require a survival roll each winter. Click the 🎲 Roll button during the Winter Phase after Economic Circumstances have been recorded.',
      'Work Horses don\'t require a survival roll — but you may roll voluntarily if you wish.',
      'The survival roll is 1d20 plus modifiers. Modifiers include an age penalty (−1 per year over age 7), a lifestyle penalty (−3 Poor, −15 Impoverished), and a cumulative streak penalty (−3 per consecutive year of poverty). All modifiers are calculated and displayed automatically.',
      'Roll results: 1 or less — the horse dies. 2 — the horse is ruined (no longer serviceable). 3–20 — healthy, survives the winter.',
      'Every roll is recorded in the horse\'s history so you can see exactly what happened and when.',
      'Horses that die or are ruined move to the Pet Cemetery below the active stable. The 30 most recent are shown; mark up to 10 as favourites (★) to keep them visible permanently.',
    ],
  },
  {
    heading: 'Roster & NPC Cards',
    icon: '📜',
    items: [
      'The full NPC Roster is available for browsing — search by name, household, role, or status.',
      'Click any NPC to open their card: relationships, life events, and family tree links.',
      'On desktop, NPC cards display a sidebar on the right with My Impressions and the Comments section. On mobile, tap "📝 Notes & Comments" to slide it in.',
    ],
  },
  {
    heading: 'My Impressions',
    icon: '🖊',
    items: [
      'Every NPC card has a My Impressions section in the sidebar — a private note visible only to you.',
      'Write anything about this character from your knight\'s perspective: suspicions, alliances, feelings. Auto-saves as you type.',
      'Impressions are stored per-user, per-NPC — your notes about an NPC are invisible to everyone else.',
    ],
  },
  {
    heading: 'Public NPC Comments',
    icon: '💬',
    items: [
      'Leave a public comment on any NPC card — visible to all logged-in users.',
      'Full @NPC mention support — type @ to search and link any character. Mentions render as clickable links.',
      'Reply to any comment one level deep. Edit your own comments at any time.',
      'Delete your own comments (soft-delete — the GM can still see the content). You can restore a comment you deleted yourself.',
    ],
  },
  {
    heading: 'Notifications',
    icon: '🔔',
    items: [
      'The 🔔 bell in the header shows a badge when you have unread notifications.',
      'You are notified when someone leaves a comment on an NPC card, or when the GM writes you a private journal note.',
      'Click the bell to open the panel. Click any notification to jump to the relevant NPC. Mark individual items or all as read.',
    ],
  },
  {
    heading: 'Journal — Private Notes',
    icon: '📝',
    items: [
      'The Journal tab (under Records in the nav) is your private scratchpad — visible only to you.',
      'General Notes and Manor Notes sections, with a live @NPC mention preview as you type. Auto-saves with a short debounce.',
      'Notes from the GM appear in a separate section — the GM can write you a private message that only you can see.',
    ],
  },
  {
    heading: 'Families Tab',
    icon: '🌳',
    items: [
      'Browse any household\'s roster, manor holdings, and family tree.',
      'You can add, edit, and delete relationships on your own household\'s family tree. Other households\' trees are view-only.',
      'Tree node positions (drag from the Unplaced pocket) persist for your household.',
    ],
  },
  {
    heading: 'Chronicle',
    icon: '📜',
    items: [
      'The Chronicle tab shows the full campaign record — browse any year and read every event.',
      'The Mausoleum lists everyone who has died, with cause, dates, age at death, and glory.',
    ],
  },
  {
    heading: 'Chronicle Submissions',
    icon: '📜',
    items: [
      'The "📜 Submit Entry" button on the Chronicle tab lets you contribute a record from your knight\'s point of view.',
      'Write your account in the submission form and click Submit for Review. Your entry is queued and sent to the GM — nothing appears in the shared chronicle until the GM approves it.',
      'Once approved, your entry appears in the chronicle for the current year just like any other event.',
    ],
  },
  {
    heading: 'Caliburn — Discord Bot',
    icon: '⚔',
    items: [
      'Caliburn is the campaign\'s Discord bot — always online, no setup needed. All commands require the Knight of the Realm role.',
      '/roll, /skill, /passion, /oppose, /trait, /damage — all Pendragon 6e dice commands.',
      '/npc <name> — look up any NPC. If the name isn\'t exact, Caliburn offers up to 5 "Did you mean?" suggestions as buttons.',
      '/chronicle — recent campaign events. /year — current campaign year.',
      '/feast and /justice — AI-generated dark ages feast dishes and manor justice events.',
      '/speak <message> — address Caliburn, the sword of Britain, directly. He has opinions.',
      '/bugreport — submit a bug report for the GM\'s Binder. Opens a form with Summary and Details fields. Creates a GitHub issue automatically and notifies the GM.',
    ],
  },
  {
    heading: 'Observer Accounts',
    icon: '👁',
    items: [
      'Observer is a read-only role for the Binder — ideal for showing off the campaign to a guest or new player without risk of anything being changed.',
      'Observers see the full GM overview: all NPCs, manors, families, chronicle, roster, and dashboard panels.',
      'All write controls are hidden from the UI and blocked on the server — nothing can be accidentally modified.',
      'Create an Observer account via GM Tools → Manage Users. Set role to Observer — no household assignment needed.',
    ],
  },

  // ── FULL GM FEATURE SET ────────────────────────────────────
  {
    divider: true,
    label: 'The Full Binder — GM Feature Set',
  },
  {
    heading: 'NPC Roster',
    icon: '📜',
    items: [
      'Add, edit, and track every living NPC across all households — name, role, pronouns, birth year, household, manor, glory, skills, stats, passions, and notes.',
      'Flag NPCs as Blessed (with a blessing description), Fate-Touched, or Came of Age. CON and Barren fields support the Winter childbirth system.',
      'Age pills on every roster entry. Living NPCs show current age; deceased show age at death.',
      'Manage relationships between any two NPCs — Spouse, Child, Bastard, Sibling, Squire, Vassal, and more. Relationship direction is enforced automatically by birth year.',
      'Bulk-add relationships: select a type once and add multiple people at the same time. Duplicate relationships are detected and skipped with a warning.',
      'Sibling relationships are inferred automatically from shared parent records — shown on NPC cards as Full Sibling, Half-Sibling, Step-Sibling, or Sibling (when only one parent is recorded). Never stored, never clutters the tree.',
      'Extended inferred family on NPC cards: Grandparents & Grandchildren, Aunts/Uncles & Nieces/Nephews, and In-Laws using period-accurate Good-Father/Mother/Son/Daughter/Brother/Sister terminology. All computed on the fly.',
      'Import an NPC directly from Claude.ai using the "⬇ Import from Claude.ai" button. Paste Claude\'s JSON output and the NPC is added and opened immediately.',
      'The Head of House flag can be set on any NPC via the family tree right-click menu.',
      'Search and filter the roster by name, household, role, or status (living/dead).',
    ],
  },
  {
    heading: 'NPC Stat Block Templates',
    icon: '📋',
    items: [
      '19 pre-built stat block templates from the Pendragon 6e GM\'s Handbook — Saxon Ceorls, Saxon Thegns, Irish Warriors, Ordinary Knights, Veteran Knights, and more across four categories.',
      'Access via the "📋 Attach Template Stat Block" button when adding or editing an NPC. Opens a picker showing all templates grouped by category.',
      'Clicking a template pre-fills Stats, Passions & Traits, and Skills in the edit form. The template name is saved with the NPC and shown as a badge on their card.',
      'All fields remain fully editable after applying — templates are a starting point, not a lock.',
      'Passions & Traits, Skills, and Stats are GM-only fields — players cannot see them on NPC cards.',
    ],
  },
  {
    heading: 'Households & Family Trees',
    icon: '🌳',
    items: [
      'Each household has a name, colour, and icon that carries through the whole app.',
      'Household detail view shows all living members, manor summary, and a relationship count. The banner shows the current Head of House if one is set.',
      'Family tree SVG renderer with drag, pan, and zoom. Supports Dynasty Layout (BFS from a chosen founder) and Grid Layout.',
      'Dynasty Layout places generations in rows. Parent-child brackets and sibling arcs drawn automatically. Explicit sibling lines suppressed when the shared parent is already visible.',
      'Bastard and Adopted children use distinct dash patterns on their parent lines.',
      'Right-click any node to: set Dynasty Founder, set Head of House, start a connection, bulk-add children, or send to pocket.',
      'Export the full tree as a PNG at 2×, 3×, or 4× resolution.',
    ],
  },
  {
    heading: 'Manor Management',
    icon: '🏰',
    items: [
      'Track any number of manors, each with a base harvest, lord/lady, steward, heir, and notes.',
      'Record Year logs a full annual ledger: harvest income, steward industry, improvement income, vassal income, discretionary, extra-manorial, and misc income against lifestyle, maintenance, family, build cost, and misc expenses.',
      'Misfortune Factors (weather, conflict, commoners, presence, misc) sum to a Total Misfortune Score.',
      'Conflict outcomes: No Result · Bandits · Raided · Pillaged · Plundered.',
      'Improvements track fixed and dice income. Record Year pre-fills improvement income automatically.',
      'Personnel fields (Lord/Lady, Steward, Heir) use the NPC search widget.',
      'Export any recorded year as a parchment summary PNG to share with players.',
    ],
  },
  {
    heading: 'NPC Manors',
    icon: '🏛',
    items: [
      'A GM ledger of non-player manors across the realm — track manor name, title holder, status (Granted, Gifted, Seized, Purchased, Escheated, or Other), location, faction, and freeform notes with @mention support.',
      'Assign holders via NPC search. When a holder dies, the manor is flagged Vacant and appears in the GM dashboard\'s "Vacant NPC Manors" card.',
      'Trigger Succession — when a holder falls, choose to pass the manor to an heir or escheat it to the liege. Both outcomes are recorded in the Chronicle.',
      'Abdicate — a living holder can step down. Name a successor or revert the manor to the liege, with a reason for the abdication. Chronicle entry is written automatically.',
      'Trust system — if the heir has not come of age, appoint a trustee. The card shows "In Trust" with the trustee\'s name. When the heir comes of age, "End Trust" confirms the transition and writes to the Chronicle. Trust is checked on succession, assignment, edit, and abdication.',
      'Related NPCs — link household knights, chaplains, and other associated NPCs to a manor with a role label and notes. Editable inline.',
      'Quick Create NPC — every NPC search field has a "+ Create New NPC" button to create an NPC on the spot without leaving the current flow.',
      'Status tooltips explain the feudal meaning of Granted, Gifted, and Escheated — click or tap the status badge to see them.',
      'Filter by All / Vacant / Held. Sort by name, location, or faction.',
      'Players can view all NPC manors (read-only). All edit controls are GM-only.',
    ],
  },
  {
    heading: 'Persons of Interest',
    icon: '★',
    items: [
      'Any user can pin NPCs to their personal Persons of Interest list using the ☆ Pin button on any NPC card.',
      'Each user\'s pinned characters appear in a ★ Persons of Interest widget on their own dashboard. Clicking opens the NPC card without leaving the dashboard.',
      'Pins are per-user and independent — the GM\'s list is separate from each player\'s. No cap on pins.',
      'GM pins work exactly like player pins — the GM\'s list is stored and loaded independently.',
    ],
  },
  {
    heading: 'Stables',
    icon: '🐴',
    items: [
      'Each manor has a Stables section tab (alongside Overview, History, and Improvements). The GM can add, edit, and manage horses for any household.',
      'Horses belong to the player whose household owns the manor — each player\'s stable is tracked independently.',
      'Add horses with full details: name, type, age, rider (assigned from household members), and notes. Year Born is calculated automatically from the age entered.',
      'Mark a living horse as Dead (✝) or Ruined (⚠) manually if needed outside a survival roll, or delete it entirely.',
      'All horse types are supported. War Horses and Riding Horses get the 🎲 Roll button for survival. Work Horses appear in the stable but have no required roll.',
      'Pet Cemetery shows the 30 most recent dead/ruined horses per stable. Starred favourites always appear regardless of position.',
    ],
  },
  {
    heading: 'Winter Phase — Survival Rolls',
    icon: '☠',
    items: [
      'All living NPCs automatically categorised by age and gender: Infant, Child, Women, Adult, Elder, Very Old.',
      'Auto-exempt: Player Knights, Fate-Touched, Pages, Squires, and Blessed children under 21.',
      'Deaths pulled into a "Deaths — Pending Confirmation" block. Enter a cause and confirm — they move to the Mausoleum automatically.',
    ],
  },
  {
    heading: 'Winter Phase — Childbirth Rolls',
    icon: '🍼',
    items: [
      'Eligible women (she/her · age 18+ · not barren) grouped by household. Each row shows CON, auto-modifiers, and calculated effective CON.',
      'Conception: 1d20 vs effective CON. Critical = multiple birth or Blessed child. Fumble = tragedy table (child dies, mother dies, both die, permanent −1 CON, or barren).',
      'Record Birth creates the child NPC pre-linked to mother and father with the correct relationship type.',
    ],
  },
  {
    heading: 'Winter Phase — Marriage Rolls',
    icon: '💒',
    items: [
      'Maidens-in-Waiting: she/her NPCs, untitled, unmarried, age 17+. Roll 1d20 + age modifier — total 20+ = marries this year.',
      'Knights & Nobles: knightly/noble role, unmarried, age 21+. Roll d20 ≤ Courtesy + Years Waited.',
      'Wife\'s Rank table: 8 tiers from Wealthy Commoner\'s Daughter to High Baron\'s Daughter.',
      'Bachelor Knights need lord\'s permission (Eligible checkbox) before they may roll.',
      'Orientation-filtered spouse picker in the confirmation modal. Creates a Spouse relationship with the year in notes.',
    ],
  },
  {
    heading: 'NPC Comments — GM Controls',
    icon: '💬',
    items: [
      'The GM can delete any comment from any user. Soft-deleted comments show the content struck through (visible to the GM only) — players see only "[deleted]".',
      'Restore any deleted comment (your own or another user\'s). Shred (GM only) permanently removes a comment from the record with no undo.',
      'Full edit history: click the history icon on any edited comment to see every previous version with timestamps.',
      'GM notes in the sidebar are private to the GM. Use the Journal "Write to Player" section to push a private note to a specific player.',
    ],
  },
  {
    heading: 'Journal — Write to Player',
    icon: '📝',
    items: [
      'The GM\'s Journal tab includes a "Write to Player" section — select a player and write a private note they alone can see.',
      'Submitting the note pushes a notification to that player immediately. They\'ll see it in their Journal\'s "Notes from the GM" section.',
    ],
  },
  {
    heading: 'Chronicle — GM Controls',
    icon: '📜',
    items: [
      'Add chronicle entries for any year directly from the Chronicle tab — choose a category (Campaign, Combat, Personal, Supernatural, Rumour) and write the entry.',
      'Each NPC life event has a 📜 button — click it to commit that event\'s flavor text to the Chronicle of Logres for its year. Fully editable before committing.',
      'Attempting to send the same life event to the Chronicle twice shows a refusal — the entry is tracked by ID so duplicates are prevented regardless of text edits.',
      'Resolved solo generator cards with flavor text also show "📜 Add to Chronicle" — same editable pre-fill flow.',
      'Review and approve player Chronicle submissions from the pending queue at the bottom of the Chronicle tab.',
    ],
  },
  {
    heading: 'Yearly & Solo Events',
    icon: '🎲',
    items: [
      'Three roll types per knight: Yearly Event (1d20 → full table), Solo Event (1d6 → adventure chain), and Kin Events (frequency + full 40-entry kin table).',
      'Multi-knight support — roll for every active knight simultaneously.',
      'AI flavor text via Claude Haiku, written in the style of Malory\'s Le Morte d\'Arthur — 2-3 sentences, the actual event outcome woven into the prose. Knight personality notes steer the voice.',
      'Resolved events auto-add to the knight\'s Life Events chronicle on their NPC card.',
      'Resolved cards with flavor text show "📜 Add to Chronicle" to commit the event to the shared campaign record.',
    ],
  },
  {
    heading: 'Mausoleum',
    icon: '🕯',
    items: [
      'All deceased NPCs in a grid, sorted by year of death. Filter by household or search by name, role, or notes.',
      'Export Roll of the Fallen — a gothic parchment PNG listing all who died in a chosen year.',
      'Out of Story sub-tab: living NPCs temporarily absent from the campaign (travelling, imprisoned, etc.) — excluded from all Winter rolls.',
    ],
  },
  {
    heading: 'Data & Settings',
    icon: '⚙',
    items: [
      'Data is stored server-side in a JSON save file. The GM can export a full backup at any time and import from a previous backup to restore or transfer a campaign.',
      'HTTPS — all traffic is encrypted. Players connect over the local network or internet with a one-time browser certificate warning.',
      'User accounts for each player (set via /setup on first run). Each player\'s session is tied to their household.',
      'Year display in the header — advance or rewind the year with the ‹ › buttons. All age calculations, roll categories, and displays update live.',
      'GM-only: AI key, export/import, new binder, file picker, and all edit controls.',
    ],
  },
  {
    heading: 'Multiplayer — Broadcasts & Presence',
    icon: '\uD83D\uDCE3',
    items: [
      'GM Broadcast Messages: the GM can send a brief announcement from the dashboard that appears as a gold-bordered banner on every connected player\'s screen. Broadcasts also trigger a prominent toast notification.',
      'Player Presence: a green-dot indicator in the header shows how many users are currently online. Click it to expand a dropdown listing each connected user by name.',
      'Heartbeat polling keeps presence accurate — users disappear from the list within 60 seconds of closing the app.',
    ],
  },
  {
    heading: 'Battle Records',
    icon: '⚔',
    items: [
      'A full GM battle console for running KAP 6th Edition battles — from setup through finalization.',
      'Setup Phase: name the battle, set year & location, choose battle size (Fight through Huge — auto-sets max rounds), assign friendly and enemy commanders, add participants from the NPC roster with auto-detect for PKs and player control.',
      'Foes Table: 29 built-in foe templates across four categories (Battle Encounters, Knights, Saxons, Picts) with all stats pre-filled. Add custom foes with HP, armor, skill, damage, KV, glory, morale thresholds, and a free-text skills/behavior field. Add or edit foes during setup or mid-battle.',
      'Battle Console: two-column layout with participant cards, morale tracker, encounter card, and round notes on the left; 10-step battle procedure, foes reference, round log, kills summary, and round controls on the right.',
      'Morale Tracker: editable current and starting morale with ±1 and ±5 quick-adjust buttons.',
      'Participant Cards: expandable PK/NPC cards showing status dropdown, posture dropdown, passion invocation (once per battle), glory/KV totals, and a kill ledger. Status flags (MW, KO, DEAD, REAR, ALONE) appear as colored badges on the card header.',
      'Enemy Management: assign foes individually or in bulk (select foe type, choose count 1–5 or custom, check which participants to assign). Each enemy row shows HP bar with direct input and ±adjustment field, plus action buttons for MW, Dead, Captured, and Fled.',
      'Kill Tracking: kills are automatically recorded when enemies are marked as MW, dead, or captured. Duplicate kills are prevented. Undo reverts both status and kill credit. Kills summary panel groups all kills by knight with glory and KV totals.',
      'Foe Reassignment: drag an enemy row from one PK card and drop it onto another, or use the ⇄ button to pick a target from a dropdown. Kill credit transfers with the foe.',
      'Add participants mid-battle for late arrivals — they appear immediately and the round log records "X has joined the fray!"',
      'Round Log: shows each completed round\'s encounter and morale delta. Status changes are tracked per round — "X sustained a major wound", "X was separated from the conroi", "X rejoined the conroi", "X, while still wounded, has rejoined the fray!" Only new changes appear, never repeats.',
      'Round Management: End Round snapshots all state (participants, morale, encounter, notes) for undo. Back restores the previous round\'s snapshot completely — kills, participants, everything. Adjust max rounds on the fly with ± Rd buttons.',
      'End Battle moves to a finalization screen. Resume Battle returns to the console if needed. Abandon Battle discards everything with double-confirm.',
      'Blocked status gating: MW, unconscious, dead, and rear participants cannot have foes assigned without an explicit GM override. Warning modal shows natural-language status ("has a major wound", "is in the rear", "is separated from the conroi").',
      'Conroi Commander Swap: a ⚜ CMD selector in the battle header lets the GM hand command to another knight mid-battle. If the commander goes down, a pulsing DOWN badge appears until a new one is designated. Morale-adjustment rights follow the new commander.',
      'Chronicle Battle Tiers: committed battles appear in the Chronicle at a weight matching their size — a Fight is a single line, a Skirmish a small card with kill tallies, a Clash a card with a compact kill grid, and a Small Battle (or larger) a full sectioned record with participants and round-by-round key moments. Each knight\'s entry lists the actual foes they defeated.',
    ],
  },
];

// ── PATCH NOTES ───────────────────────────────────────────────
// Each entry: { version, date, sections: [{ heading, items:[] }] }
const PATCH_NOTES = [
  {
    version: '3.10.0',
    date:    '2026-07-23',
    sections: [
      {
        heading: 'NPC Notes — Now Visible to Everyone',
        items: [
          'The Notes section on NPC cards is now visible to all players on every NPC — it was always meant to be general background, and now it actually is. Players can read it but not edit it; writing notes stays with the GM.',
          'Household editing unchanged otherwise: you can still edit your own household members\' name, pronoun, passions & traits, skills, and stats.',
        ],
      },
      {
        heading: 'GM Notes — A Truly Private Field (GM only)',
        items: [
          'Every NPC now has a separate 🔒 GM Notes field that never leaves the GM\'s view — not visible to players, not even for NPCs in their own household, and never sent to their browser at all.',
          'Edit it from the NPC Edit form; it appears on the card in crimson beneath the public Notes.',
          'Claude can read and write GM Notes through the MCP bridge, so secrets recorded during prep stay secret.',
        ],
      },
    ],
  },
  {
    version: '3.9.3',
    date:    '2026-07-17',
    sections: [
      {
        heading: 'Dashboard — Enfeoffment Alerts',
        items: [
          'Fixed a false "a new knight must be enfeoffed" alert when succession had already been recorded in NPC Manors — the dashboard was reading the manor page\'s vassal ledger, which never learned about the new holder. (Reported by Zerkle — thanks!)',
          'Recording an enfeoffment, succession, escheat, or abdication in NPC Manors now updates the matching vassal entry on PK manor pages automatically.',
        ],
      },
    ],
  },
  {
    version: '3.9.2',
    date:    '2026-07-17',
    sections: [
      {
        heading: 'Yearly & Solo Events',
        items: [
          'Fixed the page jumping while reading freshly rolled events — arriving narrative text no longer shoves your scroll position around.',
          'New buttons under the knight picker: 🎲 Random Wed and 🎲 Random Unwed add a random knight (wed = has a living spouse) and set the Status toggle to match; ✕ Clear All Selected empties the selection in one click.',
        ],
      },
      {
        heading: 'Life Events',
        items: [
          'The narrative text on a life event is now editable — the Edit form has a Narrative field alongside title, mechanics, and notes.',
          'Fixed edits silently going nowhere when the NPC card was opened from a dashboard widget or the family tree — the edit form was opening underneath the card popup.',
          'Editing a life event\'s title or year now updates its auto-created Chronicle line too (and deleting the event removes it).',
          'Season can now be left blank ("—") when editing, instead of being forced to Spring.',
        ],
      },
      {
        heading: 'General',
        items: [
          'All background refreshes now preserve your scroll position on every tab, not just the dashboard.',
        ],
      },
    ],
  },
  {
    version: '3.9.1',
    date:    '2026-07-16',
    sections: [
      {
        heading: 'Fixes',
        items: [
          'The background refresh no longer snaps the page back to the top — it skips the redraw entirely when nothing has changed, and keeps your scroll position when it does redraw.',
        ],
      },
    ],
  },
  {
    version: '3.9.0',
    date:    '2026-07-06',
    sections: [
      {
        heading: 'Dashboard — Items to Resolve',
        items: [
          'The Matters Requiring Attention checklist now flags vassal manors that need a knight enfeoffed — either no NPC is linked to the manor, or the enfeoffed knight has died.',
          'The panel header shows a count of open items, and urgent items are now bold as well as crimson.',
        ],
      },
      {
        heading: 'Players — Household Editing',
        items: [
          'Players can now edit NPCs in their own household: name, pronoun, notes, passions & traits, skills, and stats. The Edit button appears on household members\' cards.',
          'Household members\' notes, passions, skills, and stats are now visible to their own player (other households\' remain GM-only).',
          'The GM receives a notification for every player edit — who edited whom, and which fields changed. Clicking it opens the NPC\'s card.',
          'The GM\'s binder view now quietly refreshes every 30 seconds (when idle) so player edits appear without a reload — same careful guard the player refresh uses, so it never interrupts work in progress.',
        ],
      },
    ],
  },
  {
    version: '3.8.0',
    date:    '2026-07-06',
    sections: [
      {
        heading: 'Chronicle — Battle Tiers',
        items: [
          'Battles in the Chronicle now render at a weight matching their size: a Fight is a single line, a Skirmish a small card with each knight\'s kill tally, a Clash a card with a compact kill grid, and a Small Battle (or larger) a full sectioned record.',
          'Each knight\'s Chronicle entry now lists the actual foes they defeated — "slew Saxon Warrior ×2, Bandit" — not just a number. (Battles recorded before this update only have the count.)',
          'Small Battle records gain a Key Moments section: the round-by-round log with encounters, morale swings, and the GM\'s round notes.',
          'Knights who ended a battle wounded, unconscious, or dead are flagged on every tier — even the one-line Fight entry.',
        ],
      },
      {
        heading: 'Battle Console — Commander Swap',
        items: [
          'The GM can now hand the conroi command to another knight mid-battle via the ⚜ CMD selector in the battle header — for when the commander falls and a new one must take up the banner.',
          'If the current commander is down, a pulsing DOWN badge appears until a new commander is designated. Morale-adjustment rights follow immediately.',
        ],
      },
    ],
  },
  {
    version: '3.7.2',
    date:    '2026-07-05',
    sections: [
      {
        heading: 'Fixes — Battle Cards & Notifications',
        items: [
          '@mentions in a battle\'s Chronicle narrative now render as proper clickable character links instead of raw text.',
          'Battle cards in the Chronicle now show the opposing commanders — with the commander linked to their character card when they\'re an NPC in the binder.',
          'Notifications now say who the comment was about by name ("commented on Lady Jenna of Salisbury") instead of showing the internal NPC id. Older notifications keep their old wording until they age out.',
        ],
      },
    ],
  },
  {
    version: '3.7.1',
    date:    '2026-07-05',
    sections: [
      {
        heading: 'Navigation — The Realm Menu',
        items: [
          'Roster, Families, Player Manors, and NPC Manors now live together under one 👑 Realm menu — the people and lands of the campaign in one place.',
          'This takes the top bar from 8 entries down to 6, so everything through the Version button fits comfortably on laptop screens.',
        ],
      },
    ],
  },
  {
    version: '3.7.0',
    date:    '2026-07-05',
    sections: [
      {
        heading: 'Fix — Story Pages Readability',
        items: [
          'The Story Arcs and Session Prep pages were missing their parchment backing, leaving dark text on the dark page behind. Both now sit on proper vellum like every other tab.',
        ],
      },
      {
        heading: 'Illuminated Manuscript Polish',
        items: [
          'Parchment now has texture — a subtle fibrous grain across cards, panels, and reading surfaces instead of flat digital fills.',
          'Illuminated initials: narrative prose now opens with a manuscript drop cap — crimson for solo adventure flavor text and battle-field descriptions, gold for battle narratives in the Chronicle.',
          'Gold breathes: the active nav tab glows softly, gold buttons shimmer on hover, and the morale bar has a faint verdigris light.',
          'Manuscript ruling: major section titles get a double-rule underline; battle sidebar panels get a gold top rule.',
          'Ornamental dividers (· ✦ ·) mark the great divisions — between the encounter and the conroi in battle, and before the outcome table when the chronicler takes over.',
          'Deeper hierarchy: page titles are larger, cards lift gently on hover, and focused inputs glow gold instead of just changing border.',
        ],
      },
    ],
  },
  {
    version: '3.6.1',
    date:    '2026-07-05',
    sections: [
      {
        heading: 'Fixes — Story Menu & Header Fit',
        items: [
          'The Story menu was invisible even for the GM — the GM-only visibility rules didn\'t cover nav dropdowns. Fixed.',
          'The header now fits on 13-15" laptops: nav tabs compress below 1500px wide, and below 1320px they collapse to icons only (hover for the name). The Guide button stays reachable.',
        ],
      },
    ],
  },
  {
    version: '3.6.0',
    date:    '2026-07-05',
    sections: [
      {
        heading: 'Story Arcs & Session Prep (GM)',
        items: [
          'New GM-only "Story" menu in the nav with two tabs: Story Arcs and Session Prep — the campaign\'s memory layer, built on the same data Claude reads and writes during prep conversations.',
          'Story Arcs: every ongoing plot thread as a card — status (Active / Cold / Complete), summary, linked NPCs as clickable chips, an objectives checklist, a timeline of how the thread has advanced, and GM notes with @mention support.',
          'Session Prep: a game-night dashboard per session — the "Previously…" recap up top, tonight\'s arcs tagged On the Table / May Surface / Background, staged NPCs with their current stance, open questions, and GM notes. Everything clicks through: arcs to arc detail, NPCs straight to their cards.',
          'Draft prep with Claude in a conversation, then refine and run it from this screen on game night — or build it all by hand here. Same data either way.',
        ],
      },
    ],
  },
  {
    version: '3.5.1',
    date:    '2026-07-05',
    sections: [
      {
        heading: 'Battle Tracker — Auto-Summary (GM)',
        items: [
          'The finalization screen now has a "✒ Draft Summary" button. The chronicler (Claude Haiku) reads the battle record — rounds, encounters, morale, kills, wounds, and passions — and drafts a 3-5 sentence period-voice narrative into the GM Narrative box.',
          'The draft only recounts what was actually recorded — it never invents deeds for the knights. Edit it freely before committing to the Chronicle.',
          'If the API is unreachable, a plain summary is built directly from the record instead, so the button always works.',
        ],
      },
    ],
  },
  {
    version: '3.5.0',
    date:    '2026-07-05',
    sections: [
      {
        heading: 'Battle Tracker — Player View',
        items: [
          'Players now get a full battle view during active battles: the encounter narrative, who you\'re facing, conroi morale, your knight\'s card with status, posture, and passion, your opponents (names and weapons only — no stats), and a live view of your fellow conroi members.',
          'Kill Tally with "+ Add Kill" — tap the foe type you felled and it\'s recorded with the correct glory, live for the GM. There\'s an "Other…" option for anything unusual (GM sets glory later), and you can remove your own mis-taps.',
          'The conroi commander gets morale +/− buttons — the GM calls the adjustment, you enter it.',
          'The view updates automatically every 3 seconds while you\'re on the battle tab, and is built for phones.',
          'Squires and any NPC the GM grants you control of appear as your own cards with the same kill tracking.',
        ],
      },
      {
        heading: 'Battle Tracker — Fixes',
        items: [
          'Lowering starting morale below current morale no longer leaves the bar showing over 100%.',
          'Double-clicking "End Round" can no longer skip a round and wipe the round log snapshot.',
          'A battle can no longer be started with zero max rounds.',
        ],
      },
      {
        heading: 'Misc Fixes',
        items: [
          'Solo event IDs can no longer collide when created in the same instant.',
          'Caliburn\'s /chronicle Discord command works again (it had silently broken after a server update).',
        ],
      },
    ],
  },
  {
    version: '3.4.1',
    date:    '2026-07-01',
    sections: [
      {
        heading: 'Battle Tracker — Finalization & Chronicle',
        items: [
          'Ending a battle now opens a full finalization screen: set the outcome, review the conroi table (kills, status, passions), write a GM narrative, then commit to the Chronicle.',
          'Committed battles appear in the Chronicle as crimson battle cards with outcome badge, participant table, and GM narrative.',
          'IN BATTLE banner appears across all tabs during active battles — crimson "TO ARMS!" bar with battle name, size, and round info. Polls every 3 seconds. Click to jump to the battle tab.',
        ],
      },
      {
        heading: 'Bug Fix — Succession Data Integrity',
        items: [
          'PK succession now correctly updates manor lord, knight display name, heir, and household head. Previously only NPC roles were changed, leaving stale names on the dashboard and family tab.',
        ],
      },
      {
        heading: 'Bug Fix — Destrier Horse Type',
        items: [
          'Destrier was missing from the server-side horse type whitelist. Adding a Destrier appeared to work but silently failed to save — the horse vanished on page refresh. Fixed.',
          'Horse save errors now show a toast instead of failing silently.',
        ],
      },
      {
        heading: 'Bug Fix — Enemy Drag Ghosting',
        items: [
          'Dragging a foe card in the battle tracker no longer leaves it permanently greyed out.',
        ],
      },
    ],
  },
  {
    version: '3.4.0',
    date:    '2026-06-25',
    sections: [
      {
        heading: 'MCP Bridge — Claude Integration',
        items: [
          'A new MCP (Model Context Protocol) server exposes 37 tools that let Claude read and write campaign data directly: story arcs, session prep, NPCs, chronicles, relationships, and life events.',
          'Claude Code connects locally via stdio. Claude App (claude.ai) connects over the internet via the public endpoint at mcp.pendragon-binder.com — secured behind Cloudflare Tunnel.',
          'NPC updates use a partial update pattern — Claude only sends the fields being changed, keeping edits clean and targeted.',
          'New relationship management endpoints: create, read, and delete NPC relationship edges (Spouse, Parent, Child, Squire, etc.) directly through Claude.',
          'Runs as a dedicated systemd service (pendragon-mcp) alongside the main Binder.',
        ],
      },
      {
        heading: 'Bug Fix — Squire Relationship Duplication (for real this time)',
        items: [
          'The previous server-side merge fix (v3.3.1) wasn\'t the whole story — the root cause was in the client.',
          'Three places in the training flow checked for an existing Squire relationship before creating one, but none checked for Former Squire. After coming of age converted Squire to Former Squire, re-editing training info would create a duplicate.',
          'All three checks now also look for Former Squire, preventing the duplicate from being created in the first place.',
        ],
      },
    ],
  },
  {
    version: '3.3.1',
    date:    '2026-06-19',
    sections: [
      {
        heading: 'Improvements — Quick Edit',
        items: [
          'Edit button added to each improvement on the manor Overview tab — no need to switch to the Improvements tab to fix a value.',
        ],
      },
      {
        heading: 'Childbirth — Age Cap Removed',
        items: [
          'Removed the hard age-40 cutoff for childbirth eligibility. Women age 18+ are now eligible per Pendragon 6e rules.',
          'The cumulative −1 penalty per year over 35 still applies naturally.',
        ],
      },
      {
        heading: 'Bug Fix — Duplicate Relationships on Come of Age',
        items: [
          'Fixed a server-side merge bug that created duplicate Squire + Former Squire relationships when a squire came of age.',
          'The relationship merge now keys on relationship ID instead of type, so type changes (Squire → Former Squire) are correctly treated as updates rather than new entries.',
          'Cleaned up existing duplicate relationships in the save file.',
        ],
      },
    ],
  },
  {
    version: '3.3.0',
    date:    '2026-06-05',
    sections: [
      {
        heading: 'Training Lifecycle Modals',
        items: [
          'Age flag badges on NPC cards are now interactive — click to open inline training modals instead of manually editing NPC fields.',
          'Phase 1 — Placement (age 7+): Choose Page, Oblate, or Druidic Initiate and assign a court or location.',
          'Phase 2 — Training Path (age 14+): Advance to Squire, Steward, Clergy, or Druid. Squire path includes NPC search to assign a training knight, with automatic Squire relationship creation.',
          'Phase 3 — Coming of Age (age 18–21+): Squires choose a knight rank (Esquire, Bachelor Knight, Vassal Knight, Knight Banneret). Others confirm directly. Squire relationships auto-convert to Former Squire.',
          'Path locking enforced: Oblate → Clergy only, Druidic Initiate → Druid only, Page → Squire / Steward / Clergy.',
        ],
      },
      {
        heading: 'New Roles: Oblate & Druidic Initiate',
        items: [
          'Two new youth training roles added to the NPC role dropdown: Oblate (clergy youth path) and Druidic Initiate (druid youth path).',
          'Each role has a distinct icon and colour — Oblate (✝ navy) and Druidic Initiate (🌿 forest green).',
          'Roster training lines, dashboard age alerts, and training history labels all updated to handle the new roles.',
        ],
      },
      {
        heading: 'Record Year Persistence (Bug Fix)',
        items: [
          'Record Year form state now persists across all navigation — tab switches, manor switches, page refreshes, and browser closes.',
          'In-progress recording saved to localStorage on every input. Restored automatically on page load.',
          'When recording one manor and viewing another, a banner shows "Recording in progress for [manor]" with a Go Back button.',
          'Fixes GitHub Issue #14.',
        ],
      },
    ],
  },
  {
    version: '3.2.0',
    date:    '2026-05-13',
    sections: [
      {
        heading: 'Security & Data Integrity',
        items: [
          'Battle state file I/O now holds a single lock across the full read-modify-write cycle, preventing concurrent request races.',
          'Battle state backed up automatically at battle start, each round end, and finalize (last 5 snapshots kept).',
          'All server-side IDs switched from millisecond timestamps to cryptographic random tokens — eliminates collision risk.',
          'Manor name escaping fixed in ~48 onclick attributes (self-XSS hardening).',
          'Improvement income/DV notes now HTML-escaped.',
          '/logout restricted to POST only. /api/load no longer exposes full server file path.',
          'Round revert now deep-copies snapshot data to prevent shared-reference mutations.',
        ],
      },
      {
        heading: 'Battle Console Fixes',
        items: [
          'Round log morale deltas now display correctly — morale tracked at the start and end of each round.',
          'Finalizing screen no longer shows Resume/Abandon buttons to players.',
          'Setup field saves, round notes, and morale edits now show error toasts on failure instead of silently dropping changes.',
          'Bulk foe assignment button disabled during API calls to prevent double-click duplicates.',
          'Morale capped at starting value server-side — can no longer accidentally exceed the maximum.',
          'Passion invocations now support Failed and Fumbled results in addition to Inspired and Impassioned.',
          'Long enemy labels (e.g. "Mounted Heorthgeneat #12") now truncate with ellipsis instead of overflowing.',
        ],
      },
      {
        heading: 'Accessibility & Contrast',
        items: [
          'New --gold-text token (#8a6500) replaces --gold for all text, passing WCAG AA contrast on parchment backgrounds.',
          'Bumped opacity floor on muted labels from 0.5 to 0.65 across ~10 styles.',
          'Darkened --verdigris-mid for normal-text contrast compliance.',
          'Added role="button" and tabindex="0" to 5 clickable battle console elements (PK card headers, sidebar accordions).',
          'Toast container now has aria-live="polite" for screen reader announcements.',
          'Modal and card popup now trap focus — Tab no longer escapes into the page behind.',
        ],
      },
      {
        heading: 'Other Fixes',
        items: [
          'Toast.warn() call in solos.js fixed (method did not exist). Added .toast-warning CSS style.',
          'NPC delete now cleans up orphaned NPC manor assignments.',
        ],
      },
    ],
  },
  {
    version: '3.1.0',
    date:    '2026-05-13',
    sections: [
      {
        heading: 'Battle Records — GM Battle Console',
        items: [
          'Full GM battle console for running KAP 6e battles live. Two-column layout: participant cards, morale tracker, encounter card, and round notes on the left; 10-step procedure, foes reference, round log, kills summary, and round controls on the right.',
          'Setup Phase: name your battle, set year, location, and size (Fight through Huge with auto-set max rounds). Assign commanders, add participants from the NPC roster with auto-detect for PKs and player control.',
          '29 built-in foe templates across four categories (Battle Encounters, Knights, Saxons, Picts). Custom foes supported with HP, armor, skill, damage, KV, glory, morale thresholds, and a free-text skills/behavior field. Foes can be added or edited during setup or mid-battle.',
          'Expandable PK/NPC cards with status & posture dropdowns, passion invocation (once per battle), glory/KV running totals, and per-knight kill ledger.',
          'Enemy HP tracking with direct input and ±adjustment field. Action buttons for Major Wound, Dead, Captured, and Fled. MW can be undone back to active.',
          'Bulk foe assignment: select a foe type, choose count (1–5 or custom), and check which participants to assign. Status-gated — MW, unconscious, dead, and rear participants blocked with an override option.',
          'Kill tracking: kills auto-recorded on MW, dead, or captured with duplicate prevention. Undo reverts both status and kill credit. Kills summary panel groups all kills by knight.',
        ],
      },
      {
        heading: 'Foe Reassignment',
        items: [
          'Drag an enemy row from one PK card and drop it onto another to reassign mid-battle — or use the ⇄ button for a dropdown picker.',
          'Kill credit transfers with the foe, so whoever finishes the fight gets the glory.',
        ],
      },
      {
        heading: 'Round Management & Log',
        items: [
          'End Round snapshots all state for full undo. Going back restores everything — kills, participants, enemies, morale.',
          'Round log tracks encounters, morale deltas, and narrative status events per round: "X sustained a major wound", "X was separated from the conroi", "X rejoined the conroi", "X, while still wounded, has rejoined the fray!", "X has joined the fray!" for late arrivals.',
          'Adjust max rounds on the fly with ± Rd buttons.',
          'Add participants mid-battle — they appear immediately in the console.',
        ],
      },
      {
        heading: 'Status & Morale',
        items: [
          'Status flags (MW, KO, DEAD, REAR, ALONE) appear as colored badges on PK card headers — visible at a glance without expanding.',
          'Status changes update live — no need to collapse and expand cards.',
          'Editable morale fields (current and starting) with ±1 and ±5 quick-adjust buttons.',
          'Natural-language status warnings: "has a major wound", "is in the rear", "is separated from the conroi".',
        ],
      },
      {
        heading: 'Battle Lifecycle',
        items: [
          'End Battle moves to a finalization screen with Resume Battle to return to the console.',
          'Abandon Battle discards everything with double-confirm and returns to the start screen.',
        ],
      },
    ],
  },
  {
    version: '2.11.0',
    date:    '2026-05-07',
    sections: [
      {
        heading: 'NPC Manors — Full Release',
        items: [
          'Related NPCs — each manor card now shows associated NPCs (household knights, chaplains, etc.) with role labels and per-NPC notes. GM can add, edit, and remove links.',
          'Trust system — assigning an underage holder or selecting an underage heir during succession now prompts a trustee flow. Cards show "In Trust" / "Ready to Assume" badges. "End Trust" confirms the transition with a chronicle entry. Trust also triggers from the Edit modal when changing to an underage holder.',
          'Abdicate — living holders can step down via a new Abdicate button. Choose a reason (infirmity, retirement, etc.), name a successor or revert to liege. Underage successors chain into the trust flow. All outcomes write to the Chronicle.',
          'Quick Create NPC — every NPC search field (succession, assign, trust, abdicate) has a "+ Create New NPC" button that creates a new NPC on the spot and auto-selects them.',
          '@mention support in manor notes and related NPC notes — type @ to link to any NPC with hover previews.',
          'NPC Manors tab is now visible to players (read-only). All edit controls remain GM-only.',
          'Bulk imported 44 Salisbury manors from the campaign spreadsheet, with 40 holders auto-linked to existing NPCs.',
          'Scroll position preserved when editing — the page no longer jumps to the top after saving changes.',
          'NPC search dropdowns in modals now float over content instead of expanding the box.',
        ],
      },
      {
        heading: 'NPC Improvements',
        items: [
          'Page placement is now smarter — the flag auto-clears once a child\'s role is set to Page and a court is assigned.',
          'NPC cards now warn when a page transition is half-done: "Role is Page but no placement assigned" or "Placement assigned but role is still Child."',
        ],
      },
    ],
  },
  {
    version: '2.10.0',
    date:    '2026-05-06',
    sections: [
      {
        heading: 'NPC Manors',
        items: [
          'New NPC Manors subtab under Manors — a full ledger of non-player manors with title holder, status, location, faction, and notes.',
          'Assign holders via NPC search, with chronicle entries logged automatically when a holder is granted a manor.',
          'Status tooltips on Granted, Gifted, and Escheated explain the feudal distinction on hover.',
          'Succession system — when a holder dies, "Trigger Succession" lets the GM pass the manor to an heir or escheat it to the liege. Both outcomes write to the chronicle.',
          'Trust system — if the heir has not come of age, the GM appoints a trustee to hold the manor. Cards show "In Trust" badge with the trustee\'s name.',
          'Vacant manor count shown on the GM dashboard with a quick-link to the NPC Manors tab.',
          'Players can view NPC Manors (read-only) — all edit controls are GM-only.',
        ],
      },
      {
        heading: 'Battle Records — Foundation',
        items: [
          'New Battle tab with placeholder UI — the conroi assembles here when the GM calls to arms.',
          'Server-side battle storage (battles.json) with thread-safe read/write helpers.',
        ],
      },
      {
        heading: 'Manor Improvements',
        items: [
          'Recording a year no longer resets when you add property damage mid-form. The damage modal now saves without wiping your progress.',
          'Property Damage section added directly inside the Record Year form — view active damage and add new entries without leaving the form.',
          'Steward now shows Industry skill alongside Stewardship when the NPC has it (e.g. ladies of the house or spouses).',
          'NPC search dropdowns in modals now float over content instead of expanding the box.',
        ],
      },
      {
        heading: 'Family & Relationships',
        items: [
          'Adopted children now carry through to all inferred relationships: grandparents, grandchildren, in-laws, aunts, uncles, nieces, and nephews all recognize adoptive family links.',
          'Fixed: Adding an adoption relationship no longer flips the direction when the adopted child is older than the adoptive parent. The birth-year auto-swap heuristic now only applies to biological parent/child types.',
        ],
      },
      {
        heading: 'Security',
        items: [
          'CSRF protection added to password change and AI proxy endpoints.',
          'Rate limiter on password reset now uses the real client IP behind Cloudflare instead of always seeing localhost.',
          'Player-load and relationship-save error responses no longer leak filesystem paths or raw exceptions.',
          'Backend source files (.py) are now blocked from being served to authenticated users.',
          'User credentials file permissions tightened to owner-only (600) on every save.',
          'XSS sweep: ~20 unescaped NPC name/role/username spots across the tree, dashboard, winter, solos, and app now use esc().',
        ],
      },
    ],
  },
  {
    version: '2.9.2',
    date:    '2026-04-21',
    sections: [
      {
        heading: 'Accessibility',
        items: [
          'The entire binder is now keyboard-navigable. Every clickable card, list item, and inline name can be focused with Tab and triggered with Enter or Space — no mouse required.',
        ],
      },
      {
        heading: 'Mobile Polish',
        items: [
          'Hover-only action buttons (edit pencils on family tree relationships, row actions on Tasks) now appear at partial opacity on touch devices so they\'re actually tappable.',
          'Touch targets bumped to WCAG-friendly sizes at mobile width: year arrows, header buttons, modal close buttons, filter chips — all now at least 32–40px tall.',
          'NPC card popup inside a modal now scrolls vertically on phones instead of trapping content below the fold.',
          'Notched iPhones now respect safe-area insets on the header, modals, toast notifications, and the NPC sidebar drawer — no content hidden under the camera cutout or home bar.',
          'Navigation labels enlarged on narrow screens (was ~6px, now ~9px — actually readable).',
          'Backgrounded tab no longer polls — heartbeat, presence, and broadcast checks pause when you switch away from the app, saving battery and data. They resume instantly when you come back.',
          'Family-tree right-click menu now stays inside the viewport instead of clipping off-screen on phones.',
        ],
      },
      {
        heading: 'Visual Consistency',
        items: [
          'Online-presence dots and Fate-touched pips were using a bright out-of-palette green. They now use the existing medieval verdigris tones — small change, but the UI looks a lot more cohesive at a glance.',
        ],
      },
      {
        heading: 'Security',
        items: [
          '"Forgot password" endpoint now returns in constant time regardless of whether the email address is registered, closing an email-enumeration timing side-channel. The reset email fires in the background instead of blocking the response.',
        ],
      },
      {
        heading: 'Data Safety',
        items: [
          'Nightly off-host backups. Every night at 3 AM, the full binder (save file, submissions, comments, broadcasts, player data, user accounts, and Caliburn bot config) is packaged and uploaded to cloud storage with 30-day rolling retention. If the server ever dies — disk, VM, or entire box — the campaign survives.',
        ],
      },
    ],
  },
  {
    version: '2.9.1',
    date:    '2026-04-09',
    sections: [
      {
        heading: 'New Feature — Observer Role',
        items: [
          'New "Observer" account role — full read access to the GM overview dashboard with zero write capability.',
          'Observers see all NPCs, manors, families, chronicle, and roster but cannot add tasks, post comments, or modify anything.',
          'All write attempts are blocked server-side regardless of UI. Safe to hand out as a showcase or demo account.',
          'Create via GM Tools → Manage Users — Observer is now a selectable role alongside Player and GM.',
        ],
      },
      {
        heading: 'Caliburn Bot',
        items: [
          '/bugreport command — opens a two-field modal (Summary + Details). Automatically creates a labelled GitHub issue on the Binder repo and DMs the GM with a direct link.',
          'All commands now restricted to the Knight of the Realm Discord role — unauthorised users see a quiet ephemeral response.',
        ],
      },
    ],
  },
  {
    version: '2.9.0',
    date:    '2026-04-09',
    sections: [
      {
        heading: 'New Feature — Tasks & Reminders',
        items: [
          'Dashboard widget for both GM and players — sticky task/reminder list that persists across sessions.',
          'Personal tasks: add, edit, delete, and check off your own reminders. Completed items collapse into a subtab and auto-purge after 90 days.',
          'High Priority flag — marks a task with a red left border and bold text so it stands out at a glance.',
          'GM Broadcast: push a task to all players\' dashboards simultaneously. Edit text/priority or revoke at any time.',
          'Player → GM assignment: players can send a reminder directly to the GM\'s task board (with their name attached).',
          'Widget position: players see Tasks between Matters Requiring Attention and Manor Summary; GM sees it between Roster at a Glance and Households.',
        ],
      },
    ],
  },
  {
    version: '2.8.0',
    date:    '2026-04-08',
    sections: [
      {
        heading: 'Security',
        items: [
          'CSRF protection on logout (POST)',
          'Login attempts rate limiting now thread-safe',
          'Content-Security-Policy headers added',
          'Session role re-verified against users.json on GM actions',
          'Impressions size limits enforced server-side',
          'users.json permissions hardened (600)',
          '/api/config no longer leaks filesystem paths',
        ],
      },
      {
        heading: 'Caliburn Bot',
        items: [
          '/damage handles negative modifiers, validates dice sides',
          '/chronicle respects Discord embed limits',
          '/speak rate-limited (30s cooldown) and input capped at 500 chars',
          'Fuzzy NPC search optimised with substring pre-pass',
          'Slash commands auto-sync on startup',
        ],
      },
      {
        heading: 'Data',
        items: [
          'Chronicle and solo event IDs now use UUID (no ms collisions)',
          'GM save preserves player-written relationships',
          'NPC deletion cleans up impressions and pins',
          'Soft-deleted comments purged after 30 days',
          'Submissions list capped at 200 entries',
          'Notifications storage capped at 50',
        ],
      },
      {
        heading: 'UI',
        items: [
          'Comment cache refreshes every 30s',
          'Notes save failure now shows an error toast',
          'Polling pauses when browser tab is hidden',
          'Manor names with apostrophes no longer break onclick handlers',
        ],
      },
      {
        heading: 'Fixes',
        items: [
          'NPC names escaped in solos knight search',
          'Parse errors on save file no longer reset data to defaults',
        ],
      },
      {
        heading: 'Infrastructure',
        items: [
          'backups/ directory permissions fixed',
          'bcrypt upgraded to 5.0.0',
          'requirements.txt added for binder and bot (pinned versions)',
        ],
      },
    ],
  },
  {
    version: '2.7.1',
    date:    '2026-04-08',
    sections: [
      {
        heading: 'Chronicle Integration',
        items: [
          'Each life event on an NPC card now has a 📜 button (GM only) — click to commit that event to the Chronicle of Logres for its year.',
          'The entry is pre-filled with the event\'s flavor text (or title + mechanical summary if no flavor exists), and is fully editable before committing.',
          'Duplicate guard: attempting to add the same life event twice shows a flowery refusal instead of a duplicate entry. Each committed entry tracks its source event ID.',
          'Resolved solo generator cards with flavor text now show a "📜 Add to Chronicle" button — same flow, pre-filled and editable.',
          'NPC cards also retain the general 📜 Chronicle button for hand-written entries not tied to a specific life event.',
        ],
      },
      {
        heading: 'Solo Event Flavor Text',
        items: [
          'Flavor text expanded to 2-3 sentences (was 1-2) with a higher word cap.',
          'The actual event outcome is now required to be clear within the prose — atmosphere no longer swallows the substance.',
        ],
      },
      {
        heading: 'Caliburn — Persona Improvements',
        items: [
          'Caliburn no longer defaults to reciting the campaign year and manor list every response — context is used only when genuinely relevant.',
          'Reacts directly and specifically to what is said, including unusual or unexpected messages.',
          'Rare easter egg: Caliburn occasionally slips and says "Artoria Pendragon" before sharply correcting himself.',
        ],
      },
    ],
  },
  {
    version: '2.7.0',
    date:    '2026-04-08',
    sections: [
      {
        heading: 'Caliburn Discord Bot — Reborn',
        items: [
          'Caliburn has been fully rewritten and now runs as a persistent systemd service on the server — always online, no manual startup required.',
          'Switched from OpenAI GPT-4o-mini to Claude Haiku for all AI commands (/feast, /justice, /speak).',
          'All knight/squire/spouse/horse management removed — the Binder handles all of that now.',
          'Bot token and API keys moved to a secure .env file; no secrets in source code.',
        ],
      },
      {
        heading: 'Caliburn — Binder Integration',
        items: [
          '/npc <name>: Look up any NPC from the Binder. Shows role, household, manor, status, glory, age, relationships, and notes.',
          'Smart fuzzy search: if the name isn\'t exact, Caliburn offers up to 5 "Did you mean?" buttons. Click one to retrieve that NPC.',
          'Relationships display in closeness order (Spouse → Parent → Child → Sibling → …) labelled as "Parent of:", "Child of:", etc.',
          '/chronicle: Shows recent campaign events from the Chronicle tab.',
          '/year: Reports the current campaign year from the Binder.',
          '/speak <message>: Address Caliburn directly. The sword responds with campaign-aware flavour via Claude Haiku.',
        ],
      },
      {
        heading: 'Security & User Management',
        items: [
          'Password policy enforced on all password change paths: minimum 8 characters, blocks common passwords (including campaign-specific words), blocks reuse of your current password.',
          'Show/hide password toggle (👁) added to login and password reset forms.',
          'Users without an email address are prompted to add one on first login after the update.',
          'Last login timestamp now updates on every page load — no longer stuck at the original login time for long sessions.',
          'GM user management panel now supports inline editing of username, role, household, and email.',
          'Household field is a dropdown of actual manor keys — only valid assignments allowed.',
          'Username changes automatically rename the player\'s data directory.',
          'Password reset emails now generate correct public URLs (pendragon-binder.com) instead of the internal Flask address.',
        ],
      },
    ],
  },
  {
    version: '2.6.0',
    date:    '2026-04-07',
    sections: [
      {
        heading: 'Journal — Private Notes',
        items: [
          'A new Journal tab (under the Records dropdown) gives every user a private scratchpad — General Notes and Manor Notes, visible only to you.',
          'Notes auto-save as you type (2-second debounce). A live preview renders @NPC mentions as clickable links.',
          'GMs can write a private note directly to any player\'s journal from the "Write to Player" section — the player receives a notification and sees the note on their next visit.',
          'NPC cards now include a My Impressions section in the sidebar — private, per-NPC notes tied to that character. Auto-saves and fully private.',
        ],
      },
      {
        heading: 'Public NPC Comments',
        items: [
          'Any logged-in user can leave a public comment on any NPC card. Comments are visible to everyone.',
          'Full @NPC mention support — type @ to search and link characters.',
          'Threaded replies: click Reply on any comment to respond one level deep.',
          'Edit your own comments. The GM can view the full edit history of any comment.',
          'Delete your own comments (soft-delete — GM still sees content marked [deleted]). GM can delete any comment.',
          'Restore: players can restore a comment they deleted themselves. GMs can restore any deleted comment.',
          'Shred (GM only): permanently remove a comment from the record. Cannot be undone.',
        ],
      },
      {
        heading: 'Notifications Bell',
        items: [
          'A 🔔 bell in the header shows a badge when you have unread notifications.',
          'Notifications are pushed when someone comments on an NPC or the GM writes you a private note.',
          'Click the bell to open the panel. Click any notification to jump to the relevant NPC card. Mark individual or all as read.',
        ],
      },
      {
        heading: 'Navigation — Records Dropdown',
        items: [
          'Chronicle and Journal are now grouped under a Records dropdown in the nav bar, keeping the header tidy.',
          'The existing Fate dropdown (Winter + Mausoleum) remains. Both dropdowns are mutually exclusive — opening one closes the other.',
        ],
      },
      {
        heading: 'NPC Card — Notes & Comments Sidebar',
        items: [
          'On desktop, NPC cards now display a sidebar panel on the right showing My Impressions and the public Comments section.',
          'On mobile, the sidebar slides in as a drawer — tap the "📝 Notes & Comments" button at the bottom of the card to open it.',
        ],
      },
      {
        heading: 'UI Fixes',
        items: [
          'Modal close button (✕) no longer overlaps content — modal top padding increased to clear the button.',
          'Double scrollbars on NPC card modal eliminated — sidebar scrolls independently, modal is the single outer scroller.',
          'Nav dropdowns now close when a modal or card popup opens.',
          'Records and Fate dropdowns are now mutually exclusive.',
        ],
      },
    ],
  },
  {
    version: '2.5.0',
    date:    '2026-04-07',
    sections: [
      {
        heading: 'Families Tab — Now Open to Players',
        items: [
          'The Families tab is now visible to all players. Browse any household\'s roster, manor holdings, and family tree.',
          'Players can add, edit, and delete relationships on their own household\'s family tree. The ⊕ connect button and right-click context menu are available when viewing your own household\'s tree.',
          'GM-only tree features (Bulk Add, Edit NPC from right-click) remain restricted to the GM.',
          'All other households\' trees are view-only for players.',
        ],
      },
      {
        heading: 'Family Tree — Fixes & Reliability',
        items: [
          'Player relationship changes now save correctly. A new /api/relationships endpoint handles player saves — previously all player saves hit a 403 and were silently lost.',
          'Tree node positions (dragging from the Unplaced pocket) now persist for players.',
          'Tree lock state (🔒/🔓) now saves per-household and is restored when the tree is reopened.',
          'Duplicate relationships are now blocked: adding the same relationship type between two NPCs twice is prevented. Inverse pairs (Child/Parent, Spouse/Spouse) are also treated as duplicates.',
          'Existing duplicate relationships in the data are automatically cleaned up on load.',
        ],
      },
      {
        heading: 'Training History — Linked NPC Support',
        items: [
          'The "Trained / Squired under" field on NPC cards now supports searching for an NPC in the binder. Selecting one auto-creates a Squire or Page relationship — no need to add it separately.',
          'Free text fallback remains available for trainers/knights not entered in the binder.',
          'Training relationships (Squire/Page) now appear in the main Relationships section while the NPC is active. Once "Came of Age" is ticked, they move to Training History as a permanent record.',
        ],
      },
    ],
  },
  {
    version: '2.4.0',
    date:    '2026-04-07',
    sections: [
      {
        heading: 'Security Hardening — Pre-Cloudflare Pass',
        items: [
          'CSRF protection reworked: removed the localhost bypass that would have disabled all CSRF checks behind Cloudflare Tunnel. Now uses Origin + Referer headers reliably in all network configurations.',
          'CSRF checks added to three previously unprotected endpoints: create new save file, approve chronicle submission, dismiss chronicle submission.',
          'Path traversal fix: the "create new binder" endpoint now validates that the chosen file path is within your home directory and has a .json extension.',
          'Filesystem browser restricted to home directory — can no longer navigate to /etc, /root, etc.',
          'All file writes are now atomic (write to .tmp then rename) — prevents data corruption if the server crashes mid-write.',
          'Succession flow race condition fixed: the full read-modify-write is now held under the save lock, preventing data loss if another save happens simultaneously.',
          'Security headers added: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy same-origin.',
          'Cloudflare Tunnel cookie flag: set CF_TUNNEL=1 in secrets.env to enable Secure cookies for the tunnel deployment.',
        ],
      },
      {
        heading: 'Session Expiry & Idle Warning',
        items: [
          'Sessions now expire after 24 hours of inactivity (reset on every request).',
          'After 4 hours of no keyboard, mouse, or touch activity, a banner appears: "Still at the table? Your session will expire soon." Click Stay Logged In to reset the clock.',
          'If the session does expire mid-session, just log back in — no data is lost.',
        ],
      },
      {
        heading: 'Cache Busting',
        items: [
          'All JavaScript and CSS files are now served with a version query string (?v=2.4.0). After a server update, browsers and Cloudflare will always fetch fresh code rather than stale cached files.',
        ],
      },
    ],
  },
  {
    version: '2.3.1',
    date:    '2026-04-07',
    sections: [
      {
        heading: 'Persons of Interest',
        items: [
          'Any user (GM or player) can now pin NPCs as Persons of Interest — a CK3-style watchlist of characters you want to keep an eye on.',
          'Open any NPC card and click the ☆ Pin button to pin them. The button turns gold (★) when pinned. Click again to unpin.',
          'Pinned characters appear in a ★ Persons of Interest widget on your dashboard. Clicking any name opens their NPC card without leaving the dashboard.',
          'Pins are per-user — each player and the GM has their own independent list. No cap on number of pins.',
          'Pin data is stored server-side in player_data/{username}/pins.json.',
        ],
      },
    ],
  },
  {
    version: '2.3.0',
    date:    '2026-04-07',
    sections: [
      {
        heading: 'Stables — Horse Tracking & Survival Rolls',
        items: [
          'Players can now manage their own stable from the Manors tab. Switch between Overview and Stables using the section buttons above your manor detail.',
          'Add horses with a name, type (War / Riding / Work), age, optional rider assignment (household members only, Player Knight at the top of the list), and notes.',
          'Age is tracked automatically — enter it once at creation and it ages with the campaign year. Year Born is stored; age is always derived live.',
          'War Horses and Riding Horses require a winter survival roll (1d20). Click the 🎲 Roll button on any eligible horse during the Winter Phase.',
          'Survival modifiers calculated automatically from manor history: −1 per year over age 7, −3 Poor, −15 Impoverished, −3 per consecutive year of poverty or impoverishment since the horse was acquired. Full breakdown shown in the roll modal.',
          'Roll results: 1 or less = Dead, 2 = Ruined, 3–20 = Healthy. Dead and ruined horses move to the Pet Cemetery automatically.',
          'If Economic Circumstances haven\'t been recorded yet for the current year, the roll button warns you — with an option to roll anyway (for testing) or wait.',
          'Every survival roll is logged in the horse\'s record: raw roll, each modifier, modified total, and result.',
          'Pet Cemetery shows the 30 most recent dead/ruined horses. Mark up to 10 as ★ favourites to pin them permanently.',
          'Horses can be manually marked Dead or Ruined outside of a roll, or deleted entirely.',
          'GM can manage any household\'s stable from the Stables section tab in the GM manor view.',
          'Horse data is stored per-player in player_data/{username}/horses.json — completely separate from the shared binder save.',
        ],
      },
      {
        heading: 'NPC Stat Block Templates',
        items: [
          '19 pre-built stat block templates drawn from the Pendragon 6e GM\'s Handbook, covering Saxon Ceorls, Saxon Thegns, Irish Warriors, Ordinary Knights, Veteran Knights, and more across four categories.',
          'When adding or editing an NPC, click "Attach Template Stat Block" to open the template picker. Browse templates by category and click any card to apply it.',
          'Applying a template pre-fills the Stats, Passions & Traits, and Skills fields in the edit form. The applied template name is saved with the NPC record.',
          'Templates are a starting point — all fields remain freely editable after applying.',
          'The applied template name is shown as a badge on the GM\'s NPC card view.',
        ],
      },
      {
        heading: 'NPC Cards — Player Privacy',
        items: [
          'Players can no longer see the Passions & Traits, Skills, and Stats sections on NPC cards — these are now GM-only.',
          'Players still see everything else: name, role, household, notes, relationships, life events, and solo chronicle.',
          'This keeps mechanical details and GM intel out of player hands while leaving flavour and story information visible.',
        ],
      },
    ],
  },
  {
    version: '2.2.0',
    date:    '2026-04-06',
    sections: [
      {
        heading: 'Dedicated Ubuntu Server',
        items: [
          'The Binder now runs on a dedicated Ubuntu Server 24.04 LTS VM hosted in Proxmox VE — no more keeping a Windows console window open.',
          'The server is managed as a systemd service: auto-starts on boot, restarts on failure, and logs to /var/log/pendragon.log.',
          'Groundwork laid for Cloudflare Tunnel deployment — real HTTPS and internet access without port forwarding, coming soon.',
        ],
      },
      {
        heading: 'Nav Reorganisation — Fate Menu',
        items: [
          'Winter and Mausoleum have been consolidated under a new "Fate ☽" dropdown in the navigation bar, freeing up header space.',
          'Click Fate to expand the menu and select Winter or Mausoleum. The Fate button highlights when either is active.',
          'Players see only Mausoleum in the Fate menu; Winter remains GM-only.',
        ],
      },
      {
        heading: 'Archive Dropdown',
        items: [
          'Export and Import have been grouped under a new "Archive ❧" dropdown in the header, keeping the nav bar uncluttered.',
          'Click Archive to expand the menu and access Export (save a full backup) or Import (restore from a backup file).',
          'Archive is GM-only; players do not see the button.',
        ],
      },
      {
        heading: 'Player Chronicle Submissions',
        items: [
          'Players can now submit chronicle entries from their perspective directly from the Chronicle tab.',
          'A "📜 Submit Entry" button opens a form where the player writes a short account. The submission is queued for GM review — nothing goes live without sign-off.',
          'The GM sees all pending submissions in a review panel at the top of the Chronicle tab. Each entry can be approved (written to the chronicle as a new event), edited before approving, or dismissed.',
          'Submissions are stored in submissions.json on the server and never affect the main save file until approved.',
        ],
      },
      {
        heading: 'Mobile Layout — 360px Pass',
        items: [
          'The app has been tuned for narrow screens (Z Fold 6 exterior display and similar ~360px viewports).',
          'Navigation icons now stack above their labels so all tabs remain legible at 360px without truncation.',
          'Roster cards, filter chips, and the chronicle submission form collapse to single-column layouts on small screens.',
          'Household roster entries on the player dashboard now open an NPC modal on tap, rather than inline expansion.',
          'Nav dropdown menus pin to the left edge to prevent overflow off-screen.',
          'Modal close buttons are at least 44px tall for easier tap targets.',
          'Year arrows (‹ ›) in the header are now GM-only — players can no longer accidentally change the campaign year.',
        ],
      },
    ],
  },
  {
    version: '2.1.1',
    date:    '2026-04-05',
    sections: [
      {
        heading: 'QA Pass — Bug Fixes & Security Hardening',
        items: [
          'Fixed: Player dashboard now correctly addresses the knight as "My Lord" or "My Lady" based on the active Player Knight\'s pronoun.',
          'Fixed: "Recent Chronicle" card on the player dashboard now displays events correctly (was always empty due to a data-structure mismatch).',
          'Fixed: "N out of story" footer link on the Roster sidebar no longer throws an error when clicked.',
          'Fixed: NPC "Training Path" field is now persisted when creating new NPCs.',
          'Fixed: Glory column tolerates string-typed values from legacy imports without breaking.',
          'Security: Login next-URL parameter is now validated to prevent open-redirect attacks.',
          'Security: Certificate backup files (*.pem.bak) are blocked from static file serving.',
          'Security: /api/config POST now requires GM role (was login_required).',
          'Security: Session cookies are marked Secure when running over HTTPS.',
          'Security: File picker paths are now HTML-escaped to prevent attribute injection.',
          'Reliability: User file reads/writes are now protected by a lock.',
          'Reliability: Login-attempt rate limit dict now prunes stale entries to prevent unbounded memory growth.',
          'Polish: Header version button no longer shows a stale hardcoded version before boot.',
          'Polish: NPC hover card z-index lowered so toasts always render on top.',
        ],
      },
    ],
  },
  {
    version: '2.1.0',
    date:    '2026-04-05',
    sections: [
      {
        heading: 'GM Broadcast Messages',
        items: [
          'New "Send Broadcast" card on the GM dashboard. Type a message and press Enter or click Send to push an announcement to every connected player.',
          'Broadcasts appear as a gold-bordered banner at the top of the app and as a toast notification. Players can dismiss the banner with the X button.',
          'The server keeps the 20 most recent broadcasts in memory. All clients poll for new messages every 10 seconds.',
        ],
      },
      {
        heading: 'Player Presence — Who\'s Online',
        items: [
          'A green-dot presence indicator in the header shows the number of currently connected users.',
          'Click the indicator to expand a dropdown listing each online user by name. The GM is labelled with a "GM" badge.',
          'Each client sends a heartbeat every 15 seconds. Users who stop sending heartbeats are removed from the online list after 60 seconds.',
        ],
      },
    ],
  },
  {
    version: '2.0.0',
    date:    '2026-04-04',
    sections: [
      {
        heading: 'Multiplayer — Flask Server & User Accounts',
        items: [
          'The Binder is now a networked Flask application. It runs on a dedicated server PC and is accessible from any device on the local network (or internet via port forwarding) over HTTPS.',
          'Five user accounts: Steve (GM), Zerk, Dan, Rich, and Tay. Passwords set via a first-run /setup screen — nothing is hardcoded.',
          'Session-based login with Werkzeug bcrypt password hashing. Rate-limited to 5 attempts per 5-minute window.',
          'HTTPS via a self-signed certificate. Players see a one-time browser warning on first connect, then never again.',
          'The API key and Flask secret key live in secrets.env on the server — they are never sent to any browser.',
          'All save/edit API endpoints enforce role: players cannot write to the shared binder. Succession changes use a dedicated /api/succession endpoint that saves server-side.',
          'Player data auto-refreshes every 30 seconds — the GM saves, players see it without reloading.',
        ],
      },
      {
        heading: 'Player Knight Dashboard',
        items: [
          'Players now have a personalised dashboard instead of the GM overview.',
          'Daily-rotating Arthurian greeting addressed to the Player Knight by name and title (Sir/Dame, derived from pronouns).',
          'Manor Snapshot: treasury balance, base harvest, last year\'s result and net income, active improvements, property damage (expandable item by item).',
          'Matters Requiring Attention — pronoun-aware (My Lord / My Lady / My Liege): treasury deficit, no steward, no heir, overdue repairs, household members ready for an age transition, family members eligible for marriage, and betrothed pairs both of age and ready to wed.',
          'Marriage eligibility: flags Steward-role siblings and children of the PK at age 18+ with no spouse. Betrothed pairs are silent until both reach 18, then flagged as "ready to wed." Clears automatically once a Spouse relationship is recorded.',
          'Household Roster: expandable, sortable by rank / age / A–Z. Each entry opens the NPC card.',
          'Recent Deaths: last three years across all households, own household first in crimson.',
          'Recent Chronicle: last five events across the past two years.',
        ],
      },
      {
        heading: 'Player Knight Succession',
        items: [
          'New ⚔ Change Player Knight button on the player dashboard opens a multi-step modal.',
          'Step 1 — Status of the current knight: Died / Retired / Just Switching.',
          'Died: enter year and cause. Knight is moved to the Mausoleum with cause appended to their notes.',
          'Retired: pre-filled life event "Retired from Questing" with year, season, and notes field. Knight\'s role is changed to Knight.',
          'Just Switching: no record changes, role reassigned only.',
          'Step 2 — Select new Player Knight from a household member grid (name, role, age). Departing knight excluded when their fate is being recorded.',
          'Step 3 — Confirm summary and save. Changes write directly to the shared binder server-side.',
        ],
      },
      {
        heading: 'GM Dashboard — Household Intelligence',
        items: [
          'New Pending Age Transitions card: scans all living NPCs across all households and flags Baby/Child at 7+ (page training), Page at 15+ (squire), and Squire at 21+ (knighting). Each entry is clickable and opens the NPC card.',
          'New Eligible for Marriage card: Steward-role siblings and children of each household\'s PK, age 18+, no spouse yet. Betrothed pairs where both are 18+ shown separately as ready to wed. Both cards only appear when there is something to flag.',
        ],
      },
      {
        heading: 'Role-Based UI',
        items: [
          'GM-only elements (Families tab, Winter tab, Export, Import, API Key, New NPC, Add Event, edit buttons) are hidden for players via server-injected CSS classes applied before the page renders — no flash of GM content.',
          'Players see a read-only manor overview, read-only roster, read-only chronicle, and read-only mausoleum.',
          'The NPC card edit, relationship, and mark-deceased buttons are hidden for players on NPCs outside their own household.',
        ],
      },
      {
        heading: 'Server Console',
        items: [
          'Type restart in the server terminal to restart cleanly. If a save is in progress, it prints "Will restart once save is complete" and defers until the file write finishes — no corruption risk.',
          'Per-save threading.Lock prevents any file write from being interrupted mid-operation.',
          'Werkzeug access log suppressed — the terminal now only shows meaningful status lines ([Save], [Load], [AI], etc.), which also eliminates the Windows console interference that was garbling typed commands.',
          'Additional commands: status (save file path, HTTPS status, API key), users (list all accounts), help.',
        ],
      },
    ],
  },
  {
    version: '1.7.7',
    date:    '2026-04-02',
    sections: [
      {
        heading: 'Chronicle — Year in Review',
        items: [
          'New 📖 Chronicle tab — browse any year in your campaign and see every event that happened at a glance.',
          'Auto-populated sections: ⚔ The Fallen (deaths recorded that year), 🍼 Born This Year (birth year matches), 💒 Marriages (Spouse relationships created via Marriage Rolls).',
          'Click any NPC name in the Chronicle to open their card directly.',
          '📜 Chronicle Events: freeform GM entries per year. Choose a category (Campaign, Battle, Political, Personal, Supernatural, Other), type the event, press Enter or + Add. Entries can be individually deleted.',
          'Year navigation: ‹ / › arrows step through years that have any data. Dropdown jumps to any specific year instantly.',
          'Export button copies the selected year as clean markdown — paste into Discord, Obsidian, session notes, or anywhere else.',
          'All Chronicle entries are persisted in the save file and exported with the full data backup.',
        ],
      },
    ],
  },
  {
    version: '1.7.6',
    date:    '2026-04-02',
    sections: [
      {
        heading: 'NPC Cards — Faction / Organization',
        items: [
          'New "Faction / Organization" field on every NPC card and edit form. 14 predefined factions: Logres, Salisbury, Rydychan, Silchester, Cambria, Cumbria, The North, Brittany & Cornwall, Ireland, The Continent, Saxon, Independent, Ladies of the Lake (teal), and Fae (green).',
          'Each faction has a coloured tag badge displayed in the card header and in the NPC hover card (shown on cursor hover in the Roster sidebar).',
        ],
      },
      {
        heading: 'NPC Cards — Out of Story',
        items: [
          'New "Mark Out of Story" checkbox at the bottom of every NPC card. Checking it opens a Note field to record why (e.g. "Travelling in Gaul", "Imprisoned in Silchester").',
          'Out-of-Story NPCs remain in the living database and continue to age, but are hidden from the Roster main list and excluded from all Winter Phase rolls (Childbirth, Marriage, Yearly Events).',
          'A "🌫 N out of story" link at the bottom of the Roster sidebar shows the count and navigates to the new Mausoleum sub-tab.',
        ],
      },
      {
        heading: 'Mausoleum — Out of Story Sub-Tab',
        items: [
          'The Mausoleum tab now has two sub-tabs: "🕯 The Fallen" (existing deceased list) and "🌫 Out of Story" (new living-but-absent NPCs).',
          'Out of Story view shares the same search and household filter as The Fallen. Departure note is shown beneath each card.',
        ],
      },
      {
        heading: 'Roster — Age Sort & Esquire Role',
        items: [
          'New "Age" sort option in the Roster sidebar (oldest first; NPCs with no birth year sort to the bottom).',
          'Added "Esquire" as a selectable role on NPC cards, slotting between Lady and Squire in both rank sort order and the role dropdown.',
        ],
      },
      {
        heading: 'Winter Phase — Marriage Rolls Corrections',
        items: [
          'Wife\'s Rank table corrected to match the actual rulebook: 8 tiers from Wealthy Commoner\'s Daughter (1–5) through Baron\'s Younger Daughter (28+), each with correct dowry, glory, and extra-dice notes.',
          'Years Waited mechanic corrected: the counter now increments only when a knight passes their Courtesy roll and chooses to wait for a better match. A failed Courtesy roll has no effect on wait years.',
          'Knight marriage flow redesigned as a 4-state machine: no roll → courtesy failed (idle) → courtesy passed (choose: Roll Rank Table or Wait) → rank rolled (confirm marriage).',
        ],
      },
    ],
  },
  {
    version: '1.7.5',
    date:    '2026-04-02',
    sections: [
      {
        heading: 'Winter Phase — Marriage Rolls',
        items: [
          'New 💒 Marriage Rolls sub-tab in Winter Phase, between Childbirth and Yearly & Solo Events.',
          'Maidens-in-Waiting section: any she/her NPC without a title (knight/lord/baron etc.), unmarried, age 17+. Roll 1d20 + age modifier — total 20+ = marries this year. Modifier: 17:+2, 18:+4, 19:+6, 20:+8, 21+:+8+(age−20)×5.',
          'Knights & Nobles section: any NPC with a knightly or noble role, unmarried, age 21+. Roll d20 ≤ Courtesy + Years Waited to succeed. If failed, Years Waited increments automatically for next winter.',
          'Wife\'s Rank table: successful knights roll d20 + Years Waited and consult an 8-tier table (Wealthy Commoner\'s Daughter through High Baron\'s Daughter).',
          'Bachelor Knights: appear in the Knights section with a "Bachelor" badge and an "Eligible?" checkbox. Unchecked by default — bachelor knights need lord\'s permission before they may roll.',
          'Orientation field (Hetero / Homo / Bi, default Hetero): shown as a dropdown on each row for both sections. Spouse candidate picker in the confirmation modal is filtered by mutual orientation compatibility.',
          'Years Waited counter: shown and editable per knight. Cleared to 0 automatically on marriage, and can be manually reset.',
          'Marriage confirmation modal: choose an existing NPC (orientation-filtered) or create a new NPC on the spot. Creates a Spouse relationship with the year recorded in notes.',
          'Roll All buttons for each section. Pending marriages surface in a highlighted block for batch confirmation.',
        ],
      },
    ],
  },
  {
    version: '1.7.4',
    date:    '2026-04-01',
    sections: [
      {
        heading: 'NPC Cards — Extended Inferred Family',
        items: [
          'NPC cards now show three additional inferred relationship sections beneath the existing Siblings section — all computed on the fly from stored records, never written to the database.',
          'Grandparents & Grandchildren: walks two hops up (parent → parent) and two hops down (child → child) along bio parent chains.',
          'Aunts, Uncles & Nieces/Nephews: aunts and uncles are derived from each bio parent\'s stored and inferred bio siblings (step-siblings excluded). Nieces and nephews are the bio children of the subject\'s own stored and inferred bio siblings.',
          'In-Laws: Good-Father / Good-Mother from the spouse\'s bio parents; Good-Brother / Good-Sister from the spouse\'s stored siblings only (deliberately limited); Good-Son / Good-Daughter from bio children\'s spouses. All labels are pronoun-aware — falls back to Good-Parent / Good-Sibling / Good-Child for They/them or unset pronouns.',
          'All inferred sections are fully cycle-safe and deduplicated — no NPC will appear twice, and no one already in a stored relationship is repeated.',
        ],
      },
      {
        heading: 'Roster — Import NPC from Claude.ai',
        items: [
          'New "⬇ Import from Claude.ai" button in the Roster sidebar. Opens a modal to paste or load a JSON-formatted NPC generated by Claude.ai.',
          'The modal includes a copyable prompt snippet to add to your Claude.ai NPC generator — tells Claude the exact schema and valid field values.',
          'Parser handles markdown code fences automatically (Claude wraps JSON in them). Also accepts raw JSON, JSON arrays, and a variety of flexible field aliases (birth_year, background, female, etc.).',
          'A separate "traits" field is merged into Passions & Traits on import. Pronoun values like "female", "f", or "she" are normalised to She/her automatically.',
          'On success, the app switches to the Roster tab and opens the new NPC card immediately.',
          'A full reference guide (claude-npc-instructions.md) is included in the Binder folder — add it to a Claude.ai Project as a knowledge document so every NPC generation automatically outputs importable JSON.',
        ],
      },
      {
        heading: 'NPC Edit Form — Two-Way Age / Birth Year Sync',
        items: [
          'The Year Born and Age fields in the NPC edit form now sync live with each other.',
          'Entering a birth year instantly calculates and fills the Age field. Entering an age instantly back-calculates and fills the Year Born field.',
          'This means NPCs like Dame Terrwyn who were missing a birth year can be fixed by simply typing their age — Year Born is set correctly and the NPC becomes eligible for childbirth rolls immediately on save.',
          'The Age field label now reads "Age ↔ infers birth year" to make the two-way relationship visible.',
        ],
      },
      {
        heading: 'NPC Cards — Passions & Traits',
        items: [
          'The "Passions" field label has been renamed to "Passions & Traits" on both the NPC card view and the edit form.',
          'The underlying data field is unchanged — no migration needed, all existing data is preserved.',
        ],
      },
      {
        heading: 'Bug Fix — Template Literal Parse Error',
        items: [
          'Fixed a crash on load caused by backtick characters inside the Import NPC modal\'s placeholder text. A raw backtick inside a JavaScript template literal ends the string early, causing the entire components.js to fail to parse and leaving the dashboard blank.',
        ],
      },
    ],
  },
  {
    version: '1.7.3',
    date:    '2026-03-31',
    sections: [
      {
        heading: 'Family Tree — User-Pinned Positions',
        items: [
          'Dragging a node now automatically locks its position. Dynasty Layout and Auto Layout will no longer overwrite nodes you have manually placed — they arrange everyone else around your pinned nodes.',
          'A 🔒 N Locked button appears at the bottom-right of the tree canvas whenever at least one node is pinned, showing the count. Click it to release all pins and let the layout run freely again.',
          'Pinned status is saved and persists across sessions and tab switches.',
        ],
      },
      {
        heading: 'Winter Phase — Survival Category Fix',
        items: [
          'Women\'s table classification has been corrected. A woman now rolls on the Adult table only if she is a knight (any class) or is married to a Player Knight. All other women — unlinked, widowed, or married to a non-PK — roll on the Women table, which is the historical default the rules assume.',
          'Previously, any woman with a spouse relationship (regardless of whether that spouse was a Player Knight) could incorrectly end up on the Adult table.',
        ],
      },
      {
        heading: 'NPC Cards — Training Path',
        items: [
          'New field: Training Path, visible and editable on every NPC card. Stores the knight\'s training progression (e.g. "Salisbury Page → Squire of Sir Roderick").',
          'Was previously accepted in the form but silently discarded on save.',
        ],
      },
      {
        heading: 'NPC Cards — Came of Age Fix',
        items: [
          'Confirming a "Came of Age" prompt no longer re-opens the NPC card on top of itself. The tab refreshes in place and a toast confirms the update.',
        ],
      },
      {
        heading: 'Manor — History Fixes',
        items: [
          '"Years with Conflict: N" line added to the manor history summary, so you can see at a glance how often the manor has suffered raids or worse.',
          'Fixed: Switching between manors while a Record Year edit was open could carry stale data into the new manor\'s form. The working entry is now cleared whenever you select a different manor.',
        ],
      },
      {
        heading: 'Roster — Scroll Position Fix',
        items: [
          'Fixed: After adding or editing an NPC, the roster list now scrolls to and highlights the correct entry. A mismatched selector (using list index instead of NPC ID) was causing the wrong row to be highlighted.',
        ],
      },
      {
        heading: 'Solos — Kin Events Roll Fix',
        items: [
          'Fixed: Kin Event table selection was using the frequency-modified roll value, causing large households to systematically land on high-numbered events. The frequency modifier now only affects whether an event occurs — table selection always uses a plain d20.',
        ],
      },
      {
        heading: 'Mausoleum — PNG Export Fix',
        items: [
          'Fixed: NPC portrait icons were not rendering in the Roll of the Fallen PNG export. A text-measurement call was returning an object instead of a width value, so the icon fallback condition never triggered.',
        ],
      },
      {
        heading: 'Various Bug Fixes & Code Cleanup',
        items: [
          'Fixed: The app was starting its auto-save sync twice on load, causing redundant background saves.',
          'Fixed: Manor field priority now correctly prefers the dropdown selection over a typed value when both are present, matching the expected behaviour.',
          'Fixed: The "needs page placement" age flag was showing on NPCs who had already been placed as pages (page_placed field is now checked).',
          'Fixed: HTML in the relationship edit dialog was not escaping NPC names — names containing characters like < > & could break the form layout.',
          'Fixed: Accessing the household name in the Families tab used an internal property directly; replaced with a proper accessor to prevent silent breakage if the tree was not open.',
        ],
      },
    ],
  },
  {
    version: '1.7.2',
    date:    '2026-03-30',
    sections: [
      {
        heading: 'Yearly & Solo Events — Three Distinct Roll Types',
        items: [
          'Tab renamed from "Solos" to "Yearly & Solo Events" to reflect the broader scope.',
          'Controls restructured into a shared row (Knights, Status, Year) above three self-contained action blocks.',
          'Block 1 — Yearly Event: 1d20 → full Yearly Events table → sub-tables. Tier I/II toggle lives here.',
          'Block 2 — Solo Event: 1d6 → Summer/Winter adventure chain. Season toggle lives here, with winter travel note shown inline when Winter is active.',
          'Block 3 — Kin Events: frequency roll → kin table. Kin Size toggle lives here.',
          'Each block has its own dedicated Roll button. Status (Wed/Unwed) is shared across all three.',
        ],
      },
      {
        heading: 'Yearly Events — Structural Fix',
        items: [
          'Tier I solos were incorrectly routing through a 1d6 Summer/Winter Solo selector instead of the 1d20 Yearly Events table. Fixed: Tier I now always rolls 1d20 → Good Fortune / Friend / Relations / Saga Event / Enemy / Bad Fortune → sub-tables.',
          'The 1d6 Solo adventure chain (Vassal Duty, Liege Court, Adventure, Questing, etc.) is now correctly placed as the dedicated "Solo Event" roll type, not as a Tier I stand-in.',
          'Cards show a roll-mode pill in the header: Yearly, Yearly · Minor, Solo · ☀ Summer, Solo · ❄ Winter, or Kin Events.',
          'Flavor text now correctly requested for Solo Event cards and suppressed for Kin Events (previously kin cards could show a spurious "no API key" message).',
        ],
      },
    ],
  },
  {
    version: '1.7.1',
    date:    '2026-03-30',
    sections: [
      {
        heading: '@Mentions — Bug Fixes',
        items: [
          'Clicking an @mention link no longer closes the currently open NPC card. The existing card is pushed onto a modal stack and a ← Back button is injected at the top of the linked card.',
          'Pressing ESC while viewing a stacked card pops one layer instead of closing the modal entirely.',
          'The hover tooltip now hides immediately on click — previously it would stay on screen because the DOM change prevented onmouseleave from firing.',
        ],
      },
      {
        heading: 'Relationships — Clarity & Visibility Fixes',
        items: [
          '"Natural child of" relationship label renamed to "Bastard of" so bastard status is unambiguous on the child\'s card.',
          'Acknowledgement radio buttons (Unacknowledged / Acknowledged / Legitimized) are now correctly hidden unless Bastard type is selected. A CSS specificity bug (display:flex overriding the HTML hidden attribute) was preventing this from working.',
        ],
      },
      {
        heading: 'Childbirth — Pronoun Choice on Bastard Birth',
        items: [
          'The Bastard Birth modal in Solo Events now shows a Pronoun selector (he/him / she/her / they/them) pre-populated from the rolled sex result.',
          'Previously the pronoun was silently hardcoded at save time with no opportunity to change it.',
        ],
      },
    ],
  },
  {
    version: '1.7.0',
    date:    '2026-03-30',
    sections: [
      {
        heading: 'Solos — Full Table Complexity',
        items: [
          'Tier I rolls now begin with a Summer/Winter Solo d6 routing table instead of going straight to Yearly Events. The d6 routes to: Generic (1), Vassal Duty (2), Liege Court (3), Adventure (4), Love/Questing (5, based on marital status), or Adventure GM-pick (6).',
          'Added 22 new Combat & Adventure chain tables: Vassal Duty, Liege Court, Adventure, Questing, Love, Bandits, Chore, Insulted, Loss, Conflict, Guest, Amuse, Garrison (6-phase), Fight, Hideout, Skirmish, Conquest, Muster, Patrol (6-phase), Tournament (Tilt + Melee), Hunt (with Falconry chain), and Challenge.',
          'Multi-phase tables (Garrison, Patrol) auto-roll all phases and display each result as a joined narrative.',
          'Tournament now rolls Tilt and Melee independently with distinct glory/wound outcomes.',
          'Hunt resolves into a Falconry sub-roll on a critical result.',
          'The ledger roll badge now shows the d6 routing result (e.g. "d6: 3 → Liege Court") for Tier I instead of the flat d20.',
          'All new event types have distinct colour-coded category badges in the ledger.',
        ],
      },
      {
        heading: 'Solos — Kin Events (Separate System)',
        items: [
          'Kin Events are now a fully separate system from the main Solo roll, per the Book of Solos spec.',
          'A "Kin Size" toggle (Small / Normal / Large) sits in its own row below the main controls, alongside a green "⚅ Roll Kin Events" button.',
          'Frequency roll: base d6 modified by kin size (+0/+1/+2), knight status (+5), and landed status (+5). Result 1–4 = quiet season; 5–6 = one event; 7–8 = two events.',
          'Results route to the full 40-entry Kin Events table, including Kin Member (1d20) and Kin Knight Muster (1d6) sub-tables.',
          'All 40 Kin Events implemented, covering disputed betrothals, muster disasters, marriage arrangements, squires, ransoms, blood feuds, bastard claims, and more.',
          'Kin Event cards appear in the main ledger with a distinct dark-green badge and include frequency roll information in the description.',
        ],
      },
      {
        heading: 'Solos — AI Flavor Text Overhaul',
        items: [
          'Flavor text is now 1–2 sentences instead of one, giving Haiku room for a proper Arthurian cadence.',
          'Writing style now explicitly targets Thomas Malory\'s Le Morte d\'Arthur and the Lancelot-Grail Vulgate Cycle: grave third-person narration, "and so it befell", "worshipful", matter-of-fact treatment of violence and fate.',
          'A 10-slot style rotation cycles through distinct creative angles: bystander POV, object/sound focus, inner emotion, overheard speech, physical gesture, steward\'s ledger voice, aftermath, sensory indoors, household proverb, and bard\'s tavern verse.',
          'Hard-banned words throughout every sentence: snow, frost, ice, frozen, chill, cold, bitter, moorland, wolves, mist, fog, rode through, rode forth, rampart, blizzard. No more frost-choked moorlands regardless of season.',
          '"Winter event" removed from the system prompt — was causing Haiku to invent bleak winter imagery even on summer solos.',
          'Token limit raised from 120 to 160 to support two-sentence outputs without mid-clause truncation.',
        ],
      },
      {
        heading: 'Solos — Knight Personality Notes',
        items: [
          'Each knight pill now has a ✎ button to open a personality note editor. Write the knight\'s dominant traits, vices, and reputation (e.g. "Cruel, covetous of glory, contemptuous of clergy").',
          'The note is stored permanently on the NPC and included verbatim in every AI flavor text prompt for that knight, so Haiku writes in character rather than inventing personality from scratch.',
          'The ✎ button turns amber-gold when a note is set, making it easy to see at a glance which knights have been described.',
          'The personality note is also shown in the hover tooltip under a "Traits" heading.',
          'Notes can be edited or cleared at any time from the same modal.',
        ],
      },
      {
        heading: 'Solos — Knight Pill Improvements',
        items: [
          'Hovering over a knight\'s pill name shows a floating summary tooltip: Role, Age (calculated live), Glory, Household, Spouse (pulled from relationships), Personality traits, and a notes excerpt.',
          'Clicking the knight\'s pill name opens their full NPC card sheet directly.',
          'The ✎ trait button and × remove button sit beside the name in a compact pill layout.',
          'Tooltip is viewport-aware and flips left/up if it would overflow the screen edge.',
        ],
      },
      {
        heading: 'Solos — Multi-Knight & Year Input (Prior Session)',
        items: [
          'Knight picker now supports multiple knights simultaneously: search field, click to add as pills, × to remove. Hitting Cast the Lot rolls independently for every knight in the list.',
          '"Rolling for year" input added to controls — separate from the campaign year, so you can run solos for any year without changing the global year counter.',
          'Tier II fixed: previously two knights rolling in the same d20 range always got identical text. Now each category has 4 variant sentences picked randomly and independently per knight.',
        ],
      },
      {
        heading: 'NPC Cards — Life Events Chronicle',
        items: [
          '"Solo Chronicle" renamed to "Life Events" on NPC cards.',
          'A "+ Add Event" button is always visible, allowing manual entry of any event (year + notes) independently of the Solos tab.',
          'Solos resolved via the ledger auto-add to the knight\'s Life Events chronicle.',
          'Glory amounts mentioned in resolved events are automatically extracted and added to the knight\'s Glory total.',
        ],
      },
      {
        heading: 'NPC Cards — Bastard Relationships',
        items: [
          'Bastard relationships display with acknowledgement status distinct from other child types.',
          'Acknowledgement status badge shown on relationship rows: ✗ Unacknowledged (grey), ◈ Acknowledged (green), ⚜ Legitimized (gold).',
          'Add/Edit relationship forms show acknowledgement radio buttons when Bastard type is selected.',
          'Status is stored as a prefix in the notes field and stripped cleanly when editing.',
        ],
      },
      {
        heading: 'API Key & AI Integration',
        items: [
          'AI flavor text now proxied through the local server (/api/ai) — the Anthropic key never touches the browser.',
          'API key stored in config.json separately from save data and persists across restarts.',
          '🔑 AI Key button in the header shows amber when no key is set, green when active.',
          'When no key is configured, flavor text cards show a clear "set an API key via 🔑" prompt instead of a silent blank.',
          'Glory values in "G" notation throughout the tables corrected to "Glory" — G was being misread as gold.',
          'Newborns created via Bastard or Childbirth flows are now auto-tagged role: Baby.',
        ],
      },
    ],
  },
  {
    version: '1.6.0',
    date:    '2026-03-30',
    sections: [
      {
        heading: 'Relationships — Bulk Add',
        items: [
          'The Add Relationship form now supports multiple people at once. Select the type once, then add as many rows as needed with "+ Add Another Person". Each extra row has an ✕ to remove it.',
          'Saving adds all filled rows in one action and toasts "X relationships added".',
          'Duplicate detection: before saving each entry, the app checks whether a relationship of that type already exists between those two NPCs (in either direction). Duplicates are skipped and listed in a warning toast; valid entries still save normally.',
        ],
      },
      {
        heading: 'Relationships — Direction Auto-Correction',
        items: [
          'Direction auto-correction now covers Squire, Former Squire, Page, Vassal, Ward, and Guardian — not just Parent/Child types. Add from either person\'s card and the direction will be stored correctly.',
          'Squire/Guardian: source = senior (older NPC). Page/Vassal/Ward: source = junior (younger NPC).',
        ],
      },
      {
        heading: 'NPC Cards — Inferred Siblings',
        items: [
          'NPC cards now show a computed "Siblings" section below Relationships, derived from shared parent records. Never stored — never appears as lines on the family tree.',
          'Types: Full Sibling (both bio parents shared), Half-Sibling (one bio parent shared), Step-Sibling (child of a bio parent\'s spouse, no blood link), or Sibling (only one parent recorded, full/half indeterminate).',
          'Each entry is colour-coded and clickable. Dead siblings show their death year struck through.',
        ],
      },
      {
        heading: 'Households — Head of House',
        items: [
          'Right-click any node in the family tree → "⚜ Set as Head of House" to mark the current ruling member of a household. Toggle it off the same way.',
          'Head of House node gets a dark crimson colour bar with "⚜ HEAD OF HOUSE ⚜" label (distinct from the gold Dynasty Founder crown).',
          'A ⚜ Head: [Name] badge appears in the tree toolbar alongside the founder badge.',
          'The NPC card shows a crimson "⚜ Head of House [Household]" block.',
          'The Families tab banner shows the head\'s name in the tagline beneath the house name.',
        ],
      },
      {
        heading: 'Family Tree — Fixes',
        items: [
          'Fixed: Explicit Sibling/Half-Sibling lines are now suppressed when both nodes already share a visible parent in the tree. The parent-child bracket already implies the relationship — the extra line was visual clutter.',
          'Fixed: "Send to Pocket" is now remembered across Dynasty Layout runs. An NPC sent to the pocket will stay there even if they have family relationships, until you explicitly drag them back onto the canvas.',
          'Fixed: Opening the Add Relationship form from a card inside the tree no longer closes the tree. The form opens in the same card popup layer.',
          'Fixed: Editing a relationship from a card inside the tree now opens the edit form in the card popup, not in the main modal beneath the tree.',
          'Fixed: Ages in the Families tab member list are now calculated live from year_born and the current campaign year. Previously they used a stored age field, so ticking the year up/down had no effect. Newborns (age 0) now display correctly instead of showing nothing.',
        ],
      },
    ],
  },
  {
    version: '1.5.0',
    date:    '2026-03-28',
    sections: [
      {
        heading: 'Winter Phase — Childbirth Rolls',
        items: [
          'New: Childbirth Rolls sub-tab added to the Winter Phase. Eligible women (she/her · age 18–40 · not barren) are grouped by household.',
          'Roll All covers women with a living spouse. Individual Roll buttons handle widowed or unmarried women. ⚔ marks a roll as fornication/adultery (child born as bastard). ⚜ prestige bypass guarantees a healthy birth with RNG sex.',
          'Conception roll uses a modified CON check (1d20 vs effective CON). Effective CON = base CON + user modifier − 10 if she gave birth last year − 1 for each year over 35.',
          'Critical (roll = effective CON): roll 1d6 — 1–4 Multiple Birth (roll 1d20 on the multiple birth table: twin boy & girl, fraternal twins, identical twins, or triplets with three d6 sex rolls), 5 Blessed Boy, 6 Blessed Girl.',
          'Success (roll < effective CON): healthy child, sex determined by odd/even on the d20.',
          'Failure (roll > effective CON, not 20): no conception.',
          'Fumble (roll = 20): if she gave birth last year → no birth. Otherwise roll 1d6 (+1 if this is her first conception) on the tragedy table — 1 child dies in birth, 2 mother dies, 3–4 both die, 5–6 difficult birth (permanent −1 CON), 7 barren.',
          'Births and tragedies surface in their own pending blocks at the top of the section. Record Birth creates a child NPC pre-linked to mother and father with the correct relationship type (Child or Bastard). Tragedy resolution applies outcomes directly: kills NPCs, reduces CON, or marks as barren.',
          'Barren women remain visible in the list but are greyed out with a Barren tag and locked from rolls.',
          'Widowed women (spouse deceased) are shown with a † widowed tag and skipped by Roll All.',
          'Name filter search added to the Childbirth section.',
        ],
      },
      {
        heading: 'Winter Phase — Survival Improvements',
        items: [
          'Survival and Childbirth rolls are now in separate sub-tabs within the Winter Phase tab.',
          'Deaths after rolling are grouped into a "Deaths — Pending Confirmation" block at the top, separate from the household list. Each death has its own Confirm button; the household rows show the result badge only.',
          'Name filter search added to the Survival section.',
          'Reset clears the search filter as well as all roll results.',
        ],
      },
      {
        heading: 'NPC Cards — CON & Barren',
        items: [
          'New: CON field on every NPC card (default 13). Feeds directly into childbirth conception roll calculations.',
          'New: Barren checkbox on every NPC card. Ticking it hides the CON field and locks the NPC out of childbirth rolls. Can be set manually or applied automatically by the tragedy resolution system.',
        ],
      },
    ],
  },
  {
    version: '1.4.0',
    date:    '2026-03-28',
    sections: [
      {
        heading: 'Winter Phase — New Tab',
        items: [
          'New tab: ❄ Winter Phase, located between Families and Mausoleum.',
          'Household Survival Rolls — all living NPCs are grouped by household and automatically categorised by age and gender: Infant, Child, Women (married, non-Player-Knight spouse, she/her, age 15–40), Adult, Elder, Very Old.',
          'Auto-exempt NPCs are excluded from rolls and shown with a reason tag: Player Knights, Fate-Touched, Pages, Squires, and Blessed children under 21.',
          'Manually exempt any NPC by ticking the checkbox next to their name.',
          'Roll All resolves the entire roster at once; individual Roll buttons allow single-NPC rolls. Reset clears all results.',
          'Summary bar shows total Safe / Births / Deaths / Pending after rolling.',
          'Deaths display a "Confirm Death" button that opens a modal to record the year and cause, then moves the NPC to the Mausoleum.',
        ],
      },
      {
        heading: 'Roster — Quality of Life',
        items: [
          'Age is now shown on every NPC entry in the roster sidebar. Living NPCs show a pill badge with their current age; deceased NPCs show † age-at-death in a dimmed style.',
          'The roster sidebar has been widened (280 → 340 px) to better display longer NPC names.',
          'Fixed: Blessed children who have been placed as a Page at a household were still showing the "needs page placement" flag. The flag now checks the page_placed field correctly.',
        ],
      },
      {
        heading: 'Mausoleum — Roll of the Fallen Export',
        items: [
          'New: "📜 Export Roll of the Fallen" button in the Mausoleum header. Select a year and export a gothic parchment PNG listing all NPCs who died that year — name, household, role, dates, age, cause of death, and glory.',
          'If no one died in the selected year, a celebratory toast is shown instead.',
        ],
      },
      {
        heading: 'Manor — Misfortune & Events',
        items: [
          'Fate & Events section renamed to Misfortune Factors. All factor inputs now sum to a live "Total Misfortune Score" display rather than contributing to librum income.',
          'Conflict outcome options updated: No Result · Bandits · Raided · Pillaged · Plundered.',
        ],
      },
      {
        heading: 'Manor — Improvements Income',
        items: [
          'Improvements now have an optional fixed income (L/yr) and dice income (e.g. 1d2) field.',
          'Record Year pre-fills with the total auto-income from all improvements. An Edit button on each improvement row allows updating income details at any time.',
        ],
      },
      {
        heading: 'Manor — Personnel Search',
        items: [
          'The Lord/Lady, Steward, and Heir fields now use the NPC search widget (type-to-filter) instead of a long dropdown list.',
        ],
      },
    ],
  },
  {
    version: '1.3.1',
    date:    '2026-03-28',
    sections: [
      {
        heading: 'Family Tree — Fixes',
        items: [
          'Fixed: Editing a relationship from an NPC card while the family tree was open caused the tree to close and reset to the household detail view. The tree now stays open and redraws after the relationship is saved.',
          'Fixed: Dynasty Layout — if the upward-pass assigned a parent a negative generation number (e.g. a dynasty founder\'s parent was in the tree), those nodes were silently dropped from the layout. All generations are now normalised so the topmost ancestor is always row 1.',
          'Fixed: Record Year — clicking "Record Year" on a manor when that year was already recorded showed no feedback. Now shows a dialog with Cancel, Edit, or Overwrite options.',
          'Fixed: Sibling/Half-Sibling lines are now drawn as stacking orthogonal brackets above the row instead of curved arcs. Wider pairs stack higher to avoid collisions.',
          'Fixed: Parent-child drop lines no longer use a dotted stroke for children whose parent belongs to an external household. Dashed lines are reserved for Bastard and Adopted children only.',
          'New: NPC cards in the family tree now show year of death (†) in dark red below the birth year for deceased characters.',
        ],
      },
    ],
  },
  {
    version: '1.3.0',
    date:    '2026-03-28',
    sections: [
      {
        heading: 'Manor — Vassal Manor Cards',
        items: [
          'New: Each manor now has a "Vassal Manors" section. Add vassal manors with their name, tenure type (Gifted / Granted), current knight (linked to the NPC roster), and optional notes.',
          'New: Record Year automatically includes +1 L income per vassal manor as "Vassal Income". This appears as a read-only line in the income column and is recorded in the ledger history.',
          'Vassal income is shown in the expanded budget detail rows of the history ledger.',
        ],
      },
      {
        heading: 'Family Tree — Sibling Layout & Lines',
        items: [
          'Fixed: NPCs connected to tree members only by a Sibling relationship (and no parent link) now appear in the correct generation row instead of floating at the bottom of the tree.',
          'Fixed: Sibling and Half-Sibling connections are now drawn as a curved arc above the tree row instead of a straight diagonal line that cut through other nodes.',
          'Half-Sibling arcs use a distinct dash pattern to distinguish them from full siblings.',
        ],
      },
      {
        heading: 'Family Tree — Export & View',
        items: [
          'New: Export PNG button in the tree toolbar. Choose 2×, 3×, or 4× resolution. Exports the full tree on a parchment background as a downloadable PNG file.',
          'New: Dynasty Layout and Force Layout now auto-fit the view to the tree bounds after running, so the full tree is visible without manual zooming or panning.',
        ],
      },
      {
        heading: 'Family Tree — Edge Fixes',
        items: [
          'Fixed: Distribution bar gap — when children were laid out far to the right of their parents\' midpoint, the horizontal bar connecting the spine to the children had a gap. The bar now always extends to include the spine anchor point.',
          'Fixed: Relationship direction heuristic — when adding a Child/Parent relationship from an NPC\'s card, the direction is now determined by birth year rather than a blind swap. This prevents cases where the older person was incorrectly assigned as the child.',
        ],
      },
    ],
  },
  {
    version: '1.2.1',
    date:    '2026-03-28',
    sections: [
      {
        heading: 'Family Tree — Layout & Edge Fixes',
        items: [
          'Fixed: Dynasty Layout now correctly places adopted children, bastards, and biological children one generation BELOW their parents. Previously, relationships created from the child\'s NPC card (e.g. "Strixen is an Adopted Child of Marrin") were interpreted backwards, putting the child at the same level as the parent.',
          'Fixed: "Parent" and "Adoptive Parent" relationship types were also interpreted backwards in both the dynasty layout and the bracket edge drawing — now correctly handled.',
          'Fixed: Running Dynasty Layout no longer un-pins nodes that were dragged in from the pocket panel.',
          'Fixed: Deceased NPCs now appear on the family tree (previously only living NPCs were shown).',
          'Tree pocket sidebar: NPCs with no family relationships go to an "Unplaced" collapsible panel instead of cluttering the canvas. Drag them onto the tree to place them.',
          'Fixed: The ⊕ connect button no longer disappears after clicking it (SVG was being rebuilt, resetting button opacity).',
          'Fixed: Dragging a pocket item to the canvas no longer also pans the view.',
          'Fixed: Repositioning a pocket-placed node no longer makes it vanish back to the pocket.',
          'New: Parent-child relationships are drawn as proper family tree brackets (couple bar → spine → distribution bar → per-child drops) instead of diagonal lines. Adopted and Bastard drops use distinct dash patterns with a label.',
          'New: When connecting two nodes with a Child/Adopted Child/Bastard relationship type, a "Second Parent" prompt lets you link both parents at once.',
        ],
      },
      {
        heading: 'Roster — Household Knight Removed',
        items: [
          '"Household Knight" has been removed as a role — it has been consolidated into "Bachelor Knight".',
          'All existing NPCs with the Household Knight rank have been automatically converted to Bachelor Knight.',
        ],
      },
      {
        heading: 'Roster & NPC Cards',
        items: [
          'Age is now derived from year_born and the current campaign year — ages update automatically when you advance the year, no manual entry needed.',
          'Deceased NPCs in the Mausoleum show their age at death (frozen at year_died), not their current would-be age.',
          'Training history labels now use present or past tense based on current role: "Squire under" / "Squired under", "Paging at" / "Paged at", "Studying with the Clergy at" / "Studied with the Clergy at", etc.',
          'Close button on inline NPC cards (in the Roster detail pane) now works correctly.',
          'Search bar has a ✕ clear button.',
        ],
      },
      {
        heading: 'Dashboard Fix',
        items: [
          'Fixed: Harvest and Conflict columns on manor cards now show the year the data was recorded (the last winter phase), not the current campaign year. Advancing the year no longer makes those labels incorrect.',
        ],
      },
      {
        heading: 'Sync Indicator',
        items: [
          'Unsaved changes now pulse the sync indicator (●) so you can see at a glance when there\'s work pending.',
        ],
      },
    ],
  },
  {
    version: '1.2.0',
    date:    '2026-03-27',
    sections: [
      {
        heading: 'Manor — Itemized Misc Expenses & Income',
        items: [
          'Misc Income and Misc Expenses in "Record Year" are now itemized line lists instead of a single number.',
          'Click "＋ Add" next to either field to add a line: enter the librum amount and a note (e.g. "Tournament prize", "Road toll repair").',
          'Each item can be individually removed with the ✕ button.',
          'When you expand a year in the History ledger, each misc item appears as its own named budget line.',
          'Fully backward-compatible — old records that used the single-number format still display correctly.',
        ],
      },
      {
        heading: 'Knight Rank Hierarchy',
        items: [
          'Added Knight Banneret, Household Knight, Bachelor Knight, and Mercenary Knight as distinct roles with proper rank ordering.',
          'Correct hierarchy: Mercenary Knight < Household Knight / Bachelor Knight < Vassal Knight < Knight Banneret.',
          'Dame removed as a separate role — female knights use the same Knight categories (Dame is just a honorific).',
        ],
      },
      {
        heading: 'Age Tracking & Training',
        items: [
          '"Needs Page Placement" flag on roster cards for unplaced children aged 7–13.',
          '"Needs Training" flag for Pages aged 14+ who need their next placement.',
          '"Came of Age?" flag for Squires aged 21+ or Stewards/Priests/Druids aged 18+. Click "✓ Confirm" to dismiss permanently.',
          'Training relationships show on roster list cards: "Squire under: [Knight Name]" and "Squire: [Squire Name]" as clickable links.',
          'Full Training History section on NPC cards showing where they paged and trained.',
          'Data migration (v1→v2): existing Stewards, Priests, and Druids aged 18+ are automatically marked as adults — no re-seeding needed.',
        ],
      },
      {
        heading: 'Manor — Year-by-Year Summary',
        items: [
          'Overview tab now shows a compact ledger summary below active improvements: Year | Luck | Conflict | Harvest | Treasury.',
          'Shows last 10 years by default; click "▼ Show all N years" to expand.',
          'Click any row to jump directly to the full History tab.',
        ],
      },
      {
        heading: 'Dynasty Tree',
        items: [
          'Right-click any node → "Set as Dynasty Founder" to mark the patriarch/matriarch.',
          '"Dynasty Layout" button arranges nodes in generational rows from founder down. Spouses sit at the same level.',
          'Founder node gets a gold crown bar, bold name, and ♛ glow ring.',
        ],
      },
    ],
  },
  {
    version: '1.1.1',
    date:    '2026-03-27',
    sections: [
      {
        heading: 'QA Bug Fixes',
        items: [
          'Fixed: Adding a new NPC and cancelling no longer creates a blank, permanent ghost entry in the roster. The NPC is only saved when you click "Add to Roster".',
          'Fixed: Opening the manor personnel picker (Lord/Steward/Heir) no longer silently mutates the roster\'s sort order.',
          'Fixed: "Record Year" now blocks duplicate entries for the same year and shows an error message.',
          'Fixed: Manor treasury display now always shows the most recent year\'s treasury, even if entries were recorded out of chronological order.',
          'Fixed: The Luck badge ("Boon") in manor history no longer uses a CSS injection hack — now uses proper inline styles.',
          'Fixed: Adding an improvement or property damage no longer crashes if the manor was imported without those array fields.',
          'Fixed: Duplicate harvestResult/harvestOutcome field removed from the history entry schema.',
          'Fixed: Dame now displays with the knight colour (crimson) rather than falling back to grey.',
        ],
      },
    ],
  },
  {
    version: '1.1.0',
    date:    '2026-03-27',
    sections: [
      {
        heading: 'Family Tree — Dynasty Mode',
        items: [
          'Right-click any node → "Set as Dynasty Founder" to mark the patriach/matriarch of a house.',
          'New Dynasty Layout button arranges the tree in generational rows: founder at top, children below, grandchildren below that. Spouses sit side-by-side at the same level.',
          'Founder node shows a gold crown bar, bold name, gold ♛ glow ring, and a "♛ DYNASTY FOUNDER ♛" label in the colour bar.',
          'The founder\'s name appears in the toolbar as a reminder.',
          'Auto Layout (grid) remains available as before.',
          'Dynasty layout positions are saved immediately to your save file.',
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    date:    '2026-03-26',
    sections: [
      {
        heading: 'Initial Release',
        items: [
          'Unified GM Binder app combining the Britannia NPC Roster and Manor Ledger into one tool.',
          'Five tabs: Dashboard, Roster, Manors, Families, Mausoleum.',
          'All existing NPC and manor data imported (148 living NPCs, 43 deceased, 4 manors with full history 485–498).',
          'Vault-style save file system — each computer picks its own save path (great for Google Drive sync).',
          'Auto-save on every change (3-second debounce) with rolling backups.',
          'Roster: A-Z, By Rank, By Class sorting; household chip filters; Blessed Birth ✦ and Fate-Touched ◈ flags.',
          'Manors: Lord/Lady, Steward (with Stewardship skill), Heir selectors; Hatred/Care progress bars; full expandable ledger history rows matching the original ledger layout.',
          'Family Tree: freeform drag-and-drop SVG canvas; hover ⊕ to connect nodes; outside-family members shown with dashed borders and household pip.',
          'Mausoleum: deceased NPC archive with year of death, search, and household filters.',
        ],
      },
    ],
  },
];
