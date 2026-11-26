"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./TrainingOfficeAssignmentReadonly.module.css";

type Assignment = {
  id: string;
  teacherId: string;
  teacherName: string;
  department?: string;
  classCode: string;
  courseCode: string;
  courseName: string;
  schoolYear: string;
  semester: string;
  trainingTrack?: "nghien_cuu" | "ung_dung";
  majorCode?: string;
  majorName?: string;
};

const trackLabel = (value?: Assignment["trainingTrack"]) =>
  value === "nghien_cuu" ? "Nghiên cứu" : value === "ung_dung" ? "Ứng dụng" : "Chưa xác định";

// Đồng bộ ánh xạ Khoa quản lý ngành với giao diện Phân công ở trang quản trị.
// KHÔNG lấy Khoa công tác của giảng viên, vì có thể phân công giảng viên liên Khoa.
const FACULTY_BY_MAJOR_CODE: Record<string, string> = {
  "8480201": "Khoa CNTT",
  "8620110": "Khoa NN-TNTN",
  "8620105": "Khoa NN-TNTN",
  "8420201": "Khoa NN-TNTN",
  "8540101": "Khoa NN-TNTN",
  "8850101": "Khoa KT-CN-MT",
  "8140114": "Khoa Sư phạm",
  "8140110": "Khoa Sư phạm",
  "8440103": "Khoa Sư phạm",
  "8140111": "Khoa Ngoại ngữ",
};

// Fallback cho các phân công lưu từ phiên bản cũ chưa có majorCode.
const FACULTY_BY_MAJOR_NAME: Record<string, string> = {
  "cong nghe thong tin": "Khoa CNTT",
  "khoa hoc cay trong": "Khoa NN-TNTN",
  "chan nuoi": "Khoa NN-TNTN",
  "cong nghe sinh hoc": "Khoa NN-TNTN",
  "cong nghe thuc pham": "Khoa NN-TNTN",
  "quan ly tai nguyen va moi truong": "Khoa KT-CN-MT",
  "quan ly giao duc": "Khoa Sư phạm",
  "li luan va phuong phap day hoc": "Khoa Sư phạm",
  "ly luan va phuong phap day hoc": "Khoa Sư phạm",
  "vat ly ly thuyet va vat ly toan": "Khoa Sư phạm",
  "ly luan va phuong phap day hoc bo mon tieng anh": "Khoa Ngoại ngữ",
  "li luan va phuong phap day hoc bo mon tieng anh": "Khoa Ngoại ngữ",
};

function normalizeName(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/\s+/g, " ").trim();
}

function facultyFor(record: Assignment): string {
  const majorCode = String(record.majorCode ?? "").trim();
  if (FACULTY_BY_MAJOR_CODE[majorCode]) return FACULTY_BY_MAJOR_CODE[majorCode];
  return FACULTY_BY_MAJOR_NAME[normalizeName(record.majorName ?? "")] ?? "Chưa xác định Khoa";
}

function semesterNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

// Sắp HK1 trước HK2 toàn bộ danh sách; trong cùng HK, ưu tiên năm học mới nhất.
function compareAssignments(a: Assignment, b: Assignment): number {
  return semesterNumber(a.semester) - semesterNumber(b.semester) ||
    b.schoolYear.localeCompare(a.schoolYear) ||
    a.courseCode.localeCompare(b.courseCode, "vi") ||
    a.classCode.localeCompare(b.classCode, "vi");
}

/** Chế độ TRA CỨU: chỉ đọc các phân công đã lưu trong Backend.
 * Không đọc bản nháp localStorage, không cho lưu/sửa/xóa ở đây.
 */
