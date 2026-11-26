import { NextRequest } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getDb } from "../../../lib/mysql";
import { requireAdmin } from "../../../lib/admin-api";
import { noticeError, noticeResponse, noticeValues, parseNotice, requireNoticeManager } from "../../../lib/notice-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ThongBaoRow extends RowDataPacket {
  ma_thong_bao: number | string;
  tieu_de: string; noi_dung: string; ten_file: string; duong_dan_file: string;
  ngay_dang: string; trang_thai: "nhap" | "da_dang";
}

export async function GET(request: NextRequest) {
  const includeDrafts = request.nextUrl.searchParams.get("admin") === "1";
  if (includeDrafts) {
    const denied = await requireNoticeManager(request);
    if (denied) return denied;
  }
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam === null ? null : Number(limitParam);
  if (limit !== null && (!Number.isSafeInteger(limit) || limit < 1 || limit > 10000)) {
    return noticeError("Tham số limit phải từ 1 đến 10000.", 400);
  }
  try {
    const [rows] = await getDb().execute<ThongBaoRow[]>(`
      SELECT ma_thong_bao, tieu_de, noi_dung, ten_file, duong_dan_file,
        DATE_FORMAT(ngay_dang, '%Y-%m-%dT%H:%i:%s') AS ngay_dang, trang_thai
      FROM thong_bao
      ${includeDrafts ? "" : "WHERE trang_thai = 'da_dang'"}
      ORDER BY ngay_dang DESC, ma_thong_bao DESC
      ${limit === null ? "" : "LIMIT ?"}
    `, limit === null ? [] : [limit]);
    const data = rows.map(row => ({ ...row, ma_thong_bao: Number(row.ma_thong_bao) }));
    return noticeResponse({ success: true, total: data.length, data });
  } catch (error) {
    console.error("[API THONG BAO GET]", error);
    return noticeError("Không thể lấy thông báo từ cơ sở dữ liệu.", 500);
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireNoticeManager(request);
  if (denied) return denied;
  const input = parseNotice(await request.json().catch(() => null));
  if (!input) return noticeError("Vui lòng kiểm tra tiêu đề, nội dung, tệp đính kèm và trạng thái.", 400);
  try {
    const [result] = await getDb().execute<ResultSetHeader>(
      "INSERT INTO thong_bao (tieu_de, noi_dung, ten_file, duong_dan_file, trang_thai) VALUES (?, ?, ?, ?, ?)", noticeValues(input),
    );
    return noticeResponse({ success: true, data: { ma_thong_bao: result.insertId } }, 201);
  } catch (error) {
    console.error("[API THONG BAO POST]", error);
    return noticeError("Không thể lưu thông báo vào cơ sở dữ liệu.", 500);
  }
}
