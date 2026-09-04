// Run with: node tests/glory.test.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/components.js'), 'utf8');
const elements = {
  'ef-glory-mode': {value: 'na'},
  'ef-glory-renown': {value: 'Respected'},
  'ef-glory': {value: '0', checkValidity: () => true, focus() {}},
};
const sandbox = { document: {getElementById: id => elements[id]}, Toast: {error() {}} };
vm.createContext(sandbox);
vm.runInContext(source.slice(source.indexOf('const NPC_RENOWN'), source.indexOf('// ── NPC CARD HTML')), sandbox);
const {npcGloryMode: mode, npcGloryText: text, npcGloryEditor: editor, readNpcGloryEditor: read, syncNpcGloryEditor: sync} = sandbox;
const categories = ['Non-knight', 'Unproven', 'Veteran', 'Respected', 'Notable', 'Renowned', 'Illustrious', 'Extraordinary', 'Legendary'];
const ranges = ['0–999','1,000–2,999','3,000–3,999','4,000–5,999','6,000–7,999','8,000–11,999','12,000–15,999','16,000–31,999','32,000+'];
for (let i = 0; i < categories.length; i++) {
  assert.equal(mode(categories[i]), 'renown');
  assert.equal(text({glory: categories[i]}), `${categories[i]} · ${ranges[i]} Glory`);
  assert.ok(editor({glory: categories[i]}).includes(`value="${categories[i]}" selected`));
}
assert.equal(text({glory: 0}), '0 Glory');
assert.equal(text({glory: 4500}), '4,500 Glory');
assert.equal(text({glory: '4500'}), '4,500 Glory');
for (const glory of [null, undefined, true, false, [], {}, '  ', '', 'N/A', '<img src=x onerror=alert(1)>']) assert.equal(text({glory}), 'N/A');
assert.equal(read(), 'N/A');
elements['ef-glory-mode'].value = 'renown'; sync();
assert.equal(read(), 'Respected');
assert.equal(elements['ef-glory'].hidden, true);
assert.equal(elements['ef-glory-renown'].hidden, false);
elements['ef-glory-mode'].value = 'exact'; sync();
assert.equal(read(), 0);
assert.equal(elements['ef-glory'].hidden, false);
for (const value of ['', '-1', '1.5', 'nope', '9007199254740992']) {
  elements['ef-glory'].value = value; assert.equal(read(), null);
}
// Exercise the actual solo-resolution path: awards stay recorded without
// turning an untracked/category character into a numeric character.
const solos = fs.readFileSync(path.join(__dirname, '../js/tabs/solos.js'), 'utf8');
const method = solos.slice(solos.indexOf('  _resolveCard(cardId) {'), solos.indexOf('  _dismissCard(cardId) {'));
for (const glory of [0, 1500, 'N/A', ...categories]) {
  let update, event;
  sandbox.STORE = {getNpc: () => ({name: 'Test Knight', glory}), addSoloEvent: (id, value) => event = value, updateNpc: (id, value) => update = value};
  sandbox.Toast.show = () => {};
  const card = {state: 'fresh', knightId: 'test', mechDesc: 'Gain 50 Glory'};
  sandbox.card = card;
  vm.runInContext(`({${method} _getCard() { return card; }, _reRenderCard() {} })._resolveCard('test')`, sandbox);
  assert.equal(event.mechDesc, 'Gain 50 Glory');
  assert.equal(update?.glory, typeof glory === 'number' ? glory + 50 : undefined);
}
console.log('Glory UI, category ranges, input validation, and solo awards passed.');
