import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Request } from 'express';
import { TeacherAuthService } from './teacher-auth.service';
import { TrainingOfficeService, type TeachingAssignment } from '../training-office/training-office.service';
import { calculateTeacherGrade, TEACHER_GRADE_POLICY } from './teacher-grade-policy';

type SourceStudent = {
  maHocVien?: string; hoTen?: string; lop?: string; maNganh?: string;
  trinhDo?: string; loaiChuongTrinh?: string;
};
type SavedGrade = {
  assignmentId: string; maHocVien: string;
  // Legacy records used a single score. Kept without overwriting old data.
  score?: number;
  processScore?: number | null; examScore?: number | null;
  totalScore?: number | null; letterGrade?: string | null;
  policyId?: string;
  updatedAt: string; updatedBy: string;
};
function normalizedText(value: unknown): string {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}
function validScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
}
function componentValue(value: unknown): number | null {
  if (value === null) return null;
  if (!validScore(value)) throw new BadRequestException('Điểm phải từ 0–10, tối đa 2 chữ số thập phân');
  return value;
}

@Injectable()
export class TeacherGradesService {
  private readonly gradesFile = path.join(process.cwd(), '.teacher-grades.local.json');
  constructor(
    private readonly teacherAuth: TeacherAuthService,
    private readonly trainingOffice: TrainingOfficeService,
  ) {}

  private myAssignment(req: Request, id: string): { teacherId: string; row: TeachingAssignment } {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw new BadRequestException('Mã phân công không hợp lệ');
    const identity = this.teacherAuth.fromRequest(req);
    const row = this.trainingOffice.assignmentsForTeacher(identity.teacherId).find(a => a.id === id);
    if (!row) throw new NotFoundException('Không tìm thấy phân công thuộc giảng viên đang đăng nhập');
    return { teacherId: identity.teacherId, row };
  }

  private roster(assignment: TeachingAssignment) {
    const source = path.resolve(process.cwd(), '../UI/db.json');
    let parsed: unknown;
    try { parsed = JSON.parse(fs.readFileSync(source, 'utf8')); }
    catch { throw new ServiceUnavailableException('Không đọc được dữ liệu học viên'); }
    if (!parsed || typeof parsed !== 'object' || !('students' in parsed)) {
      throw new ServiceUnavailableException('Dữ liệu học viên không hợp lệ');
    }
    const raw = (parsed as { students?: unknown }).students;
    if (!Array.isArray(raw)) throw new ServiceUnavailableException('Dữ liệu học viên không hợp lệ');
    const index = new Map<string, { maHocVien: string; hoTen: string; lop: string }>();
    for (const record of raw as SourceStudent[]) {
      if (!record || String(record.lop || '').trim() !== assignment.classCode) continue;
      const level = normalizedText(record.trinhDo || record.loaiChuongTrinh);
      if (!level.includes('thac si')) continue;
      if (assignment.majorCode && String(record.maNganh || '').trim() !== assignment.majorCode) continue;
      const track = normalizedText(record.loaiChuongTrinh);
      if (assignment.trainingTrack === 'nghien_cuu' && track && !track.includes('nghien cuu')) continue;
      if (assignment.trainingTrack === 'ung_dung' && track && !track.includes('ung dung')) continue;
      const maHocVien = String(record.maHocVien || '').trim();
      if (!maHocVien || !record.hoTen) continue;
      if (!index.has(maHocVien)) index.set(maHocVien, { maHocVien, hoTen: String(record.hoTen).trim(), lop: assignment.classCode });
    }
    return [...index.values()].sort((a, b) => a.maHocVien.localeCompare(b.maHocVien, 'vi'));
  }

