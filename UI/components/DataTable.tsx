"use client";

import { useEffect, useState } from "react";
import { DB } from "@/lib/db";
import { ENTITY_SCHEMAS } from "@/lib/schemas";

interface Props {
  entityKey: string;
}

export default function DataTable({ entityKey }: Props) {
  const schema = ENTITY_SCHEMAS[entityKey];
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [visibleFields, setVisibleFields] = useState<string[]>([]);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  useEffect(() => {
    if (!schema) return;
    const all = DB.get(entityKey);
    setData(all);
    setVisibleFields(schema.fields.slice(0, 8).map((f) => f.key));
  }, [entityKey]);

  if (!schema) return <p>Entity không tồn tại</p>;

  const filtered = search
    ? data.filter((row) =>
        Object.values(row).some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(search.toLowerCase())
        )
      )
    : data;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageData = filtered.slice(start, start + pageSize);

  const toggleField = (key: string) => {
    setVisibleFields((prev) => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev;
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  return (
    <div>
      <div className="table-toolbar">
        <div className="table-search">
          <input
            type="text"
            className="form-control"
            placeholder="Tìm kiếm..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="column-picker">
          <button
            className="btn btn-secondary column-picker-btn"
            onClick={() => setShowColumnMenu(!showColumnMenu)}
          >
            ⚙️ Chọn cột
          </button>

          {showColumnMenu && (
            <div className="column-picker-menu" style={{ display: "block" }}>
              <div className="column-picker-title">Chọn cột hiển thị</div>
              <div className="column-picker-list">
                {schema.fields.map((field) => (
                  <label key={field.key} className="column-option">
                    <input
                      type="checkbox"
                      checked={visibleFields.includes(field.key)}
                      onChange={() => toggleField(field.key)}
                    />
                    <span>{field.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {visibleFields.map((key) => {
                const field = schema.fields.find((f) => f.key === key);
                return <th key={key}>{field?.label || key}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={visibleFields.length} className="empty-state">
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              pageData.map((row, idx) => (
                <tr key={idx}>
                  {visibleFields.map((key) => (
                    <td key={key}>{row[key] ?? "—"}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <div className="pagination-info">
          Hiển thị{" "}
          <strong>
            {filtered.length === 0 ? 0 : start + 1}–
            {Math.min(start + pageSize, filtered.length)}
          </strong>{" "}
          / <strong>{filtered.length}</strong> bản ghi
        </div>

        <div className="pagination-controls">
          <label>Số dòng:</label>
          <select
            className="page-size-select"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
          </select>

          <div className="pagination">
            <button
              className="page-btn"
              disabled={currentPage === 1}
              onClick={() => setPage(1)}
            >
              «
            </button>
            <button
              className="page-btn"
              disabled={currentPage === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ‹
            </button>
            <span className="page-btn active">{currentPage}</span>
            <button
              className="page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </button>
            <button
              className="page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage(totalPages)}
            >
              »
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
