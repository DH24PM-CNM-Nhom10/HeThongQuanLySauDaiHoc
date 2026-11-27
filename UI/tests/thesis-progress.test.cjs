const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dateISO, thesisRow } = require('../../shared/thesis-progress.cjs');

test('Thesis dates validate Vietnamese, ISO and Excel formats without inventing deadlines', () => {
  assert.equal(dateISO('31/12/2026'), '2026-12-31');
  assert.equal(dateISO('2026-02-30'), '');
  assert.equal(dateISO('30/02/2026'), '');
  assert.equal(dateISO(25569 + 20000), new Date(20000 * 86400000).toISOString().slice(0,10));
  const row = thesisRow({ maHocVien: 'S1', ngayNhapHoc: '2020-01-01', trangThai: 'Đang học' }, '2026-11-26');
  assert.equal(row.deadline, ''); assert.equal(row.overdue, false); assert.equal(row.stage, 'unregistered');
});
test('Thesis stages retain defended and graduated students while future defense stays pending', () => {
  const row = { tenLuanVan: 'Đề tài', gvHuongDan1: 'GV1', trangThai: 'Đang học', ngayHetHan: '2026-01-01' };
  assert.equal(thesisRow({ ...row, ngayBaoVe: '2026-12-01' }, '2026-11-26').stage, 'working');
  const defended = thesisRow({ ...row, ngayBaoVe: '01/11/2026' }, '2026-11-26');
  assert.equal(defended.stage, 'working'); assert.equal(defended.overdue, true);
  assert.equal(thesisRow({...row,trangThaiLv:'Đã bảo vệ'},'2026-11-26').stage,'defended');
  assert.equal(thesisRow({...row,trangThaiLv:'Chưa hoàn thành',ngayTotNghiep:'2026-01-01'},'2026-11-26').stage,'working');
  assert.equal(thesisRow({ ...row, trangThai: 'Đã tốt nghiệp' }, '2026-11-26').stage, 'completed');
  assert.equal(thesisRow(row, '2026-11-26').fields.gvHuongDan1, 'GV1');
});
test('Overdue uses saved deadlines and explicit status and excludes inactive students', () => {
  const row = { trangThai: 'Đang học', ngayHetHan: '25/11/2026' };
  assert.equal(thesisRow(row, '2026-11-26').daysOverdue, 1);
  assert.equal(thesisRow({ ...row, ngayHetHan: '26/11/2026' }, '2026-11-26').overdue, false);
  assert.equal(thesisRow({ ...row, trangThai: 'Xóa tên' }, '2026-11-26').overdue, false);
  assert.equal(thesisRow({ trangThai: 'Quá hạn' }, '2026-11-26').daysOverdue, null);
  assert.equal(thesisRow({ trangThai: 'Quá hạn' }, '2026-11-26').overdue, true);
});
