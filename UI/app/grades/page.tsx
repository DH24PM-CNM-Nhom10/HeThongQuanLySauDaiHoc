"use client";

import DataTable from "../../components/DataTable";

export default function GradesPage() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        Kết quả học tập
      </h1>
      <DataTable entityKey="grades" />
    </div>
  );
}