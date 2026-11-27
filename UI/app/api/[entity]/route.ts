import { isMasterStudent, isMasterSchedule } from '../../../../shared/masters-scope.cjs';
import { councilConflict } from '../../../../shared/thesis-workflow.cjs';
import { requireStudentManager } from "../../../lib/student-manager";
import { validateStudentRecord } from "../../../lib/student-validation";
import { NextRequest, NextResponse } from "next/server";
import { getStore, saveStoreToFile } from "../../../lib/store";
import { requireAdmin } from "../../../lib/admin-api";
import { ENTITY_SCHEMAS } from "../../../lib/schemas";
import { AGU_SESSION_COOKIE, readAguSession } from "../../../lib/agu-auth";
import { appendNewStudents, studentCode } from "../../../lib/studentRecords";
import { teacherDeletionConflict } from "../../../../shared/teacher-links.cjs";
import { filterStudents } from "../../../../shared/student-profile.cjs";

function studentError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

// 1. GET: Lấy danh sách trực tiếp từ db.json
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const requestedEntity = (await params).entity;
  const denied = ["students", "teachers", "schedule"].includes(requestedEntity) ? await requireStudentManager(req) : requireAdmin(req);
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
    const sourceList = currentStore[entityKey] || [];
    const list = entityKey === "students" ? sourceList.filter(isMasterStudent) : entityKey === "schedule" ? sourceList.filter(row=>isMasterSchedule(currentStore,row)) : sourceList;

    // Lọc theo từ khóa tìm kiếm
    const filtered = entityKey === 'students' ? filterStudents(list, {
      search, major: searchParams.get('major') || '', cohort: searchParams.get('cohort') || '',
      classCode: searchParams.get('class') || '', status: searchParams.get('status') || '',
    }) : search
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
  const requestedEntity = (await params).entity;
  if (requestedEntity === "schedule") return NextResponse.json({ message: "Chỉ nhập thời khóa biểu qua Excel tại trang Thời khóa biểu." }, { status: 405 });
  const denied = ["students", "teachers", "schedule"].includes(requestedEntity) ? await requireStudentManager(req) : requireAdmin(req);
  if (denied) return denied;
  if (requestedEntity === "teachers") return studentError("Dùng chức năng quản lý giảng viên để kiểm tra liên kết và phiên bản hồ sơ.", 405);
  try {
    const resolvedParams = await Promise.resolve(params);
    const entityKey = resolvedParams.entity;
    if (!Object.hasOwn(ENTITY_SCHEMAS, entityKey)) return studentError("Loại dữ liệu không hợp lệ.", 400);

    const body = await req.json();
    const currentStore = getStore(entityKey === "students");

    if (entityKey === "students") {
      if (!body || typeof body !== "object" || Array.isArray(body) || !studentCode(body) || !String(body.hoTen ?? "").trim()) {
        return studentError("Cần nhập mã và họ tên học viên.", 400);
      }
      if (!isMasterStudent(body)) return studentError("Hệ thống này chỉ quản lý học viên thạc sĩ.",400);
      const invalid = validateStudentRecord(body, currentStore.catalogs, currentStore.teachers);
      if (invalid) return studentError(invalid, 400);
      const result = appendNewStudents(currentStore.students ?? [], [body]);
      if (result.duplicates) return studentError("Mã học viên đã tồn tại.", 409);
      currentStore.students = result.records;
      currentStore.studentHistory.push({ action: "create", code: studentCode(body), at: new Date().toISOString(), actor: readAguSession(req.cookies.get(AGU_SESSION_COOKIE)?.value)?.role === "admin" ? "admin" : "phongdaotao@agu.edu.vn", after: body });
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
  const requestedEntity = (await params).entity;
  if (requestedEntity === "schedule") return NextResponse.json({ message: "Chỉ nhập thời khóa biểu qua Excel tại trang Thời khóa biểu." }, { status: 405 });
  const denied = ["students", "teachers", "schedule"].includes(requestedEntity) ? await requireStudentManager(req) : requireAdmin(req);
  if (denied) return denied;
  if (requestedEntity === "teachers") return studentError("Dùng chức năng quản lý giảng viên để kiểm tra liên kết và phiên bản hồ sơ.", 405);
  try {
    const resolvedParams = await Promise.resolve(params);
    const entityKey = resolvedParams.entity;
    if (!Object.hasOwn(ENTITY_SCHEMAS, entityKey)) return studentError("Loại dữ liệu không hợp lệ.", 400);

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
      if (!isMasterStudent(matches[0])) return studentError("Hồ sơ ngoài phạm vi thạc sĩ được giữ để đối chiếu lịch sử.", 409);
      if (!isMasterStudent(matches[0])) return studentError("Hồ sơ ngoài phạm vi thạc sĩ được giữ lịch sử, không chỉnh sửa tại đây.",409);
      const record = { ...matches[0], ...updatedRecord };
      if (!isMasterStudent(record)) return studentError("Chỉ được quản lý trình độ thạc sĩ.",400);
      if (councilConflict(currentStore,code,[record.gvHuongDan1,record.gvHuongDan2])) return studentError("Giảng viên hướng dẫn đang là chủ tịch hoặc phản biện của học viên.", 400);
      const invalid = validateStudentRecord(record, currentStore.catalogs, currentStore.teachers, matches[0]);
      if (invalid) return studentError(invalid, 400);
      currentStore.studentHistory.push({ action: "update", code, at: new Date().toISOString(), actor: readAguSession(req.cookies.get(AGU_SESSION_COOKIE)?.value)?.role === "admin" ? "admin" : "phongdaotao@agu.edu.vn", before: matches[0], after: record });
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
  const requestedEntity = (await params).entity;
  if (requestedEntity === "schedule") return NextResponse.json({ message: "Chỉ nhập thời khóa biểu qua Excel tại trang Thời khóa biểu." }, { status: 405 });
  const denied = ["students", "teachers", "schedule"].includes(requestedEntity) ? await requireStudentManager(req) : requireAdmin(req);
  if (denied) return denied;
  if (requestedEntity === "teachers") return studentError("Dùng chức năng quản lý giảng viên để kiểm tra liên kết và phiên bản hồ sơ.", 405);
  try {
    const resolvedParams = await Promise.resolve(params);
    const entityKey = resolvedParams.entity;
    if (!Object.hasOwn(ENTITY_SCHEMAS, entityKey)) return studentError("Loại dữ liệu không hợp lệ.", 400);

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
      if (!isMasterStudent(matches[0])) return studentError("Hồ sơ ngoài phạm vi thạc sĩ được giữ để đối chiếu lịch sử.", 409);
      if (currentStore.gradebooks.some(book => book.roster?.some((row: any) => studentCode(row) === code))) {
        return studentError("Học viên đã có lớp học phần. Hãy cập nhật trạng thái thay vì xóa hồ sơ.", 409);
      }
      if ((currentStore.thesisWorkflows || []).some(row => row.maHocVien === code)) return studentError('Học viên đang có hồ sơ quy trình luận văn. Không được xóa hồ sơ liên kết.', 409);
      if (currentStore.studentDocuments.some(row => row.maHocVien === code)) return studentError('Học viên đã có hồ sơ minh chứng. Hãy lưu trữ hồ sơ thay vì xóa.', 409);
      currentStore.students = list.filter((item) => item !== matches[0]);
      currentStore.studentHistory.push({ action: "delete", code, at: new Date().toISOString(), actor: readAguSession(req.cookies.get(AGU_SESSION_COOKIE)?.value)?.role === "admin" ? "admin" : "phongdaotao@agu.edu.vn", before: matches[0] });
      saveStoreToFile(currentStore);
      return NextResponse.json({ success: true });
    }
    if (entityKey === "teachers") {
      const matches = list.filter(row => String(row.shcc) === id || String(row.id) === id);
      if (!matches.length) return studentError("Không tìm thấy giảng viên.", 404);
      if (matches.length !== 1) return studentError("Mã giảng viên bị trùng.", 409);
      const conflict = teacherDeletionConflict(currentStore, matches[0]);
      if (conflict) return studentError(conflict, 409);
      currentStore.teachers = list.filter(row => row !== matches[0]);
      saveStoreToFile(currentStore);
      return NextResponse.json({ success: true, remainingCount: currentStore.teachers.length });
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
