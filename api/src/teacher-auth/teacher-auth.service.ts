import { Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Request } from 'express';

export type TeacherIdentity = {
  role: 'teacher';
  teacherId: string;
  hoTen: string;
  username: string;
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
  active: boolean;
};

type SessionPayload = { sub: string; exp: number };
const COOKIE_NAME = 'agu_teacher_session';
const SESSION_SECONDS = 8 * 60 * 60;

@Injectable()
export class TeacherAuthService {
  private readonly accountsFile = path.join(process.cwd(), '.teacher-accounts.local.json');
  private readonly secretFile = path.join(process.cwd(), '.teacher-auth-secret');
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
    const account = this.accounts().find((item) => item.username === normalized && item.active);
    if (!account || !this.matchesPassword(password, account.passwordHash)) {
      const count = current && now < current.until ? current.count + 1 : 1;
      this.failures.set(throttleKey, { count, until: now + 15 * 60_000 });
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    this.failures.delete(throttleKey);
    const identity = this.publicIdentity(account);
    return { identity, session: this.sign({ sub: account.teacherId, exp: Math.floor(now / 1000) + SESSION_SECONDS }) };
  }

  private publicIdentity(account: TeacherAccount): TeacherIdentity {
    return { role: 'teacher', teacherId: account.teacherId, hoTen: account.hoTen, username: account.username, ...(account.shcc ? { shcc: account.shcc } : {}) };
  }

  private sign(payload: SessionPayload): string {
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const mac = crypto.createHmac('sha256', this.getSecret()).update(body).digest('base64url');
    return `${body}.${mac}`;
  }

  fromRequest(req: Request): TeacherIdentity {
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
    return this.publicIdentity(account);
  }

  // Chỉ trả hồ sơ của chính giảng viên đã xác thực bằng cookie.
  // Cùng nguồn dữ liệu mà script seed-teacher-accounts.cjs đang sử dụng.
  getOwnProfile(req: Request): TeacherProfile {
    const identity = this.fromRequest(req);
    const paths = [
      path.resolve(process.cwd(), '../UI/db.json'),
      path.join(process.cwd(), 'db.json'),
    ];

    for (const file of paths) {
      if (!fs.existsSync(file)) continue;
      let raw: unknown;
      try {
        raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        continue;
      }
      if (!raw || typeof raw !== 'object' || !('teachers' in raw)) continue;
      const teachers = (raw as { teachers?: unknown }).teachers;
      if (!Array.isArray(teachers)) continue;
      const teacher = teachers.find((row: unknown) => {
        if (!row || typeof row !== 'object') return false;
        const data = row as TeacherSourceRecord;
        // Không dùng họ tên làm khóa tra cứu vì có thể trùng người.
        return String(data.shcc || data.id || '') === identity.teacherId;
      }) as TeacherSourceRecord | undefined;
      if (!teacher) continue;
      const value = (input: unknown): string | undefined =>
        typeof input === 'string' && input.trim() ? input.trim() : undefined;
      return {
        ...identity,
        gioiTinh: value(teacher.gioitinh),
        donVi: value(teacher.t_dvi),
        trinhDoChuyenMon: value(teacher.t_tdcmon),
        hocHam: value(teacher.t_hham),
        chuyenMonDaoTao: value(teacher.t_cmdtao),
      };
    }
    // Vẫn cho phép xem dữ liệu phiên nếu hồ sơ nguồn chưa tồn tại.
    return identity;
  }

  cookieName() { return COOKIE_NAME; }
  cookieMaxAgeMs() { return SESSION_SECONDS * 1000; }
}
