import { requireAdmin } from "../../../lib/admin-api";
import { NextResponse } from "next/server";
import { getStore } from "../../../lib/store";

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const memoryStore = getStore();
    const stats = {
      studentsCount: memoryStore.students?.length || 0,
      teachersCount: memoryStore.teachers?.length || 0,
      assignmentsCount: memoryStore.teachingAssignments.length,
      gradesCount: memoryStore.gradebooks.reduce((count, book) => count + (book.publishedScores?.length || 0), 0),
      thesisCount: memoryStore.thesis?.length || 0,
      scheduleCount: memoryStore.schedule?.length || 0,
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
