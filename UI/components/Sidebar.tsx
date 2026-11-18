"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 900;
const menuAdmin = [
  { href: "/", label: "Cổng thông tin", icon: "🌐" },
  { href: "/admin", label: "Bảng điều khiển", icon: "📊" },
  { href: "/upload", label: "Upload & Mapping", icon: "📤" },
  { href: "/students", label: "Quản lý Học viên", icon: "👨‍🎓" },
  { href: "/teachers", label: "Quản lý Giảng viên", icon: "👨‍🏫" },
  { href: "/assignment", label: "Phân công giảng dạy", icon: "📋" },
  { href: "/thesis", label: "Tiến độ Luận văn", icon: "📄" },
];
const menuStudent = [
  { href: "/home", label: "Trang chủ thông báo", icon: "🏠" },
  { href: "/profile", label: "Hồ sơ học viên", icon: "👤" },
  { href: "/grades", label: "Kết quả học tập", icon: "📝" },
  { href: "/schedule", label: "Thời khóa biểu", icon: "🗓️" },
  { href: "/tien-do-hoc-tap", label: "Tiến độ học tập", icon: "📈" },
];
// Tránh hiển thị những trang Admin/học viên không được phân quyền.
const menuTeacher = [
  { href: "/", label: "Cổng thông tin", icon: "🌐" },
  { href: "/grades", label: "Quản lý điểm số", icon: "📝" },
];
const menuOffice = [
  { href: "/", label: "Cổng thông tin", icon: "🌐" },
  { href: "/assignment", label: "Phân công giảng dạy", icon: "📋" },
];
function isMobileViewport() { return typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT; }

export default function Sidebar({ role = "admin" }: { role?: string }) {
  const pathname = usePathname();
  const items = role === "teacher" ? menuTeacher : role === "training_office" ? menuOffice : role === "student" ? menuStudent : [...menuAdmin, ...menuStudent];
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
  useEffect(() => { if (isMobileViewport()) closeSidebar(); }, [pathname]);
  useEffect(() => {
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.open === "boolean") setIsOpen(detail.open);
      else toggleSidebar();
    };
    window.addEventListener("sidebar-toggle", onToggle);
    return () => window.removeEventListener("sidebar-toggle", onToggle);
  }, []);
  return <>
    <aside id="sidebar" className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">🎓</div>
        <div className="brand-text"><strong>QLĐT Thạc sĩ</strong><span>AGU SĐH</span></div>
        <button type="button" className="sidebar-close-btn" onClick={closeSidebar} title="Đóng menu" aria-label="Đóng menu">‹</button>
      </div>
      <nav className="sidebar-nav" aria-label="Menu theo quyền truy cập">
        {items.map(item => <Link key={item.href} href={item.href}
          className={`nav-item ${pathname === item.href ? "active" : ""}`}
          onClick={() => { if (isMobileViewport()) closeSidebar(); }}>
          <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
        </Link>)}
      </nav>
    </aside>
    <button type="button" className={`sidebar-toggle-fab ${isOpen ? "hidden" : ""}`} onClick={toggleSidebar} title="Mở menu" aria-label="Mở menu">›</button>
    {isOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}
  </>;
}
