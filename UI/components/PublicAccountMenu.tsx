"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import styles from "./PublicAccountMenu.module.css";

type AccountUser = {
  role: "admin" | "student" | "teacher" | "training_office";
  hoTen?: string;
  username?: string;
  email?: string;
  shcc?: string;
  teacherId?: string;
  maHocVien?: string;
};

type Props = {
  user: AccountUser;
  onLogout: () => void | Promise<void>;
};

const managementRoute: Record<string, string> = {
  admin: "/admin",
  teacher: "/grades",
  training_office: "/assignment",
};

export default function PublicAccountMenu({ user, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const closeWhenOutside = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const name = user.hoTen || user.username || (user.role === "training_office" ? "Phòng đào tạo" : "Người dùng");
  const identity = user.username || user.email ||
    (user.role === "teacher" ? `Mã GV: ${user.shcc || user.teacherId || "Chưa cập nhật"}` :
      user.role === "student" ? `Mã HV: ${user.maHocVien || "Chưa cập nhật"}` :
      user.role === "training_office" ? "Phòng đào tạo" : "Quản trị viên");
  const caption = user.role === "teacher" ? `Mã GV: ${user.shcc || user.teacherId || "Chưa cập nhật"}` :
    user.role === "student" ? `Mã HV: ${user.maHocVien || "Chưa cập nhật"}` :
    user.role === "training_office" ? "Phòng đào tạo" : "Quản trị viên";
  const managementHref = managementRoute[user.role];

  return (
    <div className={styles.headerActions}>
      {managementHref && (
        <Link href={managementHref} className={styles.managementButton}>
          Trang quản trị
        </Link>
      )}
      <div className={styles.account} ref={panelRef}>
        <button
          type="button"
          className={`${styles.accountTrigger} ${open ? styles.accountTriggerOpen : ""}`}
          onClick={() => setOpen(value => !value)}
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`Tài khoản ${name}. ${open ? "Đóng" : "Mở"} menu tài khoản`}
        >
          <span className={styles.avatar} aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "U"}</span>
          <span className={styles.accountText}>
            <strong title={name}>{name}</strong>
            <small title={caption}>{caption}</small>
          </span>
          <span className={styles.arrow} aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>

        {open && (
          <div id={panelId} className={styles.dropdown} role="group" aria-label="Thông tin tài khoản">
            <div className={styles.dropdownProfile}>
              <strong>{name}</strong>
              <span title={identity}>{identity}</span>
            </div>
            <div className={styles.menuDivider} />
            <button
              type="button"
              className={styles.logoutButton}
              onClick={() => { setOpen(false); void onLogout(); }}
            >
              <span aria-hidden="true">↪</span>
              Đăng xuất
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
