import { TrainingOfficeService } from './training-office.service';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('Thời khóa biểu giảng viên', () => {
  let root: string;
  let previous: string | undefined;
  beforeEach(() => {
    previous = process.env.QLDT_DATA_ROOT;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qldt-schedule-'));
    fs.mkdirSync(path.join(root, 'UI'));
    process.env.QLDT_DATA_ROOT = root;
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.QLDT_DATA_ROOT;
    else process.env.QLDT_DATA_ROOT = previous;
    fs.unlinkSync(path.join(root, 'UI/db.json'));
    fs.rmdirSync(path.join(root, 'UI'));
    fs.rmdirSync(root);
  });

  it('chỉ ghép lịch đúng lớp, môn, năm học và giảng viên', () => {
    const assignments = [
      { id: 'A1', teacherId: 'T1', classCode: 'L1', courseCode: 'M1', courseName: 'Môn 1', schoolYear: '2025-2026', semester: '1' },
      { id: 'A2', teacherId: 'T2', classCode: 'L2', courseCode: 'M1', courseName: 'Môn 1', schoolYear: '2025-2026', semester: '1' },
      { id: 'A3', teacherId: 'T1', classCode: 'L1', courseCode: 'M1', courseName: 'Môn 1', schoolYear: '2026-2027', semester: '1' },
    ];
    fs.writeFileSync(path.join(root, 'UI/db.json'), JSON.stringify({
      students: [], teachingAssignments: assignments,
      schedule: [
        { assignmentId: 'A1', thoiGian: 'Thứ hai, 7h–11h', phong: 'A101' },
        { assignmentId: 'A2', thoiGian: 'Thứ ba, 7h–11h', phong: 'B101' },
        { maMon: 'M1', lop: 'L1', thoiGian: 'Không xác định năm học', phong: 'X' },
      ],
    }));
    const rows = new TrainingOfficeService().scheduleForTeacher('T1');
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.assignmentId === 'A1')?.room).toBe('A101');
    expect(rows.find(row => row.assignmentId === 'A3')?.hasSchedule).toBe(false);
    expect(rows.some(row => row.room === 'B101' || row.room === 'X')).toBe(false);
  });
});
