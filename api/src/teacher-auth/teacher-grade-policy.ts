/**
 * CẤU HÌNH DEMO cho học phần thông thường, CHƯA được xác nhận là quy chế AGU.
 * Thay bằng trọng số / bảng điểm chữ theo đề cương đã được phê duyệt TRƯỚC KHI dùng dữ liệu thật.
 * Học phần tốt nghiệp (luận văn/đề án) có thể áp dụng quy trình đánh giá riêng.
 */
export const TEACHER_GRADE_POLICY = {
  id: 'DEMO_40_60_V1',
  description: 'Tham khảo thử nghiệm: quá trình 40%, thi kết thúc 60%; chưa phải thang quy đổi chính thức AGU',
  processWeight: 0.4,
  examWeight: 0.6,
  thresholds: [
    { min: 9, letter: 'A+' },
    { min: 8.5, letter: 'A' },
    { min: 8, letter: 'B+' },
    { min: 7, letter: 'B' },
    { min: 6.5, letter: 'C+' },
    { min: 5.5, letter: 'C' },
    { min: 5, letter: 'D+' },
    { min: 4, letter: 'D' },
    { min: 0, letter: 'F' },
  ],
} as const;

export type GradePolicy = { id: string; description: string; processWeight: number; examWeight: number; thresholds: readonly { min: number; letter: string; gpa?: number }[]; passScore?: number };
export function calculateTeacherGrade(processScore: number | null, examScore: number | null, policy: GradePolicy = TEACHER_GRADE_POLICY) {
  if ((processScore === null && policy.processWeight > 0) || (examScore === null && policy.examWeight > 0)) return { totalScore: null, letterGrade: null };
  const totalScore = Math.round(((processScore ?? 0) * policy.processWeight + (examScore ?? 0) * policy.examWeight + Number.EPSILON) * 100) / 100;
  const letterGrade = policy.thresholds.find(row => totalScore >= row.min)?.letter ?? 'F';
  return { totalScore, letterGrade };
}
