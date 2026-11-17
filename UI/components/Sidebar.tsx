"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";

const MOBILE_BREAKPOINT = 900;

const menuOverview = [
  { href: "/admin", label: "Bảng điều khiển" },
  { href: "/", label: "Cổng thông tin" },
];

const menuAdmin = [
  {
    href: "/students",
    label: "Quản lý học viên",
  },
  {
    href: "/teachers",
    label: "Quản lý giảng viên",
  },
  {
    href: "/assignment",
    label: "Phân công giảng dạy",
  },
  {
    href: "/thesis",
    label: "Tiến độ luận văn",
  },
  { href: "/upload", label: "Upload & mapping" },
];

const menuStudent = [
  { href: "/home", label: "Trang chủ thông báo", icon: "🏠", page: "home" },
  { href: "/profile", label: "Hồ sơ học viên", icon: "👤", page: "profile" },
  { href: "/grades", label: "Kết quả học tập", icon: "📝", page: "grades" },
  { href: "/schedule", label: "Thời khóa biểu", icon: "🗓️", page: "schedule" },
  { href: "/tien-do-hoc-tap", label: "Tiến độ học tập", icon: "📈", page: "progress" },
];

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

export default function Sidebar({ role = "admin" }: { role?: string }) {
  const pathname = usePathname();
  const isStudent = role === "student";
  const groups = isStudent
    ? [{ label: "", items: menuStudent }]
    : [
      { label: "Tổng quan", items: menuOverview },
      { label: "Quản lý đào tạo", items: menuAdmin },
    ];
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => {
    const el = document.getElementById("sidebar");
    if (!el) return;
    const next = !el.classList.contains("open");
    el.classList.toggle("open", next);
    el.classList.toggle("collapsed", !next);
    setIsOpen(next);
  };

  const closeSidebar = () => {
    const el = document.getElementById("sidebar");
    if (!el) return;
    el.classList.remove("open");
    el.classList.add("collapsed");
    setIsOpen(false);
  };

  // Chỉ tự đóng sidebar khi chuyển trang trên mobile.
  // Desktop: giữ trạng thái mở (không thêm class collapsed).
  useEffect(() => {
    if (isMobileViewport()) {
      closeSidebar();
    }
  }, [pathname]);

  useEffect(() => {
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.open === "boolean") {
        setIsOpen(detail.open);
      } else {
        toggleSidebar();
      }
    };
    window.addEventListener("sidebar-toggle", onToggle);
    return () => window.removeEventListener("sidebar-toggle", onToggle);
  }, []);

  const handleNavClick = () => {
    // Overlay + auto-close chỉ cần trên mobile
    if (isMobileViewport()) {
      closeSidebar();
    }
  };

  return (
    <>
      <aside id="sidebar" className={isStudent ? "sidebar" : "sidebar sidebar-admin"}>
        <div className="sidebar-brand">
          <div className="brand-icon" aria-hidden="true">
            {isStudent ? "🎓" : <GraduationCap size={24} />}
          </div>
          <div className="brand-text">
            <strong>Đại học An Giang</strong>
            <span>{isStudent ? "AGU SĐH" : "Quản lý đào tạo sau đại học"}</span>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={closeSidebar}
            title="Đóng menu"
            aria-label="Đóng menu"
          >
            ‹
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Điều hướng chính">
          {groups.map(({ label, items }) => (
            <div key={label} className="sidebar-group">
              {label && <h2 className="sidebar-group-title">{label}</h2>}
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${pathname === item.href ? "active" : ""}`}
                  aria-current={pathname === item.href ? "page" : undefined}
                  onClick={handleNavClick}
                >
                  {"icon" in item && typeof item.icon === "string" && (
                    <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  )}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <button
        type="button"
        className={`sidebar-toggle-fab ${isOpen ? "hidden" : ""}`}
        onClick={toggleSidebar}
        title="Mở menu"
        aria-label="Mở menu"
      >
        ›
      </button>

      {isOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}
    </>
  );
}
