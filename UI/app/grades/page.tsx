"use client";

import DataTable from "../../components/shared/DataTable";
import StudentPageSwitch from "../../components/students/StudentPageSwitch";

export default function GradesPage() {
  return <StudentPageSwitch section="grades" adminView={<DataTable entityKey="grades" title="Kết quả học tập" />} />;
}
