// UI/components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const menuAdmin = [
  { href: "/", label: "Bảng điều khiển", icon: "📊", page: "dashboard" },
  { href: "/upload", label: "Upload & Mapping", icon: "📤", page: "upload" },
  {
    href: "/students",
    label: "Quản lý Học viên",
    icon: "👨‍🎓",
    page: "students",
  },
  {
    href: "/teachers",
    label: "Quản lý Giảng viên",
    icon: "👨‍🏫",
    page: "teachers",
  },
  {
    href: "/assignment",
    label: "Phân công giảng dạy",
    icon: "📋",
    page: "assignment",
  },
  {
    href: "/thesis",
    label: "Tiến độ Luận văn",
    icon: "📄",
    page: "thesis",
  },
];

const menuStudent = [
  { href: "/profile", label: "Hồ sơ học viên", icon: "👤", page: "profile" },
  { href: "/grades", label: "Kết quả học tập", icon: "📝", page: "grades" },
  { href: "/schedule", label: "Thời khóa biểu", icon: "🗓️", page: "schedule" },
];

export default function Sidebar({ role = "admin" }: { role?: string }) {
  const pathname = usePathname();
  const items =
    role === "student" ? menuStudent : [...menuAdmin, ...menuStudent];
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

  useEffect(() => {
    closeSidebar();
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

  return (
    <>
      <aside id="sidebar" className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">🎓</div>
          <div className="brand-text">
            <strong>QLĐT Thạc sĩ</strong>
            <span>AGU SĐH</span>
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

        <nav className="sidebar-nav">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname === item.href ? "active" : ""}`}
              onClick={closeSidebar}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
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

      {isOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}
    </>
  );
}