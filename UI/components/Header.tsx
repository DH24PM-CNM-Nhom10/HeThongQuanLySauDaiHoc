
"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logoutSessions } from "../lib/session-client";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
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
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    const destination =
      currentUser?.role === "admin" || currentUser?.role === "training_office"
        ? "/admin"
        : "/";
    await logoutSessions();
    localStorage.removeItem("currentUser");
    localStorage.removeItem("aguAuthSource");
    setIsDropdownOpen(false);
    if (pathname === destination) window.dispatchEvent(new Event("agu-auth-changed"));
    router.replace(destination);
  };

  const isAdmin = currentUser?.role === "admin";
  const isTeacher = currentUser?.role === "teacher";
  const isOffice = currentUser?.role === "training_office";

  const displayName =
    currentUser?.hoTen ||
    (isAdmin
      ? "Admin Phòng Đào tạo"
      : isOffice
      ? "Phòng Đào tạo"
      : currentUser?.maHocVien || "Học viên");

  const avatarChar =
    displayName.trim().charAt(0).toUpperCase() || "U";

  return (
    <div className="header-bar">
      <div className="header-left">
        <button
          type="button"
          className="btn-icon"
          title="Thu gọn/Mở rộng menu"
          onClick={() => {
            const el = document.getElementById("sidebar");
            if (!el) return;

            const next = !el.classList.contains("open");

            el.classList.toggle("open", next);
            el.classList.toggle("collapsed", !next);

            window.dispatchEvent(
              new CustomEvent("sidebar-toggle", {
                detail: { open: next },
              })
            );
          }}
        >
          ☰
        </button>

        <h1 className="page-title">
          Quản lý đào tạo sau đại học
        </h1>
      </div>

      <div className="header-right">
        {currentUser && (
          <div
            ref={dropdownRef}
            style={{ position: "relative" }}
          >
            {/* Avatar & Thông tin tài khoản */}
            <div
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                padding: "6px 12px",
                borderRadius: "8px",
                backgroundColor: isDropdownOpen
                  ? "#f1f5f9"
                  : "transparent",
                transition: "all 0.15s ease",
                userSelect: "none",
              }}
            >
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: isAdmin
                    ? "#2563eb"
                    : "#7c3aed",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "15px",
                  flexShrink: 0,
                }}
              >
                {avatarChar}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    fontSize: "13.5px",
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  {displayName}
                </span>

                <span
                  style={{
                    fontSize: "11px",
                    color: "#64748b",
                  }}
                >
                  {isAdmin
                    ? "Quản trị viên"
                    : isOffice
                    ? "Phòng đào tạo"
                    : isTeacher
                    ? `Mã GV: ${
                        currentUser.shcc ||
                        currentUser.teacherId ||
                        "Chưa cập nhật"
                      }`
                    : `Mã HV: ${currentUser.maHocVien}`}
                </span>
              </div>

              <span
                style={{
                  fontSize: "10px",
                  color: "#64748b",
                  marginLeft: "4px",
                }}
              >
                {isDropdownOpen ? "▲" : "▼"}
              </span>
            </div>

            {/* Menu tài khoản đồng bộ với trang chủ */}
            {isDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  width: "min(355px, calc(100vw - 24px))",
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  boxShadow:
                    "0 12px 28px rgba(20, 40, 75, 0.15)",
                  border: "1px solid #e3e8f0",
                  padding: "12px",
                  zIndex: 1000,
                }}
              >
                {/* Thông tin tài khoản */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                    padding: "9px 10px 12px",
                  }}
                >
                  <strong
                    style={{
                      fontSize: "13.5px",
                      fontWeight: 750,
                      color: "#173153",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {displayName}
                  </strong>

                  <span
                    style={{
                      fontSize: "12px",
                      color: "#7186a2",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {isAdmin
                      ? "Phòng Đào tạo Sau Đại học"
                      : isOffice
                      ? currentUser.username || "Phòng đào tạo"
                      : isTeacher
                      ? currentUser.username ||
                        "Tài khoản giảng viên"
                      : `MSHV: ${currentUser.maHocVien}`}
                  </span>
                </div>

                {/* Đường phân cách */}
                <div
                  style={{
                    height: "1px",
                    backgroundColor: "#e9edf3",
                    margin: "1px 0 8px",
                  }}
                />

                {/* Nút Đăng xuất */}
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    minHeight: "54px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    gap: "12px",
                    padding: "12px 15px",
                    borderRadius: "9px",
                    border: "1px solid #f0aa82",
                    backgroundColor: "#fce2d1",
                    color: "#b74416",
                    fontSize: "15px",
                    fontWeight: 500,
                    fontFamily: "inherit",
                    textAlign: "left",
                    cursor: "pointer",
                    transition:
                      "background-color 0.2s ease, border-color 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "#fbd4bd";
                    e.currentTarget.style.borderColor =
                      "#e89a6c";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "#fce2d1";
                    e.currentTarget.style.borderColor =
                      "#f0aa82";
                  }}
                >
                  <LogOut
                    size={18}
                    strokeWidth={2}
                    aria-hidden="true"
                    style={{ flexShrink: 0 }}
                  />
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
