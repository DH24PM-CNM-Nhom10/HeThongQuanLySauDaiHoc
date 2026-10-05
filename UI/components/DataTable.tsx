// components/DataTable.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { DB } from "../lib/db";
import { ENTITY_SCHEMAS } from "../lib/schemas";

interface DataTableProps {
  entityKey: string;
  title?: string;
}

function formatExcelDate(value: any): string {
  if (!value) return "-";
  const num = Number(value);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const date = new Date((num - (25567 + 2)) * 86400 * 1000);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  return String(value);
}

export default function DataTable({ entityKey }: DataTableProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const schema = ENTITY_SCHEMAS[entityKey];
  const fields = schema?.fields || [];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let localData = DB.get(entityKey) || [];

      if (!localData || localData.length === 0) {
        const res = await fetch(`/api/${entityKey}`);
        if (res.ok) {
          const json = await res.json();
          localData = Array.isArray(json) ? json : json.data || json.records || [];
        }
      }

      setData(Array.isArray(localData) ? localData : []);
    } catch (err) {
      console.error(`Lỗi khi tải dữ liệu ${entityKey}:`, err);
      try {
        setData(DB.get(entityKey) || []);
      } catch {
        setData([]);
      }
    } finally {
      setLoading(false);
    }
  }, [entityKey]);

  useEffect(() => {
    loadData();

    const handleStorageChange = () => loadData();
    const handleFocus = () => loadData();

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadData]);

  const getFieldValue = (item: any, fieldKey: string) => {
    if (!item) return "-";

    let rawVal = item[fieldKey];

    if (rawVal === undefined || rawVal === null || rawVal === "") {
      const fallbackMap: Record<string, string[]> = {
        shcc: ["ma_giang_vien", "magiangvien", "maGV", "id"],
        hoten: ["hoTen", "ho_ten", "name", "ten_giang_vien"],
        t_dvi: ["donVi", "don_vi", "khoa", "bomon"],
        t_tdcmon: ["hocVi", "hoc_vi", "trinhDo"],
        t_hham: ["hocHam", "hoc_ham"],
        email: ["thu_dientu"],
        maHocVien: ["ma_hoc_vien", "masv", "mahv"],
        tenLuanVan: ["ten_de_tai", "ten_luan_van", "nhanDe"],
        ngaySinh: ["ngaysinh", "ngay_sinh", "dob"],
        ngayNhapHoc: ["ngaynhaphoc", "ngay_nhap_hoc"],
      };

      const fallbacks = fallbackMap[fieldKey] || [];
      for (const key of fallbacks) {
        if (item[key] !== undefined && item[key] !== null && item[key] !== "") {
          rawVal = item[key];
          break;
        }
      }
    }

    if (rawVal === undefined || rawVal === null || rawVal === "") {
      return "-";
    }

    const isDateField = /ngay|date|birth/i.test(fieldKey);
    if (isDateField || (typeof rawVal === "number" && rawVal > 30000 && rawVal < 60000)) {
      return formatExcelDate(rawVal);
    }

    return String(rawVal);
  };

  const renderCellContent = (fieldKey: string, val: string) => {
    if (val === "-") return <span style={{ color: "#94a3b8" }}>-</span>;

    if (fieldKey === "trangThai" || fieldKey === "trangThaiLv") {
      let bg = "#f1f5f9";
      let color = "#475569";

      if (val.includes("Đang học") || val.includes("Đang làm")) {
        bg = "#dcfce7"; color = "#15803d";
      } else if (val.includes("Tốt nghiệp") || val.includes("Bảo vệ")) {
        bg = "#dbeafe"; color = "#1e40af";
      } else if (val.includes("Quá hạn") || val.includes("Nghỉ") || val.includes("Thôi")) {
        bg = "#fee2e2"; color = "#b91c1c";
      }

      return (
        <span
          style={{
            padding: "3px 10px",
            borderRadius: "12px",
            fontSize: "12px",
            fontWeight: 600,
            backgroundColor: bg,
            color: color,
            display: "inline-block",
            whiteSpace: "nowrap",
          }}
        >
          {val}
        </span>
      );
    }

    return val;
  };

  const filteredData = data.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(item).some((val) =>
      String(val || "").toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const pagedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const btnNavStyle = (disabled: boolean) => ({
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    backgroundColor: disabled ? "#f8fafc" : "#ffffff",
    color: disabled ? "#94a3b8" : "#1e293b",
    fontWeight: 600,
    fontSize: "13px",
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.15s ease",
  });

  // Reusable Component Phân Trang Cân Cả 2 Bên (Trái - Phải)
  const renderPaginationBar = (position: "top" | "bottom") => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: position === "bottom" ? 14 : 0,
        marginBottom: position === "top" ? 14 : 0,
        padding: "10px 14px",
        backgroundColor: "#f8fafc",
        borderRadius: "8px",
        border: "1px solid #e2e8f0",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      {/* KHỐI TRÁI: Nút lùi trang «« ‹ + Số dòng */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(1)}
            title="Về trang đầu"
            style={btnNavStyle(currentPage === 1)}
          >
            «« Trang đầu
          </button>
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            title="Trang trước"
            style={btnNavStyle(currentPage === 1)}
          >
            ‹ Trước
          </button>
        </div>

        <span style={{ color: "#cbd5e1" }}>|</span>

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "13px", color: "#475569" }}>
          <span>Xem</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "13px",
              outline: "none",
              cursor: "pointer",
              backgroundColor: "#fff",
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>dòng/trang</span>
        </div>
      </div>

      {/* KHỐI PHẢI: Số trang + Nút tiến trang › »» */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>
          Trang <strong style={{ color: "#2563eb" }}>{currentPage}</strong> / {totalPages} (Tổng {filteredData.length} bản ghi)
        </span>

        <div style={{ display: "flex", gap: 4 }}>
          <button
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            title="Trang sau"
            style={btnNavStyle(currentPage === totalPages || totalPages === 0)}
          >
            Sau ›
          </button>
          <button
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(totalPages)}
            title="Đến trang cuối"
            style={btnNavStyle(currentPage === totalPages || totalPages === 0)}
          >
            Trang cuối »»
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ width: "100%", fontFamily: "sans-serif" }}>
      {/* Thanh Tìm kiếm & Tải lại */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          placeholder="🔍 Tìm kiếm nhanh..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          style={{
            padding: "8px 14px",
            border: "1px solid #cbd5e1",
            borderRadius: "8px",
            fontSize: "14px",
            width: "280px",
            outline: "none",
          }}
        />

        <button
          onClick={loadData}
          style={{
            padding: "8px 14px",
            backgroundColor: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          🔄 Tải lại dữ liệu
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
          Đang tải dữ liệu...
        </div>
      ) : filteredData.length === 0 ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            backgroundColor: "#fff",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            color: "#64748b",
          }}
        >
          {data.length === 0
            ? `Chưa có dữ liệu cho mục này. Vui lòng vào trang Upload để nhập dữ liệu!`
            : "Không tìm thấy bản ghi nào khớp với từ khóa."}
        </div>
      ) : (
        <>
          {/* 1. Thanh phân trang PHÍA TRÊN BẢNG (Không bị trôi theo cuộn ngang) */}
          {renderPaginationBar("top")}

          {/* 2. Vùng cuộn ngang riêng biệt dành cho Bảng Dữ Liệu */}
          <div
            style={{
              overflowX: "auto",
              backgroundColor: "#fff",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "separate",
                borderSpacing: 0,
                textAlign: "left",
                fontSize: "13px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f8fafc", color: "#334155" }}>
                  {/* Cố định cột STT ở mép trái */}
                  <th
                    style={{
                      padding: "12px 14px",
                      width: "50px",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      position: "sticky",
                      left: 0,
                      backgroundColor: "#f8fafc",
                      zIndex: 10,
                      borderBottom: "2px solid #e2e8f0",
                      borderRight: "1px solid #e2e8f0",
                    }}
                  >
                    STT
                  </th>
                  {fields.map((field) => (
                    <th
                      key={field.key}
                      style={{
                        padding: "12px 14px",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        backgroundColor: "#f8fafc",
                        borderBottom: "2px solid #e2e8f0",
                      }}
                    >
                      {field.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedData.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    style={{
                      transition: "background-color 0.1s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    {/* Ô STT Cố định Sticky trái */}
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#64748b",
                        textAlign: "center",
                        fontWeight: 500,
                        position: "sticky",
                        left: 0,
                        backgroundColor: "#fff",
                        zIndex: 5,
                        borderBottom: "1px solid #f1f5f9",
                        borderRight: "1px solid #e2e8f0",
                      }}
                    >
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>

                    {fields.map((field) => {
                      const val = getFieldValue(item, field.key);
                      return (
                        <td
                          key={field.key}
                          title={val}
                          style={{
                            padding: "10px 14px",
                            color: "#1e293b",
                            whiteSpace: "nowrap",
                            maxWidth: "260px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            verticalAlign: "middle",
                            borderBottom: "1px solid #f1f5f9",
                          }}
                        >
                          {renderCellContent(field.key, val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 3. Thanh phân trang PHÍA DƯỚI BẢNG */}
          {renderPaginationBar("bottom")}
        </>
      )}
    </div>
  );
}