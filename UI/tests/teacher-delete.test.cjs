const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest } = require('next/server');
process.env.AGU_SESSION_SECRET = 'teacher-delete-tests-secret-at-least-32-characters';
const root = path.resolve(__dirname, '..');
let store;
let writes = 0;
const cache = new Map();
function load(file) {
  if (file.endsWith('.cjs')) return require(file);
  file += '.ts';
  if (file === path.join(root, 'lib/store.ts')) return { getStore: () => store, saveStoreToFile: () => writes++ };
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(
    name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : require(name), module, module.exports,
  );
  return module.exports;
}
const { DELETE } = load(path.join(root, 'app/api/[entity]/route'));
const auth = load(path.join(root, 'lib/agu-auth'));
const ctx = { params: Promise.resolve({ entity: 'teachers' }) };
function request(role = 'admin') {
  return new NextRequest('http://localhost:3000/api/teachers?id=GV001', {
    method: 'DELETE', headers: { cookie: `${auth.AGU_SESSION_COOKIE}=${auth.createAguSession({ role })}` },
  });
}
function fixture(extra = {}) {
  store = { teachers: [{ shcc: 'GV001', hoten: 'Giảng viên' }], gradebooks: [], ...extra };
  writes = 0;
}
test('The Next API refuses linked teacher deletion without saving', async () => {
  fixture({ teachingAssignments: [{ id: 'A1', teacherId: 'GV001' }] });
  assert.equal((await DELETE(request(), ctx)).status, 409);
  assert.equal(store.teachers.length, 1);
  assert.equal(writes, 0);
});
test('The Next API deletes an unlinked teacher and retains role checks', async () => {
  fixture();
  assert.equal((await DELETE(request('student'), ctx)).status, 403);
  assert.equal(writes, 0);
  assert.equal((await DELETE(request(), ctx)).status, 200);
  assert.equal(store.teachers.length, 0);
  assert.equal(writes, 1);
});
