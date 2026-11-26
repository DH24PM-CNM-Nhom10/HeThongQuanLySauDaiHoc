import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';
import { projectRoot } from './data-store';
import type { Request } from 'express';

export function requireAdminIdentity(req: Pick<Request, 'headers'>) {
    const token = String(req.headers.cookie || '').split(';').map(v => v.trim())
      .find(v => v.startsWith('agu_session='))?.slice('agu_session='.length);
    try {
      const envPath = path.join(projectRoot(), 'UI', '.env.local');
      const configured = fs.existsSync(envPath) ? parse(fs.readFileSync(envPath)) : {};
      const secret = process.env.AGU_SESSION_SECRET || configured.AGU_SESSION_SECRET;
      if (!secret || secret.length < 32 || !token) throw new Error();
      const [body, signature, extra] = token.split('.');
      if (!body || !signature || extra) throw new Error();
      const expected = createHmac('sha256', secret).update(body).digest();
      const actual = Buffer.from(signature, 'base64url');
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error();
      const session = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (session.user?.role !== 'admin' || !Number.isFinite(session.exp) || session.exp <= Date.now() / 1000) throw new Error();
      return session.user as { role: "admin"; hoTen?: string };
    } catch {
      throw new UnauthorizedException('Cần đăng nhập quản trị viên');
    }
  }

@Injectable()
export class AdminSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.adminUser = requireAdminIdentity(req);
    return true;
  }
}
