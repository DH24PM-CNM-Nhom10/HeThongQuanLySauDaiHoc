"use client";

import DataTable from "../../components/DataTable";
import StudentPageSwitch from "../../components/StudentPageSwitch";

export default function GradesPage() {
  return <StudentPageSwitch section="grades" adminView={<DataTable entityKey="grades" title="Kết quả học tập" />} />;
}
