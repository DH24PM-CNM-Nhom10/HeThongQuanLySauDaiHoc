import { StudentRecordsService } from './student-records.service';
import { UnauthorizedException } from '@nestjs/common';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request } from 'express';

describe('Đăng nhập và đổi mật khẩu học viên', () => {
  let root: string;
  let oldRoot: string | undefined;
  let oldSecret: string | undefined;
  beforeEach(() => {
    oldRoot = process.env.QLDT_DATA_ROOT;
    oldSecret = process.env.STUDENT_DEMO_AUTH_SECRET;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qldt-login-'));
    fs.mkdirSync(path.join(root, 'UI'));
    fs.mkdirSync(path.join(root, 'api'));
    fs.writeFileSync(path.join(root, 'UI/db.json'), JSON.stringify({
      students: [{ MA_HOC_VIEN: 'S001', HO_TEN: 'Học viên', cccd: '00123456789', email: 'learner@example.edu.vn' }],
    }));
    process.env.QLDT_DATA_ROOT = root;
    process.env.STUDENT_DEMO_AUTH_SECRET = 'fixture-student-secret-at-least-32-characters';
  });
  afterEach(() => {
    if (oldRoot === undefined) delete process.env.QLDT_DATA_ROOT;
    else process.env.QLDT_DATA_ROOT = oldRoot;
    if (oldSecret === undefined) delete process.env.STUDENT_DEMO_AUTH_SECRET;
    else process.env.STUDENT_DEMO_AUTH_SECRET = oldSecret;
    fs.rmSync(root, { recursive: true, force: true });
  });
  it('uses the student code as username and the one-time initial password', () => {
    const service = new StudentRecordsService();
    const result = service.login('s001', 'S001', 'fixture');
    expect(result.user.maHocVien).toBe('S001');
    expect(result.user.mustChangePassword).toBe(false);
    const req = { headers: { cookie: service.cookieName() + '=' + result.session } } as Request;
    expect(service.fromRequest(req, true).maHocVien).toBe('S001');
    expect(service.fromRequest(req).maHocVien).toBe('S001');
  });
  it('allows an optional password change and invalidates the old session', () => {
    const service = new StudentRecordsService();
    const first = service.login('S001', 'S001', 'fixture');
    const oldRequest = { headers: { cookie: service.cookieName() + '=' + first.session } } as Request;
    const changed = service.changePassword(oldRequest, 'S001', 'NewSecurePass123');
    const newRequest = { headers: { cookie: service.cookieName() + '=' + changed.session } } as Request;

    expect(changed.user.mustChangePassword).toBe(false);
    expect(service.fromRequest(newRequest).maHocVien).toBe('S001');
    expect(() => service.fromRequest(oldRequest, true)).toThrow(UnauthorizedException);
    expect(service.login('S001', 'NewSecurePass123', 'fixture').user.mustChangePassword).toBe(false);
  });
  it('allows existing accounts with the former first-login flag to access their profile', () => {
    const service = new StudentRecordsService();
    const first = service.login('S001', 'S001', 'fixture');
    const file = path.join(root, 'api', '.student-accounts.local.json');
    const accounts = JSON.parse(fs.readFileSync(file, 'utf8'));
    accounts[0].mustChangePassword = true;
    fs.writeFileSync(file, JSON.stringify(accounts));
    const req = { headers: { cookie: service.cookieName() + '=' + first.session } } as Request;
    expect(service.fromRequest(req).mustChangePassword).toBe(false);
    expect(service.login('S001', 'S001', 'fixture').user.mustChangePassword).toBe(false);
    expect(() => service.changePassword(req, 'wrong', 'NewSecurePass123')).toThrow(UnauthorizedException);
  });
  it.each(['learner@example.edu.vn', 'S001@agu.edu.vn', 's001@student.agu.edu.vn'])(
    'accepts the student email alias %s', username => {
      expect(new StudentRecordsService().login(username, 'S001', 'fixture').user.maHocVien).toBe('S001');
    },
  );
  it('refuses a wrong initial password', () => {
    const service = new StudentRecordsService();
    expect(() => service.login('S001', 'wrong', 'fixture')).toThrow(UnauthorizedException);
    expect(() => service.login('S001', '00123456789', 'fixture')).toThrow(UnauthorizedException);
  });
  it('allows first login without CMND/CCCD', () => {
    fs.writeFileSync(path.join(root, 'UI/db.json'), JSON.stringify({
      students: [{ MA_HOC_VIEN: 'S002', HO_TEN: 'Thiếu giấy tờ' }],
    }));
    expect(new StudentRecordsService().login('S002', 'S002', 'fixture').user.mustChangePassword).toBe(false);
  });
});
