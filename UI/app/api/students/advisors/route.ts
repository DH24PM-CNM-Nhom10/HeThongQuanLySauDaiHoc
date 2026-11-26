import { NextRequest, NextResponse } from "next/server";
import { requireStudentManager } from "../../../../lib/student-manager";
import { getStore } from "../../../../lib/store";

export async function GET(request: NextRequest) {
  const denied = await requireStudentManager(request);
  if (denied) return denied;

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
