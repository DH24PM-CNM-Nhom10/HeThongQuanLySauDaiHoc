"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";

type User = { role?: string; hoTen?: string; maHocVien?: string };

// Trang cong khai khong dung layout quan tri va khong yeu cau dang nhap.
const publicRoutes = ["/", "/home", "/login", "/thong-bao", "/chuong-trinh-dao-tao", "/lien-he", "/gioi-thieu"];
const adminRoutes = ["/admin", "/upload", "/students", "/teachers", "/assignment", "/thesis"];
const studentRoutes = ["/profile", "/grades", "/schedule", "/tien-do-hoc-tap"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let user: User | null = null;
    try {
      const saved = localStorage.getItem("currentUser");
      user = saved ? JSON.parse(saved) as User : null;
    } catch {
      localStorage.removeItem("currentUser");
    }
    setCurrentUser(user);
    setLoading(false);

    if (user && pathname === "/login") {
      router.replace("/");
      return;
    }
    if (!user && !publicRoutes.includes(pathname)) {
      router.replace("/");
      return;
    }
    if (user?.role === "student" && adminRoutes.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
      router.replace("/home");
    }
  }, [pathname, router]);

  if (publicRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  const blocked = !currentUser ||
    (currentUser.role === "student" && adminRoutes.some((r) => pathname === r || pathname.startsWith(`${r}/`))) ||
    (currentUser.role === "admin" && studentRoutes.some((r) => pathname === r || pathname.startsWith(`${r}/`)));
  if (loading || blocked) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#64748b", background: "#f8fafc" }}>
        Đang kiểm tra quyền truy cập hệ thống...
      </div>
    );
  }

  // Học viên dùng trang giao diện riêng; Admin vẫn giữ Sidebar và Dashboard cũ.
  if ((currentUser?.role === "student" && studentRoutes.includes(pathname)) || pathname === "/tien-do-hoc-tap") {
    return <>{children}</>;
  }

  return (
    <div className="app-layout">
      <Sidebar role={currentUser.role || "student"} />
      <div className="main-wrapper">
        <Header />
        <main className="main-content">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
