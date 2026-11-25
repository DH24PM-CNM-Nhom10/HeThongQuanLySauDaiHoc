"use client";

export type SessionUser = {
  role: "admin" | "student" | "teacher" | "training_office";
  hoTen?: string; maHocVien?: string; teacherId?: string; username?: string; email?: string; shcc?: string;
  mustChangePassword?: boolean;
};

const endpoints = {
  admin: "/api/auth",
  student: "/api/student-records",
  teacher: "/api/teacher-auth",
  training_office: "/api/training-office",
};

export async function verifySession(): Promise<SessionUser | null> {
  const snapshot = localStorage.getItem("currentUser");
  let cached: SessionUser | null = null;
  try { cached = JSON.parse(snapshot || "null"); } catch {}
  if (!cached || !Object.hasOwn(endpoints, cached.role)) return null;
  const response = await fetch(endpoints[cached.role] + "/me", { cache: "no-store", credentials: "same-origin" });
  if (localStorage.getItem("currentUser") !== snapshot) return verifySession();
  if (!response.ok) {
    if (response.status !== 401 && response.status !== 403) {
      throw new Error("Không kiểm tra được phiên đăng nhập. Vui lòng thử lại.");
    }
    localStorage.removeItem("currentUser");
    return null;
  }
  const result = await response.json();
  if (localStorage.getItem("currentUser") !== snapshot) return verifySession();
  if (result.user?.role !== cached.role) {
    localStorage.removeItem("currentUser");
    return null;
  }
  localStorage.setItem("currentUser", JSON.stringify(result.user));
  return result.user;
}

export async function logoutSessions(keepRole?: SessionUser["role"]) {
  if (!keepRole) localStorage.removeItem("currentUser");
  await Promise.all(Object.entries(endpoints).filter(([role]) => role !== keepRole)
    .map(([, endpoint]) => fetch(endpoint + "/logout", { method: "POST", credentials: "same-origin" }).catch(() => null)));
}
