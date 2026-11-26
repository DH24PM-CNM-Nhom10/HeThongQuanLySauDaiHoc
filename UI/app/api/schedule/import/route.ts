import { NextRequest, NextResponse } from "next/server";
import { requireStudentManager } from "../../../../lib/student-manager";
import { getStore, saveStoreToFile } from "../../../../lib/store";
import { prepareSchedule } from "../../../../../shared/schedule-import.cjs";
import * as XLSX from "xlsx";
import crypto from "node:crypto";
export async function POST(req: NextRequest) {
  const denied = await requireStudentManager(req);
  if (denied) return denied;
  try {
    const form = await req.formData(),
      file = form.get("file");
    if (
      !(file instanceof File) ||
      !/\.xlsx?$/i.test(file.name) ||
      file.size > 10 * 1024 * 1024
    )
      return NextResponse.json(
        { message: "Chọn file Excel .xlsx/.xls tối đa 10 MB." },
        { status: 400 },
      );
    const book = XLSX.read(Buffer.from(await file.arrayBuffer()), {
      type: "buffer",
    });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      book.Sheets[book.SheetNames[0]],
      { defval: "" },
    );
    const store = getStore(true),
      result = prepareSchedule(rows, store.teachingAssignments, store.schedule);
    if (result.errors.length)
      return NextResponse.json(
        { ...result, message: "File có lỗi; chưa lưu dòng nào." },
        { status: 400 },
      );
    const commit = form.get("commit") === "true";
    if (commit && result.additions.length) {
      const additions = result.additions.map((row) => ({
        ...row,
        id: crypto.randomUUID(),
      }));
      store.schedule.push(...additions);
      store.scheduleHistory.push({
        action: "import",
        at: new Date().toISOString(),
        fileName: file.name,
        ids: additions.map((r) => r.id),
      });
      saveStoreToFile(store);
    }
    return NextResponse.json({
      success: true,
      committed: commit,
      added: result.additions.length,
      duplicates: result.duplicates,
      data: result.additions,
    });
  } catch {
    return NextResponse.json(
      {
        message:
          "Không đọc/lưu được Excel. Dữ liệu cũ được giữ nguyên; hãy tải lại trước khi thử lại.",
      },
      { status: 400 },
    );
  }
}
