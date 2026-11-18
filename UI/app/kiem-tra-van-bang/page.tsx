"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./KiemTraVanBang.module.css";

// Cùng tên giá trị với model.ts của phần học viên.
type CertificateKind = "language" | "informatics" | "other";
type CertificateStatus = "draft" | "reviewing" | "supplement" | "recognized" | "rejected";
type RecordItem = {
  id: string;
  kind: CertificateKind;
  status: CertificateStatus;
  updatedAt: string;
  form: {
    title: string;
    level: string;
    issuer: string;
    issuedAt: string;
    serial: string;
    fullName: string;
    studentCode: string;
    className: string;
    course: string;
    major: string;
    note: string;
  };
  attachmentNames: string[];
  reviewReason?: string;
};

type StatusFilter = CertificateStatus | "all";
type KindFilter = CertificateKind | "all";
const TYPE_LABELS: Record<CertificateKind, string> = {
  language: "Ngoại ngữ",
  informatics: "Tin học",
  other: "Khác",
};
const STATUS_LABELS: Record<CertificateStatus, string> = {
  draft: "Bản nháp",
  reviewing: "Đang xét duyệt",
  supplement: "Yêu cầu bổ sung",
  recognized: "Đã công nhận",
  rejected: "Không được công nhận",
};

// DỮ LIỆU MẪU: Không có hồ sơ, thông tin cá nhân hay tệp thật của học viên.
const DEMO: RecordItem[] = Array.from({ length: 26 }, (_, i) => {
  const kinds: CertificateKind[] = ["language", "informatics", "other"];
  const statuses: CertificateStatus[] = [
    "reviewing", "reviewing", "recognized", "supplement", "rejected",
    "reviewing", "recognized", "reviewing", "recognized", "supplement",
  ];
  const kind = kinds[i % kinds.length];
  const status = statuses[i % statuses.length];
  const typeName = TYPE_LABELS[kind];
  const titles = {
    language: "Chứng chỉ ngoại ngữ VSTEP",
    informatics: "Chứng chỉ ứng dụng CNTT",
    other: "Văn bằng bổ sung",
  };
  const date = new Date(Date.UTC(2026, 10, 18 - i, 9, 30));
  const year = 2024 + (i % 3);
  return {
    id: `DEMO-${String(i + 1).padStart(4, "0")}`,
    kind,
    status,
    updatedAt: date.toISOString(),
    form: {
      title: titles[kind],
      level: kind === "language" ? "Bậc 3/6 (B1)" : "Cơ bản",
      issuer: "Đơn vị cấp (minh họa)",
      issuedAt: "2026-09-15",
      serial: `SO-HIEU-MAU-${String(i + 1).padStart(3, "0")}`,
      fullName: `Học viên mẫu ${String(i + 1).padStart(2, "0")}`,
      studentCode: `HV-MAU-${String(i + 1).padStart(3, "0")}`,
      className: `CH${year}${i % 2 === 0 ? "A" : "B"} (mẫu)`,
      course: `Khóa ${year} (mẫu)`,
      major: "Ngành đào tạo (mẫu)",
      note: `Hồ sơ ${typeName.toLowerCase()} dùng để thử giao diện.`,
    },
    attachmentNames: ["minh-chung-mau.pdf"],
    reviewReason: status === "rejected" ? "Thông tin trên minh chứng chưa khớp (mẫu)." : status === "supplement" ? "Cần bổ sung bản scan rõ nét và đủ các trang (mẫu)." : "",
  };
});

