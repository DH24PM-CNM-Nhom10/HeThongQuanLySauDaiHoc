import { requireStudentManager } from "../../../lib/student-manager";
import { NextResponse } from "next/server";
import { requireAdmin } from "../../../lib/admin-api";
import { getStore, saveStoreToFile } from "../../../lib/store";
import { normalize } from "../../../../shared/system-store.cjs";

export async function GET(request: Request) {
  const denied = await requireStudentManager(request);
  if (denied) return denied;
  return NextResponse.json({ success: true, data: getStore().catalogs });
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    const input = await request.json();
    const kind = normalize(input.kind);
    const code = normalize(input.code);
    const name = normalize(input.name);
    const majorCode = normalize(input.majorCode);
    if (!["major", "class", "program", "level", "cohort", "study_mode"].includes(kind) || !code || (kind === "major" && !name)) {
      return NextResponse.json({ error: "Nhập đủ thông tin danh mục." }, { status: 400 });
    }
    const store = getStore();
    if (kind === "class" && !store.catalogs.some(row => row.kind === "major" && row.code === majorCode)) {
      return NextResponse.json({ error: "Chọn mã ngành có trong danh mục." }, { status: 400 });
    }
    const id = kind + ":" + code + (kind === "class" ? ":" + majorCode : "");
    if (store.catalogs.some(row => row.id.toUpperCase() === id.toUpperCase())) {
      return NextResponse.json({ error: "Mục này đã tồn tại." }, { status: 409 });
    }
    store.catalogs.push({ id, kind, code, name: kind === "major" ? name : code, ...(kind === "class" ? { majorCode } : {}) });
    saveStoreToFile(store);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Không lưu được danh mục. Hãy tải lại và thử lại." }, { status: 409 });
  }
}
