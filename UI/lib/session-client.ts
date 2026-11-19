"use client";

export type SessionUser = {
  role: "admin" | "student" | "teacher" | "training_office";
  hoTen?: string; maHocVien?: string; teacherId?: string; username?: string; email?: string; shcc?: string;
};

const endpoints = {
  admin: "/api/auth",
  student: "/api/student-records",
  teacher: "/api/teacher-auth",
  training_office: "/api/training-office",
};

export async function verifySession(): Promise<SessionUser | null> {
  let cached: SessionUser | null = null;
  try { cached = JSON.parse(localStorage.getItem("currentUser") || "null"); } catch {}
  if (!cached || !Object.hasOwn(endpoints, cached.role)) return null;
  const response = await fetch(endpoints[cached.role] + "/me", { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) {
    localStorage.removeItem("currentUser");
    return null;
  }
  const result = await response.json();
  if (result.user?.role !== cached.role) {
    localStorage.removeItem("currentUser");
    return null;
  }
  localStorage.setItem("currentUser", JSON.stringify(result.user));
  return result.user;
}

export async function logoutSessions(keepRole?: SessionUser["role"]) {
  await Promise.all(Object.entries(endpoints).filter(([role]) => role !== keepRole)
    .map(([, endpoint]) => fetch(endpoint + "/logout", { method: "POST", credentials: "same-origin" }).catch(() => null)));
  if (!keepRole) localStorage.removeItem("currentUser");
}
