"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
      <div className={styles.heading}>
        <div><p className={styles.eyebrow}>TỔNG QUAN ĐÀO TẠO</p>
        <h1>Báo cáo tổng hợp</h1>
        <p>Theo dõi quy mô và tình hình học tập của học viên sau đại học.</p></div>
        <Link className={styles.primaryLink} href="/students">Xem danh sách học viên</Link>
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
            <div><dt>Tổng học viên</dt><dd>{numberFormat.format(totals.total)}</dd><small>Toàn bộ hồ sơ đào tạo</small></div>
            {visibleStatuses.map(({ key, label }) => (
              <div key={key} data-status={key}>
                <dt>{label}</dt>
                <dd>{numberFormat.format(totals[key])}</dd>
                <small>{percentFormat.format(totals[key] / totals.total)} tổng học viên</small>
              </div>
            ))}
          </dl>

          <div className={styles.reportGrid}><section className={styles.panel} aria-labelledby="status-analysis">
            <h2 id="status-analysis">Tỷ lệ trạng thái học viên</h2>
            <p className={styles.subtitle}>Cơ cấu học viên theo tình trạng học tập hiện tại</p>
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
                    <span className={styles.statusName}>{label}<small>{numberFormat.format(totals[key])} học viên</small></span>
                    <strong>{percentFormat.format(totals[key] / totals.total)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <section className={styles.quickPanel} aria-labelledby="management-links">
            <p className={styles.eyebrow}>KHÔNG GIAN QUẢN LÝ</p>
            <h2 id="management-links">Hồ sơ và kết quả đào tạo</h2>
            <p>Truy cập nhanh các nghiệp vụ thường dùng.</p>
            <Link href="/students"><strong>Hồ sơ học viên</strong><span>Tra cứu, cập nhật và xuất danh sách</span></Link>
            <Link href="/kiem-tra-van-bang"><strong>Hồ sơ và minh chứng</strong><span>Tiếp nhận văn bằng, chứng chỉ và xét duyệt</span></Link>
            <Link href="/admin/thong-ke-diem"><strong>Thống kê điểm số</strong><span>Phân bố điểm và kết quả theo học kỳ</span></Link>
          </section></div>

        </>
      )}
    </div>
  );
}

export default AdminDashboard;
