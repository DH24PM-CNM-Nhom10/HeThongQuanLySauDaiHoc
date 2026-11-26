"use client";

import { useEffect, useMemo, useState } from "react";
import { studentStatus } from "../../../shared/student-status.cjs";

import styles from "./Dashboard.module.css";

type Student = Record<string, unknown>;
type Counts = Record<string, number>;

const statusColumns = [
  { key: "studying", label: "Đang học" },
  { key: "graduated", label: "Đã tốt nghiệp" },
  { key: "overdue", label: "Quá hạn" },
  { key: "withdrawn", label: "Xóa tên" },
  { key: "reserved", label: "Bảo lưu" },
  { key: "paused", label: "Tạm dừng" },
  { key: "left", label: "Thôi học" },
  { key: "completed", label: "Hoàn thành" },
  { key: "other", label: "Chưa xác định / Khác" },
] as const;

const numberFormat = new Intl.NumberFormat("vi-VN");
const percentFormat = new Intl.NumberFormat("vi-VN", {
  style: "percent",
  maximumFractionDigits: 1,
});

function emptyCounts(): Counts {
  return Object.fromEntries([["total", 0], ...statusColumns.map(({ key }) => [key, 0])]);
}

function summarize(students: Student[]) {
  const totals = emptyCounts();
  for (const student of students) {
    totals.total++;
    totals[studentStatus(student)]++;
  }

  return totals;
}

function AdminDashboard() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboardData() {
      try {
        const records: Student[] = [];
        let page = 1;
        let totalPages = 1;

        do {
          const response = await fetch(
            `/api/students?limit=2000&page=${page}`,
            { signal: controller.signal, cache: "no-store" },
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
  const visibleStatuses = statusColumns.filter(({ key }) => totals[key] > 0);
  let segmentEnd = 0;
  const segments = visibleStatuses.map(({ key }) => {
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
            {visibleStatuses.map(({ key, label }) => (
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
                {visibleStatuses.map(({ key, label }) => (
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

export default AdminDashboard;
