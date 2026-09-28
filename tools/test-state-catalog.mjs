import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../assets/meteoro-state-catalog-v050.js', import.meta.url), 'utf8');

class Node {
  constructor(id = '') { this.id = id; this.value = ''; this.innerHTML = ''; this.textContent = ''; this.children = []; this.listeners = {}; this.style = {}; this.classList = { add(){}, remove(){}, toggle(){} }; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  dispatchEvent(event) { for (const fn of this.listeners[event.type] || []) fn.call(this, event); }
  appendChild(node) { this.children.push(node); return node; }
  insertAdjacentElement(_where, node) { this.children.push(node); return node; }
  setAttribute() {}
  querySelector(selector) { return selector === '.toolbar' ? this.children.find(x => x.className === 'toolbar') || null : null; }
  querySelectorAll() { return []; }
}

const elements = new Map();
for (const id of ['state','stateTopSelect','stateStatus','stateBrandLabel','asDeadline','asUnifiedNotice','simPanel','simPolicyGrid','familyFilter','quoteGrid','productGrid','packageGrid','objectiveGrid']) elements.set(id, new Node(id));
elements.get('state').value = 'FL';
elements.get('familyFilter').value = 'all';
const toolbar = new Node('toolbar'); toolbar.className = 'toolbar'; elements.get('simPanel').appendChild(toolbar);
const document = {
  readyState: 'complete',
  head: new Node('head'),
  body: new Node('body'),
  getElementById(id) { return elements.get(id) || null; },
  createElement() { return new Node(); },
  querySelector(selector) { return selector === '.version' ? new Node('version') : null; },
  querySelectorAll() { return []; },
  addEventListener() {}
};
const window = { document };
const as = {
  id: 'sig-as', name: 'Protector de Accidente y Enfermedad · Standard',
  evaluate() { return { status: 'ok', reason: 'base', price: 33.38 }; }
};
const accident = {
  id: 'sig-acc', name: 'Protector de Accidentes · Choice',
  evaluate() { return { status: 'ok', reason: 'base', price: 20 }; }
};
window.products = [as, accident];
window.productsById = { 'sig-as': as, 'ss-as': as, 'sig-acc': accident };
window.selectedIds = {};
window.simSelectedIds = {};
window.renderQuotes = () => {};
window.renderProducts = () => {};
window.renderPackages = () => {};
window.renderSimPolicySelector = () => {};
window.renderExistingSimQuote = () => {};
window.renderWellness = () => {};
window.renderCommission = () => {};
window.updateSimulatorVisibility = () => {};
window.logVisit = () => {};
window.simpleLayerAmount = () => ({ amount: 123, notes: [], pending: [] });

vm.runInNewContext(source, { window, document, console });

assert.equal(window.METEORO_STATE_CATALOG.stateCode(), 'FL');
assert.equal(window.METEORO_STATE_CATALOG.stateLabel('FL'), 'Florida');
assert.equal(window.METEORO_STATE_CATALOG.isSaleAvailable('sig-as', { state: 'FL' }), false);
assert.equal(window.METEORO_STATE_CATALOG.isSaleAvailable('sig-acc', { state: 'FL' }), true);
assert.equal(window.METEORO_STATE_CATALOG.stateInfo('GA').catalogStatus, 'pending');
assert.equal(as.evaluate({ state: 'FL' }).status, 'no');
assert.equal(as.simulationEvaluate({ state: 'FL' }).status, 'no');
assert.equal(window.simpleLayerAmount(as, {}).amount, 0);

const state = document.getElementById('state');
state.value = 'GA';
state.dispatchEvent({ type: 'change' });
assert.match(document.getElementById('stateStatus').innerHTML, /Georgia/);
assert.equal(as.evaluate({ state: 'GA' }).status, 'review');
assert.equal(as.simulationEvaluate({ state: 'GA' }).status, 'review');
assert.equal(window.simpleLayerAmount(as, {}).amount, 0);
assert.match(window.simpleLayerAmount(as, {}).notes[0], /No se aplican reglas de Florida/);

state.value = 'FL';
state.dispatchEvent({ type: 'change' });
assert.equal(as.evaluate({ state: 'FL' }).status, 'no');
assert.equal(as.simulationEvaluate({ state: 'FL' }).status, 'no');
assert.equal(window.simpleLayerAmount(as, {}).amount, 0);

console.log('state catalog tests passed');
