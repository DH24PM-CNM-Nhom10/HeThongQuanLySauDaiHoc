"use client";

import DataTable from "../../components/DataTable";

export default function AssignmentPage() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        Phân công giảng dạy
      </h1>
      <DataTable entityKey="assignments" />
    </div>
  );
}