export default function TrainingOfficeAssignmentReadonly() {
  const [rows, setRows] = useState<Assignment[]>([]);
  const [selectedFaculty, setSelectedFaculty] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshCounter, setRefreshCounter] = useState(0);

  const refresh = useCallback(() => setRefreshCounter(value => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/training-office/assignments", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const json: unknown = await response.json();
        if (!response.ok) {
          throw new Error(response.status === 401
            ? "Phiên đăng nhập Phòng đào tạo đã hết hạn. Vui lòng đăng nhập lại."
            : "Không thể tải danh sách phân công. Vui lòng kiểm tra Backend.");
        }
        if (!json || typeof json !== "object" || !("data" in json) || !Array.isArray(json.data)) {
          throw new Error("Dữ liệu phân công từ Backend không đúng định dạng.");
        }
        if (controller.signal.aborted) return;
        const records = (json.data as Assignment[])
          .filter(item => item && typeof item.id === "string" && typeof item.classCode === "string")
          .sort(compareAssignments);
        setRows(records);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Không thể tải dữ liệu phân công.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [refreshCounter]);

  const faculties = Array.from(new Set(rows.map(facultyFor)))
    .sort((a, b) => a.localeCompare(b, "vi"));
  const visibleRows = selectedFaculty === "all"
    ? rows
    : rows.filter(row => facultyFor(row) === selectedFaculty);

  return (
    <section className={styles.panel} aria-labelledby="assignment-readonly-heading">
      <div className={styles.heading}>
        <div>
          <h1 id="assignment-readonly-heading">Danh sách phân công giảng dạy</h1>
        </div>
        <div className={styles.actions}>
          <label htmlFor="readonly-faculty-filter" className={styles.srOnly}>Lọc theo Khoa quản lý ngành</label>
          <select
            id="readonly-faculty-filter"
            className={styles.facultyFilter}
            aria-label="Lọc phân công theo Khoa quản lý ngành"
            value={selectedFaculty}
            onChange={event => setSelectedFaculty(event.target.value)}
            disabled={loading || rows.length === 0}
          >
            <option value="all">Tất cả Khoa</option>
            {faculties.map(faculty => <option value={faculty} key={faculty}>{faculty}</option>)}
          </select>
          <button type="button" className={styles.refresh} onClick={refresh} disabled={loading}>
            {loading ? "Đang tải..." : "Làm mới"}
          </button>
        </div>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Bảng dữ liệu">
        <table data-grid="excel" className={"excel-grid " + (styles.table)}>
          <thead>
            <tr>
              <th scope="col">STT</th>
              <th scope="col">Năm học / HK</th>
              <th scope="col">Học phần</th>
              <th scope="col">Lớp / Ngành</th>
              <th scope="col">Giảng viên</th>
              <th scope="col">Định hướng</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className={styles.empty}>Đang tải danh sách phân công...</td></tr>
            ) : !error && rows.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>Chưa có phân công giảng dạy nào được lưu vào hệ thống.</td></tr>
            ) : !error && visibleRows.length === 0 ? (
              <tr><td colSpan={6} className={styles.empty}>Không có phân công thuộc Khoa đã chọn.</td></tr>
            ) : !error ? visibleRows.map((record, index) => (
              <tr key={record.id}>
                <td>{index + 1}</td>
                <td><strong>{record.schoolYear}</strong><small>Học kỳ {record.semester}</small></td>
                <td><strong>{record.courseName}</strong><small>{record.courseCode}</small></td>
                <td><strong>{record.classCode}</strong><small>{record.majorName || "—"}</small></td>
                <td><strong>{record.teacherName}</strong><small>{record.teacherId} · {record.department || "Chưa xác định đơn vị"}</small></td>
                <td>{trackLabel(record.trainingTrack)}</td>
              </tr>
            )) : <tr><td colSpan={6} className={styles.empty}>Không tải được danh sách phân công.</td></tr>}
          </tbody>
        </table>
      </div>
      {!loading && !error && rows.length > 0 ? (
        <p className={styles.summary}>{visibleRows.length}/{rows.length} phân công đang hiển thị · Sắp xếp HK1 trước HK2; trong mỗi học kỳ, năm học mới nhất trước</p>
      ) : null}
    </section>
  );
}
