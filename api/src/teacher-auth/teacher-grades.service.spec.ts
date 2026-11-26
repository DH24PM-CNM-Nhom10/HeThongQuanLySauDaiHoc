import { TeacherGradesService } from './teacher-grades.service';
import { TeacherAuthService } from './teacher-auth.service';
import { TrainingOfficeService } from '../training-office/training-office.service';
import { readStore, saveStore } from '../common/data-store';
import { ConflictException, NotFoundException } from '@nestjs/common';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request } from 'express';

describe('Quy trình điểm và lịch sử lớp học phần', () => {
  let root: string;
  let previousRoot: string | undefined;
  let service: TeacherGradesService;
  let teacherId = 'T1';
  const req = {} as Request;
  const id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

  beforeEach(() => {
    previousRoot = process.env.QLDT_DATA_ROOT;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qldt-logic-'));
    fs.mkdirSync(path.join(root, 'UI'));
    fs.writeFileSync(path.join(root, 'UI/db.json'), JSON.stringify({
      students: [{ maHocVien: 'S1', hoTen: 'Học viên', lop: 'L01', maNganh: 'M1', tenNganh: 'Ngành',
        trinhDo: 'Thạc sĩ', loaiChuongTrinh: 'Ứng dụng', trangThai: 'Đang học' }],
      teachers: [], teacherGrades: [], gradebooks: [], gradeHistory: [],
      teachingAssignments: [{ id, teacherId: 'T1', teacherName: 'Giảng viên', courseCode: 'TEST',
        courseName: 'Học phần', classCode: 'L01', majorCode: 'M1', schoolYear: '2025-2026', semester: '1' }],
    }));
    process.env.QLDT_DATA_ROOT = root;
    teacherId = 'T1';
    service = new TeacherGradesService(
      { fromRequest: () => ({ teacherId }) } as unknown as TeacherAuthService,
      { allSavedAssignments: () => readStore().teachingAssignments,
        fromRequest: () => ({ username: 'office' }) } as unknown as TrainingOfficeService,
    );
  });

  afterEach(() => {
    if (previousRoot === undefined) delete process.env.QLDT_DATA_ROOT;
    else process.env.QLDT_DATA_ROOT = previousRoot;
    fs.unlinkSync(path.join(root, 'UI/db.json'));
    fs.rmdirSync(path.join(root, 'UI'));
    fs.rmdirSync(root);
  });

  function saved() {
    const book = service.getGradebook(req, id);
    return service.saveGradebook(req, id, { revision: book.revision,
      scores: [{ maHocVien: 'S1', processScore: 8, examScore: 9 }] });
  }

  it('ẩn điểm nháp, chỉ hiển thị sau công bố và khóa sửa', () => {
    const draft = saved();
    expect(service.transcriptForStudent('S1')[0].totalScore).toBeNull();
    const pending = service.submit(req, id, draft.revision);
    expect(service.transcriptForStudent('S1')[0].totalScore).toBeNull();
    const published = service.review(req, id, { action: 'publish', revision: pending.revision });
    expect(service.transcriptForStudent('S1')[0].totalScore).toBe(8.6);
    expect(() => service.saveGradebook(req, id, { revision: published.revision, scores: [] })).toThrow(ConflictException);
    expect(readStore().gradeHistory.map(row => row.action)).toEqual(['save', 'submit', 'publish']);
  });

  it('giữ điểm khi chuyển lớp và mở khóa điều chỉnh', () => {
    const pending = service.submit(req, id, saved().revision);
    const published = service.review(req, id, { action: 'publish', revision: pending.revision });
    service.review(req, id, { action: 'reopen', reason: 'Điều chỉnh theo biên bản', revision: published.revision });
    const store = readStore();
    store.students[0].lop = 'L02';
    saveStore(store);
    expect(service.getGradebook(req, id).students[0].maHocVien).toBe('S1');
    expect(service.transcriptForStudent('S1')[0].totalScore).toBe(8.6);
    expect(service.transcriptForStudent('S2')).toEqual([]);
  });

  it('từ chối lưu phiên bản cũ và giảng viên khác', () => {
    saved();
    expect(() => service.saveGradebook(req, id, { revision: 0, scores: [] })).toThrow(ConflictException);
    teacherId = 'T2';
    expect(() => service.getGradebook(req, id)).toThrow(NotFoundException);
  });

  it('chặn ghi kho dữ liệu bằng bản đọc cũ', () => {
    const fresh = readStore();
    const stale = readStore();
    fresh.students[0].hoTen = 'Mới';
    saveStore(fresh);
    stale.students[0].hoTen = 'Cũ';
    expect(() => saveStore(stale)).toThrow('Dữ liệu đã thay đổi');
    expect(readStore().students[0].hoTen).toBe('Mới');
  });
  it('bổ sung học viên mới vào bản nháp, giữ điểm và học viên chuyển lớp', () => {
    const draft = saved();
    const store = readStore();
    store.students[0].lop = 'L02';
    store.students.push({ maHocVien: 'S2', hoTen: 'Học viên mới', lop: 'L01', maNganh: 'M1', trinhDo: 'Thạc sĩ', trangThai: 'Đang học' });
    saveStore(store);
    const synced = service.review(req, id, { action: 'sync_roster', revision: draft.revision });
    expect(synced).toMatchObject({ added: 1, revision: draft.revision + 1 });
    const book = service.getGradebook(req, id);
    expect(book.students.map(row => row.maHocVien)).toEqual(['S1', 'S2']);
    expect(book.students[0].totalScore).toBe(8.6);
    expect(book.students[1].totalScore).toBeNull();
    expect(service.transcriptForStudent('S2')).toHaveLength(1);
    expect(service.review(req, id, { action: 'sync_roster', revision: book.revision })).toMatchObject({ added: 0, revision: book.revision });
    expect(() => service.saveGradebook(req, id, { revision: draft.revision, scores: [] })).toThrow(ConflictException);
    expect(readStore().gradeHistory.at(-1)?.action).toBe('sync_roster');
  });
  it('không thay đổi danh sách khi bảng điểm chờ duyệt hoặc đã công bố', () => {
    const pending = service.submit(req, id, saved().revision);
    expect(() => service.review(req, id, { action: 'sync_roster', revision: pending.revision })).toThrow(ConflictException);
    const published = service.review(req, id, { action: 'publish', revision: pending.revision });
    expect(() => service.review(req, id, { action: 'sync_roster', revision: published.revision })).toThrow(ConflictException);
  });
});
