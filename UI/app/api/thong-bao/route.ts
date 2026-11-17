
import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getDb } from "../../../lib/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ThongBaoRow extends RowDataPacket {
    ma_thong_bao: number | string;
    tieu_de: string;
    ten_file: string;
    duong_dan_file: string;
    ngay_dang: string;
    trang_thai: number;
}

export async function GET(request: NextRequest) {
    try {
        const db = getDb();

        const limitParam =
            request.nextUrl.searchParams.get("limit");

        let limit: number | null = null;

        if (limitParam !== null) {
            const value = Number(limitParam);

            if (
                !Number.isSafeInteger(value) ||
                value < 1 ||
                value > 10000
            ) {
                return NextResponse.json(
                    {
                        message:
                            "Tham số limit phải từ 1 đến 10000.",
                    },
                    { status: 400 }
                );
            }

            limit = value;
        }

        const sql = `
      SELECT
        ma_thong_bao,
        tieu_de,
        ten_file,
        duong_dan_file,
        DATE_FORMAT(
          ngay_dang, '%Y-%m-%dT%H:%i:%s'
        ) AS ngay_dang,
        trang_thai
      FROM thong_bao
      WHERE trang_thai = 1
      ORDER BY
        ngay_dang DESC,
        ma_thong_bao DESC
      ${limit === null ? "" : "LIMIT ?"}
    `;

        const params = limit === null ? [] : [limit];

        const [rows] = await db.execute<ThongBaoRow[]>(
            sql,
            params
        );

        const data = rows.map((row) => ({
            ma_thong_bao: Number(row.ma_thong_bao),
            tieu_de: row.tieu_de,
            ten_file: row.ten_file,
            duong_dan_file: row.duong_dan_file,
            ngay_dang: row.ngay_dang,
            trang_thai: Number(row.trang_thai),
        }));

        return NextResponse.json(
            {
                success: true,
                total: data.length,
                data,
            },
            {
                status: 200,
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );
    } catch (error) {
        console.error("[API THONG BAO]", error);

        return NextResponse.json(
            {
                success: false,
                message:
                    "Không thể lấy thông báo từ cơ sở dữ liệu.",
            },
            { status: 500 }
        );
    }
}
