import { requireStudentManager } from './student-manager';
import { NextResponse } from "next/server";
import { requireAdmin } from "./admin-api";

export type NoticeInput = {
  tieu_de: string; noi_dung: string; ten_file: string; duong_dan_file: string;
  trang_thai: "nhap" | "da_dang";
};

export function noticeResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function noticeError(message: string, status: number) {
  return noticeResponse({ success: false, message }, status);
}

export function requireNoticeAdmin(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return noticeError("Origin không hợp lệ.", 403);
  return null;
}

export function parseNotice(raw: unknown): NoticeInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  if (!["tieu_de", "noi_dung", "ten_file", "duong_dan_file"].every(key => typeof body[key] === "string")) return null;
  const tieu_de = (body.tieu_de as string).trim();
  const noi_dung = (body.noi_dung as string).trim();
  const ten_file = (body.ten_file as string).trim();
  const duong_dan_file = (body.duong_dan_file as string).trim();
  const trang_thai = body.trang_thai;
  if (!tieu_de || tieu_de.length > 255 || noi_dung.length > 20000 || ten_file.length > 255 ||
      duong_dan_file.length > 1024 || (trang_thai !== "nhap" && trang_thai !== "da_dang")) return null;
  if (duong_dan_file) {
    if (!ten_file || /[\s\\]/.test(duong_dan_file)) return null;
    if (duong_dan_file.startsWith("/")) {
      if (duong_dan_file.startsWith("//")) return null;
    } else {
      try { if (new URL(duong_dan_file).protocol !== "https:") return null; }
      catch { return null; }
    }
  }
  return { tieu_de, noi_dung, ten_file, duong_dan_file, trang_thai };
}

export function noticeValues(notice: NoticeInput) {
  return [notice.tieu_de, notice.noi_dung, notice.ten_file, notice.duong_dan_file, notice.trang_thai];
}

export function parseNoticeId(raw: string) {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

export async function requireNoticeManager(request: Request) {
  const denied = await requireStudentManager(request); if (denied) return denied;
  const origin = request.headers.get('origin');
  return origin && origin !== new URL(request.url).origin ? noticeError('Origin không hợp lệ.', 403) : null;
}
