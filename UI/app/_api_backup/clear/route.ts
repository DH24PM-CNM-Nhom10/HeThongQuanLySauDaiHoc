import { NextRequest, NextResponse } from "next/server";
import { memoryStore } from "../../../lib/store";

export async function POST(req: NextRequest) {
  try {
    const { entityKey } = await req.json().catch(() => ({ entityKey: null }));

    if (entityKey) {
      // Xóa dữ liệu của 1 thực thể cụ thể (vd: teachers hoặc students)
      memoryStore[entityKey] = [];
      return NextResponse.json({
        success: true,
        message: `Đã xóa sạch dữ liệu của ${entityKey}`,
      });
    }

    // Xóa sạch toàn bộ memoryStore
    Object.keys(memoryStore).forEach((key) => {
      memoryStore[key] = [];
    });

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