import { NextRequest, NextResponse } from "next/server";
import { requireStudentManager } from "../../../../lib/student-manager";
import { getStore, saveStoreToFile } from "../../../../lib/store";
import { validateTerm } from "../../../../../shared/academic-calendar.cjs";
import { dateISO } from "../../../../../shared/thesis-progress.cjs";
export async function GET(req: NextRequest) {
  const denied = await requireStudentManager(req);
  if (denied) return denied;
  return NextResponse.json(
    { data: getStore(true).academicTerms },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(req: NextRequest) {
  const denied = await requireStudentManager(req);
  if (denied) return denied;
  try {
    const body = await req.json();
    const term = {
      schoolYear: String(body.schoolYear || "").trim(),
      semester: String(body.semester || ""),
      startDate: body.startDate,
      endDate: body.endDate,
    };
    const error = validateTerm(term);
    if (error) throw new Error(error);
    const s = getStore(true),
      old = s.academicTerms.find(
        (t) => t.schoolYear === term.schoolYear && t.semester === term.semester,
      );
    if (old && old.revision !== body.revision)
      return NextResponse.json(
        { message: "Lịch học kỳ đã thay đổi. Hãy tải lại." },
        { status: 409 },
      );
    if (
      s.schedule.some(
        (r) =>
          r.schoolYear === term.schoolYear &&
          String(r.semester) === term.semester &&
          (!dateISO(r.date) ||
            dateISO(r.date) < term.startDate ||
            dateISO(r.date) > term.endDate),
      )
    )
      throw new Error(
        "Đang có lịch học ngoài khoảng ngày mới. Không thể thay đổi lịch học kỳ.",
      );
    s.academicTerms = s.academicTerms.filter((t) => t !== old);
    s.academicTerms.push({ ...term, revision: (old?.revision || 0) + 1 });
    s.scheduleHistory.push({
      action: "term-config",
      before: old || null,
      after: term,
      at: new Date().toISOString(),
    });
    saveStoreToFile(s);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      {
        message: e instanceof Error ? e.message : "Không lưu được lịch học kỳ.",
      },
      { status: 400 },
    );
  }
}
