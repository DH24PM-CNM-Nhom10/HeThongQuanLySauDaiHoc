"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";

type User = { role?: string; hoTen?: string; maHocVien?: string; teacherId?: string; username?: string };

const publicRoutes = ["/", "/home", "/login", "/thong-bao", "/chuong-trinh-dao-tao", "/lien-he", "/gioi-thieu"];
const adminRoutes = ["/admin", "/upload", "/students", "/teachers", "/assignment", "/thesis"];
const studentRoutes = ["/profile", "/grades", "/schedule", "/tien-do-hoc-tap"];
const matches = (path: string, base: string) => path === base || path.startsWith(`${base}/`);
const teacherRoute = (path: string) => matches(path, "/giang-vien");
const officeRoute = (path: string) => matches(path, "/phong-dao-tao");

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [teacherValidated, setTeacherValidated] = useState(false);
  const [officeValidated, setOfficeValidated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const check = async () => {
      setLoading(true);
      let savedUser: User | null = null;
      try {
        const saved = localStorage.getItem("currentUser");
        savedUser = saved ? JSON.parse(saved) as User : null;
      } catch { localStorage.removeItem("currentUser"); }

      // Không tin vai trò teacher trong localStorage: phải kiểm tra cookie trên Backend.
      if (teacherRoute(pathname) || savedUser?.role === "teacher") {
        try {
          const res = await fetch("/api/teacher-auth/me", { cache: "no-store", credentials: "same-origin" });
          if (!res.ok) throw new Error("Unauthorized");
          const json: { user?: User } = await res.json();
          if (json.user?.role !== "teacher") throw new Error("Invalid role");
          savedUser = json.user;
          localStorage.setItem("currentUser", JSON.stringify(savedUser));
          if (!ignore) setTeacherValidated(true);
        } catch {
          if (savedUser?.role === "teacher") localStorage.removeItem("currentUser");
          savedUser = null;
          if (!ignore) setTeacherValidated(false);
        }
      } else if (!ignore) {
        setTeacherValidated(false);
      }

      if (officeRoute(pathname) || savedUser?.role === "training_office") {
        try {
          const res = await fetch("/api/training-office/me", { cache: "no-store", credentials: "same-origin" });
          if (!res.ok) throw new Error("Unauthorized office");
          const json: { user?: User } = await res.json();
          if (json.user?.role !== "training_office") throw new Error("Invalid role");
          savedUser = json.user;
          localStorage.setItem("currentUser", JSON.stringify(savedUser));
          if (!ignore) setOfficeValidated(true);
        } catch {
          if (savedUser?.role === "training_office") localStorage.removeItem("currentUser");
          savedUser = null;
          if (!ignore) setOfficeValidated(false);
        }
      } else if (!ignore) setOfficeValidated(false);

      if (ignore) return;
      setCurrentUser(savedUser);
      setLoading(false);
      if (pathname === "/login" && savedUser) { router.replace("/"); return; }
      if (publicRoutes.includes(pathname)) return;
      if (!savedUser) { router.replace("/"); return; }
      if (teacherRoute(pathname)) {
        if (savedUser.role !== "teacher") router.replace("/");
        return;
      }
      if (officeRoute(pathname)) {
        if (savedUser.role !== "training_office") router.replace("/");
        return;
      }
      if (savedUser.role === "teacher") { router.replace("/giang-vien"); return; }
      if (savedUser.role === "training_office") { router.replace("/phong-dao-tao/phan-cong"); return; }
      if (savedUser.role === "student" && adminRoutes.some((r) => matches(pathname, r))) {
        router.replace("/home");
      }
    };
    void check();
    return () => { ignore = true; };
  }, [pathname, router]);

  if (publicRoutes.includes(pathname)) return <>{children}</>;
  const blocked = !currentUser ||
    (teacherRoute(pathname) && (currentUser.role !== "teacher" || !teacherValidated)) ||
    (officeRoute(pathname) && (currentUser.role !== "training_office" || !officeValidated)) ||
    (!teacherRoute(pathname) && currentUser.role === "teacher") ||
    (!officeRoute(pathname) && currentUser.role === "training_office") ||
    (currentUser.role === "student" && adminRoutes.some((r) => matches(pathname, r)));
  if (loading || blocked) {
    return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#64748b", background: "#f8fafc" }}>Đang kiểm tra quyền truy cập hệ thống...</div>;
  }

  // Cổng giảng viên dùng layout menu ngang của PublicHome, không dùng sidebar quản trị.
  if (teacherRoute(pathname) || officeRoute(pathname)) return <>{children}</>;
  if (currentUser?.role === "student" && studentRoutes.includes(pathname)) return <>{children}</>;
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
