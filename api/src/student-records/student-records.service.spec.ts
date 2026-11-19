import { StudentRecordsService } from './student-records.service';
import { UnauthorizedException } from '@nestjs/common';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request } from 'express';

describe('Đăng nhập học viên bằng mã và email', () => {
  let root: string;
  let oldRoot: string | undefined;
  let oldSecret: string | undefined;
  beforeEach(() => {
    oldRoot = process.env.QLDT_DATA_ROOT;
    oldSecret = process.env.STUDENT_DEMO_AUTH_SECRET;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qldt-login-'));
    fs.mkdirSync(path.join(root, 'UI'));
    fs.writeFileSync(path.join(root, 'UI/db.json'), JSON.stringify({
      students: [{ MA_HOC_VIEN: 'S001', HO_TEN: 'Học viên', email: 'learner@example.edu.vn' }],
    }));
    process.env.QLDT_DATA_ROOT = root;
    process.env.STUDENT_DEMO_AUTH_SECRET = 'fixture-student-secret-at-least-32-characters';
  });
  afterEach(() => {
    if (oldRoot === undefined) delete process.env.QLDT_DATA_ROOT;
    else process.env.QLDT_DATA_ROOT = oldRoot;
    if (oldSecret === undefined) delete process.env.STUDENT_DEMO_AUTH_SECRET;
    else process.env.STUDENT_DEMO_AUTH_SECRET = oldSecret;
    fs.unlinkSync(path.join(root, 'UI/db.json'));
    fs.rmdirSync(path.join(root, 'UI'));
    fs.rmdirSync(root);
  });
  it.each(['S001', 's001@student.agu.edu.vn', 'S001@agu.edu.vn', 'learner@example.edu.vn'])(
    'chấp nhận %s và xác nhận phiên', username => {
      const service = new StudentRecordsService();
      const result = service.login(username, 'S001', 'fixture');
      expect(result.user.maHocVien).toBe('S001');
      const req = { headers: { cookie: service.cookieName() + '=' + result.session } } as Request;
      expect(service.fromRequest(req).maHocVien).toBe('S001');
    },
  );
  it('vẫn từ chối mật khẩu sai', () => {
    expect(() => new StudentRecordsService().login('S001', 'wrong', 'fixture')).toThrow(UnauthorizedException);
  });
});
