import { NextRequest, NextResponse } from "next/server";
import { getStore, saveStoreToFile } from "../../../lib/store";
import { ENTITY_SCHEMAS } from "../../../lib/schemas";

// 1. GET: Lấy danh sách trực tiếp từ db.json
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> | { entity: string } }
) {
  try {
    // Giải quyết params để tương thích cả Next.js 14 & 15
    const resolvedParams = await Promise.resolve(params);
    const entityKey = resolvedParams.entity;

    if (!entityKey) {
      return NextResponse.json({ success: false, error: "Thiếu entityKey" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // Luôn lấy store mới nhất từ db.json
    const currentStore = getStore();
    const list = currentStore[entityKey] || [];

    // Lọc theo từ khóa tìm kiếm
    const filtered = search
      ? list.filter((item) =>
          Object.values(item).some((val) =>
            String(val ?? "").toLowerCase().includes(search.toLowerCase())
          )
        )
      : list;

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedData = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      data: paginatedData,
      pagination: { total, page, limit, totalPages },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 2. POST: Thêm / Ghi đè danh sách
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> | { entity: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const entityKey = resolvedParams.entity;

    const body = await req.json();
    const currentStore = getStore();

    if (Array.isArray(body)) {
      currentStore[entityKey] = body;
    } else {
      if (!currentStore[entityKey]) currentStore[entityKey] = [];
      currentStore[entityKey].unshift(body);
    }

    saveStoreToFile(currentStore);

    return NextResponse.json({
      success: true,
      message: "Lưu dữ liệu thành công",
      count: currentStore[entityKey].length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 3. PUT: Cập nhật bản ghi
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> | { entity: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const entityKey = resolvedParams.entity;

    const updatedRecord = await req.json();
    const currentStore = getStore();
    const list = currentStore[entityKey] || [];

    const schema = ENTITY_SCHEMAS[entityKey];
    const keyField = schema?.fields[0]?.key || "id";

    const index = list.findIndex(
      (item) => String(item[keyField]) === String(updatedRecord[keyField])
    );

    if (index === -1) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy bản ghi để cập nhật" },
        { status: 404 }
      );
    }

    currentStore[entityKey][index] = { ...list[index], ...updatedRecord };
    saveStoreToFile(currentStore);

    return NextResponse.json({
      success: true,
      message: "Cập nhật thành công",
      data: currentStore[entityKey][index],
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 4. DELETE: Xóa bản ghi
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ entity: string }> | { entity: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const entityKey = resolvedParams.entity;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Thiếu tham số 'id' hoặc mã bản ghi cần xóa" },
        { status: 400 }
      );
    }

    const currentStore = getStore();
    const list = currentStore[entityKey] || [];
    const schema = ENTITY_SCHEMAS[entityKey];
    const keyField = schema?.fields[0]?.key || "id";

    currentStore[entityKey] = list.filter(
      (item) => String(item[keyField]) !== String(id)
    );
    saveStoreToFile(currentStore);

    return NextResponse.json({
      success: true,
      message: "Xóa bản ghi thành công",
      remainingCount: currentStore[entityKey].length,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}