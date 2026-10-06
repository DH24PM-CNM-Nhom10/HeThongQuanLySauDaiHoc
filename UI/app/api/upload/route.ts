import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const entityKey = (formData.get("entityKey") as string) || "students";
    const sheetName = formData.get("sheetName") as string;
    const mappingStr = formData.get("mapping") as string;

    if (!file) {
      return NextResponse.json({ success: false, error: "Chưa chọn file Excel" });
    }

    const mapping: Record<string, number> = mappingStr ? JSON.parse(mappingStr) : {};
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
    const dbPath = path.join(process.cwd(), "db.json");
    let currentDb: Record<string, any> = { students: [], teachers: [] };

    if (fs.existsSync(dbPath)) {
      try {
        const fileContent = fs.readFileSync(dbPath, "utf-8");
        if (fileContent.trim()) {
          currentDb = JSON.parse(fileContent);
        }
      } catch (e) {
        console.error("Lỗi đọc file db.json:", e);
      }
    }

    currentDb[entityKey] = parsedRecords;
    fs.writeFileSync(dbPath, JSON.stringify(currentDb, null, 2), "utf-8");

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