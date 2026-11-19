import { readStore, studentCode, studentStatus } from './data-store';

export type Enrollment = { maHocVien: string; hoTen: string; lop: string };
export function assignmentRoster(assignment: {
  classCode: string; majorCode?: string; trainingTrack?: string;
}, students = readStore().students): Enrollment[] {
  const text = (value: unknown) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const roster = new Map<string, Enrollment>();
  for (const row of students) {
    if (String(row.lop || row.LOP || '').trim() !== assignment.classCode) continue;
    if (!text(row.trinhDo || row.loaiChuongTrinh).includes('thac si')) continue;
    if (assignment.majorCode && String(row.maNganh || '').trim() !== assignment.majorCode) continue;
    if (['withdrawn', 'left'].includes(studentStatus(row))) continue;
    const track = text(row.loaiChuongTrinh);
    if (assignment.trainingTrack === 'nghien_cuu' && !track.includes('nghien cuu')) continue;
    if (assignment.trainingTrack === 'ung_dung' && !track.includes('ung dung')) continue;
    const code = studentCode(row);
    if (code && row.hoTen) roster.set(code, { maHocVien: code, hoTen: String(row.hoTen), lop: assignment.classCode });
  }
  return [...roster.values()].sort((a, b) => a.maHocVien.localeCompare(b.maHocVien, 'vi'));
}
