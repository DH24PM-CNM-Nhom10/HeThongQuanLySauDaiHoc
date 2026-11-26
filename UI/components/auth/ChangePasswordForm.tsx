"use client";

import { useState } from "react";
import styles from "./ChangePasswordForm.module.css";
import type { SessionUser } from "../../lib/session-client";

type Props = {
  role: "student" | "teacher";
};

function isSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<SessionUser>;
  return user.role === "student" || user.role === "teacher";
}

function responseMessage(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("message" in value)) return null;
  const message = (value as { message?: unknown }).message;
  if (typeof message === "string") return message;
  if (Array.isArray(message) && message.every(item => typeof item === "string")) {
    return message.join(" ");
  }
  return null;
}

export default function ChangePasswordForm({ role }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    if (newPassword !== confirmation) {
      setError("Mật khẩu mới và phần xác nhận không khớp.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const endpoint = role === "student" ? "/api/student-records" : "/api/teacher-auth";
      const response = await fetch(`${endpoint}/change-password`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      let data: unknown = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (!response.ok) {
        throw new Error(responseMessage(data) || `Không thể đổi mật khẩu (HTTP ${response.status}).`);
      }
      const user = data && typeof data === "object" && "user" in data
        ? (data as { user?: unknown }).user
        : null;
      if (!isSessionUser(user) || user.role !== role || user.mustChangePassword !== false) {
        throw new Error("Máy chủ trả về trạng thái tài khoản không hợp lệ. Vui lòng đăng nhập lại.");
      }

      localStorage.setItem("currentUser", JSON.stringify(user));
      window.dispatchEvent(new Event("agu-auth-changed"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đổi mật khẩu. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="change-password-heading">
      <div className={styles.intro}>
        <span className={styles.eyebrow}>BẢO MẬT TÀI KHOẢN</span>
        <h2 id="change-password-heading">Đổi mật khẩu</h2>
        <p>
          Mật khẩu mới cần có từ 8 đến 128 ký tự. Không dùng lại mật khẩu hiện tại.
        </p>
      </div>
      {success ? (
        <div className={styles.success} role="status">
          <strong>Đổi mật khẩu thành công.</strong>
          <span>Từ lần đăng nhập tiếp theo, hãy sử dụng mật khẩu mới.</span>
          <button type="button" onClick={() => setSuccess(false)}>Đổi mật khẩu khác</button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={event => void submit(event)}>
          <label>
            <span>Mật khẩu hiện tại</span>
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              maxLength={200}
              value={currentPassword}
              onChange={event => { setCurrentPassword(event.target.value); setError(""); }}
              required
            />
          </label>
          <label>
            <span>Mật khẩu mới</span>
            <input
              type="password"
              name="newPassword"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={newPassword}
              onChange={event => { setNewPassword(event.target.value); setError(""); }}
              required
            />
          </label>
          <label>
            <span>Xác nhận mật khẩu mới</span>
            <input
              type="password"
              name="confirmation"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              value={confirmation}
              onChange={event => { setConfirmation(event.target.value); setError(""); }}
              required
            />
          </label>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="submit" disabled={saving}>
            {saving ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
          </button>
        </form>
      )}
    </section>
  );
}
