import { NextRequest, NextResponse } from "next/server";
import { requireStudentManager } from "../../../lib/student-manager";
import { getStore, saveStoreToFile } from "../../../lib/store";
import {
  validatePolicy,
  validatePlan,
  calculateProgress,
} from "../../../../shared/academic.cjs";
import crypto from "node:crypto";
export async function GET(req: NextRequest) {
  const denied = await requireStudentManager(req);
  if (denied) return denied;
  const s = getStore(true),
    code = req.nextUrl.searchParams.get("student");
  return NextResponse.json(
    code
      ? calculateProgress(s, code)
      : {
          policies: s.academicPolicies,
          courses: s.courses,
          plans: s.academicPlans,
          classes: [
            ...new Set(s.students.map((r) => r.lop).filter(Boolean)),
          ].sort(),
          students: s.students.map((r) => ({
            code: r.maHocVien || r.ma_hoc_vien,
            name: r.hoTen || r.ho_ten,
            classCode: r.lop,
          })),
        },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(req: NextRequest) {
  const denied = await requireStudentManager(req);
  if (denied) return denied;
  try {
    const { kind, data, revision } = await req.json(),
      s = getStore(true);
    if (!["policy", "plan"].includes(kind))
      throw new Error("Loại cấu hình không hợp lệ.");
    if (kind === 'plan') {
      if (!Array.isArray(data?.courses)) throw new Error('Chọn học phần trong danh mục môn học.');
      data.courses = data.courses.map((c:any) => {const course=s.courses.find(row=>row.code===String(c.code).trim().toUpperCase());if(!course) throw new Error('Môn học chưa được thêm/cấu hình trọng số.');return {code:course.code,name:course.name,credits:course.credits,required:!!c.required};});
    }
    const error =
      kind === "policy" ? validatePolicy(data) : validatePlan(data, s);
    if (error) throw new Error(error);
    if (kind === "policy")
      s.academicPolicies.push({
        ...data,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      });
    else {
      const old = s.academicPlans.find((p) => p.classCode === data.classCode);
      if (old && revision !== old.revision)
        return NextResponse.json(
          { message: "Kế hoạch đã thay đổi. Hãy tải lại." },
          { status: 409 },
        );
      const plan = {
        ...data,
        courses: data.courses.map((c: any) => ({
          ...c,
          code: c.code.trim().toUpperCase(),
        })),
        revision: (old?.revision || 0) + 1,
      };
      s.academicPlans = s.academicPlans.filter((p) => p !== old);
      s.academicPlans.push(plan);
    }
    s.academicHistory.push({ kind, data, at: new Date().toISOString() });
    saveStoreToFile(s);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Không lưu được cấu hình." },
      { status: 400 },
    );
  }
}
