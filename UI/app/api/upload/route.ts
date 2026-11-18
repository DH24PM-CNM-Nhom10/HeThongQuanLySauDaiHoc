import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { AGU_SESSION_COOKIE, readAguSession } from "../../../lib/agu-auth";
import { ENTITY_SCHEMAS } from "../../../lib/schemas";
import { getStore, saveStoreToFile } from "../../../lib/store";
import { appendNewStudents } from "../../../lib/studentRecords";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const entityKey = (formData.get("entityKey") as string) || "students";
    const sheetName = formData.get("sheetName") as string;
    const mappingStr = formData.get("mapping") as string;
    if (!Object.hasOwn(ENTITY_SCHEMAS, entityKey)) {
      return NextResponse.json({ success: false, error: "Loại dữ liệu không hợp lệ." }, { status: 400 });
    }
    if (entityKey === "students" && readAguSession(req.cookies.get(AGU_SESSION_COOKIE)?.value)?.role !== "admin") {
      return NextResponse.json({ success: false, error: "Bạn không có quyền nhập học viên." }, { status: 403 });
    }

    if (!file) {
      return NextResponse.json({ success: false, error: "Chưa chọn file Excel" });
    }

    const mapping: Record<string, number> = mappingStr ? JSON.parse(mappingStr) : {};
    if (entityKey === "students" && (!Number.isInteger(mapping.maHocVien) || mapping.maHocVien < 0)) {
      return NextResponse.json({ success: false, error: "Hãy ánh xạ cột Mã học viên trước khi lưu." }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const targetSheet = sheetName && workbook.SheetNames.includes(sheetName)
      ? sheetName
      : workbook.SheetNames[0];

    const sheet = workbook.Sheets[targetSheet];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];

    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: "File Excel rỗng" });
    }

    // 1. Tìm vị trí dòng tiêu đề
    let headerIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const rowStr = (rows[i] || []).map((c) => String(c || "").toLowerCase()).join(" ");
      if (
        rowStr.includes("stt") ||
        rowStr.includes("mã") ||
        rowStr.includes("họ") ||
        rowStr.includes("cccd") ||
        rowStr.includes("shcc")
      ) {
        headerIdx = i;
        break;
      }
    }
    const selectedHeader = formData.get("headerIndex");
    if (entityKey === "students" && typeof selectedHeader === "string" && /^\d+$/.test(selectedHeader) &&
        Number(selectedHeader) < rows.length) {
      headerIdx = Number(selectedHeader);
    }

    // 2. Trích xuất các dòng dữ liệu phía sau tiêu đề
    const dataRows = rows.slice(headerIdx + 1);
    const parsedRecords: any[] = [];

    dataRows.forEach((row, idx) => {
      if (!row || row.length === 0) return;
      const record: Record<string, any> = { id: `id_${Date.now()}_${idx}` };
      let hasData = false;

      Object.entries(mapping).forEach(([fieldKey, colIdx]) => {
        const val = row[colIdx];
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          record[fieldKey] = String(val).trim();
          hasData = true;
        }
      });

      if (hasData) {
        parsedRecords.push(record);
      }
    });

    // 3. Ghi dữ liệu vào db.json ở thư mục gốc dự án
    const currentDb = getStore(true);
    if (entityKey === "students") {
      const { records, added, duplicates, missingCode } = appendNewStudents(currentDb.students ?? [], parsedRecords);
      if (added > 0) {
        currentDb.students = records;
        saveStoreToFile(currentDb);
      }
      return NextResponse.json({ success: true, data: records, count: records.length, added, duplicates, missingCode, entityKey });
    }

    currentDb[entityKey] = parsedRecords;
    saveStoreToFile(currentDb);

    return NextResponse.json({
      success: true,
      data: parsedRecords,
      count: parsedRecords.length,
      entityKey,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}
