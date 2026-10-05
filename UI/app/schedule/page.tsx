"use client";

import DataTable from "../../components/DataTable";

export default function SchedulePage() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        Thời khóa biểu
      </h1>
      <DataTable entityKey="schedule" />
    </div>
  );
}