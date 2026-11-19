import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readStore, studentCode } from '../common/data-store';
import type { Request } from 'express';

export type StudentIdentity = {
  role: 'student'; maHocVien: string; hoTen: string; email: string;
};
type SourceStudent = Record<string, unknown>;
type Session = { sub: string; exp: number };
const COOKIE = 'agu_student_grades_session';
const MAX_AGE_SECONDS = 8 * 60 * 60;

/** Xác thực chỉ phục vụ tài khoản học viên DEMO theo quy tắc mật khẩu = mã học viên.
 * Cần thay bằng hệ thống định danh thực trước khi triển khai với dữ liệu thật.
 */
@Injectable()
export class StudentRecordsService {
  private readonly secretFile = path.join(process.cwd(), '.student-auth-secret');
  private secret: Buffer | null = null;
  private readonly attempts = new Map<string, { count: number; until: number }>();

  cookieName() { return COOKIE; }
  cookieMaxAgeMs() { return MAX_AGE_SECONDS * 1000; }

  private secretKey(): Buffer {
    if (this.secret) return this.secret;
    const fromEnv = process.env.STUDENT_DEMO_AUTH_SECRET;
    if (fromEnv) {
      if (fromEnv.length < 32) throw new ServiceUnavailableException('STUDENT_DEMO_AUTH_SECRET phải có tối thiểu 32 ký tự');
      this.secret = Buffer.from(fromEnv, 'utf8');
      return this.secret;
    }
    if (!fs.existsSync(this.secretFile)) {
      try { fs.writeFileSync(this.secretFile, crypto.randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    }
    this.secret = Buffer.from(fs.readFileSync(this.secretFile, 'utf8').trim(), 'utf8');
    return this.secret;
  }

  private students(): SourceStudent[] {
    return readStore().students as SourceStudent[];
  }

  private findStudent(code: string): StudentIdentity | null {
    const input = code.trim().toLowerCase();
    const matches = this.students().filter(item => {
      const id = studentCode(item).toLowerCase();
      const email = String(item.email || item.Email || '').trim().toLowerCase();
      return Boolean(id && (input === id || input === email ||
        input === id + '@student.agu.edu.vn' || input === id + '@agu.edu.vn'));
    });
    if (matches.length !== 1) return null;
    const student = matches[0];
    const maHocVien = String(student.maHocVien || student.ma_hoc_vien || student.MA_HOC_VIEN || student.mahv || '').trim();
    return { role: 'student', maHocVien, hoTen: String(student.hoTen || student.ho_ten || student.HO_TEN || 'Học viên').trim(),
      email: String(student.email || `${maHocVien}@student.agu.edu.vn`) };
  }

  login(username: unknown, password: unknown, ip: string) {
    // Không bật mật khẩu demo dễ đoán ở môi trường sản xuất nếu không cho phép rõ ràng.
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEMO_STUDENT_AUTH !== 'true') {
      throw new ServiceUnavailableException('Đăng nhập học viên demo đã bị tắt trên môi trường production');
    }
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 200 || password.length > 200) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu học viên');
    }
    const normalized = username.trim().toLowerCase();
    const code = normalized;
    const key = `${ip}:${code}`;
    const now = Date.now();
    const previous = this.attempts.get(key);
    if (previous && previous.until > now && previous.count >= 5) throw new UnauthorizedException('Tài khoản bị tạm khóa 15 phút');
    const student = code ? this.findStudent(code) : null;
    // Chỉ áp dụng cho DEMO: mật khẩu được đặt là mã học viên.
    const ok = student && password === student.maHocVien;
    if (!ok) {
      this.attempts.set(key, { count: previous && previous.until > now ? previous.count + 1 : 1,
        until: now + 15 * 60_000 });
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu học viên');
    }
    this.attempts.delete(key);
    const content = Buffer.from(JSON.stringify({ sub: student.maHocVien,
      exp: Math.floor(now / 1000) + MAX_AGE_SECONDS } satisfies Session)).toString('base64url');
    const mac = crypto.createHmac('sha256', this.secretKey()).update(content).digest('base64url');
    return { user: student, session: `${content}.${mac}` };
  }

  fromRequest(req: Request): StudentIdentity {
    const raw = (req.headers.cookie || '').split(';').map(v => v.trim())
      .find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!raw) throw new UnauthorizedException('Học viên cần đăng nhập lại');
    const [content, mac, extra] = raw.split('.');
    if (!content || !mac || extra || !/^[a-zA-Z0-9_-]+$/.test(content) || !/^[a-zA-Z0-9_-]+$/.test(mac)) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
    const expected = crypto.createHmac('sha256', this.secretKey()).update(content).digest();
    const supplied = Buffer.from(mac, 'base64url');
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
    let payload: Session;
    try { payload = JSON.parse(Buffer.from(content, 'base64url').toString('utf8')) as Session; }
    catch { throw new UnauthorizedException('Phiên đăng nhập không hợp lệ'); }
    if (!payload || !Number.isInteger(payload.exp) || payload.exp <= Date.now() / 1000 || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }
    const student = this.findStudent(payload.sub);
    if (!student) throw new UnauthorizedException('Không tìm thấy tài khoản học viên');
    return student;
  }
}
