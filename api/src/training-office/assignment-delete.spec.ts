import { ConflictException } from '@nestjs/common';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request } from 'express';
import { TrainingOfficeService } from './training-office.service';
import { readStore } from '../common/data-store';

describe('Thu hồi phân công và lịch liên kết', () => {
  let root: string;
  let previous: string | undefined;
  let service: TrainingOfficeService;
  const id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const other = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
  const req = {} as Request;
  beforeEach(() => {
    previous = process.env.QLDT_DATA_ROOT;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qldt-delete-assignment-'));
    fs.mkdirSync(path.join(root, 'UI'));
    process.env.QLDT_DATA_ROOT = root;
    service = new TrainingOfficeService();
    jest.spyOn(service, 'fromRequest').mockReturnValue({ role: 'training_office', username: 'office', hoTen: 'Phòng đào tạo' });
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.QLDT_DATA_ROOT;
    else process.env.QLDT_DATA_ROOT = previous;
    fs.unlinkSync(path.join(root, 'UI/db.json'));
    fs.rmdirSync(path.join(root, 'UI'));
    fs.rmdirSync(root);
  });
  function write(schedule: Record<string, unknown>[], scored = false) {
    fs.writeFileSync(path.join(root, 'UI/db.json'), JSON.stringify({
      teachingAssignments: [
        { id, teacherId: 'T1', classCode: 'L1', courseCode: 'M1', schoolYear: '2025-2026', semester: '1' },
        { id: other, teacherId: 'T1', classCode: 'L1', courseCode: 'M1', schoolYear: '2026-2027', semester: '1' },
      ], schedule, gradebooks: [{ assignmentId: id, scores: scored ? [{ maHocVien: 'S1', totalScore: 8 }] : [] }],
    }));
  }
  it('xóa lịch đúng mã phân công và đúng học kỳ cùng bảng điểm rỗng trong một lần lưu', () => {
    write([
      { assignmentId: id }, { maPhanCong: id }, { assignmentId: other },
      { courseCode: 'M1', classCode: 'L1', schoolYear: '2025-2026', semester: '1' },
      { courseCode: 'M1', classCode: 'L1', schoolYear: '2026-2027', semester: '1' },
    ]);
    service.deleteAssignment(req, id);
    const store = readStore();
    expect(store.schedule).toHaveLength(2);
    expect(store.schedule[0].assignmentId).toBe(other);
    expect(store.teachingAssignments.map(row => row.id)).toEqual([other]);
    expect(store.gradebooks).toEqual([]);
  });
  it('chặn lịch mơ hồ thay vì xóa nhầm lịch của phân công khác', () => {
    write([{ courseCode: 'M1', classCode: 'L1' }]);
    const before = fs.readFileSync(path.join(root, 'UI/db.json'), 'utf8');
    expect(() => service.deleteAssignment(req, id)).toThrow(ConflictException);
    expect(fs.readFileSync(path.join(root, 'UI/db.json'), 'utf8')).toBe(before);
  });
  it('giữ nguyên lịch và phân công khi bảng điểm đã có điểm', () => {
    write([{ assignmentId: id }], true);
    expect(() => service.deleteAssignment(req, id)).toThrow(ConflictException);
    expect(readStore().schedule).toHaveLength(1);
    expect(readStore().teachingAssignments).toHaveLength(2);
  });
});
