"use client";

import DataTable from "../../components/shared/DataTable";
import StudentPageSwitch from "../../components/students/StudentPageSwitch";

export default function SchedulePage() {
  return <StudentPageSwitch section="schedule" adminView={<DataTable entityKey="schedule" title="Thời khóa biểu" />}/>;
}
