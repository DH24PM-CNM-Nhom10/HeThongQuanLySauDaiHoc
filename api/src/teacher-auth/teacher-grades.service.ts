import { savedScores, coursePolicy } from '../../../shared/course-grading.cjs';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TeacherAuthService } from './teacher-auth.service';
import {
  TrainingOfficeService,
  type TeachingAssignment,
} from '../training-office/training-office.service';
import {
  calculateTeacherGrade,
  TEACHER_GRADE_POLICY,
  type GradePolicy,
} from './teacher-grade-policy';
import { readStore, saveStore, studentCode } from '../common/data-store';
import { assignmentRoster, type Enrollment } from '../common/enrollment-roster';

type Score = {
  maHocVien: string;
  processScore: number | null;
  examScore: number | null;
  totalScore: number | null;
  letterGrade: string | null;
  legacyScore?: number | null;
};
type Book = {
  assignmentId: string;
  revision: number;
  status: string;
  roster: Enrollment[];
  scores: Score[];
  publishedScores?: Score[];
  gradingPolicy?: GradePolicy;
  publishedPolicy?: GradePolicy;
  updatedAt: string;
};
function component(value: unknown): number | null {
  if (value === null) return null;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 10 ||
    Math.abs(value * 100 - Math.round(value * 100)) > 1e-7
  ) {
    throw new BadRequestException(
      'Điểm phải từ 0–10, tối đa hai chữ số thập phân',
    );
  }
  return value;
}

@Injectable()
export class TeacherGradesService {
  constructor(
    private readonly teacherAuth: TeacherAuthService,
    private readonly trainingOffice: TrainingOfficeService,
  ) {}

  private assignment(id: string) {
    const row = this.trainingOffice
      .allSavedAssignments()
      .find((item) => item.id === id);
    if (!row) throw new NotFoundException('Không tìm thấy phân công');
    return row;
  }

  private ensureBook(row: TeachingAssignment) {
    const store = readStore();
    let book = store.gradebooks.find((item) => item.assignmentId === row.id) as
      Book | undefined;
    if (!book) {
      const roster = assignmentRoster(row, store.students);
      const scores: Score[] = [];
      for (const grade of store.teacherGrades.filter(
        (item) => item.assignmentId === row.id,
      )) {
        const code = String(grade.maHocVien).trim().toUpperCase();
        // Khôi phục liên kết lịch sử từ điểm cũ nếu học viên đã chuyển lớp.
        if (!roster.some((item) => item.maHocVien === code)) {
          const student = store.students.find(
            (item) => studentCode(item) === code,
          );
          roster.push({
            maHocVien: code,
            hoTen: String(student?.hoTen || code),
            lop: row.classCode,
          });
        }
        const processScore = grade.processScore ?? null;
        const examScore = grade.examScore ?? null;
        scores.push({
          maHocVien: code,
          processScore,
          examScore,
          ...calculateTeacherGrade(processScore, examScore),
          legacyScore: grade.score ?? null,
        });
      }
      book = {
        assignmentId: row.id,
        roster,
        scores,
        revision: 0,
        status: 'saved',
        updatedAt: new Date().toISOString(),
      };
      store.gradebooks.push(book);
      saveStore(store);
    }
    return book;
  }

  private own(req: Request, id: string) {
    const identity = this.teacherAuth.fromRequest(req);
    const row = this.assignment(id);
    if (row.teacherId !== identity.teacherId)
      throw new NotFoundException(
        'Phân công không thuộc giảng viên đang đăng nhập',
      );
    return { row, identity };
  }

  private policy(row: TeachingAssignment, book: Book): GradePolicy | null {
    return (
      coursePolicy(readStore(), row.courseCode) ||
      book.gradingPolicy ||
      (savedScores(book).length ? TEACHER_GRADE_POLICY : null)
    );
  }
  private view(row: TeachingAssignment, book: Book) {
    return {
      success: true,
      assignment: row,
      revision: book.revision,
      status: 'saved',
      history: readStore()
        .gradeHistory.filter((item) => item.assignmentId === row.id)
        .map((item) => ({
          action: item.action,
          actor: item.actor,
          reason: item.reason,
          at: item.at,
          revision: item.revision,
        })),
      updatedAt: book.updatedAt,
      courseConfigured: !!coursePolicy(readStore(), row.courseCode),
      gradingPolicy: this.policy(row, book),
      requiresRecalculation:
        !!coursePolicy(readStore(), row.courseCode) &&
        book.gradingPolicy?.id !== this.policy(row, book)?.id &&
        savedScores(book).length > 0,
      students: book.roster.map((student) => ({
        ...student,
        processScore: null,
        examScore: null,
        totalScore: null,
        letterGrade: null,
        ...savedScores(book).find(
          (score) => score.maHocVien === student.maHocVien,
        ),
      })),
    };
  }

  getGradebook(req: Request, id: string) {
    const { row } = this.own(req, id);
    return this.view(row, this.ensureBook(row));
  }

