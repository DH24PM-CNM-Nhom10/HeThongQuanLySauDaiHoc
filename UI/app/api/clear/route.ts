import { requireAdmin } from "../../../lib/admin-api";
import { NextRequest, NextResponse } from "next/server";
import { getStore, saveStoreToFile } from "../../../lib/store";
import { ENTITY_SCHEMAS } from "../../../lib/schemas";
import { bulkDeleteConflict } from "../../../lib/bulk-delete";

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: "Yêu cầu xóa không hợp lệ." }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const entityKey = input.entityKey;
    if (entityKey !== undefined && (typeof entityKey !== "string" || !Object.hasOwn(ENTITY_SCHEMAS, entityKey))) {
      return NextResponse.json({ success: false, error: "Loại dữ liệu cần xóa không hợp lệ." }, { status: 400 });
    }
    if (entityKey === undefined && input.all !== true) {
      return NextResponse.json({ success: false, error: "Cần chọn loại dữ liệu hoặc xác nhận all=true để xóa toàn bộ." }, { status: 400 });
    }
    const memoryStore = getStore();
    const conflict = bulkDeleteConflict(memoryStore, typeof entityKey === "string" ? [entityKey] : null);
    if (conflict) {
      return NextResponse.json({ success: false, error: conflict }, { status: 409 });
    }

    if (typeof entityKey === "string") {
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
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: "Lỗi khi reset database", details: error instanceof Error ? error.message : "Lỗi không xác định" },
      { status: 500 }
    );
  }
}
