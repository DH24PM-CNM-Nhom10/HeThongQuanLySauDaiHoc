"use client";

import { useEffect, useState } from "react";
import PublicHome from "../public/PublicHome";
import type { StudentSection } from "./StudentPortalContent";

// Giữ nguyên giao diện quản trị cũ khi Admin mở các trang học vụ.
export default function StudentPageSwitch({ section, adminView }: { section: StudentSection; adminView: React.ReactNode }) {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem("currentUser") || "null") as { role?: string } | null;
      setRole(session?.role ?? "guest");
    } catch { setRole("guest"); }
  }, []);
  if (role === null) return <div style={{padding:24, color:"#6b7e90"}}>Đang tải trang...</div>;
  if (role === "admin") return <>{adminView}</>;
  return <PublicHome page={section} />;
}
