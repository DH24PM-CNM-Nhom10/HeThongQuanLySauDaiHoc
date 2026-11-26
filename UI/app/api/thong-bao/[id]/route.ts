import { NextRequest } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getDb } from "../../../../lib/mysql";
import { noticeError, noticeResponse, noticeValues, parseNotice, parseNoticeId, requireNoticeAdmin } from "../../../../lib/notice-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: Context) {
  const denied = requireNoticeAdmin(request);
  if (denied) return denied;
  const id = parseNoticeId((await context.params).id);
  if (id === null) return noticeError("Mã thông báo không hợp lệ.", 400);
  const input = parseNotice(await request.json().catch(() => null));
  if (!input) return noticeError("Vui lòng kiểm tra tiêu đề, nội dung, tệp đính kèm và trạng thái.", 400);
  try {
    const db = getDb();
    const [result] = await db.execute<ResultSetHeader>(
      "UPDATE thong_bao SET tieu_de=?, noi_dung=?, ten_file=?, duong_dan_file=?, trang_thai=? WHERE ma_thong_bao=?", [...noticeValues(input), id],
    );
    // MySQL có thể trả affectedRows=0 khi nội dung được lưu không thay đổi.
    if (!result.affectedRows) {
      const [rows] = await db.execute<RowDataPacket[]>("SELECT ma_thong_bao FROM thong_bao WHERE ma_thong_bao=?", [id]);
      if (!rows.length) return noticeError("Không tìm thấy thông báo.", 404);
    }
    return noticeResponse({ success: true, data: { ma_thong_bao: id } });
  } catch (error) {
    console.error("[API THONG BAO PUT]", error);
    return noticeError("Không thể cập nhật thông báo.", 500);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const denied = requireNoticeAdmin(request);
  if (denied) return denied;
  const id = parseNoticeId((await context.params).id);
  if (id === null) return noticeError("Mã thông báo không hợp lệ.", 400);
  try {
    const [result] = await getDb().execute<ResultSetHeader>("DELETE FROM thong_bao WHERE ma_thong_bao=?", [id]);
    if (!result.affectedRows) return noticeError("Không tìm thấy thông báo.", 404);
    return noticeResponse({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("[API THONG BAO DELETE]", error);
    return noticeError("Không thể xóa thông báo.", 500);
  }
}
