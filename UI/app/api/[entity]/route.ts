import { validateStudentRecord } from "../../../lib/student-validation";
import { NextRequest, NextResponse } from "next/server";
import { getStore, saveStoreToFile } from "../../../lib/store";
import { requireAdmin } from "../../../lib/admin-api";
import { ENTITY_SCHEMAS } from "../../../lib/schemas";
import { AGU_SESSION_COOKIE, readAguSession } from "../../../lib/agu-auth";
import { appendNewStudents, studentCode } from "../../../lib/studentRecords";

function studentMutationDenied(req: NextRequest, entity: string) {
  return entity === "students" &&
    readAguSession(req.cookies.get(AGU_SESSION_COOKIE)?.value)?.role !== "admin";
}

function studentError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

// 1. GET: Lấy danh sách trực tiếp từ db.json
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    // Giải quyết params để tương thích cả Next.js 14 & 15
    const resolvedParams = await Promise.resolve(params);
    const entityKey = resolvedParams.entity;
    if (!Object.hasOwn(ENTITY_SCHEMAS, entityKey)) return studentError("Loại dữ liệu không hợp lệ.", 400);

    if (!Object.hasOwn(ENTITY_SCHEMAS, entityKey)) {
      return NextResponse.json({ success: false, error: "Thiếu entityKey" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 10000) {
      return studentError("Trang và số dòng không hợp lệ.", 400);
    }

    // Luôn lấy store mới nhất từ db.json
    const currentStore = getStore(entityKey === "students");
    const list = currentStore[entityKey] || [];

    // Lọc theo từ khóa tìm kiếm
    const filtered = search
      ? list.filter((item) =>
          Object.values(item).some((val) =>
            String(val ?? "").toLowerCase().includes(search.toLowerCase())
          )
        )
      : list;

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedData = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      data: paginatedData,
      pagination: { total, page, limit, totalPages },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 2. POST: Thêm / Ghi đè danh sách
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const resolvedParams = await Promise.resolve(params);
    const entityKey = resolvedParams.entity;
    if (!Object.hasOwn(ENTITY_SCHEMAS, entityKey)) return studentError("Loại dữ liệu không hợp lệ.", 400);

    if (studentMutationDenied(req, entityKey)) return studentError("Bạn không có quyền quản lý học viên.", 403);
    const body = await req.json();
    const currentStore = getStore(entityKey === "students");

    if (entityKey === "students") {
      if (!body || typeof body !== "object" || Array.isArray(body) || !studentCode(body) || !String(body.hoTen ?? "").trim()) {
        return studentError("Cần nhập mã và họ tên học viên.", 400);
      }
      const invalid = validateStudentRecord(body, currentStore.catalogs, currentStore.teachers);
      if (invalid) return studentError(invalid, 400);
      const result = appendNewStudents(currentStore.students ?? [], [body]);
      if (result.duplicates) return studentError("Mã học viên đã tồn tại.", 409);
      currentStore.students = result.records;
      currentStore.studentHistory.push({ action: "create", code: studentCode(body), at: new Date().toISOString(), actor: "admin", after: body });
      saveStoreToFile(currentStore);
      return NextResponse.json({ success: true, data: body });
    }

    if (Array.isArray(body)) {
      currentStore[entityKey] = body;
    } else {
      if (!currentStore[entityKey]) currentStore[entityKey] = [];
      currentStore[entityKey].unshift(body);
    }

    saveStoreToFile(currentStore);

    return NextResponse.json({
      success: true,
      message: "Lưu dữ liệu thành công",
      count: currentStore[entityKey].length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 3. PUT: Cập nhật bản ghi
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const resolvedParams = await Promise.resolve(params);
    const entityKey = resolvedParams.entity;
    if (!Object.hasOwn(ENTITY_SCHEMAS, entityKey)) return studentError("Loại dữ liệu không hợp lệ.", 400);

    if (studentMutationDenied(req, entityKey)) return studentError("Bạn không có quyền quản lý học viên.", 403);
    const updatedRecord = await req.json();
    const currentStore = getStore(entityKey === "students");
    const list = currentStore[entityKey] || [];

    if (entityKey === "students") {
      if (!updatedRecord || typeof updatedRecord !== "object" || Array.isArray(updatedRecord) ||
          !studentCode(updatedRecord) ||
          (Object.hasOwn(updatedRecord, "hoTen") && !String(updatedRecord.hoTen ?? "").trim())) {
        return studentError("Cần mã học viên và họ tên hợp lệ khi sửa họ tên.", 400);
      }
      const code = studentCode(updatedRecord);
      const matches = list.filter((item) => studentCode(item) === code);
      if (!matches.length) return studentError("Không tìm thấy học viên.", 404);
      if (matches.length > 1) return studentError("Mã học viên đang trùng trong dữ liệu cũ.", 409);
      const record = { ...matches[0], ...updatedRecord };
      const invalid = validateStudentRecord(record, currentStore.catalogs, currentStore.teachers, matches[0]);
      if (invalid) return studentError(invalid, 400);
      currentStore.studentHistory.push({ action: "update", code, at: new Date().toISOString(), actor: "admin", before: matches[0], after: record });
      list[list.indexOf(matches[0])] = record;
      saveStoreToFile(currentStore);
      return NextResponse.json({ success: true, data: record });
    }

    const schema = ENTITY_SCHEMAS[entityKey];
    const keyField = schema?.fields[0]?.key || "id";

    const index = list.findIndex(
      (item) => String(item[keyField]) === String(updatedRecord[keyField])
    );

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy bản ghi để cập nhật" },
        { status: 404 }
      );
    }

    currentStore[entityKey][index] = { ...list[index], ...updatedRecord };
    saveStoreToFile(currentStore);

    return NextResponse.json({
      success: true,
      message: "Cập nhật thành công",
      data: currentStore[entityKey][index],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 4. DELETE: Xóa bản ghi
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const resolvedParams = await Promise.resolve(params);
    const entityKey = resolvedParams.entity;
    if (!Object.hasOwn(ENTITY_SCHEMAS, entityKey)) return studentError("Loại dữ liệu không hợp lệ.", 400);

    if (studentMutationDenied(req, entityKey)) return studentError("Bạn không có quyền quản lý học viên.", 403);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Thiếu tham số 'id' hoặc mã bản ghi cần xóa" },
        { status: 400 }
      );
    }

    const currentStore = getStore(entityKey === "students");
    const list = currentStore[entityKey] || [];
    if (entityKey === "students") {
      const code = id.trim().toUpperCase();
      const matches = list.filter((item) => studentCode(item) === code);
      if (!code || !matches.length) return studentError("Không tìm thấy học viên.", 404);
      if (matches.length > 1) return studentError("Mã học viên đang trùng trong dữ liệu cũ.", 409);
      if (currentStore.gradebooks.some(book => book.roster?.some((row: any) => studentCode(row) === code))) {
        return studentError("Học viên đã có lớp học phần. Hãy cập nhật trạng thái thay vì xóa hồ sơ.", 409);
      }
      currentStore.students = list.filter((item) => item !== matches[0]);
      currentStore.studentHistory.push({ action: "delete", code, at: new Date().toISOString(), actor: "admin", before: matches[0] });
      saveStoreToFile(currentStore);
      return NextResponse.json({ success: true });
    }
    const schema = ENTITY_SCHEMAS[entityKey];
    const keyField = schema?.fields[0]?.key || "id";

    currentStore[entityKey] = list.filter(
      (item) => String(item[keyField]) !== String(id)
    );
    saveStoreToFile(currentStore);

    return NextResponse.json({
      success: true,
      message: "Xóa bản ghi thành công",
      remainingCount: currentStore[entityKey].length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
