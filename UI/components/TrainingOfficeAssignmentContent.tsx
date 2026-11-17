"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./TrainingOfficeAssignmentContent.module.css";

type Teacher = { id: string; name: string; department: string; qualification?: string; expertise?: string };
type ClassOption = { code: string; studentCount: number; majorCode?: string; majorName?: string; inconsistentMajor?: boolean };
type Major = { code: string; name: string };
type Catalog = { success?: boolean; departments?: string[]; teachers: Teacher[]; classes: ClassOption[]; majors?: Major[]; dataWarnings?: string[] };
type Assignment = {
  id: string; teacherId: string; teacherName: string; department: string;
  classCode: string; courseCode: string; courseName: string;
  schoolYear: string; semester: string; createdAt?: string; createdBy?: string;
};
type Row = Assignment & { source: "backend" | "draft" };

const DRAFTS_KEY = "agu.trainingOffice.assignmentRealClassesDrafts.v2";

// Các trường maNganh / tenNganh là dữ liệu thật từ hồ sơ học viên.
// Việc liên kết Ngành -> Khoa ở đây là cấu hình giao diện, cần được nhóm xác nhận.
const MAJOR_TO_FACULTY: Record<string, string> = {
  "8480201": "Khoa CNTT", // Công nghệ thông tin
  "8620110": "Khoa NN-TNTN", // Khoa học cây trồng
  "8620105": "Khoa NN-TNTN", // Chăn nuôi
  "8420201": "Khoa NN-TNTN", // Công nghệ sinh học
  "8540101": "Khoa NN-TNTN", // Công nghệ thực phẩm
  "8850101": "Khoa KT-CN-MT", // Quản lý tài nguyên và môi trường
  "8140114": "Khoa Sư phạm", // Quản lý giáo dục
  "8140110": "Khoa Sư phạm", // Lý luận và phương pháp dạy học
  "8440103": "Khoa Sư phạm", // Vật lý lý thuyết và Vật lý toán
  "8140111": "Khoa Ngoại ngữ", // Phương pháp giảng dạy tiếng Anh
};

function facultyOf(department: string): string | null {
  const value = String(department || "").trim();
  let faculty = "";
  const sep = " - Khoa ";
  const index = value.lastIndexOf(sep);
  if (index >= 0) faculty = `Khoa ${value.slice(index + sep.length)}`;
  else if (value.startsWith("Lãnh đạo Khoa ")) faculty = value.slice("Lãnh đạo ".length);
  else if (value.startsWith("Khoa ")) faculty = value;
  else return null;
  if (faculty === "Khoa Kinh tế - Quản trị Kinh doanh") return "Khoa KT-QTKD";
  if (faculty === "Khoa Luật và Khoa học chính trị") return "Khoa Luật & KHCT";
  return faculty;
}

function yearOptions(): string[] {
  // Niên khóa là trường dự kiến; chọn được các năm tương lai, nhưng không
  // đồng nghĩa các lớp đã được nhà trường mở ở những niên khóa đó.
  return Array.from({ length: 7 }, (_, index) => {
    const y = 2025 + index;
    return `${y}-${y + 1}`;
  });
}

function readDrafts(): Assignment[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is Assignment => Boolean(r) && typeof r === "object" &&
      typeof r.id === "string" && typeof r.teacherId === "string" &&
      typeof r.classCode === "string" && typeof r.courseCode === "string" &&
      typeof r.schoolYear === "string" && typeof r.semester === "string");
  } catch { return []; }
}

function safeExportText(value: string | number | undefined) {
  const s = String(value ?? "");
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}

