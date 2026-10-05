"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
];

const menuStudent = [
  { href: "/profile", label: "Hồ sơ học viên", icon: "👤", page: "profile" },
  { href: "/grades", label: "Kết quả học tập", icon: "📝", page: "grades" },
  { href: "/thesis", label: "Tiến độ Luận văn", icon: "📄", page: "thesis" },
  { href: "/schedule", label: "Thời khóa biểu", icon: "🗓️", page: "schedule" },
];

export default function Sidebar({ role = "admin" }: { role?: string }) {
  const pathname = usePathname();
  const items =
    role === "student" ? menuStudent : [...menuAdmin, ...menuStudent];

  return (
    <aside id="sidebar" className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">🎓</div>
        <div className="brand-text">
          <strong>QLĐT Thạc sĩ</strong>
          <span>AGU SĐH</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname === item.href ? "active" : ""}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
<<<<<<< HEAD
}
=======
}
>>>>>>> 10511a5b95d46554e53b0758e41ce6996e024e6d
