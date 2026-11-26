import { normalizeTeacher } from "../../../../../shared/teacher-profile.cjs";
import { NextRequest, NextResponse } from "next/server";
import { requireStudentManager } from "../../../../lib/student-manager";
import { getStore, saveStoreToFile } from "../../../../lib/store";
import { teacherDeletionConflict } from "../../../../../shared/teacher-links.cjs";
import { ENTITY_SCHEMAS } from "../../../../lib/schemas";
import crypto from "node:crypto";
const keys = ENTITY_SCHEMAS.teachers.fields.map((f) => f.key);
const text = (v: unknown) => String(v ?? "").trim();
const fail = (message: string, status = 400) =>
  NextResponse.json({ message }, { status });
async function mutate(req: NextRequest) {
  const denied = await requireStudentManager(req);
  if (denied) return denied;
  try {
    const body = await req.json(),
      store = getStore(true),
      method = req.method;
    if (!body || typeof body !== "object" || Array.isArray(body))
      return fail("Dữ liệu không hợp lệ.");
    const code = text(body.shcc).toUpperCase();
    if (!/^[\p{L}\p{N}_.-]{1,80}$/u.test(code))
      return fail("Mã giảng viên không hợp lệ.");
    const matches = store.teachers.filter(
        (t) => normalizeTeacher(t, keys).shcc.toUpperCase() === code,
      ),
      current = matches[0];
    if (method === "POST" && matches.length)
      return fail("Mã giảng viên đã tồn tại.", 409);
    if (method !== "POST" && matches.length !== 1)
      return fail("Không tìm thấy hoặc mã giảng viên bị trùng.", 409);
    if (
      current &&
      keys.some(
        (key) =>
          text(body.previous?.[key]) !== normalizeTeacher(current, keys)[key],
      )
    )
      return fail("Hồ sơ đã thay đổi. Hãy tải lại trước khi lưu.", 409);
    if (method === "DELETE") {
      const conflict = teacherDeletionConflict(store, current);
      if (conflict) return fail(conflict, 409);
      if (
        store.thesisWorkflows.some((w) =>
          [w.council?.chair, w.council?.reviewer].includes(code),
        )
      )
        return fail("Giảng viên đang tham gia hội đồng luận văn.", 409);
      store.teachers = store.teachers.filter((t) => t !== current);
    } else {
      const input = Object.fromEntries(keys.map((k) => [k, text(body[k])]));
      input.shcc = current ? normalizeTeacher(current, keys).shcc : code;
      if (!input.hoten || !input.t_dvi)
        return fail("Nhập họ tên và đơn vị/bộ môn.");
      if (Object.values(input).some((v) => v.length > 255))
        return fail("Mỗi trường tối đa 255 ký tự.");
      if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
        return fail("Email không hợp lệ.");
      if (input.sdt && !/^[+\d\s().-]{7,25}$/.test(input.sdt))
        return fail("Số điện thoại không hợp lệ.");
      if (input.gioitinh && !["Nam", "Nữ"].includes(input.gioitinh))
        return fail("Chọn giới tính Nam hoặc Nữ.");
      if (
        input.email &&
        store.teachers.some(
          (t) =>
            t !== current &&
            normalizeTeacher(t, keys).email.toLowerCase() ===
              input.email.toLowerCase(),
        )
      )
        return fail("Email đã được sử dụng.", 409);
      if (
        current &&
        input.hoten !== normalizeTeacher(current, keys).hoten &&
        teacherDeletionConflict(store, current)
      )
        return fail(
          "Giảng viên đang có hồ sơ liên kết. Cần xử lý liên kết trước khi đổi tên.",
          409,
        );
      const updated = { ...(current || { id: crypto.randomUUID() }), ...input };
      if (current) store.teachers[store.teachers.indexOf(current)] = updated;
      else store.teachers.push(updated);
    }
    store.teacherHistory.push({
      action: method,
      code,
      at: new Date().toISOString(),
      before: current || null,
      after:
        method === "DELETE"
          ? null
          : store.teachers.find((t) => t.shcc === code),
    });
    saveStoreToFile(store);
    return NextResponse.json({ success: true });
  } catch {
    return fail("Không lưu được hồ sơ. Hãy tải lại và thử lại.", 409);
  }
}
export const POST = mutate,
  PUT = mutate,
  DELETE = mutate;
