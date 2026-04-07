/* ══════════════════════════════════════════════════════════════
   NPC STAT BLOCK TEMPLATES — Pendragon 6th Edition
   GM-only. Used to pre-fill NPC edit form fields.
══════════════════════════════════════════════════════════════ */

const STAT_BLOCK_TEMPLATES = [

  // ── KNIGHTS ───────────────────────────────────────────────

  { category:'Knights', name:'Unproven Knight', glory:'Award: 25', naturalAge:'Young',
    description:'A knight just starting out, not yet tested in battle.',
    stats:'SIZ 14 · DEX 11 · STR 11 · CON 14 · APP 2D6+3\nHP 28 · Knockdown 14 · Major Wound 14 · Unconscious 7\nMovement 16 · Armor 10+6 · Healing Rate 3\nArmor: Hauberk, aketon, nasal helm + kite shield\n\nWeapons:\nLance (Charge 13) — 6D6\nDagger (Brawling 10) — 2D6+4\nArming Sword (Sword 13) — 4D6\n\nHonor: 15',
    passions:'Traits: Valorous 15\nHomage/Fealty (Lord) 15',
    skills:'Awareness 7, Battle 10, Courtesy 10, First Aid 10, Horsemanship 13, Hunting 8, Recognize 7',
    magicalTalents:null },

  { category:'Knights', name:'Average Knight', glory:'Award: 25', naturalAge:'Prime',
    description:'A typical household or mercenary knight.',
    stats:'SIZ 14 · DEX 11 · STR 14 · CON 14 · APP 2D6+3\nHP 28 · Knockdown 14 · Major Wound 14 · Unconscious 7\nMovement 18 · Armor 10+6 · Healing Rate 3\nArmor: Hauberk, nasal helm, aketon + kite shield\n\nWeapons:\nLance (Charge 15) — 6D6\nDagger (Brawling 12) — 2D6+5\nArming Sword (Sword 15) — 5D6\n\nHonor: 13+1D3',
    passions:'Traits: Valorous 13+1D3\nHomage (Lord) 13+1D3',
    skills:'Awareness 9, Battle 10, Courtesy 10, First Aid 12, Horsemanship 15, Hunting 10, Recognize 9',
    magicalTalents:null },

  { category:'Knights', name:'Veteran Knight', glory:'Award: 50', naturalAge:'Veteran',
    description:"A household or mercenary knight of many years' service, with the scars to show.",
    stats:'SIZ 15 · DEX 11 · STR 15 · CON 15 · APP 2D6+3\nHP 30 · Knockdown 15 · Major Wound 15 · Unconscious 8\nMovement 18 · Armor 11+6 · Healing Rate 3\nArmor: Advanced hauberk, aketon, nasal helm + kite shield\n\nWeapons:\nLance (Charge 16) — 6D6\nDagger (Brawling 12) — 2D6+5\nMace (Hafted 12) — 5D6\nArming Sword (Sword 16) — 5D6\n\nHonor: 13+1D6',
    passions:'Traits: Valorous 14+1D6\nHomage/Fealty (Lord) 15',
    skills:'Awareness 10, Battle 11, Courtesy 11, First Aid 12, Horsemanship 16, Hunting 11, Recognize 10',
    magicalTalents:null },

  { category:'Knights', name:'Respected Knight', glory:'Award: 50', naturalAge:'Prime',
    description:'A knight who has made a name for themselves in their home county.',
    stats:'SIZ 14 · DEX 11 · STR 14 · CON 15 · APP 2D6+4\nHP 29 · Knockdown 14 · Major Wound 15 · Unconscious 7\nMovement 18 · Armor 10+6 · Healing Rate 3\nArmor: Hauberk, aketon, nasal helm + kite shield\n\nWeapons:\nLance (Charge 17) — 6D6\nDagger (Brawling 12) — 2D6+5\nArming Sword (Sword 17) — 5D6\n\nHonor: 13+1D6',
    passions:'Traits: Valorous 14+1D6\nHomage (Lord) 16',
    skills:'Awareness 10, Battle 12, Courtesy 13, First Aid 12, Horsemanship 17, Hunting 11, Recognize 10',
    magicalTalents:null },

  { category:'Knights', name:'Notable Knight', glory:'Award: 50', naturalAge:'Veteran',
    description:'A knight famed throughout the kingdom, either head of the household or a minor vassal.',
    stats:'SIZ 15 · DEX 11 · STR 14 · CON 15 · APP 2D6+4\nHP 30 · Knockdown 15 · Major Wound 15 · Unconscious 8\nMovement 18 · Armor 11+6 · Healing Rate 3\nArmor: Advanced hauberk, aketon, nasal helm + kite shield\n\nWeapons:\nLance (Charge 19) — 6D6\nSpear (Spear 14) — 5D6\nArming Sword (Sword 19) — 5D6\n\nHonor: 12+1D6',
    passions:'Traits: Valorous 14+1D6\nHomage (Lord) 16',
    skills:'Awareness 12, Battle 16, Courtesy 13, First Aid 12, Horsemanship 19, Hunting 10, Recognize 10',
    magicalTalents:null },

  { category:'Knights', name:'Renowned Knight', glory:'Award: 100', naturalAge:'Veteran',
    description:'A wealthy knight whose words and deeds are spoken of across the land.',
    stats:'SIZ 16 · DEX 13 · STR 14 · CON 15 · APP 2D6+4\nHP 31 · Knockdown 16 · Major Wound 15 · Unconscious 8\nMovement 19 · Armor 11+6 · Healing Rate 3\nArmor: Advanced hauberk, aketon, nasal helm + kite shield\n\nWeapons:\nLance (Charge 20+1) — 6D6\nAxe (Hafted 15) — 5D6\nArming Sword (Sword 20+1) — 5D6\n\nHonor: 14+1D3',
    passions:'Traits: Valorous 15+1D3\nDuty (Vassals) 15',
    skills:'Awareness 13, Battle 18, Courtesy 13, First Aid 13, Horsemanship 20+2, Hunting 13, Recognize 13',
    magicalTalents:null },

  { category:'Knights', name:'Extraordinary Knight', glory:'Award: 100', naturalAge:'Elder',
    description:"A knight beyond compare, close in the king's counsel.",
    stats:'SIZ 16 · DEX 14 · STR 16 · CON 18 · APP 2D6+5\nHP 34 · Knockdown 16 · Major Wound 18 · Unconscious 9\nMovement 20 · Armor 12+6 · Healing Rate 4\nArmor: Advanced hauberk, aketon, advanced nasal helm + kite shield\n\nWeapons:\nLance (Charge 20+2) — 6D6\nAxe (Hafted 18) — 5D6\nArming Sword (Sword 20+4) — 5D6\n\nHonor: 15+1D6',
    passions:'Traits: Valorous 15+1D6\nChivalry 8+1D6\nLoyalty (King Arthur) 12+1D6',
    skills:'Awareness 15, Battle 18, Courtesy 16, First Aid 15, Horsemanship 20+2, Hunting 15, Recognize 15; all other Weapon Skills at 10',
    magicalTalents:null },

  // ── NOBLES ────────────────────────────────────────────────

  { category:'Nobles', name:'Courtier', glory:'Total: 850', naturalAge:'Prime',
    description:'A non-knightly nobleman selected to serve a function at court.',
    stats:'SIZ 10 · DEX 13 · STR 10 · CON 15 · APP 2D6+8\nHP 25 · Knockdown 10 · Major Wound 15 · Unconscious 6\nMovement 17 · Armor 1 · Healing Rate 3\nArmor: Heavy clothing\n\nWeapons:\nDagger (Brawling 12) — 2D6+3\n\nHonor: 10+1D6',
    passions:'Traits: Prudent 13, Valorous 7\nLove (Family) 14, Loyalty (Lord) 13',
    skills:'Awareness 14, Courtesy 15, Flirting 12, Horsemanship 10, Intrigue 12, Literacy 10, Orate 12, Recognize 14, Religion (Any) 10, Siegecraft 8, Stewardship 9',
    magicalTalents:null },

  { category:'Nobles', name:'Lady', glory:'Total: 850', naturalAge:'Prime',
    description:'A married daughter, wife, or widow of a knight.',
    stats:'SIZ 10 · DEX 13 · STR 10 · CON 15 · APP 2D6+8\nHP 25 · Knockdown 10 · Major Wound 15 · Unconscious 6\nMovement 17 · Armor 0 · Healing Rate 3\nArmor: None\n\nWeapons:\nDagger (Brawling 10) — 2D6+3\n\nHonor: 12+1D6',
    passions:'Traits: Chaste 15, Prudent 14, Valorous 10\nHospitality 15, Love (Family or Spouse) 14, Loyalty (Lord) 13',
    skills:'Awareness 12, Chirurgery 14, Courtesy 15, Dancing 12, First Aid 15, Flirting 12, Horsemanship 10, Industry 14, Intrigue 14, Siegecraft 10, Stewardship 12',
    magicalTalents:null },

  { category:'Nobles', name:'Damsel', glory:'Total: 400', naturalAge:'Young',
    description:'An unmarried noblewoman over 21, often employed as handmaiden, nanny, or nurse.',
    stats:'SIZ 10 · DEX 13 · STR 10 · CON 15 · APP 2D6+8\nHP 25 · Knockdown 10 · Major Wound 15 · Unconscious 6\nMovement 17 · Armor 0 · Healing Rate 3\nArmor: None\n\nWeapons:\nDagger (Brawling 10) — 2D6+3\n\nHonor: 10+1D6',
    passions:'Traits: Chaste 14, Prudent 14, Valorous 6\nHospitality 13, Love (Family) 14, Loyalty (Lord) 15',
    skills:'Awareness 12, Chirurgery 13, Courtesy 14, Dancing 12, First Aid 15, Flirting 12, Horsemanship 10, Industry 13, Intrigue 14, Siegecraft 8, Stewardship 10',
    magicalTalents:null },

  { category:'Nobles', name:'Baron', glory:'Total: 2,000', naturalAge:'Prime',
    description:'A powerful noble commanding several manors and sworn knights.',
    stats:'SIZ 12 · DEX 12 · STR 12 · CON 14 · APP 2D6+6\nHP 26 · Knockdown 12 · Major Wound 14 · Unconscious 7\nMovement 17 · Armor 1 · Healing Rate 3\nArmor: Heavy clothing\n\nWeapons:\nDagger (Brawling 13) — 2D6+3\n\nHonor: 13+1D6',
    passions:'Traits: Prudent 14, Valorous 11\nLove (Family) 14, Loyalty (Liege) 15, Hospitality 14',
    skills:'Awareness 13, Courtesy 15, Horsemanship 13, Intrigue 15, Literacy 12, Orate 13, Recognize 14, Siegecraft 12, Stewardship 15',
    magicalTalents:null },

  { category:'Nobles', name:'Earl', glory:'Total: 5,000', naturalAge:'Veteran',
    description:'A great lord commanding a county, second only to the king.',
    stats:'SIZ 12 · DEX 12 · STR 12 · CON 14 · APP 2D6+6\nHP 26 · Knockdown 12 · Major Wound 14 · Unconscious 7\nMovement 17 · Armor 1 · Healing Rate 3\nArmor: Heavy clothing\n\nWeapons:\nDagger (Brawling 13) — 2D6+3\n\nHonor: 14+1D6',
    passions:'Traits: Prudent 15, Valorous 12\nLove (Family) 14, Loyalty (King) 16, Hospitality 15',
    skills:'Awareness 14, Courtesy 16, Horsemanship 14, Intrigue 16, Literacy 13, Orate 15, Recognize 15, Siegecraft 14, Stewardship 16',
    magicalTalents:null },

  { category:'Nobles', name:'Duke', glory:'Total: 10,000', naturalAge:'Veteran',
    description:'The highest rank of noble beneath the crown.',
    stats:'SIZ 13 · DEX 12 · STR 13 · CON 14 · APP 2D6+7\nHP 27 · Knockdown 13 · Major Wound 14 · Unconscious 7\nMovement 17 · Armor 1 · Healing Rate 3\nArmor: Fine clothing\n\nWeapons:\nDagger (Brawling 13) — 2D6+3\n\nHonor: 15+1D6',
    passions:'Traits: Prudent 15, Valorous 12\nLove (Family) 14, Loyalty (King) 16, Hospitality 16',
    skills:'Awareness 14, Courtesy 17, Horsemanship 14, Intrigue 17, Literacy 14, Orate 16, Recognize 16, Siegecraft 15, Stewardship 17',
    magicalTalents:null },

  // ── CLERGY ────────────────────────────────────────────────

  { category:'Clergy', name:'Bishop', glory:'—', naturalAge:'Elder',
    description:'A senior churchman of considerable authority and wealth.',
    stats:'SIZ 10 · DEX 11 · STR 9 · CON 10 · APP 9\nHP 23 · Knockdown 10 · Major Wound 10 · Unconscious 5\nMovement 15 · Armor 1 · Healing Rate 2\nArmor: Heavy clothing\n\nWeapons:\nPunch (Brawling 5) — 3\n\nHonor: —',
    passions:'Traits: Chaste 14, Forgiving 16, Merciful 18, Modest 14, Spiritual 18, Temperate 16, Valorous 10\nDevotion (God) 16, Loyalty (Archbishop) 15, Loyalty (Pope) 12',
    skills:'Chirurgery 10, Clerk (Latin) 16, Courtesy 16, First Aid 10, Folklore 12, Intrigue 14, Orate 16, Religion (Christian) 16',
    magicalTalents:null },

  { category:'Clergy', name:'Cloistered / Itinerant Clergy', glory:'—', naturalAge:'Prime',
    description:'A monk, nun, friar, or travelling clergyperson.',
    stats:'SIZ 10 · DEX 11 · STR 9 · CON 12 · APP 10\nHP 22 · Knockdown 10 · Major Wound 12 · Unconscious 6\nMovement 15 · Armor 0 · Healing Rate 2\nArmor: None\n\nWeapons:\nPunch (Brawling 6) — 3\n\nHonor: —',
    passions:'Traits: Chaste 16, Energetic 14, Generous 16, Forgiving 17, Merciful 16, Modest 16, Spiritual 16, Temperate 16, Valorous 12\nDevotion (God) 16',
    skills:'Chirurgery 12, Clerk (Latin) 14, Courtesy 14, First Aid 13, Folklore 13, Industry 13, Orate 10, Religion (Christian) 15',
    magicalTalents:null },

  // ── MAGICAL ───────────────────────────────────────────────

  { category:'Magical', name:'Witch', glory:'—', naturalAge:'Prime',
    description:'A peasant mystic, one of a coven.',
    stats:'SIZ 9 · DEX 11 · STR 9 · CON 9 · APP 6\nHP 18 · Knockdown 9 · Major Wound 9 · Unconscious 5\nMovement 15 · Armor 0 · Healing Rate 2\nArmor: None\n\nWeapons:\nDagger (Brawling 6) — 2D6+3\n\nHonor: —',
    passions:'Traits: Cowardly 14, Honest 14, Indulgent 15, Proud 15, Prudent 15, Spiritual 14, Suspicious 16\nDevotion (Goddess) 12, Loyalty (Coven) 10',
    skills:'Chirurgery 14, First Aid 14, Folklore 16',
    magicalTalents:'Divination 10, Enchantment 8, Glamour 6, Healing 12 (once per encounter)' },

  { category:'Magical', name:'Itinerant Bard', glory:'—', naturalAge:'Young',
    description:'Born with the Sight; perhaps one day to become a Druid.',
    stats:'SIZ 11 · DEX 12 · STR 9 · CON 11 · APP 10\nHP 22 · Knockdown 11 · Major Wound 11 · Unconscious 6\nMovement 16 · Armor 0 · Healing Rate 2\nArmor: None\n\nWeapons:\nDagger (Brawling 8) — 2D6+3\n\nHonor: —',
    passions:'Traits: Honest 15, Indulgent 16, Just 12, Lustful 16, Proud 16, Prudent 13, Spiritual 13, Suspicious 12\nDevotion (Deity) 15',
    skills:'Clerk (Latin) 10, Compose 16, First Aid 11, Folklore 13, Orate 16, Religion (Pagan) 11, Play Instrument (Any) 16, Singing 16',
    magicalTalents:'Enchantment 12' },

  { category:'Magical', name:'Clerk (Magician)', glory:'—', naturalAge:'Prime',
    description:'A mysterious magician living within a Christian setting.',
    stats:'SIZ 10 · DEX 11 · STR 9 · CON 10 · APP 9\nHP 20 · Knockdown 10 · Major Wound 10 · Unconscious 5\nMovement 15 · Armor 0 · Healing Rate 2\nArmor: None\n\nWeapons:\nDagger (Brawling 6) — 2D6+3\n\nHonor: —',
    passions:'Traits: Cowardly 14, Deceitful 16, Proud 15, Prudent 17, Selfish 15, Spiritual 16, Suspicious 16, Temperate 14',
    skills:'Chirurgery 12, Clerk (Latin) 16, First Aid 14, Religion (Christian) 14, Religion (Pagan) 10',
    magicalTalents:'Divination 13, Enchantment 13, Glamour 13, Healing 13 (twice per encounter)' },

  { category:'Magical', name:'Sorceress', glory:'Award: 500', naturalAge:'Prime',
    description:'Crafty noblewoman wielding long-forgotten secrets.',
    stats:'SIZ 9 · DEX 11 · STR 8 · CON 10 · APP 14\nHP 19 · Knockdown 9 · Major Wound 10 · Unconscious 5\nMovement 15 · Armor 0 · Healing Rate 2\nArmor: None\n\nWeapons:\nDagger (Brawling 6) — 2D6+3\n\nHonor: —',
    passions:'Traits: Arbitrary 14, Deceitful 16, Lustful 15, Proud 15, Prudent 17, Selfish 17, Spiritual 14, Suspicious 16',
    skills:'Chirurgery 14, Clerk (Latin) 16, First Aid 15, Religion (Christian) 12, Religion (Pagan) 9',
    magicalTalents:'Divination 13, Enchantment 13, Glamour 13, Healing 13 (twice per encounter)' },
];
