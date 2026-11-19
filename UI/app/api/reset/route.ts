import { requireAdmin } from "../../../lib/admin-api";
import { NextResponse } from "next/server";
import { getStore, saveStoreToFile } from "../../../lib/store"; // Trỏ đúng về file store.ts của bạn

export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const memoryStore = getStore();
    if (memoryStore.gradebooks.some(book => book.scores?.length || book.publishedScores?.length)) {
      return NextResponse.json({ success: false, error: "Dữ liệu đã có bảng điểm. Cần lưu trữ hồ sơ trước khi xóa hàng loạt." }, { status: 409 });
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
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}