import { NextRequest, NextResponse } from "next/server";
import { requireStudentManager } from "../../../lib/student-manager";
import { getStore, saveStoreToFile } from "../../../lib/store";
import {
  validateCourse,
  savedScores,
} from "../../../../shared/course-grading.cjs";
export async function GET(req: NextRequest) {
  const denied = await requireStudentManager(req);
  if (denied) return denied;
  const s = getStore(true);
  return NextResponse.json(
    {
      courses: s.courses,
      policies: s.academicPolicies,
      majors: s.catalogs.filter((c) => c.kind === "major"),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(req: NextRequest) {
  const denied = await requireStudentManager(req);
  if (denied) return denied;
  try {
    const { data, revision } = await req.json(),
      s = getStore(true);
    if (!data || typeof data.code !== "string")
      throw new Error("Dữ liệu môn học không hợp lệ.");
    const c = { ...data, code: data.code.trim().toUpperCase() };
    const invalid = validateCourse(c, s);
    if (invalid) throw new Error(invalid);
    const old = s.courses.find((r) => r.code === c.code);
    if (old && old.revision !== revision)
      return NextResponse.json(
        { message: "Môn học đã thay đổi. Hãy tải lại." },
        { status: 409 },
      );
    if (
      old &&
      s.teachingAssignments.some(
        (a) =>
          String(a.courseCode).toUpperCase() === c.code &&
          s.gradebooks.some(
            (b) => b.assignmentId === a.id && savedScores(b).length,
          ),
      )
    )
      return NextResponse.json(
        {
          message:
            "Môn đã có điểm; không thay đổi trọng số hoặc tín chỉ để tránh làm sai bảng điểm.",
        },
        { status: 409 },
      );
    const major = s.catalogs.find(
      (m) => m.kind === "major" && m.code === c.majorCode,
    );
    const next = {
      ...c,
      majorName: major!.name,
      revision: (old?.revision || 0) + 1,
      needsReview: false,
      validFromAdmissionYear: null,
    };
    s.courses = s.courses.filter((r) => r !== old);
    s.courses.push(next);
    s.academicHistory.push({
      kind: "course",
      before: old || null,
      after: next,
      at: new Date().toISOString(),
    });
    saveStoreToFile(s);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Không lưu được môn học." },
      { status: 400 },
    );
  }
}
