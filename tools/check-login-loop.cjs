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
    // Exercise repeated quote renders and all three existing plan selections.
    for (const value of ['0.5', '1', '2']) {
      d.getElementById('asQuantity').value = value;
      w.renderQuotes();
      await new Promise(resolve => setTimeout(resolve, 40));
      const select = d.querySelector('.quote-plan-control[data-field="asQuantity"]');
      assert(select, 'A&S plan control must still exist');
      assert.equal(select.value, value, 'Decoration must preserve plan selection');
      assert.deepEqual(Array.from(select.options, option => option.value), ['0.5', '1', '2']);
    }
    const settled = callbacks;
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(callbacks, settled, 'No observer loop while idle');
    assert.equal(runaway, false);
    assert.deepEqual(errors, []);
    process.stdout.write(JSON.stringify({ result: 'PASS', callbacks, loginFocus: true,
      recoveryOpenAndBack: true, allPlanSelectionsPreserved: true, idleSettled: true }) + '\n');
  } finally { w.close(); }
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
