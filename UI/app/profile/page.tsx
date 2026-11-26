"use client";

import { Suspense } from "react";
import StudentProfile from "../../components/students/StudentProfile";
import StudentPageSwitch from "../../components/students/StudentPageSwitch";

export default function ProfilePage() {
  return <StudentPageSwitch section="profile" adminView={<Suspense fallback={<p>Đang tải hồ sơ...</p>}><StudentProfile/></Suspense>}/>;
}
