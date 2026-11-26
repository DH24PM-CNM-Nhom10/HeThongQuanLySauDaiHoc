import { requireManager } from '../common/management-access';
import { BadRequestException, ConflictException, Injectable, UnauthorizedException, ServiceUnavailableException, NotFoundException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readStore, saveStore, projectRoot } from '../common/data-store';
import { assignmentRoster } from '../common/enrollment-roster';
import type { Request } from 'express';

type OfficeAccount = { username: string; displayName: string; role: 'training_office'; passwordHash: string; active: boolean };
type Payload = { sub: string; exp: number };
export type OfficeIdentity = { role: 'training_office'; username: string; hoTen: string };
type Teacher = { id?: string; shcc?: string; hoten?: string; t_dvi?: string; t_tdcmon?: string; t_cmdtao?: string };
type Student = { lop?: string; loaiChuongTrinh?: string; maNganh?: string; tenNganh?: string; ngayNhapHoc?: string | number };
export type TeachingAssignment = {
  id: string; teacherId: string; teacherName: string; department: string;
  classCode: string; courseCode: string; courseName: string;
  schoolYear: string; semester: string; createdAt: string; createdBy: string;
  trainingTrack?: 'nghien_cuu' | 'ung_dung'; admissionYear?: number;
  programSemester?: number; majorCode?: string; majorName?: string;
  openingConfirmedAt?: string; // Phòng đào tạo xác nhận lớp đã mở theo kế hoạch
};

type CourseReference = {
  code: string; name: string; majorName: string;
  track: 'nghien_cuu' | 'ung_dung'; semesters: number[];
  validFromAdmissionYear: number | null; needsReview: boolean;
};

// Mã ngành lấy từ hồ sơ học viên (UI/db.json), tên ngành từ danh mục CTĐT.
const MAJOR_TO_CURRICULUM: Record<string, string> = {
  '8480201': 'Công nghệ thông tin', '8620110': 'Khoa học cây trồng',
  '8620105': 'Chăn nuôi', '8420201': 'Công nghệ sinh học',
  '8540101': 'Công nghệ thực phẩm', '8850101': 'Quản lý tài nguyên và môi trường',
  '8140114': 'Quản lý giáo dục', '8140110': 'Lí luận và Phương pháp dạy học',
  '8440103': 'Vật lý lý thuyết và Vật lý toán',
  '8140111': 'Lý luận và Phương pháp dạy học bộ môn tiếng Anh',
};
// Chuẩn hóa ngày nhập học: dữ liệu nguồn có cả năm 2025 và số serial Excel.
function admissionYearFromRaw(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (/^20\d{2}$/.test(text)) return Number(text);
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric >= 35000 && numeric <= 85000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(numeric) * 86_400_000);
    return date.getUTCFullYear();
  }
  const match = text.match(/(?:19|20)\d{2}/g);
  const y = match ? Number(match[match.length - 1]) : NaN;
  return y >= 2000 && y <= 2100 ? y : null;
}
function trackFromRaw(value: unknown): 'nghien_cuu' | 'ung_dung' | null {
  const text = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  if (text.includes('nghien cuu')) return 'nghien_cuu';
  if (text.includes('ung dung')) return 'ung_dung';
  return null;
}

const COOKIE = 'agu_training_office_session';
const MAX_AGE = 8 * 60 * 60;
const DEMO_OFFICE_USERNAME = 'phongdaotao@agu.edu.vn';
const DEMO_OFFICE_PASSWORD_HASH = 'scrypt$00112233445566778899aabbccddeeff$8e4eb4f77584df2bc9135e795dba0225cdf71917c43be53d739f71de52f60bf583e44cc831d66e5b89e041ffa7ed5d118ca1827ad05a865da5621560023d83e6';

