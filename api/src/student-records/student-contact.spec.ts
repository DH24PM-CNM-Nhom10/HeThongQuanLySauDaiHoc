import { BadRequestException } from '@nestjs/common';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request } from 'express';
import { StudentRecordsController } from './student-records.controller';
import { StudentRecordsService } from './student-records.service';
import { TeacherGradesService } from '../teacher-auth/teacher-grades.service';
import { readStore } from '../common/data-store';
describe('Thông tin cá nhân học viên', () => {
  let root: string, previous: string | undefined, controller: StudentRecordsController;
  beforeEach(() => {
    previous = process.env.QLDT_DATA_ROOT; root = fs.mkdtempSync(path.join(os.tmpdir(), 'qldt-contact-'));
    fs.mkdirSync(path.join(root, 'UI'));
    fs.writeFileSync(path.join(root, 'UI/db.json'), JSON.stringify({ students: [{ maHocVien: 'S1', email: 'old@example.edu.vn' }, { maHocVien: 'S2', email: 'other@example.edu.vn' }] }));
    process.env.QLDT_DATA_ROOT = root;
    controller = new StudentRecordsController({ fromRequest: () => ({ maHocVien: 'S1' }) } as unknown as StudentRecordsService, {} as TeacherGradesService);
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.QLDT_DATA_ROOT; else process.env.QLDT_DATA_ROOT = previous;
    fs.unlinkSync(path.join(root, 'UI/db.json')); fs.rmdirSync(path.join(root, 'UI')); fs.rmdirSync(root);
  });
  it('cập nhật liên hệ của chính mình, giữ học viên khác và có lịch sử', () => {
    controller.updateContact({} as Request, { email: 'new@example.edu.vn', soDienThoai: '0901234567', diaChi: 'Địa chỉ', donViCongTac: 'Đơn vị' });
    expect(readStore().students[0]).toMatchObject({ email: 'new@example.edu.vn', soDienThoai: '0901234567' });
    expect(readStore().students[1].email).toBe('other@example.edu.vn');
    expect(readStore().studentHistory[0].actor).toBe('S1');
  });
  it('chặn đổi mã học viên, ngành, lớp và trạng thái hoặc dữ liệu sai', () => {
    for (const body of [{ maHocVien: 'S2' }, { lop: 'L2' }, { maNganh: 'N2' }, { trangThai: 'Đã tốt nghiệp' }, { email: 'invalid' }, { soDienThoai: 'abc' }]) {
      expect(() => controller.updateContact({} as Request, body)).toThrow(BadRequestException);
    }
    expect(readStore().studentHistory).toHaveLength(0);
  });
});
