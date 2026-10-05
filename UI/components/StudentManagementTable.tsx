"use client";

import { useState, useEffect } from "react";
import { DB } from "../lib/db";

interface StudentItem {
  id: string;
  name: string;
  gender: string;
  email: string;
  class: string;
  major: string;
  thesisTitle: string;
  advisor1: string;
  advisor2: string;
  decisionDate: string;
  status: string;
  defenseDate: string;
  graduationDate: string;
}

export default function StudentManagementTable() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [searchTerm, setSearchTerm] = useState("");
  
  // 🟢 1. Thêm State lưu trạng thái cần lọc
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      let rawData: any[] = [];

      // 1. Kiểm tra và đọc dữ liệu từ LocalStorage trước
      try {
        const localRecords = DB.get("students");
        if (Array.isArray(localRecords) && localRecords.length > 0) {
          rawData = localRecords;
        }
      } catch (e) {
        console.error("Lỗi đọc LocalStorage:", e);
      }

      // 2. Nếu LocalStorage chưa có, gọi API từ server
      if (rawData.length === 0) {
        try {
          const res = await fetch("/api/students?limit=2000");
          if (res.ok) {
            const result = await res.json();
            rawData = Array.isArray(result)
              ? result
              : result.data || result.records || [];
          }
        } catch (err) {
          console.error("Lỗi API:", err);
        }
      }

      // 3. Map và chuyển đổi dữ liệu hiển thị
      const mapped = rawData.map((hv: any) => ({
        id: hv.maHocVien || hv.ma_hoc_vien || hv.mahv || hv.id || "-",
        name: hv.hoTen || hv.ho_ten || hv.name || "Chưa có tên",
        gender: hv.gioiTinh || hv.gioi_tinh || hv.gender || "-",
        email: hv.email || hv.Email || "-",
        class: hv.lop || hv.LOP || hv.class || "-",
        major: hv.tenNganh || hv.ten_nganh || hv.major || "-",
        thesisTitle: hv.tenLuanVan || hv.ten_luan_van || hv.tenDeAn || "-",
        advisor1: hv.gvHuongDan1 || hv.nguoi_huong_dan_1 || hv.gvHuongDan || "-",
        advisor2: hv.gvHuongDan2 || hv.nguoi_huong_dan_2 || "-",
        decisionDate: hv.ngayQD || hv.ngay_qd || "-",
        status: hv.trangThai || hv.trang_thai || "Đang học",
        defenseDate: hv.ngayBaoVe || hv.ngay_bao_ve || "-",
        graduationDate: hv.ngayTotNghiep || hv.ngay_tot_nghiep || "-",
      }));

      setStudents(mapped);
      setLoading(false);
    };

    fetchStudents();
  }, []);

  // 🟢 2. Kết hợp lọc Tìm kiếm từ khóa + Bộ lọc Trạng thái
  const filteredData = students.filter((item) => {
    // Lọc từ khóa
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      item.name.toLowerCase().includes(term) ||
      item.id.toLowerCase().includes(term) ||
      item.class.toLowerCase().includes(term);

    // Lọc trạng thái
    const s = (item.status || "").toLowerCase();
    let matchesStatus = true;

    if (statusFilter === "DANG_HOC") {
      matchesStatus = s.includes("đang học");
    } else if (statusFilter === "TOT_NGHIEP") {
      matchesStatus = s.includes("tốt nghiệp") || s.includes("hoàn thành");
    } else if (statusFilter === "QUA_HAN") {
      matchesStatus = s.includes("quá hạn");
    }

    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = filteredData.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const emptyRowsCount = pageSize - paginatedData.length;

  if (loading) return <div style={{ padding: "20px", color: "#64748b" }}>Đang tải danh sách học viên...</div>;

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "16px", backgroundColor: "#f8fafc" }}>
      {/* Header & Thanh Tìm Kiếm + Bộ Lọc */}
      <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "20px", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
            👥 Quản lý Danh sách Học viên ({filteredData.length})
          </h3>
          
          {/* 🟢 3. Cụm thanh tìm kiếm và Menu Dropdown Lọc */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                outline: "none",
                cursor: "pointer",
                backgroundColor: "#fff",
                color: "#334155",
                fontWeight: 600,
              }}
            >
              <option value="ALL">📌 Tất cả trạng thái</option>
              <option value="DANG_HOC">🟡 Đang học</option>
              <option value="TOT_NGHIEP">🟢 Đã tốt nghiệp</option>
              <option value="QUA_HAN">🔴 Quá hạn</option>
            </select>

            <input
              type="text"
              placeholder="🔍 Tìm theo Tên, Mã HV, Lớp..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                width: "240px",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Bảng Dữ Liệu Tinh Gọn */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: "14px", textAlign: "left", minWidth: "1000px" }}>
            <colgroup>
              <col style={{ width: "20%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "30%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "14%" }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #cbd5e1", color: "#475569", height: "44px" }}>
                <th style={{ padding: "8px 12px" }}>Học viên</th>
                <th style={{ padding: "8px 12px" }}>Lớp & Ngành</th>
                <th style={{ padding: "8px 12px" }}>Đề tài & GVHD</th>
                <th style={{ padding: "8px 12px", textAlign: "center" }}>Trạng thái & Tiến độ</th>
                <th style={{ padding: "8px 12px", textAlign: "center" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr style={{ height: "400px" }}>
                  <td colSpan={5} style={{ textAlign: "center", color: "#94a3b8" }}>Không tìm thấy học viên phù hợp.</td>
                </tr>
              ) : (
                <>
                  {paginatedData.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9", height: "64px" }}>
                      {/* Cột 1: Họ tên + Mã HV + Giới tính */}
                      <td style={{ padding: "8px 12px", verticalAlign: "middle" }}>
                        <div style={{ fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.name}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                          {item.id} • <span style={{ color: "#475569" }}>{item.gender}</span>
                        </div>
                      </td>

                      {/* Cột 2: Lớp + Ngành */}
                      <td style={{ padding: "8px 12px", verticalAlign: "middle" }}>
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.major}>
                          {item.major}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>Lớp: {item.class}</div>
                      </td>

                      {/* Cột 3: Đề tài & GVHD */}
                      <td style={{ padding: "8px 12px", verticalAlign: "middle" }}>
                        <div style={{ color: item.thesisTitle !== "-" ? "#0f172a" : "#94a3b8", fontWeight: item.thesisTitle !== "-" ? 500 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.thesisTitle}>
                          {item.thesisTitle !== "-" ? item.thesisTitle : "Chưa đăng ký đề tài"}
                        </div>
                        {(item.advisor1 !== "-" || item.advisor2 !== "-") && (
                          <div style={{ fontSize: "12px", color: "#2563eb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            GVHD: {[item.advisor1, item.advisor2].filter((g) => g !== "-").join(", ")}
                          </div>
                        )}
                      </td>

                      {/* Cột 4: Trạng thái & Tiến độ */}
                      <td style={{ padding: "8px 12px", textAlign: "center", verticalAlign: "middle" }}>
                        <div style={{ marginBottom: "2px" }}>
                          <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: "10px", fontSize: "12px", fontWeight: 600, ...getStatusBadgeStyle(item.status) }}>
                            {item.status}
                          </span>
                        </div>
                        {item.graduationDate !== "-" ? (
                          <div style={{ fontSize: "11px", color: "#059669" }}>TN: {item.graduationDate}</div>
                        ) : item.defenseDate !== "-" ? (
                          <div style={{ fontSize: "11px", color: "#0284c7" }}>BV: {item.defenseDate}</div>
                        ) : null}
                      </td>

                      {/* Cột 5: Xem Chi Tiết */}
                      <td style={{ padding: "8px 12px", textAlign: "center", verticalAlign: "middle" }}>
                        <button
                          onClick={() => setSelectedStudent(item)}
                          style={{
                            padding: "6px 12px",
                            backgroundColor: "#f1f5f9",
                            color: "#0f172a",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          👁️ Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Bù hàng trống */}
                  {emptyRowsCount > 0 &&
                    Array.from({ length: emptyRowsCount }).map((_, idx) => (
                      <tr key={`empty-${idx}`} style={{ height: "64px", borderBottom: "1px solid transparent" }}>
                        <td colSpan={5}>&nbsp;</td>
                      </tr>
                    ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Thanh Phân Trang */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "1px solid #e2e8f0",
            flexWrap: "wrap",
            gap: "12px",
            fontSize: "14px",
            color: "#475569",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>Hiển thị:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#fff",
                fontSize: "14px",
                color: "#1e293b",
                outline: "none",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              <option value={10}>10 dòng / trang</option>
              <option value={20}>20 dòng / trang</option>
              <option value={50}>50 dòng / trang</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontWeight: 500, color: "#64748b" }}>
              Trang <strong style={{ color: "#0f172a" }}>{safeCurrentPage}</strong> / {totalPages}
            </span>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: safeCurrentPage === 1 ? "#f1f5f9" : "#fff",
                  color: safeCurrentPage === 1 ? "#94a3b8" : "#1e293b",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: safeCurrentPage === 1 ? "not-allowed" : "pointer",
                }}
              >
                ← Trước
              </button>

              <button
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: safeCurrentPage === totalPages ? "#f1f5f9" : "#fff",
                  color: safeCurrentPage === totalPages ? "#94a3b8" : "#1e293b",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: safeCurrentPage === totalPages ? "not-allowed" : "pointer",
                }}
              >
                Sau →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Xem Chi Tiết */}
      {selectedStudent && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15, 23, 42, 0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "#fff", padding: "24px", borderRadius: "12px", width: "550px", maxWidth: "90%", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
              <h3 style={{ margin: 0, color: "#0f172a" }}>🎓 Thông tin học viên chi tiết</h3>
              <button onClick={() => setSelectedStudent(null)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "14px", color: "#334155" }}>
              <div><strong>Mã HV:</strong> {selectedStudent.id}</div>
              <div><strong>Họ và tên:</strong> {selectedStudent.name}</div>
              <div><strong>Giới tính:</strong> {selectedStudent.gender}</div>
              <div><strong>Lớp:</strong> {selectedStudent.class}</div>
              <div style={{ gridColumn: "span 2" }}><strong>Ngành:</strong> {selectedStudent.major}</div>
              <div style={{ gridColumn: "span 2" }}><strong>Email:</strong> {selectedStudent.email}</div>
              <div style={{ gridColumn: "span 2", backgroundColor: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <strong style={{ color: "#2563eb" }}>Tên luận văn / Đề tài:</strong>
                <div style={{ marginTop: "4px" }}>{selectedStudent.thesisTitle}</div>
              </div>
              <div><strong>GVHD 1:</strong> {selectedStudent.advisor1}</div>
              <div><strong>GVHD 2:</strong> {selectedStudent.advisor2}</div>
              <div><strong>Ngày QĐ giao đề tài:</strong> {selectedStudent.decisionDate}</div>
              <div><strong>Trạng thái:</strong> {selectedStudent.status}</div>
              <div><strong>Ngày bảo vệ:</strong> {selectedStudent.defenseDate}</div>
              <div><strong>Ngày tốt nghiệp:</strong> {selectedStudent.graduationDate}</div>
            </div>

            <div style={{ textAlign: "right", marginTop: "20px" }}>
              <button onClick={() => setSelectedStudent(null)} style={{ padding: "8px 16px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 🟢 4. Cập nhật màu sắc nhãn: "Quá hạn" có nền đỏ chữ đỏ
function getStatusBadgeStyle(status: string) {
  const s = (status || "").toLowerCase();
  
  if (s.includes("quá hạn")) {
    return { backgroundColor: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5" }; // 🔴 ĐỎ
  }
  if (s.includes("tốt nghiệp") || s.includes("hoàn thành")) {
    return { backgroundColor: "#d1fae5", color: "#065f46", border: "1px solid #a7f3d0" }; // 🟢 XANH LÁ
  }
  if (s.includes("bảo vệ")) {
    return { backgroundColor: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd" }; // 🔵 XANH DƯƠNG
  }
  if (s.includes("đang học")) {
    return { backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }; // 🟡 VÀNG
  }
  if (s.includes("thôi học") || s.includes("bỏ học")) {
    return { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" }; // 🔴 ĐỎ
  }
  
  return { backgroundColor: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" };
}