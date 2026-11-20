import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request } from 'express';
import { TrainingOfficeService } from './training-office.service';

describe('TrainingOfficeService demo login', () => {
  let root: string;
  let oldCwd: string;
  let oldNodeEnv: string | undefined;
  let oldSecret: string | undefined;

  beforeEach(() => {
    oldCwd = process.cwd();
    oldNodeEnv = process.env.NODE_ENV;
    oldSecret = process.env.TRAINING_OFFICE_AUTH_SECRET;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qldt-training-office-'));
    process.chdir(root);
    process.env.NODE_ENV = 'test';
    process.env.TRAINING_OFFICE_AUTH_SECRET = 'fixture-training-office-secret-at-least-32-characters';
  });

  afterEach(() => {
    process.chdir(oldCwd);
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNodeEnv;
    if (oldSecret === undefined) delete process.env.TRAINING_OFFICE_AUTH_SECRET;
    else process.env.TRAINING_OFFICE_AUTH_SECRET = oldSecret;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('authenticates the fixed demo account and rejects other passwords', () => {
    const service = new TrainingOfficeService();
    const { identity, session } = service.login('PHONGDAOTAO@AGU.EDU.VN', 'phongdaotao', 'fixture');
    const request = { headers: { cookie: `${service.cookieName()}=${session}` } } as Request;

    expect(identity.role).toBe('training_office');
    expect(service.fromRequest(request)).toEqual(identity);
    expect(() => service.login('phongdaotao@agu.edu.vn', 'wrong', 'fixture')).toThrow(UnauthorizedException);
  });

  it('requires an explicitly seeded account in production', () => {
    const service = new TrainingOfficeService();
    process.env.NODE_ENV = 'production';

    expect(() => service.login('phongdaotao@agu.edu.vn', 'phongdaotao', 'fixture'))
      .toThrow(ServiceUnavailableException);
  });
});
