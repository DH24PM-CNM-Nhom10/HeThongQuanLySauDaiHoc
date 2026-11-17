import { NextResponse } from "next/server";
import { AGU_SESSION_COOKIE } from "../../../../lib/agu-auth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Đã đăng xuất." });
  response.cookies.set(AGU_SESSION_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return response;
}
