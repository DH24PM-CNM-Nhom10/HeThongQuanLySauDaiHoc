import { councilConflict } from '../../../../../shared/thesis-workflow.cjs';
import { NextRequest, NextResponse } from 'next/server';
import { requireStudentManager } from '../../../../lib/student-manager';
import { getStore, saveStoreToFile } from '../../../../lib/store';
import { FIELDS, dateISO, thesisValues } from '../../../../../shared/thesis-progress.cjs';
import { AGU_SESSION_COOKIE, readAguSession } from '../../../../lib/agu-auth';

export async function PATCH(request: NextRequest) {
  const denied = await requireStudentManager(request); if (denied) return denied;
  const fail = (message: string, status = 400) => NextResponse.json({ message }, { status });
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || !body.changes || typeof body.changes !== 'object' || Array.isArray(body.changes) || !body.previous) return fail('Dữ liệu cập nhật không hợp lệ.');
    const keys = Object.keys(body.changes);
    if (!keys.length || keys.some(k => !FIELDS.includes(k) || typeof body.changes[k] !== 'string')) return fail('Chỉ được cập nhật các trường tiến độ luận văn.');
    const store = getStore(true), code = String(body.maHocVien || '').trim().toUpperCase();
    const matches = store.students.filter(row => String(row.maHocVien || row.ma_hoc_vien || row.MA_HOC_VIEN || row.id || '').trim().toUpperCase() === code);
    if (matches.length !== 1) return fail('Không tìm thấy học viên hoặc mã học viên bị trùng.', 404);
    const row = matches[0], previous = thesisValues(row);
    if (FIELDS.some(k => body.previous[k] !== previous[k])) return fail('Tiến độ đã được thay đổi. Hãy tải lại trước khi lưu.', 409);
    const changes = Object.fromEntries(keys.map(k => [k, body.changes[k].trim()])), next = { ...previous, ...changes };
    if (Object.values(changes).some(v => String(v).length > 2000)) return fail('Nội dung quá dài (tối đa 2.000 ký tự).');
    for (const key of ['ngayQD', 'ngayBaoVe', 'ngayTotNghiep', 'ngayHetHan']) if (changes[key] && (dateISO(changes[key]) !== changes[key])) return fail('Hãy chọn ngày hợp lệ từ lịch.');
    const names = new Set(store.teachers.map(t => String(t.hoten || t.hoTen || t.ho_ten || t.name || '').trim()));
    for (const key of ['gvHuongDan1', 'gvHuongDan2']) if (changes[key] && changes[key] !== previous[key] && !names.has(changes[key])) return fail('Giảng viên hướng dẫn không có trong danh sách.');
    if (next.gvHuongDan1 && next.gvHuongDan1 === next.gvHuongDan2) return fail('Hai giảng viên hướng dẫn phải khác nhau.');
    const assigned = dateISO(next.ngayQD), defended = dateISO(next.ngayBaoVe), graduated = dateISO(next.ngayTotNghiep);
    if (assigned && defended && defended < assigned) return fail('Ngày bảo vệ phải từ ngày giao đề tài trở đi.');
    if (defended && graduated && graduated < defended) return fail('Ngày tốt nghiệp phải từ ngày bảo vệ trở đi.');
    const hasTitle = !!next.tenLuanVan && !/^chưa đăng ký(?: đề tài)?$/i.test(next.tenLuanVan);
    if (!hasTitle && (next.gvHuongDan1 || next.gvHuongDan2 || next.ngayQD || next.ngayBaoVe || next.ngayTotNghiep || next.trangThaiLv && next.trangThaiLv !== 'Chưa đăng ký')) return fail('Hãy nhập tên đề tài trước khi cập nhật giảng viên và các mốc luận văn.');
    if (councilConflict(store,code,[next.gvHuongDan1,next.gvHuongDan2])) return fail("Giảng viên hướng dẫn không được trùng chủ tịch hoặc phản biện hội đồng đã lập.");
    const updated = { ...row, ...changes };
    const actor = readAguSession(request.cookies.get(AGU_SESSION_COOKIE)?.value)?.role === 'admin' ? 'admin' : 'phongdaotao@agu.edu.vn';
    store.studentHistory.push({ action: 'update-thesis', code, at: new Date().toISOString(), actor, before: { ...row }, after: updated });
    store.students[store.students.indexOf(row)] = updated;
    saveStoreToFile(store);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof SyntaxError) return fail('Dữ liệu cập nhật không hợp lệ.');
    return fail('Không lưu được tiến độ. Hãy tải lại và thử lại.', 500);
  }
}
