import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { memoryStore } from "../../../lib/store";
import { ENTITY_SCHEMAS } from "../../../lib/schemas";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const entityKey = searchParams.get("entity");

    if (!entityKey || !ENTITY_SCHEMAS[entityKey]) {
      return NextResponse.json(
        { success: false, error: "Thực thể không hợp lệ hoặc thiếu tham số 'entity'" },
        { status: 400 }
      );
    }

    const schema = ENTITY_SCHEMAS[entityKey];
    const rawData = memoryStore[entityKey] || [];

    if (rawData.length === 0) {
      return NextResponse.json(
        { success: false, error: "Không có dữ liệu trong hệ thống để xuất file" },
        { status: 404 }
      );
    }

    // 1. Chuyển đổi key dữ liệu thành nhãn tiếng Việt theo Schema
    const formattedData = rawData.map((item) => {
      const row: Record<string, any> = {};
      schema.fields.forEach((field) => {
        row[field.label] = item[field.key] || "";
      });
      return row;
    });

    // 2. Tạo Worksheet & Workbook bằng thư viện XLSX
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, schema.label || "Danh sách");

    // 3. Xuất file dạng Buffer
    const excelBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    const filename = `danh_sach_${entityKey}_${Date.now()}.xlsx`;

    // 4. Trả về Response stream file .xlsx
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống khi xuất file Excel", details: error.message },
      { status: 500 }
    );
  }
}