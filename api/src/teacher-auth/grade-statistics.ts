import { savedScores } from '../../../shared/course-grading.cjs';
import { studentCode } from '../common/data-store';
import { studentCohort } from '../../../shared/student-profile.cjs';
import { TEACHER_GRADE_POLICY } from './teacher-grade-policy';
type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter(row => row && typeof row === 'object' && !Array.isArray(row)) : [];
const text = (value: unknown) => String(value ?? '').trim();
type Entry = { code: string; assignmentId: string; classCode: string; courseName: string; courseCode: string; schoolYear: string; semester: string; major: string; majorName: string; cohort: string; total: number | null; passed: boolean; bookStatus: string };
export function buildGradeStatistics(store: Record<string, unknown[]>, filters: Record<string, string> = {}) {
  const assignments = rows(store.teachingAssignments), books = rows(store.gradebooks), students = rows(store.students);
  const passThreshold = Math.min(...TEACHER_GRADE_POLICY.thresholds.filter(row => row.letter !== 'F').map(row => row.min));
  const entries: Entry[] = [];
  for (const assignment of assignments) {
    const book = books.find(item => item.assignmentId === assignment.id);
    if (!book) continue;
    const published = rows(savedScores(book));
    const policy = (book.gradingPolicy || book.publishedPolicy) as { passScore?: number } | undefined;
    const bookPassThreshold = Number.isFinite(policy?.passScore) ? Number(policy!.passScore) : passThreshold;
    const seen = new Set<string>();
    for (const enrollment of rows(book.roster)) {
      const code = studentCode(enrollment);
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const student = students.find(item => studentCode(item) === code) || {};
      const score = published.find(item => studentCode(item) === code);
      const value = score?.totalScore;
      const total = typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10 ? value : null;
      entries.push({ code, assignmentId: text(assignment.id), classCode: text(assignment.classCode), courseName: text(assignment.courseName), courseCode: text(assignment.courseCode),
        schoolYear: text(assignment.schoolYear), semester: text(assignment.semester), major: text(assignment.majorCode || student.maNganh),
        majorName: text(assignment.majorName || student.tenNganh), cohort: studentCohort(student) || text(assignment.admissionYear),
        total, passed: total !== null && total >= bookPassThreshold, bookStatus: text(book.status) });
    }
  }
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
  const options = { schoolYears: unique(assignments.map(row => text(row.schoolYear))), semesters: unique(assignments.map(row => text(row.semester))),
    classes: unique(assignments.map(row => text(row.classCode))), cohorts: unique(entries.map(row => row.cohort)),
    majors: [...new Map(entries.filter(row => row.major).map(row => [row.major, { value: row.major, label: row.majorName || row.major }])).values()] };
  const filtered = entries.filter(row => ['schoolYear', 'semester', 'major', 'cohort', 'classCode'].every(key => !filters[key] || row[key as keyof Entry] === filters[key]));
  const summarize = (data: Entry[]) => {
    const graded = data.filter(row => row.total !== null), passed = graded.filter(row => row.passed).length;
    return { enrollments: data.length, graded: graded.length, ungraded: data.length - graded.length, passed, failed: graded.length - passed,
      average: graded.length ? Math.round(graded.reduce((sum, row) => sum + row.total!, 0) / graded.length * 100) / 100 : null,
      passRate: graded.length ? Math.round(passed / graded.length * 10000) / 100 : null };
  };
  const group = (kind: 'class' | 'major' | 'cohort') => {
    const groups = new Map<string, Entry[]>();
    for (const row of filtered) {
      const key = kind === 'class' ? row.assignmentId : kind === 'major' ? row.major || 'unknown' : row.cohort || 'unknown';
      groups.set(key, [...(groups.get(key) || []), row]);
    }
    return [...groups].map(([key, data]) => ({ key,
      label: kind === 'class' ? `${data[0].classCode} · ${data[0].courseCode} · ${data[0].courseName} · ${data[0].schoolYear} HK${data[0].semester}`
        : kind === 'major' ? data[0].majorName || data[0].major || 'Chưa cập nhật ngành' : data[0].cohort || 'Chưa cập nhật khóa', ...summarize(data) }));
  };
  const ranges = [{ label: 'Dưới 4', min: 0, max: 4 }, { label: '4 đến dưới 5,5', min: 4, max: 5.5 }, { label: '5,5 đến dưới 7', min: 5.5, max: 7 }, { label: '7 đến dưới 8,5', min: 7, max: 8.5 }, { label: '8,5 đến 10', min: 8.5, max: 11 }];
  return { success: true, options, filters, summary: { ...summarize(filtered), students: new Set(filtered.map(row => row.code)).size,
    courseSections: new Set(filtered.map(row => row.assignmentId)).size },
    distribution: ranges.map(range => ({ label: range.label, count: filtered.filter(row => row.total !== null && row.total >= range.min && row.total < range.max).length })),
    groups: { class: group('class'), major: group('major'), cohort: group('cohort') },
    policy: { id: TEACHER_GRADE_POLICY.id, passThreshold, note: 'Thống kê điểm giảng viên đã lưu, áp dụng ngưỡng đạt theo cấu hình môn học đã lưu của từng bảng điểm. Bảng cũ chưa có cấu hình dùng quy chế thử nghiệm. Điểm trung bình là trung bình cộng các lượt học, không phải GPA theo tín chỉ.' } };
}
