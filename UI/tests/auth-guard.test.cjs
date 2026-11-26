const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the component's verification effect without a browser or real accounts.
async function destinations(pathname, session) {
  const effects = [];
  const redirects = [];
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/auth/AuthGuard.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  const mocks = {
    react: { useEffect: fn => effects.push(fn), useState: initial => [initial, () => {}] },
    'next/navigation': { usePathname: () => pathname, useRouter: () => ({ replace: url => redirects.push(url) }) },
    '../../lib/session-client': { verifySession: async () => session },
  };
  const context = vm.createContext({ window: { addEventListener() {}, removeEventListener() {} } });
  const execute = vm.runInContext(`(function(require,module,exports){${code}\n})`, context);
  execute(name => mocks[name] || (name.startsWith('.') ? { default: () => null } : require(name)), module, module.exports);
  module.exports.default({ children: null });
  const cleanup = effects[0]();
  await new Promise(resolve => setImmediate(resolve));
  cleanup();
  return redirects;
}

test('Guests stay on public pages when opening a direct link', async () => {
  for (const route of ['/', '/home', '/login', '/thong-bao', '/gioi-thieu', '/lien-he', '/chuong-trinh-dao-tao']) {
    assert.deepEqual(await destinations(route, null), [], route);
  }
});

test('Guest access to protected pages still redirects to home', async () => {
  for (const route of ['/students', '/grades', '/assignment', '/doi-mat-khau', '/admin/diem']) {
    assert.deepEqual(await destinations(route, null), ['/'], route);
  }
  assert.deepEqual(await destinations('/admin', null), ['/']);
});

test('First login stays on public pages while role restrictions still apply', async () => {
  assert.deepEqual(await destinations('/thong-bao', { role: 'student', mustChangePassword: true }), []);
  assert.deepEqual(await destinations('/students', { role: 'student' }), ['/home']);
  assert.deepEqual(await destinations('/admin', { role: 'training_office' }), ['/assignment']);
  assert.deepEqual(await destinations('/login', { role: 'admin' }), ['/admin']);
  assert.deepEqual(await destinations('/lien-he', { role: 'student' }), []);
});

test('Admin can manage schedules while other role restrictions remain enforced', async () => {
  assert.deepEqual(await destinations('/schedule', { role: 'admin' }), []);
  assert.deepEqual(await destinations('/schedule', { role: 'student' }), []);
  assert.deepEqual(await destinations('/schedule', { role: 'training_office' }), []);
  assert.deepEqual(await destinations('/schedule', { role: 'teacher' }), ['/giang-vien/tra-cuu-diem']);
  assert.deepEqual(await destinations('/grades', { role: 'admin' }), ['/admin']);
});
test('Training office can manage student profiles, evidence and grade statistics', async () => {
  for (const route of ['/students', '/teachers', '/schedule', '/thesis', '/academic', '/phong-dao-tao/thong-bao', '/kiem-tra-van-bang', '/phong-dao-tao/thong-ke-diem']) assert.deepEqual(await destinations(route, { role: 'training_office' }), []);
  assert.deepEqual(await destinations('/kiem-tra-van-bang', { role: 'student' }), ['/home']);
  assert.deepEqual(await destinations('/admin/thong-ke-diem', { role: 'student' }), ['/home']);
});

function navigationHarness() {
  const state = [], pending = [], listeners = new Map(), redirects = [];
  let cursor = 0, pathname = '/admin', effect, cleanup;
  const router = { replace: url => redirects.push(url) };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/auth/AuthGuard.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  const mocks = {
    react: {
      useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; },
      useEffect(fn) { effect = fn; },
    },
    'next/navigation': { usePathname: () => pathname, useRouter: () => router },
    '../../lib/session-client': { verifySession: () => new Promise(resolve => pending.push(resolve)) },
  };
  const context = vm.createContext({ window: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) } });
  vm.runInContext(`(function(require,module,exports){${code}\n})`, context)(name => mocks[name] || (name.startsWith('.') ? { default: () => null } : require(name)), module, module.exports);
  const render = () => { cursor = 0; return module.exports.default({ children: 'page content' }); };
  return {
    pending, redirects,
    render,
    navigate(path) { pathname = path; cleanup?.(); render(); cleanup = effect(); return render(); },
    authChanged() { listeners.get('agu-auth-changed')(); return render(); },
    close() { cleanup?.(); },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const managementShell = tree => tree.props.className === 'app-layout management-layout';

test('Management shell stays mounted during navigation and background session verification', async () => {
  const h = navigationHarness();
  try {
    assert.equal(managementShell(h.navigate('/admin')), false);
    h.pending.shift()({ role: 'admin' }); await tick();
    assert.equal(managementShell(h.render()), true);
    assert.equal(managementShell(h.navigate('/students')), true, 'Sidebar must remain visible while verification is pending');
    assert.equal(managementShell(h.navigate('/teachers')), true);
    h.pending.shift()(null); await tick();
    assert.equal(managementShell(h.render()), true, 'Obsolete navigation response cannot unmount the current shell');
    h.pending.shift()({ role: 'admin' }); await tick();
    assert.equal(managementShell(h.render()), true);
    assert.deepEqual(h.redirects, []);
  } finally { h.close(); }
});

test('Logout and expired sessions still remove protected content and redirect home', async () => {
  const h = navigationHarness();
  try {
    h.navigate('/students'); h.pending.shift()({ role: 'admin' }); await tick();
    assert.equal(managementShell(h.render()), true);
    assert.equal(managementShell(h.authChanged()), false, 'Account changes immediately hide protected content');
    h.pending.shift()(null); await tick();
    assert.equal(managementShell(h.render()), false);
    assert.deepEqual(h.redirects, ['/']);
  } finally { h.close(); }
});
