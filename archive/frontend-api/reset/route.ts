import { NextResponse } from "next/server";
import { memoryStore, saveStoreToFile } from "../../../lib/store"; // Trỏ đúng về file store.ts của bạn

export async function POST() {
  try {
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