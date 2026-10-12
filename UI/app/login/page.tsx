// UI/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DB } from "../../lib/db";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputUser = username.trim().toLowerCase();

    if (!inputUser) {
      setErrorMsg("Vui lòng nhập Email trường (@student.agu.edu.vn).");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    // 1. Xử lý tài khoản Admin
    const isAdmin =
      inputUser === "admin" ||
      inputUser === "admin@agu.edu.vn" ||
      inputUser === "admin@student.agu.edu.vn";

    if (isAdmin) {
      const loggedInUser = {
        role: "admin",
        maHocVien: "admin",
        hoTen: "Admin Phòng Đào tạo",
        email: "admin@agu.edu.vn",
      };

      localStorage.setItem("currentUser", JSON.stringify(loggedInUser));
      setLoading(false);
      router.push("/");
      return;
    }

    // 2. Xử lý tài khoản Học viên (Kiểm tra Email chính xác)
    try {
      let students = DB.get("students") || [];

      // Nếu LocalStorage chưa có dữ liệu, tự động fetch từ API
      if (!Array.isArray(students) || students.length === 0) {
        const res = await fetch("/api/students?limit=2000");
        if (res.ok) {
          const text = await res.text();
          const result = text ? JSON.parse(text) : null;
          students = Array.isArray(result)
            ? result
            : result?.data || result?.records || [];
        }
      }

      // Đối soát Email nhập vào với dữ liệu học viên
      const foundStudent = students.find((s: any) => {
        const emailInDb = String(s.email || s.Email || "").toLowerCase().trim();
        const maHV = String(
          s.maHocVien || s.ma_hoc_vien || s.mahv || s.id || ""
        )
          .toLowerCase()
          .trim();

        // Các dạng email hợp lệ dựa trên Mã học viên
        const validEmail = maHV ? `${maHV}@student.agu.edu.vn` : "";
        const oldEmail = maHV ? `${maHV}@agu.edu.vn` : "";

        return (
          inputUser === emailInDb ||
          (validEmail && inputUser === validEmail) ||
          (oldEmail && inputUser === oldEmail)
        );
      });

      if (!foundStudent) {
        setErrorMsg(
          "Email không tồn tại trong hệ thống học viên. Vui lòng kiểm tra lại!"
        );
        setLoading(false);
        return;
      }

      // Thông tin học viên đăng nhập thành công
      const studentCode =
        foundStudent.maHocVien ||
        foundStudent.ma_hoc_vien ||
        foundStudent.id ||
        inputUser;
      const fullName =
        foundStudent.hoTen ||
        foundStudent.ho_ten ||
        foundStudent.HO_TEN ||
        foundStudent.hoten ||
        "Học viên";
      
      // Đảm bảo đuôi email chuẩn @student.agu.edu.vn
      let cleanEmail = foundStudent.email || `${studentCode}@student.agu.edu.vn`;
      if (cleanEmail.includes("@agu.edu.vn") && !cleanEmail.includes("@student.agu.edu.vn")) {
        cleanEmail = cleanEmail.replace("@agu.edu.vn", "@student.agu.edu.vn");
      }

      const loggedInUser = {
        role: "student",
        maHocVien: studentCode,
        hoTen: fullName,
        email: cleanEmail,
      };

      localStorage.setItem("currentUser", JSON.stringify(loggedInUser));
      setLoading(false);
      router.push("/profile");
    } catch (err) {
      console.error("Lỗi đăng nhập:", err);
      setErrorMsg("Không thể kết nối đến máy chủ xác thực. Vui lòng thử lại!");
      setLoading(false);
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
            Đăng Nhập Tài Khoản
          </h2>
          <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#64748b" }}>
            Hệ thống Quản lý Đào tạo Sau Đại học
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
              Email trường
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

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: "8px",
              padding: "12px",
              backgroundColor: loading ? "#94a3b8" : "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Đang xác thực..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </div>
  );
}