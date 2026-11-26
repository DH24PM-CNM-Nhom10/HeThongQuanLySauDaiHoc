import type { SessionUser } from "./session-client";

export async function loginAccount(username: string, password: string): Promise<SessionUser> {
  const normalized = username.trim().toLowerCase();
  const role: SessionUser["role"] = ["admin", "admin@agu.edu.vn", "admin@student.agu.edu.vn"].includes(normalized)
    ? "admin" : normalized === "phongdaotao@agu.edu.vn" ? "training_office"
    : normalized.endsWith("@teacher.agu.edu.vn") ? "teacher" : "student";
  const endpoint = {
    admin: "/api/auth/login", training_office: "/api/training-office/login",
    teacher: "/api/teacher-auth/login", student: "/api/student-records/login",
  }[role];
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: normalized, password }),
    });
  } catch {
    throw new Error("Không kết nối được máy chủ đăng nhập. Vui lòng thử lại.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.message === "string" ? data.message :
      response.status >= 500 ? "Máy chủ đăng nhập chưa sẵn sàng. Vui lòng kiểm tra máy chủ API ở cổng 3001."
      : "Tên đăng nhập hoặc mật khẩu không đúng.";
    throw new Error(message);
  }
  if (!data?.user || data.user.role !== role) throw new Error("Máy chủ trả về phiên đăng nhập không hợp lệ.");
  return data.user;
}
