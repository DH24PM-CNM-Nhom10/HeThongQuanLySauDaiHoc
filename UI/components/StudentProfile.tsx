// UI/components/StudentProfile.tsx
"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { DB } from "../lib/db";

interface StudentProfileProps {
  studentId?: string;
}

// Helper bóc tách ngày từ Excel Serial Number, DD/MM/YYYY, hoặc ISO String
function parseExcelOrVNDate(dateInput: any): Date | null {
  if (!dateInput || dateInput === "-" || dateInput === "null" || dateInput === "undefined") return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;

  const num = Number(dateInput);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    return new Date((num - (25567 + 2)) * 86400 * 1000);
  }

  const str = String(dateInput).trim();

  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1900) {
        return new Date(year, month, day);
      }
    }
  }

  if (str.includes("-")) {
    const parts = str.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else {
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) || parsed.getFullYear() < 1900 ? null : parsed;
}

// Helper định dạng hiển thị ngày DD/MM/YYYY
function formatExcelDate(value: any): string {
  if (!value || value === "-" || value === "null" || value === "undefined") return "—";
  const dateObj = parseExcelOrVNDate(value);
  if (!dateObj) return String(value);
  return dateObj.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Tính toán ngày hết hạn và số ngày còn lại / quá hạn
function calculateProgress(student: any) {
  if (!student) {
    return {
      startDateFormatted: "—",
      endDateFormatted: "—",
      remainingDays: 0,
      overdueDays: 0,
      percentUsed: 0,
      isOverdue: false,
      isGraduated: false,
    };
  }

  const trangThai = String(
    student.trangThai || student.trang_thai || student.TRANG_THAI || ""
  ).toLowerCase().trim();

  const isGraduated = trangThai.includes("tốt nghiệp");
  const isOverdue = trangThai.includes("quá hạn");

  const ngayGiaHanVal = student.ngayGiaHan || student.ngay_gia_han || student.NGAY_GIA_HAN;
  const ngayHetHanVal = ngayGiaHanVal || student.ngayHetHan || student.ngay_het_han_dt || student.NGAY_HET_HAN_DT || student.thoiHanDaoTao;
  const ngayNhapHocVal = student.ngayNhapHoc || student.ngay_nhap_hoc || student.NGAY_NHAP_HOC;

  let startDate = parseExcelOrVNDate(ngayNhapHocVal);
  let endDate = parseExcelOrVNDate(ngayHetHanVal);

  const maHV = String(student.maHocVien || student.ma_hoc_vien || student.masv || student.mahv || "").toUpperCase();
  const trinhDo = String(student.trinhDo || student.trinh_do || student.TRINH_DO_DT || "").toLowerCase();
  const isNCS = maHV.startsWith("NCS") || trinhDo.includes("tiến sĩ");
  const defaultMonths = isNCS ? 48 : 24;

  if (!startDate && !endDate) startDate = new Date("2025-11-06");
  if (!endDate && startDate) {
    endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + defaultMonths);
  } else if (!startDate && endDate) {
    startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - defaultMonths);
  }

  const today = new Date();
  
  if (!startDate || !endDate) {
    return {
      startDateFormatted: "—",
      endDateFormatted: "—",
      remainingDays: 0,
      overdueDays: 0,
      percentUsed: 0,
      isOverdue: false,
      isGraduated,
    };
  }

  const diffFromEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
  const remainingDays = diffFromEnd < 0 ? 0 : diffFromEnd;
  const overdueDays = diffFromEnd < 0 ? Math.abs(diffFromEnd) : 0;

  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));
  const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
  const percentUsed = isGraduated ? 100 : isOverdue ? 100 : Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));

  const formatDate = (d: Date) => d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

  return {
    startDateFormatted: formatDate(startDate),
    endDateFormatted: formatDate(endDate),
    remainingDays,
    overdueDays,
    percentUsed,
    isOverdue,
    isGraduated,
  };
}