@Injectable()
export class TrainingOfficeService {
  private readonly accountPath = path.join(process.cwd(), '.training-office-account.local.json');
  private readonly secretPath = path.join(process.cwd(), '.training-office-auth-secret');
  private readonly assignmentPath = path.join(process.cwd(), '.training-assignments.local.json');
  private secret: Buffer | null = null;
  private readonly attempts = new Map<string, { count: number; deadline: number }>();

  private account(): OfficeAccount {
    if (!fs.existsSync(this.accountPath)) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Chưa tạo tài khoản Phòng đào tạo; chạy lệnh seed trước');
      }
      return {
        role: 'training_office',
        username: DEMO_OFFICE_USERNAME,
        displayName: 'Phòng Đào tạo',
        passwordHash: DEMO_OFFICE_PASSWORD_HASH,
        active: true,
      };
    }
    try {
      const raw: unknown = JSON.parse(fs.readFileSync(this.accountPath, 'utf8'));
      if (!raw || typeof raw !== 'object' || !('username' in raw) || !('passwordHash' in raw)) throw new Error('Invalid account');
      return raw as OfficeAccount;
    } catch { throw new ServiceUnavailableException('Không đọc được tài khoản Phòng đào tạo'); }
  }

  private secretKey() {
    if (this.secret) return this.secret;
    const envSecret = process.env.TRAINING_OFFICE_AUTH_SECRET;
    if (envSecret) {
      if (envSecret.length < 32) throw new ServiceUnavailableException('TRAINING_OFFICE_AUTH_SECRET quá ngắn');
      this.secret = Buffer.from(envSecret);
      return this.secret;
    }
    if (!fs.existsSync(this.secretPath)) {
      try { fs.writeFileSync(this.secretPath, crypto.randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
    }
    this.secret = Buffer.from(fs.readFileSync(this.secretPath, 'utf8').trim());
    return this.secret;
  }

  private matchesPassword(password: string, encoded: string) {
    const parts = encoded.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[a-f\d]{32}$/.test(parts[1]) || !/^[a-f\d]{128}$/.test(parts[2])) return false;
    const digest = crypto.scryptSync(password, Buffer.from(parts[1], 'hex'), 64);
    return crypto.timingSafeEqual(digest, Buffer.from(parts[2], 'hex'));
  }

  login(username: unknown, password: unknown, ip: string) {
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 200 || password.length > 200 || !username.trim() || !password) throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
    const user = username.trim().toLowerCase();
    const key = `${ip}:${user}`;
    const now = Date.now();
    const old = this.attempts.get(key);
    if (old && old.deadline > now && old.count >= 5) throw new UnauthorizedException('Tạm khóa đăng nhập 15 phút');
    const a = this.account();
    const validPassword = this.matchesPassword(password, a.passwordHash) ||
      (process.env.NODE_ENV !== 'production' && a.username === DEMO_OFFICE_USERNAME &&
        this.matchesPassword(password, DEMO_OFFICE_PASSWORD_HASH));
    if (!a.active || a.username !== user || !validPassword) {
      const count = old && old.deadline > now ? old.count + 1 : 1;
      this.attempts.set(key, { count, deadline: now + 15 * 60_000 });
      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu');
    }
    this.attempts.delete(key);
    const identity: OfficeIdentity = { role: 'training_office', username: a.username, hoTen: a.displayName };
    const body = Buffer.from(JSON.stringify({ sub: a.username, exp: Math.floor(now / 1000) + MAX_AGE }), 'utf8').toString('base64url');
    const mac = crypto.createHmac('sha256', this.secretKey()).update(body).digest('base64url');
    return { identity, session: `${body}.${mac}` };
  }

  fromRequest(req: Request): OfficeIdentity {
    const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!token) throw new UnauthorizedException('Phòng đào tạo chưa đăng nhập');
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra || !/^[\w-]+$/.test(body) || !/^[\w-]+$/.test(signature)) throw new UnauthorizedException('Phiên không hợp lệ');
    const expect = crypto.createHmac('sha256', this.secretKey()).update(body).digest();
    const received = Buffer.from(signature, 'base64url');
    if (received.length !== expect.length || !crypto.timingSafeEqual(expect, received)) throw new UnauthorizedException('Phiên không hợp lệ');
    let payload: Payload;
    try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { throw new UnauthorizedException('Phiên không hợp lệ'); }
    const a = this.account();
    if (!payload || payload.exp <= Date.now() / 1000 || payload.sub !== a.username || !a.active) throw new UnauthorizedException('Phiên hết hạn hoặc bị khóa');
    return { role: 'training_office', username: a.username, hoTen: a.displayName };
  }

  private source() {
    const store = readStore();
    return { teachers: store.teachers as Teacher[], students: store.students as Student[] };
  }

  catalog(req: Request) {
    requireManager(req, this);
    const { teachers, students } = this.source();
    const list = teachers.filter(t => t.hoten && (t.shcc || t.id)).map(t => ({
      id: String(t.shcc || t.id), name: String(t.hoten), department: String(t.t_dvi || 'Chưa cập nhật bộ môn'),
      qualification: String(t.t_tdcmon || ''), expertise: String(t.t_cmdtao || ''),
    }));
    const departments = [...new Set(list.map(t => t.department))].sort((a, b) => a.localeCompare(b, 'vi'));
    // Lấy mã lớp, mã ngành và số học viên từ UI/db.json thật.
    // Một số lớp có bản ghi gắn sai ngành. Phân loại theo ngành chiếm đa số
    // và đánh dấu không cho phân công đến khi nhóm rà soát dữ liệu.
    const classIndex = new Map<string, {
      code: string;
      studentCount: number;
      majors: Map<string, { code: string; name: string; count: number }>;
      admissionYears: Map<number, number>;
      tracks: Map<string, number>;
    }>();
    const majorIndex = new Map<string, { code: string; name: string }>();
    for (const s of students) {
      const code = String(s.lop || '').trim();
      if (!code || String(s.loaiChuongTrinh || '').toLowerCase().includes('tiến sĩ')) continue;
      const majorCode = String(s.maNganh || '').trim();
      const majorName = String(s.tenNganh || '').trim();
      if (majorCode && majorName) majorIndex.set(majorCode, { code: majorCode, name: majorName });
      let row = classIndex.get(code);
      if (!row) {
        row = { code, studentCount: 0, majors: new Map(), admissionYears: new Map(), tracks: new Map() };
        classIndex.set(code, row);
      }
      row.studentCount++;
      const admissionYear = admissionYearFromRaw(s.ngayNhapHoc);
      if (admissionYear !== null) row.admissionYears.set(admissionYear, (row.admissionYears.get(admissionYear) || 0) + 1);
      const track = trackFromRaw(s.loaiChuongTrinh);
      if (track) row.tracks.set(track, (row.tracks.get(track) || 0) + 1);
      if (majorCode) {
        const current = row.majors.get(majorCode);
        if (current) current.count++;
        else row.majors.set(majorCode, { code: majorCode, name: majorName, count: 1 });
      }
    }
    const dataWarnings: string[] = [];
    const classes = [...classIndex.values()].map(row => {
      const candidates = [...row.majors.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
      const years = [...row.admissionYears.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
      const tracks = [...row.tracks.entries()].sort((a, b) => b[1] - a[1]);
      if (candidates.length > 1) dataWarnings.push(`Mã lớp ${row.code} có học viên mang nhiều mã ngành; cần kiểm tra hồ sơ trước khi phân công.`);
      if (years.length > 1) dataWarnings.push(`Lớp ${row.code} có nhiều năm nhập học khác nhau; cần kiểm tra trước khi phân công.`);
      if (tracks.length > 1) dataWarnings.push(`Lớp ${row.code} gồm nhiều định hướng đào tạo; cần xác định nhóm học viên cụ thể.`);
      return {
        code: row.code,
        studentCount: row.studentCount,
        majorCode: candidates[0]?.code ?? '',
        majorName: candidates[0]?.name ?? '',
        inconsistentMajor: candidates.length > 1,
        admissionYear: years.length === 1 ? years[0][0] : null,
        trainingTrack: tracks.length === 1 ? tracks[0][0] : null,
        inconsistentAdmissionYear: years.length > 1,
        inconsistentTrack: tracks.length > 1,
      };
    }).sort((a, b) => a.code.localeCompare(b.code, 'vi'));
    const majors = [...majorIndex.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return { success: true, departments, teachers: list, classes, majors, dataWarnings, courses: this.curriculum() };
  }

  private readAssignments(): TeachingAssignment[] {
    return readStore().teachingAssignments as TeachingAssignment[];
  }

  assignments(req: Request) {
    requireManager(req, this);
    return { success: true, data: this.readAssignments() };
  }

  // Trả dữ liệu đã LƯU từ Backend, giới hạn theo teacherId lấy từ cookie đã xác thực.
  // Không nhận mã giảng viên từ query string hoặc client khi truy xuất dữ liệu.
  // Chỉ service nội bộ gọi: phân công chính thức dùng để ghép bảng điểm học viên.
  allSavedAssignments(): TeachingAssignment[] {
    return this.readAssignments();
  }

  assignmentsForTeacher(teacherId: string) {
    return this.readAssignments()
      .filter(row => row.teacherId === teacherId)
      .sort((a, b) => b.schoolYear.localeCompare(a.schoolYear) ||
        b.semester.localeCompare(a.semester) || a.courseCode.localeCompare(b.courseCode));
  }

  scheduleForTeacher(teacherId: string) {
    const store = readStore();
    const assignments = store.teachingAssignments as TeachingAssignment[];
    const text = (value: unknown) => String(value ?? '').trim();
    const matches = (slot: Record<string, unknown>, assignment: TeachingAssignment) => {
      const assignmentId = text(slot.assignmentId || slot.maPhanCong);
      if (assignmentId) return assignmentId === assignment.id;
      const course = text(slot.courseCode || slot.maMon || slot.ma_mon).toUpperCase();
      const classCode = text(slot.classCode || slot.lop || slot.maLop);
      const teacher = text(slot.teacherId || slot.maGV || slot.ma_giang_vien);
      const year = text(slot.schoolYear || slot.namHoc || slot.nam_hoc).replace(/[–—]/g, '-').replace(/\s/g, '');
      const semester = text(slot.semester || slot.hocKy || slot.hoc_ky);
      return Boolean(course && (classCode || teacher)) &&
        course === assignment.courseCode.toUpperCase() &&
        (!classCode || classCode === assignment.classCode) &&
        (!teacher || teacher === assignment.teacherId) &&
        (!year || year === assignment.schoolYear) &&
        (!semester || semester === assignment.semester);
    };
    return assignments.filter(assignment => assignment.teacherId === teacherId).flatMap(assignment => {
      const slots = store.schedule.filter(slot => {
        const candidates = assignments.filter(row => matches(slot, row));
        return candidates.length === 1 && candidates[0].id === assignment.id;
      });
      return (slots.length ? slots : [null]).map((slot, index) => ({
        id: assignment.id + ':' + index,
        assignmentId: assignment.id,
        courseCode: assignment.courseCode,
        courseName: assignment.courseName,
        classCode: assignment.classCode,
        schoolYear: assignment.schoolYear,
        semester: assignment.semester,
        time: slot ? text(slot.thoiGian || slot.time || slot.thoi_gian) : '',
        room: slot ? text(slot.phong || slot.room) : '',
        hasSchedule: Boolean(slot),
        dayOfWeek: slot?.dayOfWeek ?? slot?.weekday ?? null,
        thu: slot?.thu ?? null,
        startPeriod: slot?.startPeriod ?? slot?.tietBatDau ?? slot?.tiet_bat_dau ?? null,
        endPeriod: slot?.endPeriod ?? slot?.tietKetThuc ?? slot?.tiet_ket_thuc ?? null,
        periodCount: slot?.periodCount ?? slot?.soTiet ?? null,
        date: slot?.date ?? slot?.ngayHoc ?? slot?.ngay_hoc ?? '',
        startDate: slot?.startDate ?? slot?.ngayBatDau ?? '',
        endDate: slot?.endDate ?? slot?.ngayKetThuc ?? '',
      }));
    }).sort((a, b) => b.schoolYear.localeCompare(a.schoolYear) ||
      a.semester.localeCompare(b.semester) || a.classCode.localeCompare(b.classCode, 'vi') ||
      a.courseCode.localeCompare(b.courseCode, 'vi'));
  }

  private curriculum(): CourseReference[] {
    const filename = path.join(projectRoot(), 'UI/data/agu_masters_curriculum.json');
    if (!fs.existsSync(filename)) throw new ServiceUnavailableException('Thiếu danh mục học phần UI/data/agu_masters_curriculum.json');
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (!Array.isArray(parsed)) throw new Error('Wrong curriculum format');
      const configured=readStore().courses || [];
      const extras=configured.map(c=>({...c,id:'configured:'+c.code,majorName:MAJOR_TO_CURRICULUM[c.majorCode]||c.majorName,needsReview:false,reviewNote:'',source:'configured',sourcePage:null}));
      return [...(parsed as CourseReference[]).filter(c=>!extras.some(e=>e.code.toUpperCase()===c.code.toUpperCase()&&e.majorName===c.majorName&&e.track===c.track)),...extras] as CourseReference[];
    } catch { throw new ServiceUnavailableException('Không đọc được danh mục chương trình đào tạo'); }
  }

  // Lưu toàn bộ các bản nháp đang hiển thị trong MỘT giao dịch ghi file.
  // Hệ thống hiện sử dụng kho JSON của Backend, chưa kết nối SQL/MySQL.
  publishAssignments(req: Request, input: unknown) {
    const office = requireManager(req, this);
    if (!input || typeof input !== 'object') throw new BadRequestException('Thiếu dữ liệu phân công');
    const payload = input as Record<string, unknown>;
    if (payload.confirmedOpen !== true) {
      throw new BadRequestException('Phòng đào tạo phải xác nhận đã kiểm tra kế hoạch mở lớp trước khi lưu');
    }
    if (!Array.isArray(payload.assignments) || !payload.assignments.length || payload.assignments.length > 60) {
      throw new BadRequestException('Phải chọn từ 1 đến 60 phân công để lưu mỗi lần');
    }

    const { teachers, classes } = this.catalog(req);
    const teacherIndex = new Map(teachers.map(t => [t.id, t]));
    const classIndex = new Map(classes.map(c => [c.code, c]));
    const courses = this.curriculum();
    const store = readStore();
    const existing = store.teachingAssignments as TeachingAssignment[];
    const keys = new Set(existing.map(r => `${r.schoolYear}|${r.semester}|${r.classCode}|${r.courseCode.toUpperCase()}`));
    const stamp = new Date().toISOString();
    const additions: TeachingAssignment[] = [];

    for (const item of payload.assignments) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new BadRequestException('Bản ghi phân công không hợp lệ');
      const r = item as Record<string, unknown>;
      const text = (name: string) => typeof r[name] === 'string' ? (r[name] as string).trim() : '';
      const teacherId = text('teacherId');
      const classCode = text('classCode');
      const courseCode = text('courseCode').toUpperCase();
      const schoolYear = text('schoolYear');
      const semester = text('semester');
      const track = text('trainingTrack');
      const teacher = teacherIndex.get(teacherId);
      const cls = classIndex.get(classCode);
      if (!teacher || !cls) throw new BadRequestException(`Không tồn tại giảng viên hoặc lớp: ${classCode}`);
      if (cls.inconsistentMajor || cls.inconsistentTrack || cls.inconsistentAdmissionYear || !cls.admissionYear || !cls.trainingTrack) {
        throw new BadRequestException(`Lớp ${classCode} có dữ liệu ngành/khóa/định hướng không đủ tin cậy`);
      }
      const match = schoolYear.match(/^(20\d{2})-(20\d{2})$/);
      if (!match || Number(match[2]) !== Number(match[1]) + 1 || !['1', '2'].includes(semester)) {
        throw new BadRequestException('Năm học hoặc học kỳ không hợp lệ');
      }
      const programSemester = (Number(match[1]) - cls.admissionYear) * 2 + Number(semester);
      if (programSemester < 1 || programSemester > 4 || track !== cls.trainingTrack) {
        throw new BadRequestException(`Lớp ${classCode} không phù hợp khóa hoặc định hướng đã chọn`);
      }
      const majorName = MAJOR_TO_CURRICULUM[cls.majorCode];
      const course = courses.find(c => c.code.toUpperCase() === courseCode && c.majorName === majorName &&
        c.track === track && !c.needsReview && Array.isArray(c.semesters) && c.semesters.includes(programSemester) &&
        (c.validFromAdmissionYear == null || (cls.admissionYear != null && cls.admissionYear >= c.validFromAdmissionYear)));
      if (!course) throw new BadRequestException(`Học phần ${courseCode} không phù hợp CTĐT/lớp ${classCode} hoặc chưa được xác minh`);
      const key = `${schoolYear}|${semester}|${classCode}|${courseCode}`;
      if (keys.has(key)) throw new ConflictException(`Đã có phân công môn ${courseCode} cho lớp ${classCode} trong ${schoolYear} học kỳ ${semester}`);
      keys.add(key);
      additions.push({
        id: crypto.randomUUID(), teacherId, teacherName: teacher.name, department: teacher.department,
        classCode, courseCode: course.code, courseName: course.name, schoolYear, semester,
        trainingTrack: cls.trainingTrack === 'nghien_cuu' || cls.trainingTrack === 'ung_dung' ? cls.trainingTrack : undefined, admissionYear: cls.admissionYear ?? undefined, programSemester,
        majorCode: cls.majorCode, majorName: cls.majorName,
        createdAt: stamp, createdBy: office.username, openingConfirmedAt: stamp,
      });
    }

    store.teachingAssignments = [...existing, ...additions];
    for (const row of additions) {
      store.gradebooks.push({ assignmentId: row.id, revision: 0, status: 'draft',
        roster: assignmentRoster(row, store.students), scores: [], updatedAt: stamp });
    }
    saveStore(store);
    return { success: true, count: additions.length, data: additions };
  }

  reassign(req: Request, id: string, body: { teacherId?: unknown; previousTeacherId?: unknown }) {
    const actor = requireManager(req, this), store=readStore(), row=store.teachingAssignments.find(a=>a.id===id);
    if (!row) throw new NotFoundException('Không tìm thấy phân công.');
    if (row.teacherId !== body?.previousTeacherId) throw new ConflictException('Phân công đã thay đổi. Hãy tải lại.');
    const teacher=store.teachers.find(t=>String(t.shcc||t.id)===body.teacherId);
    if (!teacher) throw new BadRequestException('Chọn giảng viên có trong danh mục.');
    const book=store.gradebooks.find(b=>b.assignmentId===id);
    if (book?.scores?.length || book?.publishedScores?.length || store.teacherGrades.some(g=>g.assignmentId===id)) throw new ConflictException('Không đổi giảng viên khi bảng điểm đã có dữ liệu.');
    const slots=store.schedule.filter(s=>s.assignmentId===id);
    for(const slot of slots) {
      if (store.schedule.some(s=>s.assignmentId!==id && s.teacherId===body.teacherId && s.date===slot.date && Number(s.startPeriod)<=Number(slot.endPeriod) && Number(s.endPeriod)>=Number(slot.startPeriod))) throw new ConflictException('Giảng viên mới bị trùng lịch.');
    }
    const before={...row};row.teacherId=String(teacher.shcc||teacher.id);row.teacherName=String(teacher.hoten||teacher.hoTen);row.department=String(teacher.t_dvi||'');
    for(const slot of slots) {slot.teacherId=row.teacherId;slot.teacherName=row.teacherName;}
    store.assignmentHistory??=[];store.assignmentHistory.push({action:'reassign',actor:actor.username,at:new Date().toISOString(),before,after:{...row}});saveStore(store);return {success:true,data:row};
  }

  // Phòng đào tạo được thu hồi phân công, sẽ giải phóng học phần ở danh sách chọn.
  // Khi triển khai bảng điểm thật cần khóa việc thu hồi nếu đã có điểm liên quan.
  deleteAssignment(req: Request, id: string) {
    requireManager(req, this);
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) throw new BadRequestException('Mã phân công không hợp lệ');
    const store = readStore();
    const rows = store.teachingAssignments;
    if (!rows.some(row => row.id === id)) throw new NotFoundException('Không tìm thấy phân công');
    const book = store.gradebooks.find(row => row.assignmentId === id);
    if (book?.scores?.length || book?.publishedScores?.length ||
        store.teacherGrades.some(row => row.assignmentId === id)) {
      throw new ConflictException('Không thể hủy phân công đã có điểm. Cần xử lý bảng điểm trước.');
    }
    const text = (value: unknown) => String(value ?? '').trim();
    const candidates = (slot: Record<string, unknown>) => {
      const linkedId = text(slot.assignmentId || slot.maPhanCong);
      if (linkedId) return rows.filter(row => row.id === linkedId);
      const course = text(slot.courseCode || slot.maMon || slot.ma_mon).toUpperCase();
      const cls = text(slot.classCode || slot.lop || slot.maLop);
      const teacher = text(slot.teacherId || slot.maGV || slot.ma_giang_vien);
      const year = text(slot.schoolYear || slot.namHoc || slot.nam_hoc).replace(/[–—]/g, '-').replace(/\s/g, '');
      const semester = text(slot.semester || slot.hocKy || slot.hoc_ky);
      if (!course || (!cls && !teacher)) return [];
      return rows.filter(row => row.courseCode.toUpperCase() === course && (!cls || cls === row.classCode) &&
        (!teacher || teacher === row.teacherId) && (!year || year === row.schoolYear) && (!semester || semester === row.semester));
    };
    const remainingSchedule = store.schedule.filter(slot => {
      const matches = candidates(slot);
      if (!matches.some(row => row.id === id)) return true;
      if (matches.length !== 1) throw new ConflictException('Lịch liên kết nhiều phân công. Hãy bổ sung mã phân công hoặc năm học/học kỳ trước khi hủy.');
      return false;
    });
    store.schedule = remainingSchedule;
    store.teachingAssignments = rows.filter(row => row.id !== id);
    store.gradebooks = store.gradebooks.filter(row => row.assignmentId !== id);
    saveStore(store);
    return { success: true, deletedId: id };
  }

  // Giữ endpoint cũ cho tương thích, nhưng cũng buộc xác nhận và kiểm tra CTĐT.
  saveAssignments(req: Request, input: unknown) {
    const item = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const raw = item.classCodes;
    const codes = Array.isArray(raw) ? raw : [];
    return this.publishAssignments(req, {
      confirmedOpen: item.confirmedOpen,
      assignments: codes.map(code => ({ ...item, classCode: code })),
    });
  }

  cookieName() { return COOKIE; }
  cookieMaxAgeMs() { return MAX_AGE * 1000; }
}
