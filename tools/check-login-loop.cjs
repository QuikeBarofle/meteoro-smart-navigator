// Regression check: execute the real Service Worker HTML transform and all app
// scripts in a DOM. Run with jsdom available through NODE_PATH.
// --baseline loads the previous A&S module to prove the runaway is detected.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const baseline = process.argv.includes('--baseline');

(async function () {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  const context = vm.createContext({
    self: { addEventListener() {} },
    caches: { open: async () => ({ put: async () => {} }) },
    fetch: async () => new Response(html, { headers: { 'content-type': 'text/html' } }),
    Response, Headers
  });
  vm.runInContext(worker, context);
  const transformed = await (await context.injectNavigatorLayout('test')).text();
  const errors = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => {
    if (error.type === 'unhandled exception') errors.push(error.message);
  });
  const dom = new JSDOM(transformed, {
    url: 'https://quikebarofle.github.io/meteoro-smart-navigator/',
    runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: console
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  let callbacks = 0, runaway = false;
  const NativeObserver = w.MutationObserver;
  w.MutationObserver = class extends NativeObserver {
    constructor(callback) {
      super((records, observer) => {
        callbacks++;
        // Prevent the old bug from hanging the regression runner itself.
        if (callbacks > 40) { runaway = true; observer.disconnect(); return; }
        callback(records, observer);
      });
    }
  };
  try {
    for (const script of w.document.scripts) {
      let code = script.textContent;
      if (script.src) {
        const relative = new URL(script.src).pathname.replace('/meteoro-smart-navigator/', '');
        code = baseline && relative === 'assets/meteoro-as-v046.js'
          ? execFileSync('git', ['show', '3398f36:assets/meteoro-as-v046.js'], { cwd: root, encoding: 'utf8' })
          : fs.readFileSync(path.join(root, relative), 'utf8');
      }
      new vm.Script(code).runInContext(dom.getInternalVMContext());
    }
    await new Promise(resolve => setTimeout(resolve, 900));
    if (baseline) {
      assert.equal(runaway, true, 'Baseline must reproduce the runaway observer');
      process.stdout.write(JSON.stringify({ baseline: 'runaway reproduced', callbacks }) + '\n');
      return;
    }
    assert.equal(runaway, false, 'A&S observer must settle');
    assert.deepEqual(errors, [], 'No unhandled app errors');
    const d = w.document;
    const user = d.getElementById('adminLoginUser');
    user.focus();
    assert.equal(d.activeElement, user);
    user.value = 'ui-probe';
    d.getElementById('adminForgotPasswordBtn').click();
    await new Promise(resolve => setTimeout(resolve, 80));
    assert(d.getElementById('recoveryRequestGate').classList.contains('show'));
    assert.equal(d.activeElement.id, 'recoveryUsername');
    assert.equal(d.activeElement.value, 'ui-probe');
    d.getElementById('recoveryBackBtn').click();
    assert(!d.getElementById('authGate').classList.contains('hidden'));
    // Audit the actual transformed app, including state changes and stale selections.
    const assertFlorida = () => {
      w.analyze(); w.renderQuotes(); w.renderProducts('all'); w.renderPackages();
      for (const id of ['results','quoteGrid','productGrid','packageGrid','objectiveGrid']) {
        assert(!/accidente y enfermedad|a&s/i.test(d.getElementById(id).textContent), id + ' must exclude A&S');
        assert(d.getElementById(id).children.length > 0, id + ' must preserve other products');
      }
      w.simSelectedIds={'sig-as':true,'sig-acc':true};
      w.renderSimPolicySelector();
      assert(!w.simSelectedIds['sig-as'], 'Stale A&S simulation selection cleared');
      assert(w.simSelectedIds['sig-acc'], 'Other simulation selection preserved');
      assert(!/accidente y enfermedad/i.test(d.getElementById('simPolicyGrid').textContent));
      assert(w.productsById['sig-as'], 'Brochure product metadata preserved');
      w.renderDocs();
      assert(d.querySelector('[data-href*="Accident_Sickness"]'), 'Brochure link preserved');
    };
    assertFlorida();
    w.selectedIds={'sig-acc':true,'sig-as':true};
    const state=d.getElementById('state'); state.value='GA';
    state.dispatchEvent(new w.Event('change'));
    assert.equal(d.getElementById('stateTopSelect').value,'GA');
    assert.equal(w.productsById['sig-acc'].evaluate(w.getCase()).price,undefined);
    assert.equal(Object.keys(w.selectedIds).length,0);
    state.value='FL';state.dispatchEvent(new w.Event('change'));
    assertFlorida();
    await new Promise(resolve => setTimeout(resolve, 100));
    const settled = callbacks;
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(callbacks, settled, 'No observer loop while idle');
    assert.equal(runaway, false);
    assert.deepEqual(errors, []);
    process.stdout.write(JSON.stringify({ result: 'PASS', callbacks, loginFocus: true,
      recoveryOpenAndBack: true, floridaSalesAndSimulatorAudited: true, stateSwitchAudited: true, brochurePreserved: true, idleSettled: true }) + '\n');
  } finally { w.close(); }
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
