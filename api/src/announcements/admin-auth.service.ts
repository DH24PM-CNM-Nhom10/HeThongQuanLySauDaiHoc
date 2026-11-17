import 'dotenv/config';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

const COOKIE_NAME = 'agu_admin_session';
const EXPIRES_IN_SECONDS = 60 * 60 * 8;

@Injectable()
export class AdminAuthService {
  private readonly secret = process.env.ADMIN_SESSION_SECRET || '';

  assertConfigured() {
    if (this.secret.length < 32 || !process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
      throw new ServiceUnavailableException('Chưa cấu hình ADMIN_USERNAME, ADMIN_PASSWORD hoặc ADMIN_SESSION_SECRET (>= 32 ký tự).');
    }
  }

  verifyLogin(username: string, password: string) {
    this.assertConfigured();
    const expectedUser = Buffer.from(process.env.ADMIN_USERNAME || '', 'utf8');
    const expectedPass = Buffer.from(process.env.ADMIN_PASSWORD || '', 'utf8');
    const actualUser = Buffer.from(username, 'utf8');
    const actualPass = Buffer.from(password, 'utf8');
    return this.equal(expectedUser, actualUser) && this.equal(expectedPass, actualPass);
  }

  createToken() {
    this.assertConfigured();
    const payload = Buffer.from(JSON.stringify({ role: 'admin', exp: Math.floor(Date.now() / 1000) + EXPIRES_IN_SECONDS })).toString('base64url');
    const mac = createHmac('sha256', this.secret).update(payload).digest('base64url');
    return `${payload}.${mac}`;
  }

  isAdmin(req: Request) {
    if (this.secret.length < 32) return false;
    const raw = req.headers.cookie || '';
    const token = raw.split(';').map((v) => v.trim()).find((v) => v.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
    if (!token) return false;
    const [payload, mac, extra] = token.split('.');
    if (!payload || !mac || extra) return false;
    const expected = createHmac('sha256', this.secret).update(payload).digest('base64url');
    if (!this.equal(Buffer.from(expected), Buffer.from(mac))) return false;
    try {
      const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      return !!parsed && typeof parsed === 'object' && 'role' in parsed && 'exp' in parsed &&
        parsed.role === 'admin' && typeof parsed.exp === 'number' && parsed.exp > Date.now() / 1000;
    } catch { return false; }
  }

  private equal(a: Buffer, b: Buffer) {
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
export { COOKIE_NAME, EXPIRES_IN_SECONDS };
