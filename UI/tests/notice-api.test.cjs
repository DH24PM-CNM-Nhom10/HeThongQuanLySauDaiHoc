const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest } = require('next/server');

// Run the actual route handlers with an isolated SQL boundary, never the real DB.
process.env.AGU_SESSION_SECRET = 'notice-tests-session-secret-at-least-32-characters';
const root = path.resolve(__dirname, '..');
const cache = new Map();
let calls = [];
let results = [];
const db = { execute: async (sql, values) => {
  calls.push({ sql, values });
  assert.ok(results.length, 'Unexpected database query');
  return [results.shift()];
} };

function load(file) {
  file = path.resolve(file);
  if (file === path.join(root, 'lib/mysql.ts')) return { getDb: () => db };
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const localRequire = name => name.startsWith('.')
    ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name);
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, module, module.exports);
  return module.exports;
}
const collection = load(path.join(root, 'app/api/thong-bao/route.ts'));
const detail = load(path.join(root, 'app/api/thong-bao/[id]/route.ts'));
const auth = load(path.join(root, 'lib/agu-auth.ts'));
const draft = { tieu_de: 'Thông báo thử', noi_dung: 'Nội dung thử', ten_file: '', duong_dan_file: '', trang_thai: 'nhap' };
function request(method, suffix = '', body, role = 'admin', origin) {
  const headers = { 'Content-Type': 'application/json' };
  if (role) headers.cookie = `${auth.AGU_SESSION_COOKIE}=${auth.createAguSession({ role })}`;
  if (origin) headers.origin = origin;
  return new NextRequest('http://localhost:3000/api/thong-bao' + suffix, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const context = id => ({ params: Promise.resolve({ id }) });
function reset(...responses) { calls = []; results = responses; }

test('Guests and non-admin roles cannot read drafts or mutate notices', async () => {
  reset();
  for (const role of [null, 'student', 'teacher', 'training_office']) {
    assert.equal((await collection.GET(request('GET', '?admin=1', undefined, role))).status, 403);
    assert.equal((await collection.POST(request('POST', '', draft, role))).status, 403);
    assert.equal((await detail.PUT(request('PUT', '/1', draft, role), context('1'))).status, 403);
    assert.equal((await detail.DELETE(request('DELETE', '/1', undefined, role), context('1'))).status, 403);
  }
  assert.equal(calls.length, 0);
});

test('Public list filters published notices, admin list includes drafts and content', async () => {
  reset([{ ma_thong_bao: '1', ...draft }], [{ ma_thong_bao: '1', ...draft }]);
  assert.equal((await collection.GET(request('GET', '?limit=5', undefined, null))).status, 200);
  assert.match(calls[0].sql, /WHERE trang_thai = 'da_dang'/);
  assert.deepEqual(calls[0].values, [5]);
  const response = await collection.GET(request('GET', '?admin=1'));
  assert.doesNotMatch(calls[1].sql, /WHERE/);
  assert.equal((await response.json()).data[0].noi_dung, draft.noi_dung);
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('Admin can create, edit, publish and delete notices using parameterized SQL', async () => {
  reset({ insertId: 9 }, { affectedRows: 1 }, { affectedRows: 1 });
  assert.equal((await collection.POST(request('POST', '', draft))).status, 201);
  assert.match(calls[0].sql, /INSERT INTO thong_bao/);
  assert.equal(calls[0].values[4], 'nhap');
  assert.equal((await detail.PUT(request('PUT', '/9', { ...draft, trang_thai: 'da_dang' }), context('9'))).status, 200);
  assert.equal(calls[1].values[4], 'da_dang');
  assert.equal(calls[1].values[5], 9);
  assert.equal((await detail.DELETE(request('DELETE', '/9'), context('9'))).status, 200);
  assert.deepEqual(calls[2].values, [9]);
});

test('Invalid inputs, IDs, limits and foreign origins never query SQL', async () => {
  reset();
  for (const body of [null, {}, { ...draft, tieu_de: '' }, { ...draft, trang_thai: 'invalid' },
    { ...draft, ten_file: 'file', duong_dan_file: 'javascript:alert(1)' },
    { ...draft, ten_file: 'file', duong_dan_file: '//evil.example/file' }]) {
    assert.equal((await collection.POST(request('POST', '', body))).status, 400);
  }
  assert.equal((await collection.GET(request('GET', '?limit=0'))).status, 400);
  assert.equal((await detail.DELETE(request('DELETE', '/bad'), context('bad'))).status, 400);
  assert.equal((await collection.POST(request('POST', '', draft, 'admin', 'https://evil.example'))).status, 403);
  assert.equal(calls.length, 0);
});

test('Missing records return 404; saving unchanged content still succeeds', async () => {
  reset({ affectedRows: 0 }, [], { affectedRows: 0 }, { affectedRows: 0 }, [{ ma_thong_bao: 1 }]);
  assert.equal((await detail.PUT(request('PUT', '/1', draft), context('1'))).status, 404);
  assert.equal((await detail.DELETE(request('DELETE', '/1'), context('1'))).status, 404);
  assert.equal((await detail.PUT(request('PUT', '/1', draft), context('1'))).status, 200);
});

test('Verified training office can manage public notices but cannot use a forged office session', async () => {
 const original=global.fetch;
 const officeRequest=()=>new NextRequest('http://localhost:3000/api/thong-bao',{method:'POST',headers:{cookie:'agu_training_office_session=fixture','content-type':'application/json'},body:JSON.stringify(draft)});
 try {global.fetch=async()=>Response.json({user:{role:'training_office'}});reset({insertId:99});assert.equal((await collection.POST(officeRequest())).status,201);assert.equal(calls.length,1);
 global.fetch=async()=>Response.json({message:'Invalid'},{status:401});reset();assert.equal((await collection.POST(officeRequest())).status,403);assert.equal(calls.length,0);
 }finally{global.fetch=original;}
});
