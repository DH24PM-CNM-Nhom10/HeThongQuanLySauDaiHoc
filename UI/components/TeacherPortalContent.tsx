"use client";

import { useEffect, useState } from "react";
import styles from "./TeacherPortalContent.module.css";

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

  // Phần Nhập điểm học phần vẫn để trống theo yêu cầu.
  if (section === "grades") return null;

  const current = profile ?? user;
  const full = profile;

  return (
    <div className={styles.profilePage}>
      <section className={styles.profileCard} aria-labelledby="teacher-profile-title">
        <div className={styles.profileHeader}>
          <h1 id="teacher-profile-title">Hồ sơ giảng viên</h1>
          <span className={styles.rolePill}>Giảng viên</span>
        </div>
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
        <p className={styles.profileHint}>
          Thông tin được lấy từ hồ sơ giảng viên hiện có của hệ thống. Những mục chưa có dữ liệu được ghi rõ “Chưa cập nhật”.
        </p>
      </section>
    </div>
  );
}
