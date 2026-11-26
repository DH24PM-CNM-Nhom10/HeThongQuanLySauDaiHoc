import { NextRequest, NextResponse } from "next/server";
import { requireNoticeManager } from "../../../../lib/notice-api";
import { getStore, saveStoreToFile } from "../../../../lib/store";
import { noticeFileDirectory } from "../../../../lib/notice-files";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const denied = await requireNoticeManager(req);
  if (denied) return denied;
  try {
    const form = await req.formData(),
      file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024)
      throw new Error("Chọn tệp tối đa 10 MB.");
    const ext = path.extname(file.name).toLowerCase(),
      bytes = Buffer.from(await file.arrayBuffer());
    const valid =
      (ext === ".pdf" && bytes.subarray(0, 5).toString() === "%PDF-") ||
      ([".docx", ".xlsx"].includes(ext) &&
        bytes[0] === 0x50 &&
        bytes[1] === 0x4b) ||
      ([".jpg", ".jpeg"].includes(ext) &&
        bytes[0] === 255 &&
        bytes[1] === 216 &&
        bytes[2] === 255) ||
      (ext === ".png" &&
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
    if (!valid)
      throw new Error("Chỉ nhận PDF, DOCX, XLSX, JPG, PNG đúng định dạng.");
    const mime: Record<string, string> = {
      ".pdf": "application/pdf",
      ".docx":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
    };
    const id = crypto.randomUUID(),
      target = path.join(noticeFileDirectory(), id + ext),
      store = getStore(true);
    fs.writeFileSync(target, bytes, { flag: "wx", mode: 0o600 });
    try {
      store.noticeAttachments.push({
        id,
        ext,
        mime: mime[ext],
        name: path.basename(file.name),
        createdAt: new Date().toISOString(),
      });
      saveStoreToFile(store);
    } catch (e) {
      fs.unlinkSync(target);
      throw e;
    }
    return NextResponse.json({
      ten_file: path.basename(file.name),
      duong_dan_file: "/api/thong-bao/files/" + id,
    });
  } catch (e) {
    return NextResponse.json(
      { message: e instanceof Error ? e.message : "Không tải được tệp." },
      { status: 400 },
    );
  }
}
