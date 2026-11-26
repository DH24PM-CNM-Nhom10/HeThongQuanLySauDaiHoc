"use client";

import { useEffect, useState } from "react";
import styles from "./TeacherPortalContent.module.css";
import ChangePasswordForm from "../auth/ChangePasswordForm";

type TeacherUser = {
  role: "teacher";
  teacherId?: string;
  username?: string;
  hoTen?: string;
  shcc?: string;
};

type TeacherProfile = TeacherUser & {
  gioiTinh?: string;
  donVi?: string;
  trinhDoChuyenMon?: string;
  hocHam?: string;
  chuyenMonDaoTao?: string;
};

type TeacherProfileResponse = { success?: boolean; user?: TeacherProfile };

function GiaTri({ value }: { value?: string }) {
  return <>{value?.trim() ? value : <span className={styles.notUpdated}>Chưa cập nhật</span>}</>;
}

function DongHoSo({ label, value }: { label: string; value?: string }) {
  return (
    <div className={styles.field}>
      <dt>{label}</dt>
      <dd><GiaTri value={value} /></dd>
    </div>
  );
}

type AssignedCourse = {
  id: string; teacherId: string; teacherName: string;
  classCode: string; courseCode: string; courseName: string;
  schoolYear: string; semester: string; trainingTrack?: string;
  programSemester?: number; createdAt?: string;
};

function AssignedCoursesForTeacher() {
  const [rows, setRows] = useState<AssignedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/teacher-auth/assignments", {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) throw new Error("Không thể tải phân công. Hãy đăng nhập lại hoặc kiểm tra Backend.");
        const data: { data?: AssignedCourse[] } = await response.json();
        if (!controller.signal.aborted) setRows(Array.isArray(data.data) ? data.data : []);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, []);
  return (
    <section className={styles.profilePage} aria-labelledby="teacher-assignments-title">
      <div className={styles.profileCard}>
        <div className={styles.profileHeader}>
          <h1 id="teacher-assignments-title">Học phần được phân công giảng dạy</h1>
          <span className={styles.rolePill}>{rows.length} lớp học phần</span>
        </div>
        {loading && <p className={styles.teacherAssignmentHint}>Đang tải danh sách phân công...</p>}
        {error && <p role="alert" className={styles.profileWarning}>{error}</p>}
        {!loading && !error && rows.length === 0 &&
          <p className={styles.teacherAssignmentEmpty}>Chưa có học phần nào được Phòng đào tạo lưu phân công cho tài khoản này.</p>}
        {!loading && !error && rows.length > 0 && (
          <div className={styles.teacherAssignmentScroll} tabIndex={0} role="region" aria-label="Bảng dữ liệu">
            <table data-grid="excel" className={"excel-grid " + (styles.teacherAssignmentTable)}>
              <thead><tr><th>Học phần</th><th>Lớp</th><th>Năm học / Học kỳ</th><th>Định hướng</th><th>Nhập điểm</th></tr></thead>
              <tbody>{rows.map(row => (
                <tr key={row.id}>
                  <td><strong>{row.courseName}</strong><small>{row.courseCode}</small></td>
                  <td><strong>{row.classCode}</strong></td>
                  <td>{row.schoolYear}<small>Học kỳ {row.semester}</small></td>
                  <td>{row.trainingTrack === "nghien_cuu" ? "Nghiên cứu" : row.trainingTrack === "ung_dung" ? "Ứng dụng" : "Chưa cập nhật"}</td>
                  <td><span className={styles.teacherAssignmentPending}>Chưa triển khai</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default function TeacherPortalContent({ user, section }: {
  user: TeacherUser;
  section: "profile" | "grades";
}) {
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    if (section !== "profile") return;
    const controller = new AbortController();
    setProfile(null);
    setProfileError(false);

    void (async () => {
      try {
        const response = await fetch("/api/teacher-auth/profile", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Không tải được hồ sơ giảng viên");
        const result: TeacherProfileResponse = await response.json();
        if (result.user?.role !== "teacher" ||
          result.user.teacherId !== user.teacherId) {
          throw new Error("Thông tin phiên không khớp");
        }
        if (!controller.signal.aborted) setProfile(result.user);
      } catch {
        if (!controller.signal.aborted) setProfileError(true);
      }
    })();

    return () => controller.abort();
  }, [section, user.teacherId]);

  // Giai đoạn đầu: giảng viên chỉ XEM các lớp học phần đã được giao,
  // chưa sửa hoặc lưu điểm, tránh giả định nghiệp vụ điểm chưa chốt.
  if (section === "grades") return <AssignedCoursesForTeacher />;

  const current = profile ?? user;
  const full = profile;

  return (
    <div className={styles.profilePage}>
      <section className={styles.profileCard} aria-label="Thông tin giảng viên">
        {profileError && (
          <p role="status" className={styles.profileWarning}>
            Chưa tải được thông tin chuyên môn từ máy chủ. Đang hiển thị thông tin tài khoản đã xác thực.
          </p>
        )}
        <div className={styles.profileColumns}>
          <div className={styles.profileSection}>
            <h2>Thông tin cá nhân và tài khoản</h2>
            <dl className={styles.profileFields}>
              <DongHoSo label="Họ và tên" value={current.hoTen} />
              <DongHoSo label="Mã GV / SHCC" value={current.shcc || current.teacherId} />
              <DongHoSo label="Giới tính" value={full?.gioiTinh} />
              <DongHoSo label="Tên đăng nhập" value={current.username} />
              <DongHoSo label="Vai trò" value="Giảng viên" />
            </dl>
          </div>
          <div className={styles.profileSection}>
            <h2>Thông tin chuyên môn</h2>
            <dl className={styles.profileFields}>
              <DongHoSo label="Đơn vị / Bộ môn" value={full?.donVi} />
              <DongHoSo label="Trình độ chuyên môn" value={full?.trinhDoChuyenMon} />
              <DongHoSo label="Học hàm" value={full?.hocHam} />
              <DongHoSo label="Chuyên môn đào tạo" value={full?.chuyenMonDaoTao} />
            </dl>
          </div>
        </div>
      </section>
      <details>
        <summary>Đổi mật khẩu</summary>
        <ChangePasswordForm role="teacher" />
      </details>
    </div>
  );
}
