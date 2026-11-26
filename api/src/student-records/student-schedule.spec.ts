import { scheduleForStudent } from './student-schedule';

describe('Thời khóa biểu học viên', () => {
  const students = [{ maHocVien: 'S001', lop: 'L1' }, { maHocVien: 'S002', lop: 'L1' }];
  const teachingAssignments = [
    { id: 'A1', classCode: 'L1', courseCode: 'M1', courseName: 'Môn 1', teacherName: 'GV 1', schoolYear: '2026-2027', semester: '1' },
    { id: 'A2', classCode: 'L2', courseCode: 'M2' },
  ];
  it('includes personal and class schedules but excludes other learners and classes', () => {
    const rows = scheduleForStudent({ students, teachingAssignments, schedule: [
      { id: 'personal', maHocVien: 'S001', thoiGian: 'Thứ hai tiết 1–3' },
      { id: 'class', maLop: 'L1' },
      { id: 'another-student', maHocVien: 'S002', lop: 'L1' },
      { id: 'another-class', classCode: 'L2' },
      { id: 'unscoped', tenNganh: 'Cùng ngành' },
    ] }, 's001');
    expect(rows.map(row => row.id)).toEqual(['personal', 'class']);
  });
  it('resolves assignment-only slots for the correct class and preserves period data', () => {
    const rows = scheduleForStudent({ students, teachingAssignments, schedule: [
      { assignmentId: 'A1', thu: 2, tietBatDau: 1, soTiet: 3, phong: 'P101' },
      { assignmentId: 'A2' }, { assignmentId: 'missing' },
    ] }, 'S001');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ courseName: 'Môn 1', teacherName: 'GV 1', semester: '1', tietBatDau: 1, soTiet: 3, phong: 'P101' });
  });
  it('returns no data when the learner cannot be found or has no matching class', () => {
    expect(scheduleForStudent({ students, teachingAssignments, schedule: [{ lop: 'L1' }] }, 'unknown')).toEqual([]);
    expect(scheduleForStudent({ students: [{ maHocVien: 'S003' }], teachingAssignments, schedule: [{ lop: 'L1' }] }, 'S003')).toEqual([]);
  });
});
