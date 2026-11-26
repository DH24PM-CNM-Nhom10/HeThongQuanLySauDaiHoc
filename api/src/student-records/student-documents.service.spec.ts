import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request } from 'express';
import { StudentDocumentsService, type DocumentUpload } from './student-documents.service';
import { StudentRecordsService } from './student-records.service';
import { TrainingOfficeService } from '../training-office/training-office.service';
import { readStore } from '../common/data-store';

describe('Lưu trữ và xét duyệt hồ sơ thực tế', () => {
  let root: string, previous: string | undefined, previousUpload: string | undefined;
  let service: StudentDocumentsService;
  const request = (code = 'S1', manager = false) => ({ headers: { 'x-student': code, 'x-manager': manager ? 'yes' : '' } }) as unknown as Request;
  const body = { kind: 'bachelor', title: 'Văn bằng đại học', serial: 'VB001', issuer: 'Trường đại học', issuedAt: '2024-01-01' };
  const file: DocumentUpload = { originalname: 'van-bang.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1.7 test fixture'), size: 21 };
  beforeEach(() => {
    previous = process.env.QLDT_DATA_ROOT; previousUpload = process.env.QLDT_UPLOAD_DIR;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qldt-documents-'));
    fs.mkdirSync(path.join(root, 'UI')); fs.mkdirSync(path.join(root, 'api'));
    fs.writeFileSync(path.join(root, 'UI/db.json'), JSON.stringify({ students: [{ maHocVien: 'S1', hoTen: 'Học viên 1' }, { maHocVien: 'S2', hoTen: 'Học viên 2' }] }));
    process.env.QLDT_DATA_ROOT = root; delete process.env.QLDT_UPLOAD_DIR;
    service = new StudentDocumentsService({ fromRequest: (req: Request) => {
      const code = req.headers['x-student']; if (!code) throw new UnauthorizedException(); return { maHocVien: code };
    } } as unknown as StudentRecordsService, { fromRequest: (req: Request) => {
      if (req.headers['x-manager'] !== 'yes') throw new UnauthorizedException(); return { username: 'office' };
    } } as unknown as TrainingOfficeService);
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.QLDT_DATA_ROOT; else process.env.QLDT_DATA_ROOT = previous;
    if (previousUpload === undefined) delete process.env.QLDT_UPLOAD_DIR; else process.env.QLDT_UPLOAD_DIR = previousUpload;
    if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'qldt-documents-')) throw new Error('Unexpected test directory');
    fs.rmSync(root, { recursive: true });
  });
  it('lưu tệp và metadata qua lần tải lại, không lộ đường dẫn nội bộ', () => {
    const result = service.upload(request(), body, file);
    expect(result.data).not.toHaveProperty('storedName'); expect(result.data).not.toHaveProperty('checksum');
    expect(readStore().studentDocuments).toHaveLength(1);
    expect(service.list(request()).data).toHaveLength(1);
    expect(service.file(request(), String(result.data.id)).buffer).toEqual(file.buffer);
    expect(readStore().documentHistory[0].action).toBe('submit');
  });
  it('chặn đọc, nộp, thu hồi và duyệt hồ sơ của người khác', () => {
    const doc = service.upload(request(), body, file).data;
    expect(service.list(request('S2')).data).toEqual([]);
    expect(() => service.list(request('S2'), 'S1')).toThrow(ForbiddenException);
    expect(() => service.file(request('S2'), String(doc.id))).toThrow(ForbiddenException);
    expect(() => service.upload(request('S2'), { ...body, maHocVien: 'S1' }, file)).toThrow(ForbiddenException);
    expect(() => service.remove(request('S2'), String(doc.id), 0)).toThrow(ForbiddenException);
    expect(() => service.review(request(), String(doc.id), { status: 'approved', revision: 0 })).toThrow(UnauthorizedException);
  });
  it('kiểm tra nội dung tệp, dung lượng, ngày cấp và bản nộp trùng', () => {
    expect(() => service.upload(request(), body, { ...file, buffer: Buffer.from('executable') })).toThrow(BadRequestException);
    expect(() => service.upload(request(), body, { ...file, originalname: 'bad.exe' })).toThrow(BadRequestException);
    expect(() => service.upload(request(), body, { ...file, buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })).toThrow(BadRequestException);
    expect(() => service.upload(request(), { ...body, issuedAt: '2026-02-30' }, file)).toThrow(BadRequestException);
    service.upload(request(), body, file);
    expect(() => service.upload(request(), body, file)).toThrow(ConflictException);
    expect(readStore().studentDocuments).toHaveLength(1);
  });
  it('lưu quyết định và lý do; kiểm tra phiên bản; giữ minh chứng đã công nhận', () => {
    const doc = service.upload(request(), body, file).data, id = String(doc.id), staff = request('', true);
    expect(() => service.review(staff, id, { status: 'rejected', revision: 0 })).toThrow(BadRequestException);
    expect(() => service.review(staff, id, { status: 'approved', revision: 4 })).toThrow(ConflictException);
    service.review(staff, id, { status: 'approved', revision: 0 });
    expect(service.list(request()).data[0].status).toBe('approved');
    expect(() => service.remove(request(), id, 1)).toThrow(ConflictException);
    expect(readStore().documentHistory).toHaveLength(2);
  });
  it('thu hồi có lịch sử và không còn tải được tệp; nộp lại sau từ chối được phép', () => {
    const first = service.upload(request(), body, file).data;
    service.review(request('', true), String(first.id), { status: 'rejected', reason: 'Bản scan thiếu trang', revision: 0 });
    const second = service.upload(request(), body, file).data;
    service.remove(request(), String(second.id), 0);
    expect(service.list(request()).data).toHaveLength(1);
    expect(() => service.file(request(), String(second.id))).toThrow();
    expect(readStore().documentHistory.at(-1).action).toBe('withdraw');
  });
  it('xóa tệp mới tạo nếu ghi metadata bị xung đột', () => {
    fs.mkdirSync(path.join(root, 'UI/db.json.lock'));
    expect(() => service.upload(request(), body, file)).toThrow('Dữ liệu đang được cập nhật');
    expect(fs.readdirSync(path.join(root, 'api/storage/student-documents'))).toEqual([]);
    expect(readStore().studentDocuments).toEqual([]);
  });
});
