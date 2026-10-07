// UI/components/Header.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Header() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Lỗi đọc thông tin người dùng:", e);
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    setIsDropdownOpen(false);
    router.push("/login");
  };

  const isAdmin = currentUser?.role === "admin";
  const displayName = currentUser?.hoTen || (isAdmin ? "Admin Phòng Đào tạo" : currentUser?.maHocVien || "Học viên");
  const avatarChar = displayName.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="header-bar">
      <div className="header-left">
        <button
          className="btn-icon"
          title="Thu gọn/Mở rộng menu"
          onClick={() => {
            const el = document.getElementById("sidebar");
            if (!el) return;
            const next = !el.classList.contains("open");
            el.classList.toggle("open", next);
            el.classList.toggle("collapsed", !next);
            window.dispatchEvent(
              new CustomEvent("sidebar-toggle", { detail: { open: next } })
            );
          }}
        >
          ☰
        </button>
        <h1 className="page-title">Hệ thống Quản lý Đào tạo</h1>
      </div>

      <div className="header-right">
        {currentUser && (
          <div ref={dropdownRef} style={{ position: "relative" }}>
            {/* Khối Avatar & Họ tên */}
            <div
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: isDropdownOpen ? "#f1f5f9" : "transparent",
                transition: "all 0.15s ease",
                userSelect: "none",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: isAdmin ? "#2563eb" : "#7c3aed",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "15px",
                }}
              >
                {avatarChar}
              </div>

              <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#0f172a" }}>
                  {displayName}
                </span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>
                  {isAdmin ? "Quản trị viên" : `Mã HV: ${currentUser.maHocVien}`}
                </span>
              </div>

              <span style={{ fontSize: "10px", color: "#64748b", marginLeft: "4px" }}>
                {isDropdownOpen ? "▲" : "▼"}
              </span>
            </div>

            {/* Dropdown Menu Tinh Gọn */}
            {isDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  width: "220px",
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                  border: "1px solid #e2e8f0",
                  padding: "6px",
                  zIndex: 1000,
                }}
              >
                {/* Tiêu đề Profile */}
                <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", marginBottom: "4px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                    {isAdmin ? "Phòng Đào tạo Sau Đại học" : `MSHV: ${currentUser.maHocVien}`}
                  </div>
                </div>

                {/* 2. Đăng xuất */}
                <div style={{ borderTop: "1px solid #f1f5f9", marginTop: "4px", paddingTop: "4px" }}>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 10px",
                      fontSize: "13px",
                      color: "#dc2626",
                      backgroundColor: "transparent",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontWeight: 600,
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fee2e2")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <span>🚪</span>
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}