import { isMasterStudent, isMasterAssignment, isMasterSchedule } from "../../../../shared/masters-scope.cjs";
import { savedScores } from "../../../../shared/course-grading.cjs";
import { requireAdmin } from "../../../lib/admin-api";
import { NextResponse } from "next/server";
import { getStore } from "../../../lib/store";

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const memoryStore = getStore();
    const assignments = memoryStore.teachingAssignments.filter(row => isMasterAssignment(memoryStore, row));
    const ids = new Set(assignments.map(row => row.id));
    const codes = new Set(memoryStore.students.filter(isMasterStudent).map(row => row.maHocVien));
    const stats = {
      studentsCount: memoryStore.students.filter(isMasterStudent).length,
      teachersCount: memoryStore.teachers?.length || 0,
      assignmentsCount: assignments.length,
      gradesCount: memoryStore.gradebooks.filter(book => ids.has(book.assignmentId)).reduce((count, book) => count + savedScores(book).length, 0),
      thesisCount: memoryStore.thesis?.filter(row => codes.has(row.maHocVien)).length || 0,
      scheduleCount: memoryStore.schedule.filter(row => isMasterSchedule(memoryStore, row)).length,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Lỗi hệ thống không xác định";

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
