/* ══════════════════════════════════════════════════════════════
   MANOR-TABLES.JS — Book of the Manor reference tables
   Transcribed from Steve's Book of the Manor screenshots
   (planning/Book of the Manor Photos/). Displayed as collapsible
   reference drawers on the Record New Year panel — reference only,
   nothing here is automated.
══════════════════════════════════════════════════════════════ */

const ManorRef = {

  // ── Table 4: Manorial Luck (roll 1d6, then 1d4 for season) ──
  luckPeriods: [
    { label: 'Uther, Anarchy & Boy King', from: 485, to: 518 },
    { label: 'Conquest & Romance',        from: 519, to: 539 },
    { label: 'Tournament',                from: 540, to: 553 },
    { label: 'Grail',                     from: 554, to: 557 },
    { label: 'Twilight',                  from: 558, to: 566 },
  ],
  luckRows: [
    { d6: 1, results: ['Calamity',  'Calamity',  'Calamity',  'Calamity',  'Calamity'] },
    { d6: 2, results: ['Calamity',  'Calamity',  'No result', 'Calamity',  'Calamity'] },
    { d6: 3, results: ['Calamity',  'No result', 'No result', 'Calamity',  'No result'] },
    { d6: 4, results: ['No result', 'No result', 'Benefit',   'No result', 'No result'] },
    { d6: 5, results: ['No result', 'Benefit',   'Benefit',   'Benefit',   'No result'] },
    { d6: 6, results: ['Benefit',   'Benefit',   'Benefit',   'Benefit',   'Benefit'] },
  ],

  // ── Manorial Benefit Table (d20) ────────────────────────────
  benefit: [
    { roll: '01–03', text: 'Liege Lord visits and gives gift of £2. Add to Treasury.' },
    { roll: '04',    text: 'Good hunting this year. Add +£1 to Treasury.' },
    { roll: '05',    text: 'Steward has an insight. Critical Success to Stewardship roll this year!' },
    { roll: '06',    text: 'A wandering faerie blesses the land. −2 to Fate.' },
    { roll: '07',    text: 'A magical bull wandered through, all cows had calves. +3 to Stewardship Skill.' },
    { roll: '08',    text: 'The peasants were all healthy this year. −3 to Fate.' },
    { roll: '09',    text: 'Great year for cabbage and turnips! +2 to Stewardship.' },
    { roll: '10',    text: 'Great year for pigs! +5 to Stewardship.' },
    { roll: '11',    text: 'Great year for cows! +4 to Stewardship.' },
    { roll: '12',    text: 'Great year for sheep! +3 to Stewardship.' },
    { roll: '13',    text: 'Wandering merchant offered half price on tapestries. Spend up to £4, and double it in Treasure value.' },
    { roll: '14–15', text: 'Excellent horse trained this year. You get a bonus horse. Roll 1d6: 01–03, add a Courser; 04–05, add a Charger; 06, add a Large Charger (stats same as Andalusian).' },
    { roll: '16',    text: 'Your Scarecrow really worked! All vermin scared away. −2 to Fate.' },
    { roll: '17–18', text: 'Builders owe you a favor. £2 free Improvements next year.' },
    { roll: '19',    text: 'Builders owe you a favor. £5 free Improvements next year.' },
    { roll: '20',    text: 'A new spring appeared near your fields. A Permanent −1 to Fate each year!' },
  ],

  // ── Manorial Calamity Table (d20) ───────────────────────────
  calamity: [
    { roll: '01–02', text: 'Liege Lord Visits. Cost: £6. Subtract now from Treasure, or this will be an Expense.' },
    { roll: '03',    text: 'Unusual dispute among your peasants. A Justice Event is required this year. Difficulty = 30 (!), success or failure doubles the normal result.' },
    { roll: '04',    text: 'Bandit raid! +1d6−1 to Fate.' },
    { roll: '05',    text: 'A hired steward died. The knight (or wife) must do the Stewardship.' },
    { roll: '06',    text: 'A wandering faerie cursed the land. +12 to Fate.' },
    { roll: '07',    text: 'Fabulous Animal raids! +6 to Fate. Go to the Property Destruction Table. Also roll 1d6: 01, Wyvern, Wyrm, or Hippogriffs; 02, Horde of Unseelie Faeries; 03, Gigantic Boar or Lion; 04, Huge Giant; 05–06, something unseen, unknown, and unthinkable.' },
    { roll: '08',    text: 'Pestilence struck the manor! +5 to Fate.' },
    { roll: '09–15', text: 'Property destroyed. Roll on Table 6: Property Destruction.' },
    { roll: '16',    text: 'Your most expensive Investment was destroyed in a fire!' },
    { roll: '17',    text: 'Disease struck the animals! +6 to Fate.' },
    { roll: '18–19', text: 'Member of retinue dies. Randomize and roll to determine who.' },
    { roll: '20',    text: 'Horrifying disease on the grain! +10 to Fate.' },
  ],

  // ── Table 5: Conflict Results (roll 1d6) ────────────────────
  conflictPeriods: [
    { label: 'King Uther',         from: 481, to: 495 },
    { label: 'Anarchy',            from: 496, to: 509 },
    { label: 'The Boy King',       from: 510, to: 518 },
    { label: 'Conquest & Romance', from: 519, to: 539 },
    { label: 'Tournament',         from: 540, to: 553 },
    { label: 'Grail Quest',        from: 554, to: 557 },
    { label: 'Twilight',           from: 558, to: 566 },
  ],
  conflictRows: [
    { d6: 1, results: ['No result', 'No result', 'No Result', 'No result', 'No result', 'No result', 'No result'] },
    { d6: 2, results: ['No result', 'Bandits',   'Bandits',   'No result', 'No result', 'Bandits',   'No result'] },
    { d6: 3, results: ['Bandits',   'Raided',    'Bandits',   'Bandits',   'No result', 'Raided',    'Bandits'] },
    { d6: 4, results: ['Bandits',   'Raided',    'Raided',    'Bandits',   'Bandits',   'Raided',    'Raided'] },
    { d6: 5, results: ['Raided',    'Pillaged',  'Pillaged',  'Bandits',   'Bandits',   'Pillaged',  'Raided'] },
    { d6: 6, results: ['Pillaged',  'Plundered', 'Pillaged',  'Raided',    'Raided',    'Plundered', 'Pillaged'] },
  ],
  conflictFate: [
    { type: 'Bandits',   dice: '+1d6−1', pd: null },
    { type: 'Raided',    dice: '+1d6+1', pd: 0 },
    { type: 'Pillaged',  dice: '+1d6+6', pd: 5 },
    { type: 'Plundered', dice: '+2d6+6', pd: 10 },
  ],

  // ── Table 6: Property Destruction (d20 + modifiers) ─────────
  destruction: [
    { roll: '01–05', text: 'No permanent damage',                                        hate: 'None' },
    { roll: '06',    text: 'One random Investment*',                                     hate: 'None' },
    { roll: '07',    text: '1d3 random Investments*',                                    hate: 'None' },
    { roll: '08',    text: '1 random Enhancement*',                                      hate: 'None' },
    { roll: '09–10', text: 'Mill',                                                       hate: '+2' },
    { roll: '11–12', text: "Cluster of Commoners' Houses",                               hate: '+1' },
    { roll: '13',    text: 'A field.†',                                                  hate: '+1' },
    { roll: '14',    text: '¼ of the village',                                           hate: '+3' },
    { roll: '15',    text: 'The Village Church',                                         hate: '+5' },
    { roll: '16',    text: 'Bakery',                                                     hate: '+3' },
    { roll: '17',    text: '1d6 Clusters of Houses, 1 field†',                           hate: '+4' },
    { roll: '18',    text: '1d3 Clusters of Houses, 1d2 fields†',                        hate: '+1/field' },
    { roll: '19',    text: '1d6 fields†',                                                hate: '+1/field' },
    { roll: '20',    text: 'Roll twice.',                                                hate: '—' },
    { roll: '21',    text: 'The Manor House',                                            hate: 'None' },
    { roll: '22',    text: 'The Manor House & Stable (½ of your horse herd)',            hate: 'None' },
    { roll: '23',    text: '1 Investment & 1 Enhancement',                               hate: 'None' },
    { roll: '24–25', text: '¼ of the village, 1d3 fields†',                              hate: '+6' },
    { roll: '26',    text: 'The Manor House & Stable (½ of your horse herd). Roll again.', hate: 'None' },
    { roll: '27',    text: '2 Investments & 2 Enhancements',                             hate: 'None' },
    { roll: '28',    text: 'Manor House, ¼ of the village, 1d3 fields†',                 hate: '+6' },
    { roll: '29–30', text: "Everything: hall, 2d6 Clusters of Houses, 1d3 fields†, 1d3 Investments, 1d3 Enhancements", hate: '+15' },
  ],
  destructionNotes: [
    '* If the required structure does not exist, then ignore the result. For instance, if 21 was rolled, but no Manor House existed, it is a "no result."',
    '† One field represents a loss of £1 income for the knight; of course, the field can be replanted next year.',
    'Property Destruction roll modifiers: Raided +0 · Pillaged +5 · Plundered +10 (reduced by Siege success / Knightly Presence).',
  ],

  // ── Care (Concern vs Hate) ──────────────────────────────────
  careLines: [
    'The landlord must attempt a roll of his Concern (my commoners) passion even if he is not present for the entire year.',
    'First, find the current modified Passion level: subtract the commoners\' Hate (landlord) from the knight\'s Concern (my commoners).',
    'Result greater than zero → roll an uncontested contest of Concern (my commoners).',
    'Result of zero → automatic Failure, but roll anyway to see if there is a 20, which is a Fumble.',
    'Result less than zero → each point below zero adds one point of Fumble chance (e.g. −3 means a Fumble on 17–20). Any other roll is a Failure.',
    'Critical: −10 to Fate · Success: −5 to Fate · Failure: no effect · Fumble: +5 to Fate. Record in the "Care" column.',
  ],

  // ── HTML renderer ───────────────────────────────────────────
  // year: highlights the campaign-period column that applies.
  // openSet: Set of drawer ids currently expanded (survives re-render).
  html(year, openSet) {
    const open = id => (openSet && openSet.has(id)) ? ' open' : '';

    const periodTable = (periods, rows) => {
      const activeCol = periods.findIndex(p => year >= p.from && year <= p.to);
      const hd = periods.map((p, i) =>
        `<th style="padding:3px 8px;font-size:0.62rem;${i===activeCol?'background:rgba(148,108,26,0.18);color:var(--gold-text);':''}">${p.label}<br><span style="opacity:0.6;">${p.from}–${p.to}</span></th>`).join('');
      const body = rows.map(r =>
        `<tr><td style="padding:3px 8px;text-align:center;font-weight:600;">${r.d6}</td>${r.results.map((c, i) => {
          const col = c === 'Calamity' || c === 'Plundered' ? 'var(--crimson-mid)'
                    : c === 'Benefit' ? 'var(--verdigris-mid)'
                    : c === 'Pillaged' ? 'var(--crimson-mid)'
                    : c.toLowerCase() === 'no result' ? 'var(--ink-soft)' : 'var(--ink)';
          return `<td style="padding:3px 8px;color:${col};${i===activeCol?'background:rgba(148,108,26,0.12);font-weight:600;':''}">${c}</td>`;
        }).join('')}</tr>`).join('');
      return `<div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:0.76rem;width:100%;">
        <thead><tr><th style="padding:3px 8px;font-size:0.62rem;">d6</th>${hd}</tr></thead><tbody>${body}</tbody></table></div>`;
    };

    const d20Table = (rows, hateCol) => `
      <div style="overflow-x:auto;"><table style="border-collapse:collapse;font-size:0.78rem;width:100%;">
        <thead><tr><th style="padding:3px 8px;text-align:left;font-size:0.62rem;">d20</th><th style="padding:3px 8px;text-align:left;font-size:0.62rem;">Result</th>${hateCol?'<th style="padding:3px 8px;text-align:left;font-size:0.62rem;">Hate</th>':''}</tr></thead>
        <tbody>${rows.map(r => `<tr style="border-top:1px solid var(--vellum-deep);"><td style="padding:3px 8px;white-space:nowrap;font-weight:600;vertical-align:top;">${r.roll}</td><td style="padding:3px 8px;">${r.text}</td>${hateCol?`<td style="padding:3px 8px;white-space:nowrap;vertical-align:top;">${r.hate}</td>`:''}</tr>`).join('')}</tbody>
      </table></div>`;

    const drawer = (id, title, inner) => `
      <details class="manor-ref-drawer" data-ref="${id}"${open(id)} style="background:var(--vellum-deep);border-radius:var(--radius);padding:6px 12px;margin-bottom:6px;">
        <summary style="cursor:pointer;font-family:var(--font-heading);font-size:0.5rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--gold-text);padding:4px 0;">${title}</summary>
        <div style="padding:6px 0 8px;">${inner}</div>
      </details>`;

    const fateList = this.conflictFate.map(f =>
      `<span style="margin-right:14px;white-space:nowrap;"><strong>${f.type}</strong> ${f.dice} Fate${f.pd !== null ? ` · PD +${f.pd}` : ''}</span>`).join('');

    return `
      <div class="section-title mb-6" style="margin-top:2px;">📖 Book of the Manor — Reference</div>
      ${drawer('luck', 'Table 4 — Manorial Luck (1d6, season 1d4)', periodTable(this.luckPeriods, this.luckRows))}
      ${drawer('benefit', 'Manorial Benefit (d20)', d20Table(this.benefit, false))}
      ${drawer('calamity', 'Manorial Calamity (d20)', d20Table(this.calamity, false))}
      ${drawer('conflict', 'Table 5 — Conflict Results (1d6)', periodTable(this.conflictPeriods, this.conflictRows) +
        `<div style="margin-top:8px;font-size:0.76rem;color:var(--ink-soft);">${fateList}</div>` +
        `<div style="margin-top:4px;font-size:0.72rem;color:var(--ink-soft);opacity:0.8;">Banditry and Dragon Raids are not protected by Knightly Presence or Fortified Manors, except through play.</div>`)}
      ${drawer('destruction', 'Table 6 — Property Destruction (d20 + modifiers)', d20Table(this.destruction, true) +
        this.destructionNotes.map(n => `<div style="margin-top:5px;font-size:0.72rem;color:var(--ink-soft);font-style:italic;">${n}</div>`).join(''))}
      ${drawer('care', 'Care — Concern (my commoners) vs Hate', this.careLines.map(l => `<div style="margin-bottom:4px;font-size:0.78rem;">${l}</div>`).join(''))}`;
  },
};
