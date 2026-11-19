"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";

const MOBILE_BREAKPOINT = 900;

const adminGroups = [
  {
    label: "Tổng quan",
    items: [{ href: "/admin", label: "Bảng điều khiển" }],
  },
  {
    label: "Hồ sơ đào tạo",
    items: [
      { href: "/students", label: "Quản lý học viên" },
      { href: "/teachers", label: "Quản lý giảng viên" },
    ],
  },
  {
    label: "Điều hành đào tạo",
    items: [
      { href: "/assignment", label: "Phân công giảng dạy" },
      { href: "/thesis", label: "Tiến độ luận văn" },
      { href: "/admin/diem", label: "Duyệt và công bố điểm" },
    ],
  },
  {
    label: "Dữ liệu",
    items: [{ href: "/upload", label: "Nhập và ánh xạ dữ liệu" },
      { href: "/admin/danh-muc", label: "Danh mục đào tạo" }],
  },
  {
    label: "Trang công khai",
    items: [{ href: "/", label: "Cổng thông tin" }],
  },
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
  const groups = role === "teacher"
    ? [{ label: "Giảng dạy", items: [
        { href: "/", label: "Cổng thông tin" },
        { href: "/giang-vien/tra-cuu-diem", label: "Bảng điểm" },
      ] }]
    : role === "training_office"
      ? [{ label: "Phòng đào tạo", items: [
          { href: "/", label: "Cổng thông tin" },
          { href: "/assignment", label: "Phân công giảng dạy" },
          { href: "/phong-dao-tao/duyet-diem", label: "Duyệt và công bố điểm" },
        ] }]
      : isStudent ? [{ label: "", items: menuStudent }] : adminGroups;
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
          {groups.map(({ label, items }, index) => {
            const headingId = `sidebar-group-${index}`;
            return (
              <div key={label} className="sidebar-group">
                {label && <h2 id={headingId} className="sidebar-group-title">{label}</h2>}
                <ul className="sidebar-links" aria-labelledby={label ? headingId : undefined}>
                  {items.map((item) => (
                    <li key={item.href}>
                      <Link
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
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
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
