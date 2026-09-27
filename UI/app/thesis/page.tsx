"use client";

import DataTable from "@/components/DataTable";

export default function ThesisPage() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        Tiến độ Luận văn
      </h1>
      <DataTable entityKey="thesis" />
    </div>
  );
}
