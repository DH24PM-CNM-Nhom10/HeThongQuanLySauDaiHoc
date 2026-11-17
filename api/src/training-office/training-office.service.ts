import { BadRequestException, ConflictException, Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Request } from 'express';

type OfficeAccount = { username: string; displayName: string; role: 'training_office'; passwordHash: string; active: boolean };
type Payload = { sub: string; exp: number };
export type OfficeIdentity = { role: 'training_office'; username: string; hoTen: string };
type Teacher = { id?: string; shcc?: string; hoten?: string; t_dvi?: string; t_tdcmon?: string; t_cmdtao?: string };
type Student = { lop?: string; loaiChuongTrinh?: string; maNganh?: string; tenNganh?: string };
export type TeachingAssignment = {
  id: string; teacherId: string; teacherName: string; department: string;
  classCode: string; courseCode: string; courseName: string;
  schoolYear: string; semester: string; createdAt: string; createdBy: string;
};
const COOKIE = 'agu_training_office_session';
const MAX_AGE = 8 * 60 * 60;

@Injectable()
export class TrainingOfficeService {
  private readonly accountPath = path.join(process.cwd(), '.training-office-account.local.json');
  private readonly secretPath = path.join(process.cwd(), '.training-office-auth-secret');
  private readonly assignmentPath = path.join(process.cwd(), '.training-assignments.local.json');
  private secret: Buffer | null = null;
  private readonly attempts = new Map<string, { count: number; deadline: number }>();

  private account(): OfficeAccount {
    if (!fs.existsSync(this.accountPath)) throw new ServiceUnavailableException('Chưa tạo tài khoản Phòng đào tạo; chạy lệnh seed trước');
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
    if (!a.active || a.username !== user || !this.matchesPassword(password, a.passwordHash)) {
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
    const p = path.resolve(process.cwd(), '../UI/db.json');
    if (!fs.existsSync(p)) throw new ServiceUnavailableException('Thiếu UI/db.json – chưa có dữ liệu bộ môn và lớp');
    let raw: unknown;
    try { raw = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { throw new ServiceUnavailableException('Không đọc được UI/db.json'); }
    if (!raw || typeof raw !== 'object') throw new ServiceUnavailableException('Dữ liệu nguồn không hợp lệ');
    const obj = raw as { teachers?: unknown; students?: unknown };
    return { teachers: (Array.isArray(obj.teachers) ? obj.teachers : []) as Teacher[], students: (Array.isArray(obj.students) ? obj.students : []) as Student[] };
  }

  catalog(req: Request) {
    this.fromRequest(req);
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
        row = { code, studentCount: 0, majors: new Map() };
        classIndex.set(code, row);
      }
      row.studentCount++;
      if (majorCode) {
        const current = row.majors.get(majorCode);
        if (current) current.count++;
        else row.majors.set(majorCode, { code: majorCode, name: majorName, count: 1 });
      }
    }
    const dataWarnings: string[] = [];
    const classes = [...classIndex.values()].map(row => {
      const candidates = [...row.majors.values()].sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
      if (candidates.length > 1) {
        dataWarnings.push(`Mã lớp ${row.code} có học viên mang nhiều mã ngành; cần kiểm tra hồ sơ trước khi phân công.`);
      }
      return {
        code: row.code,
        studentCount: row.studentCount,
        majorCode: candidates[0]?.code ?? '',
        majorName: candidates[0]?.name ?? '',
        inconsistentMajor: candidates.length > 1,
      };
    }).sort((a, b) => a.code.localeCompare(b.code, 'vi'));
    const majors = [...majorIndex.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return { success: true, departments, teachers: list, classes, majors, dataWarnings };
  }

  private readAssignments(): TeachingAssignment[] {
    if (!fs.existsSync(this.assignmentPath)) return [];
    try { const raw: unknown = JSON.parse(fs.readFileSync(this.assignmentPath, 'utf8')); return Array.isArray(raw) ? raw as TeachingAssignment[] : []; }
    catch { throw new ServiceUnavailableException('Không đọc được dữ liệu phân công'); }
  }

  assignments(req: Request) {
    this.fromRequest(req);
    return { success: true, data: this.readAssignments() };
  }

  saveAssignments(req: Request, input: unknown) {
    const user = this.fromRequest(req);
    if (!input || typeof input !== 'object') throw new BadRequestException('Thiếu dữ liệu phân công');
    const b = input as Record<string, unknown>;
    const str = (key: string) => typeof b[key] === 'string' ? (b[key] as string).trim() : '';
    const teacherId = str('teacherId');
    const courseCode = str('courseCode').toUpperCase();
    const courseName = str('courseName');
    const schoolYear = str('schoolYear');
    const semester = str('semester');
    const classCodes = Array.isArray(b.classCodes) ? b.classCodes : [];
    if (!teacherId || !/^[\p{L}\p{N} ._-]{2,30}$/u.test(courseCode) || courseName.length < 2 || courseName.length > 150 || !/^20\d{2}-20\d{2}$/.test(schoolYear) || !['1','2','3'].includes(semester) || classCodes.length < 1 || classCodes.length > 30 || !classCodes.every(x => typeof x === 'string')) throw new BadRequestException('Thông tin học phần/năm học/lớp không hợp lệ');
    const distinct = [...new Set(classCodes as string[])];
    const { teachers, classes } = this.catalog(req);
    const teacher = teachers.find(t => t.id === teacherId);
    if (!teacher) throw new BadRequestException('Giảng viên không tồn tại');
    const validCodes = new Set(classes.map(c => c.code));
    if (distinct.some(c => !validCodes.has(c))) throw new BadRequestException('Lớp học không tồn tại trong dữ liệu hiện có');
    if (distinct.some(code => classes.find(c => c.code === code)?.inconsistentMajor)) {
      throw new BadRequestException('Lớp có dữ liệu ngành không nhất quán; cần kiểm tra hồ sơ học viên trước khi phân công');
    }
    const rows = this.readAssignments();
    const hasDuplicate = distinct.some(code => rows.some(r => r.classCode === code && r.courseCode === courseCode && r.schoolYear === schoolYear && r.semester === semester));
    if (hasDuplicate) throw new ConflictException('Lớp học phần đã được phân công trong năm học/học kỳ này; không tạo bản ghi trùng');
    const stamp = new Date().toISOString();
    const additions: TeachingAssignment[] = distinct.map(code => ({
      id: crypto.randomUUID(), teacherId, teacherName: teacher.name, department: teacher.department,
      classCode: code, courseCode, courseName, schoolYear, semester, createdAt: stamp, createdBy: user.username,
    }));
    const temp = `${this.assignmentPath}.tmp`;
    try { fs.writeFileSync(temp, JSON.stringify([...rows,...additions], null, 2), { mode: 0o600 }); fs.renameSync(temp, this.assignmentPath); }
    catch { throw new ServiceUnavailableException('Không lưu được phân công'); }
    return { success: true, count: additions.length, data: additions };
  }

  cookieName() { return COOKIE; }
  cookieMaxAgeMs() { return MAX_AGE * 1000; }
}
