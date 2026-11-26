"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { validMark, numericMark, parseGradeImport, type Marks } from "../../lib/grade-import";
import styles from "./TeacherGradebook.module.css";

type Assignment = {
  id: string; teacherId: string; courseCode: string; courseName: string;
  classCode: string; schoolYear: string; semester: string;
  trainingTrack?: "nghien_cuu" | "ung_dung";
};
type StudentRow = {
  maHocVien: string; hoTen: string; lop: string;
  processScore: number | null; examScore: number | null;
  totalScore: number | null; letterGrade: string | null;
  legacyScore?: number | null; updatedAt?: string;
};
type GradePolicy = {
  id: string; description: string; processWeight: number; examWeight: number;
  thresholds: { min: number; letter: string }[];
};
type Gradebook = {
  success?: boolean; assignment: Assignment; students: StudentRow[];
  revision: number; status: "draft" | "pending" | "published"; gradingPolicy: GradePolicy; updatedAt?: string | null; message?: string | string[];
};
function gradePreview(marks: Marks, policy: GradePolicy | null) {
  const process = numericMark(marks.process);
  const exam = numericMark(marks.exam);
  if (process === null || exam === null || !policy) return { total: null as number | null, letter: "—" };
  const total = Math.round((process * policy.processWeight + exam * policy.examWeight + Number.EPSILON) * 100) / 100;
  return { total, letter: policy.thresholds.find(t => total >= t.min)?.letter ?? "F" };
}
const safeCell = (value: unknown) => {
  const text = String(value ?? "");
  return /^[\s]*[=+@\-]/.test(text) ? `'${text}` : text;
};

