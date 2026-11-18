"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";

type SessionUser = { role?: "admin" | "student" | "teacher" | "training_office"; hoTen?: string; maHocVien?: string; teacherId?: string; username?: string };
const publicRoutes = new Set(["/", "/home", "/login", "/thong-bao", "/chuong-trinh-dao-tao", "/lien-he", "/gioi-thieu", "/phong-dao-tao/phan-cong", "/giang-vien/thong-tin", "/giang-vien/tra-cuu-diem"]);
const adminRoutes = ["/admin", "/upload", "/students", "/teachers", "/assignment", "/thesis"];
const studentRoutes = ["/profile", "/grades", "/schedule", "/tien-do-hoc-tap"];
const matches = (path: string, base: string) => path === base || path.startsWith(`${base}/`);
const teacherPage = (path: string) => matches(path, "/giang-vien") || path === "/grades";
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
      try {
        const raw = localStorage.getItem("currentUser");
        session = raw ? JSON.parse(raw) as SessionUser : null;
      } catch { localStorage.removeItem("currentUser"); }

      if (session?.role === "teacher" || session?.role === "training_office") {
        const api = session.role === "teacher" ? "/api/teacher-auth/me" : "/api/training-office/me";
        const expectedRole = session.role;
        try {
          const response = await fetch(api, { credentials: "same-origin", cache: "no-store" });
          if (!response.ok) throw new Error("Session invalid");
          const result: { user?: SessionUser } = await response.json();
          if (!result.user || result.user.role !== expectedRole) throw new Error("Role invalid");
          session = result.user;
          localStorage.setItem("currentUser", JSON.stringify(session));
        } catch {
          localStorage.removeItem("currentUser");
          session = null;
        }
      }
      if (cancelled) return;
      setUser(session);
      setLoading(false);

      if (pathname === "/login" && session) {
        router.replace("/");
        return;
      }
      if (publicRoutes.has(pathname)) return;
      if (!session) { router.replace("/"); return; }
      if (session.role === "teacher" && !teacherPage(pathname)) { router.replace("/grades"); return; }
      if (session.role === "training_office" && !officePage(pathname)) { router.replace("/assignment"); return; }
      if (session.role === "student" && adminRoutes.some(route => matches(pathname, route))) { router.replace("/home"); return; }
      if (session.role === "admin" && (studentRoutes.some(r => matches(pathname, r)) || matches(pathname, "/giang-vien") || matches(pathname, "/phong-dao-tao"))) { router.replace("/admin"); return; }
      if (session.role === "student" && (matches(pathname, "/giang-vien") || matches(pathname, "/phong-dao-tao"))) { router.replace("/home"); }
    };
    void verify();
    return () => { cancelled = true; };
  }, [pathname, router]);

  if (publicRoutes.has(pathname)) return <>{children}</>;
  const blocked = !user ||
    (user.role === "teacher" && !teacherPage(pathname)) ||
    (user.role === "training_office" && !officePage(pathname)) ||
    (user.role === "student" && (adminRoutes.some(r => matches(pathname, r)) || matches(pathname, "/giang-vien") || matches(pathname, "/phong-dao-tao"))) ||
    (user.role === "admin" && (studentRoutes.some(r => matches(pathname, r)) || matches(pathname, "/giang-vien") || matches(pathname, "/phong-dao-tao")));
  if (loading || blocked) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc", color: "#64748b" }}>Đang kiểm tra quyền truy cập hệ thống...</div>;

  // Giữ cổng thông tin dành cho học viên. Hai vai trò mới dùng Dashboard/Sidebar giống Admin.
  if (user?.role === "student" && studentRoutes.includes(pathname)) return <>{children}</>;
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
