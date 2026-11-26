"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { normalizeTeacher } from "../../../shared/teacher-profile.cjs";
import { DB } from "../../lib/db";
import { ENTITY_SCHEMAS } from "../../lib/schemas";
import styles from "../students/StudentManagementTable.module.css";
import layout from "./TeacherManagement.module.css";

const fields = ENTITY_SCHEMAS.teachers.fields;
type Teacher = Record<string, string>;
function normalize(record: Record<string, unknown>): Teacher {
  return normalizeTeacher(
    record,
    fields.map((f) => f.key),
  );
}
function TeacherDetails({
  teacher,
  close,
}: {
  teacher: Teacher;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={layout.dialog}
      aria-labelledby="teacher-detail-title"
      onCancel={close}
    >
      <header>
        <h2 id="teacher-detail-title">Thông tin giảng viên</h2>
        <button type="button" onClick={close}>
          Đóng
        </button>
      </header>
      <dl>
        {fields.map(({ key, label }) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{teacher[key] || "Chưa cập nhật"}</dd>
          </div>
        ))}
      </dl>
    </dialog>
  );
}
function TeacherEditor({
  teacher,
  close,
  saved,
}: {
  teacher: Teacher | null;
  close: () => void;
  saved: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const response = await fetch("/api/teachers/manage", {
        method: teacher ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, previous: teacher }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      saved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không lưu được.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className={layout.dialog}
      aria-labelledby="teacher-editor-title"
      onCancel={(event) => {
        if (busy) event.preventDefault();
        else close();
      }}
    >
      <form onSubmit={submit}>
        <header>
          <h2 id="teacher-editor-title">
            {teacher ? "Sửa giảng viên" : "Thêm giảng viên"}
          </h2>
          <button type="button" onClick={close} disabled={busy}>
            Đóng
          </button>
        </header>
        <div className={styles.editFields}>
          {fields.map(({ key, label }) => (
            <label key={key}>
              {label}
              {key === "gioitinh" ? (
                <select name={key} defaultValue={teacher?.[key] || ""}>
                  <option value="">Chưa cập nhật</option>
                  <option>Nam</option>
                  <option>Nữ</option>
                </select>
              ) : (
                <input
                  name={key}
                  defaultValue={teacher?.[key] || ""}
                  required={["shcc", "hoten", "t_dvi"].includes(key)}
                  readOnly={key === "shcc" && !!teacher}
                  maxLength={255}
                  type={key === "email" ? "email" : "text"}
                />
              )}
            </label>
          ))}
        </div>
        {message && <p role="alert">{message}</p>}
        <footer className={styles.actions}>
          <button type="button" onClick={close} disabled={busy}>
            Hủy
          </button>
          <button className={styles.addButton} disabled={busy}>
            {busy ? "Đang lưu..." : "Lưu giảng viên"}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
export default function TeacherManagement() {
  const [rows, setRows] = useState<Teacher[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [search, setSearch] = useState(""),
    [department, setDepartment] = useState(""),
    [degree, setDegree] = useState(""),
    [rank, setRank] = useState(""),
    [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Teacher | null>(null),
    [editorOpen, setEditorOpen] = useState(false),
    [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Teacher | null>(null),
    [exporting, setExporting] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setRows((await DB.syncFromApi("teachers")).map(normalize));
    } catch {
      setError("Không tải được danh sách giảng viên. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const filtered = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!department || row.t_dvi === department) &&
          (!degree || row.t_tdcmon === degree) &&
          (!rank || row.t_hham === rank) &&
          (!search.trim() ||
            Object.values(row)
              .join(" ")
              .toLocaleLowerCase("vi")
              .includes(search.trim().toLocaleLowerCase("vi"))),
      ),
    [rows, department, degree, rank, search],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20)),
    current = Math.min(page, totalPages),
    start = (current - 1) * 20;
  function options(key: string) {
    return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "vi"),
    );
  }
  async function exportExcel() {
    setExporting(true);
    setMessage("");
    try {
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.aoa_to_sheet([
        ["STT", ...fields.map((field) => field.label)],
        ...filtered.map((row, index) => [
          index + 1,
          ...fields.map((field) => row[field.key]),
        ]),
      ]);
      sheet["!cols"] = [{ wch: 6 }, ...fields.map(() => ({ wch: 26 }))];
      sheet["!autofilter"] = { ref: sheet["!ref"] || "A1:J1" };
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Giảng viên");
      XLSX.writeFile(book, "Danh_sach_giang_vien.xlsx");
    } catch {
      setMessage("Không xuất được danh sách. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  }
  async function remove(row: Teacher) {
    if (
      !window.confirm(
        `Xóa giảng viên ${row.hoten}? Hồ sơ có phân công hoặc hướng dẫn sẽ bị chặn xóa.`,
      )
    )
      return;
    setDeleting(true);
    setMessage("");
    try {
      const response = await fetch("/api/teachers/manage", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shcc: row.shcc, previous: row }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      await load();
      setMessage("Đã xóa giảng viên.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không xóa được.");
    } finally {
      setDeleting(false);
    }
  }
  return (
    <section className={`${styles.management} ${layout.page}`}>
      <header className={styles.toolbar}>
        <h1>Quản lý giảng viên</h1>
        <div className={styles.actions}>
          <button
            className={styles.uploadButton}
            disabled={loading || !!error || !filtered.length || exporting}
            onClick={() => void exportExcel()}
          >
            {exporting ? "Đang xuất..." : "Xuất Excel theo bộ lọc"}
          </button>
          <button
            className={styles.addButton}
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            Thêm giảng viên
          </button>

          <button
            className={styles.addButton}
            disabled={loading}
            onClick={() => void load()}
          >
            Tải lại dữ liệu
          </button>
        </div>
      </header>
      <div className={layout.filters}>
        <label>
          Tìm kiếm
          <input
            placeholder="Tên, mã giảng viên, email hoặc chuyên môn"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Đơn vị / Bộ môn
          <select
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả đơn vị</option>
            {options("t_dvi").map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Học vị
          <select
            value={degree}
            onChange={(event) => {
              setDegree(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả học vị</option>
            {options("t_tdcmon").map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Học hàm
          <select
            value={rank}
            onChange={(event) => {
              setRank(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả học hàm</option>
            {options("t_hham").map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            setSearch("");
            setDepartment("");
            setDegree("");
            setRank("");
            setPage(1);
          }}
        >
          Xóa bộ lọc
        </button>
        <p>
          {loading
            ? "Đang tải..."
            : `${filtered.length} / ${rows.length} giảng viên`}
        </p>
      </div>
      {error && (
        <p className={layout.error} role="alert">
          {error} <button onClick={() => void load()}>Thử lại</button>
        </p>
      )}
      {message && (
        <p className={styles.feedback} role="status">
          {message}
        </p>
      )}
      <div
        className={styles.sheet}
        tabIndex={0}
        role="region"
        aria-label="Danh sách giảng viên"
      >
        <table className={`excel-grid ${styles.table}`} data-grid="excel">
          <thead>
            <tr>
              <th scope="col" className="grid-row-number">
                STT
              </th>
              {fields.map((field) => (
                <th scope="col" key={field.key}>
                  {field.label}
                </th>
              ))}
              <th scope="col" className={styles.actionHeading}>
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {loading || error || !filtered.length ? (
              <tr>
                <td colSpan={fields.length + 2} role="status">
                  {loading
                    ? "Đang tải danh sách giảng viên..."
                    : error
                      ? "Danh sách chưa được tải đầy đủ."
                      : "Không tìm thấy giảng viên phù hợp."}
                </td>
              </tr>
            ) : (
              filtered.slice(start, start + 20).map((row, index) => (
                <tr key={`${row.shcc}-${index}`}>
                  <td className="grid-row-number">{start + index + 1}</td>
                  {fields.map((field) => (
                    <td key={field.key}>{row[field.key] || "—"}</td>
                  ))}
                  <td className={styles.actionCell}>
                    <div className={styles.rowActions}>
                      <button
                        className={styles.detailButton}
                        onClick={() => setSelected(row)}
                      >
                        Chi tiết
                      </button>
                      <button
                        className={styles.editButton}
                        onClick={() => {
                          setEditing(row);
                          setEditorOpen(true);
                        }}
                      >
                        Sửa
                      </button>
                      <button
                        className={styles.deleteButton}
                        disabled={deleting}
                        onClick={() => void remove(row)}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <footer className={`${styles.pagination} ${layout.pagination}`}>
        <span>
          {filtered.length ? start + 1 : 0}–
          {Math.min(start + 20, filtered.length)} / {filtered.length} giảng viên
          · 20 giảng viên / trang
        </span>
        <div>
          <button
            disabled={loading || current <= 1}
            onClick={() => setPage(current - 1)}
          >
            Trước
          </button>
          <span>
            Trang {current} / {totalPages}
          </span>
          <button
            disabled={loading || current >= totalPages}
            onClick={() => setPage(current + 1)}
          >
            Sau
          </button>
        </div>
      </footer>
      {editorOpen && (
        <TeacherEditor
          teacher={editing}
          close={() => setEditorOpen(false)}
          saved={() => {
            setEditorOpen(false);
            setMessage("Đã lưu giảng viên.");
            void load();
          }}
        />
      )}
      {selected && (
        <TeacherDetails teacher={selected} close={() => setSelected(null)} />
      )}
    </section>
  );
}