/** Giảng viên nhập và gửi duyệt điểm ngay trong mục Bảng điểm của cổng thông tin. */
export default function TeacherGradebook({ readOnly = false }: { readOnly?: boolean }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [values, setValues] = useState<Record<string, Marks>>({});
  const [policy, setPolicy] = useState<GradePolicy | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [revision, setRevision] = useState(0);
  const [bookStatus, setBookStatus] = useState("draft");
  const [dirty, setDirty] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const assignmentRef = useRef(assignmentId);
  assignmentRef.current = assignmentId;
  const [importing, setImporting] = useState(false);
  const [importSource, setImportSource] = useState<{
    assignmentId: string; name: string; sheets: { name: string; rows: unknown[][] }[];
  } | null>(null);
  const [importSheet, setImportSheet] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/teacher-auth/assignments", { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Không tải được phân công. Hãy kiểm tra phiên giảng viên và Backend.");
        const result: { data?: Assignment[] } = await response.json();
        if (controller.signal.aborted) return;
        const list = Array.isArray(result.data) ? result.data : [];
        setAssignments(list);
        if (list.length) { setCourseCode(list[0].courseCode); setAssignmentId(list[0].id); }
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Không tải được phân công");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, []);

  const courses = useMemo(() => {
    const byCourse = new Map<string, { code: string; name: string; classes: number }>();
    for (const row of assignments) {
      const old = byCourse.get(row.courseCode);
      if (old) old.classes += 1;
      else byCourse.set(row.courseCode, { code: row.courseCode, name: row.courseName, classes: 1 });
    }
    return [...byCourse.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [assignments]);
  const classesForCourse = useMemo(() => assignments.filter(row => row.courseCode === courseCode), [assignments, courseCode]);
  const selected = assignments.find(row => row.id === assignmentId);
  const hasInvalid = students.some(row => {
    const marks = values[row.maHocVien] || { process: "", exam: "" };
    return !validMark(marks.process) || !validMark(marks.exam);
  });
  const completeCount = students.filter(row => gradePreview(values[row.maHocVien] || { process: "", exam: "" }, policy).total !== null).length;


  function moveScoreCell(event: KeyboardEvent<HTMLInputElement>, row: number, column: number) {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const input = event.currentTarget;
    let nextRow = row;
    let nextColumn = column;
    switch (event.key) {
      case "Enter":
        nextRow += event.shiftKey ? -1 : 1;
        break;
      case "ArrowUp":
        nextRow--;
        break;
      case "ArrowDown":
        nextRow++;
        break;
      case "ArrowLeft":
        if (input.selectionStart !== 0 || input.selectionEnd !== 0) return;
        nextColumn--;
        break;
      case "ArrowRight":
        if (input.selectionStart !== input.value.length || input.selectionEnd !== input.value.length) return;
        nextColumn++;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = input.closest("table")?.querySelector<HTMLInputElement>(
      `input[data-score-row="${nextRow}"][data-score-column="${nextColumn}"]:not(:disabled)`,
    );
    next?.focus();
    next?.select();
  }

  const allowLeave = () => readOnly || !dirty || window.confirm("Có điểm chưa lưu. Bạn có muốn bỏ thay đổi để chuyển mục?");
  const chooseCourse = (code: string) => {
    if (importing || saving || code === courseCode || !allowLeave()) return;
    setImportSource(null);
    const first = assignments.find(row => row.courseCode === code);
    setCourseCode(code); setAssignmentId(first?.id || ""); setDirty(false); setMessage("");
  };
  const chooseClass = (id: string) => {
    if (importing || saving || id === assignmentId || !allowLeave()) return;
    setImportSource(null);
    setAssignmentId(id); setDirty(false); setMessage("");
  };

  useEffect(() => {
    if (!assignmentId) { setStudents([]); setValues({}); setPolicy(null); return; }
    const controller = new AbortController();
    setRosterLoading(true); setRosterError(""); setStudents([]); setValues({}); setPolicy(null);
    void (async () => {
      try {
        const response = await fetch(`/api/teacher-auth/gradebook/${encodeURIComponent(assignmentId)}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const body: Gradebook = await response.json();
        if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(", ") : body.message || "Không tải được bảng điểm");
        if (controller.signal.aborted) return;
        setRevision(body.revision);
        setBookStatus(body.status);
        setStudents(body.students || []);
        setPolicy(body.gradingPolicy || null);
        setValues(Object.fromEntries((body.students || []).map(row => [row.maHocVien, {
          process: row.processScore == null ? "" : String(row.processScore),
          exam: row.examScore == null ? "" : String(row.examScore),
        }])));
        setDirty(false);
      } catch (error) {
        if (!controller.signal.aborted) setRosterError(error instanceof Error ? error.message : "Không tải được bảng điểm");
      } finally { if (!controller.signal.aborted) setRosterLoading(false); }
    })();
    return () => controller.abort();
  }, [assignmentId]);

  const save = async () => {
    if (bookStatus !== "draft" || readOnly || !selected || saving || importing || importSource || rosterLoading || hasInvalid || !students.length || !policy) return;
    setSaving(true); setMessage("");
    try {
      const scores = students.map(row => ({ maHocVien: row.maHocVien,
        processScore: numericMark(values[row.maHocVien]?.process || ""),
        examScore: numericMark(values[row.maHocVien]?.exam || ""),
      }));
      const response = await fetch(`/api/teacher-auth/gradebook/${encodeURIComponent(selected.id)}`, {
        method: "PUT", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores, revision }),
      });
      const body: { success?: boolean; message?: string | string[]; updatedAt?: string; revision?: number; status?: string } = await response.json();
      if (!response.ok || !body.success) throw new Error(Array.isArray(body.message) ? body.message.join(", ") : body.message || "Không lưu được bảng điểm");
      setRevision(body.revision ?? revision);
      setBookStatus(body.status ?? "draft");
      setDirty(false);
      setMessage("Đã lưu bảng điểm thành công.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Có lỗi khi lưu điểm"); }
    finally { setSaving(false); }
  };

  const submit = async () => {
    if (!selected || saving || importing || importSource || dirty) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/teacher-auth/gradebook/${encodeURIComponent(selected.id)}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Không gửi được bảng điểm.");
      setRevision(result.revision);
      setBookStatus(result.status);
      setMessage("Đã gửi bảng điểm để xét duyệt.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không gửi được bảng điểm.");
    } finally { setSaving(false); }
  };

  const importPreview = useMemo(() => {
    const sheet = importSource?.sheets.find(row => row.name === importSheet);
    if (!sheet || !selected || importSource?.assignmentId !== assignmentId) return null;
    try {
      return { result: parseGradeImport(sheet.rows, {
        codes: students.map(student => student.maHocVien),
        assignmentId, courseCode: selected.courseCode, classCode: selected.classCode,
      }), error: "" };
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : "Không đọc được điểm trong file." };
    }
  }, [importSource, importSheet, assignmentId, selected, students]);

  async function readExcel(file: File) {
    if (readOnly || bookStatus !== "draft" || importing || saving || rosterLoading || !students.length) return;
    const target = assignmentId;
    setImporting(true);
    setImportSource(null);
    setMessage("");
    try {
      const XLSX = await import("xlsx");
      const workbook = /\.csv$/i.test(file.name)
        ? XLSX.read(await file.text(), { type: "string", codepage: 65001, raw: true })
        : XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheets = workbook.SheetNames.map(name => ({
        name, rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
          header: 1, defval: null, blankrows: true, raw: true,
        }),
      }));
      if (!sheets.length) throw new Error("File chưa có trang tính.");
      if (assignmentRef.current !== target) return;
      setImportSheet(sheets[0].name);
      setImportSource({ assignmentId: target, name: file.name, sheets });
    } catch (error) {
      if (assignmentRef.current === target) setMessage(error instanceof Error ? error.message : "Không đọc được file Excel.");
    } finally { setImporting(false); }
  }

  function applyExcel() {
    if (!importPreview?.result || importSource?.assignmentId !== assignmentId ||
        saving || bookStatus !== "draft" || readOnly) return;
    const { changes, skipped } = importPreview.result;
    const changed = changes.filter(row => {
      const previous = values[row.code] || { process: "", exam: "" };
      return (row.process !== undefined && numericMark(previous.process) !== numericMark(row.process)) ||
        (row.exam !== undefined && numericMark(previous.exam) !== numericMark(row.exam));
    });
    setValues(previous => {
      const next = { ...previous };
      for (const row of changes) {
        const { code, ...marks } = row;
        next[code] = { process: "", exam: "", ...previous[code], ...marks };
      }
      return next;
    });
    if (changed.length) setDirty(true);
    setImportSource(null);
    setMessage(`Đã cập nhật điểm của ${changed.length} học viên vào lưới. Bỏ qua ${skipped} dòng ngoài danh sách lớp.`);
  }

  const exportExcel = async () => {
    if (!selected || !students.length || exporting) return;
    if (dirty && !window.confirm("Bảng điểm có thay đổi chưa lưu. Xuất Excel theo nội dung đang hiển thị?")) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const rows = students.map((s, i) => {
        const marks = values[s.maHocVien] || { process: "", exam: "" };
        const grade = gradePreview(marks, policy);
        return {
          STT: i + 1, "Mã học viên": safeCell(s.maHocVien), "Họ và tên": safeCell(s.hoTen),
          "Điểm quá trình": numericMark(marks.process), "Điểm thi kết thúc": numericMark(marks.exam),
          "Điểm tổng kết (tạm tính)": grade.total ?? s.legacyScore ?? "",
          "Điểm chữ (tham khảo)": grade.total === null ? "" : grade.letter,
        };
      });
      const sheet = XLSX.utils.json_to_sheet(rows);
      const notes = [["Mã phân công", selected.id], ["Học phần", safeCell(selected.courseName)], ["Mã học phần", safeCell(selected.courseCode)], ["Lớp", safeCell(selected.classCode)],
        ["Năm học / HK", `${selected.schoolYear} - HK${selected.semester}`],
        ["Chú ý", policy?.description || "Chưa có quy tắc tính điểm"],
        ["Trạng thái", bookStatus === "published" ? "Đã công bố và khóa" : bookStatus === "pending" ? "Đang chờ duyệt" : "Bản nháp / chưa công bố"], []];
      XLSX.utils.sheet_add_aoa(sheet, notes, { origin: `A${rows.length + 4}` });
      sheet["!cols"] = [{ wch: 7 }, { wch: 18 }, { wch: 28 }, { wch: 20 }, { wch: 22 }, { wch: 27 }, { wch: 22 }];
      const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, "Bang diem");
      const safe = (t: string) => t.replace(/[^A-Za-z0-9_-]/g, "_");
      XLSX.writeFile(book, `Bang_diem_${safe(selected.courseCode)}_${safe(selected.classCode)}_${safe(selected.schoolYear)}_HK${safe(selected.semester)}.xlsx`);
    } catch (error) { setMessage(error instanceof Error ? `Không xuất được Excel: ${error.message}` : "Không xuất được Excel"); }
    finally { setExporting(false); }
  };

  return <div className={`${styles.page} ${readOnly ? styles.readOnlyPage : ""}`}>
    <div className={styles.topBar}>
      <div className={styles.selectGroup}>
        <label htmlFor={readOnly ? "view-course" : "edit-course"}>Học phần được phân công</label>
        <select id={readOnly ? "view-course" : "edit-course"} value={courseCode} onChange={e => chooseCourse(e.target.value)} disabled={!courses.length || saving || importing}>
          {!courses.length && <option value="">Chưa có học phần</option>}
          {courses.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name} ({c.classes} lớp)</option>)}
        </select>
      </div>
      <div className={styles.selectGroup}>
        <label htmlFor={readOnly ? "view-class" : "edit-class"}>Lớp được phân công</label>
        <select id={readOnly ? "view-class" : "edit-class"} value={assignmentId} onChange={e => chooseClass(e.target.value)} disabled={!selected || saving || importing || rosterLoading}>
          {classesForCourse.map(row => <option key={row.id} value={row.id}>{row.classCode} · {row.schoolYear} · HK{row.semester}</option>)}
        </select>
      </div>
      {readOnly && <span className={styles.readOnlyTag}>Chỉ xem</span>}
    </div>
    {loading && <div className={styles.notice}>Đang tải học phần được phân công...</div>}
    {loadError && <div role="alert" className={styles.error}>{loadError}</div>}
    {!loading && !loadError && assignments.length === 0 && <div className={styles.notice}>Chưa có phân công chính thức cho tài khoản này.</div>}
    {!loading && !loadError && selected && <section className={styles.mainPanel}>
      <div className={styles.classInfo}>
        <h2>{selected.courseName}</h2>
        <div className={styles.gradeActions}>
          {!readOnly && <>
            <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" hidden
              aria-label="Chọn file nhập điểm Excel"
              onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void readExcel(file);
              }} />
            <button type="button" className={styles.importButton}
              disabled={importing || saving || rosterLoading || !students.length || bookStatus !== "draft"}
              onClick={() => fileInput.current?.click()}>{importing ? "Đang đọc Excel..." : "Nhập điểm Excel"}</button>
          </>}
          <button type="button" className={styles.exportButton} disabled={!students.length || exporting || rosterLoading} onClick={() => void exportExcel()}>{exporting ? "Đang xuất..." : "Xuất Excel (.xlsx)"}</button>
        </div>
      </div>
      {rosterLoading && <p className={styles.notice}>Đang tải danh sách học viên...</p>}
      {rosterError && <p className={styles.error} role="alert">{rosterError}</p>}
      {!rosterLoading && !rosterError && <>
        {importSource && <section className={styles.importPanel} aria-label="Xem trước điểm Excel">
          <div className={styles.gradeActions}>
            <strong>{importSource.name}</strong>
            <label>Trang tính <select value={importSheet} onChange={event => setImportSheet(event.target.value)}>
              {importSource.sheets.map(sheet => <option key={sheet.name}>{sheet.name}</option>)}
            </select></label>
          </div>
          <p>Ghép theo mã học viên. Ô điểm trống trong Excel sẽ giữ điểm đang có.</p>
          {importPreview?.error && <p role="alert" className={styles.error}>{importPreview.error}</p>}
          {importPreview?.result && <p role="status">Có {importPreview.result.changes.length} học viên khớp lớp. Bỏ qua {importPreview.result.skipped} dòng ngoài danh sách.</p>}
          <div className={styles.gradeActions}>
            <button type="button" className={styles.importButton} disabled={!importPreview?.result || saving}
              onClick={applyExcel}>Áp dụng vào lưới</button>
            <button type="button" className={styles.exportButton} onClick={() => setImportSource(null)}>Hủy nhập</button>
          </div>
        </section>}
        {!readOnly && bookStatus === "draft" && <p className={styles.sheetHint}>Nhập điểm vào ô. Tab chuyển ô tiếp theo, Enter xuống dòng, Shift + Enter lên dòng.</p>}
        <div className={`${styles.tableScroll} ${styles.spreadsheet}`}>
          <table className={styles.table} aria-label="Bảng nhập điểm học viên">
            <colgroup>
              <col style={{ width: 48 }} /><col style={{ width: 140 }} /><col style={{ width: 220 }} />
              <col /><col /><col /><col style={{ width: 90 }} />
            </colgroup>
            <thead><tr>
            <th scope="col">STT</th><th scope="col">Mã học viên</th><th scope="col">Họ và tên</th><th scope="col">Điểm quá trình</th><th scope="col">Thi kết thúc</th><th scope="col">Tổng kết (10)</th><th scope="col">Điểm chữ</th>
          </tr></thead><tbody>
            {students.map((student, index) => {
              const marks = values[student.maHocVien] || { process: "", exam: "" };
              const result = gradePreview(marks, policy);
              return <tr key={student.maHocVien}>
                <td>{index + 1}</td><td>{student.maHocVien}</td><td><strong>{student.hoTen}</strong></td>
                <td className={styles.scoreCell}>{readOnly ? <span>{marks.process || "—"}</span> : <input aria-label={`Điểm quá trình ${student.hoTen}`} aria-invalid={!validMark(marks.process)} className={`${styles.scoreInput} ${!validMark(marks.process) ? styles.invalid : ""}`}
                  type="text" inputMode="decimal" autoComplete="off" data-score-row={index} data-score-column={0}
                  onKeyDown={event => moveScoreCell(event, index, 0)} placeholder="—" value={marks.process}
                  disabled={saving || bookStatus !== "draft"} onChange={e => { setValues(old => ({ ...old, [student.maHocVien]: { ...marks, process: e.target.value } })); setDirty(true); setMessage(""); }} />}</td>
                <td className={styles.scoreCell}>{readOnly ? <span>{marks.exam || "—"}</span> : <input aria-label={`Điểm thi ${student.hoTen}`} aria-invalid={!validMark(marks.exam)} className={`${styles.scoreInput} ${!validMark(marks.exam) ? styles.invalid : ""}`}
                  type="text" inputMode="decimal" autoComplete="off" data-score-row={index} data-score-column={1}
                  onKeyDown={event => moveScoreCell(event, index, 1)} placeholder="—" value={marks.exam}
                  disabled={saving || bookStatus !== "draft"} onChange={e => { setValues(old => ({ ...old, [student.maHocVien]: { ...marks, exam: e.target.value } })); setDirty(true); setMessage(""); }} />}</td>
                <td className={styles.strongValue}>{result.total === null ? (student.legacyScore ?? "—") : result.total.toFixed(2)}{result.total === null && student.legacyScore != null && <small>Điểm cũ</small>}</td>
                <td>{result.total === null ? "—" : <span className={styles.letter}>{result.letter}</span>}</td>
              </tr>;
            })}
          </tbody></table>
        </div>
        {students.length === 0 && <p className={styles.notice}>Lớp này chưa có học viên thạc sĩ hợp lệ trong dữ liệu.</p>}
        <p className={styles.notice}>Trạng thái bảng điểm: {bookStatus === "published" ? "Đã công bố và khóa" : bookStatus === "pending" ? "Đang chờ duyệt" : "Bản nháp"}</p>
        {!readOnly && (
          <div className={styles.footer}>
            <button type="button" disabled={bookStatus !== "draft" || !dirty || saving || importing || Boolean(importSource) || rosterLoading || hasInvalid || !students.length} onClick={() => void save()}>{saving ? "Đang lưu..." : "Lưu bảng điểm"}</button>
            <button type="button" disabled={bookStatus !== "draft" || dirty || saving || importing || Boolean(importSource) || !students.length || completeCount !== students.length} onClick={() => void submit()}>Gửi duyệt</button>
          </div>
        )}
        {hasInvalid && !readOnly && <p className={styles.error} role="alert">Điểm từ 0–10, tối đa hai chữ số thập phân.</p>}
        {message && <p className={message.startsWith("Đã") ? styles.success : styles.error} role="status">{message}</p>}
      </>}
    </section>}
  </div>;
}
