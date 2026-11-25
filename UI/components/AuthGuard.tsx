"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { verifySession } from "../lib/session-client";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";

type SessionUser = { role?: "admin" | "student" | "teacher" | "training_office"; hoTen?: string; maHocVien?: string; teacherId?: string; username?: string; mustChangePassword?: boolean };
const publicRoutes = new Set(["/", "/home", "/login", "/thong-bao", "/chuong-trinh-dao-tao", "/lien-he", "/gioi-thieu", "/phong-dao-tao/phan-cong", "/giang-vien/thong-tin", "/giang-vien/tra-cuu-diem", "/giang-vien/thoi-khoa-bieu"]);
const adminRoutes = ["/admin", "/upload", "/students", "/teachers", "/assignment", "/thesis"];
const studentRoutes = ["/profile", "/grades", "/schedule", "/tien-do-hoc-tap"];
const changePasswordRoute = "/doi-mat-khau";
const matches = (path: string, base: string) => path === base || path.startsWith(`${base}/`);
const officePage = (path: string) => matches(path, "/phong-dao-tao") || path === "/assignment";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      setLoading(true);
      let session: SessionUser | null = null;
      try { session = await verifySession(); }
      catch { session = null; }
      if (cancelled) return;
      setUser(session);
      setLoading(false);

      if (pathname === "/login" && session) {
        router.replace(session.role === "admin" ? "/admin" : "/");
        return;
      }
      if (pathname === "/admin") {
        if (session?.role === "training_office") router.replace("/assignment");
        else if (session && session.role !== "admin") router.replace("/");
        return;
      }
      if (!session) { router.replace("/"); return; }
      if (pathname === changePasswordRoute && session.role !== "student" && session.role !== "teacher") {
        router.replace(session.role === "admin" ? "/admin" : "/assignment");
        return;
      }
      if ((session.role === "student" || session.role === "teacher") &&
        session.mustChangePassword && pathname !== changePasswordRoute) {
        router.replace(changePasswordRoute);
        return;
      }
      if (pathname === changePasswordRoute) return;
      if (publicRoutes.has(pathname)) return;
      if (session.role === "teacher") {
        router.replace(pathname === "/giang-vien" ? "/giang-vien/thong-tin" : "/giang-vien/tra-cuu-diem");
        return;
      }
      if (session.role === "training_office" && !officePage(pathname)) { router.replace("/assignment"); return; }
      if (session.role === "student" && adminRoutes.some(route => matches(pathname, route))) { router.replace("/home"); return; }
      if (session.role === "admin" && (studentRoutes.some(r => matches(pathname, r)) || matches(pathname, "/giang-vien") || matches(pathname, "/phong-dao-tao"))) { router.replace("/admin"); return; }
      if (session.role === "student" && (matches(pathname, "/giang-vien") || matches(pathname, "/phong-dao-tao"))) { router.replace("/home"); }
    };
    void verify();
    window.addEventListener("agu-auth-changed", verify);
    return () => {
      cancelled = true;
      window.removeEventListener("agu-auth-changed", verify);
    };
  }, [pathname, router]);

  if (pathname === "/admin" && !user && !loading) return <>{children}</>;
  if ((user?.role === "student" || user?.role === "teacher") &&
    user.mustChangePassword && pathname !== changePasswordRoute) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc", color: "#64748b" }}>Đang chuyển đến trang đổi mật khẩu...</div>;
  }
  if (publicRoutes.has(pathname)) return <>{children}</>;
  const isChangePasswordRoute = pathname === changePasswordRoute;
  const blocked = !user ||
    (user.role === "teacher" && !isChangePasswordRoute) ||
    (user.role === "training_office" && !officePage(pathname)) ||
    (user.role === "student" && (adminRoutes.some(r => matches(pathname, r)) || matches(pathname, "/giang-vien") || matches(pathname, "/phong-dao-tao"))) ||
    (user.role === "admin" && (isChangePasswordRoute || studentRoutes.some(r => matches(pathname, r)) || matches(pathname, "/giang-vien") || matches(pathname, "/phong-dao-tao"))) ||
    (isChangePasswordRoute && user.role !== "student" && user.role !== "teacher");
  if (loading || blocked) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc", color: "#64748b" }}>Đang kiểm tra quyền truy cập hệ thống...</div>;

  // Học viên dùng cổng thông tin riêng. Phòng đào tạo dùng bố cục quản lý.
  if ((user?.role === "student" && (studentRoutes.includes(pathname) || isChangePasswordRoute)) ||
    (user?.role === "teacher" && isChangePasswordRoute)) return <>{children}</>;
  return (
    <div className="app-layout">
      <Sidebar role={user.role || "student"} />
      <div className="main-wrapper">
        <Header />
        <main className="main-content">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
