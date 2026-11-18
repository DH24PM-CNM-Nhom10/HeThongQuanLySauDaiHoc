"use client";

import { useEffect, useMemo, useState } from "react";
import { DB } from "../../lib/db";
import { checkIsOverdue } from "../../lib/studentUtils";
import styles from "./Dashboard.module.css";

type Student = Parameters<typeof checkIsOverdue>[0];
type Counts = { total: number; studying: number; graduated: number; overdue: number; withdrawn: number };

const statusColumns = [
  { key: "studying", label: "Đang học" },
  { key: "graduated", label: "Đã tốt nghiệp" },
  { key: "overdue", label: "Quá hạn" },
  { key: "withdrawn", label: "Xóa tên" },
] as const;

const numberFormat = new Intl.NumberFormat("vi-VN");
const percentFormat = new Intl.NumberFormat("vi-VN", {
  style: "percent",
  maximumFractionDigits: 1,
});

function emptyCounts(): Counts {
  return { total: 0, studying: 0, graduated: 0, overdue: 0, withdrawn: 0 };
}

function getStatus(student: Student) {
  const status = String(
    student.trangThai || student.trang_thai || student.TRANG_THAI || student.status || student.STATUS || "",
  ).trim().toLowerCase();
  if (status === "xóa tên" || status === "xoá tên") return "withdrawn";
  if (status === "đã tốt nghiệp" || status === "tốt nghiệp") return "graduated";
  if (status === "quá hạn" || checkIsOverdue(student)) return "overdue";
  const graduated =
    student.category === "GRADUATED" ||
    status.includes("tốt nghiệp") ||
    status.includes("bảo vệ") ||
    status.includes("hoàn thành") ||
    student.daBaoVe === true ||
    (student.ngayTotNghiep && student.ngayTotNghiep !== "-") ||
    (student.ngayBaoVe && student.ngayBaoVe !== "-");

  return graduated ? "graduated" : "studying";
}

function summarize(students: Student[]) {
  const totals = emptyCounts();
  for (const student of students) {
    totals.total++;
    totals[getStatus(student)]++;
  }

  return totals;
}

export default function Dashboard() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboardData() {
      try {
        const cached = DB.get("students");
        if (Array.isArray(cached) && cached.length > 0) {
          setStudents(cached);
          return;
        }
      } catch (cause) {
        console.error("Lỗi đọc dữ liệu lưu cục bộ:", cause);
      }

      try {
        const records: Student[] = [];
        let page = 1;
        let totalPages = 1;

        do {
          const response = await fetch(
            `/api/students?limit=2000&page=${page}`,
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const result = await response.json();
          const data = Array.isArray(result) ? result : result?.data ?? result?.records;
          if (!Array.isArray(data)) throw new Error("Dữ liệu học viên không hợp lệ");

          records.push(...data);
          totalPages = result?.pagination?.totalPages ?? 1;
          page++;
        } while (page <= totalPages);

        if (!controller.signal.aborted) setStudents(records);
      } catch (cause) {
        if (controller.signal.aborted) return;
        console.error("Lỗi tải dữ liệu báo cáo:", cause);
        setError(true);
      }
    }

    void loadDashboardData();
    return () => controller.abort();
  }, []);

  const totals = useMemo(() => summarize(students ?? []), [students]);
  let segmentEnd = 0;
  const segments = statusColumns.map(({ key }) => {
    const start = segmentEnd;
    const share = totals.total ? totals[key] / totals.total : 0;
    segmentEnd += share * 100;
    return { key, share, start, end: segmentEnd };
  });
  const chartStops = segments
    .filter(({ share }) => share > 0)
    .map(({ key, start, end }) => `var(--chart-${key}) ${start}% ${end}%`);

  return (
    <div className={styles.dashboard}>
      <div>
        <h1>Báo cáo tổng hợp</h1>
      </div>
      {error ? (
        <p className={styles.notice} role="alert">Không tải được dữ liệu học viên.</p>
      ) : students === null ? (
        <p className={styles.notice} role="status">Đang tải dữ liệu báo cáo…</p>
      ) : totals.total === 0 ? (
        <p className={styles.notice}>Chưa có dữ liệu học viên để lập báo cáo.</p>
      ) : (
        <>
          <dl className={styles.metrics} aria-label="Tổng hợp học viên">
            <div><dt>Tổng học viên</dt><dd>{numberFormat.format(totals.total)}</dd></div>
            {statusColumns.map(({ key, label }) => (
              <div key={key} data-status={key}>
                <dt>{label}</dt>
                <dd>{numberFormat.format(totals[key])}</dd>
              </div>
            ))}
          </dl>

          <section className={styles.panel} aria-labelledby="status-analysis">
            <h2 id="status-analysis">Tỷ lệ trạng thái học viên</h2>
            <div className={styles.chartLayout}>
              <div
                className={styles.donut}
                style={{ background: `conic-gradient(${chartStops.join(", ")})` }}
                aria-hidden="true"
              >
                <div>
                  <strong>{numberFormat.format(totals.total)}</strong>
                  <span>Học viên</span>
                </div>
              </div>
              <ul className={styles.breakdown} aria-label="Tỷ lệ học viên theo trạng thái">
                {statusColumns.map(({ key, label }) => (
                  <li key={key} data-status={key}>
                    <span>{label}</span>
                    <strong>{percentFormat.format(totals[key] / totals.total)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </section>

        </>
      )}
    </div>
  );
}
