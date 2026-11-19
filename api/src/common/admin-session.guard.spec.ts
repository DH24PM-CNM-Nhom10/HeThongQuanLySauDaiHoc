import { AdminSessionGuard } from './admin-session.guard';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { createHmac } from 'node:crypto';

describe('Quyền quản trị tại API', () => {
  const secret = 'test-only-admin-secret-long-enough';
  let old: string | undefined;
  beforeEach(() => { old = process.env.AGU_SESSION_SECRET; process.env.AGU_SESSION_SECRET = secret; });
  afterEach(() => { if (old === undefined) delete process.env.AGU_SESSION_SECRET; else process.env.AGU_SESSION_SECRET = old; });
  function context(cookie = '') {
    return { switchToHttp: () => ({ getRequest: () => ({ headers: { cookie } }) }) } as unknown as ExecutionContext;
  }
  function cookie(role: string, exp = Math.floor(Date.now() / 1000) + 60) {
    const body = Buffer.from(JSON.stringify({ user: { role }, exp })).toString('base64url');
    return 'agu_session=' + body + '.' + createHmac('sha256', secret).update(body).digest('base64url');
  }
  it('chặn thiếu phiên, sai vai trò và phiên hết hạn', () => {
    const guard = new AdminSessionGuard();
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context(cookie('student')))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context(cookie('admin', 1)))).toThrow(UnauthorizedException);
  });
  it('chỉ nhận cookie quản trị có chữ ký hợp lệ', () => {
    const guard = new AdminSessionGuard();
    expect(guard.canActivate(context(cookie('admin')))).toBe(true);
    expect(() => guard.canActivate(context(cookie('admin') + 'bad'))).toThrow(UnauthorizedException);
  });
});
