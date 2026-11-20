import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { projectRoot, readStore } from '../common/data-store';
import { nextTeacherUsername } from '../../../shared/teacher-account-username.cjs';
import type { Request } from 'express';

export type TeacherIdentity = {
  role: 'teacher';
  teacherId: string;
  hoTen: string;
  username: string;
  mustChangePassword: boolean;
  shcc?: string;
};

export type TeacherProfile = TeacherIdentity & {
  gioiTinh?: string;
  donVi?: string;
  trinhDoChuyenMon?: string;
  hocHam?: string;
  chuyenMonDaoTao?: string;
};

type TeacherSourceRecord = {
  id?: string;
  shcc?: string;
  hoten?: string;
  gioitinh?: string;
  t_dvi?: string;
  t_tdcmon?: string;
  t_hham?: string;
  t_cmdtao?: string;
};

type TeacherAccount = {
  teacherId: string;
  hoTen: string;
  username: string;
  shcc?: string;
  passwordHash: string;
  mustChangePassword?: boolean;
  sessionVersion?: number;
  active: boolean;
};

type SessionPayload = { sub: string; exp: number; v?: number };
const COOKIE_NAME = 'agu_teacher_session';
const SESSION_SECONDS = 8 * 60 * 60;

@Injectable()
export class TeacherAuthService {
  private readonly accountsFile = path.join(projectRoot(), 'api', '.teacher-accounts.local.json');
  private readonly secretFile = path.join(projectRoot(), 'api', '.teacher-auth-secret');
  private secret: Buffer | null = null;
  private readonly failures = new Map<string, { count: number; until: number }>();

