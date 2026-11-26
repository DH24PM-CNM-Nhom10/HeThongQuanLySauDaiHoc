import { NextResponse } from "next/server";
import { memoryStore } from "../../../lib/store";

export async function GET() {
  try {
    const stats = {
      studentsCount: memoryStore.students?.length || 0,
      teachersCount: memoryStore.teachers?.length || 0,
      assignmentsCount: memoryStore.assignments?.length || 0,
      gradesCount: memoryStore.grades?.length || 0,
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