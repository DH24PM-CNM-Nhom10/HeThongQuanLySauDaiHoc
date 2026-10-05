"use client";

import ThesisProgressTable from "../../components/ThesisProgressTable";
import OverdueAlertSection from "../../components/OverdueAlertSection";

export default function ThesisPage() {
  return (
    <div style={{ padding: "16px" }}>
      {/* 1. Khu vực Cảnh báo Quá hạn */}
      <div style={{ marginBottom: "28px" }}>
        <OverdueAlertSection />
      </div>

      {/* 2. Bảng Tiến độ Luận văn */}
      <div>
        <ThesisProgressTable />
      </div>
    </div>
  );
}