export default function StudentProfile({ studentId: propStudentId }: StudentProfileProps) {
  const searchParams = useSearchParams();
  const urlStudentId = searchParams.get("id");

  const [role, setRole] = useState<"admin" | "student">("student");
  const [searchQuery, setSearchQuery] = useState("");
  const [student, setStudent] = useState<any | null>(null);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfileData = () => {
      setLoading(true);
      try {
        const savedUserStr = localStorage.getItem("currentUser");
        const currentUser = savedUserStr ? JSON.parse(savedUserStr) : null;
        
        const userRole = currentUser?.role === "admin" ? "admin" : "student";
        setRole(userRole);

        const data = DB.get("students") || [];
        setAllStudents(data);

        if (data.length > 0) {
          if (userRole === "admin") {
            const targetId = urlStudentId || propStudentId || data[0]?.maHocVien;
            setSearchQuery(targetId || "");
            const found = findStudent(data, targetId || "");
            setStudent(found || data[0]);
          } else {
            // Học viên: Chỉ hiển thị đúng học viên khớp mã, nếu không tìm thấy thì gán null
            const targetId = currentUser?.maHocVien || "";
            setSearchQuery(targetId);
            const found = findStudent(data, targetId);
            setStudent(found || null); 
          }
        }
      } catch (err) {
        console.error("Lỗi khi tải hồ sơ:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [propStudentId, urlStudentId]);

  const findStudent = (list: any[], query: string) => {
    if (!query || !query.trim()) return null;
    const q = query.trim().toLowerCase();
    return list.find((s) => {
      const maHV = String(s.maHocVien || s.ma_hoc_vien || s.masv || s.mahv || "").toLowerCase();
      const cccd = String(s.cccd || s.cmnd || "").toLowerCase();
      const hoTen = String(s.hoTen || s.ho_ten || s.hoten || "").toLowerCase();
      return maHV === q || cccd === q || hoTen.includes(q);
    });
  };

  const handleSearch = () => {
    if (!searchQuery.trim() || role !== "admin") return;
    const match = findStudent(allStudents, searchQuery);
    setStudent(match || null);
  };

  const getVal = (fieldKeys: string[]) => {
    if (!student) return "—";
    for (const key of fieldKeys) {
      if (student[key] !== undefined && student[key] !== null && student[key] !== "") {
        return student[key];
      }
    }
    return "—";
  };

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Đang tải hồ sơ...</div>;
  }

  const progress = calculateProgress(student);
  const fontSans = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto", fontFamily: fontSans, color: "#1e293b" }}>
      
      {/* 🔍 THANH TÌM KIẾM (CHỈ HIỂN THỊ DÀNH CHO ADMIN, HỌC VIÊN SẼ BỊ ẨN) */}
      {role === "admin" && (
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "20px",
            backgroundColor: "#fff",
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1px solid #e2e8f0",
          }}
        >
          <input
            type="text"
            placeholder="🔍 Admin tra cứu học viên theo Mã HV, CCCD hoặc Họ tên..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            style={{
              flex: 1,
              padding: "10px 14px",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              fontSize: "14px",
              outline: "none",
              fontFamily: fontSans,
            }}
          />
          <button
            onClick={handleSearch}
            style={{
              padding: "10px 22px",
              backgroundColor: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: fontSans,
            }}
          >
            Tra cứu
          </button>
        </div>
      )}

      {!student ? (
        <div style={{ padding: "40px", textAlign: "center", backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #e2e8f0", color: "#64748b" }}>
          Không tìm thấy dữ liệu học viên.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* 1. HEADER THÔNG TIN HỌC VIÊN */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              paddingBottom: "12px",
              borderBottom: "1px dashed #cbd5e1",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "26px",
                  fontWeight: 700,
                  fontFamily: fontSans,
                  color: "#0f172a",
                  letterSpacing: "-0.3px",
                }}
              >
                {getVal(["hoTen", "ho_ten", "hoten"])}
              </h1>
              <div style={{ marginTop: "6px", fontSize: "14px", color: "#64748b" }}>
                Mã học viên <strong style={{ color: "#1e293b" }}>{getVal(["maHocVien", "ma_hoc_vien", "masv"])}</strong>
                <span style={{ margin: "0 8px" }}>·</span>
                {getVal(["trinhDo", "trinh_do"])} {getVal(["tenNganh", "ten_nganh"])}
              </div>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 14px",
                borderRadius: "16px",
                backgroundColor: progress.isOverdue ? "#fee2e2" : "#e6f4ea",
                color: progress.isOverdue ? "#991b1b" : "#137333",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: progress.isOverdue ? "#dc2626" : "#137333",
                }}
              ></span>
              {getVal(["trangThai", "trang_thai"])}
            </div>
          </div>

          {/* 2. KHUNG TIẾN ĐỘ / THÔNG BÁO TỐT NGHIỆP */}
          <div
            style={{
              backgroundColor: progress.isGraduated
                ? "#f0fdf4"
                : progress.isOverdue
                ? "#fff5f5"
                : "#fff",
              borderRadius: "10px",
              border: progress.isGraduated
                ? "1px solid #bbf7d0"
                : progress.isOverdue
                ? "2px solid #fca5a5"
                : "1px solid #e2e8f0",
              borderTop: progress.isGraduated
                ? "4px solid #16a34a"
                : progress.isOverdue
                ? "4px solid #dc2626"
                : "3px solid #b45309",
              padding: "20px",
              boxShadow: progress.isOverdue
                ? "0 4px 12px rgba(220, 38, 38, 0.12)"
                : "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            {/* Header Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: progress.isGraduated || progress.isOverdue ? "4px 10px" : "0",
                borderRadius: "6px",
                backgroundColor: progress.isGraduated
                  ? "#dcfce7"
                  : progress.isOverdue
                  ? "#fee2e2"
                  : "transparent",
                color: progress.isGraduated
                  ? "#15803d"
                  : progress.isOverdue
                  ? "#991b1b"
                  : "#b45309",
                fontWeight: 700,
                fontSize: "13px",
                letterSpacing: "0.5px",
              }}
            >
              <span>{progress.isGraduated ? "🎓" : progress.isOverdue ? "🚨" : "⚠️"}</span>
              <span>
                {progress.isGraduated
                  ? "ĐÃ HOÀN THÀNH CHƯƠNG TRÌNH ĐÀO TẠO"
                  : progress.isOverdue
                  ? "CẢNH BÁO QUÁ HẠN ĐÀO TẠO"
                  : "CẢNH BÁO TIẾN ĐỘ ĐÀO TẠO"}
              </span>
            </div>

            {/* Nội dung hiển thị theo trạng thái */}
            {progress.isGraduated ? (
              <div
                style={{
                  marginTop: "12px",
                  padding: "14px 18px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  color: "#166534",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                🎉 <strong>Học viên đã hoàn thành xuất sắc chương trình và được công nhận tốt nghiệp.</strong>
              </div>
            ) : (
              <>
                {/* Số ngày & Mốc thời gian */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "12px", marginBottom: "16px", flexWrap: "wrap", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                    <span style={{ fontSize: "44px", fontWeight: 800, fontFamily: fontSans, color: progress.isOverdue ? "#dc2626" : "#0f172a", lineHeight: 1 }}>
                      {progress.isOverdue ? progress.overdueDays : progress.remainingDays}
                    </span>
                    <span style={{ fontSize: "16px", color: progress.isOverdue ? "#991b1b" : "#334155", fontWeight: 600 }}>
                      ngày
                    </span>
                    <span style={{ fontSize: "13px", color: progress.isOverdue ? "#b91c1c" : "#64748b", fontWeight: progress.isOverdue ? 600 : 400, marginLeft: "6px" }}>
                      {progress.isOverdue ? "đã quá hạn đào tạo gốc" : "còn lại đến hạn tốt nghiệp"}
                    </span>
                    {progress.isOverdue && (
                      <span
                        style={{
                          marginLeft: "8px",
                          backgroundColor: "#dc2626",
                          color: "#fff",
                          padding: "3px 10px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        Đã hết hạn
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "24px", fontSize: "12px", color: "#64748b" }}>
                    <div>
                      <div style={{ color: "#94a3b8" }}>Ngày nhập học</div>
                      <div style={{ fontWeight: 600, color: "#334155", marginTop: "2px" }}>{progress.startDateFormatted}</div>
                    </div>
                    <div>
                      <div style={{ color: "#94a3b8" }}>Hạn đào tạo gốc</div>
                      <div style={{ fontWeight: 600, color: progress.isOverdue ? "#dc2626" : "#334155", marginTop: "2px" }}>{progress.endDateFormatted}</div>
                    </div>
                  </div>
                </div>

                {/* Thanh Progress Bar */}
                <div>
                  <div style={{ height: "8px", width: "100%", backgroundColor: progress.isOverdue ? "#fca5a5" : "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${progress.percentUsed}%`,
                        backgroundColor: progress.isOverdue ? "#dc2626" : "#d97706",
                        borderRadius: "4px",
                        transition: "width 0.5s ease",
                      }}
                    ></div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: progress.isOverdue ? "#991b1b" : "#94a3b8", marginTop: "6px", fontWeight: progress.isOverdue ? 600 : 400 }}>
                    <span>{progress.isOverdue ? "100% thời gian đào tạo (Đã quá hạn)" : `${progress.percentUsed}% thời gian đã sử dụng`}</span>
                    <span>Hạn quy định: {String(getVal(["trinhDo", "trinh_do"])).toLowerCase().includes("tiến sĩ") ? "48 tháng" : "24 tháng"}</span>
                  </div>
                </div>

                {/* Thông báo nhắc nhở */}
                <div
                  style={{
                    marginTop: "16px",
                    backgroundColor: progress.isOverdue ? "#fee2e2" : "#fffbe6",
                    border: progress.isOverdue ? "1px solid #fca5a5" : "1px solid #ffe58f",
                    padding: "10px 14px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    color: progress.isOverdue ? "#991b1b" : "#d48806",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>{progress.isOverdue ? "🚨" : "⚠️"}</span>
                  <span>
                    {progress.isOverdue ? (
                      <>
                        <strong>Học viên đã vượt quá thời hạn đào tạo cho phép.</strong> Vui lòng liên hệ ngay Phòng Sau đại học để làm thủ tục gia hạn hoặc xử lý hồ sơ.
                      </>
                    ) : (
                      <>
                        <strong>Vui lòng hoàn thành chương trình đúng thời hạn.</strong> Liên hệ phòng Sau đại học nếu cần gia hạn hoặc bảo lưu.
                      </>
                    )}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* 3. CHI TIẾT 2 CỘT */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            
            {/* Cột Trái */}
            <div style={{ backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "20px" }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 700, fontFamily: fontSans, color: "#0f172a", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                Thông tin học viên
              </h3>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <DetailRow label="Họ và tên" value={getVal(["hoTen", "ho_ten", "hoten"])} bold />
                <DetailRow label="Mã học viên" value={getVal(["maHocVien", "ma_hoc_vien", "masv"])} />
                <DetailRow label="CCCD" value={getVal(["cccd", "cmnd"])} isMasked />
                <DetailRow label="Ngày sinh" value={formatExcelDate(getVal(["ngaySinh", "ngaysinh"]))} />
                <DetailRow label="Giới tính" value={getVal(["gioiTinh", "gioitinh"])} />
                <DetailRow label="Email" value={getVal(["email"])} />
              </div>
            </div>

            {/* Cột Phải */}
            <div style={{ backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "20px" }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 700, fontFamily: fontSans, color: "#0f172a", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                Thông tin đào tạo
              </h3>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <DetailRow label="Ngành" value={getVal(["tenNganh", "ten_nganh"])} />
                <DetailRow label="Mã ngành" value={getVal(["maNganh", "ma_nganh"])} />
                <DetailRow label="Trình độ" value={getVal(["trinhDo", "trinh_do"])} />
                <DetailRow label="Chương trình" value={getVal(["loaiChuongTrinh", "loai_chuong_trinh"])} />
                <DetailRow label="Lớp" value={getVal(["lop", "ma_lop"])} />
                <DetailRow label="Ngày nhập học" value={formatExcelDate(getVal(["ngayNhapHoc", "ngay_nhap_hoc"]))} />
                <DetailRow label="Trạng thái" value={getVal(["trangThai", "trang_thai"])} />
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, bold, isMasked }: { label: string; value: string; bold?: boolean; isMasked?: boolean }) {
  let displayValue = value;
  if (isMasked && value && value !== "—") {
    displayValue = value.length > 4 ? "••••••••" + value.slice(-4) : "••••••••••••";
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px dashed #e2e8f0",
        fontSize: "13px",
      }}
    >
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: "#1e293b", fontWeight: bold ? 600 : 500, textAlign: "right" }}>
        {displayValue}
      </span>
    </div>
  );
}