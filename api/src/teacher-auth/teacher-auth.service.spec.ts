import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request } from 'express';
import { TeacherAuthService } from './teacher-auth.service';

describe('Teacher password onboarding and change', () => {
  let root: string;
  let oldRoot: string | undefined;
  let oldSecret: string | undefined;

  beforeEach(() => {
    oldRoot = process.env.QLDT_DATA_ROOT;
    oldSecret = process.env.TEACHER_AUTH_SECRET;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qldt-teacher-auth-'));
    fs.mkdirSync(path.join(root, 'UI'));
    fs.mkdirSync(path.join(root, 'api'));
    fs.writeFileSync(path.join(root, 'UI', 'db.json'), JSON.stringify({ teachers: [], students: [] }));

    process.env.QLDT_DATA_ROOT = root;
    process.env.TEACHER_AUTH_SECRET = 'fixture-teacher-secret-at-least-32-characters';
    const salt = crypto.randomBytes(16);
    const passwordHash = `scrypt$${salt.toString('hex')}$${crypto.scryptSync('GV001', salt, 64).toString('hex')}`;
    fs.writeFileSync(path.join(root, 'api', '.teacher-accounts.local.json'), JSON.stringify([{
      teacherId: 'GV001',
      shcc: 'GV001',
      hoTen: 'Giảng viên thử nghiệm',
      username: 'lehoanganh@teacher.agu.edu.vn',
      passwordHash,
      mustChangePassword: true,
      sessionVersion: 0,
      active: true,
    }]));
  });

  afterEach(() => {
    if (oldRoot === undefined) delete process.env.QLDT_DATA_ROOT;
    else process.env.QLDT_DATA_ROOT = oldRoot;
    if (oldSecret === undefined) delete process.env.TEACHER_AUTH_SECRET;
    else process.env.TEACHER_AUTH_SECRET = oldSecret;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('forces the initial teacher code password to be changed and revokes the old session', () => {
    const service = new TeacherAuthService();
    const result = service.login('LEHOANGANH@TEACHER.AGU.EDU.VN', 'GV001', 'fixture');
    expect(result.identity.mustChangePassword).toBe(true);

    const oldRequest = {
      headers: { cookie: `${service.cookieName()}=${result.session}` },
    } as Request;
    expect(service.fromRequest(oldRequest, true).teacherId).toBe('GV001');
    expect(() => service.fromRequest(oldRequest)).toThrow(ForbiddenException);

    const changed = service.changePassword(oldRequest, 'GV001', 'NewSecurePass123');
    const newRequest = {
      headers: { cookie: `${service.cookieName()}=${changed.session}` },
    } as Request;
    expect(changed.identity.mustChangePassword).toBe(false);
    expect(service.fromRequest(newRequest).teacherId).toBe('GV001');
    expect(() => service.fromRequest(oldRequest, true)).toThrow(UnauthorizedException);
    expect(service.login('lehoanganh@teacher.agu.edu.vn', 'NewSecurePass123', 'fixture').identity.mustChangePassword).toBe(false);
  });
});
