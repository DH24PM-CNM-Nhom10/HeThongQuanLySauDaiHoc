"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { DB } from "../lib/db";
import { checkIsOverdue } from "../lib/studentUtils";

export default function Dashboard() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      
      // 1. Đọc dữ liệu thực tế từ LocalStorage
      try {
        const localData = DB.get("students");
        if (Array.isArray(localData) && localData.length > 0) {
          setStudents(localData);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error("Lỗi đọc LocalStorage:", e);
      }

      // 2. Nếu trống mới gọi API
      try {
        const res = await fetch("/api/students?limit=2000");
        const result = await res.json();
        const data = Array.isArray(result) ? result : result.data || result.records || [];
        setStudents(data);
      } catch (error) {
        console.error("Lỗi khi lấy dữ liệu:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  // --- LOGIC XỬ LÝ DỮ LIỆU THỐNG KÊ (ĐỒNG BỘ BẰNG CHECKISOVERDUE) ---
  const stats = useMemo(() => {
    const defendedList: any[] = [];
    const overdueList: any[] = [];
    const doingList: any[] = [];

    students.forEach((s) => {
      if (checkIsOverdue(s)) {
        overdueList.push(s);
      } else {
        const tt = (s.trangThai || s.trang_thai || s.TRANG_THAI || s.status || "").toString().toLowerCase();
        const category = s.category;
        const isGraduated =
          category === "GRADUATED" ||
          tt.includes("tốt nghiệp") ||
          tt.includes("bảo vệ") ||
          tt.includes("hoàn thành") ||
          s.daBaoVe === true ||
          (s.ngayTotNghiep && s.ngayTotNghiep !== "-") ||
          (s.ngayBaoVe && s.ngayBaoVe !== "-");

        if (isGraduated) {
          defendedList.push(s);
        } else {
          doingList.push(s);
        }
      }
    });

    const total = students.length;
    const overdueCount = overdueList.length;
    const doingThesisCount = doingList.length;
    const defendedCount = defendedList.length;

    const overduePercent = total > 0 ? Math.round((overdueCount / total) * 100) : 0;
    const defendedPercent = total > 0 ? Math.round((defendedCount / total) * 100) : 0;
    const doingPercent = total > 0 ? Math.max(0, 100 - overduePercent - defendedPercent) : 0;

    return {
      total,
      overdueCount,
      doingThesisCount,
      defendedCount,
      overduePercent,
      doingPercent,
      defendedPercent,
      overdueList,
    };
  }, [students]);

  // --- THỐNG KÊ PHÂN BỔ THEO LỚP & NGÀNH ---
  const classMajorDistribution = useMemo(() => {
    const map: { [key: string]: number } = {};
    
    stats.overdueList.forEach((s) => {
      const lop = s.lop || s.LOP || s.class || "";
      const nganh = s.tenNganh || s.ten_nganh || s.major || "Chưa phân ngành";
      const key = lop ? `${nganh} (${lop})` : nganh;
      map[key] = (map[key] || 0) + 1;
    });

    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [stats.overdueList]);

  return (
    <div style={{
      padding: "28px",
      backgroundColor: "#f8fafc",
      minHeight: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: "#0f172a"
    }}>
      
      {/* 1. HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
            📊 Bảng Điều Khiển & Tổng Quan Đào Tạo
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "13.5px", color: "#64748b" }}>
            Hệ thống Quản lý Đào tạo Thạc sĩ — Cập nhật dữ liệu thời gian thực
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => alert("Đã xuất báo cáo thành công!")}
            style={{ padding: "9px 16px", backgroundColor: "#fff", border: "1px solid #cbd5e1", borderRadius: "8px", fontWeight: 600, fontSize: "13px", color: "#334155", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
          >
            📑 Xuất Báo Cáo
          </button>
          
          <Link
            href="/thesis"
            style={{ padding: "9px 16px", backgroundColor: "#6366f1", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "13px", color: "#fff", textDecoration: "none", boxShadow: "0 1px 2px rgba(99, 102, 241, 0.3)" }}
          >
            📩 Gửi Nhắc Nhở Hàng Loạt
          </Link>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Đang đồng bộ dữ liệu Bảng điều khiển...</div>
      ) : (
        <>
          {/* 2. CARDS KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px", marginBottom: "24px" }}>
            
            <div style={kpiCardStyle("#3b82f6", "#eff6ff")}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.05em" }}>TỔNG HỌC VIÊN</span>
                <span style={{ fontSize: "18px" }}>🎓</span>
              </div>
              <div style={{ fontSize: "32px", fontWeight: 800, color: "#1e3a8a", marginTop: "6px" }}>{stats.total}</div>
              <div style={{ fontSize: "12px", color: "#3b82f6", marginTop: "2px" }}>Toàn bộ hồ sơ trong hệ thống</div>
            </div>

            <div style={kpiCardStyle("#ef4444", "#fef2f2")}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.05em" }}>CẢNH BÁO QUÁ HẠN</span>
                <span style={{ fontSize: "18px" }}>⚠️</span>
              </div>
              <div style={{ fontSize: "32px", fontWeight: 800, color: "#991b1b", marginTop: "6px" }}>{stats.overdueCount}</div>
              <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "2px" }}>Quá thời hạn đào tạo chưa bảo vệ</div>
            </div>

            <div style={kpiCardStyle("#f59e0b", "#fffbeb")}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em" }}>ĐANG HỌC / LÀM LUẬN VĂN</span>
                </span>
                <span style={{ fontSize: "18px" }}>📝</span>
              </div>
              <div style={{ fontSize: "32px", fontWeight: 800, color: "#78350f", marginTop: "6px" }}>{stats.doingThesisCount}</div>
              <div style={{ fontSize: "12px", color: "#d97706", marginTop: "2px" }}>Trong thời hạn đào tạo cho phép</div>
            </div>

            <div style={kpiCardStyle("#10b981", "#ecfdf5")}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.05em" }}>ĐÃ TỐT NGHIỆP / BẢO VỆ</span>
                <span style={{ fontSize: "18px" }}>✅</span>
              </div>
              <div style={{ fontSize: "32px", fontWeight: 800, color: "#064e3b", marginTop: "6px" }}>{stats.defendedCount}</div>
              <div style={{ fontSize: "12px", color: "#10b981", marginTop: "2px" }}>Đã hoàn thành chương trình</div>
            </div>

          </div>

          {/* 3. BIỂU ĐỒ & PHÂN BỔ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", marginBottom: "24px" }}>
            
            <div style={boxStyle}>
              <h3 style={boxTitleStyle}>📊 Tỷ lệ Tiến độ Học viên</h3>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", marginTop: "20px", flexWrap: "wrap", gap: "16px" }}>
                
                <div style={{
                  position: "relative",
                  width: "130px",
                  height: "130px",
                  borderRadius: "50%",
                  background: `conic-gradient(
                    #ef4444 0% ${stats.overduePercent}%, 
                    #f59e0b ${stats.overduePercent}% ${stats.overduePercent + stats.doingPercent}%, 
                    #10b981 ${stats.overduePercent + stats.doingPercent}% 100%
                  )`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.06)"
                }}>
                  <div style={{
                    width: "88px",
                    height: "88px",
                    backgroundColor: "#ffffff",
                    borderRadius: "50%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <span style={{ fontSize: "20px", fontWeight: 800, color: "#ef4444" }}>{stats.overduePercent}%</span>
                    <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>Cảnh báo</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "12px", height: "12px", backgroundColor: "#ef4444", borderRadius: "3px" }}></span>
                    <span>Cảnh báo quá hạn: <strong>{stats.overdueCount} HV ({stats.overduePercent}%)</strong></span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "12px", height: "12px", backgroundColor: "#f59e0b", borderRadius: "3px" }}></span>
                    <span>Đang học (trong hạn): <strong>{stats.doingThesisCount} HV ({stats.doingPercent}%)</strong></span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "12px", height: "12px", backgroundColor: "#10b981", borderRadius: "3px" }}></span>
                    <span>Đã tốt nghiệp: <strong>{stats.defendedCount} HV ({stats.defendedPercent}%)</strong></span>
                  </div>
                </div>

              </div>
            </div>

            <div style={boxStyle}>
              <h3 style={boxTitleStyle}>🏫 Phân bổ Cảnh báo theo Lớp & Ngành</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "18px" }}>
                {classMajorDistribution.length === 0 ? (
                  <div style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", padding: "20px" }}>Không có dữ liệu cảnh báo</div>
                ) : (
                  classMajorDistribution.map((item, idx) => {
                    const maxVal = Math.max(...classMajorDistribution.map(i => i.count));
                    const pct = Math.min(100, Math.round((item.count / maxVal) * 100));
                    const colors = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"];
                    const color = colors[idx % colors.length];

                    return (
                      <div key={idx}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                          <span style={{ fontWeight: 600, color: "#334155" }}>{item.name}</span>
                          <span style={{ fontWeight: 700, color: color }}>{item.count} Học viên</span>
                        </div>
                        <div style={{ width: "100%", height: "8px", backgroundColor: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: "4px" }}></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* 4. BẢNG DỮ LIỆU & TIMELINE */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            
            <div style={{ ...boxStyle, gridColumn: "span 2" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={boxTitleStyle}>🚨 Danh sách Cảnh báo Quá hạn Đào tạo ({stats.overdueCount})</h3>
                
                <Link href="/thesis" style={{ fontSize: "13px", color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>
                  Xem tất cả ({stats.overdueCount}) →
                </Link>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13.5px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc", color: "#64748b" }}>
                      <th style={{ padding: "10px 12px" }}>Mã HV / Họ và tên</th>
                      <th style={{ padding: "10px 12px" }}>Lớp & Ngành</th>
                      <th style={{ padding: "10px 12px" }}>Năm Nhập Học</th>
                      <th style={{ padding: "10px 12px" }}>Trạng thái</th>
                      <th style={{ padding: "10px 12px", textAlign: "center" }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.overdueList.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "#94a3b8" }}>
                          Không có học viên nào bị cảnh báo.
                        </td>
                      </tr>
                    ) : (
                      stats.overdueList.slice(0, 5).map((item: any, idx: number) => {
                        const hoTen = item.hoTen || item.ho_ten || item.HO_TEN || item.name || "Chưa cập nhật";
                        const maHV = item.maHocVien || item.ma_hoc_vien || item.mahv || item.id || "-";
                        const lopNganh = item.tenNganh || item.ten_nganh || item.lop || item.LOP || "-";
                        const namNH = item.namNhapHoc || item.nam_nhap_hoc || "-";
                        
                        return (
                          <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "12px", fontWeight: 700, color: "#0f172a" }}>
                              {hoTen} <br />
                              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 400 }}>Mã: {maHV}</span>
                            </td>
                            <td style={{ padding: "12px", color: "#475569" }}>{lopNganh}</td>
                            <td style={{ padding: "12px", color: "#475569" }}>{namNH}</td>
                            <td style={{ padding: "12px" }}>
                              <span style={{ padding: "4px 8px", backgroundColor: "#fee2e2", color: "#dc2626", borderRadius: "12px", fontSize: "11.5px", fontWeight: 700 }}>
                                ⚠️ Quá thời hạn đào tạo
                              </span>
                            </td>
                            <td style={{ padding: "12px", textAlign: "center" }}>
                              <Link href="/thesis" style={{ padding: "5px 12px", backgroundColor: "#fff", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "12px", color: "#334155", textDecoration: "none", fontWeight: 500 }}>
                                📩 Gửi Mail
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={boxStyle}>
              <h3 style={boxTitleStyle}>📅 Lịch Công Tác Đào Tạo</h3>
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ borderLeft: "3px solid #ef4444", paddingLeft: "12px" }}>
                  <div style={{ fontSize: "12px", color: "#ef4444", fontWeight: 700 }}>HẠN CHÓT NỘP ĐỀ TÀI</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>Khóa CH4KHCT (Nhập học 2024)</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Hạn chót: 30/10/2026</div>
                </div>

                <div style={{ borderLeft: "3px solid #3b82f6", paddingLeft: "12px" }}>
                  <div style={{ fontSize: "12px", color: "#2563eb", fontWeight: 700 }}>HỘI ĐỒNG BẢO VỆ</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", marginTop: "2px" }}>Đợt 2 - Năm 2026</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Dự kiến: 15/11/2026</div>
                </div>
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}

function kpiCardStyle(borderColor: string, bgColor: string) {
  return {
    backgroundColor: bgColor,
    padding: "18px",
    borderRadius: "12px",
    borderLeft: `5px solid ${borderColor}`,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  };
}

const boxStyle = {
  backgroundColor: "#ffffff",
  padding: "20px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
};

const boxTitleStyle = {
  margin: 0,
  fontSize: "15px",
  fontWeight: 700,
  color: "#0f172a",
};
