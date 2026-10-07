// UI/components/AuthGuard.tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const savedUserStr = localStorage.getItem("currentUser");
      const user = savedUserStr ? JSON.parse(savedUserStr) : null;

      // 1. Chưa đăng nhập mà truy cập bất kỳ trang nào (trừ /login) -> Đẩy về /login ngay
      if (!user && pathname !== "/login") {
        router.replace("/login");
        setLoading(false);
        return;
      }

      // 2. Đã đăng nhập rồi mà cố gõ /login -> Đẩy về trang tương ứng với quyền
      if (user && pathname === "/login") {
        router.replace(user.role === "student" ? "/profile" : "/");
        setLoading(false);
        return;
      }

      // 3. Học viên không được phép truy cập các trang Quản trị Admin
      if (user && user.role === "student") {
        const adminRoutes = ["/", "/upload", "/students", "/teachers", "/assignment"];
        if (adminRoutes.includes(pathname)) {
          router.replace("/profile");
          setLoading(false);
          return;
        }
      }

      setCurrentUser(user);
      setLoading(false);
    };

    checkAuth();
  }, [pathname, router]);

  // Nếu là trang Đăng nhập: Hiển thị giao diện màn hình tràn (không có Header/Sidebar/Footer)
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Đang kiểm tra quyền
  if (loading || (!currentUser && pathname !== "/login")) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          color: "#64748b",
          fontFamily: "sans-serif",
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        🔒 Đang kiểm tra quyền truy cập hệ thống...
      </div>
    );
  }

  // Đã đăng nhập: Cho phép hiển thị đầy đủ giao diện ứng dụng
  return (
    <div className="app-layout">
      <Sidebar role={currentUser?.role || "student"} />
      <div className="main-wrapper">
        <Header />
        <main className="main-content">{children}</main>
        <Footer />
      </div>
    </div>
  );
}