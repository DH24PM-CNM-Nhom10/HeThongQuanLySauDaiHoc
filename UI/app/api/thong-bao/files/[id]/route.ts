import { NextRequest, NextResponse } from "next/server";
import { requireStudentManager } from "../../../../../lib/student-manager";
import { getStore } from "../../../../../lib/store";
import { getDb } from "../../../../../lib/mysql";
import { noticeFileDirectory } from "../../../../../lib/notice-files";
import type { RowDataPacket } from "mysql2";
import fs from "node:fs";
import path from "node:path";
export const runtime = "nodejs";
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id))
    return new NextResponse(null, { status: 404 });
  try {
    const row = getStore(true).noticeAttachments.find((r) => r.id === id);
    if (!row) return new NextResponse(null, { status: 404 });
    const denied = await requireStudentManager(req);
    if (denied) {
      const [notices] = await getDb().execute<RowDataPacket[]>(
        "SELECT ma_thong_bao FROM thong_bao WHERE duong_dan_file = ? AND trang_thai = 'da_dang' LIMIT 1",
        ["/api/thong-bao/files/" + id],
      );
      if (!notices.length) return new NextResponse(null, { status: 404 });
    }
    if (![".pdf", ".docx", ".xlsx", ".jpg", ".jpeg", ".png"].includes(row.ext))
      return new NextResponse(null, { status: 404 });
    const bytes = fs.readFileSync(
      path.join(noticeFileDirectory(), id + row.ext),
    );
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": row.mime,
        "Content-Disposition":
          "attachment; filename*=UTF-8''" + encodeURIComponent(row.name),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
