const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the normalization used by the public page, with no network or DB writes.
const file = path.join(__dirname, '../components/PublicHome.tsx');
const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const normalizeNode = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'chuanHoaThongBao');
const code = ts.transpileModule(normalizeNode.getText(source), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const normalize = vm.runInNewContext(code + '\nchuanHoaThongBao;');
const notice = { ma_thong_bao: 1, tieu_de: 'Thông báo', noi_dung: 'Nội dung', ngay_dang: '2026-11-26T10:00:00' };

test('Published SQL statuses survive the public list filter', () => {
  for (const status of ['da_dang', 1, '1']) {
    const row = normalize({ ...notice, trang_thai: status });
    assert.equal(row.trang_thai, 1);
    assert.equal(row.noi_dung, notice.noi_dung);
  }
});

test('Draft, missing and unexpected statuses stay hidden', () => {
  for (const status of ['nhap', 0, '0', undefined, null, '', 'invalid', true]) {
    assert.equal(normalize({ ...notice, trang_thai: status }).trang_thai, 0);
  }
});

test('Malformed API rows are discarded', () => {
  for (const row of [null, [], {}, { ...notice, ma_thong_bao: 'bad' }, { ...notice, tieu_de: null }]) {
    assert.equal(normalize(row), null);
  }
});
