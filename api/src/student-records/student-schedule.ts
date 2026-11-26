import { studentCode } from '../common/data-store';

type Row = Record<string, unknown>;
type ScheduleStore = { students: Row[]; schedule: Row[]; teachingAssignments: Row[] };
const text = (value: unknown) => String(value ?? '').trim();
const classCode = (row: Row) => text(row.classCode || row.lop || row.maLop || row.LOP);

export function scheduleForStudent(store: ScheduleStore, code: string): Row[] {
  const normalized = code.trim().toUpperCase();
  const student = store.students.find(row => studentCode(row) === normalized);
  if (!student) return [];
  const studentClass = classCode(student).toUpperCase();
  return store.schedule.flatMap(slot => {
    const personalCode = studentCode(slot);
    // A personal schedule must never fall back to another learner in the same class.
    if (personalCode && personalCode !== normalized) return [];
    const assignmentId = text(slot.assignmentId || slot.maPhanCong);
    const assignments = assignmentId ? store.teachingAssignments.filter(row => text(row.id) === assignmentId) : [];
    if (assignmentId && assignments.length !== 1) return [];
    const assignment = assignments[0];
    const slotClass = classCode(slot) || (assignment ? classCode(assignment) : '');
    if (!personalCode && (!studentClass || slotClass.toUpperCase() !== studentClass)) return [];
    return [{
      ...(assignment ? {
        courseCode: assignment.courseCode, courseName: assignment.courseName,
        classCode: assignment.classCode, teacherName: assignment.teacherName,
        schoolYear: assignment.schoolYear, semester: assignment.semester,
      } : {}),
      ...slot,
    }];
  });
}
