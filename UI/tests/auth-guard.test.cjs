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
  assert.deepEqual(await destinations('/schedule', { role: 'training_office' }), ['/assignment']);
  assert.deepEqual(await destinations('/schedule', { role: 'teacher' }), ['/giang-vien/tra-cuu-diem']);
  assert.deepEqual(await destinations('/grades', { role: 'admin' }), ['/admin']);
});
