"use client";

import DataTable from "@/components/DataTable";

export default function TeachersPage() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        Quản lý Giảng viên
      </h1>
      <DataTable entityKey="teachers" />
    </div>
  );
}
