import { isMasterStudent } from '../../../shared/masters-scope.cjs';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { projectRoot, readStore, saveStore, studentCode } from '../common/data-store';
import { requireManager } from '../common/management-access';
import { TrainingOfficeService } from '../training-office/training-office.service';
import { StudentRecordsService } from './student-records.service';
export type DocumentUpload = { originalname: string; mimetype: string; size: number; buffer: Buffer };
const KINDS = ['admission', 'bachelor', 'language', 'informatics', 'evidence'];
@Injectable()
export class StudentDocumentsService {
  constructor(private readonly students: StudentRecordsService, private readonly office: TrainingOfficeService) {}
  private actor(req: Request) {
    try { const manager = requireManager(req, this.office); return { manager: true, code: '', name: manager.username }; }
    catch { const student = this.students.fromRequest(req); return { manager: false, code: student.maHocVien, name: student.maHocVien }; }
  }
  private directory() { return path.resolve(process.env.QLDT_UPLOAD_DIR || path.join(projectRoot(), 'api/storage/student-documents')); }
  private publicRecord(row: Record<string, unknown>) {
    const { storedName: _storedName, checksum: _checksum, ...visible } = row;
    return visible;
  }
  list(req: Request, requestedCode?: string) {
    const actor = this.actor(req), code = actor.manager ? String(requestedCode || '').trim().toUpperCase() : actor.code;
    if (!actor.manager && requestedCode && requestedCode.trim().toUpperCase() !== actor.code) throw new ForbiddenException('Chỉ được xem hồ sơ của chính mình.');
    const store = readStore(), codes = new Set(store.students.filter(isMasterStudent).map(studentCode));
    return { success: true, canReview: actor.manager, data: store.studentDocuments.filter(row => codes.has(String(row.maHocVien)) && !row.deletedAt && (!code || row.maHocVien === code))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(row => this.publicRecord(row)) };
  }
  upload(req: Request, body: Record<string, unknown>, file: DocumentUpload | undefined) {
    const actor = this.actor(req), text = (key: string) => typeof body?.[key] === 'string' ? String(body[key]).trim() : '';
    const code = actor.manager ? text('maHocVien').toUpperCase() : actor.code;
    if (!actor.manager && text('maHocVien') && text('maHocVien').toUpperCase() !== code) throw new ForbiddenException('Không được nộp hồ sơ cho học viên khác.');
    const kind = text('kind'), title = text('title'), serial = text('serial'), issuer = text('issuer'), issuedAt = text('issuedAt');
    if (!KINDS.includes(kind) || !title || title.length > 255 || serial.length > 255 || issuer.length > 255) throw new BadRequestException('Kiểm tra loại hồ sơ, tên văn bằng và đơn vị cấp.');
    if (issuedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(issuedAt) || !Number.isFinite(Date.parse(issuedAt)) || new Date(issuedAt).toISOString().slice(0, 10) !== issuedAt)) throw new BadRequestException('Ngày cấp không hợp lệ.');
    if (!file?.buffer?.length || file.buffer.length > 10 * 1024 * 1024) throw new BadRequestException('Tệp phải có dung lượng từ 1 byte đến 10 MB.');
    const bytes = file.buffer;
    const type = bytes.subarray(0, 5).toString() === '%PDF-' ? ['.pdf', 'application/pdf'] : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? ['.jpg', 'image/jpeg']
      : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? ['.png', 'image/png'] : null;
    const ext = path.extname(file.originalname).toLowerCase();
    if (!type || !(ext === type[0] || ext === '.jpeg' && type[0] === '.jpg')) throw new BadRequestException('Chỉ nhận tệp PDF, JPG, PNG đúng định dạng.');
    const store = readStore(), matches = store.students.filter(row => studentCode(row) === code);
    if (matches.length !== 1 || !isMasterStudent(matches[0])) throw new BadRequestException('Không tìm thấy học viên hoặc mã học viên bị trùng.');
    const checksum = crypto.createHash('sha256').update(bytes).digest('hex');
    if (store.studentDocuments.some(row => !row.deletedAt && row.maHocVien === code && row.kind === kind && row.checksum === checksum && row.status !== 'rejected')) throw new ConflictException('Tệp này đã được nộp cho cùng loại hồ sơ.');
    const id = crypto.randomUUID(), storedName = id + type[0], now = new Date().toISOString();
    const row = { id, maHocVien: code, hoTen: String(matches[0].hoTen || matches[0].ho_ten || code), kind, title, serial, issuer, issuedAt,
      fileName: path.basename(file.originalname).replace(/[\x00-\x1f]/g, ''), mimeType: type[1], size: bytes.length,
      storedName, checksum, status: 'submitted', revision: 0, createdAt: now, uploadedBy: actor.name };
    fs.mkdirSync(this.directory(), { recursive: true, mode: 0o700 });
    const target = path.join(this.directory(), storedName);
    fs.writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 });
    try {
      store.studentDocuments.push(row); store.documentHistory.push({ documentId: id, action: 'submit', actor: actor.name, at: now }); saveStore(store);
    } catch (error) { fs.unlinkSync(target); throw error; }
    return { success: true, data: this.publicRecord(row) };
  }
  review(req: Request, id: string, input: { status?: unknown; reason?: unknown; revision?: unknown }) {
    const actor = requireManager(req, this.office), store = readStore(), row = store.studentDocuments.find(item => item.id === id && !item.deletedAt);
    if (!row || !store.students.some(s => studentCode(s) === row.maHocVien && isMasterStudent(s))) throw new NotFoundException('Không tìm thấy hồ sơ thạc sĩ.');
    if (row.revision !== input?.revision) throw new ConflictException('Hồ sơ đã thay đổi. Hãy tải lại.');
    if (row.status !== 'submitted' || !['approved', 'rejected'].includes(String(input.status))) throw new BadRequestException('Chỉ xét duyệt hồ sơ đang chờ xử lý.');
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (reason.length > 2000 || input.status === 'rejected' && !reason) throw new BadRequestException('Cần lý do từ chối, tối đa 2000 ký tự.');
    store.documentHistory.push({ documentId: id, action: input.status, actor: actor.username, at: new Date().toISOString(), before: { ...row }, reason });
    row.status = input.status; row.reviewReason = reason; row.reviewedAt = new Date().toISOString(); row.reviewedBy = actor.username; row.revision++;
    saveStore(store); return { success: true, data: this.publicRecord(row) };
  }
  file(req: Request, id: string) {
    const actor = this.actor(req), row = readStore().studentDocuments.find(item => item.id === id && !item.deletedAt);
    if (!row) throw new NotFoundException('Không tìm thấy hồ sơ.');
    if (!actor.manager && row.maHocVien !== actor.code) throw new ForbiddenException('Không có quyền đọc tệp này.');
    if (!/^[a-f0-9-]{36}\.(pdf|jpg|png)$/.test(String(row.storedName))) throw new NotFoundException('Tệp không hợp lệ.');
    const target = path.join(this.directory(), row.storedName);
    if (!fs.existsSync(target)) throw new NotFoundException('Tệp không còn trong kho lưu trữ.');
    return { buffer: fs.readFileSync(target), mime: String(row.mimeType), name: String(row.fileName) };
  }
  remove(req: Request, id: string, revision: unknown) {
    const actor = this.actor(req), store = readStore(), row = store.studentDocuments.find(item => item.id === id && !item.deletedAt);
    if (!row) throw new NotFoundException('Không tìm thấy hồ sơ.');
    if (!actor.manager && row.maHocVien !== actor.code) throw new ForbiddenException('Không có quyền thu hồi hồ sơ.');
    if (row.revision !== revision) throw new ConflictException('Hồ sơ đã thay đổi. Hãy tải lại.');
    if (row.status === 'approved') throw new ConflictException('Không thu hồi minh chứng đã được công nhận.');
    store.documentHistory.push({ documentId: id, action: 'withdraw', actor: actor.name, at: new Date().toISOString(), before: { ...row } });
    row.deletedAt = new Date().toISOString(); row.revision++; saveStore(store); return { success: true };
  }
}