export default function TrainingOfficeAssignmentContent() {
  const [catalog, setCatalog] = useState<Catalog>({ teachers: [], classes: [], majors: [] });
  const [storedAssignments, setStoredAssignments] = useState<Assignment[]>([]);
  const [drafts, setDrafts] = useState<Assignment[]>([]);
  const [draftsReady, setDraftsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [faculty, setFaculty] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [semester, setSemester] = useState("1");
  const [majorCode, setMajorCode] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [courseName, setCourseName] = useState("");
  const [classCodes, setClassCodes] = useState<string[]>([]);
  const [summaryYear, setSummaryYear] = useState("");
  const [summarySemester, setSummarySemester] = useState("");
  const [summaryMajor, setSummaryMajor] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setDrafts(readDrafts());
    setDraftsReady(true);
    const aborter = new AbortController();
    void (async () => {
      try {
        const [catalogResponse, assignmentResponse] = await Promise.all([
          fetch("/api/training-office/catalog", { credentials: "same-origin", cache: "no-store", signal: aborter.signal }),
          fetch("/api/training-office/assignments", { credentials: "same-origin", cache: "no-store", signal: aborter.signal }),
        ]);
        if (!catalogResponse.ok || !assignmentResponse.ok) throw new Error("Không tải được dữ liệu Phòng đào tạo. Hãy kiểm tra Backend và phiên đăng nhập.");
        const c = await catalogResponse.json() as Catalog;
        const a = await assignmentResponse.json() as { data?: Assignment[] };
        if (!aborter.signal.aborted) {
          setCatalog({ teachers: c.teachers ?? [], classes: c.classes ?? [], majors: c.majors ?? [], dataWarnings: c.dataWarnings ?? [] });
          setStoredAssignments(a.data ?? []);
        }
      } catch (error) {
        if (!aborter.signal.aborted) setLoadError(error instanceof Error ? error.message : "Không tải được dữ liệu.");
      } finally { if (!aborter.signal.aborted) setLoading(false); }
    })();
    return () => aborter.abort();
  }, []);

  useEffect(() => {
    if (!draftsReady) return;
    try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); }
    catch { setMessage("Không thể lưu bản nháp trên trình duyệt. Hãy kiểm tra dung lượng lưu trữ."); }
  }, [drafts, draftsReady]);

  const faculties = useMemo(() => [...new Set(catalog.teachers.map(t => facultyOf(t.department)).filter((x): x is string => Boolean(x)))].sort((a, b) => a.localeCompare(b, "vi")), [catalog.teachers]);
  const filteredTeachers = useMemo(() => catalog.teachers.filter(t => faculty && facultyOf(t.department) === faculty).sort((a, b) => a.name.localeCompare(b.name, "vi")), [catalog.teachers, faculty]);
  const selectedTeacher = filteredTeachers.find(t => t.id === teacherId);
  const majors = useMemo(() => {
    // Chỉ hiển thị ngành THỰC SỰ có lớp trong dữ liệu học viên.
    const majorCodesWithClasses = new Set(catalog.classes.map(c => c.majorCode).filter(Boolean));
    return (catalog.majors ?? [])
      .filter(m => MAJOR_TO_FACULTY[m.code] === faculty && majorCodesWithClasses.has(m.code))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [catalog.majors, catalog.classes, faculty]);

  const sourceClasses = useMemo(() => catalog.classes.filter(c => c.majorCode === majorCode).sort((a, b) => a.code.localeCompare(b.code, "vi")), [catalog.classes, majorCode]);
  const allAssignments = useMemo<Row[]>(() => [
    ...storedAssignments.map(r => ({ ...r, source: "backend" as const })),
    ...drafts.map(r => ({ ...r, source: "draft" as const })),
  ], [storedAssignments, drafts]);
  const isAssigned = (classCode: string) => Boolean(courseCode.trim() && allAssignments.some(r =>
    r.classCode === classCode && r.courseCode.toUpperCase() === courseCode.trim().toUpperCase() && r.schoolYear === schoolYear && r.semester === semester));
  const availableClasses = sourceClasses.filter(c => !isAssigned(c.code) && !c.inconsistentMajor);
  const availableSelected = classCodes.filter(code => availableClasses.some(c => c.code === code));

  const summaryRows = useMemo(() => allAssignments.filter(r => {
    if (faculty && facultyOf(r.department) !== faculty) return false;
    if (summaryYear && r.schoolYear !== summaryYear) return false;
    if (summarySemester && r.semester !== summarySemester) return false;
    if (summaryMajor) {
      const ref = catalog.classes.find(c => c.code === r.classCode);
      if (ref?.majorCode !== summaryMajor) return false;
    }
    return true;
  }).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")), [allAssignments, faculty, summaryYear, summarySemester, summaryMajor, catalog.classes]);

  const resetDependent = () => { setMajorCode(""); setCourseCode(""); setCourseName(""); setClassCodes([]); setSummaryMajor(""); setMessage(""); };
  const saveDraft = () => {
    const normalizedCode = courseCode.trim().toUpperCase();
    const normalizedName = courseName.trim();
    if (!selectedTeacher || !faculty || !majorCode || availableSelected.length === 0) {
      setMessage("Hãy chọn giảng viên, ngành và ít nhất một lớp chưa phân công.");
      return;
    }
    if (!/^[\p{L}\p{N} ._-]{2,30}$/u.test(normalizedCode) || normalizedName.length < 2 || normalizedName.length > 150) {
      setMessage("Hãy nhập đúng mã học phần (2–30 ký tự) và tên học phần (2–150 ký tự) theo danh mục của trường.");
      return;
    }
    const time = new Date().toISOString();
    const additions = availableSelected.map((classCode, index) => ({
      id: `draft-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      teacherId: selectedTeacher.id,
      teacherName: selectedTeacher.name,
      department: selectedTeacher.department,
      classCode, courseCode: normalizedCode, courseName: normalizedName,
      schoolYear, semester, createdAt: time, createdBy: "local-demo",
    }));
    setDrafts(old => [...old, ...additions]);
    setClassCodes([]);
    setTeacherId("");
    setCourseCode("");
    setCourseName("");
    setMessage(`Đã lưu ${additions.length} phân công vào bản nháp trên trình duyệt. Chưa ghi vào Backend.`);
  };
  const resetChoices = () => { setTeacherId(""); setCourseCode(""); setCourseName(""); setClassCodes([]); setMessage(""); };

  const exportExcel = async () => {
    if (summaryRows.length === 0) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const data = summaryRows.map((r, index) => {
        const sourceClass = catalog.classes.find(c => c.code === r.classCode);
        return {
          "STT": index + 1,
          "Năm học": safeExportText(r.schoolYear),
          "Học kỳ": safeExportText(r.semester),
          "Khoa": safeExportText(facultyOf(r.department) ?? "Chưa xác định"),
          "Ngành": safeExportText(sourceClass?.majorName ?? "Chưa cập nhật"),
          "Mã học phần": safeExportText(r.courseCode),
          "Tên học phần": safeExportText(r.courseName),
          "Lớp": safeExportText(r.classCode),
          "Giảng viên": safeExportText(r.teacherName),
          "Mã GV / SHCC": safeExportText(r.teacherId),
          "Nguồn": r.source === "draft" ? "Nháp trên trình duyệt" : "Đã lưu hệ thống",
        };
      });
      const sheet = XLSX.utils.json_to_sheet(data);
      sheet["!cols"] = [6, 16, 10, 23, 36, 18, 34, 18, 30, 23, 24].map(wch => ({ wch }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Phan cong");
      XLSX.writeFile(book, "phan-cong-giang-day.xlsx");
    } catch { setMessage("Xuất Excel chưa thành công. Kiểm tra thư viện xlsx trong UI/package.json."); }
    finally { setExporting(false); }
  };

  return (
    <section className={styles.page} aria-label="Phân công giảng dạy">
      {loadError && <div className={styles.error} role="alert">{loadError}</div>}
      {(catalog.dataWarnings ?? []).length > 0 && (
        <div className={styles.dataWarning} role="status">
          <strong>Lưu ý dữ liệu lớp học:</strong> {catalog.dataWarnings?.join(" ")}
        </div>
      )}
      <div className={styles.twoColumns}>
        <section className={`${styles.card} ${styles.teacherCard}`} aria-labelledby="teacher-title">
          <h2 id="teacher-title">1. Chọn giảng viên</h2>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="faculty-select">Khoa</label>
            <select id="faculty-select" className={styles.control} value={faculty} disabled={loading} onChange={e => { setFaculty(e.target.value); setTeacherId(""); resetDependent(); }}>
              <option value="">-- Chọn Khoa --</option>
              {faculties.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div className={styles.listHeader}><span>Danh sách giảng viên</span><span className={styles.listCount}>{faculty ? `${filteredTeachers.length} giảng viên` : "Chưa chọn Khoa"}</span></div>
          <div className={styles.teacherList} role="group" aria-label="Chọn một giảng viên">
            {loading ? <p className={styles.empty}>Đang tải giảng viên...</p>
              : !faculty ? <p className={styles.empty}>Chọn Khoa để hiển thị giảng viên.</p>
              : filteredTeachers.length === 0 ? <p className={styles.empty}>Không tìm thấy giảng viên thuộc Khoa này.</p>
              : filteredTeachers.map(t => (
                <label className={`${styles.teacherOption} ${teacherId === t.id ? styles.teacherActive : ""}`} key={t.id}>
                  <input type="radio" name="teacher-choice" checked={teacherId === t.id} onChange={() => { setTeacherId(t.id); setMessage(""); }} />
                  <span className={styles.teacherInfo}><strong>{t.name}</strong><small>{t.id} · {faculty}</small></span>
                </label>
              ))}
          </div>
          <p className={styles.microcopy}>Chọn một giảng viên mỗi lần phân công. Giảng viên vẫn có thể được phân công cho lớp hoặc môn khác.</p>
        </section>

        <section className={`${styles.card} ${styles.assignmentCard}`} aria-labelledby="assignment-title">
          <div className={styles.titleRow}><h2 id="assignment-title">2. Phân công giảng viên</h2><span className={styles.demoTag}>Thiết kế thử nghiệm</span></div>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="school-year">Năm học</label>
              <select className={styles.control} id="school-year" value={schoolYear} onChange={e => { setSchoolYear(e.target.value); setCourseCode(""); setCourseName(""); setClassCodes([]); setMessage(""); }}>
                {yearOptions().map(y => <option key={y} value={y}>{y.replace("-", " – ")}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="semester">Học kỳ</label>
              <select className={styles.control} id="semester" value={semester} onChange={e => { setSemester(e.target.value); setCourseCode(""); setCourseName(""); setClassCodes([]); setMessage(""); }}>
                <option value="1">Học kỳ 1</option><option value="2">Học kỳ 2</option><option value="3">Học kỳ 3</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="faculty-readonly">Khoa</label>
              <input className={`${styles.control} ${styles.readonly}`} id="faculty-readonly" value={faculty} placeholder="Chọn Khoa ở khung bên trái" readOnly aria-readonly="true" />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="major-select">Ngành đào tạo</label>
              <select className={styles.control} id="major-select" value={majorCode} disabled={!faculty || majors.length === 0} onChange={e => { setMajorCode(e.target.value); setCourseCode(""); setCourseName(""); setClassCodes([]); setMessage(""); }}>
                <option value="">-- Chọn Ngành --</option>
                {majors.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="course-name">Tên học phần</label>
              <input id="course-name" className={styles.control} type="text" value={courseName}
                placeholder="Nhập tên học phần theo chương trình" maxLength={150}
                disabled={!majorCode}
                onChange={e => { setCourseName(e.target.value); setClassCodes([]); setMessage(""); }} />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="course-code">Mã học phần</label>
              <input id="course-code" className={styles.control} type="text" value={courseCode}
                placeholder="Nhập mã học phần chính thức" maxLength={30}
                disabled={!majorCode}
                onChange={e => { setCourseCode(e.target.value); setClassCodes([]); setMessage(""); }} />
            </div>
            <p className={`${styles.fieldHint} ${styles.fullWidth}`}>
              Database hiện có danh sách lớp và ngành thật, nhưng chưa có bảng học phần mở theo năm học/học kỳ.
              Vì vậy không tự tạo môn học giả; tạm nhập mã và tên học phần từ danh mục đã ban hành.
            </p>
          </div>

          <div className={styles.classSection}>
            <div className={styles.listHeader}><span>Lớp học cần phân công</span><span className={styles.listCount}>{majorCode ? `${sourceClasses.length} lớp từ dữ liệu học viên` : "Chưa chọn ngành"}</span></div>
            <div className={styles.classesBox} role="group" aria-label="Lớp học cần phân công">
              {!majorCode ? <p className={styles.empty}>Chọn Ngành để xem những lớp thực sự tồn tại trong hồ sơ học viên.</p>
                : sourceClasses.length === 0 ? <p className={styles.empty}>Chưa có lớp của ngành này trong hồ sơ học viên hiện tại.</p>
                : sourceClasses.map(c => {
                  const assigned = isAssigned(c.code);
                  const locked = assigned || Boolean(c.inconsistentMajor);
                  return <label key={c.code} className={`${styles.classRow} ${locked ? styles.classDisabled : ""}`}>
                    <input type="checkbox" disabled={locked} checked={assigned || classCodes.includes(c.code)} onChange={e => setClassCodes(old => e.target.checked ? [...old, c.code] : old.filter(x => x !== c.code))} />
                    <span className={styles.classInfo}><strong>{c.code}</strong><small>{c.studentCount} học viên · {c.majorName || "Chưa cập nhật ngành"}</small></span>
                    {c.inconsistentMajor ? <span className={styles.warningBadge}>Kiểm tra ngành</span> : assigned && <span className={styles.assignedBadge}>Đã phân công</span>}
                  </label>;
                })}
            </div>
            <p className={styles.fieldHint}>Đây là các lớp có mã <code>lop</code> trong hồ sơ học viên của ngành đã chọn. Database chưa cho biết chính xác lớp nào học môn này trong năm học/học kỳ đang chọn; cần đối chiếu kế hoạch mở lớp trước khi phân công chính thức.</p>
          </div>

          <div className={styles.selectionSummary}>
            <div><span className={styles.smallLabel}>Giảng viên được chọn</span><strong>{selectedTeacher?.name ?? "Chưa chọn giảng viên"}</strong><small>{selectedTeacher ? `${selectedTeacher.id} · ${faculty}` : "Chọn giảng viên ở khung bên trái"}</small></div>
            <div className={styles.selectedClassCount}><strong>{availableSelected.length}</strong><span>Lớp được chọn</span></div>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={resetChoices}>Làm mới lựa chọn</button>
            <button type="button" className={styles.primaryButton} disabled={!selectedTeacher || !majorCode || !courseCode.trim() || !courseName.trim() || availableSelected.length === 0} onClick={saveDraft}>Lưu phân công (bản nháp)</button>
          </div>
          {message && <div className={styles.notice} role="status">{message}</div>}
        </section>
      </div>

      <section className={`${styles.card} ${styles.summaryCard}`} aria-labelledby="summary-title">
        <div className={styles.summaryHeading}><div><h2 id="summary-title">3. Danh sách phân công đã thực hiện</h2><p>Hiển thị dữ liệu đã lưu ở Backend (nếu có) và bản nháp của giao diện thử nghiệm.</p></div><button type="button" className={styles.exportButton} disabled={summaryRows.length === 0 || exporting} onClick={() => void exportExcel()}>{exporting ? "Đang xuất..." : "Xuất Excel (.xlsx)"}</button></div>
        <div className={styles.filterRow}>
          <div className={styles.field}><label className={styles.label} htmlFor="summary-faculty">Khoa</label><input id="summary-faculty" className={`${styles.control} ${styles.readonly}`} value={faculty || "Tất cả Khoa"} readOnly /></div>
          <div className={styles.field}><label className={styles.label} htmlFor="summary-year">Năm học</label><select id="summary-year" className={styles.control} value={summaryYear} onChange={e => setSummaryYear(e.target.value)}><option value="">Tất cả năm học</option>{yearOptions().map(y => <option value={y} key={y}>{y.replace("-", " – ")}</option>)}</select></div>
          <div className={styles.field}><label className={styles.label} htmlFor="summary-semester">Học kỳ</label><select id="summary-semester" className={styles.control} value={summarySemester} onChange={e => setSummarySemester(e.target.value)}><option value="">Tất cả học kỳ</option><option value="1">Học kỳ 1</option><option value="2">Học kỳ 2</option><option value="3">Học kỳ 3</option></select></div>
          <div className={styles.field}><label className={styles.label} htmlFor="summary-major">Ngành</label><select id="summary-major" className={styles.control} value={summaryMajor} disabled={!faculty} onChange={e => setSummaryMajor(e.target.value)}><option value="">Tất cả ngành</option>{majors.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}</select></div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.summaryTable}>
            <thead><tr><th>STT</th><th>Năm học / HK</th><th>Khoa</th><th>Ngành</th><th>Học phần</th><th>Lớp</th><th>Giảng viên</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {summaryRows.length === 0 ? <tr><td colSpan={9} className={styles.emptyTable}>Chưa có phân công phù hợp bộ lọc.</td></tr> : summaryRows.map((r, index) => (
                <tr key={`${r.source}-${r.id}`}><td>{index + 1}</td><td>{r.schoolYear}<br /><small>Học kỳ {r.semester}</small></td><td>{facultyOf(r.department) ?? "Chưa xác định"}</td><td>{catalog.classes.find(c => c.code === r.classCode)?.majorName ?? "Chưa cập nhật"}</td><td><strong>{r.courseName}</strong><br /><small>{r.courseCode}</small></td><td><strong>{r.classCode}</strong></td><td>{r.teacherName}<br /><small>{r.teacherId}</small></td><td><span className={r.source === "draft" ? styles.draftBadge : styles.savedBadge}>{r.source === "draft" ? "Nháp trình duyệt" : "Đã lưu hệ thống"}</span></td><td>{r.source === "draft" ? <button type="button" className={styles.removeButton} onClick={() => setDrafts(old => old.filter(x => x.id !== r.id))}>Xóa nháp</button> : <span className={styles.noAction}>—</span>}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.tableFooter}><span>{summaryRows.length} kết quả</span><span>Chỉ bản nháp mới có thể xóa tại giao diện này.</span></div>
      </section>
    </section>
  );
}
