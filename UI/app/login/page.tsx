// UI/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DB } from "../../lib/db";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const inputUser = username.trim();

    if (!inputUser) {
      setErrorMsg("Vui lòng nhập Tên đăng nhập hoặc Mã học viên.");
      return;
    }

    const isAdmin = inputUser.toLowerCase() === "admin";

    if (!isAdmin) {
      const students = DB.get("students") || [];
      const foundStudent = students.find((s: any) => {
        const maHV = String(s.maHocVien || s.ma_hoc_vien || s.masv || s.mahv || "").toLowerCase();
        const cccd = String(s.cccd || s.cmnd || "").toLowerCase();
        return maHV === inputUser.toLowerCase() || cccd === inputUser.toLowerCase();
      });

      if (!foundStudent) {
        setErrorMsg("Mã học viên không tồn tại trong hệ thống. Vui lòng kiểm tra lại!");
        return;
      }

      const fullName = foundStudent.hoTen || foundStudent.ho_ten || foundStudent.HO_TEN || foundStudent.hoten || "Học viên";
      const studentCode = foundStudent.maHocVien || foundStudent.ma_hoc_vien || inputUser;

      const loggedInUser = {
        role: "student",
        maHocVien: studentCode,
        hoTen: fullName,
      };

      localStorage.setItem("currentUser", JSON.stringify(loggedInUser));
      router.push("/profile");
    } else {
      const loggedInUser = {
        role: "admin",
        maHocVien: "admin",
        hoTen: "Admin Phòng Đào tạo",
      };

      localStorage.setItem("currentUser", JSON.stringify(loggedInUser));
      router.push("/");
    }
  };

  const fontSans = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f172a",
        fontFamily: fontSans,
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "400px",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          padding: "36px 30px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "44px", marginBottom: "8px" }}>🎓</div>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>
            Đăng Nhập Hệ Thống
          </h2>
          <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#64748b" }}>
            Quản lý Đào tạo Sau Đại học
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              backgroundColor: "#fee2e2",
              color: "#991b1b",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              marginBottom: "18px",
              fontWeight: 500,
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Tên đăng nhập / Mã học viên
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setErrorMsg("");
              }}
              style={{
                width: "100%",
                padding: "11px 14px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Mật khẩu
            </label>
            <div style={{ position: "relative", width: "100%" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 40px 11px 14px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "16px",
                  color: "#64748b",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  userSelect: "none",
                }}
              >
                {showPassword ? "👁️" : "🙈"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            style={{
              marginTop: "8px",
              padding: "12px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Đăng nhập
          </button>
        </form>

        <div style={{ marginTop: "20px", textAlign: "center", fontSize: "12px", color: "#94a3b8" }}>
        </div>
      </div>
    </div>
  );
}