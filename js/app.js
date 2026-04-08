/* ══════════════════════════════════════════════════════════════
   APP.JS — Init, routing, global wiring
══════════════════════════════════════════════════════════════ */

const APP_VERSION = '2.7.0';

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
    heading: 'Your Dashboard',
    icon: '⚜',
    items: [
      'Your dashboard opens to a personalised welcome addressed to your Player Knight by name and title. The greeting rotates daily through Arthurian phrases.',
      'Manor Snapshot — your treasury balance, base harvest, last year\'s result and net income, active improvements, and any property damage. Click the damage count to expand each item.',
      'Matters Requiring Attention — a living checklist that flags anything your household needs action on: treasury deficits, missing steward or heir, overdue repairs, household members ready for an age transition (page → squire → knighting), family members eligible for marriage, and betrothed pairs who are both now of age and ready to wed.',
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
    heading: 'Roster & Chronicle',
    icon: '📜',
    items: [
      'The full NPC Roster is available for browsing — search by name, household, role, or status.',
      'Click any NPC to open their card: relationships, life events, skills, notes, and family.',
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
    heading: 'Persons of Interest',
    icon: '★',
    items: [
      'Any user can pin NPCs to their personal Persons of Interest list using the ☆ Pin button on any NPC card.',
      'Each user\'s pinned characters appear in a ★ Persons of Interest widget on their own dashboard. Clicking opens the NPC card without leaving the dashboard.',
      'Pins are per-user and independent — the GM\'s list is separate from each player\'s. No cap on pins.',
      'GM pins are stored alongside player pins in player_data/{username}/pins.json.',
    ],
  },
  {
    heading: 'Stables',
    icon: '🐴',
    items: [
      'Each manor has a Stables section tab (alongside Overview, History, and Improvements). The GM can add, edit, and manage horses for any household.',
      'Horses belong to the player whose household owns the manor — data is stored per-player on the server, separate from the main binder save.',
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
      'Eligible women (she/her · age 18–40 · not barren) grouped by household. Each row shows CON, auto-modifiers, and calculated effective CON.',
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
    heading: 'Yearly & Solo Events',
    icon: '🎲',
    items: [
      'Three roll types per knight: Yearly Event (1d20 → full table), Solo Event (1d6 → adventure chain), and Kin Events (frequency + full 40-entry kin table).',
      'Multi-knight support — roll for every active knight simultaneously.',
      'AI flavor text via Claude Haiku, written in the style of Malory\'s Le Morte d\'Arthur. Knight personality notes steer the prose.',
      'Resolved events auto-add to the knight\'s Life Events chronicle on their NPC card.',
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
];

// ── PATCH NOTES ───────────────────────────────────────────────
// Each entry: { version, date, sections: [{ heading, items:[] }] }
const PATCH_NOTES = [
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

// ── FILE SYNC STATUS INDICATOR ────────────────────────────────
const FileSync = {
  _states: {
    saved:   { icon: '✓', label: 'Saved',   colour: '#2a8a40' },
    unsaved: { icon: '●', label: 'Unsaved', colour: '#c08010' },
    saving:  { icon: '↑', label: 'Saving…', colour: '#b8860b' },
    error:   { icon: '✕', label: 'Error',   colour: '#9a2424' },
    offline: { icon: '◌', label: 'Local',   colour: '#7a7060' },
  },

  setStatus(state) {
    const icon  = document.getElementById('syncIcon');
    const label = document.getElementById('syncLabel');
    const wrap  = document.getElementById('syncStatus');
    const s     = this._states[state] || this._states.offline;
    if (icon)  { icon.textContent  = s.icon;  icon.style.color  = s.colour; }
    if (label) { label.textContent = s.label; label.style.color = s.colour; }
    if (wrap)  { wrap.title = `File sync: ${s.label}`; wrap.dataset.status = state; }
  },
};

const APP = {
  _currentTab: 'dashboard',
  currentUser: null,

  async init() {
    FileSync.setStatus('saving');

    // User identity injected by server at page load (window.__USER__)
    this.currentUser = window.__USER__ || null;

    // Wire modal first so the welcome screen can use it
    Modal.initListeners();
    HoverCard.init();
    AtMention.init();  // @mention autocomplete — must be after DOM ready

    // Try loading from configured save file
    const loadResult = await STORE.loadFromFile();

    if (loadResult === 'loaded') {
      // Great — data loaded from file, proceed normally

    } else if (loadResult === 'no_config' || loadResult === 'file_missing') {
      // No save file configured on this computer yet — show welcome screen
      // Seed localStorage so there's something to save
      STORE.init();
      await this._showWelcome(loadResult);
      return; // welcome flow calls location.reload() on confirm, which re-runs init() → _boot()

    } else {
      // Server offline — fall back to localStorage silently
      STORE.init();
    }

    this._boot();
  },

  // Shared boot — wires up controls, renders first tab.
  // Called after data is ready (either from file, localStorage, or post-welcome).
  _boot() {
    // Pre-load pins so the dashboard widget and NPC card pin buttons are ready.
    if (typeof PinsManager !== 'undefined') PinsManager.load();
    if (typeof Notes !== 'undefined') Notes.load();
    if (typeof Notifications !== 'undefined') Notifications.startPolling();
    // Prompt for email if not set — deferred so the UI is fully ready
    setTimeout(() => this._promptEmailIfMissing(), 1500);
    // Wire nav tabs
    document.querySelectorAll('.nav-tab').forEach(btn => {
      if (btn.dataset.tab) btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Wire Fate dropdown
    const fateTrigger = document.getElementById('navFateBtn');
    const fateMenu    = document.getElementById('navFateMenu');
    if (fateTrigger && fateMenu) {
      fateTrigger.addEventListener('click', e => {
        e.stopPropagation();
        const opening = !fateMenu.classList.contains('open');
        fateMenu.classList.toggle('open');
        if (opening) document.getElementById('navRecordsMenu')?.classList.remove('open');
      });
      fateMenu.querySelectorAll('.nav-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          this.switchTab(item.dataset.tab);
          fateMenu.classList.remove('open');
        });
      });
      document.addEventListener('click', () => fateMenu.classList.remove('open'));
    }

    // Wire Records dropdown
    const recordsTrigger = document.getElementById('navRecordsBtn');
    const recordsMenu    = document.getElementById('navRecordsMenu');
    if (recordsTrigger && recordsMenu) {
      recordsTrigger.addEventListener('click', e => {
        e.stopPropagation();
        const opening = !recordsMenu.classList.contains('open');
        recordsMenu.classList.toggle('open');
        if (opening) document.getElementById('navFateMenu')?.classList.remove('open');
      });
      recordsMenu.querySelectorAll('.nav-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          this.switchTab(item.dataset.tab);
          recordsMenu.classList.remove('open');
        });
      });
      document.addEventListener('click', () => recordsMenu.classList.remove('open'));
    }

    // Wire Archive dropdown
    const archiveTrigger = document.getElementById('hdrArchiveBtn');
    const archiveMenu    = document.getElementById('hdrArchiveMenu');
    if (archiveTrigger && archiveMenu) {
      archiveTrigger.addEventListener('click', e => {
        e.stopPropagation();
        archiveMenu.classList.toggle('open');
      });
      document.addEventListener('click', () => archiveMenu.classList.remove('open'));
    }

    // Year controls
    document.getElementById('currentYear').textContent = STORE.year;
    document.getElementById('yearUp').addEventListener('click', () => {
      STORE.setYear(STORE.year + 1);
      document.getElementById('currentYear').textContent = STORE.year;
      document.title = `Pendragon GM's Binder — ${STORE.year} AD`;
      this.refreshCurrentTab();
    });
    document.getElementById('yearDown').addEventListener('click', () => {
      if (STORE.year <= 1) return;
      STORE.setYear(STORE.year - 1);
      document.getElementById('currentYear').textContent = STORE.year;
      document.title = `Pendragon GM's Binder — ${STORE.year} AD`;
      this.refreshCurrentTab();
    });

    // Export
    document.getElementById('btnExport').addEventListener('click', () => {
      const json = STORE.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      const date = new Date().toISOString().slice(0,10).replace(/-/g,'');
      a.href = url; a.download = `pendragon_binder_${date}.json`; a.click();
      URL.revokeObjectURL(url);
      Toast.success('Exported');
    });

    // Import
    document.getElementById('btnImport').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json';
      input.onchange = e => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async ev => {
          if (STORE.importJSON(ev.target.result)) {
            Toast.success('Imported — saving…');
            // Push imported data to the server file so reload loads the right data
            await STORE.syncToFile().catch(() => {});
            setTimeout(() => location.reload(), 400);
          } else { Toast.error('Import failed — invalid file'); }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    // "Change Save File" link in sync status — GM only
    if (this.currentUser?.role === 'gm') {
      document.getElementById('syncStatus')?.addEventListener('dblclick', () => {
        this._showFilePicker('change');
      });
      document.getElementById('syncStatus').title = 'Double-click to change save file';
    }

    // Patch notes button — keep label in sync with APP_VERSION constant
    const patchBtn = document.getElementById('btnPatchNotes');
    if (patchBtn) {
      patchBtn.textContent = 'v' + APP_VERSION;
      patchBtn.addEventListener('click', () => { this.showPatchNotes(); });
    }

    // Features guide button
    document.getElementById('btnFeatures')?.addEventListener('click', () => { this.showFeatures(); });

    // AI key button — reflect saved key state on load
    const aiKeyBtn = document.getElementById('btnApiKey');
    if (aiKeyBtn) {
      aiKeyBtn.addEventListener('click', () => { this.showApiKeySettings(); });
      fetch('/api/config').then(r => r.json()).then(cfg => {
        if (cfg.hasApiKey) aiKeyBtn.classList.add('key-set');
      }).catch(() => {});
    }

    document.getElementById('btnUsers')?.addEventListener('click', () => this._openUserMgmt());

    document.title = isGM()
      ? `Pendragon GM's Binder — ${STORE.year} AD`
      : `Pendragon Binder — ${STORE.year} AD`;
    STORE.startPeriodicSync();

    // Multiplayer: broadcasts, presence, heartbeat
    Multiplayer.init();

    // Best-effort flush on page close — sendBeacon fires even during unload.
    // GM only: players are read-only and /api/save is @gm_required server-side.
    window.addEventListener('beforeunload', () => {
      if (isGM() && STORE._dirty) {
        try {
          navigator.sendBeacon('/api/save', new Blob([STORE.exportJSON()], { type: 'application/json' }));
        } catch(e) {}
      }
    });

    this._applyRoleRestrictions();
    this.switchTab('dashboard');
  },

  // ── ROLE-BASED UI ───────────────────────────────────────────
  _applyRoleRestrictions() {
    const user = this.currentUser;

    // Inject user display + account/logout links into header
    const headerRight = document.querySelector('.header-right');
    if (headerRight && user) {
      const userEl = document.createElement('div');
      userEl.className = 'header-user';
      userEl.innerHTML =
        `<span class="header-username">${user.username}</span>` +
        `<a href="/account" class="hdr-btn hdr-btn-outline" title="Change passphrase">🗝</a>` +
        `<a href="/logout"  class="hdr-btn hdr-btn-outline" title="Sign out">Sign out</a>`;
      headerRight.prepend(userEl);
    }

    if (!user || user.role === 'gm') return;

    // CSS class already set server-side (html.is-player) — hides GM-only elements
    // and shows the read-only banner with no flash.

    // Start auto-refresh so players see GM changes without manual reload
    this._startPlayerRefresh();
  },

  _startPlayerRefresh() {
    setInterval(async () => {
      const result = await STORE.loadFromFile();
      if (result === 'loaded') this.refreshCurrentTab();
    }, 30 * 1000);
  },

  // ── WELCOME SCREEN ──────────────────────────────────────────
  async _showWelcome(reason) {
    const main = document.getElementById('app');
    const reasonMsg = reason === 'file_missing'
      ? '<div style="background:rgba(122,28,28,0.1);border:1px solid rgba(122,28,28,0.3);border-radius:4px;padding:10px 14px;margin-bottom:20px;font-size:0.9rem;color:var(--crimson-mid);">⚠ The previous save file could not be found at its saved location.<br>Please locate it or create a new one.</div>'
      : '';

    main.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--ink);background-image:radial-gradient(ellipse at 20% 50%,#2a1a08 0%,#0f0a04 100%);">
        <div style="background:var(--vellum);border:2px solid var(--gold);border-radius:12px;padding:48px 52px;max-width:520px;width:90%;box-shadow:0 24px 64px rgba(0,0,0,0.6);text-align:center;">
          <div style="font-family:var(--font-display);font-size:1.6rem;color:var(--ink);margin-bottom:6px;">Pendragon</div>
          <div style="font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.35em;text-transform:uppercase;color:var(--gold);margin-bottom:32px;">GM's Binder</div>

          ${reasonMsg}

          <div style="font-family:var(--font-heading);font-size:0.62rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:20px;opacity:0.7;">Choose how to proceed</div>

          <div style="display:flex;flex-direction:column;gap:12px;">
            <button class="btn btn-primary" style="padding:14px;font-size:0.7rem;letter-spacing:0.15em;" onclick="APP._showFilePicker('open')">
              📂 &nbsp; Open Existing Save File
              <div style="font-family:var(--font-body);font-size:0.78rem;font-weight:normal;letter-spacing:0;text-transform:none;margin-top:4px;opacity:0.8;">Load your binder-save.json from Google Drive or anywhere else</div>
            </button>
            <button class="btn btn-verdigris" style="padding:14px;font-size:0.7rem;letter-spacing:0.15em;" onclick="APP._showFilePicker('new')">
              ✦ &nbsp; Create New Save File
              <div style="font-family:var(--font-body);font-size:0.78rem;font-weight:normal;letter-spacing:0;text-transform:none;margin-top:4px;opacity:0.8;">Start fresh or save your current data to a new location</div>
            </button>
          </div>

          <div style="margin-top:24px;font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.12em;color:var(--ink-soft);opacity:0.45;text-transform:uppercase;">Your data is safe in this browser until you choose</div>
        </div>
      </div>`;
  },

  // ── FILE PICKER ─────────────────────────────────────────────
  async _showFilePicker(mode) {
    // mode: 'open' | 'new' | 'change'
    const title = mode === 'new'    ? 'Create New Save File'
                : mode === 'change' ? 'Change Save File'
                :                    'Open Existing Save File';

    // Fetch initial browse listing and drive list in parallel
    let browseData, drivesData;
    try {
      const [br, dr] = await Promise.all([
        fetch('/api/browse').then(r => r.json()),
        fetch('/api/drives').then(r => r.json()).catch(() => ({ base_dir: '', drives: [] })),
      ]);
      browseData = br;
      drivesData = dr;
    } catch(e) {
      Toast.error('Cannot browse — is the server running?');
      return;
    }

    const renderEntries = (data) => {
      const list = document.getElementById('fpList');
      if (!list) return;
      document.getElementById('fpCurrentPath').textContent = data.current;
      // Escape a filesystem path for embedding inside a single-quoted JS string
      // inside a double-quoted HTML attribute. Covers \, ', ", <, > to prevent
      // malformed directory names from breaking out of the attribute.
      const escP = p => p.replace(/\\/g,'\\\\').replace(/'/g,"\\'")
                        .replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const escText = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      list.innerHTML = data.entries.map(e => {
        const isJson = e.type === 'file' && e.ext === '.json';
        const icon   = e.type === 'dir' ? '📁' : (isJson ? '📄' : '—');
        const style  = e.type === 'file' && !isJson ? 'opacity:0.4;pointer-events:none;' : '';
        const click  = e.type === 'dir'
          ? `APP._fpNavigate('${escP(e.path)}')`
          : (isJson ? `APP._fpSelectFile('${escP(e.path)}')` : '');
        return `<div class="fp-entry" style="${style}" onclick="${click}">
          <span class="fp-icon">${icon}</span>
          <span class="fp-name">${escText(e.name)}</span>
        </div>`;
      }).join('') || '<div style="padding:12px;opacity:0.5;font-style:italic;">Empty folder</div>';
    };

    // Build shortcuts bar: Binder folder + detected drives
    const binderShortcut = drivesData.base_dir
      ? `<button class="fp-shortcut" title="${drivesData.base_dir}"
           onclick="APP._fpNavigate('${drivesData.base_dir.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')">
           📂 Binder Folder
         </button>` : '';
    const driveButtons = (drivesData.drives || []).map(d =>
      `<button class="fp-shortcut"
         onclick="APP._fpNavigate('${d.path.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')">
         💾 ${d.label}
       </button>`
    ).join('');

    APP._fpCurrentPath = browseData.current;

    Modal.open(`
      <div style="min-width:min(540px,92vw);">
        <div class="page-title" style="font-size:1rem;margin-bottom:12px;">${title}</div>

        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          ${binderShortcut}${driveButtons}
        </div>

        <div style="display:flex;gap:6px;margin-bottom:8px;align-items:center;">
          <input class="edit-input" id="fpGoTo" placeholder="Paste a path and press Enter…"
            style="flex:1;font-size:0.8rem;padding:5px 8px;"
            onkeydown="if(event.key==='Enter'){APP._fpNavigate(this.value.trim());}">
          <button class="btn btn-ghost" style="padding:5px 10px;font-size:0.7rem;white-space:nowrap;"
            onclick="APP._fpNavigate(document.getElementById('fpGoTo').value.trim())">Go</button>
        </div>

        <div style="font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--ink-soft);opacity:0.6;margin-bottom:3px;">Current Folder</div>
        <div id="fpCurrentPath" style="font-size:0.78rem;color:var(--ink-soft);margin-bottom:8px;padding:5px 8px;background:var(--vellum-mid);border-radius:4px;word-break:break-all;">${browseData.current}</div>
        <div id="fpList" style="height:260px;overflow-y:auto;border:1px solid var(--vellum-deep);border-radius:4px;background:var(--vellum);margin-bottom:12px;"></div>
        ${mode === 'new' ? `
          <div class="detail-field mb-12">
            <div class="detail-label">File name</div>
            <input class="edit-input" id="fpFilename" placeholder="binder-save.json" value="binder-save.json">
          </div>` : ''}
        <div style="font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--ink-soft);opacity:0.55;margin-bottom:6px;">Selected</div>
        <input class="edit-input" id="fpSelected" placeholder="${mode === 'new' ? 'Navigate to a folder, then confirm below' : 'Click a .json file above to select it'}" style="margin-bottom:14px;">
        <div class="btn-row">
          <button class="btn btn-primary" onclick="APP._fpConfirm('${mode}')">${mode === 'new' ? 'Create Here' : 'Open'}</button>
          <button class="btn btn-ghost" onclick="Modal.close()${mode !== 'change' ? ';APP._showWelcome(\"no_config\")' : ''}">Cancel</button>
        </div>
      </div>`, { wide: false });

    // Add CSS for file picker entries + shortcut buttons
    if (!document.getElementById('fpStyle')) {
      const s = document.createElement('style');
      s.id = 'fpStyle';
      s.textContent = [
        `.fp-entry{display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:pointer;border-bottom:1px solid var(--vellum-mid);transition:background 0.1s;font-size:0.9rem;}`,
        `.fp-entry:hover{background:var(--vellum-mid);}`,
        `.fp-icon{font-size:1rem;flex-shrink:0;}`,
        `.fp-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}`,
        `.fp-shortcut{font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.06em;padding:4px 10px;border:1px solid var(--vellum-deep);border-radius:4px;background:var(--vellum-mid);color:var(--ink-soft);cursor:pointer;white-space:nowrap;}`,
        `.fp-shortcut:hover{background:var(--vellum-dark);color:var(--ink);}`,
      ].join('');
      document.head.appendChild(s);
    }

    renderEntries(browseData);
  },

  _fpCurrentPath: '',

  async _fpNavigate(path) {
    this._fpCurrentPath = path;
    let data;
    try {
      const r = await fetch('/api/browse?path=' + encodeURIComponent(path));
      data = await r.json();
    } catch(e) { return; }

    const list = document.getElementById('fpList');
    const cur  = document.getElementById('fpCurrentPath');
    if (!list || !cur) return;

    cur.textContent = data.current;
    this._fpCurrentPath = data.current;

    // Clear the go-to input now that navigation succeeded
    const goTo = document.getElementById('fpGoTo');
    if (goTo) goTo.value = '';

    // Update selected field with folder path for new-file mode
    const sel = document.getElementById('fpSelected');
    const fname = document.getElementById('fpFilename');
    if (sel && fname) {
      sel.value = data.current + '\\' + (fname.value || 'binder-save.json');
    }

    const escP2 = p => p.replace(/\\/g,'\\\\').replace(/'/g,"\\'")
                        .replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const escText2 = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    list.innerHTML = data.entries.map(e => {
      const isJson = e.type === 'file' && e.ext === '.json';
      const icon   = e.type === 'dir' ? '📁' : (isJson ? '📄' : '—');
      const style  = e.type === 'file' && !isJson ? 'opacity:0.4;pointer-events:none;' : '';
      const click  = e.type === 'dir'
        ? `APP._fpNavigate('${escP2(e.path)}')`
        : (isJson ? `APP._fpSelectFile('${escP2(e.path)}')` : '');
      return `<div class="fp-entry" style="${style}" onclick="${click}">
        <span class="fp-icon">${icon}</span>
        <span class="fp-name">${escText2(e.name)}</span>
      </div>`;
    }).join('') || '<div style="padding:12px;opacity:0.5;font-style:italic;">Empty folder</div>';
  },

  _fpSelectFile(path) {
    const sel = document.getElementById('fpSelected');
    if (sel) sel.value = path;
  },

  async _fpConfirm(mode) {
    const sel   = document.getElementById('fpSelected')?.value?.trim();
    const fname = document.getElementById('fpFilename')?.value?.trim() || 'binder-save.json';

    let finalPath = sel;
    if (mode === 'new' && !sel) {
      finalPath = this._fpCurrentPath + '\\' + fname;
    } else if (mode === 'new' && sel && !sel.endsWith('.json')) {
      finalPath = sel + '\\' + fname;
    }

    if (!finalPath) { Toast.error('Please select a location'); return; }

    Modal.close();

    if (mode === 'new') {
      // Create new file, seed with current data
      FileSync.setStatus('saving');
      try {
        const res = await fetch('/api/new', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ saveFile: finalPath }),
        });
        if (!res.ok) throw new Error();
        // Now write actual current data to it
        await STORE.saveToNewFile(finalPath);
        Toast.success('Save file created!');
      } catch(e) {
        Toast.error('Could not create file — check the path');
        return;
      }
    } else {
      // Open existing — set config then reload
      try {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ saveFile: finalPath }),
        });
        if (!res.ok) throw new Error();
      } catch(e) {
        Toast.error('Could not set save file');
        return;
      }
    }

    // Reload to apply
    Toast.success('Save file set — loading…');
    setTimeout(() => location.reload(), 800);
  },

  switchTab(name) {
    this._currentTab = name;

    // Update nav
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === name);
    });
    // Fate dropdown button: active when winter or mausoleum is showing
    const fateBtn = document.getElementById('navFateBtn');
    if (fateBtn) fateBtn.classList.toggle('active', name === 'winter' || name === 'mausoleum');
    // Records dropdown button: active when chronicle or journal is showing
    const recordsBtn = document.getElementById('navRecordsBtn');
    if (recordsBtn) recordsBtn.classList.toggle('active', name === 'chronicle' || name === 'journal');
    // Close dropdowns on any tab switch
    const fateMenu = document.getElementById('navFateMenu');
    if (fateMenu) fateMenu.classList.remove('open');
    const recordsMenu = document.getElementById('navRecordsMenu');
    if (recordsMenu) recordsMenu.classList.remove('open');

    // Show/hide panels
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === 'tab-' + name);
    });

    // Render the tab
    this._renderTab(name);
  },

  _renderTab(name) {
    switch (name) {
      case 'dashboard':  TabDashboard.render();  break;
      case 'roster':     TabRoster.render();     break;
      case 'manors':     TabManors.render();     break;
      case 'families':   TabFamilies.render();   break;
      case 'winter':     TabWinter.render();     break;
      case 'mausoleum':  TabMausoleum.render();   break;
      case 'chronicle':  TabChronicle.render();   break;
      case 'journal':    if (typeof TabJournal !== 'undefined') TabJournal.render(); break;
    }
  },

  refreshCurrentTab() {
    this._renderTab(this._currentTab);
  },

  // ── PATCH NOTES ───────────────────────────────────────────
  showPatchNotes() {
    const sectionsHtml = (sections) => sections.map(s => `
      <div style="margin-bottom:16px;">
        <div style="font-family:var(--font-heading);font-size:0.58rem;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);margin-bottom:8px;">${s.heading}</div>
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:5px;">
          ${s.items.map(i => `<li style="font-size:0.88rem;color:var(--ink-soft);">${i}</li>`).join('')}
        </ul>
      </div>`).join('');

    const notesHtml = PATCH_NOTES.map(n => `
      <div style="margin-bottom:28px;">
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--vellum-deep);">
          <span style="font-family:var(--font-display);font-size:1rem;color:var(--ink);">v${n.version}</span>
          <span style="font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--ink-soft);opacity:0.5;">${n.date}</span>
        </div>
        ${sectionsHtml(n.sections)}
      </div>`).join('');

    Modal.open(`
      <div style="min-width:min(580px,90vw);max-height:75vh;overflow-y:auto;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
          <div class="page-title" style="font-size:1rem;margin:0;">Pendragon GM's Binder</div>
          <span style="font-family:var(--font-heading);font-size:0.55rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold);background:rgba(184,134,11,0.1);border:1px solid rgba(184,134,11,0.3);padding:2px 8px;border-radius:20px;">v${APP_VERSION}</span>
        </div>
        ${notesHtml}
        <div class="btn-row" style="margin-top:8px;">
          <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        </div>
      </div>`);
  },

  // ── FEATURES GUIDE ────────────────────────────────────────
  showFeatures() {
    // For players, only show entries up to (but not including) the GM divider
    let featureList = FEATURES;
    if (!isGM()) {
      const gmDividerIdx = FEATURES.findIndex(f => f.divider && f.label && f.label.includes('GM Feature'));
      if (gmDividerIdx !== -1) featureList = FEATURES.slice(0, gmDividerIdx);
    }
    const featuresHtml = featureList.map(f => {
      if (f.divider) return `
        <div style="display:flex;align-items:center;gap:12px;margin:28px 0 18px;">
          <div style="flex:1;height:1px;background:var(--gold);opacity:0.3;"></div>
          <div style="font-family:var(--font-heading);font-size:0.52rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--gold);white-space:nowrap;">${f.label}</div>
          <div style="flex:1;height:1px;background:var(--gold);opacity:0.3;"></div>
        </div>`;
      return `
        <div style="margin-bottom:28px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--vellum-deep);">
            <span style="font-size:1.1rem;">${f.icon}</span>
            <span style="font-family:var(--font-heading);font-size:0.8rem;font-weight:700;letter-spacing:0.06em;color:var(--ink);">${f.heading}</span>
          </div>
          <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;">
            ${f.items.map(i => `<li style="font-size:0.87rem;color:var(--ink-soft);line-height:1.55;">${i}</li>`).join('')}
          </ul>
        </div>`;
    }).join('');

    Modal.open(`
      <div style="min-width:min(620px,90vw);max-height:78vh;overflow-y:auto;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <div class="page-title" style="font-size:1rem;margin:0;">📖 Features Guide</div>
          <span style="font-family:var(--font-heading);font-size:0.55rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold);background:rgba(184,134,11,0.1);border:1px solid rgba(184,134,11,0.3);padding:2px 8px;border-radius:20px;">v${APP_VERSION}</span>
        </div>
        <p style="font-size:0.82rem;color:var(--ink-soft);margin-bottom:4px;line-height:1.6;">Your Player Knight section is at the top. Scroll down to see the full GM feature set.</p>
        ${featuresHtml}
        <div class="btn-row" style="margin-top:8px;">
          <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        </div>
      </div>`);
  },

  showApiKeySettings() {
    Modal.open(`
      <div style="min-width:min(420px,90vw);">
        <div class="page-title" style="font-size:1rem;margin-bottom:16px;">🔑 Anthropic API Key</div>
        <p style="font-size:0.83rem;color:var(--ink-soft);line-height:1.6;margin-bottom:18px;">
          Used to generate AI flavor text in the Solos tab. The key is stored in
          <code style="font-size:0.78rem;background:var(--vellum-deep);padding:1px 5px;border-radius:3px;">config.json</code>
          on your local machine and never leaves your network — all requests are proxied through the local server.
        </p>
        <label style="display:block;font-size:0.78rem;font-family:var(--font-heading);letter-spacing:0.06em;color:var(--ink-soft);margin-bottom:6px;">API KEY</label>
        <input id="apiKeyInput" type="password" placeholder="sk-ant-…"
          style="width:100%;box-sizing:border-box;padding:8px 10px;font-size:0.85rem;font-family:monospace;background:var(--vellum-deep);border:1px solid var(--vellum-mid);border-radius:4px;color:var(--ink);margin-bottom:6px;">
        <div style="font-size:0.72rem;color:var(--ink-soft);margin-bottom:18px;" id="apiKeyStatus">Loading…</div>
        <div class="btn-row">
          <button class="btn btn-ghost" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" onclick="APP.saveApiKey()">Save Key</button>
          <button class="btn btn-ghost" style="color:#c0392b;border-color:rgba(192,57,43,0.3);" onclick="APP.clearApiKey()">Clear Key</button>
        </div>
      </div>`);

    // Check current key status
    fetch('/api/config').then(r => r.json()).then(cfg => {
      const el = document.getElementById('apiKeyStatus');
      if (el) el.textContent = cfg.hasApiKey ? '✔ A key is currently saved.' : 'No key saved yet.';
    }).catch(() => {});
  },

  saveApiKey() {
    const val = (document.getElementById('apiKeyInput')?.value || '').trim();
    if (!val) { Toast.show('Enter a key first.', 'warning'); return; }
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anthropicKey: val }),
    }).then(r => {
      if (!r.ok) throw new Error('Server returned ' + r.status);
      return r.json();
    }).then(data => {
      if (!data.ok) throw new Error(data.error || 'Unknown error');
      document.getElementById('btnApiKey')?.classList.add('key-set');
      Toast.show('API key saved.', 'success');
      Modal.close();
    }).catch(e => Toast.show('Failed to save key: ' + e.message, 'error'));
  },

  clearApiKey() {
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anthropicKey: '' }),
    }).then(r => {
      if (!r.ok) throw new Error('Server returned ' + r.status);
      return r.json();
    }).then(() => {
      document.getElementById('btnApiKey')?.classList.remove('key-set');
      Toast.show('API key cleared.', 'success');
      Modal.close();
    }).catch(e => Toast.show('Failed to clear key: ' + e.message, 'error'));
  },

  // ── EMAIL PROMPT ───────────────────────────────────────────
  async _promptEmailIfMissing() {
    try {
      const r = await fetch('/api/me');
      if (!r.ok) return;
      const d = await r.json();
      if (d.hasEmail) return;
    } catch { return; }

    Modal.open(`
      <div style="max-width:360px;">
        <div class="page-title" style="font-size:1rem;margin-bottom:6px;">📧 Add Your Email</div>
        <div style="font-size:0.85rem;color:var(--ink-soft);margin-bottom:16px;line-height:1.5;">
          Add an email address so you can reset your passphrase if you ever get locked out.
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <input id="email-prompt-1" type="email" class="edit-input" placeholder="your@email.com" autocomplete="email">
          <input id="email-prompt-2" type="email" class="edit-input" placeholder="Confirm email" autocomplete="email">
          <div id="email-prompt-err" style="color:var(--crimson-mid);font-size:0.8rem;display:none;"></div>
        </div>
        <div class="btn-row" style="margin-top:14px;">
          <button class="btn btn-primary" onclick="APP._saveEmailPrompt()">Save Email</button>
          <button class="btn btn-ghost" onclick="Modal.close()">Skip for now</button>
        </div>
      </div>`);
  },

  async _saveEmailPrompt() {
    const e1 = document.getElementById('email-prompt-1')?.value.trim();
    const e2 = document.getElementById('email-prompt-2')?.value.trim();
    const errEl = document.getElementById('email-prompt-err');
    if (!e1 || !e1.includes('@')) { errEl.textContent = 'Enter a valid email.'; errEl.style.display='block'; return; }
    if (e1 !== e2) { errEl.textContent = 'Emails do not match.'; errEl.style.display='block'; return; }
    try {
      const r = await fetch('/api/me/email', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e1 }),
      });
      const d = await r.json();
      if (!r.ok) { errEl.textContent = d.error || 'Could not save email.'; errEl.style.display='block'; return; }
      Modal.close();
      Toast.success('Email saved — you can now use password reset.');
    } catch { errEl.textContent = 'Network error.'; errEl.style.display='block'; }
  },

  // ── USER MANAGEMENT ───────────────────────────────────────
  async _openUserMgmt() {
    let users;
    try {
      const r = await fetch('/api/users');
      if (!r.ok) throw new Error('Failed to load users');
      users = await r.json();
    } catch(e) {
      Toast.error('Could not load users');
      return;
    }
    Modal.open(this._buildUserMgmtHtml(users));
    this._wireUserMgmt();
  },

  async _refreshUserMgmt() {
    let users;
    try {
      const r = await fetch('/api/users');
      if (!r.ok) throw new Error();
      users = await r.json();
    } catch(e) {
      Toast.error('Could not refresh users');
      return;
    }
    const content = document.getElementById('modalContent');
    if (content) {
      content.innerHTML = this._buildUserMgmtHtml(users);
      this._wireUserMgmt();
    }
  },

  _buildUserMgmtHtml(users) {
    const manors = typeof STORE !== 'undefined' ? STORE.manorKeys() : [];
    const householdOpts = (selected) =>
      `<option value="">— none —</option>` +
      manors.map(k => `<option value="${esc(k)}" ${(selected||'').toLowerCase()===k.toLowerCase()?'selected':''}>${esc(k)}</option>`).join('');
    const fmtDate = ts => {
      if (!ts) return '<span style="color:var(--ink-soft);font-style:italic;">Never</span>';
      try {
        return new Date(ts).toLocaleString();
      } catch(e) { return ts; }
    };
    const roleBadge = role => role === 'gm'
      ? `<span style="background:rgba(184,134,11,0.15);border:1px solid rgba(184,134,11,0.4);color:var(--gold);border-radius:20px;padding:1px 8px;font-size:0.62rem;letter-spacing:0.1em;font-family:var(--font-heading);">GM</span>`
      : `<span style="background:rgba(60,100,180,0.12);border:1px solid rgba(60,100,180,0.3);color:#7090d0;border-radius:20px;padding:1px 8px;font-size:0.62rem;letter-spacing:0.1em;font-family:var(--font-heading);">Player</span>`;

    const inputSty = 'font-size:0.82rem;padding:3px 6px;';
    const rows = users.map(u => `
      <tr data-username="${esc(u.username)}" style="border-bottom:1px solid var(--vellum-deep);">
        <td style="padding:8px 6px;">
          <input class="edit-input um-field" data-username="${esc(u.username)}" data-field="username"
            value="${esc(u.username)}" style="width:110px;${inputSty}">
        </td>
        <td style="padding:8px 6px;">
          <select class="edit-select um-field" data-username="${esc(u.username)}" data-field="role"
            style="width:90px;${inputSty}">
            <option value="player" ${u.role === 'player' ? 'selected' : ''}>Player</option>
            <option value="gm"     ${u.role === 'gm'     ? 'selected' : ''}>GM</option>
          </select>
        </td>
        <td style="padding:8px 6px;">
          <select class="edit-select um-field" data-username="${esc(u.username)}" data-field="household"
            style="width:120px;${inputSty}">
            ${householdOpts(u.household)}
          </select>
        </td>
        <td style="padding:8px 6px;">
          <input class="edit-input um-field" data-username="${esc(u.username)}" data-field="email"
            value="${esc(u.email || '')}" placeholder="no email" style="width:150px;${inputSty}">
        </td>
        <td style="padding:8px 6px;font-size:0.78rem;color:var(--ink-soft);">${fmtDate(u.lastLogin)}</td>
        <td style="padding:8px 6px;">
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            <button class="btn btn-ghost um-save-row" data-username="${esc(u.username)}" style="padding:3px 10px;font-size:0.72rem;">Save</button>
            <button class="btn btn-ghost um-reset-pw" data-username="${esc(u.username)}" style="padding:3px 10px;font-size:0.72rem;">Reset PW</button>
            <button class="btn btn-danger um-delete" data-username="${esc(u.username)}" style="padding:3px 10px;font-size:0.72rem;">Remove</button>
          </div>
        </td>
      </tr>`).join('');

    return `
      <div style="min-width:min(760px,92vw);max-height:80vh;overflow-y:auto;">
        <div class="page-title" style="font-size:1rem;margin-bottom:4px;">👥 User Management</div>
        <div style="font-size:0.75rem;color:var(--ink-soft);font-style:italic;margin-bottom:16px;">Household and role changes take effect on the player's next login.</div>
        <div id="umInlineForm" style="display:none;padding:12px;background:var(--vellum-deep);border-radius:4px;margin-bottom:12px;"></div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid var(--vellum-mid);">
              <th style="padding:6px 8px;text-align:left;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.1em;color:var(--ink-soft);">USERNAME</th>
              <th style="padding:6px 8px;text-align:left;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.1em;color:var(--ink-soft);">ROLE</th>
              <th style="padding:6px 8px;text-align:left;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.1em;color:var(--ink-soft);">HOUSEHOLD</th>
              <th style="padding:6px 8px;text-align:left;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.1em;color:var(--ink-soft);">EMAIL</th>
              <th style="padding:6px 8px;text-align:left;font-family:var(--font-heading);font-size:0.6rem;letter-spacing:0.1em;color:var(--ink-soft);">LAST SEEN</th>
              <th style="padding:6px 8px;"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div style="margin-top:24px;padding-top:20px;border-top:1px solid var(--vellum-deep);">
          <div class="section-title" style="margin-bottom:14px;">Add User</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">
            <div>
              <div class="detail-label">Username</div>
              <input class="edit-input" id="umNewUser" placeholder="username" style="width:100%;">
            </div>
            <div>
              <div class="detail-label">Password</div>
              <input class="edit-input" id="umNewPw" type="password" placeholder="10+ chars" style="width:100%;">
            </div>
            <div>
              <div class="detail-label">Role</div>
              <select class="edit-select" id="umNewRole" style="width:100%;">
                <option value="player">Player</option>
                <option value="gm">GM</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
            <div>
              <div class="detail-label">Household (optional)</div>
              <select class="edit-select" id="umNewHousehold" style="width:100%;">
                ${householdOpts('')}
              </select>
            </div>
            <div>
              <div class="detail-label">Email (optional)</div>
              <input class="edit-input" id="umNewEmail" type="email" placeholder="user@example.com" style="width:100%;">
            </div>
          </div>
          <button class="btn btn-primary" id="umAddBtn" style="width:auto;padding:6px 20px;">Add User</button>
        </div>

        <div class="btn-row" style="margin-top:16px;">
          <button class="btn btn-ghost" onclick="Modal.close()">Close</button>
        </div>
      </div>`;
  },

  _wireUserMgmt() {
    // Save row (username, role, household, email all at once)
    document.querySelectorAll('.um-save-row').forEach(btn => {
      btn.addEventListener('click', async () => {
        const oldUname = btn.dataset.username;
        const get = field => document.querySelector(`.um-field[data-username="${oldUname}"][data-field="${field}"]`)?.value.trim() ?? '';
        const payload = { username: get('username'), role: get('role'), household: get('household'), email: get('email') };
        try {
          const r = await fetch(`/api/users/${encodeURIComponent(oldUname)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || 'Failed');
          Toast.success('User updated');
          this._refreshUserMgmt();
        } catch(e) { Toast.error(e.message || 'Could not save changes'); }
      });
    });

    // Reset password buttons
    document.querySelectorAll('.um-reset-pw').forEach(btn => {
      btn.addEventListener('click', () => {
        const uname = btn.dataset.username;
        const inlineDiv = document.getElementById('umInlineForm');
        if (!inlineDiv) return;
        inlineDiv.style.display = 'block';
        inlineDiv.innerHTML = `
          <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
            <div>
              <div class="detail-label">New password for <strong>${uname}</strong></div>
              <input class="edit-input" id="umPwField" type="password" placeholder="10+ chars" style="width:200px;">
            </div>
            <button class="btn btn-primary" id="umPwSaveBtn" style="padding:5px 16px;">Set Password</button>
            <button class="btn btn-ghost" onclick="document.getElementById('umInlineForm').style.display='none';" style="padding:5px 12px;">Cancel</button>
          </div>`;
        document.getElementById('umPwSaveBtn').addEventListener('click', async () => {
          const pw = (document.getElementById('umPwField')?.value || '').trim();
          if (pw.length < 10) { Toast.error('Password must be at least 10 characters'); return; }
          try {
            const r = await fetch(`/api/users/${encodeURIComponent(uname)}/reset-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: pw }),
            });
            const d = await r.json();
            if (!d.ok) throw new Error(d.error || 'Failed');
            Toast.success(`Password reset for ${uname}`);
            inlineDiv.style.display = 'none';
          } catch(e) { Toast.error(e.message || 'Could not reset password'); }
        });
      });
    });

    // Delete buttons
    document.querySelectorAll('.um-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uname = btn.dataset.username;
        if (!confirm(`Remove user "${uname}"? This cannot be undone.`)) return;
        try {
          const r = await fetch(`/api/users/${encodeURIComponent(uname)}`, { method: 'DELETE' });
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || 'Failed');
          Toast.success(`${uname} removed`);
          this._refreshUserMgmt();
        } catch(e) { Toast.error(e.message || 'Could not remove user'); }
      });
    });

    // Add user
    document.getElementById('umAddBtn')?.addEventListener('click', async () => {
      const username  = (document.getElementById('umNewUser')?.value || '').trim();
      const password  = (document.getElementById('umNewPw')?.value || '');
      const role      = document.getElementById('umNewRole')?.value || 'player';
      const household = (document.getElementById('umNewHousehold')?.value || '').trim();
      const email     = (document.getElementById('umNewEmail')?.value || '').trim();
      if (!username || !password) { Toast.error('Username and password are required'); return; }
      try {
        const r = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, role, household: household || null, email: email || null }),
        });
        const d = await r.json();
        if (!d.ok) throw new Error(d.error || 'Failed');
        Toast.success(`${username} added`);
        this._refreshUserMgmt();
      } catch(e) { Toast.error(e.message || 'Could not add user'); }
    });
  },

  // ── CROSS-TAB NAVIGATION ──────────────────────────────────
  goToManor(key) {
    Modal.close();
    this.switchTab('manors');
    setTimeout(() => TabManors.selectManor(key), 50);
  },

  goToNpc(id) {
    Modal.close();
    this.switchTab('roster');
    setTimeout(() => TabRoster.select(id), 50);
  },

  goToFamily(name) {
    Modal.close();
    this.switchTab('families');
    setTimeout(() => TabFamilies.selectHousehold(name), 50);
  },
};

// ── BOOT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => APP.init());

// ── IDLE SESSION WARNING ───────────────────────────────────────
// After 4 hours of no keyboard/mouse/touch activity, show a banner
// prompting the user to stay logged in. Clicking it hits /api/keep-alive
// to reset the server-side 24-hour session lifetime.
(function () {
  const IDLE_WARN_MS  = 4 * 60 * 60 * 1000;  // 4 hours
  const CHECK_EVERY   = 60 * 1000;             // check every minute

  let _lastActivity = Date.now();
  let _warnShown    = false;

  function _resetActivity() {
    _lastActivity = Date.now();
    if (_warnShown) {
      _warnShown = false;
      const el = document.getElementById('_idleBanner');
      if (el) el.remove();
    }
  }

  ['mousemove', 'keydown', 'click', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, _resetActivity, { passive: true }));

  function _showBanner() {
    if (document.getElementById('_idleBanner')) return;
    const el = document.createElement('div');
    el.id = '_idleBanner';
    el.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
      'background:var(--ink)', 'color:var(--vellum)', 'border:1px solid var(--gold)',
      'border-radius:var(--radius)', 'padding:14px 20px', 'z-index:9998',
      'font-family:var(--font-body)', 'font-size:0.95rem',
      'display:flex', 'align-items:center', 'gap:14px',
      'box-shadow:0 4px 24px rgba(0,0,0,0.55)',
    ].join(';');
    el.innerHTML = `
      <span>⏳ Still at the table? Your session will expire soon.</span>
      <button onclick="window._keepAlive()" style="
        background:var(--gold);color:var(--ink);border:none;
        border-radius:var(--radius);padding:7px 16px;cursor:pointer;
        font-family:var(--font-heading);font-size:0.7rem;
        letter-spacing:0.08em;font-weight:600;
      ">Stay Logged In</button>`;
    document.body.appendChild(el);
  }

  window._keepAlive = async function () {
    try {
      await fetch('/api/keep-alive', { method: 'POST' });
    } catch { /* silent */ }
    _resetActivity();
  };

  setInterval(() => {
    if (!_warnShown && Date.now() - _lastActivity >= IDLE_WARN_MS) {
      _warnShown = true;
      _showBanner();
    }
  }, CHECK_EVERY);
})();
