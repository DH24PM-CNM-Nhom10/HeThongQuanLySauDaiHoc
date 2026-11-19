import { NextResponse } from "next/server";
import { AGU_SESSION_COOKIE, readAguSession } from "./agu-auth";

export function requireAdmin(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map(part => part.trim())
    .find(part => part.startsWith(AGU_SESSION_COOKIE + "="))?.slice(AGU_SESSION_COOKIE.length + 1);
  return readAguSession(cookie)?.role === "admin" ? null
    : NextResponse.json({ success: false, error: "Cần đăng nhập quản trị viên.", message: "Cần đăng nhập quản trị viên." }, { status: 403 });
}
