const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest } = require('next/server');

process.env.AGU_SESSION_SECRET = 'bulk-delete-tests-secret-at-least-32-characters';
const root = path.resolve(__dirname, '..');
const cache = new Map();
let store;
let writes = 0;
let reads = 0;
function load(file) {
  file = path.resolve(file);
  if (file === path.join(root, 'lib/store.ts')) return {
    getStore: () => { reads++; return store; }, saveStoreToFile: () => { writes++; },
  };
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(
    name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name), module, module.exports,
  );
  return module.exports;
}
const clear = load(path.join(root, 'app/api/clear/route.ts')).POST;
const reset = load(path.join(root, 'app/api/reset/route.ts')).POST;
const auth = load(path.join(root, 'lib/agu-auth.ts'));
function request(body, role = 'admin', raw = false) {
  return new NextRequest('http://localhost:3000/api/clear', {
    method: 'POST', headers: {
      'content-type': 'application/json',
      ...(role ? { cookie: `${auth.AGU_SESSION_COOKIE}=${auth.createAguSession({ role })}` } : {}),
    }, body: raw ? body : JSON.stringify(body),
  });
}
function fixture(extra = {}) {
  store = { students: [{ maHocVien: 'S001' }], teachers: [{ id: 'T001' }], thesis: [], schedule: [], grades: [],
    assignments: [], teachingAssignments: [], teacherGrades: [], gradebooks: [], gradeHistory: [], studentHistory: [], ...extra };
  writes = 0; reads = 0;
}

test('Linked records block student/teacher deletion and reset without changing data', async () => {
  for (const key of ['thesis', 'schedule', 'assignments', 'teachingAssignments', 'teacherGrades', 'gradebooks']) {
    fixture({ [key]: [{ roster: [{ maHocVien: 'S001' }], scores: [] }] });
    const before = JSON.stringify(store);
    for (const entityKey of ['students', 'teachers']) {
      assert.equal((await clear(request({ entityKey }))).status, 409, key);
    }
    assert.equal((await reset(request({}))).status, 409, key);
    assert.equal(JSON.stringify(store), before);
    assert.equal(writes, 0);
  }
});

test('Explicit full clear refuses to erase gradebooks or historical evidence', async () => {
  for (const key of ['gradebooks', 'grades', 'gradeHistory', 'studentHistory']) {
    fixture({ [key]: [{ assignmentId: 'A001', scores: [] }] });
    const before = JSON.stringify(store);
    assert.equal((await clear(request({ all: true }))).status, 409);
    assert.equal(JSON.stringify(store), before);
    assert.equal(writes, 0);
  }
});

test('Malformed JSON, unknown entities and ambiguous scope cannot trigger a wipe', async () => {
  fixture();
  for (const body of [null, [], {}, { entityKey: '' }, { entityKey: 'gradebooks' }, { entityKey: '__proto__' }, { all: false }]) {
    assert.equal((await clear(request(body))).status, 400);
  }
  assert.equal((await clear(request('{', 'admin', true))).status, 400);
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});

test('Unlinked data can be cleared with the intended scope', async () => {
  fixture();
  assert.equal((await clear(request({ entityKey: 'students' }))).status, 200);
  assert.equal(store.students.length, 0);
  assert.equal(store.teachers.length, 1);
  assert.equal(writes, 1);
  fixture();
  assert.equal((await reset(request({}))).status, 200);
  assert.equal(store.students.length + store.teachers.length, 0);
  fixture();
  assert.equal((await clear(request({ all: true }))).status, 200);
  assert.ok(Object.values(store).every(rows => rows.length === 0));
});

test('Non-admin roles cannot perform either bulk operation', async () => {
  fixture();
  for (const role of [null, 'student', 'teacher', 'training_office']) {
    assert.equal((await clear(request({ all: true }, role))).status, 403);
    assert.equal((await reset(request({}, role))).status, 403);
  }
  assert.equal(reads, 0);
  assert.equal(writes, 0);
});
