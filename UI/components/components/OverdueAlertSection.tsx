"use client";

import { useState, useEffect, useMemo } from "react";
import { DB } from "../lib/db";
import { checkIsOverdue } from "../lib/studentUtils";

type FilterType = "ALL" | "HAS_THESIS" | "NO_THESIS";
type ItemStatus = "HAS_THESIS" | "NO_THESIS";

interface StudentAlertItem {
  id: string;
  name: string;
  class: string;
  major: string;
  thesisTitle: string;
  advisor: string;
  dueDate: string;
  daysOverdue: number;
  hasThesis: boolean;
  status: ItemStatus;
}

function parseVNStyleDate(dateInput: any): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;

  if (typeof dateInput === "number" || (!isNaN(Number(dateInput)) && String(dateInput).trim() !== "")) {
    const num = Number(dateInput);
    if (num > 30000 && num < 60000) {
      const d = new Date((num - (25567 + 2)) * 86400 * 1000);
      return isNaN(d.getTime()) || d.getFullYear() < 1990 ? null : d;
    }
    if (num > 100000000000) return new Date(num);
  }

  const str = String(dateInput).trim();
  if (!str || str === "-" || str === "null" || str === "undefined") return null;

  let day = 0, month = 0, year = 0;

  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    }
  } else if (str.includes("-")) {
    const parts = str.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
      }
    }
  }

  if (day > 0 && month >= 0 && year > 0) {
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }

    const d = new Date(year, month, day);
    d.setFullYear(year);

    if (!isNaN(d.getTime()) && d.getFullYear() >= 1990) {
      return d;
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1990) {
    return parsed;
  }

  return null;
}

