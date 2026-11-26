const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const XLSX = require('xlsx');
const { NextRequest } = require('next/server');
const { studentCohort, filterStudents, expectedGraduation } = require('../../shared/student-profile.cjs');
const root = path.resolve(__dirname, '..'), cache = new Map();
let store, writes;
process.env.AGU_SESSION_SECRET = 'student-management-tests-secret-at-least-32-characters';
function load(file) {
  if (file.endsWith('.cjs')) return require(file);
  file += '.ts';
  if (file === path.join(root, 'lib/store.ts')) return { getStore: () => store, saveStoreToFile: () => writes++ };
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : require(name), module, module.exports);
  return module.exports;
}
const entity = load(path.join(root, 'app/api/[entity]/route')), exportRoute = load(path.join(root, 'app/api/export/route'));
const auth = load(path.join(root, 'lib/agu-auth'));
const ctx = { params: Promise.resolve({ entity: 'students' }) };
function request(method, url, body, cookie) {
  return new NextRequest('http://localhost:3000' + url, { method, headers: { 'content-type': 'application/json', cookie: cookie || `${auth.AGU_SESSION_COOKIE}=${auth.createAguSession({ role: 'admin' })}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
function fixture() {
  store = { students: [
    { maHocVien: 'S1', hoTen: 'Học viên 1', lop: 'L1', maNganh: 'N1', tenNganh: 'Ngành 1', khoaHoc: 'K25', ngayNhapHoc: '2025-09-01', trangThai: 'Đang học' },
    { maHocVien: 'S2', hoTen: 'Học viên 2', lop: 'L1', maNganh: 'N1', tenNganh: 'Ngành 1', khoaHoc: 'K25', trangThai: 'Đã tốt nghiệp' },
    { maHocVien: 'S3', hoTen: 'Học viên 3', lop: 'L2', maNganh: 'N2', tenNganh: 'Ngành 2', khoaHoc: 'K24', trangThai: 'Đang học' },
  ], catalogs: [{ kind: 'major', code: 'N1', name: 'Ngành 1' }, { kind: 'class', code: 'L1', majorCode: 'N1' }, { kind: 'cohort', code: 'K25' }, { kind: 'study_mode', code: 'Chính quy' }], teachers: [], studentHistory: [], gradebooks: [], studentDocuments: [] }; writes = 0;
}
test('List pagination and Excel export apply the same major/cohort/status/search filters', async () => {
  fixture(); const query = 'major=N1&cohort=K25&status=studying&search=S1';
  const result = await (await entity.GET(request('GET', '/api/students?' + query), ctx)).json();
  assert.equal(result.pagination.total, 1); assert.equal(result.data[0].maHocVien, 'S1');
  const response = await exportRoute.GET(request('GET', '/api/export?entity=students&' + query));
  assert.equal(response.status, 200);
  const book = XLSX.read(Buffer.from(await response.arrayBuffer()), { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]]);
  assert.equal(rows.length, 1); assert.equal(rows[0]['Mã học viên'], 'S1'); assert.equal(rows[0]['Khóa đào tạo'], 'K25');
});
test('New personal and academic information is validated and recorded in history', async () => {
  fixture();
  const response = await entity.PUT(request('PUT', '/api/students', { maHocVien: 'S1', email: 'student@example.edu.vn', soDienThoai: '0901234567', diaChi: 'Địa chỉ', donViCongTac: 'Đơn vị', hinhThucDaoTao: 'Chính quy', thoiGianDaoTao: '24', ngayDuKienTotNghiep: '2027-09-01', ngayHetHan: '2029-09-01' }), ctx);
  assert.equal(response.status, 200); assert.equal(store.students[0].thoiGianDaoTao, '24'); assert.equal(writes, 1);
  assert.equal(store.studentHistory[0].action, 'update');
  assert.equal((await entity.PUT(request('PUT', '/api/students', { maHocVien: 'S1', thoiGianDaoTao: '-1' }), ctx)).status, 400);
  assert.equal((await entity.PUT(request('PUT', '/api/students', { maHocVien: 'S1', ngayHetHan: '2020-01-01' }), ctx)).status, 400);
});
test('Cohort inference and month-end graduation estimates preserve legacy data', () => {
  assert.equal(studentCohort({ ngayNhapHoc: '2018' }), '2018');
  assert.equal(studentCohort({ khoaHoc: 'K26', ngayNhapHoc: '2025-09-01' }), 'K26');
  assert.equal(expectedGraduation('2026-01-31', 1), '2026-02-28');
  assert.equal(expectedGraduation('2026-02-30', 24), '');
  assert.equal(filterStudents([{ maHocVien: 'S1', trangThai: 'Quá hạn' }], { status: 'overdue' }).length, 1);
});
test('Training office access is verified by the server and limited to authorized management operations', async () => {
  fixture(); const original = global.fetch;
  try {
    global.fetch = async () => Response.json({ user: { role: 'training_office' } });
    const cookie = 'agu_training_office_session=fixture';
    assert.equal((await entity.GET(request('GET', '/api/students', undefined, cookie), ctx)).status, 200);
    assert.equal((await exportRoute.GET(request('GET', '/api/export?entity=students', undefined, cookie))).status, 200);
    assert.equal((await entity.GET(request('GET', '/api/teachers', undefined, cookie), { params: Promise.resolve({ entity: 'teachers' }) })).status, 200);
    global.fetch = async () => Response.json({ message: 'Invalid session' }, { status: 401 });
    assert.equal((await entity.GET(request('GET', '/api/students', undefined, cookie), ctx)).status, 403);
  } finally { global.fetch = original; }
});

test('Thesis updates save only progress fields, validate dates and advisors, and reject stale edits', async () => {
  fixture();
  const route = load(path.join(root, 'app/api/students/thesis/route'));
  const { thesisValues } = require('../../shared/thesis-progress.cjs');
  store.teachers = [{ hoten: 'Giảng viên 1' }];
  const previous = thesisValues(store.students[0]);
  const send = (changes, before = previous, cookie) => route.PATCH(request('PATCH', '/api/students/thesis', { maHocVien: 'S1', changes, previous: before }, cookie));
  assert.equal((await send({ trangThai: 'Đã tốt nghiệp' })).status, 400);
  assert.equal((await send({ tenLuanVan: 'Đề tài', gvHuongDan1: 'Không có' })).status, 400);
  assert.equal((await send({ tenLuanVan: 'Đề tài', ngayQD: '2026-02-30' })).status, 400);
  assert.equal((await send({ tenLuanVan: 'Đề tài', ngayQD: '2026-12-01', ngayBaoVe: '2026-11-01' })).status, 400);
  assert.equal((await send({ tenLuanVan: 'Đề tài' }, previous, 'invalid=cookie')).status, 403);
  assert.equal(writes, 0);
  const response = await send({ tenLuanVan: 'Đề tài', gvHuongDan1: 'Giảng viên 1', ngayQD: '2026-11-01' });
  assert.equal(response.status, 200); assert.equal(writes, 1);
  assert.equal(store.students[0].tenLuanVan, 'Đề tài');
  assert.equal(store.students[0].trangThai, 'Đang học');
  assert.equal(store.students[1].tenLuanVan, undefined);
  assert.equal(store.studentHistory[0].action, 'update-thesis');
  assert.equal((await send({ tenLuanVan: 'Đề tài ghi đè' })).status, 409);
  assert.equal(writes, 1);
});
