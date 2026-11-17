import { NextResponse } from "next/server";

export async function POST() {
    try {
        const response = NextResponse.json(
            {
                success: true,
                message: "Đăng xuất thành công",
            },
            { status: 200 }
        );

        // Chỉ là ví dụ nếu phiên đăng nhập
        // thực tế sử dụng cookie tên "session".
        response.cookies.set("session", "", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 0,
        });

        return response;
    } catch (error) {
        console.error("Lỗi đăng xuất:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Không thể đăng xuất",
            },
            { status: 500 }
        );
    }
}
