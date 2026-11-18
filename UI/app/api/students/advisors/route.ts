import { NextRequest, NextResponse } from "next/server";
import { AGU_SESSION_COOKIE, readAguSession } from "../../../../lib/agu-auth";
import { getStore } from "../../../../lib/store";

export async function GET(request: NextRequest) {
  const session = readAguSession(request.cookies.get(AGU_SESSION_COOKIE)?.value);
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Bạn không có quyền xem danh sách giảng viên." }, { status: 403 });
  }

  try {
    const teachers = getStore(true).teachers ?? [];
    const names = new Set<string>();
    for (const teacher of teachers) {
      const name = String(teacher.hoten || teacher.hoTen || teacher.ho_ten || teacher.name || "").trim();
      if (name) names.add(name);
    }
    return NextResponse.json({
      data: [...names].sort((a, b) => a.localeCompare(b, "vi")),
    });
  } catch {
    return NextResponse.json({ error: "Không tải được danh sách giảng viên." }, { status: 500 });
  }
}
