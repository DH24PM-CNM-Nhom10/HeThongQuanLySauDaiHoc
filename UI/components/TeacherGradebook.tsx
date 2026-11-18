"use client";

import { useEffect, useMemo, useState } from "react";
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
  gradingPolicy: GradePolicy; updatedAt?: string | null; message?: string | string[];
};
type Marks = { process: string; exam: string };

function validMark(value: string) {
  const raw = value.trim().replace(",", ".");
  return raw === "" || /^(?:10(?:\.0{1,2})?|[0-9](?:\.[0-9]{1,2})?)$/.test(raw);
}
function numericMark(value: string) {
  const raw = value.trim().replace(",", ".");
  return raw === "" || !validMark(raw) ? null : Number(raw);
}
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
const trackLabel = (track?: string) => track === "nghien_cuu" ? "Nghiên cứu" : track === "ung_dung" ? "Ứng dụng" : "Chưa xác định";

/** readOnly: dùng trên Cổng thông tin; chế độ chỉnh sửa: chỉ trong trang quản trị giảng viên */
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
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

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
  const specialCourse = !!selected && /luận văn|đề án tốt nghiệp|thực tập/i.test(selected.courseName);

  const allowLeave = () => readOnly || !dirty || window.confirm("Có điểm chưa lưu. Bạn có muốn bỏ thay đổi để chuyển mục?");
  const chooseCourse = (code: string) => {
    if (code === courseCode || !allowLeave()) return;
    const first = assignments.find(row => row.courseCode === code);
    setCourseCode(code); setAssignmentId(first?.id || ""); setDirty(false); setMessage("");
  };
  const chooseClass = (id: string) => {
    if (id === assignmentId || !allowLeave()) return;
    setAssignmentId(id); setDirty(false); setMessage("");
  };

  useEffect(() => {
    if (!assignmentId) { setStudents([]); setValues({}); setPolicy(null); return; }
    const controller = new AbortController();
    setRosterLoading(true); setRosterError(""); setStudents([]); setValues({}); setLastSaved(null); setPolicy(null);
    void (async () => {
      try {
        const response = await fetch(`/api/teacher-auth/gradebook/${encodeURIComponent(assignmentId)}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const body: Gradebook = await response.json();
        if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(", ") : body.message || "Không tải được bảng điểm");
        if (controller.signal.aborted) return;
        setStudents(body.students || []);
        setPolicy(body.gradingPolicy || null);
        setValues(Object.fromEntries((body.students || []).map(row => [row.maHocVien, {
          process: row.processScore == null ? "" : String(row.processScore),
          exam: row.examScore == null ? "" : String(row.examScore),
        }])));
        setLastSaved(body.updatedAt || null); setDirty(false);
      } catch (error) {
        if (!controller.signal.aborted) setRosterError(error instanceof Error ? error.message : "Không tải được bảng điểm");
      } finally { if (!controller.signal.aborted) setRosterLoading(false); }
    })();
    return () => controller.abort();
  }, [assignmentId]);

  const save = async () => {
    if (readOnly || !selected || saving || rosterLoading || hasInvalid || !students.length || !policy) return;
    setSaving(true); setMessage("");
    try {
      const scores = students.map(row => ({ maHocVien: row.maHocVien,
        processScore: numericMark(values[row.maHocVien]?.process || ""),
        examScore: numericMark(values[row.maHocVien]?.exam || ""),
      }));
      const response = await fetch(`/api/teacher-auth/gradebook/${encodeURIComponent(selected.id)}`, {
        method: "PUT", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scores }),
      });
      const body: { success?: boolean; message?: string | string[]; updatedAt?: string } = await response.json();
      if (!response.ok || !body.success) throw new Error(Array.isArray(body.message) ? body.message.join(", ") : body.message || "Không lưu được bảng điểm");
      setDirty(false); setLastSaved(body.updatedAt || null);
      setMessage("Đã lưu bảng điểm thành công.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Có lỗi khi lưu điểm"); }
    finally { setSaving(false); }
  };

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
      const notes = [["Học phần", safeCell(selected.courseName)], ["Mã học phần", safeCell(selected.courseCode)], ["Lớp", safeCell(selected.classCode)],
        ["Năm học / HK", `${selected.schoolYear} - HK${selected.semester}`],
        ["Chú ý", policy?.description || "Chưa có quy tắc tính điểm"],
        ["Trạng thái", "Dữ liệu thử nghiệm / chưa công bố"], []];
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
        <select id={readOnly ? "view-course" : "edit-course"} value={courseCode} onChange={e => chooseCourse(e.target.value)} disabled={!courses.length || saving}>
          {!courses.length && <option value="">Chưa có học phần</option>}
          {courses.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name} ({c.classes} lớp)</option>)}
        </select>
      </div>
      <div className={styles.selectGroup}>
        <label htmlFor={readOnly ? "view-class" : "edit-class"}>Lớp được phân công</label>
        <select id={readOnly ? "view-class" : "edit-class"} value={assignmentId} onChange={e => chooseClass(e.target.value)} disabled={!selected || saving || rosterLoading}>
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
        <div><h2>{selected.courseName}</h2><p>{selected.courseCode} · {selected.schoolYear} · HK{selected.semester} · {trackLabel(selected.trainingTrack)} · {selected.classCode}</p></div>
        <button type="button" className={styles.exportButton} disabled={!students.length || exporting || rosterLoading} onClick={() => void exportExcel()}>{exporting ? "Đang xuất..." : "Xuất Excel (.xlsx)"}</button>
      </div>
      {rosterLoading && <p className={styles.notice}>Đang tải danh sách học viên...</p>}
      {rosterError && <p className={styles.error} role="alert">{rosterError}</p>}
      {!rosterLoading && !rosterError && <>
        <div className={styles.stats}>
          <span><b>{students.length}</b> học viên</span>
          <span><b>{completeCount}</b> đủ hai điểm thành phần</span>
          <span>{dirty && !readOnly ? "● Chưa lưu thay đổi" : lastSaved ? `Lưu gần nhất: ${new Date(lastSaved).toLocaleString("vi-VN")}` : "Chưa có điểm được lưu"}</span>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}><thead><tr>
            <th>STT</th><th>Mã học viên</th><th>Họ và tên</th><th>Điểm quá trình</th><th>Thi kết thúc</th><th>Tổng kết (10)</th><th>Điểm chữ</th>
          </tr></thead><tbody>
            {students.map((student, index) => {
              const marks = values[student.maHocVien] || { process: "", exam: "" };
              const result = gradePreview(marks, policy);
              return <tr key={student.maHocVien}>
                <td>{index + 1}</td><td>{student.maHocVien}</td><td><strong>{student.hoTen}</strong></td>
                <td>{readOnly ? <span>{marks.process || "—"}</span> : <input aria-label={`Điểm quá trình ${student.hoTen}`} className={`${styles.scoreInput} ${!validMark(marks.process) ? styles.invalid : ""}`}
                  type="number" min="0" max="10" step="0.01" inputMode="decimal" placeholder="—" value={marks.process}
                  disabled={saving} onChange={e => { setValues(old => ({ ...old, [student.maHocVien]: { ...marks, process: e.target.value } })); setDirty(true); setMessage(""); }} />}</td>
                <td>{readOnly ? <span>{marks.exam || "—"}</span> : <input aria-label={`Điểm thi ${student.hoTen}`} className={`${styles.scoreInput} ${!validMark(marks.exam) ? styles.invalid : ""}`}
                  type="number" min="0" max="10" step="0.01" inputMode="decimal" placeholder="—" value={marks.exam}
                  disabled={saving} onChange={e => { setValues(old => ({ ...old, [student.maHocVien]: { ...marks, exam: e.target.value } })); setDirty(true); setMessage(""); }} />}</td>
                <td className={styles.strongValue}>{result.total === null ? (student.legacyScore ?? "—") : result.total.toFixed(2)}{result.total === null && student.legacyScore != null && <small>Điểm cũ</small>}</td>
                <td>{result.total === null ? "—" : <span className={styles.letter}>{result.letter}</span>}</td>
              </tr>;
            })}
          </tbody></table>
        </div>
        {students.length === 0 && <p className={styles.notice}>Lớp này chưa có học viên thạc sĩ hợp lệ trong dữ liệu.</p>}
        {!readOnly && (
          <div className={styles.footer}>
            <button type="button" disabled={!dirty || saving || rosterLoading || hasInvalid || !students.length} onClick={() => void save()}>{saving ? "Đang lưu..." : "Lưu bảng điểm"}</button>
          </div>
        )}
        {hasInvalid && !readOnly && <p className={styles.error} role="alert">Điểm từ 0–10, tối đa hai chữ số thập phân.</p>}
        {message && <p className={message.startsWith("Đã lưu") ? styles.success : styles.error} role="status">{message}</p>}
      </>}
    </section>}
  </div>;
}
