"use client";
import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import StudentPageSwitch from "../../components/StudentPageSwitch";
import TeacherGradebook from "../../components/TeacherGradebook";
export default function GradesPage() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    try { setRole((JSON.parse(localStorage.getItem("currentUser") || "null") as { role?: string } | null)?.role || "guest"); }
    catch { setRole("guest"); }
  }, []);
  if (role === null) return <p>Đang tải trang điểm số...</p>;
  if (role === "teacher") return <TeacherGradebook />;
  return <StudentPageSwitch section="grades" adminView={<DataTable entityKey="grades" title="Kết quả học tập" />} />;
}
