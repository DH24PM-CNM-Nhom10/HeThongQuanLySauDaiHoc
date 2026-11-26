import { requireAdmin } from "../../../lib/admin-api";
import { NextResponse } from "next/server";
import { getStore, saveStoreToFile } from "../../../lib/store"; // Trỏ đúng về file store.ts của bạn
import { bulkDeleteConflict } from "../../../lib/bulk-delete";

export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const memoryStore = getStore();
    const conflict = bulkDeleteConflict(memoryStore, ["students", "teachers", "thesis"]);
    if (conflict) {
      return NextResponse.json({ success: false, error: conflict }, { status: 409 });
    }
    // 1. Dọn sạch bộ nhớ RAM của Server
    memoryStore.students = [];
    memoryStore.teachers = [];
    if (memoryStore.thesis) memoryStore.thesis = [];

    // 2. Lưu trạng thái mảng rỗng này xuống file db.json
    saveStoreToFile(memoryStore);

    return NextResponse.json({
      success: true,
      message: "Đã xóa sạch dữ liệu thành công!",
    });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Không thể xóa dữ liệu." }, { status: 500 });
  }
}
