"use client";
import { useEffect, useState } from "react";
import DataTable from "../../components/DataTable";
import TrainingOfficeAssignmentContent from "../../components/TrainingOfficeAssignmentContent";
export default function AssignmentPage() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    try { setRole((JSON.parse(localStorage.getItem("currentUser") || "null") as {role?:string}|null)?.role || "guest"); }
    catch { setRole("guest"); }
  }, []);
  if (role === null) return <p>Đang tải phân công...</p>;
  if (role === "training_office") return <TrainingOfficeAssignmentContent />;
  if (role === "admin") return <DataTable entityKey="assignments" title="Phân công giảng dạy" />;
  return <p>Không có quyền truy cập trang phân công.</p>;
}
