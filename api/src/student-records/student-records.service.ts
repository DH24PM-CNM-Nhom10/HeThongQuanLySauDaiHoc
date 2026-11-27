import { isMasterStudent } from '../../../shared/masters-scope.cjs';
import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { projectRoot, readStore, studentCode } from '../common/data-store';
import type { Request } from 'express';

export type StudentIdentity = {
  role: 'student'; maHocVien: string; hoTen: string; email: string; mustChangePassword: boolean;
};
type SourceStudent = Record<string, unknown>;
type StudentAccount = {
  maHocVien: string;
  passwordHash: string;
  mustChangePassword: boolean;
  sessionVersion: number;
  active: boolean;
};
type Session = { sub: string; exp: number; v?: number };
const COOKIE = 'agu_student_grades_session';
const MAX_AGE_SECONDS = 8 * 60 * 60;

@Injectable()
export class StudentRecordsService {
  private readonly accountsFile = path.join(projectRoot(), 'api', '.student-accounts.local.json');
  private readonly secretFile = path.join(projectRoot(), 'api', '.student-auth-secret');
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
    return readStore().students.filter(isMasterStudent) as SourceStudent[];
  }

  private findStudent(code: string): SourceStudent | null {
    const input = code.trim().toLowerCase();
    const matches = this.students().filter(item => {
      const id = studentCode(item).toLowerCase();
      const email = String(item.email || item.Email || '').trim().toLowerCase();
      return Boolean(id && (input === id || input === email ||
        input === `${id}@agu.edu.vn` || input === `${id}@student.agu.edu.vn`));
    });
    if (matches.length !== 1) return null;
    return matches[0];
  }

  private identity(student: SourceStudent): StudentIdentity {
    const maHocVien = studentCode(student);
    return {
      role: 'student',
      maHocVien,
      hoTen: String(student.hoTen || student.ho_ten || student.HO_TEN || 'Học viên').trim(),
      email: String(student.email || `${maHocVien}@student.agu.edu.vn`),
      mustChangePassword: false,
    };
  }

  private initialPassword(student: SourceStudent): string {
    return studentCode(student);
  }

  private accounts(): StudentAccount[] {
    if (!fs.existsSync(this.accountsFile)) return [];
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.accountsFile, 'utf8'));
      if (Array.isArray(parsed)) return parsed as StudentAccount[];
    } catch {
      throw new ServiceUnavailableException('Không đọc được kho tài khoản học viên');
    }
    throw new ServiceUnavailableException('Kho tài khoản học viên không đúng định dạng');
  }

  private saveAccounts(accounts: StudentAccount[]) {
    fs.mkdirSync(path.dirname(this.accountsFile), { recursive: true, mode: 0o700 });
    const temporary = `${this.accountsFile}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(accounts, null, 2), { mode: 0o600, flag: 'wx' });
      fs.renameSync(temporary, this.accountsFile);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }

  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16);
    return `scrypt$${salt.toString('hex')}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
  }

  private matchesPassword(password: string, encoded: string): boolean {
    const [algorithm, salt, digest, ...extra] = encoded.split('$');
    if (algorithm !== 'scrypt' || extra.length ||
      !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(digest || '')) return false;
    const expected = Buffer.from(digest, 'hex');
    return crypto.timingSafeEqual(
      crypto.scryptSync(password, Buffer.from(salt, 'hex'), 64),
      expected,
    );
  }

  private matchesInitialPassword(password: string, initialPassword: string): boolean {
    const candidate = Buffer.from(password, 'utf8');
    const expected = Buffer.from(initialPassword, 'utf8');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  }

  private createSession(maHocVien: string, sessionVersion: number): string {
    const content = Buffer.from(JSON.stringify({
      sub: maHocVien,
      exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
      v: sessionVersion,
    } satisfies Session)).toString('base64url');
    const mac = crypto.createHmac('sha256', this.secretKey()).update(content).digest('base64url');
    return `${content}.${mac}`;
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
    const maHocVien = student ? studentCode(student) : '';
    const accounts = this.accounts();
    let account = accounts.find(item => item.maHocVien.toUpperCase() === maHocVien);
    const firstPassword = !account && student ? this.initialPassword(student) : '';
    const valid = student && (account
      ? account.active && this.matchesPassword(password, account.passwordHash)
      : Boolean(firstPassword) && this.matchesInitialPassword(password, firstPassword));
    if (!valid || !account && !firstPassword) {
      this.attempts.set(key, { count: previous && previous.until > now ? previous.count + 1 : 1,
        until: now + 15 * 60_000 });
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu học viên');
    }
    if (!account && student) {
      account = {
        maHocVien,
        passwordHash: this.hashPassword(firstPassword),
        mustChangePassword: false,
        sessionVersion: 0,
        active: true,
      };
      accounts.push(account);
      this.saveAccounts(accounts);
    }
    this.attempts.delete(key);
    return {
      user: this.identity(student),
      session: this.createSession(maHocVien, account?.sessionVersion ?? 0),
    };
  }

  changePassword(req: Request, currentPassword: unknown, newPassword: unknown) {
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' ||
      newPassword.trim().length < 8 || newPassword.length > 128) {
      throw new BadRequestException('Mật khẩu mới phải có ít nhất 8 ký tự và không quá 128 ký tự.');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại.');
    }
    const identity = this.fromRequest(req, true);
    const accounts = this.accounts();
    const account = accounts.find(item => item.maHocVien.toUpperCase() === identity.maHocVien.toUpperCase() && item.active);
    if (!account || !this.matchesPassword(currentPassword, account.passwordHash)) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng.');
    }
    account.passwordHash = this.hashPassword(newPassword);
    account.mustChangePassword = false;
    account.sessionVersion = (account.sessionVersion ?? 0) + 1;
    this.saveAccounts(accounts);
    return {
      user: { ...identity, mustChangePassword: false },
      session: this.createSession(identity.maHocVien, account.sessionVersion),
    };
  }

  fromRequest(req: Request, _allowPasswordChange = false): StudentIdentity {
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
    const account = this.accounts().find(item => item.maHocVien === studentCode(student) && item.active);
    if (!account || (payload.v ?? 0) !== (account.sessionVersion ?? 0)) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }

    return this.identity(student);
  }
}
