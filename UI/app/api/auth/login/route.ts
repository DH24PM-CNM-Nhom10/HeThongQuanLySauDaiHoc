import { NextRequest, NextResponse } from "next/server";
import { getStore } from "../../../../lib/store";
import {
  AGU_SESSION_COOKIE,
  AGU_SESSION_MAX_AGE,
  createAguSession,
  safeEqual,
  type AguUser,
} from "../../../../lib/agu-auth";

export const runtime = "nodejs";

// TÀI KHOẢN THỬ NGHIỆM CHO MÔI TRƯỜNG PHÁT TRIỂN.
// Đăng nhập thật cần bảng tài khoản (mật khẩu hash) hoặc SSO của trường.
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { message: "Chưa cấu hình hệ thống xác thực chính thức." },
      { status: 503 },
    );
  }

  const form: unknown = await request.json().catch(() => null);
  if (!form || typeof form !== "object") {
    return NextResponse.json({ message: "Dữ liệu đăng nhập không hợp lệ." }, { status: 400 });
  }
  const input = form as Record<string, unknown>;
  const username = typeof input.username === "string" ? input.username.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (!username || !password || username.length > 150 || password.length > 200) {
    return NextResponse.json({ message: "Vui lòng nhập tài khoản và mật khẩu hợp lệ." }, { status: 400 });
  }

  const adminName = process.env.AGU_DEMO_ADMIN_USERNAME ?? "";
  const adminPass = process.env.AGU_DEMO_ADMIN_PASSWORD ?? "";
  const studentName = process.env.AGU_DEMO_STUDENT_USERNAME ?? "";
  const studentPass = process.env.AGU_DEMO_STUDENT_PASSWORD ?? "";
  if (!process.env.AGU_SESSION_SECRET || process.env.AGU_SESSION_SECRET.length < 32 || process.env.AGU_SESSION_SECRET.startsWith("THAY_BANG_")) {
    return NextResponse.json({ message: "Chưa cấu hình AGU_SESSION_SECRET trên máy chủ." }, { status: 503 });
  }
  if ((!adminName && !studentName) || adminPass.startsWith("DAT_MAT_KHAU_") || studentPass.startsWith("DAT_MAT_KHAU_")) {
    return NextResponse.json({ message: "Chưa cấu hình tài khoản thử nghiệm trong .env.local." }, { status: 503 });
  }

  let user: AguUser | null = null;
  if (adminName && adminPass && username.toLowerCase() === adminName.toLowerCase() && safeEqual(password, adminPass)) {
    user = { role: "admin", hoTen: "Quản lý Phòng Đào tạo" };
  } else if (studentName && studentPass && username.toLowerCase() === studentName.toLowerCase() && safeEqual(password, studentPass)) {
    const lookup = (process.env.AGU_DEMO_STUDENT_CODE ?? studentName).trim().toLowerCase();
    const students = getStore().students ?? [];
    const found = students.find((row) =>
      String(row.maHocVien ?? row.ma_hoc_vien ?? "").trim().toLowerCase() === lookup ||
      String(row.email ?? "").trim().toLowerCase() === lookup,
    );
    if (!found) {
      return NextResponse.json(
        { message: "Tài khoản thử nghiệm chưa khớp học viên trong UI/db.json. Kiểm tra AGU_DEMO_STUDENT_CODE." },
        { status: 503 },
      );
    }
    user = {
      role: "student",
      maHocVien: String(found.maHocVien ?? found.ma_hoc_vien ?? ""),
      hoTen: String(found.hoTen ?? found.ho_ten ?? "Học viên"),
      email: typeof found.email === "string" ? found.email : undefined,
    };
  }

  if (!user) {
    return NextResponse.json({ message: "Tên đăng nhập hoặc mật khẩu không đúng." }, { status: 401 });
  }

  const response = NextResponse.json({ success: true, user });
  response.cookies.set(AGU_SESSION_COOKIE, createAguSession(user), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: false, // API demo chi hoat dong o development/test
    maxAge: AGU_SESSION_MAX_AGE,
  });
  return response;
}
