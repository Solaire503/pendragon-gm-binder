#!/usr/bin/env node
// Regenerate manor-ref.json (served to AI tools via /api/mcp/manor-reference)
// from the single source of truth, js/data/manor-tables.js.
// Run after editing the tables:  node scripts/gen-manor-ref.cjs
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js/data/manor-tables.js'), 'utf8');
const ManorRef = eval(src + ';ManorRef');            // functions (html) drop out of JSON
const out = path.join(root, 'manor-ref.json');
fs.writeFileSync(out, JSON.stringify(ManorRef, null, 1) + '\n');
console.log(`wrote ${out}: ${Object.keys(ManorRef).filter(k => typeof ManorRef[k] !== 'function').join(', ')}`);
