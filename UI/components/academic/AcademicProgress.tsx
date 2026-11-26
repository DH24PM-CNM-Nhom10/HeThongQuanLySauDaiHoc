"use client";
import { useEffect, useState } from "react";
import styles from "../students/StudentManagementTable.module.css";
export default function AcademicProgress({ code }: { code?: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    void fetch(
      code
        ? "/api/academic?student=" + encodeURIComponent(code)
        : "/api/student-records/academic-progress",
      { cache: "no-store", signal: c.signal },
    )
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.message || "Không tải được tiến độ.");
        setData(d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [code]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p>Đang tải tiến độ học tập...</p>;
  if (!data.configured) return <p>{data.message}</p>;
  return (
    <section>
      <h3>Tiến độ học tập — {data.policyName}</h3>
      <p>
        Tích lũy:{" "}
        <strong>
          {data.earnedCredits}/{data.requiredCredits} tín chỉ
        </strong>{" "}
        · Còn thiếu: {data.remainingCredits} · Hoàn thành: {data.percent}% ·
        GPA: {data.gpa ?? "Chưa có điểm phù hợp quy chế"}
      </p>
      <progress value={data.percent} max={100} aria-label="Tiến độ tín chỉ" />
      <div
        className={styles.sheet}
        tabIndex={0}
        role="region"
        aria-label="Tiến độ học phần"
      >
        <table className="excel-grid" data-grid="excel">
          <thead>
            <tr>
              <th>Mã học phần</th>
              <th>Tên học phần</th>
              <th>Tín chỉ</th>
              <th>Bắt buộc</th>
              <th>Điểm cao nhất</th>
              <th>GPA</th>
              <th>Trọng số GPA</th>
              <th>Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {data.courses.map((c: any) => (
              <tr key={c.code}>
                <td>{c.code}</td>
                <td>{c.name}</td>
                <td>{c.credits}</td>
                <td>{c.required ? "Có" : "Không"}</td>
                <td>{c.score ?? "—"}</td>
                <td>{c.gpa ?? "—"}</td>
                <td>{c.gpaWeight}</td>
                <td>
                  {c.missingConfiguration
                    ? "Chưa cấu hình môn học"
                    : c.score === null
                      ? "Chưa có điểm theo quy chế"
                      : c.passed
                        ? "Đạt"
                        : "Chưa đạt"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>{data.note}</p>
      <p>
        Điều kiện học thuật:{" "}
        {data.academicEligible ? "Đạt theo kế hoạch đã cấu hình" : "Chưa đạt"}
      </p>
    </section>
  );
}
