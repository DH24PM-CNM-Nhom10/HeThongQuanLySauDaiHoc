"use client";

import { Suspense } from "react";
import StudentProfile from "../../components/StudentProfile";
import StudentPageSwitch from "../../components/StudentPageSwitch";

export default function ProfilePage() {
  return <StudentPageSwitch section="profile" adminView={<Suspense fallback={<p>Đang tải hồ sơ...</p>}><StudentProfile/></Suspense>}/>;
}
