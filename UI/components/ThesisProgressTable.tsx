"use client";

import { useState, useEffect } from "react";
import { DB } from "../lib/db";

type FilterType = "ALL" | "HAS_THESIS" | "NO_THESIS";

interface ActiveStudentItem {
  id: string;
  name: string;
  class: string;
  major: string;
  thesisTitle: string;
  advisor: string;
  dueDate: string;
  hasThesis: boolean;
  status: FilterType;
}

export default function ThesisProgressSection() {
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const localRecords = DB.get("students");
        if (Array.isArray(localRecords) && localRecords.length > 0) {
          setStudents(localRecords);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error("Lỗi đọc LocalStorage:", e);
      }

      try {
        const res = await fetch("/api/students?limit=2000");
        const result = await res.json();
        if (result.success && Array.isArray(result.data)) {
          setStudents(result.data);
        }
      } catch (err) {
        console.error("Lỗi API:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  const today = new Date("2026-10-01").getTime();

  // ĐIỀU KIỆN LỌC CHÍNH: HỌC VIÊN ĐANG HỌC + CÒN TRONG HẠN CHO PHÉP (<= 2 NĂM QUÁ HẠN)
  const activeStudentList: ActiveStudentItem[] = students
    .map((hv: any) => {
      const maHV = hv.maHocVien || hv.ma_hoc_vien || hv.MA_HOC_VIEN || hv.id || "";
      const hoTen = hv.hoTen || hv.ho_ten || hv.HO_TEN || hv.name || "Chưa có tên";
      const lop = hv.lop || hv.LOP || hv.class || "-";
      const tenNganh = hv.tenNganh || hv.ten_nganh || hv.TEN_NGANH || hv.major || "-";
      const tenLuanVan = hv.tenLuanVan || hv.ten_luan_van || hv.TEN_LUAN_VAN || hv.tenDeAn || "";
      const gvHuongDan = hv.gvHuongDan || hv.nguoi_huong_dan_1 || hv.NGUOI_HUONG_DAN_1 || "";
      const ngayHetHan = hv.ngayHetHan || hv.ngay_het_han_dt || hv.NGAY_HET_HAN_DT;
      const trangThai = hv.trangThai || hv.trang_thai || hv.TRANG_THAI || "";
      const ngayTotNghiep = hv.ngayTotNghiep || hv.ngay_tot_nghiep || hv.NGAY_TOT_NGHIEP;
      const ngayBaoVe = hv.ngayBaoVe || hv.ngay_bao_ve || hv.NGAY_BAO_VE;

      const ttLower = String(trangThai).toLowerCase();

      // 1. LOẠI BỎ HỌC VIÊN ĐÃ TỐT NGHIỆP / BẢO VỆ / BỎ HỌC
      const isFinishedOrDropped =
        ttLower.includes("tốt nghiệp") ||
        ttLower.includes("bảo vệ") ||
        ttLower.includes("hoàn thành") ||
        ttLower.includes("thôi học") ||
        ttLower.includes("bỏ học") ||
        (ngayTotNghiep && ngayTotNghiep !== "-") ||
        (ngayBaoVe && ngayBaoVe !== "-");

      if (isFinishedOrDropped) return null;

      const rawYear = hv.namNhapHoc || hv.nam_nhap_hoc || hv.NAM_NHAP_HOC || hv.year;
      let year = Number(rawYear);
      if (!year || isNaN(year)) {
        const matchYear = JSON.stringify(hv).match(/20[1-2][0-9]/);
        year = matchYear ? Number(matchYear[0]) : 2023;
      }

      let daysOverdue = 0;
      let dueDateStr = ngayHetHan;

      if (ngayHetHan && !isNaN(new Date(ngayHetHan).getTime())) {
        const dueDate = new Date(ngayHetHan).getTime();
        daysOverdue = dueDate < today ? Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)) : 0;
      } else {
        const estimatedDueDate = new Date(`${year + 2}-09-30`).getTime();
        daysOverdue = estimatedDueDate < today ? Math.floor((today - estimatedDueDate) / (1000 * 60 * 60 * 24)) : 0;
        dueDateStr = `30/09/${year + 2}`;
      }

      // 2. LOẠI BỎ QUÁ HẠN > 2 NĂM (Đã đẩy sang Component Cảnh Báo)
      if (daysOverdue > 730) return null;

      const hasThesis = Boolean(
        tenLuanVan &&
        String(tenLuanVan).trim() !== "" &&
        String(tenLuanVan) !== "Chưa đăng ký đề tài" &&
        String(tenLuanVan) !== "Chưa đăng ký" &&
        String(tenLuanVan) !== "-"
      );

      return {
        id: maHV,
        name: hoTen,
        class: lop,
        major: tenNganh,
        thesisTitle: hasThesis ? tenLuanVan : "Chưa đăng ký đề tài",
        advisor: gvHuongDan || "Chưa phân công",
        dueDate: dueDateStr || "Đang học",
        hasThesis,
        status: hasThesis ? "HAS_THESIS" : "NO_THESIS",
      };
    })
    .filter((i): i is ActiveStudentItem => i !== null);

  const countTotal = activeStudentList.length;
  const countHasThesis = activeStudentList.filter((i) => i.hasThesis).length;
  const countNoThesis = activeStudentList.filter((i) => !i.hasThesis).length;

  const filteredData = activeStudentList.filter((item) => {
    if (filter === "ALL") return true;
    return item.status === filter;
  });

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = filteredData.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  // Tính số dòng trống cần bù để chống nhảy độ cao trang
  const emptyRowsCount = pageSize - paginatedData.length;

  if (loading) return <div style={{ padding: "20px", color: "#64748b" }}>Đang tải tiến độ luận văn học viên...</div>;

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "16px", backgroundColor: "#f8fafc" }}>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "10px", borderLeft: "5px solid #0284c7", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>TỔNG HỌC VIÊN ĐANG HỌC</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#0284c7", marginTop: "4px" }}>{countTotal}</div>
        </div>
        <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "10px", borderLeft: "5px solid #10b981", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>ĐÃ ĐĂNG KÝ ĐỀ TÀI</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#059669", marginTop: "4px" }}>{countHasThesis}</div>
        </div>
        <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "10px", borderLeft: "5px solid #f59e0b", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>CHƯA ĐĂNG KÝ ĐỀ TÀI</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#d97706", marginTop: "4px" }}>{countNoThesis}</div>
        </div>
      </div>

      {/* Main Table Container */}
      <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "20px", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
            🎓 Tiến độ Luận văn (Trong thời hạn đào tạo)
          </h3>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => { setFilter("ALL"); setCurrentPage(1); }} style={btnStyle(filter === "ALL", "#0f172a")}>Tất cả ({countTotal})</button>
            <button onClick={() => { setFilter("HAS_THESIS"); setCurrentPage(1); }} style={btnStyle(filter === "HAS_THESIS", "#059669")}>Đã đăng ký đề tài ({countHasThesis})</button>
            <button onClick={() => { setFilter("NO_THESIS"); setCurrentPage(1); }} style={btnStyle(filter === "NO_THESIS", "#d97706")}>Chưa đăng ký đề tài ({countNoThesis})</button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontSize: "14px", textAlign: "left", minWidth: "1050px" }}>
            <colgroup>
              <col style={{ width: "15%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "17%" }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #cbd5e1", color: "#475569", height: "44px" }}>
                <th style={{ padding: "8px 12px" }}>Học viên</th>
                <th style={{ padding: "8px 12px" }}>Lớp & Ngành</th>
                <th style={{ padding: "8px 12px" }}>Đề tài & GVHD</th>
                <th style={{ padding: "8px 12px", textAlign: "center", whiteSpace: "nowrap" }}>Hạn đào tạo</th>
                <th style={{ padding: "8px 12px", textAlign: "center", whiteSpace: "nowrap" }}>Trạng thái đề tài</th>
                <th style={{ padding: "8px 12px", textAlign: "center", whiteSpace: "nowrap" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr style={{ height: "400px" }}>
                  <td colSpan={6} style={{ textAlign: "center", color: "#94a3b8" }}>Không có dữ liệu học viên.</td>
                </tr>
              ) : (
                <>
                  {paginatedData.map((item) => (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9", height: "64px" }}>
                      <td style={{ padding: "8px 12px", verticalAlign: "middle" }}>
                        <div style={{ fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.name}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>{item.id}</div>
                      </td>
                      <td style={{ padding: "8px 12px", verticalAlign: "middle" }}>
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.major}>
                          {item.major}
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>{item.class}</div>
                      </td>
                      <td style={{ padding: "8px 12px", verticalAlign: "middle" }}>
                        <div style={{ color: item.hasThesis ? "#0f172a" : "#94a3b8", fontWeight: item.hasThesis ? 500 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.thesisTitle}>
                          {item.thesisTitle}
                        </div>
                        {item.advisor !== "Chưa phân công" && (
                          <div style={{ fontSize: "12px", color: "#2563eb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            GVHD: {item.advisor}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "8px 12px", color: "#059669", fontWeight: 600, textAlign: "center", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                        {item.dueDate}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                        {item.hasThesis ? (
                          <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: "12px", backgroundColor: "#d1fae5", color: "#065f46", fontSize: "12px", fontWeight: 700 }}>
                            ✅ Đã đăng ký
                          </span>
                        ) : (
                          <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: "12px", backgroundColor: "#fef3c7", color: "#92400e", fontSize: "12px", fontWeight: 700 }}>
                            ⏳ Chưa đăng ký đề tài
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                        <button style={{ padding: "6px 12px", backgroundColor: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
                          ✏️ Cập nhật tiến độ
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Bù các hàng trống để giữ cố định chiều cao bảng khi chuyển trang */}
                  {emptyRowsCount > 0 && Array.from({ length: emptyRowsCount }).map((_, idx) => (
                    <tr key={`empty-${idx}`} style={{ height: "64px", borderBottom: "1px solid transparent" }}>
                      <td colSpan={6}>&nbsp;</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
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
    </div>
  );
}

function btnStyle(active: boolean, bg: string) {
  return {
    padding: "6px 12px", borderRadius: "6px", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer",
    backgroundColor: active ? bg : "#f1f5f9", color: active ? "#fff" : "#475569"
  };
}