function displayDate(value: string) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  }).format(date);
}
function dateKey(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function KiemTraVanBangPage() {
  const [records, setRecords] = useState<RecordItem[]>(DEMO);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [classFilter, setClassFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState<"recognized" | "supplement" | "rejected" | "">("");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [batchDecision, setBatchDecision] = useState<"recognized" | "supplement" | "rejected" | "">("");
  const [batchReason, setBatchReason] = useState("");
  const [batchError, setBatchError] = useState("");
  const selected = records.find((record) => record.id === selectedId) ?? null;
  const dateInvalid = Boolean(from && to && from > to);
  const activeFilterCount = [kind !== "all", status !== "all", classFilter !== "all", courseFilter !== "all", Boolean(from), Boolean(to), sort !== "newest"].filter(Boolean).length;
  const availableClasses = useMemo(() => Array.from(new Set(records.map(r => r.form.className).filter(Boolean))).sort(), [records]);
  const availableCourses = useMemo(() => Array.from(new Set(records.map(r => r.form.course).filter(Boolean))).sort(), [records]);

  const counts = useMemo(() => ({
    total: records.length,
    newCount: records.filter((r) => r.status === "reviewing").length,
    supplement: records.filter((r) => r.status === "supplement").length,
    recognized: records.filter((r) => r.status === "recognized").length,
    rejected: records.filter((r) => r.status === "rejected").length,
  }), [records]);

  const filtered = useMemo(() => {
    if (dateInvalid) return [];
    const q = search.trim().toLocaleLowerCase("vi-VN");
    return records.filter((r) => {
      const form = r.form;
      const searchable = [r.id, form.fullName, form.studentCode, form.title, form.serial, form.className, form.course].join(" ").toLocaleLowerCase("vi-VN");
      const day = dateKey(r.updatedAt);
      return (kind === "all" || r.kind === kind)
        && (status === "all" || r.status === status)
        && (classFilter === "all" || form.className === classFilter)
        && (courseFilter === "all" || form.course === courseFilter)
        && (!from || day >= from)
        && (!to || day <= to)
        && (!q || searchable.includes(q));
    }).sort((a, b) => sort === "newest"
      ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      : new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  }, [records, search, kind, status, classFilter, courseFilter, from, to, sort, dateInvalid]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  const isReviewable = (r: RecordItem) => r.status === "reviewing" || r.status === "supplement";
  const pageSelectable = items.filter(isReviewable);
  const batchRecords = records.filter(r => selectedIds.includes(r.id) && isReviewable(r));
  const missingReviews = batchRecords.filter(r => !reviewedIds.includes(r.id));
  const nextReviewable = selected ? (() => {
    const index = filtered.findIndex(r => r.id === selected.id);
    const order = [...filtered.slice(index + 1), ...filtered.slice(0, index)];
    return order.find(r => r.id !== selected.id && isReviewable(r)) ?? null;
  })() : null;

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  function resetFilters() {
    setSearch(""); setKind("all"); setStatus("all"); setClassFilter("all"); setCourseFilter("all");
    setFrom(""); setTo(""); setSort("newest"); setPage(1);
  }
  function openDetails(record: RecordItem) {
    setSelectedId(record.id);
    setDecision(""); setReason(""); setError("");
  }
  function toggleRow(id: string, value: boolean) {
    setSelectedIds(before => value ? Array.from(new Set([...before, id])) : before.filter(item => item !== id));
    setBatchError("");
  }
  function togglePage(value: boolean) {
    const ids = pageSelectable.map(r => r.id);
    setSelectedIds(before => value ? Array.from(new Set([...before, ...ids])) : before.filter(id => !ids.includes(id)));
    setBatchError("");
  }
  function saveBatch() {
    if (!batchRecords.length) { setBatchError("Hãy chọn ít nhất một hồ sơ đang xét duyệt hoặc cần bổ sung."); return; }
    if (!batchDecision) { setBatchError("Hãy chọn kết quả xử lý hàng loạt."); return; }
    if (batchDecision !== "recognized" && !batchReason.trim()) {
      setBatchError("Vui lòng nhập Lý do hoặc Ghi chú cho các hồ sơ được chọn."); return;
    }
    if (missingReviews.length) {
      setBatchError(`Còn ${missingReviews.length} hồ sơ chưa được xác nhận đã kiểm tra minh chứng. Hãy mở từng hồ sơ, đọc file và đánh dấu đã kiểm tra trước khi lưu.`);
      return;
    }
    const label = STATUS_LABELS[batchDecision];
    if (!window.confirm(`Áp dụng “${label}” cho ${batchRecords.length} hồ sơ đã chọn?`)) return;
    const ids = new Set(batchRecords.map(r => r.id));
    const now = new Date().toISOString();
    setRecords(before => before.map(r => ids.has(r.id) ? {
      ...r, status: batchDecision, reviewReason: batchDecision === "recognized" ? "" : batchReason.trim(), updatedAt: now,
    } : r));
    setSelectedIds([]); setBatchDecision(""); setBatchReason(""); setBatchError("");
    setNotice(`Đã chuyển ${batchRecords.length} hồ sơ sang “${label}” trong phiên thử nghiệm. Tải lại trang sẽ mất thay đổi.`);
    setPage(1);
  }
  function saveDecision() {
    if (!selected) return;
    if (selected.status !== "reviewing" && selected.status !== "supplement") {
      setError("Hồ sơ này đã có kết quả; phiên mẫu không hỗ trợ thay đổi kết quả.");
      return;
    }
    if (!decision) { setError("Hãy chọn Công nhận, Yêu cầu bổ sung hoặc Không công nhận."); return; }
    if (!reviewedIds.includes(selected.id)) { setError("Hãy đọc minh chứng và đánh dấu Đã kiểm tra trước khi lưu."); return; }
    if (decision !== "recognized" && !reason.trim()) {
      setError("Vui lòng nhập lý do hoặc ghi chú cho kết quả này."); return;
    }
    setRecords((before) => before.map((r) => r.id === selected.id
      ? { ...r, status: decision, reviewReason: decision === "recognized" ? "" : reason.trim(), updatedAt: new Date().toISOString() }
      : r));
    setSelectedId(null);
    setSelectedIds(before => before.filter(id => id !== selected.id));
    setNotice(`Đã cập nhật hồ sơ ${selected.id} trong phiên thử nghiệm. Tải lại trang sẽ mất thay đổi.`);
    setPage(1);
    setError("");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>PHÒNG ĐÀO TẠO · VĂN BẰNG / CHỨNG CHỈ</p>
          <h1>Quản lý xét duyệt hồ sơ</h1>
          <p>Theo dõi hồ sơ học viên, xem minh chứng và cập nhật kết quả xác minh.</p>
        </div>
        <span className={styles.demoBadge}>Giao diện thử nghiệm</span>
      </header>

      <div className={styles.notice} role="note">
        Đây là dữ liệu giả để thử bố cục. Trang chưa đọc hồ sơ/file từ máy chủ và chưa lưu kết quả vào cơ sở dữ liệu.
        “Hồ sơ mới” tạm tính là các hồ sơ đang xét duyệt. Đánh dấu đã kiểm tra, chọn nhiều hồ sơ và lưu chỉ có hiệu lực trong phiên mẫu.
      </div>
      {notice && <p className={styles.success} role="status">✓ {notice}</p>}

      <section className={styles.stats} aria-label="Thống kê hồ sơ">
        {[
          { label: "Tổng hồ sơ", value: counts.total, tone: "total" },
          { label: "Hồ sơ mới / chờ xử lý", value: counts.newCount, tone: "pending" },
          { label: "Yêu cầu bổ sung", value: counts.supplement, tone: "supplement" },
          { label: "Đã công nhận", value: counts.recognized, tone: "approved" },
          { label: "Không công nhận", value: counts.rejected, tone: "denied" },
        ].map((card) => (
          <div className={styles.statCard} data-tone={card.tone} key={card.label}>
            <span>{card.label}</span><strong>{card.value.toString().padStart(2, "0")}</strong>
          </div>
        ))}
      </section>

      <section className={styles.panel} aria-label="Danh sách hồ sơ">
        <div className={styles.panelTitle}>
          <div><h2>Danh sách hồ sơ</h2><p>Tìm kiếm và chọn hồ sơ để kiểm tra</p></div>
          <span className={styles.resultCount}>{filtered.length} hồ sơ phù hợp</span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="admin-certificate-advanced"
            onClick={() => setFiltersOpen((previous) => !previous)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 9,
              padding: "9px 14px", border: "1px solid #b7d7d1", borderRadius: 8,
              background: filtersOpen ? "#e5f4f0" : "#ffffff", color: "#176d70",
              fontSize: 13, fontWeight: 650, cursor: "pointer",
            }}
          >
            {filtersOpen ? "Thu gọn bộ lọc" : "Mở rộng bộ lọc"}
            {activeFilterCount > 0 && <span style={{ background: "#176d70", color: "white", borderRadius: 12, padding: "1px 7px", fontSize: 11 }}>{activeFilterCount}</span>}
            <span aria-hidden="true">{filtersOpen ? "▴" : "▾"}</span>
          </button>
        </div>
        <div className={styles.filters}>
          <label className={styles.searchField}>
            <span>Tìm kiếm</span>
            <input type="search" value={search} placeholder="Mã hồ sơ, tên, mã học viên, lớp, khóa hoặc số hiệu chứng chỉ..." onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </label>
          <div id="admin-certificate-advanced" style={{ display: filtersOpen ? "contents" : "none" }}>
            <label><span>Loại hồ sơ</span>
              <select value={kind} onChange={(e) => { setKind(e.target.value as KindFilter); setPage(1); }}>
                <option value="all">Tất cả loại</option>
                {Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label><span>Trạng thái</span>
              <select value={status} onChange={(e) => { setStatus(e.target.value as StatusFilter); setPage(1); }}>
                <option value="all">Tất cả trạng thái</option>
                {(["reviewing", "supplement", "recognized", "rejected"] as const).map((key) => <option key={key} value={key}>{STATUS_LABELS[key]}</option>)}
              </select>
            </label>
            <label><span>Lớp</span>
              <select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setPage(1); }}>
                <option value="all">Tất cả lớp</option>
                {availableClasses.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label><span>Khóa học</span>
              <select value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}>
                <option value="all">Tất cả khóa</option>
                {availableCourses.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label><span>Từ ngày cập nhật</span><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></label>
            <label><span>Đến ngày</span><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></label>
            <label><span>Sắp xếp</span><select value={sort} onChange={(e) => { setSort(e.target.value as "newest" | "oldest"); setPage(1); }}><option value="newest">Mới nhất trước</option><option value="oldest">Cũ nhất trước</option></select></label>
          </div>
        </div>
        {(filtersOpen || activeFilterCount > 0 || Boolean(search) || dateInvalid) && <div className={styles.filterFooter}>
          {dateInvalid
            ? <p className={styles.filterError} role="alert">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>
            : <span>{activeFilterCount > 0 ? `Đang áp dụng ${activeFilterCount} bộ lọc` : "Dựa trên ngày cập nhật hồ sơ."}</span>}
          <button type="button" className={styles.resetButton} onClick={resetFilters}>Xóa bộ lọc</button>
        </div>}

        <div style={{ margin: "15px 0", padding: "13px 15px", background: selectedIds.length ? "#f0f8f5" : "#f8fafb", border: "1px solid #d7e8e4", borderRadius: 9 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div><strong>Chọn nhiều hồ sơ để xét duyệt</strong>
              <p style={{ fontSize: 12, color: "#627e87", marginTop: 4 }}>
                Đã chọn {batchRecords.length} hồ sơ trên các trang · {batchRecords.length - missingReviews.length} hồ sơ đã xác nhận kiểm tra minh chứng.
              </p>
            </div>
            <button type="button" className={styles.resetButton} disabled={!selectedIds.length} onClick={() => { setSelectedIds([]); setBatchError(""); setBatchDecision(""); setBatchReason(""); }}>Bỏ chọn tất cả</button>
          </div>
          {batchRecords.length > 0 && <>
            <p style={{ color: "#607f87", fontSize: 12, margin: "10px 0" }}>Chọn kết quả chung. Với hồ sơ cần bổ sung hoặc không công nhận, lý do sẽ được áp dụng cho tất cả hồ sơ đã chọn.</p>
            <div className={styles.decisionButtons}>
              <button type="button" className={styles.decisionButton} aria-pressed={batchDecision === "recognized"} style={batchDecision === "recognized" ? { background: "#23825d", borderColor: "#23825d", color: "#fff" } : {}} onClick={() => { setBatchDecision("recognized"); setBatchReason(""); setBatchError(""); }}>✓ Công nhận</button>
              <button type="button" className={styles.decisionButton} aria-pressed={batchDecision === "supplement"} style={batchDecision === "supplement" ? { background: "#b96b2f", borderColor: "#b96b2f", color: "#fff" } : {}} onClick={() => { setBatchDecision("supplement"); setBatchError(""); }}>↻ Yêu cầu bổ sung</button>
              <button type="button" className={styles.decisionButton} aria-pressed={batchDecision === "rejected"} style={batchDecision === "rejected" ? { background: "#c34e4e", borderColor: "#c34e4e", color: "#fff" } : {}} onClick={() => { setBatchDecision("rejected"); setBatchError(""); }}>✕ Không công nhận</button>
            </div>
            {batchDecision && batchDecision !== "recognized" && <label className={styles.reasonField}>
              Lý do hoặc Ghi chú (bắt buộc)
              <textarea rows={3} maxLength={1000} value={batchReason} onChange={e => { setBatchReason(e.target.value); setBatchError(""); }} placeholder="Nhập lý do dùng chung cho những hồ sơ được chọn..." />
            </label>}
            {missingReviews.length > 0 && <p style={{ color: "#9a6d29", fontSize: 12, marginTop: 9 }}>Lưu ý: Cần mở và kiểm tra minh chứng của {missingReviews.length} hồ sơ trước khi xét duyệt hàng loạt. Ô chọn không có nghĩa là đã kiểm tra.</p>}
            {batchError && <p className={styles.filterError} role="alert">{batchError}</p>}
            <button type="button" className={styles.saveButton} style={{ marginTop: 12 }} disabled={!batchDecision || missingReviews.length > 0} onClick={saveBatch}>Lưu kết quả {batchRecords.length} hồ sơ</button>
          </>}
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead><tr>
              <th><input type="checkbox" aria-label="Chọn tất cả hồ sơ có thể xét duyệt ở trang này" disabled={!pageSelectable.length} checked={pageSelectable.length > 0 && pageSelectable.every(r => selectedIds.includes(r.id))} onChange={e => togglePage(e.target.checked)} /></th>
              <th>Mã hồ sơ</th><th>Học viên</th><th>Văn bằng / Chứng chỉ</th><th>Lớp / Khóa</th><th>Loại</th><th>Ngày cập nhật</th><th>Trạng thái</th><th>Thao tác</th>
            </tr></thead>
            <tbody>
              {items.map((r) => <tr key={r.id}>
                <td><input type="checkbox" aria-label={`Chọn hồ sơ ${r.id}`} checked={selectedIds.includes(r.id)} disabled={!isReviewable(r)} onChange={e => toggleRow(r.id, e.target.checked)} /></td>
                <td className={styles.idCell}>{r.id}</td>
                <td><div className={styles.personName}>{r.form.fullName}</div><div className={styles.subText}>{r.form.studentCode}</div></td>
                <td><div className={styles.docTitle}>{r.form.title}</div><div className={styles.subText}>Số hiệu: {r.form.serial}</div></td>
                <td style={{ whiteSpace: "nowrap" }}>{r.form.className}<div className={styles.subText}>{r.form.course}</div></td>
                <td>{TYPE_LABELS[r.kind]}</td>
                <td>{displayDate(r.updatedAt)}</td>
                <td><span className={styles.statusBadge} data-status={r.status}>{STATUS_LABELS[r.status]}</span></td>
                <td><button className={styles.viewButton} type="button" onClick={() => openDetails(r)}>{reviewedIds.includes(r.id) ? "✓ Đã xem · Xem lại" : "Xem chi tiết"}</button></td>
              </tr>)}
              {!items.length && <tr><td colSpan={9} className={styles.empty}>Không tìm thấy hồ sơ phù hợp. Hãy thử thay đổi bộ lọc.</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className={styles.pagination}>
          <span>{filtered.length ? `Hiển thị ${start + 1}–${Math.min(start + pageSize, filtered.length)} / ${filtered.length} hồ sơ` : "0 hồ sơ"}</span>
          <div className={styles.paginationActions}>
            <label>Hiển thị <select aria-label="Số hồ sơ mỗi trang" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select> / trang</label>
            <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Trang trước">‹</button>
            <span>Trang {currentPage}/{totalPages}</span>
            <button type="button" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} aria-label="Trang sau">›</button>
          </div>
        </footer>
      </section>

      {selected && <div className={styles.backdrop} onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}>
        <section className={styles.dialog} style={{ width: "min(1140px, calc(100vw - 32px))", maxHeight: "96vh" }} role="dialog" aria-modal="true" aria-labelledby="review-title">
          <header className={styles.dialogHeader}>
            <div><p className={styles.eyebrow}>CHI TIẾT HỒ SƠ · {selected.id}</p><h2 id="review-title">{selected.form.title}</h2></div>
            <button type="button" className={styles.closeButton} aria-label="Đóng" onClick={() => setSelectedId(null)}>×</button>
          </header>
          <div className={styles.dialogBody}>
            <div
              className={styles.detailGrid}
              style={{
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 430px), 1fr))",
                columnGap: 18,
                rowGap: 8,
                padding: 14,
              }}
            >
              {[
                ["Họ tên học viên", selected.form.fullName], ["Mã học viên", selected.form.studentCode],
                ["Lớp", selected.form.className], ["Khóa học", selected.form.course], ["Ngành", selected.form.major],
                ["Loại hồ sơ", TYPE_LABELS[selected.kind]], ["Số hiệu", selected.form.serial],
                ["Trình độ / Xếp loại", selected.form.level], ["Nơi cấp", selected.form.issuer],
                ["Ngày cấp", displayDate(selected.form.issuedAt)], ["Ngày cập nhật", displayDate(selected.updatedAt)],
                ["Ghi chú học viên", selected.form.note],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: 10, minWidth: 0, padding: "5px 0", borderBottom: "1px solid #eaf0f1" }}>
                  <span style={{ flex: "0 0 136px", whiteSpace: "nowrap", fontSize: 12 }}>{label}:</span>
                  <strong title={value || "Chưa bổ sung"} style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{value || "Chưa bổ sung"}</strong>
                </div>
              ))}
            </div>
            <h3 className={styles.sectionTitle}>Tệp minh chứng — xem trực tiếp</h3>
            <div className={styles.fileCard}>
              <div><strong>📄 {selected.attachmentNames[0]}</strong><span>PDF mẫu hiển thị ngay dưới đây. Chỉ mở tab mới nếu cần phóng to hoặc tải xuống.</span></div>
              <a href="/mau-van-bang.pdf" target="_blank" rel="noopener noreferrer" className={styles.fileButton}>Mở file ở tab mới</a>
            </div>
            <iframe
              className={styles.preview}
              title="Đọc minh chứng PDF ngay trên trang"
              src="/mau-van-bang.pdf#view=FitH"
              style={{ height: "min(76vh, 760px)", minHeight: 520, width: "100%", display: "block" }}
            />
            {(selected.status === "reviewing" || selected.status === "supplement") && <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 13, marginTop: 12, border: "1px solid #cde2dc", borderRadius: 8, background: "#f2faf7", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={reviewedIds.includes(selected.id)} onChange={e => setReviewedIds(before => e.target.checked ? Array.from(new Set([...before, selected.id])) : before.filter(id => id !== selected.id))} style={{ marginTop: 2, width: 17, height: 17, flexShrink: 0 }} />
              <span>Tôi đã mở, đọc và đối chiếu minh chứng của hồ sơ này. (Bắt buộc trước khi lưu kết quả)</span>
            </label>}
            <h3 className={styles.sectionTitle}>Kết quả xét duyệt</h3>
            <div className={styles.currentStatus}>Hiện tại: <span className={styles.statusBadge} data-status={selected.status}>{STATUS_LABELS[selected.status]}</span></div>
            {selected.reviewReason && <p className={styles.oldReason}><strong>Lý do hoặc Ghi chú đã lưu:</strong> {selected.reviewReason}</p>}
            {(selected.status === "reviewing" || selected.status === "supplement") ? <>
              <p className={styles.help}>Đọc minh chứng phía trên, sau đó chọn một trong ba kết quả:</p>
              <div className={styles.decisionButtons}>
                <button type="button" aria-pressed={decision === "recognized"} className={`${styles.decisionButton} ${decision === "recognized" ? styles.activeAccept : ""}`} onClick={() => { setDecision("recognized"); setReason(""); setError(""); }}>✓ Công nhận</button>
                <button
                  type="button"
                  aria-pressed={decision === "supplement"}
                  className={styles.decisionButton}
                  style={decision === "supplement" ? { background: "#b96b2f", borderColor: "#b96b2f", color: "#fff" } : {}}
                  onClick={() => { setDecision("supplement"); setError(""); }}
                >↻ Yêu cầu bổ sung</button>
                <button type="button" aria-pressed={decision === "rejected"} className={`${styles.decisionButton} ${decision === "rejected" ? styles.activeReject : ""}`} onClick={() => { setDecision("rejected"); setError(""); }}>✕ Không công nhận</button>
              </div>
              <div className={styles.reasonField} style={{ marginTop: 16 }}>
                <label htmlFor="review-reason" style={{ display: "block", marginBottom: 8, fontWeight: 650 }}>
                  Lý do hoặc Ghi chú
                  {decision === "supplement" || decision === "rejected"
                    ? <span> (bắt buộc)</span>
                    : <span> {decision === "recognized" ? "(không cần khi công nhận)" : "(chọn kết quả để nhập)"}</span>}
                </label>
                {decision === "recognized" ? (
                  <p className={styles.help}>Hồ sơ được công nhận, không cần nhập lý do hoặc ghi chú.</p>
                ) : (
                  <textarea
                    id="review-reason"
                    rows={3}
                    maxLength={1000}
                    required={decision === "supplement" || decision === "rejected"}
                    value={reason}
                    onChange={(e) => { setReason(e.target.value); setError(""); }}
                    placeholder={decision === "supplement"
                      ? "Ví dụ: Cần bổ sung mặt sau chứng chỉ và bản scan rõ nét hơn..."
                      : decision === "rejected"
                        ? "Ví dụ: Số hiệu chứng chỉ không khớp với thông tin hồ sơ..."
                        : "Chọn Yêu cầu bổ sung hoặc Không công nhận để ghi lý do..."}
                    disabled={!decision}
                    style={{ width: "100%", boxSizing: "border-box" }}
                  />
                )}
              </div>
              {error && <p className={styles.filterError} role="alert">{error}</p>}
            </> : <p className={styles.help}>Hồ sơ đã có kết quả. Bản xem thử không cho thay đổi kết quả đã xác minh.</p>}
          </div>
          <footer className={styles.dialogFooter}>
            {nextReviewable && <button type="button" className={styles.cancelButton} onClick={() => {
              if ((decision || reason) && !window.confirm("Bạn có kết quả chưa lưu. Chuyển sang hồ sơ tiếp theo và bỏ thay đổi này?")) return;
              openDetails(nextReviewable);
            }}>Hồ sơ tiếp theo →</button>}
            <button type="button" className={styles.cancelButton} onClick={() => setSelectedId(null)}>Đóng</button>
            {(selected.status === "reviewing" || selected.status === "supplement") && <button type="button" className={styles.saveButton} onClick={saveDecision}>Lưu kết quả thử nghiệm</button>}
          </footer>
        </section>
      </div>}
    </main>
  );
}
