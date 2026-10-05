"use client";

<<<<<<< HEAD
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
=======
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
>>>>>>> 10511a5b95d46554e53b0758e41ce6996e024e6d
