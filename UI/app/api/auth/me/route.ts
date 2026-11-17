import { NextRequest, NextResponse } from "next/server";
import { AGU_SESSION_COOKIE, readAguSession } from "../../../../lib/agu-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = readAguSession(request.cookies.get(AGU_SESSION_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ message: "Chưa đăng nhập hoặc phiên đã hết hạn." }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return NextResponse.json({ success: true, user }, {
    headers: { "Cache-Control": "no-store" },
  });
}