  private readSaved(): SavedGrade[] {
    if (!fs.existsSync(this.gradesFile)) return [];
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.gradesFile, 'utf8'));
      if (!Array.isArray(parsed)) throw new Error('Invalid grades');
      return parsed as SavedGrade[];
    } catch { throw new ServiceUnavailableException('Không đọc được dữ liệu điểm số'); }
  }

  getGradebook(req: Request, assignmentId: string) {
    const { row } = this.myAssignment(req, assignmentId);
    const students = this.roster(row);
    const saved = this.readSaved().filter(g => g.assignmentId === row.id);
    const scores = new Map(saved.map(g => [g.maHocVien, g]));
    const updatedAt = saved.reduce<string | null>((latest, g) => !latest || g.updatedAt > latest ? g.updatedAt : latest, null);
    return {
      success: true, assignment: row, updatedAt,
      gradingPolicy: TEACHER_GRADE_POLICY,
      students: students.map(s => {
        const grade = scores.get(s.maHocVien);
        const hasComponents = grade?.processScore !== undefined || grade?.examScore !== undefined;
        const processScore = hasComponents ? grade?.processScore ?? null : null;
        const examScore = hasComponents ? grade?.examScore ?? null : null;
        const calculated = calculateTeacherGrade(processScore, examScore);
        return {
          ...s, processScore, examScore,
          ...calculated,
          legacyScore: !hasComponents && validScore(grade?.score) ? grade.score : null,
          updatedAt: grade?.updatedAt,
        };
      }),
    };
  }

  // Kết quả cá nhân: chỉ được gọi sau khi Controller xác thực cookie học viên.
  transcriptForStudent(studentCode: string) {
    const studentId = studentCode.trim();
    const saved = this.readSaved();
    const byAssignment = new Map(saved.filter(g => g.maHocVien === studentId).map(g => [g.assignmentId, g]));
    const assignments = this.trainingOffice.allSavedAssignments();
    return assignments
      .filter(a => this.roster(a).some(s => s.maHocVien === studentId))
      .map(a => {
        const g = byAssignment.get(a.id);
        const processScore = g?.processScore ?? null;
        const examScore = g?.examScore ?? null;
        const calculated = calculateTeacherGrade(processScore, examScore);
        const legacyTotal = validScore(g?.score) ? g.score : null;
        const complete = calculated.totalScore !== null || legacyTotal !== null;
        const partial = processScore !== null || examScore !== null;
        return {
          assignmentId: a.id, courseCode: a.courseCode, courseName: a.courseName,
          classCode: a.classCode, schoolYear: a.schoolYear, semester: a.semester,
          teacherName: a.teacherName, trainingTrack: a.trainingTrack || null,
          processScore, examScore, totalScore: calculated.totalScore ?? legacyTotal,
          letterGrade: calculated.letterGrade || null,
          status: complete ? 'da_co_diem' : partial ? 'dang_nhap_diem' : 'chua_co_diem',
          updatedAt: g?.updatedAt || null,
        };
      })
      .sort((a, b) => b.schoolYear.localeCompare(a.schoolYear) ||
        Number(a.semester) - Number(b.semester) || a.courseCode.localeCompare(b.courseCode, 'vi'));
  }

  saveGradebook(req: Request, assignmentId: string, input: unknown) {
    const { teacherId, row } = this.myAssignment(req, assignmentId);
    const roster = this.roster(row);
    if (!roster.length) throw new BadRequestException('Lớp chưa có học viên hợp lệ để nhập điểm');
    if (!input || typeof input !== 'object' || !('scores' in input)) throw new BadRequestException('Thiếu dữ liệu bảng điểm');
    const submitted = (input as { scores?: unknown }).scores;
    if (!Array.isArray(submitted) || submitted.length !== roster.length) {
      throw new ConflictException('Số lượng học viên đã thay đổi. Vui lòng tải lại bảng điểm trước khi lưu');
    }
    const validStudents = new Set(roster.map(s => s.maHocVien));
    const seen = new Set<string>();
    const now = new Date().toISOString();
    const previous = this.readSaved();
    const previousMap = new Map(previous.filter(g => g.assignmentId === row.id).map(g => [g.maHocVien, g]));
    const additions: SavedGrade[] = [];
    for (const raw of submitted) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Dòng điểm không hợp lệ');
      const candidate = raw as { maHocVien?: unknown; processScore?: unknown; examScore?: unknown };
      const maHocVien = typeof candidate.maHocVien === 'string' ? candidate.maHocVien.trim() : '';
      if (!validStudents.has(maHocVien) || seen.has(maHocVien)) throw new BadRequestException('Mã học viên không thuộc lớp được phân công hoặc bị lặp');
      seen.add(maHocVien);
      if (!Object.hasOwn(candidate, 'processScore') || !Object.hasOwn(candidate, 'examScore')) {
        throw new BadRequestException('Thiếu điểm quá trình hoặc điểm thi (dùng null cho ô trống)');
      }
      const processScore = componentValue(candidate.processScore);
      const examScore = componentValue(candidate.examScore);
      if (processScore === null && examScore === null) {
        // Giữ bản điểm một cột ở phiên bản cũ nếu chưa chuyển đổi; tránh xóa mất khi lưu lớp.
        const legacy = previousMap.get(maHocVien);
        if (legacy?.score !== undefined && legacy.processScore === undefined && legacy.examScore === undefined) additions.push(legacy);
        continue;
      }
      const calculated = calculateTeacherGrade(processScore, examScore);
      additions.push({ assignmentId: row.id, maHocVien, processScore, examScore, ...calculated,
        policyId: TEACHER_GRADE_POLICY.id, updatedAt: now, updatedBy: teacherId });
    }
    if (seen.size !== validStudents.size) throw new BadRequestException('Bảng điểm thiếu học viên');
    const remaining = previous.filter(g => g.assignmentId !== row.id);
    const temp = `${this.gradesFile}.tmp`;
    try {
      fs.writeFileSync(temp, JSON.stringify([...remaining, ...additions], null, 2), { mode: 0o600 });
      fs.renameSync(temp, this.gradesFile);
    } catch { throw new ServiceUnavailableException('Không lưu được bảng điểm trên Backend'); }
    return { success: true, savedCount: additions.length, total: roster.length, updatedAt: now, gradingPolicy: TEACHER_GRADE_POLICY };
  }
}
