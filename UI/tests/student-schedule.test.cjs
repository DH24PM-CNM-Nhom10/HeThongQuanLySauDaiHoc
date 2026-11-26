const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const moduleValue = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/teacher-schedule.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInThisContext(`(function(exports){${code}\n})`)(moduleValue.exports);
const { normalizeStudentSchedule, arrangeLessons, parseScheduleDate } = moduleValue.exports;

test('Vietnamese student fields display on the correct weekday and periods', () => {
  const row = normalizeStudentSchedule({ tenMon: 'Môn học', lop: 'L1', tenGV: 'Giảng viên', hocKy: '1', namHoc: '2026-2027', thoiGian: 'Thứ hai tiết 1–3', phong: 'A101', ngayBatDau: '2026-11-23', ngayKetThuc: '2026-12-01' }, 0);
  const week = parseScheduleDate('2026-11-23');
  const column = arrangeLessons([row], week, 1);
  assert.equal(column.lessons.length, 1);
  assert.equal(column.lessons[0].start, 1);
  assert.equal(column.lessons[0].end, 3);
  assert.equal(column.lessons[0].row.teacherName, 'Giảng viên');
  assert.equal(arrangeLessons([row], parseScheduleDate('2026-12-07'), 1).lessons.length, 0);
});

test('Structured period fields and overlapping lessons work in the shared grid', () => {
  const rows = [0, 1].map(index => normalizeStudentSchedule({ thu: 3, tietBatDau: 2, soTiet: 2 }, index));
  const column = arrangeLessons(rows, parseScheduleDate('2026-11-23'), 2);
  assert.equal(column.lessons.length, 2);
  assert.equal(column.laneCount, 2);
  assert.equal(column.lessons[0].end, 3);
  assert.equal(normalizeStudentSchedule(null, 0), null);
});
