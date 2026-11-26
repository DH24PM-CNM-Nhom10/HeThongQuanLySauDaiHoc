"use client";

import { useState, useEffect, useMemo, useCallback, type FormEvent } from "react";
import type { CatalogEntry } from "../../../shared/system-store.cjs";
import { studentStatus } from "../../../shared/student-status.cjs";
import { DB } from "../../lib/db";
import { ENTITY_SCHEMAS } from "../../lib/schemas";
import { parseVNStyleDate } from "../../lib/studentUtils";
import styles from "./StudentManagementTable.module.css";
import { studentCohort, filterStudents, expectedGraduation } from "../../../shared/student-profile.cjs";
import StudentDocuments from "./StudentDocuments";

type StudentItem = Record<string, string>;

const fields = ENTITY_SCHEMAS.students.fields;
const detailOnlyFields = new Set([
  "email",
  "soDienThoai", "diaChi", "noiSinh", "donViCongTac", "hinhThucDaoTao", "thoiGianDaoTao", "ngayDuKienTotNghiep", "ngayHetHan",
  "tenLuanVan",
  "gvHuongDan1",
  "gvHuongDan2",
  "ngayQD",
  "trangThaiLv",
  "ngayBaoVe",
  "ngayTotNghiep",
]);
const columns = fields.filter(({ key }) => !detailOnlyFields.has(key));
const statusOptions = [
  { key: "studying", label: "Đang học" },
  { key: "graduated", label: "Đã tốt nghiệp" },
  { key: "overdue", label: "Quá hạn" },
  { key: "withdrawn", label: "Xóa tên" },
  { key: "reserved", label: "Bảo lưu" },
  { key: "paused", label: "Tạm dừng" },
  { key: "left", label: "Thôi học" },
  { key: "completed", label: "Hoàn thành" },
];

const thesisFields = fields.filter(({ key }) => ["tenLuanVan", "gvHuongDan1", "gvHuongDan2", "ngayQD", "trangThaiLv", "ngayBaoVe", "ngayTotNghiep"].includes(key));
const profileFields = fields.filter((field) => !thesisFields.includes(field));
const calendarFields = new Set(["ngayNhapHoc", "ngaySinh", "ngayTotNghiep", "ngayDuKienTotNghiep", "ngayHetHan"]);

