"use client";
import { useEffect, useRef, useState } from "react";
import { DB, type StoredRecord } from "../../lib/db";
import styles from "../students/StudentManagementTable.module.css";
const columns = [
  ["classCode", "Lớp"],
  ["courseCode", "Mã học phần"],
  ["courseName", "Tên học phần"],
  ["teacherId", "Mã giảng viên"],
  ["teacherName", "Giảng viên"],
  ["schoolYear", "Năm học"],
  ["semester", "Học kỳ"],
  ["date", "Ngày học"],
  ["startPeriod", "Tiết bắt đầu"],
  ["endPeriod", "Tiết kết thúc"],
  ["room", "Phòng"],
];
export default function ScheduleImport() {
  const [rows, setRows] = useState<StoredRecord[]>([]),
    [preview, setPreview] = useState<StoredRecord[] | null>(null),
    [file, setFile] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1);
  const input = useRef<HTMLInputElement>(null);
  async function load() {
    try {
      setRows(await DB.syncFromApi("schedule"));
    } catch {
      setMessage("Không tải được thời khóa biểu.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function upload(commit = false) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("commit", String(commit));
      const r = await fetch("/api/schedule/import", {
        method: "POST",
        body: form,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.errors?.join("\n") || data.message);
      if (commit) {
        setPreview(null);
        setFile(null);
        if (input.current) input.current.value = "";
        await load();
        setMessage(
          `Đã thêm ${data.added} lịch; bỏ qua ${data.duplicates} dòng trùng.`,
        );
      } else {
        setPreview(data.data);
        setMessage(
          `Hợp lệ: ${data.added} lịch mới; ${data.duplicates} dòng trùng. Nhấn xác nhận để lưu.`,
        );
      }
    } catch (e) {
      setPreview(null);
      setMessage(e instanceof Error ? e.message : "Không nhập được.");
    } finally {
      setBusy(false);
    }
  }
  async function template() {
    const X = await import("xlsx");
    const sheet = X.utils.aoa_to_sheet([
      [
        "Mã phân công",
        "Năm học",
        "Học kỳ",
        "Lớp",
        "Mã học phần",
        "Mã giảng viên",
        "Ngày học",
        "Tiết bắt đầu",
        "Tiết kết thúc",
        "Phòng",
      ],
    ]);
    sheet["!cols"] = Array(10).fill({ wch: 22 });
    const book = X.utils.book_new();
    X.utils.book_append_sheet(book, sheet, "Thời khóa biểu");
    X.writeFile(book, "Mau_thoi_khoa_bieu.xlsx");
  }
  const data = (preview || rows).filter(
      (r) =>
        !search ||
        Object.values(r).join(" ").toLowerCase().includes(search.toLowerCase()),
    ),
    pages = Math.max(1, Math.ceil(data.length / 20)),
    current = Math.min(page, pages);
  return (
    <section className={styles.management}>
      <div className={styles.toolbar}>
        <h1>Thời khóa biểu — Nhập Excel</h1>
        <div className={styles.actions}>
          <button onClick={() => void template()}>Tải file mẫu</button>
          <button onClick={() => void load()} disabled={busy}>
            Tải lại
          </button>
        </div>
      </div>
      <p>
        Nhập lịch đã lập từ Excel. Mỗi dòng là một ngày học, gắn với phân công
        đã lưu; hệ thống kiểm tra trùng lịch và giữ dữ liệu cũ.
      </p>
      <div className={styles.actions} style={{ marginBlock: 16 }}>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls"
          disabled={busy}
          aria-label="File thời khóa biểu"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setPreview(null);
            setMessage("");
          }}
        />
        <button
          className={styles.uploadButton}
          disabled={!file || busy}
          onClick={() => void upload()}
        >
          Kiểm tra Excel
        </button>
        {preview && (
          <button
            className={styles.addButton}
            disabled={busy}
            onClick={() => void upload(true)}
          >
            Xác nhận nhập {preview.length} lịch
          </button>
        )}
        <input
          aria-label="Tìm lịch"
          placeholder="Tìm lớp, học phần, giảng viên..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {message && (
        <p
          role="status"
          style={{
            whiteSpace: "pre-wrap",
            maxHeight: 180,
            overflow: "auto",
            marginBlock: 12,
          }}
        >
          {message}
        </p>
      )}
      <h2>{preview ? "Xem trước lịch sẽ nhập" : "Danh sách lịch đã lưu"}</h2>
      <div
        className={styles.sheet}
        tabIndex={0}
        role="region"
        aria-label="Lịch học"
      >
        <table className={`excel-grid ${styles.table}`} data-grid="excel">
          <thead>
            <tr>
              <th>STT</th>
              {columns.map(([k, l]) => (
                <th key={k}>{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice((current - 1) * 20, current * 20).map((r, i) => (
              <tr key={i}>
                <td>{(current - 1) * 20 + i + 1}</td>
                {columns.map(([k]) => (
                  <td key={k}>{String(r[k] ?? "—")}</td>
                ))}
              </tr>
            ))}
            {!data.length && (
              <tr>
                <td colSpan={12}>Chưa có lịch phù hợp.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className={styles.pagination}>
        <button disabled={current <= 1} onClick={() => setPage(current - 1)}>
          Trước
        </button>
        <span>
          Trang {current}/{pages} · {data.length} lịch
        </span>
        <button
          disabled={current >= pages}
          onClick={() => setPage(current + 1)}
        >
          Sau
        </button>
      </footer>
    </section>
  );
}
