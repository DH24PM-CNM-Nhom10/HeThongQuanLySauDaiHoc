"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DB, type StoredRecord } from "../lib/db";
import styles from "./StudentPortalContent.module.css";
import StudentCertificates from "./student-certificates/StudentCertificates";

export type StudentSection = "profile" | "schedule" | "grades" | "progress";
type User = { role?: string; maHocVien?: string; hoTen?: string; email?: string };
type Result<T> = { data: T[]; ready: boolean };

function textVal(row: StoredRecord | null, ...keys: string[]): string {
  if (!row) return "";
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return "";
}
function normalized(value: string): string { return value.trim().toLocaleLowerCase("vi-VN"); }
function formatDate(value: string): string {
  if (!value) return "—";
  const serial = Number(value);
  if (Number.isFinite(serial) && serial > 30000 && serial < 70000) {
    const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return new Intl.DateTimeFormat("vi-VN", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
  }
  return value;
}
function ownRecord(row: StoredRecord, code: string): boolean {
  const key = textVal(row, "maHocVien", "ma_hoc_vien", "mahv", "masv", "MA_HOC_VIEN");
  return Boolean(key && code && normalized(key) === normalized(code));
}
async function collection(key: string): Promise<StoredRecord[]> {
  const saved = DB.get(key);
  if (saved.length) return saved;
  try {
    const res = await fetch(`/api/${key}?limit=10000`, { cache: "no-store" });
    if (!res.ok) return [];
    const json: unknown = await res.json();
    let list: unknown = json;
    if (!Array.isArray(json) && json && typeof json === "object") {
      const response = json as Record<string, unknown>;
      list = response.data ?? response.records;
    }
    return Array.isArray(list) ? list.filter((item): item is StoredRecord => !!item && typeof item === "object" && !Array.isArray(item)) : [];
  } catch { return []; }
}

function Empty({ title, description }: { title: string; description: string }) {
  return <div className={styles.empty}><strong>{title}</strong><p>{description}</p></div>;
}
function Field({ label, value }: { label: string; value: string }) {
  return <div className={styles.field}><span>{label}</span><strong>{value || "Chưa cập nhật"}</strong></div>;
}
function Table({ columns, rows }: { columns: {label:string; keys:string[]}[]; rows: StoredRecord[] }) {
  return <div className={styles.tableScroll}><table className={styles.table}><thead><tr>{columns.map(c=><th key={c.label} scope="col">{c.label}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={textVal(row,"id") || i}>{columns.map(c=><td key={c.label}>{textVal(row,...c.keys) || "—"}</td>)}</tr>)}</tbody></table></div>;
}

const SECTION_NAMES: Record<StudentSection, string> = {
  profile: "Hồ sơ học viên",
  schedule: "Thời khóa biểu",
  grades: "Bảng điểm",
  progress: "Tiến độ học tập",
};

export default function StudentPortalContent({ section }: { section: StudentSection }) {
  const [user, setUser] = useState<User | null>(null);
  const [student, setStudent] = useState<StoredRecord | null>(null);
  const [schedule, setSchedule] = useState<Result<StoredRecord>>({ data: [], ready: false });
  const [grades, setGrades] = useState<Result<StoredRecord>>({ data: [], ready: false });
  const [ready, setReady] = useState(false);
  const [semester, setSemester] = useState("all");

  useEffect(() => {
    let active = true;
    async function load() {
      let session: User | null = null;
      try { session = JSON.parse(localStorage.getItem("currentUser") || "null") as User | null; } catch { /* invalid local state */ }
      if (!active) return;
      setUser(session);
      const code = String(session?.maHocVien || "");
      // Chỉ tìm chính xác mã học viên; không hiển thị hồ sơ học viên khác.
      const [students, classes, marks] = await Promise.all([collection("students"), collection("schedule"), collection("grades")]);
      if (!active) return;
      const mine = students.find(row => ownRecord(row, code)) || null;
      setStudent(mine);
      setSchedule({ data: classes, ready: true });
      setGrades({ data: marks.filter(row => ownRecord(row, code)), ready: true });
      setReady(true);
    }
    void load();
    return () => { active = false; };
  }, []);

  const code = String(user?.maHocVien || "");
  const myClass = textVal(student, "lop", "maLop", "lopHoc");
  const myMajor = textVal(student, "tenNganh", "nganh", "chuyenNganh");
  const matches = useMemo(() => {
    const direct = schedule.data.filter(row => ownRecord(row, code));
    if (direct.length) return { rows: direct, scope: "personal" as const };
    const byClass = schedule.data.filter(row => {
      const c = textVal(row, "lop", "maLop", "lopHoc");
      return c && myClass && normalized(c) === normalized(myClass);
    });
    if (byClass.length) return { rows: byClass, scope: "class" as const };
    const byMajor = schedule.data.filter(row => {
      const n = textVal(row, "nganh", "tenNganh", "chuyenNganh");
      return n && myMajor && normalized(n) === normalized(myMajor);
    });
    return { rows: byMajor, scope: "major" as const };
  }, [schedule.data, code, myClass, myMajor]);
  const semesterRows = section === "schedule" ? matches.rows : grades.data;
  const semesters = useMemo(() => [...new Set(semesterRows.map(row => textVal(row,"hocKy","hoc_ky")).filter(Boolean))].sort().reverse(), [semesterRows]);
  const displayRows = semester === "all" ? semesterRows : semesterRows.filter(row => textVal(row,"hocKy","hoc_ky") === semester);

  const scoreRows = grades.data.filter(row => textVal(row,"diemTK","diemTongKet","diem_tk") !== "");
  const status = textVal(student,"trangThai","trang_thai");
  const thesisName = textVal(student,"tenLuanVan","ten_de_tai");
  const thesisStatus = textVal(student,"trangThaiLv","trang_thai_luan_van");
  const graduated = Boolean(textVal(student,"ngayTotNghiep","ngay_tot_nghiep")) || normalized(status).includes("tốt nghiệp");
  const enrolled = Boolean(textVal(student,"ngayNhapHoc","ngay_nhap_hoc"));

  return <section className={styles.portal} aria-label={SECTION_NAMES[section]}>
    {!ready ? <div className={styles.loading}>Đang tải dữ liệu học viên...</div> : !user || user.role !== "student" ?
      <Empty title="Chức năng dành cho học viên" description="Vui lòng đăng nhập bằng tài khoản học viên để xem thông tin học tập."/> :
      <>
        <div className={styles.studentBar}><span><strong>{textVal(student,"hoTen","ho_ten") || user.hoTen || "Học viên"}</strong><small>Mã học viên: {code || "Chưa xác định"}</small></span></div>
        {section === "profile" && (student ? <div className={styles.gridFields}>
          <Field label="Họ và tên" value={textVal(student,"hoTen","ho_ten")}/>
          <Field label="Mã học viên" value={code}/>
          <Field label="Lớp" value={myClass}/>
          <Field label="Ngành đào tạo" value={myMajor}/>
          <Field label="Trình độ" value={textVal(student,"trinhDo","trinh_do")}/>
          <Field label="Trạng thái" value={status}/>
          <Field label="Ngày nhập học" value={formatDate(textVal(student,"ngayNhapHoc","ngay_nhap_hoc"))}/>
          <Field label="Email" value={textVal(student,"email") || user.email || ""}/>
          {thesisName && <div className={styles.fullRow}><Field label="Đề tài luận văn" value={thesisName}/></div>}
        </div> : <Empty title="Chưa tìm thấy hồ sơ" description="Không tìm thấy bản ghi học viên khớp mã đăng nhập. Vui lòng liên hệ Phòng Đào tạo để kiểm tra dữ liệu."/>)}
        {section === "schedule" && <>
          {matches.rows.length > 0 && <p className={styles.infoBanner}>
            {matches.scope === "major" ? "Đây là lịch chung theo ngành, chưa xác nhận là các lớp bạn đã đăng ký." : matches.scope === "class" ? "Lịch được tìm theo lớp học viên; vui lòng đối chiếu với lịch đăng ký thực tế." : "Các lớp học được tìm theo mã học viên."}
          </p>}
          {matches.rows.length ? <>
            <div className={styles.toolbar}><label htmlFor="semesterSchedule">Học kỳ</label><select id="semesterSchedule" value={semester} onChange={e=>setSemester(e.target.value)}><option value="all">Tất cả học kỳ</option>{semesters.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
            <Table rows={displayRows} columns={[{label:"Học kỳ",keys:["hocKy"]},{label:"Môn học",keys:["tenMon"]},{label:"Giảng viên",keys:["tenGV"]},{label:"Thời gian",keys:["thoiGian"]},{label:"Phòng",keys:["phong"]}]} />
          </> : <Empty title="Chưa có thời khóa biểu" description="Hiện chưa có lịch học liên kết với mã học viên, lớp hoặc ngành của bạn. Khi dữ liệu lịch được cập nhật, thông tin sẽ xuất hiện tại đây."/>}
        </>}
        {section === "grades" && (grades.data.length ? <>
          <div className={styles.toolbar}><label htmlFor="semesterGrade">Học kỳ</label><select id="semesterGrade" value={semester} onChange={e=>setSemester(e.target.value)}><option value="all">Tất cả học kỳ</option>{semesters.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
          <Table rows={displayRows} columns={[{label:"Học kỳ",keys:["hocKy"]},{label:"Học phần",keys:["tenMon"]},{label:"Điểm quá trình",keys:["diemQT"]},{label:"Điểm thi",keys:["diemThi"]},{label:"Tổng kết",keys:["diemTK"]},{label:"Xếp loại",keys:["xepLoai"]}]}/>
          <p className={styles.note}>Chỉ hiển thị các bản ghi gắn đúng mã học viên; việc công nhận kết quả và tín chỉ căn cứ quy định chính thức của nhà trường.</p>
        </> : <Empty title="Chưa có bảng điểm" description="Chưa tìm thấy kết quả học phần được liên kết với mã học viên của bạn."/>)}
        {section === "progress" && <>
          <div className={styles.stats}>
            <div><span>Học phần đã có điểm</span><strong>{scoreRows.length}</strong><small>Không đồng nghĩa đã tích lũy tín chỉ</small></div>
            <div><span>Trạng thái đào tạo</span><strong className={styles.statusText}>{status || "Chưa cập nhật"}</strong><small>Theo hồ sơ hiện có</small></div>
          </div>
          <h2 className={styles.subTitle}>Các mốc được ghi nhận</h2>
          <ol className={styles.timeline}>
            <li><div><strong>Nhập học</strong><p>{enrolled ? `Ngày ${formatDate(textVal(student,"ngayNhapHoc","ngay_nhap_hoc"))}` : "Chưa cập nhật ngày nhập học"}</p></div></li>
            <li><div><strong>Học các học phần</strong><p>{grades.data.length ? `Đã ghi nhận ${grades.data.length} kết quả học phần, trong đó ${scoreRows.length} học phần có điểm tổng kết.` : "Chưa có dữ liệu điểm học phần."}</p></div></li>
            <li><div><strong>Luận văn / Đề án</strong><p>{thesisName ? `${thesisName}${thesisStatus ? ` — ${thesisStatus}` : ""}` : "Chưa cập nhật đề tài hoặc kết quả nghiên cứu."}</p></div></li>
            <li><div><strong>Tốt nghiệp</strong><p>{graduated ? "Hồ sơ đã có thông tin tốt nghiệp." : "Chưa có thông tin công nhận tốt nghiệp."}</p></div></li>
          </ol>
          <p className={styles.infoBanner}>Chưa thể tính phần trăm hoàn thành hoặc tín chỉ còn thiếu vì dữ liệu hiện tại chưa có kế hoạch học tập và tổng số tín chỉ yêu cầu cho từng học viên.</p>
          <div className={styles.links}><Link href="/grades">Xem bảng điểm</Link><Link href="/schedule">Xem thời khóa biểu</Link></div>
          <StudentCertificates key={code} student={student} studentCode={code} studentName={user.hoTen || ""} />
        </>}
      </>
    }
  </section>;
}
