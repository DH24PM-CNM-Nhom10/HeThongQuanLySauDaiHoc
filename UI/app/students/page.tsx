"use client";

import DataTable from "@/components/DataTable";

export default function StudentsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        Quản lý Học viên
      </h1>
      <DataTable entityKey="students" />
    </div>
  );
}
