"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./TrainingOfficeAssignmentContent.module.css";
import curriculumData from "../../data/agu_masters_curriculum.json";

type Teacher = { id: string; name: string; department: string; qualification?: string; expertise?: string };
type ClassOption = {
  code: string; studentCount: number; majorCode?: string; majorName?: string;
  admissionYear?: number | null; trainingTrack?: "nghien_cuu" | "ung_dung" | null;
  inconsistentMajor?: boolean; inconsistentAdmissionYear?: boolean; inconsistentTrack?: boolean;
};
type Major = { code: string; name: string };
type Catalog = { success?: boolean; departments?: string[]; teachers: Teacher[]; classes: ClassOption[]; majors?: Major[]; dataWarnings?: string[] };
type Assignment = {
  id: string; teacherId: string; teacherName: string; department: string;
  classCode: string; courseCode: string; courseName: string;
  schoolYear: string; semester: string; trainingTrack?: string; admissionYear?: number; programSemester?: number; createdAt?: string; createdBy?: string;
};
type Row = Assignment & { source: "backend" | "draft" };
type CurriculumCourse = {
  id: string; majorName: string; track: "nghien_cuu" | "ung_dung";
  code: string; name: string; credits: number | null; semesters: number[];
  validFromAdmissionYear: number | null; needsReview: boolean;
  reviewNote: string; source: string; sourcePage: number | null;
};
const CURRICULUM = curriculumData as CurriculumCourse[];
// Ánh xạ mã ngành từ hồ sơ học viên sang tên ngành trong CTĐT đã cung cấp.
// Không đồng nghĩa sinh viên/lớp đã được xếp vào định hướng đào tạo cụ thể.
const MAJOR_TO_CURRICULUM: Record<string, string> = {
  "8480201": "Công nghệ thông tin", "8620110": "Khoa học cây trồng",
  "8620105": "Chăn nuôi", "8420201": "Công nghệ sinh học",
  "8540101": "Công nghệ thực phẩm", "8850101": "Quản lý tài nguyên và môi trường",
  "8140114": "Quản lý giáo dục", "8140110": "Lí luận và Phương pháp dạy học",
  "8440103": "Vật lý lý thuyết và Vật lý toán",
  "8140111": "Lý luận và Phương pháp dạy học bộ môn tiếng Anh",
};

const DRAFTS_KEY = "agu.trainingOffice.assignmentRealClassesDrafts.v2";
// Bên trái lọc theo Khoa CÔNG TÁC của giảng viên, không giới hạn Ngành ở bên phải.
const ALL_TEACHER_FACULTIES = "__all_teacher_faculties__";

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