export default function OverdueAlertSection() {
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

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
        const text = await res.text();
        try {
          const result = text ? JSON.parse(text) : null;
          if (result?.success && Array.isArray(result.data)) {
            setStudents(result.data);
          }
        } catch {
          /* API không trả JSON */
        }
      } catch (err) {
        console.error("Lỗi API:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  const todayTimestamp = new Date().getTime();

  // Dùng checkIsOverdue để đồng bộ danh sách quá hạn chuẩn xác
  const overdueList: StudentAlertItem[] = useMemo(() => {
    return students
      .filter((hv) => checkIsOverdue(hv))
      .map((hv: any) => {
        const maHV = hv.maHocVien || hv.ma_hoc_vien || hv.MA_HOC_VIEN || hv.id || "";
        const hoTen = hv.hoTen || hv.ho_ten || hv.HO_TEN || hv.name || "Chưa có tên";
        const lop = hv.lop || hv.LOP || hv.class || "-";
        const tenNganh = hv.tenNganh || hv.ten_nganh || hv.TEN_NGANH || hv.major || "-";
        const tenLuanVan = hv.tenLuanVan || hv.ten_luan_van || hv.TEN_LUAN_VAN || hv.tenDeAn || "";
        const gvHuongDan = hv.gvHuongDan || hv.nguoi_huong_dan_1 || hv.NGUOI_HUONG_DAN_1 || "";

        const ngayHetHanVal = hv.ngayHetHan || hv.ngay_het_han_dt || hv.NGAY_HET_HAN_DT || hv.thoiHanDaoTao || hv.hanGoc;
        const dueDateObj = parseVNStyleDate(ngayHetHanVal) || new Date();
        const dueDateStr = `${String(dueDateObj.getDate()).padStart(2, "0")}/${String(dueDateObj.getMonth() + 1).padStart(2, "0")}/${dueDateObj.getFullYear()}`;

        const diffDays = Math.floor((todayTimestamp - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
        const daysOverdue = diffDays > 0 ? diffDays : Number(hv.daysOverdue || 0);

        const hasThesis = Boolean(
          tenLuanVan &&
          String(tenLuanVan).trim() !== "" &&
          String(tenLuanVan) !== "Chưa đăng ký đề tài" &&
          String(tenLuanVan) !== "-"
        );

        const status: ItemStatus = hasThesis ? "HAS_THESIS" : "NO_THESIS";

        return {
          id: maHV,
          name: hoTen,
          class: lop,
          major: tenNganh,
          thesisTitle: hasThesis ? tenLuanVan : "Chưa đăng ký đề tài",
          advisor: gvHuongDan || "Chưa phân công",
          dueDate: dueDateStr,
          daysOverdue,
          hasThesis,
          status,
        };
      });
  }, [students, todayTimestamp]);

  const countTotal = overdueList.length;
  const countHasThesis = overdueList.filter((i) => i.status === "HAS_THESIS").length;
  const countNoThesis = overdueList.filter((i) => i.status === "NO_THESIS").length;

  const filteredData = overdueList.filter((item) => {
    if (filter === "ALL") return true;
    return item.status === filter;
  });

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = filteredData.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const emptyRowsCount = pageSize - paginatedData.length;

  if (loading) return <div style={{ padding: "20px", color: "#64748b" }}>Đang tải danh sách cảnh báo quá hạn...</div>;

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: "16px", backgroundColor: "#f8fafc" }}>
      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "10px", borderLeft: "5px solid #ef4444", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>SỐ HỌC VIÊN QUÁ HẠN ĐÀO TẠO</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#ef4444", marginTop: "4px" }}>{countTotal}</div>
        </div>
        <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "10px", borderLeft: "5px solid #f59e0b", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>ĐÃ CÓ ĐỀ TÀI</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#d97706", marginTop: "4px" }}>{countHasThesis}</div>
        </div>
        <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "10px", borderLeft: "5px solid #ea580c", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700 }}>CHƯA ĐĂNG KÝ ĐỀ TÀI</div>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#ea580c", marginTop: "4px" }}>{countNoThesis}</div>
        </div>
      </div>

      {/* Main Table Container */}
      <div style={{ backgroundColor: "#fff", borderRadius: "12px", padding: "20px", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
            ⚠️ Cảnh báo Học viên Quá thời hạn Đào tạo
          </h3>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => { setFilter("ALL"); setCurrentPage(1); }} style={btnStyle(filter === "ALL", "#0f172a")}>Tất cả ({countTotal})</button>
            <button onClick={() => { setFilter("HAS_THESIS"); setCurrentPage(1); }} style={btnStyle(filter === "HAS_THESIS", "#d97706")}>Đã có đề tài ({countHasThesis})</button>
            <button onClick={() => { setFilter("NO_THESIS"); setCurrentPage(1); }} style={btnStyle(filter === "NO_THESIS", "#ea580c")}>Chưa có đề tài ({countNoThesis})</button>
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
                <th style={{ padding: "8px 12px", textAlign: "center", whiteSpace: "nowrap" }}>Hạn gốc</th>
                <th style={{ padding: "8px 12px", textAlign: "center", whiteSpace: "nowrap" }}>Mức độ Quá hạn</th>
                <th style={{ padding: "8px 12px", textAlign: "center", whiteSpace: "nowrap" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr style={{ height: "400px" }}>
                  <td colSpan={6} style={{ textAlign: "center", color: "#94a3b8" }}>Không có học viên cần xử lý quá hạn.</td>
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
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.thesisTitle}>
                          {item.thesisTitle}
                        </div>
                        {item.advisor !== "Chưa phân công" && (
                          <div style={{ fontSize: "12px", color: "#2563eb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            GVHD: {item.advisor}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "8px 12px", color: "#dc2626", fontWeight: 600, textAlign: "center", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                        {item.dueDate}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                        <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: "12px", backgroundColor: "#fee2e2", color: "#991b1b", fontSize: "12px", fontWeight: 700 }}>
                          🚨 Quá {item.daysOverdue > 0 ? `${Math.floor(item.daysOverdue / 365 * 10) / 10} năm (${item.daysOverdue}d)` : "hạn"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                        <button style={{ padding: "6px 12px", backgroundColor: "#dc2626", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
                          📩 Gửi TB / Xử lý
                        </button>
                      </td>
                    </tr>
                  ))}

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