  saveGradebook(req: Request, id: string, input: unknown) {
    const { row, identity } = this.own(req, id);
    this.ensureBook(row);
    const store = readStore();
    const book = store.gradebooks.find(
      (item) => item.assignmentId === id,
    ) as Book;
    const body = input as { scores?: unknown; revision?: unknown } | null;
    if (!body || body.revision !== book.revision)
      throw new ConflictException(
        'Bảng điểm đã thay đổi. Hãy tải lại trước khi lưu.',
      );
    const policy = coursePolicy(store, row.courseCode) as GradePolicy | null;
    if (!policy)
      throw new BadRequestException(
        'Cần cấu hình trọng số cho môn học trước khi lưu điểm.',
      );
    if (
      !Array.isArray(body.scores) ||
      body.scores.length !== book.roster.length
    )
      throw new BadRequestException('Danh sách học viên không khớp');
    const seen = new Set<string>();
    const scores: Score[] = [];
    for (const item of body.scores) {
      const code = String(item?.maHocVien || '')
        .trim()
        .toUpperCase();
      if (
        !book.roster.some((student) => student.maHocVien === code) ||
        seen.has(code)
      )
        throw new BadRequestException('Mã học viên không hợp lệ hoặc bị trùng');
      seen.add(code);
      const processScore = component(item.processScore);
      const examScore = component(item.examScore);
      scores.push({
        maHocVien: code,
        processScore,
        examScore,
        ...calculateTeacherGrade(processScore, examScore, policy),
        legacyScore:
          processScore === null && examScore === null
            ? book.scores.find((score) => score.maHocVien === code)?.legacyScore
            : null,
      });
    }
    store.gradeHistory.push({
      assignmentId: id,
      action: 'save',
      actor: identity.teacherId,
      at: new Date().toISOString(),
      revision: book.revision,
      before: JSON.parse(JSON.stringify(book)),
    });
    book.gradingPolicy = policy;
    book.status = 'saved';
    book.scores = scores;
    book.revision++;
    book.updatedAt = new Date().toISOString();
    saveStore(store);
    return {
      success: true,
      updatedAt: book.updatedAt,
      revision: book.revision,
      status: book.status,
    };
  }

  syncForTeacher(req: Request, id: string, revision: unknown) {
    const { identity } = this.own(req, id);
    return this.syncRoster(id, revision, identity.teacherId);
  }

  private syncRoster(id: string, revision: unknown, actor: string) {
    const assignment = this.assignment(id);
    this.ensureBook(assignment);
    const store = readStore();
    const book = store.gradebooks.find(
      (item) => item.assignmentId === id,
    ) as Book;
    if (revision !== book.revision)
      throw new ConflictException('Bảng điểm đã thay đổi. Hãy tải lại.');
    const enrolled = new Set(book.roster.map((row) => row.maHocVien));
    const additions = assignmentRoster(assignment, store.students).filter(
      (row) => !enrolled.has(row.maHocVien),
    );
    if (!additions.length)
      return {
        success: true,
        status: book.status,
        revision: book.revision,
        added: 0,
      };
    store.gradeHistory.push({
      assignmentId: id,
      action: 'sync_roster',
      actor,
      at: new Date().toISOString(),
      revision: book.revision,
      before: JSON.parse(JSON.stringify(book)),
      added: additions.map((row) => row.maHocVien),
    });
    book.roster.push(...additions);
    book.roster.sort((a, b) => a.maHocVien.localeCompare(b.maHocVien, 'vi'));
    book.revision++;
    book.updatedAt = new Date().toISOString();
    saveStore(store);
    return {
      success: true,
      status: book.status,
      revision: book.revision,
      added: additions.length,
    };
  }

  transcriptForStudent(code: string) {
    const normalized = code.trim().toUpperCase();
    const store = readStore();
    const books = store.gradebooks as Book[];
    return this.trainingOffice
      .allSavedAssignments()
      .flatMap((row) => {
        const book = books.find((item) => item.assignmentId === row.id);
        if (!book?.roster.some((student) => student.maHocVien === normalized))
          return [];
        const score = savedScores(book).find(
          (item) => item.maHocVien === normalized,
        );
        return [
          {
            assignmentId: row.id,
            courseCode: row.courseCode,
            courseName: row.courseName,
            classCode: row.classCode,
            schoolYear: row.schoolYear,
            semester: row.semester,
            teacherName: row.teacherName,
            processScore: score?.processScore ?? null,
            examScore: score?.examScore ?? null,
            totalScore: score?.totalScore ?? null,
            letterGrade: score?.letterGrade ?? null,
            status:
              score?.totalScore != null
                ? 'da_co_diem'
                : score
                  ? 'dang_nhap_diem'
                  : 'chua_co_diem',
            updatedAt: score ? book.updatedAt : null,
          },
        ];
      })
      .sort(
        (a, b) =>
          b.schoolYear.localeCompare(a.schoolYear) ||
          a.courseCode.localeCompare(b.courseCode, 'vi'),
      );
  }
}
