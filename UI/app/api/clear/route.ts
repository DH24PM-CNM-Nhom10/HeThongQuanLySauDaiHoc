import { requireAdmin } from "../../../lib/admin-api";
import { NextRequest, NextResponse } from "next/server";
import { getStore, saveStoreToFile } from "../../../lib/store";

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const memoryStore = getStore();
    if (memoryStore.gradebooks.some(book => book.scores?.length || book.publishedScores?.length)) {
      return NextResponse.json({ success: false, error: "Dữ liệu đã có bảng điểm. Cần lưu trữ hồ sơ trước khi xóa hàng loạt." }, { status: 409 });
    }
    const { entityKey } = await req.json().catch(() => ({ entityKey: null }));

    if (entityKey) {
      // Xóa dữ liệu của 1 thực thể cụ thể (vd: teachers hoặc students)
      memoryStore[entityKey] = [];
      saveStoreToFile(memoryStore);
      return NextResponse.json({
        success: true,
        message: `Đã xóa sạch dữ liệu của ${entityKey}`,
      });
    }

    // Xóa sạch toàn bộ memoryStore
    Object.keys(memoryStore).forEach((key) => {
      memoryStore[key] = [];
    });

    saveStoreToFile(memoryStore);
    return NextResponse.json({
      success: true,
      message: "Đã reset toàn bộ Database về trạng thái mới toanh!",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Lỗi khi reset database", details: error.message },
      { status: 500 }
    );
  }
}