function calendarValue(raw: string) {
  const value = raw.trim();
  const serial = Number(value);
  if (/^\d{5}(?:\.\d+)?$/.test(value) && serial >= 10000 && serial < 60000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const vn = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  const iso = vn
    ? `${vn[3]}-${vn[2].padStart(2, "0")}-${vn[1].padStart(2, "0")}`
    : /^(\d{4}-\d{2}-\d{2})(?:[T ]|$)/.exec(value)?.[1] ?? "";
  const date = new Date(iso + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : "";
}

function statusChoices(current: string) {
  return (
    <>
      <option value="">Chưa cập nhật</option>
      {current && !statusOptions.some(({ label }) => label === current) && (
        <option value={current}>{current}</option>
      )}
      {statusOptions.map(({ key, label }) => <option key={key} value={label}>{label}</option>)}
    </>
  );
}

const aliases: Record<string, string[]> = {
  lop: ["class"],
  maHocVien: ["mahv", "id"],
  hoTen: ["name"],
  gioiTinh: ["gender"],
  tenNganh: ["major"],
  trinhDo: ["trinh_do_dt", "TRINH_DO_DT"],
  tenLuanVan: ["tenDeAn", "ten_de_an", "TEN_DE_AN"],
  gvHuongDan1: ["nguoi_huong_dan_1", "NGUOI_HUONG_DAN_1", "gvHuongDan"],
  gvHuongDan2: ["nguoi_huong_dan_2", "NGUOI_HUONG_DAN_2"],
  ngayQD: ["ngay_qd", "ngay_qd_luan_van_de_an", "NGAY_QD_LUAN_VAN_DE_AN"],
  trangThaiLv: ["trang_thai_luan_van_de_an", "TRANG_THAI_LUAN_VAN_DE_AN"],
  trangThai: ["status"],
  email: ["Email"],
  soDienThoai: ["dienThoai", "sdt"],
  diaChi: ["dia_chi_lien_he"],
  ngayHetHan: ["ngay_het_han_dt"],
};

function mapStudent(record: Record<string, unknown>): StudentItem {
  const student: StudentItem = {};
  for (const { key } of fields) {
    const snakeCase = key.replace(/[A-Z]/g, (letter) => "_" + letter.toLowerCase());
    const value = record[key] ?? [snakeCase, snakeCase.toUpperCase(), ...(aliases[key] ?? [])]
      .map((alias) => record[alias])
      .find((entry) => entry != null && String(entry).trim() !== "" && entry !== "-");
    const text = String(value ?? "").trim();
    const calendar = calendarFields.has(key) ? calendarValue(text) : "";
    const date = key.startsWith("ngay") && !calendarFields.has(key) && value != null ? parseVNStyleDate(value) : null;
    student[key] = calendar ? calendar.split("-").reverse().join("/") : date ? date.toLocaleDateString("vi-VN") : text;
  }
  student.khoaHoc = studentCohort(record);
  if (!student.email && student.maHocVien) student.email = `${student.maHocVien}@student.agu.edu.vn`;
  return student;
}

function statusKey(status: string) { return studentStatus({ trangThai: status }); }

function renderValue(student: StudentItem, key: string) {
  const value = student[key] || "—";
  return value;
}

export default function StudentManagementTable() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;
  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [majorFilter, setMajorFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [cohortFilter, setCohortFilter] = useState("");
  const [exporting, setExporting] = useState(false);

  const [editing, setEditing] = useState<StudentItem | null>(null);
  const [catalogs, setCatalogs] = useState<CatalogEntry[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedMajorCode, setSelectedMajorCode] = useState("");
  const [advisors, setAdvisors] = useState<string[]>([]);
  const [advisorMessage, setAdvisorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const [message, setMessage] = useState("");

  const loadStudents = useCallback(async (refreshCache = false) => {
    setLoading(true);
    try {
      const records: Record<string, unknown>[] = [];
      let totalPages = 1;
      for (let page = 1; page <= totalPages; page++) {
        const res = await fetch(`/api/students?limit=2000&page=${page}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await res.json();
        const data = Array.isArray(result) ? result : result?.data ?? result?.records;
        if (!Array.isArray(data)) throw new Error("Dữ liệu học viên không hợp lệ");
        records.push(...data);
        totalPages = result?.pagination?.totalPages ?? 1;
      }
      const catalogResponse = await fetch("/api/catalogs", { cache: "no-store" });
      if (!catalogResponse.ok) throw new Error("Không tải được danh mục đào tạo.");
      setCatalogs((await catalogResponse.json()).data);
      setStudents(records.map(mapStudent));
      setServerReady(true);
      if (refreshCache) {
        try {
          DB.set("students", records);
        } catch {
          DB.remove("students");
        }
      }
    } catch (error) {
      console.error(error);
      setServerReady(false);
      setMessage("Không tải được danh sách từ máy chủ.");
      if (!refreshCache) setStudents(DB.get("students").map(mapStudent));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStudents(); }, [loadStudents]);

  const editOpen = editing !== null;
  useEffect(() => {
    if (!editOpen) return;
    const controller = new AbortController();
    async function loadAdvisors() {
      setAdvisors([]);
      setAdvisorMessage("Đang tải danh sách giảng viên…");
      try {
        const response = await fetch("/api/students/advisors", { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok || !Array.isArray(result.data)) throw new Error(result.error);
        if (controller.signal.aborted) return;
        setAdvisors(result.data);
        setAdvisorMessage(result.data.length ? "" : "Chưa có giảng viên trong danh mục.");
      } catch {
        if (!controller.signal.aborted) setAdvisorMessage("Không tải được danh sách giảng viên. Mở lại biểu mẫu để thử lại.");
      }
    }
    void loadAdvisors();
    return () => controller.abort();
  }, [editOpen]);

  const classOptions = useMemo(() => [...new Set(catalogs.filter(row => row.kind === "class").map(row => row.code))]
    .sort((a, b) => a.localeCompare(b, "vi")), [catalogs]);
  const majorCatalog = useMemo(() => new Map(catalogs.filter(row => row.kind === "major")
    .map(row => [row.code, row.name || row.code])), [catalogs]);

  function openEditor(student: StudentItem) {
    setMessage("");
    setSelectedClass(student.lop ?? "");
    setSelectedMajorCode(student.maNganh ?? "");
    setEditing(student);
  }

  async function mutateStudent(method: "POST" | "PUT" | "DELETE", student: StudentItem) {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const url = method === "DELETE"
        ? `/api/students?id=${encodeURIComponent(student.maHocVien)}`
        : "/api/students";
      const res = await fetch(url, {
        method,
        ...(method === "DELETE" ? {} : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(student),
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Không thể lưu thay đổi.");
      setEditing(null);
      setMessage(method === "DELETE" ? "Đã xóa học viên." : "Đã lưu hồ sơ học viên.");
      await loadStudents(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu thay đổi.");
    } finally {
      setSaving(false);
    }
  }

  function saveStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const values = Object.fromEntries(
      Array.from(new FormData(event.currentTarget), ([key, value]) => [key, String(value).trim()]),
    );
    const majorName = majorCatalog.get(values.maNganh);
    if (!classOptions.includes(values.lop) || !majorName) {
      setMessage("Hãy chọn lớp và mã ngành có trong danh mục.");
      return;
    }
    values.tenNganh = majorName;
    if (!values.ngayDuKienTotNghiep && values.ngayNhapHoc && values.thoiGianDaoTao) values.ngayDuKienTotNghiep = expectedGraduation(values.ngayNhapHoc, values.thoiGianDaoTao);
    if (!editing.maHocVien) {
      void mutateStudent("POST", values);
      return;
    }
    const changes = Object.fromEntries(
      Object.entries(values).filter(([key, value]) =>
        value !== (calendarFields.has(key) ? calendarValue(editing[key] ?? "") : editing[key] ?? ""),
      ),
    );
    if (Object.keys(changes).length === 0) {
      setEditing(null);
      return;
    }
    void mutateStudent("PUT", { ...changes, maHocVien: editing.maHocVien });
  }

  function renderEditField({ key, label }: (typeof fields)[number], student: StudentItem) {
    if (["loaiChuongTrinh", "trinhDo", "khoaHoc", "hinhThucDaoTao"].includes(key)) {
      const kind = { loaiChuongTrinh: "program", trinhDo: "level", khoaHoc: "cohort", hinhThucDaoTao: "study_mode" }[key];
      const choices = catalogs.filter(row => row.kind === kind).map(row => row.code);
      return (
        <label key={key}>{label}
          <select name={key} defaultValue={student[key] ?? ""}>
            <option value="">Chọn {label.toLocaleLowerCase("vi")}</option>
            {choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
          </select>
        </label>
      );
    }
    if (key === "lop") {
      return (
        <label key={key}>{label}
          <select name={key} required value={selectedClass} onChange={event => {
            setSelectedClass(event.target.value);
            const majors = catalogs.filter(row => row.kind === "class" && row.code === event.target.value);
            setSelectedMajorCode(majors.length === 1 ? majors[0].majorCode || "" : "");
          }}>
            <option value="">Chọn lớp</option>
            {classOptions.map((className) => <option key={className} value={className}>{className}</option>)}
          </select>
        </label>
      );
    }
    if (key === "maNganh") {
      return (
        <label key={key}>{label}
          <select name={key} required value={selectedMajorCode} onChange={(event) => setSelectedMajorCode(event.target.value)}>
            <option value="">Chọn mã ngành</option>
            {[...majorCatalog.keys()].filter(code => !selectedClass || catalogs.some(row => row.kind === "class" && row.code === selectedClass && row.majorCode === code)).map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
      );
    }
    if (key === "tenNganh") {
      return (
        <label key={key}>{label}
          <input name={key} value={majorCatalog.get(selectedMajorCode) ?? ""} readOnly />
        </label>
      );
    }
    if (key === "gioiTinh" || key === "gvHuongDan1" || key === "gvHuongDan2") {
      const isGender = key === "gioiTinh";
      const choices = isGender ? ["Nam", "Nữ"] : advisors;
      const current = student[key] ?? "";
      return (
        <label key={key}>{label}
          <select name={key} defaultValue={current} required={isGender}>
            <option value="">{isGender ? "Chọn giới tính" : "Chọn giảng viên"}</option>
            {!isGender && current && (
              <option value={current}>{current}{choices.includes(current) ? "" : " (đã lưu)"}</option>
            )}
            {choices.filter((choice) => isGender || choice !== current).map((choice) => (
              <option key={choice} value={choice}>{choice}</option>
            ))}
          </select>
        </label>
      );
    }
    return (
      <label key={key}>
        {label}
        {key === "trangThai" ? (
          <select name={key} defaultValue={student[key] ?? ""}>
            {statusChoices(student[key] ?? "")}
          </select>
        ) : (
          <input
            name={key}
            type={calendarFields.has(key) ? "date" : key === "thoiGianDaoTao" ? "number" : key === "email" ? "email" : key === "soDienThoai" ? "tel" : "text"}
            min={key === "thoiGianDaoTao" ? 1 : undefined}
            max={key === "thoiGianDaoTao" ? 600 : undefined}
            defaultValue={calendarFields.has(key) ? calendarValue(student[key] ?? "") : student[key] ?? ""}
            required={key === "maHocVien" || key === "hoTen"}
            readOnly={key === "maHocVien" && Boolean(student.maHocVien)}
          />
        )}
        {calendarFields.has(key) && /^\d{4}$/.test(student[key] ?? "") && (
          <small className={styles.fieldNote}>Dữ liệu hiện tại chỉ có năm {student[key]}.</small>
        )}
      </label>
    );
  }

  const majors = useMemo(() => studentOptions(students, "tenNganh"), [students]);
  const studentsInMajor = useMemo(
    () => majorFilter ? students.filter((student) => student.tenNganh.trim() === majorFilter) : students,
    [majorFilter, students],
  );
  const classes = useMemo(() => studentOptions(studentsInMajor, "lop"), [studentsInMajor]);
  const cohorts = [...new Set(students.map(studentCohort).filter(Boolean))].sort().reverse();
  const filteredData = filterStudents(students, { search: searchTerm, major: majorFilter, cohort: cohortFilter, classCode: classFilter, status: statusFilter });
  async function exportStudents() {
    setExporting(true);
    try {
      const query = new URLSearchParams({ entity: 'students', search: searchTerm, major: majorFilter, cohort: cohortFilter, class: classFilter, status: statusFilter });
      const response = await fetch('/api/export?' + query);
      if (!response.ok) throw new Error((await response.json()).error || 'Không xuất được danh sách.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = 'danh_sach_hoc_vien.xlsx'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không xuất được danh sách.'); }
    finally { setExporting(false); }
  }
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const visiblePage = Math.min(currentPage, totalPages);
  const start = (visiblePage - 1) * pageSize;
  const pageStudents = filteredData.slice(start, start + pageSize);

  return (
    <section className={styles.management}>
      <header className={styles.toolbar}>
        <h2>Quản lý học viên</h2>
        <div className={styles.actions}>
          <button type="button" className={styles.uploadButton} disabled={exporting || !serverReady || !filteredData.length} onClick={() => void exportStudents()}>{exporting ? 'Đang xuất...' : 'Xuất Excel theo bộ lọc'}</button>
          <button type="button" className={styles.addButton} disabled={loading || saving || !serverReady} onClick={() => {
            const matchingCodes = [...majorCatalog].filter(([, name]) => name === majorFilter);
            openEditor({ lop: classFilter, maNganh: matchingCodes.length === 1 ? matchingCodes[0][0] : "", trangThai: "Đang học" });
          }}>Thêm học viên</button>

        </div>
      </header>

      <div className={styles.scopeFilters}>
        <label>Khóa đào tạo<select value={cohortFilter} onChange={event => { setCohortFilter(event.target.value); setCurrentPage(1); }}><option value="">Tất cả khóa</option>{cohorts.map(cohort => <option key={cohort}>{cohort}</option>)}</select></label>
        <input
          type="text"
          aria-label="Tìm học viên"
          placeholder="Tìm theo tên, mã học viên hoặc lớp"
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setCurrentPage(1);
          }}
        />
        <select
          aria-label="Lọc theo trạng thái"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="ALL">Tất cả trạng thái</option>
          {statusOptions.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
        </select>
        <label>
          Ngành
          <select value={majorFilter} onChange={(event) => {
            setMajorFilter(event.target.value);
            setClassFilter("");
            setCurrentPage(1);
          }}>
            <option value="">Tất cả ngành</option>
            {majors.map((major) => <option key={major}>{major}</option>)}
          </select>
        </label>
        <label>
          Lớp
          <select value={classFilter} onChange={(event) => {
            setClassFilter(event.target.value);
            setCurrentPage(1);
          }}>
            <option value="">Tất cả lớp</option>
            {classes.map((className) => <option key={className}>{className}</option>)}
          </select>
        </label>
        {!loading && <p role="status">{filteredData.length} / {students.length} học viên</p>}
      </div>

      <div className={styles.sheet} tabIndex={0} role="region" aria-label="Bảng danh sách học viên">
        <table data-grid="excel" className={"excel-grid " + (styles.table)}>
          <thead>
            <tr>
              <th scope="col">STT</th>
              {columns.map(({ key, label }) => <th scope="col" key={key}>{label}</th>)}
              <th scope="col" className={styles.actionHeading}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pageStudents.map((student, index) => (
              <tr key={start + index}>
                <td>{start + index + 1}</td>
                {columns.map(({ key }) => (
                  <td key={key}>
                    {renderValue(student, key)}
                  </td>
                ))}
                <td className={styles.actionCell}>
                  <div className={styles.rowActions}>
                    <button type="button" className={styles.detailButton} onClick={() => setSelectedStudent(student)}>Chi tiết</button>
                    <button type="button" className={styles.editButton} disabled={!student.maHocVien || saving || !serverReady} onClick={() => {
                      openEditor(student);
                    }}>Sửa</button>
                    <button type="button" className={styles.deleteButton} disabled={!student.maHocVien || saving || !serverReady} onClick={() => {
                      if (window.confirm(`Xóa học viên ${student.hoTen} (${student.maHocVien})?`)) {
                        void mutateStudent("DELETE", student);
                      }
                    }}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
            {pageStudents.length === 0 && (
              <tr><td colSpan={columns.length + 2} role="status">
                {loading ? "Đang tải danh sách học viên..." : "Không tìm thấy học viên phù hợp."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className={styles.pagination}>
        <span>Trang {visiblePage} / {totalPages}</span>
        <button type="button" disabled={visiblePage <= 1} onClick={() => setCurrentPage(visiblePage - 1)}>Trang trước</button>
        <button type="button" disabled={visiblePage >= totalPages} onClick={() => setCurrentPage(visiblePage + 1)}>Trang sau</button>
      </footer>

      {editing && (
        <div className={styles.backdrop}>
          <form className={styles.details} role="dialog" aria-modal="true" aria-labelledby="student-edit-title" onSubmit={saveStudent}>
            <header className={styles.toolbar}>
              <h2 id="student-edit-title">{editing.maHocVien ? "Sửa học viên" : "Thêm học viên"}</h2>
              <button type="button" disabled={saving} onClick={() => { setEditing(null); setMessage(""); }}>Đóng</button>
            </header>
            <div className={styles.editFields}>
              {profileFields.map((field) => renderEditField(field, editing))}
            </div>
            <details className={styles.editSection}>
              <summary>Luận văn và tốt nghiệp</summary>
              {advisorMessage && <p className={styles.feedback} role="status">{advisorMessage}</p>}
              <div className={styles.editFields}>
                {thesisFields.map((field) => renderEditField(field, editing))}
              </div>
            </details>
            {message && <p role="alert">{message}</p>}
            <footer className={styles.pagination}>
              <button type="submit" className={styles.addButton} disabled={saving}>{saving ? "Đang lưu..." : "Lưu học viên"}</button>
            </footer>
          </form>
        </div>
      )}

      {selectedStudent && (
        <div className={styles.backdrop}>
          <section className={styles.details} role="dialog" aria-modal="true" aria-labelledby="student-details-title">
            <header className={styles.toolbar}>
              <h2 id="student-details-title">Thông tin học viên</h2>
              <div className={styles.actions}>
                <button type="button" className={styles.editButton}
                  disabled={!selectedStudent.maHocVien || saving || !serverReady}
                  onClick={() => {
                    openEditor(selectedStudent);
                    setSelectedStudent(null);
                  }}>Sửa hồ sơ</button>
                <button type="button" onClick={() => setSelectedStudent(null)}>Đóng</button>
              </div>
            </header>
            <dl>
              {fields.map(({ key, label }) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{renderValue(selectedStudent, key)}</dd>
                </div>
              ))}
            </dl>
            <StudentDocuments studentCode={selectedStudent.maHocVien} />
          </section>
        </div>
      )}
    </section>
  );
}

function studentOptions(students: StudentItem[], field: "tenNganh" | "lop" | "loaiChuongTrinh" | "trinhDo") {
  const options = new Set(students.map((student) => student[field].trim()).filter(Boolean));
  return [...options].sort((a, b) => a.localeCompare(b, "vi", { numeric: true }));
}