  private accounts(): TeacherAccount[] {
    if (!fs.existsSync(this.accountsFile)) return [];
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.accountsFile, 'utf8'));
      return Array.isArray(parsed) ? parsed as TeacherAccount[] : [];
    } catch {
      throw new ServiceUnavailableException('Không đọc được kho tài khoản giảng viên');
    }
  }

  private saveAccounts(accounts: TeacherAccount[]) {
    fs.mkdirSync(path.dirname(this.accountsFile), { recursive: true, mode: 0o700 });
    const temporary = `${this.accountsFile}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporary, JSON.stringify(accounts, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
      fs.renameSync(temporary, this.accountsFile);
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }

  private getSecret(): Buffer {
    if (this.secret) return this.secret;
    if (process.env.TEACHER_AUTH_SECRET) {
      if (process.env.TEACHER_AUTH_SECRET.length < 32) {
        throw new ServiceUnavailableException('TEACHER_AUTH_SECRET phải dài ít nhất 32 ký tự');
      }
      this.secret = Buffer.from(process.env.TEACHER_AUTH_SECRET, 'utf8');
      return this.secret;
    }
    if (!fs.existsSync(this.secretFile)) {
      try {
        fs.writeFileSync(this.secretFile, crypto.randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    }
    this.secret = Buffer.from(fs.readFileSync(this.secretFile, 'utf8').trim(), 'utf8');
    return this.secret;
  }

  private matchesPassword(password: string, encoded: string): boolean {
    const parts = encoded.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
    const hash = crypto.scryptSync(password, Buffer.from(parts[1], 'hex'), 64);
    const expected = Buffer.from(parts[2], 'hex');
    return crypto.timingSafeEqual(hash, expected);
  }

  private hashPassword(password: string): string {
    const salt = crypto.randomBytes(16);
    return `scrypt$${salt.toString('hex')}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
  }

  private matchesInitialPassword(password: string, initialPassword: string): boolean {
    const candidate = Buffer.from(password, 'utf8');
    const expected = Buffer.from(initialPassword, 'utf8');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  }

  private accountFromSource(username: string, accounts: TeacherAccount[]): TeacherAccount | null {
    const existingIds = new Set(accounts.map(account => account.teacherId));
    const usedUsernames = new Set(accounts.map(account => account.username.toLowerCase()));
    const teachers = readStore().teachers as TeacherSourceRecord[];
    for (const teacher of teachers) {
      const teacherId = String(teacher.shcc || teacher.id || '').trim();
      const hoTen = String(teacher.hoten || '').trim();
      if (!teacherId || !hoTen || existingIds.has(teacherId)) continue;
      const generatedUsername = nextTeacherUsername(hoTen, usedUsernames);
      if (generatedUsername.toLowerCase() !== username) continue;
      return {
        teacherId,
        hoTen,
        username: generatedUsername,
        ...(teacher.shcc ? { shcc: String(teacher.shcc) } : {}),
        passwordHash: '',
        mustChangePassword: true,
        sessionVersion: 0,
        active: true,
      };
    }
    return null;
  }

  login(username: unknown, password: unknown, clientAddress: string): { identity: TeacherIdentity; session: string } {
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 200 || password.length > 200 || !username.trim() || !password) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    const normalized = username.trim().toLowerCase();
    const throttleKey = `${clientAddress}:${normalized}`;
    const now = Date.now();
    const current = this.failures.get(throttleKey);
    if (current && current.count >= 5 && now < current.until) {
      throw new UnauthorizedException('Đăng nhập thất bại quá nhiều lần; thử lại sau 15 phút');
    }
    const accounts = this.accounts();
    let account = accounts.find((item) => item.username === normalized && item.active);
    if (!account && process.env.NODE_ENV !== 'production') {
      const candidate = this.accountFromSource(normalized, accounts);
      if (candidate && this.matchesInitialPassword(password, candidate.teacherId)) {
        candidate.passwordHash = this.hashPassword(candidate.teacherId);
        accounts.push(candidate);
        this.saveAccounts(accounts);
        account = candidate;
      }
    }
    if (!account || !this.matchesPassword(password, account.passwordHash)) {
      const count = current && now < current.until ? current.count + 1 : 1;
      this.failures.set(throttleKey, { count, until: now + 15 * 60_000 });
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    this.failures.delete(throttleKey);
    const identity = this.publicIdentity(account);
    return {
      identity,
      session: this.sign({
        sub: account.teacherId,
        exp: Math.floor(now / 1000) + SESSION_SECONDS,
        v: account.sessionVersion ?? 0,
      }),
    };
  }

  private publicIdentity(account: TeacherAccount): TeacherIdentity {
    return {
      role: 'teacher',
      teacherId: account.teacherId,
      hoTen: account.hoTen,
      username: account.username,
      mustChangePassword: Boolean(account.mustChangePassword),
      ...(account.shcc ? { shcc: account.shcc } : {}),
    };
  }

  private sign(payload: SessionPayload): string {
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const mac = crypto.createHmac('sha256', this.getSecret()).update(body).digest('base64url');
    return `${body}.${mac}`;
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
    const account = accounts.find(item => item.teacherId === identity.teacherId && item.active);
    if (!account || !this.matchesPassword(currentPassword, account.passwordHash)) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng.');
    }
    account.passwordHash = this.hashPassword(newPassword);
    account.mustChangePassword = false;
    const sessionVersion = (account.sessionVersion ?? 0) + 1;
    account.sessionVersion = sessionVersion;
    this.saveAccounts(accounts);
    return {
      identity: this.publicIdentity(account),
      session: this.sign({
        sub: account.teacherId,
        exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
        v: sessionVersion,
      }),
    };
  }

  fromRequest(req: Request, allowPasswordChange = false): TeacherIdentity {
    const rawCookie = (req.headers.cookie ?? '').split(';').map((entry) => entry.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
    if (!rawCookie) throw new UnauthorizedException('Giảng viên chưa đăng nhập');
    const token = rawCookie.slice(COOKIE_NAME.length + 1);
    const [body, sig, ...extras] = token.split('.');
    if (!body || !sig || extras.length || !/^[A-Za-z0-9_-]+$/.test(body)) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    const expected = crypto.createHmac('sha256', this.getSecret()).update(body).digest();
    let received: Buffer;
    try { received = Buffer.from(sig, 'base64url'); } catch { throw new UnauthorizedException('Phiên đăng nhập không hợp lệ'); }
    if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    let payload: SessionPayload;
    try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { throw new UnauthorizedException('Phiên đăng nhập không hợp lệ'); }
    if (!payload || typeof payload.sub !== 'string' || typeof payload.exp !== 'number' || payload.exp <= Date.now() / 1000) throw new UnauthorizedException('Phiên đăng nhập hết hạn');
    const account = this.accounts().find((item) => item.teacherId === payload.sub && item.active);
    if (!account) throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã khóa');
    if ((payload.v ?? 0) !== (account.sessionVersion ?? 0)) throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    if (account.mustChangePassword && !allowPasswordChange) {
      throw new ForbiddenException('Bạn phải đổi mật khẩu trước khi sử dụng hệ thống.');
    }
    return this.publicIdentity(account);
  }

  // Chỉ trả hồ sơ của chính giảng viên đã xác thực bằng cookie.
  // Cùng nguồn dữ liệu mà script seed-teacher-accounts.cjs đang sử dụng.
  getOwnProfile(req: Request): TeacherProfile {
    const identity = this.fromRequest(req);
    const teacher = readStore().teachers.find(row => String(row.shcc || row.id || '') === identity.teacherId) as TeacherSourceRecord | undefined;
    if (teacher) {
      const value = (input: unknown): string | undefined =>
        typeof input === 'string' && input.trim() ? input.trim() : undefined;
      return { ...identity, gioiTinh: value(teacher.gioitinh), donVi: value(teacher.t_dvi),
        trinhDoChuyenMon: value(teacher.t_tdcmon), hocHam: value(teacher.t_hham), chuyenMonDaoTao: value(teacher.t_cmdtao) };
    }
    // Vẫn cho phép xem dữ liệu phiên nếu hồ sơ nguồn chưa tồn tại.
    return identity;
  }

  cookieName() { return COOKIE_NAME; }
  cookieMaxAgeMs() { return SESSION_SECONDS * 1000; }
}
