// UI/components/Navbar.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Kiểm tra phiên đăng nhập từ localStorage
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Lỗi đọc thông tin đăng nhập:", e);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    setCurrentUser(null);
    router.push("/login");
  };

  return (
    <nav className="navbar navbar-expand navbar-light navbar-bg" style={{ display: "flex", justifyContent: "space-between", padding: "12px 24px", backgroundColor: "#ffffff", borderBottom: "1px solid #e2e8f0" }}>
      <a className="sidebar-toggle js-sidebar-toggle" style={{ cursor: "pointer" }}>
        <i className="hamburger align-self-center"></i>
      </a>

      <div className="navbar-collapse collapse" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
        {currentUser ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>
              👤 {currentUser.role === "admin" ? "Admin" : `Học viên: ${currentUser.maHocVien}`}
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: "6px 12px",
                backgroundColor: "#dc2626",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Đăng xuất
            </button>
          </div>
        ) : (
          <a
            href="/login"
            style={{
              padding: "8px 16px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              borderRadius: "6px",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 600,
              display: "inline-block",
            }}
          >
            🔑 Đăng nhập
          </a>
        )}
      </div>
    </nav>
  );
}