// Học kỳ của NĂM HỌC khác với học kỳ theo tiến độ CHƯƠNG TRÌNH.
// Ví dụ khóa nhập học 2025: năm 2026-2027 HK1 -> HK3 theo CTĐT.
// Quy ước năm học bắt đầu tháng 8; nếu trường dùng mốc khác, chỉ đổi hằng này.
const ACADEMIC_YEAR_START_MONTH = 8;
function academicStartYear(): number {
  const now = new Date();
  return now.getFullYear() - (now.getMonth() + 1 < ACADEMIC_YEAR_START_MONTH ? 1 : 0);
}
function yearOptions(): string[] {
  const start = academicStartYear();
  return [start, start + 1].map(y => `${y}-${y + 1}`);
}
function programSemesterOf(schoolYear: string, semester: string, admissionYear: string): number | null {
  if (!admissionYear || !schoolYear) return null;
  const diff = Number(schoolYear.slice(0, 4)) - Number(admissionYear);
  const value = diff * 2 + Number(semester);
  return Number.isInteger(value) && value >= 1 && value <= 4 ? value : null;
}
// Khóa được xác định NGẦM từ hồ sơ của từng lớp thay vì bắt người dùng chọn thủ công.
// Chỉ xác định học phần tương ứng với học kỳ CTĐT, không khẳng định môn đã được mở thực tế.
function courseAppliesToClass(
  course: CurriculumCourse, classInfo: ClassOption, schoolYear: string, semester: string,
): boolean {
  if (!classInfo.admissionYear || classInfo.inconsistentAdmissionYear || classInfo.inconsistentTrack || classInfo.inconsistentMajor) return false;
  const studySemester = programSemesterOf(schoolYear, semester, String(classInfo.admissionYear));
  return studySemester !== null && course.semesters.includes(studySemester) &&
    (!course.validFromAdmissionYear || classInfo.admissionYear >= course.validFromAdmissionYear);
}
function semesterRoman(value: number | null) {
  return value ? (["I", "II", "III", "IV"][value - 1] || String(value)) : "—";
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
  const [schoolYear, setSchoolYear] = useState(() => yearOptions()[0]);
  const [semester, setSemester] = useState("1");
  // Bước 1: xác nhận năm học và học kỳ, sau đó thu gọn để tập trung phân công.
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const [majorCode, setMajorCode] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [trainingTrack, setTrainingTrack] = useState<"nghien_cuu" | "ung_dung">("nghien_cuu");
  const [courseId, setCourseId] = useState("");
  const [classCodes, setClassCodes] = useState<string[]>([]);
  const [summaryFaculty, setSummaryFaculty] = useState("");
  const [exporting, setExporting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const [confirmedOpen, setConfirmedOpen] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");

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
  const filteredTeachers = useMemo(() => catalog.teachers
    .filter(t => faculty === ALL_TEACHER_FACULTIES || (faculty !== "" && facultyOf(t.department) === faculty))
    .sort((a, b) => a.name.localeCompare(b.name, "vi")), [catalog.teachers, faculty]);
  const selectedTeacher = catalog.teachers.find(t => t.id === teacherId);
  // Đã đưa vào khu vực phân công thì ẩn khỏi danh sách, nhấn × để trả về.
  const availableTeachers = filteredTeachers.filter(t => t.id !== teacherId);
  const majors = useMemo(() => {
    // Chỉ hiển thị ngành THỰC SỰ có lớp trong dữ liệu học viên.
    const majorCodesWithClasses = new Set(catalog.classes.map(c => c.majorCode).filter(Boolean));
    return (catalog.majors ?? [])
      .filter(m => majorCodesWithClasses.has(m.code))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [catalog.majors, catalog.classes]);

  const selectedMajor = majors.find(m => m.code === majorCode);
  // Khoa QUẢN LÝ NGÀNH lấy từ cấu hình ngành, hoàn toàn độc lập với Khoa công tác của giảng viên.
  const programFaculty = majorCode ? (MAJOR_TO_FACULTY[majorCode] ?? "") : "";
  const curriculumMajorName = MAJOR_TO_CURRICULUM[majorCode] || selectedMajor?.name || "";
  const availableTracks = useMemo(() => new Set(CURRICULUM.filter(c => c.majorName === curriculumMajorName).map(c => c.track)), [curriculumMajorName]);
  // Không cần chọn khóa nhập học: hệ thống tự lấy năm nhập học từ hồ sơ của mỗi lớp.
  const classesInAcademicYear = useMemo(() => catalog.classes.filter(c => {
    const admission = c.admissionYear;
    const yearGap = admission ? Number(schoolYear.slice(0, 4)) - admission : -1;
    return c.majorCode === majorCode && c.trainingTrack === trainingTrack &&
      !c.inconsistentAdmissionYear && !c.inconsistentTrack && !c.inconsistentMajor &&
      yearGap >= 0 && yearGap < 2;
  }).sort((a, b) => a.code.localeCompare(b.code, "vi")),
  [catalog.classes, majorCode, trainingTrack, schoolYear]);
  const coursesByTrack = useMemo(() => CURRICULUM.filter(c => c.majorName === curriculumMajorName && c.track === trainingTrack), [curriculumMajorName, trainingTrack]);
  // Chỉ hiển thị những học phần CTĐT đã đối chiếu và thực sự có ít nhất
  // một lớp thạc sĩ hợp lệ theo NGÀNH + ĐỊNH HƯỚNG + NĂM NHẬP HỌC + HỌC KỲ.
  // Đây là điều kiện để tạo NHÁP, không khẳng định lớp đã mở học phần chính thức.
  const courseOptions = useMemo(() => coursesByTrack.filter(c =>
    c.code && c.name && !c.needsReview &&
    c.semesters.some(programTerm => (programTerm - 1) % 2 === Number(semester) - 1) &&
    classesInAcademicYear.some(cls => courseAppliesToClass(c, cls, schoolYear, semester))
  ).sort((a, b) => a.code.localeCompare(b.code, "vi") || a.name.localeCompare(b.name, "vi")),
  [coursesByTrack, semester, classesInAcademicYear, schoolYear]);
  const selectedCourse = courseOptions.find(c => c.id === courseId);
  const courseCode = selectedCourse?.code ?? "";
  const courseName = selectedCourse?.name ?? "";
  const allAssignments = useMemo<Row[]>(() => [
    ...storedAssignments.map(r => ({ ...r, source: "backend" as const })),
    ...drafts.map(r => ({ ...r, source: "draft" as const })),
  ], [storedAssignments, drafts]);
  const classByCode = useMemo(() => new Map(catalog.classes.map(c => [c.code, c])), [catalog.classes]);

  // Một học phần có thể được mở cho NHIỀU LỚP. Chỉ khóa cặp
  // (năm học, học kỳ, mã lớp, mã học phần) đã có phân công, KHÔNG khóa cả môn.
  // Kết hợp cả phân công Backend và bản nháp để tránh phân công trùng.
  // Khi hủy/xóa một dòng, khóa của đúng lớp đó biến mất và môn sẽ hiện lại
  // nếu còn ít nhất một lớp hợp lệ chưa được phân công.
  const assignedClassCourseKeys = useMemo(() => new Set(allAssignments
    .filter(r => r.schoolYear === schoolYear && String(r.semester) === String(semester))
    .map(r => `${r.classCode.trim().toUpperCase()}|${r.courseCode.trim().toUpperCase()}`)),
  [allAssignments, schoolYear, semester]);
  const isClassCourseAssigned = (classCode: string, code: string): boolean =>
    assignedClassCourseKeys.has(`${classCode.trim().toUpperCase()}|${code.trim().toUpperCase()}`);

  // Môn chỉ xuất hiện khi còn ít nhất một lớp có thể nhận phân công môn này.
  const visibleCourses = useMemo(() => courseOptions.filter(c =>
    c.id !== courseId &&
    `${c.code} ${c.name}`.toLocaleLowerCase("vi").includes(courseSearch.trim().toLocaleLowerCase("vi")) &&
    classesInAcademicYear.some(cls =>
      !cls.inconsistentMajor &&
      courseAppliesToClass(c, cls, schoolYear, semester) &&
      !assignedClassCourseKeys.has(`${cls.code.trim().toUpperCase()}|${c.code.trim().toUpperCase()}`)
    )),
  [courseOptions, courseId, courseSearch, classesInAcademicYear, schoolYear, semester, assignedClassCourseKeys]);
  const sourceClasses = useMemo(() => selectedCourse ? classesInAcademicYear
    .filter(cls => courseAppliesToClass(selectedCourse, cls, schoolYear, semester)) : [],
  [classesInAcademicYear, selectedCourse, schoolYear, semester]);
  const isAssigned = (classCode: string) => Boolean(courseCode.trim() && isClassCourseAssigned(classCode, courseCode));
  const availableClasses = sourceClasses.filter(c => !isAssigned(c.code) && !c.inconsistentMajor);
  const availableSelected = classCodes.filter(code => availableClasses.some(c => c.code === code));

  // Bộ lọc Khoa của bảng tổng hợp độc lập với Khoa công tác ở khung chọn giảng viên.
  // Bộ lọc Khoa ở bảng tổng hợp là Khoa QUẢN LÝ NGÀNH (từ lớp học), không phải Khoa công tác GV.
  const programFacultyForClass = (classCode: string): string => {
    const code = classByCode.get(classCode)?.majorCode ?? "";
    return MAJOR_TO_FACULTY[code] ?? "";
  };
  const summaryFaculties = useMemo(() => [...new Set(
    (catalog.majors ?? [])
      .filter(m => catalog.classes.some(c => c.majorCode === m.code))
      .map(m => MAJOR_TO_FACULTY[m.code])
      .filter((f): f is string => Boolean(f))
  )].sort((a, b) => a.localeCompare(b, "vi")), [catalog.majors, catalog.classes]);
  const summaryRows = useMemo(() => allAssignments.filter(r =>
    !summaryFaculty || MAJOR_TO_FACULTY[classByCode.get(r.classCode)?.majorCode ?? ""] === summaryFaculty
  ).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")),
  [allAssignments, summaryFaculty, classByCode]);

  // Nút lưu sẽ áp dụng CHỈ những bản nháp đang hiển thị trong bảng (theo Khoa lọc).
  const visibleDrafts = useMemo(() => summaryRows.filter(r => r.source === "draft"), [summaryRows]);
  const publishDrafts = async () => {
    if (!confirmedOpen || visibleDrafts.length === 0 || publishing) return;
    setPublishing(true);
    setPublishMessage("");
    try {
      const response = await fetch("/api/training-office/assignments/publish", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedOpen: true, assignments: visibleDrafts.map(r => ({
          teacherId: r.teacherId, classCode: r.classCode, courseCode: r.courseCode,
          schoolYear: r.schoolYear, semester: r.semester, trainingTrack: r.trainingTrack,
        })) }),
      });
      const result: { data?: Assignment[]; count?: number; message?: string | string[] } = await response.json();
      if (!response.ok || !Array.isArray(result.data)) {
        throw new Error(Array.isArray(result.message) ? result.message.join("; ") : result.message || "Không lưu được phân công");
      }
      const savedIds = new Set(visibleDrafts.map(r => r.id));
      setStoredAssignments(old => [...old, ...(result.data ?? [])]);
      setDrafts(old => old.filter(r => !savedIds.has(r.id)));
      setConfirmedOpen(false);
      setPublishMessage(`Đã lưu ${result.count ?? result.data.length} phân công vào Backend. Giảng viên liên quan có thể xem học phần, lớp được giao khi đăng nhập.`);
    } catch (error) {
      setPublishMessage(error instanceof Error ? `Lưu chưa thành công: ${error.message}` : "Lưu chưa thành công. Hãy thử lại.");
    } finally { setPublishing(false); }
  };

  const removePublishedAssignment = async (id: string) => {
    if (removingId || !window.confirm("Hủy phân công đã lưu? Giảng viên sẽ không còn thấy học phần/lớp này.")) return;
    setRemovingId(id);
    setPublishMessage("");
    try {
      const response = await fetch(`/api/training-office/assignments/${encodeURIComponent(id)}`, {
        method: "DELETE", credentials: "same-origin", cache: "no-store",
      });
      if (!response.ok) {
        const result: { message?: string } = await response.json();
        throw new Error(result.message || "Không hủy được phân công");
      }
      setStoredAssignments(old => old.filter(r => r.id !== id));
      setPublishMessage("Đã hủy phân công của lớp này. Học phần sẽ xuất hiện lại nếu lớp vừa hủy còn đủ điều kiện để phân công.");
    } catch (error) {
      setPublishMessage(error instanceof Error ? error.message : "Không hủy được phân công");
    } finally { setRemovingId(""); }
  };

  const selectMajor = (newCode: string) => {
    const programName = MAJOR_TO_CURRICULUM[newCode] ?? majors.find(m => m.code === newCode)?.name ?? "";
    const hasResearch = CURRICULUM.some(c => c.majorName === programName && c.track === "nghien_cuu");
    const hasApplied = CURRICULUM.some(c => c.majorName === programName && c.track === "ung_dung");
    if (trainingTrack === "nghien_cuu" && !hasResearch && hasApplied) setTrainingTrack("ung_dung");
    else if (trainingTrack === "ung_dung" && !hasApplied && hasResearch) setTrainingTrack("nghien_cuu");
    setMajorCode(newCode); setCourseId(""); setClassCodes([]); setCourseSearch(""); setMessage("");
  };
  // Không kéo thả: bấm giảng viên / học phần để chọn.
  // Lựa chọn đang giữ sẽ ẩn khỏi danh sách nguồn, nhấn × để trả lại.
  const chooseTeacher = (id: string) => {
    if (!availableTeachers.some(t => t.id === id)) return;
    setTeacherId(id);
    setMessage("");
  };
  const chooseCourse = (id: string) => {
    const match = visibleCourses.find(c => c.id === id);
    if (!match) return;
    setCourseId(match.id);
    setClassCodes([]);
    setMessage("");
  };
  const saveDraft = () => {
    const normalizedCode = courseCode.trim().toUpperCase();
    const normalizedName = courseName.trim();
    if (!selectedCourse || selectedCourse.needsReview) {
      setMessage("Hãy chọn học phần đã được đối chiếu với CTĐT. Học phần có cảnh báo cần kiểm tra lại PDF.");
      return;
    }
    const selectedClasses = sourceClasses.filter(cls => availableSelected.includes(cls.code));
    if (!selectedTeacher || !majorCode || selectedClasses.length === 0) {
      setMessage("Hãy chọn giảng viên, ngành và ít nhất một lớp chưa phân công.");
      return;
    }
    if (!/^[\p{L}\p{N} ._-]{2,30}$/u.test(normalizedCode) || normalizedName.length < 2 || normalizedName.length > 150) {
      setMessage("Mã hoặc tên học phần trong danh mục tham chiếu không hợp lệ; cần rà soát dữ liệu trước khi lưu.");
      return;
    }
    const time = new Date().toISOString();
    const additions = selectedClasses.map((cls, index) => ({
      id: `draft-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      teacherId: selectedTeacher.id,
      teacherName: selectedTeacher.name,
      department: selectedTeacher.department,
      classCode: cls.code,
      courseCode: normalizedCode,
      courseName: normalizedName,
      schoolYear,
      semester,
      trainingTrack,
      admissionYear: cls.admissionYear ?? undefined,
      programSemester: programSemesterOf(schoolYear, semester, String(cls.admissionYear ?? "")) ?? undefined,
      createdAt: time,
      createdBy: "local-demo",
    }));
    setDrafts(old => [...old, ...additions]);
    setClassCodes([]);
    setTeacherId("");
    setCourseId("");
    setMessage(`Đã lưu ${additions.length} phân công vào bản nháp trên trình duyệt. Chưa ghi vào Backend.`);
  };
  const resetChoices = () => { setTeacherId(""); setCourseId(""); setClassCodes([]); setMessage(""); };
  const clearSelectedTeacher = () => { setTeacherId(""); setMessage(""); };
  const clearSelectedCourse = () => { setCourseId(""); setClassCodes([]); setMessage(""); };

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
          "Học kỳ năm học": safeExportText(r.semester),
          "Khóa nhập học": safeExportText(r.admissionYear || "Chưa rõ"),
          "Học kỳ CTĐT": safeExportText(r.programSemester || "Chưa rõ"),
          "Khoa quản lý ngành": safeExportText(MAJOR_TO_FACULTY[sourceClass?.majorCode ?? ""] ?? "Chưa xác định"),
          "Ngành": safeExportText(sourceClass?.majorName ?? "Chưa cập nhật"),
          "Khoa công tác GV": safeExportText(facultyOf(r.department) ?? "Chưa xác định"),
          "Định hướng": safeExportText(r.trainingTrack === "nghien_cuu" ? "Nghiên cứu" : r.trainingTrack === "ung_dung" ? "Ứng dụng" : "Chưa có dữ liệu"),
          "Mã học phần": safeExportText(r.courseCode),
          "Tên học phần": safeExportText(r.courseName),
          "Lớp": safeExportText(r.classCode),
          "Giảng viên": safeExportText(r.teacherName),
          "Mã GV / SHCC": safeExportText(r.teacherId),
          "Nguồn": r.source === "draft" ? "Nháp trên trình duyệt" : "Đã lưu hệ thống",
        };
      });
      const sheet = XLSX.utils.json_to_sheet(data);
      sheet["!cols"] = [6, 16, 17, 16, 14, 24, 36, 23, 20, 18, 34, 18, 30, 23, 24].map(wch => ({ wch }));
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
            <label className={styles.label} htmlFor="faculty-select">Khoa công tác của giảng viên</label>
            <select id="faculty-select" className={styles.control} value={faculty} disabled={loading} onChange={e => { setFaculty(e.target.value); setTeacherId(""); setMessage(""); }}>
              <option value="">-- Chọn Khoa giảng viên --</option>
              <option value={ALL_TEACHER_FACULTIES}>Tất cả giảng viên (liên Khoa)</option>
              {faculties.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
            <p className={styles.fieldHint}>Chỉ lọc giảng viên; không giới hạn ngành hoặc lớp cần phân công.</p>
          </div>
          {selectedTeacher && (
            <div className={styles.chosenTeacher} role="status">
              <div className={styles.chosenTeacherInfo}>
                <small>Giảng viên đang chọn</small>
                <strong>{selectedTeacher.name}</strong>
                <span>{selectedTeacher.id} · {facultyOf(selectedTeacher.department) ?? selectedTeacher.department}</span>
              </div>
              <button type="button" className={styles.chosenRemove} onClick={clearSelectedTeacher}
                aria-label={`Bỏ lựa chọn giảng viên ${selectedTeacher.name}`} title="Bỏ chọn giảng viên">×</button>
            </div>
          )}
          <div className={styles.listHeader}><span>Danh sách giảng viên</span><span className={styles.listCount}>{faculty ? `${availableTeachers.length} giảng viên` : "Chưa chọn Khoa"}</span></div>
          <div className={styles.teacherList} role="group" aria-label="Chọn một giảng viên">
            {loading ? <p className={styles.empty}>Đang tải giảng viên...</p>
              : !faculty ? <p className={styles.empty}>Chọn Khoa để hiển thị giảng viên.</p>
              : availableTeachers.length === 0 ? <p className={styles.empty}>{selectedTeacher ? "Giảng viên đang chọn đã ẩn khỏi danh sách. Nhấn × để trả về." : "Không tìm thấy giảng viên thuộc Khoa này."}</p>
              : availableTeachers.map(t => (
                <button type="button" className={styles.teacherOption} key={t.id}
                  onClick={() => chooseTeacher(t.id)}
                  title="Bấm để chọn giảng viên">
                  <span className={styles.teacherIndicator} aria-hidden="true" />
                  <span className={styles.teacherInfo}><strong>{t.name}</strong><small>{t.id} · {facultyOf(t.department) ?? t.department}</small></span>
                </button>
              ))}
          </div>
          <p className={styles.microcopy}>Bấm để chọn giảng viên. Người đang chọn sẽ ẩn khỏi danh sách; nhấn × để bỏ chọn hoặc bấm người khác để thay đổi.</p>
        </section>

        <section className={`${styles.card} ${styles.assignmentCard}`} aria-labelledby="assignment-title">
          <div className={styles.titleRow}><h2 id="assignment-title">2. Phân công giảng viên</h2><span className={styles.demoTag}>Thiết kế thử nghiệm</span></div>
          {!scheduleConfirmed ? (
            <div className={styles.scheduleSetup}>
              <div className={styles.stepHeadline}>
                <div><strong>Chọn năm học và học kỳ</strong><small>Sau khi xác nhận, phần này sẽ thu gọn để nhường chỗ cho lựa chọn môn và lớp.</small></div>
              </div>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="school-year">Năm học</label>
                  <select className={styles.control} id="school-year" value={schoolYear} onChange={e => { setSchoolYear(e.target.value); setCourseId(""); setClassCodes([]); setCourseSearch(""); setMessage(""); }}>
                    {yearOptions().map(y => <option key={y} value={y}>{y.replace("-", " – ")}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="semester">Học kỳ của năm học</label>
                  <select className={styles.control} id="semester" value={semester} onChange={e => { setSemester(e.target.value); setCourseId(""); setClassCodes([]); setCourseSearch(""); setMessage(""); }}>
                    <option value="1">Học kỳ 1</option><option value="2">Học kỳ 2</option>
                  </select>
                </div>
              </div>
              <div className={styles.scheduleActions}>
                <p>Chỉ chọn học kỳ trong năm học. Tiến độ CTĐT của lớp được đối chiếu tự động từ hồ sơ học viên.</p>
                <button type="button" className={styles.continueButton}
                  onClick={() => { setScheduleConfirmed(true); setCourseId(""); setClassCodes([]); setMessage(""); }}>
                  Tiếp tục chọn học phần →
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.scheduleCompact}>
              <div><span className={styles.scheduleCheck} aria-hidden="true">✓</span><strong>{schoolYear.replace("-", " – ")}</strong><span>Học kỳ {semester}</span></div>
              <button type="button" className={styles.changeScheduleButton}
                onClick={() => { setScheduleConfirmed(false); setCourseId(""); setClassCodes([]); setCourseSearch(""); setMessage(""); }}>
                Thay đổi
              </button>
            </div>
          )}
          {scheduleConfirmed && (
          <>
          <div className={styles.formGrid}>
            <div className={styles.field}>
            <label className={styles.label} htmlFor="major-select">Ngành đào tạo</label>
            <select className={styles.control} id="major-select" value={majorCode} disabled={loading || majors.length === 0} onChange={e => selectMajor(e.target.value)}>
              <option value="">-- Chọn Ngành đào tạo --</option>
              {majors.map(m => <option key={m.code} value={m.code}>{m.name}</option>)}
            </select>
            {!loading && majors.length === 0 && <p className={styles.fieldHint}>Chưa có lớp thạc sĩ hợp lệ trong dữ liệu học viên.</p>}
            <p className={styles.fieldHint}>Chọn ngành độc lập với Khoa công tác của giảng viên.</p>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="program-faculty">Khoa quản lý ngành</label>
            <input className={`${styles.control} ${styles.readonly}`} id="program-faculty"
              value={programFaculty || (majorCode ? "Chưa xác định Khoa quản lý" : "Chọn Ngành để xem Khoa")}
              readOnly aria-readonly="true" />
            {majorCode && !programFaculty && <p className={styles.fieldHint}>Chưa có ánh xạ ngành – Khoa; cần xác minh trước khi sử dụng chính thức.</p>}
          </div>
          <div className={`${styles.field} ${styles.fullWidth}`}>
              <span className={styles.label}>Định hướng đào tạo</span>
              <div className={styles.radioGroup} role="radiogroup" aria-label="Định hướng đào tạo">
                {([{value: "nghien_cuu", label: "Nghiên cứu"}, {value: "ung_dung", label: "Ứng dụng"}] as const).map(option => (
                  <label key={option.value} className={`${styles.trackRadio} ${trainingTrack === option.value ? styles.trackSelected : ""} ${!availableTracks.has(option.value) ? styles.trackUnavailable : ""}`}>
                    <input type="radio" name="track" value={option.value} checked={trainingTrack === option.value}
                      disabled={!majorCode || !availableTracks.has(option.value)}
                      onChange={() => { setTrainingTrack(option.value); setCourseId(""); setClassCodes([]); setCourseSearch(""); setMessage(""); }} />
                    {option.label}
                  </label>
                ))}
              </div>
              {majorCode && availableTracks.size === 0 && <p className={styles.fieldHint}>Chưa có danh mục chương trình cho ngành này.</p>}
            </div>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              {selectedCourse ? (
                <div className={styles.chosenCourse} role="status">
                  <div className={styles.chosenCourseInfo}>
                    <span className={styles.chosenStep}>Học phần đã chọn</span>
                    <strong>{selectedCourse.code} – {selectedCourse.name}</strong>
                    <small>{selectedCourse.credits ?? "?"} tín chỉ · {trainingTrack === "nghien_cuu" ? "Nghiên cứu" : "Ứng dụng"}</small>
                  </div>
                  <button type="button" className={styles.changeCourseButton} onClick={clearSelectedCourse}>
                    Đổi học phần
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.listHeader}><span>Môn học / Học phần</span><span className={styles.listCount}>{majorCode ? `${visibleCourses.length} học phần còn lại` : "Chưa chọn Ngành"}</span></div>
                  <input aria-label="Tìm kiếm học phần" className={styles.control} placeholder="Tìm theo mã hoặc tên học phần..." value={courseSearch} onChange={e => setCourseSearch(e.target.value)} disabled={!majorCode} />
                  <div className={styles.courseList} role="group" aria-label="Danh sách học phần">
                    {!majorCode ? <p className={styles.empty}>Hãy chọn Ngành và Định hướng đào tạo.</p>
                      : visibleCourses.length === 0 ? <p className={styles.empty}>{coursesByTrack.length === 0 ? "Ngành hoặc định hướng này chưa có danh mục CTĐT." : courseOptions.length > 0 ? "Tất cả lớp hợp lệ của các học phần này đã được phân công. Hủy đúng phân công của lớp cần phân công lại để học phần hiện trở lại." : "Chưa có học phần đủ điều kiện với lớp thạc sĩ của ngành, định hướng và học kỳ này."}</p>
                      : visibleCourses.map(c => (
                        <button type="button" key={c.id} onClick={() => chooseCourse(c.id)}
                          className={styles.courseOption} title="Bấm để chọn học phần và xem lớp phù hợp">
                          <span className={styles.courseTop}><strong>{c.code}</strong><span>{c.credits ?? "?"} TC</span></span>
                          <span>{c.name}</span>
                        </button>
                      ))}
                  </div>
                  <p className={styles.fieldHint}>Chọn học phần để chuyển sang danh sách lớp. Chỉ hiện môn có lớp thạc sĩ phù hợp theo dữ liệu tham chiếu; chưa xác nhận môn thực sự được mở.</p>
                </>
              )}
            </div>
          </div>

          {selectedCourse && (
          <div className={styles.classSection}>
            <div className={styles.listHeader}><span>Lớp học cần phân công</span><span className={styles.listCount}>{selectedCourse ? `${availableClasses.length} lớp còn trống / ${sourceClasses.length} lớp phù hợp` : "Chưa chọn học phần"}</span></div>
            <div className={styles.classesBox} role="group" aria-label="Lớp học cần phân công">
              {!selectedCourse ? <p className={styles.empty}>Chọn Ngành, Định hướng và Học phần để xem các lớp phù hợp.</p>
                : sourceClasses.length === 0 ? <p className={styles.empty}>Lớp phù hợp hiện không còn khả dụng. Hãy chọn học phần khác hoặc xóa bản nháp đã phân công tương ứng.</p>
                : sourceClasses.map(c => {
                  const assigned = isAssigned(c.code);
                  const locked = assigned || Boolean(c.inconsistentMajor);
                  return <label key={c.code} className={`${styles.classRow} ${locked ? styles.classDisabled : ""}`}>
                    <input type="checkbox" disabled={locked} checked={assigned || classCodes.includes(c.code)} onChange={e => setClassCodes(old => e.target.checked ? [...old, c.code] : old.filter(x => x !== c.code))} />
                    <span className={styles.classInfo}><strong>{c.code}</strong><small>{c.studentCount} học viên · Nhập học {c.admissionYear || "?"} · {c.majorName || "Chưa cập nhật ngành"}</small></span>
                    {c.inconsistentMajor ? <span className={styles.warningBadge}>Kiểm tra ngành</span> : assigned && <span className={styles.assignedBadge}>Đã phân công</span>}
                  </label>;
                })}
            </div>
            <p className={styles.fieldHint}>Lớp được lấy từ hồ sơ học viên; khóa nhập học được nhận diện tự động để đối chiếu học kỳ CTĐT. Chưa có kế hoạch mở lớp học phần chính thức nên chỉ lưu nháp.</p>
          </div>
          )}

          <div className={styles.selectionSummary}>
            <div><span className={styles.smallLabel}>Giảng viên được chọn</span><strong>{selectedTeacher?.name ?? "Chưa chọn giảng viên"}</strong><small>{selectedTeacher ? `${selectedTeacher.id} · ${facultyOf(selectedTeacher.department) ?? selectedTeacher.department}` : "Chọn giảng viên ở khung bên trái"}</small></div>
            <div className={styles.selectedClassCount}><strong>{availableSelected.length}</strong><span>Lớp được chọn</span></div>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={resetChoices}>Làm mới lựa chọn</button>
            <button type="button" className={styles.primaryButton} disabled={!selectedTeacher || !majorCode || !selectedCourse || selectedCourse.needsReview || availableSelected.length === 0} onClick={saveDraft}>Lưu phân công (bản nháp)</button>
          </div>
          {message && <div className={styles.notice} role="status">{message}</div>}
          </>
          )}
        </section>
      </div>

      <section className={`${styles.card} ${styles.summaryCard}`} aria-labelledby="summary-title">
        <div className={styles.summaryHeading}>
          <div className={styles.summaryHeadingText}>
            <h2 id="summary-title">3. Danh sách phân công đã thực hiện</h2>
            <p>{summaryRows.length}/{allAssignments.length} phân công hiển thị · Bản nháp và phân công đã lưu</p>
          </div>
          <div className={styles.summaryHeadingActions}>
            <label className={styles.srOnly} htmlFor="summary-faculty">Lọc theo Khoa quản lý ngành</label>
            <select id="summary-faculty" aria-label="Lọc theo Khoa quản lý ngành"
              className={`${styles.control} ${styles.summarySelect}`} value={summaryFaculty} onChange={e => setSummaryFaculty(e.target.value)}>
              <option value="">Tất cả Khoa</option>
              {summaryFaculties.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <button type="button" className={styles.publishButton} disabled={visibleDrafts.length === 0 || !confirmedOpen || publishing} onClick={() => void publishDrafts()}>{publishing ? "Đang lưu..." : `Lưu vào hệ thống (${visibleDrafts.length})`}</button>
            <button type="button" className={styles.exportButton} disabled={summaryRows.length === 0 || exporting} onClick={() => void exportExcel()}>{exporting ? "Đang xuất..." : "Xuất Excel (.xlsx)"}</button>
          </div>
        </div>
        {visibleDrafts.length > 0 && (
          <label className={styles.publishConfirm}>
            <input type="checkbox" checked={confirmedOpen} onChange={e => setConfirmedOpen(e.target.checked)} />
            <span>Tôi đã kiểm tra kế hoạch mở học phần và xác nhận những lớp đang hiển thị đủ điều kiện phân công chính thức.</span>
          </label>
        )}
        {publishMessage && <p className={styles.publishMessage} role="status">{publishMessage}</p>}
        <div className={styles.tableWrap}>
          <table className={styles.summaryTable}>
            <thead><tr><th>STT</th><th>Năm học / HK</th><th>Học phần</th><th>Lớp / Ngành</th><th>Giảng viên / Khoa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {summaryRows.length === 0 ? <tr><td colSpan={7} className={styles.emptyTable}>Không có phân công thuộc Khoa đã chọn. Chọn Tất cả Khoa hoặc tạo bản nháp mới.</td></tr> : summaryRows.map((r, index) => (
                <tr key={`${r.source}-${r.id}`}>
                  <td>{index + 1}</td>
                  <td>{r.schoolYear}<br /><small>Học kỳ {r.semester}</small></td>
                  <td><strong>{r.courseName}</strong><br /><small>{r.courseCode}{r.trainingTrack ? ` · ${r.trainingTrack === "nghien_cuu" ? "Nghiên cứu" : "Ứng dụng"}` : ""}{r.admissionYear ? ` · Khóa ${r.admissionYear}` : ""}</small></td>
                  <td><strong>{r.classCode}</strong><br /><small>{classByCode.get(r.classCode)?.majorName ?? "Chưa cập nhật"}</small><br /><small>{programFacultyForClass(r.classCode) || "Chưa xác định Khoa ngành"}</small></td>
                  <td><strong>{r.teacherName}</strong><br /><small>{r.teacherId} · {facultyOf(r.department) ?? "Chưa xác định Khoa GV"}</small></td>
                  <td><span className={r.source === "draft" ? styles.draftBadge : styles.savedBadge}>{r.source === "draft" ? "Bản nháp" : "Đã lưu"}</span></td>
                  <td>{r.source === "draft"
                    ? <button type="button" className={styles.removeButton} onClick={() => setDrafts(old => old.filter(x => x.id !== r.id))}>Xóa nháp</button>
                    : <button type="button" className={styles.removeButton} disabled={Boolean(removingId)} onClick={() => void removePublishedAssignment(r.id)}>{removingId === r.id ? "Đang hủy..." : "Hủy phân công"}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.tableFooter}><span>Xuất Excel theo kết quả đang lọc.</span><span>Bản nháp chỉ lưu trên trình duyệt; phân công đã lưu trên Backend có thể được giảng viên xem.</span></div>
      </section>
    </section>
  );
}
