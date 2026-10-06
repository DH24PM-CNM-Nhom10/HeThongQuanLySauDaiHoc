import { NextRequest, NextResponse } from "next/server";
import { memoryStore } from "../../../lib/store";

export async function GET(req: NextRequest) {
  try {
    const students = memoryStore["students"] || [];
    const thesisList = memoryStore["thesis"] || [];

    const warnings = {
      missingThesis: [] as any[],      // Thiếu đề tài luận văn
      missingStudentId: [] as any[],   // Thiếu mã học viên
      nearDeadline: [] as any[],       // Trạng thái đào tạo có cảnh báo
    };

    students.forEach((student, index) => {
      const studentName = student.hoTen || `Học viên dòng ${index + 1}`;
      const cccd = student.cccd || "—";
      const lop = student.lop || "—";

      // 1. Kiểm tra thiếu Mã học viên
      if (!student.maHocVien) {
        warnings.missingStudentId.push({
          hoTen: studentName,
          cccd,
          lop,
          detail: "Chưa cập nhật Mã học viên chính thức",
        });
      }

      // 2. Kiểm tra tiến độ Luận văn
      const hasThesis = thesisList.some((t) => t.maHocVien === student.maHocVien);
      if (!student.tenLuanVan && !hasThesis) {
        warnings.missingThesis.push({
          maHocVien: student.maHocVien || "—",
          hoTen: studentName,
          lop,
          detail: "Chưa có tên luận văn / người hướng dẫn",
        });
      }

      // 3. Kiểm tra trạng thái quá hạn
      const status = String(student.trangThaiHoc || "").toLowerCase();
      if (status.includes("quá hạn") || status.includes("cảnh báo") || status.includes("tạm dừng")) {
        warnings.nearDeadline.push({
          maHocVien: student.maHocVien || "—",
          hoTen: studentName,
          lop,
          trangThai: student.trangThaiHoc,
          detail: "Thuộc diện cần theo dõi đặc biệt về tiến độ",
        });
      }
    });

    const totalWarnings =
      warnings.missingThesis.length +
      warnings.missingStudentId.length +
      warnings.nearDeadline.length;

    return NextResponse.json({
      success: true,
      summary: {
        totalWarnings,
        missingThesisCount: warnings.missingThesis.length,
        missingStudentIdCount: warnings.missingStudentId.length,
        nearDeadlineCount: warnings.nearDeadline.length,
      },
      data: warnings,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống khi quét cảnh báo", details: error.message },
      { status: 500 }
    );
  }
}