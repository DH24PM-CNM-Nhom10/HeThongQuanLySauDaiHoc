import { isMasterStudent } from '../../../../../../shared/masters-scope.cjs';
import { NextRequest, NextResponse } from "next/server";
import { requireStudentManager } from "../../../../../lib/student-manager";
import { getStore, saveStoreToFile } from "../../../../../lib/store";
import {
  workflowView,
  applyWorkflow,
} from "../../../../../../shared/thesis-workflow.cjs";
export async function GET(req: NextRequest) {
  const denied = await requireStudentManager(req);
  if (denied) return denied;
  const code = String(req.nextUrl.searchParams.get("student") || "")
      .trim()
      .toUpperCase(),
    s = getStore(true);
  if (!s.students.some(row=>String(row.maHocVien||row.ma_hoc_vien||"").toUpperCase()===code&&isMasterStudent(row))) return NextResponse.json({message:"Không tìm thấy học viên thạc sĩ."},{status:404});
  return NextResponse.json(
    {
      workflow: workflowView(s, code),
      teachers: s.teachers.map((t) => ({
        id: String(t.shcc || t.id),
        name: t.hoten || t.hoTen,
      })),
      documents: s.studentDocuments
        .filter((d) => d.maHocVien === code && !d.deletedAt)
        .map((d) => ({ kind: d.kind, status: d.status, title: d.title })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(req: NextRequest) {
  const denied = await requireStudentManager(req);
  if (denied) return denied;
  try {
    const body = await req.json(),
      s = getStore(true),
      w = applyWorkflow(
        s,
        String(body.code || "")
          .trim()
          .toUpperCase(),
        { manager: true, name: "student-manager" },
        body,
      );
    saveStoreToFile(s);
    return NextResponse.json({ workflow: w });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Không lưu được." },
      { status: 400 },
    );
  }
}
