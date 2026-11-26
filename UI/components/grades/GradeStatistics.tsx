"use client";
import { useEffect, useState } from 'react';
import styles from './GradeStatistics.module.css';
type Summary = { enrollments: number; graded: number; ungraded: number; passed: number; failed: number; average: number | null; passRate: number | null };
type Group = Summary & { key: string; label: string };
type Report = { summary: Summary & { students: number; courseSections: number };
  distribution: { label: string; count: number }[]; groups: Record<string, Group[]>; policy: { note: string; passThreshold: number };
  options: { schoolYears: string[]; semesters: string[]; classes: string[]; cohorts: string[]; majors: {value: string; label: string}[] } };
const number = (value: number | null) => value === null ? '—' : value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
export default function GradeStatistics() {
  const [data, setData] = useState<Report | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState({ schoolYear: '', semester: '', major: '', cohort: '', classCode: '' });
  const [group, setGroup] = useState('class');
  const query = new URLSearchParams(filters).toString();
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void fetch('/api/grade-statistics?' + query, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal }).then(async response => {
      const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Không tải được thống kê.');
      if (!controller.signal.aborted) setData(result);
    }).catch(reason => { if (!controller.signal.aborted) { setError(reason.message); setData(null); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query]);
  async function exportReport() {
    if (!data) return; setExporting(true);
    try {
      const XLSX = await import('xlsx'), workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ 'Học viên': data.summary.students, 'Lớp học phần': data.summary.courseSections, 'Lượt học': data.summary.enrollments, 'Có điểm': data.summary.graded, 'Chưa có điểm': data.summary.ungraded, 'Đạt': data.summary.passed, 'Không đạt': data.summary.failed, 'Trung bình cộng': data.summary.average, 'Tỷ lệ đạt (%)': data.summary.passRate }]), 'Tổng quan');
      for (const [key, title] of [['class', 'Theo lớp học phần'], ['major', 'Theo ngành'], ['cohort', 'Theo khóa']]) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.groups[key].map(row => ({ 'Nhóm': row.label, 'Lượt học': row.enrollments, 'Có điểm': row.graded, 'Chưa có điểm': row.ungraded, 'Đạt': row.passed, 'Không đạt': row.failed, 'Trung bình cộng': row.average, 'Tỷ lệ đạt (%)': row.passRate }))), title);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ ...filters, 'Ghi chú': data.policy.note }]), 'Bộ lọc và cách tính');
      XLSX.writeFile(workbook, 'thong_ke_diem.xlsx');
    } catch { setError('Không xuất được báo cáo.'); }
    finally { setExporting(false); }
  }
  const choices = data ? { schoolYear: data.options.schoolYears, semester: data.options.semesters, cohort: data.options.cohorts, classCode: data.options.classes } : { schoolYear: [], semester: [], cohort: [], classCode: [] };
  return <section className={styles.page}><header><div><h1>Thống kê quản lý điểm số</h1><p>Theo dõi điểm giảng viên đã lưu theo học kỳ, ngành, khóa và lớp học phần.</p></div><button disabled={!data || loading || exporting} onClick={() => void exportReport()}>{exporting ? 'Đang xuất...' : 'Xuất báo cáo Excel'}</button></header>
    <div className={styles.filters}>{Object.entries({ schoolYear: 'Năm học', semester: 'Học kỳ', cohort: 'Khóa đào tạo', classCode: 'Lớp' }).map(([key, label]) => <label key={key}>{label}<select value={filters[key as keyof typeof filters]} onChange={event => setFilters({ ...filters, [key]: event.target.value })}><option value="">Tất cả</option>{choices[key as keyof typeof choices].map(value => <option key={value}>{value}</option>)}</select></label>)}<label>Ngành<select value={filters.major} onChange={event => setFilters({ ...filters, major: event.target.value })}><option value="">Tất cả ngành</option>{data?.options.majors.map(row => <option key={row.value} value={row.value}>{row.label}</option>)}</select></label><button onClick={() => setFilters({ schoolYear: '', semester: '', major: '', cohort: '', classCode: '' })}>Bỏ lọc</button></div>
    {error && <p role="alert">{error}</p>}{loading ? <p role="status">Đang tổng hợp điểm...</p> : data && <>
      <div className={styles.metrics}>{[['Học viên', data.summary.students], ['Lớp học phần', data.summary.courseSections], ['Lượt học đã có điểm', data.summary.graded], ['Lượt học chưa có điểm', data.summary.ungraded], ['Đạt', data.summary.passed], ['Không đạt', data.summary.failed], ['Trung bình cộng', number(data.summary.average)], ['Tỷ lệ đạt', data.summary.passRate === null ? '—' : number(data.summary.passRate) + '%']].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div className={styles.chart}><h2>Phân bố điểm tổng kết đã lưu</h2>{data.distribution.map(row => <div key={row.label}><span>{row.label}</span><div><i style={{ width: `${row.count / Math.max(1, ...data.distribution.map(item => item.count)) * 100}%` }} /></div><strong>{row.count}</strong></div>)}</div>
      <div className={styles.group}><label>Tổng hợp theo <select value={group} onChange={event => setGroup(event.target.value)}><option value="class">Lớp học phần</option><option value="major">Ngành</option><option value="cohort">Khóa đào tạo</option></select></label></div>
      <div className={styles.scroll} tabIndex={0} role="region" aria-label="Bảng dữ liệu"><table className="excel-grid" data-grid="excel"><thead><tr><th>Nhóm</th><th>Lượt học</th><th>Có điểm</th><th>Chưa có điểm</th><th>Đạt</th><th>Không đạt</th><th>Trung bình cộng</th><th>Tỷ lệ đạt</th></tr></thead><tbody>{data.groups[group].map(row => <tr key={row.key}><td>{row.label}</td><td>{row.enrollments}</td><td>{row.graded}</td><td>{row.ungraded}</td><td>{row.passed}</td><td>{row.failed}</td><td>{number(row.average)}</td><td>{row.passRate === null ? '—' : number(row.passRate) + '%'}</td></tr>)}{!data.groups[group].length && <tr><td colSpan={8}>Chưa có bảng điểm phù hợp bộ lọc.</td></tr>}</tbody></table></div><p className={styles.note}>{data.policy.note}</p>
    </>}
  </section>;
}
