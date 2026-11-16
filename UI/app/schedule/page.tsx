"use client";

import DataTable from "../../components/DataTable";
import StudentPageSwitch from "../../components/StudentPageSwitch";

export default function SchedulePage() {
  return <StudentPageSwitch section="schedule" adminView={<DataTable entityKey="schedule" title="Thời khóa biểu" />}/>;
}
