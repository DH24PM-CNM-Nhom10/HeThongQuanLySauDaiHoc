import { buildGradeStatistics } from './grade-statistics';
describe('Thống kê quản lý điểm số', () => {
  const store = {
    students: [{ maHocVien: 'S1', khoaHoc: 'K25' }, { maHocVien: 'S2', khoaHoc: 'K24' }],
    teachingAssignments: [{ id: 'A1', classCode: 'L1', courseCode: 'M1', courseName: 'Môn 1', schoolYear: '2025-2026', semester: '1', majorCode: 'N1', majorName: 'Ngành 1' },
      { id: 'A2', classCode: 'L2', schoolYear: '2026-2027', semester: '2', majorCode: 'N2', majorName: 'Ngành 2' }],
    gradebooks: [{ assignmentId: 'A1', gradingPolicy: {passScore:4}, status: 'published', roster: [{ maHocVien: 'S1' }, { maHocVien: 'S2' }, { maHocVien: 'S1' }], publishedScores: [{ maHocVien: 'S1', totalScore: 8 }, { maHocVien: 'S2', totalScore: 0 }, { maHocVien: 'OTHER', totalScore: 10 }] },
      { assignmentId: 'A2', gradingPolicy: {passScore:4}, status: 'pending', roster: [{ maHocVien: 'S1' }], scores: [{ maHocVien: 'S1', totalScore: 10 }] }],
  };
  it('tính điểm đã lưu, giữ điểm 0 và bỏ điểm ngoài danh sách', () => {
    const result = buildGradeStatistics(store);
    expect(result.summary).toMatchObject({ enrollments: 3, students: 2, courseSections: 2, graded: 3, ungraded: 0, passed: 2, failed: 1, average: 6, passRate: 66.67 });
    expect(result.distribution.reduce((sum, row) => sum + row.count, 0)).toBe(3);
    expect(result.groups.major).toHaveLength(2);
  });
  it('lọc đồng thời theo ngành, khóa, lớp và học kỳ', () => {
    const result = buildGradeStatistics(store, { major: 'N1', cohort: 'K25', classCode: 'L1', schoolYear: '2025-2026', semester: '1' });
    expect(result.summary).toMatchObject({ enrollments: 1, average: 8, passRate: 100 });
    expect(buildGradeStatistics(store, { cohort: 'missing' }).summary.average).toBeNull();
  });
  it('dùng điểm lưu mới nhất thay cho ảnh chụp công bố cũ', () => {
    const reopened = structuredClone(store); reopened.gradebooks[0].status = 'draft';
    reopened.gradebooks[0].scores = [{ maHocVien: 'S1', totalScore: 10 }];
    expect(buildGradeStatistics(reopened).summary.average).toBe(10);
  });
  it('không suy đoán ngưỡng đạt khi chưa có quy chế',()=>{const unknown=structuredClone(store);delete (unknown.gradebooks[0] as any).gradingPolicy;delete (unknown.gradebooks[1] as any).gradingPolicy;expect(buildGradeStatistics(unknown).summary).toMatchObject({passed:0,failed:0,unclassified:3,passRate:null});});
  it('không tạo điểm trung bình hoặc tỷ lệ giả khi chưa có điểm', () => {
    const result = buildGradeStatistics({ students: [], teachingAssignments: [], gradebooks: [] });
    expect(result.summary).toMatchObject({ graded: 0, average: null, passRate: null });
  });
});
