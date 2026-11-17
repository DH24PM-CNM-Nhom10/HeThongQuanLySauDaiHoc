"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Eye, FileText, Filter, Globe2, GraduationCap, Laptop, Pencil, RotateCcw, Search, Trash2, X } from "lucide-react";
import { CATEGORIES, STATUS_LABELS, categoryName, formatDate, queryCertificates, type CertificateFilters, type CertificateRecord, type CertificateKind, type CertificateStatus } from "./model";
import styles from "./StudentCertificates.module.css";

type Props = {
  records: CertificateRecord[];
  formOpen: boolean;
  onCreate: () => void;
  onSample: () => void;
  onView: (record: CertificateRecord) => void;
  onEdit: (record: CertificateRecord) => void;
  onDelete: (id: string) => void;
};
const ICONS = { language: Globe2, informatics: Laptop, other: GraduationCap };
const INITIAL_FILTERS: CertificateFilters = { kind: "all", status: "all", from: "", to: "", search: "", order: "newest" };

export default function CertificateHistory({ records, formOpen, onCreate, onSample, onView, onEdit, onDelete }: Props) {
  const [filters, setFilters] = useState<CertificateFilters>(INITIAL_FILTERS);
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const result = useMemo(() => queryCertificates(records, filters, page, pageSize), [records, filters, page, pageSize]);
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const hasFilters = filters.kind !== "all" || filters.status !== "all" || Boolean(filters.from || filters.to || filters.search.trim());

  function change<K extends keyof CertificateFilters>(key: K, next: CertificateFilters[K]) {
    setFilters(previous => ({ ...previous, [key]: next }));
    setPage(1); setDeleteId(null);
  }
  function reset() { setFilters({ ...INITIAL_FILTERS }); setPage(1); setDeleteId(null); }
  const chips = [
    ...(filters.search.trim() ? [{ key: "search", label: "Từ khóa: " + filters.search.trim(), remove: () => change("search", "") }] : []),
    ...(filters.kind !== "all" ? [{ key: "kind", label: categoryName(filters.kind), remove: () => change("kind", "all") }] : []),
    ...(filters.status !== "all" ? [{ key: "status", label: STATUS_LABELS[filters.status], remove: () => change("status", "all") }] : []),
    ...(filters.from || filters.to ? [{ key: "date", label: (filters.from ? "Từ " + formatDate(filters.from) : "") + (filters.from && filters.to ? " · " : "") + (filters.to ? "Đến " + formatDate(filters.to) : ""), remove: () => { setFilters(previous => ({ ...previous, from: "", to: "" })); setPage(1); setDeleteId(null); } }] : []),
    ...(filters.order !== "newest" ? [{ key: "order", label: "Cũ nhất trước", remove: () => change("order", "newest") }] : []),
  ];

  const pages = Array.from(new Set([1, result.page - 1, result.page, result.page + 1, result.totalPages]))
    .filter(number => number >= 1 && number <= result.totalPages).sort((a, b) => a - b);

  return <div className={styles.history}>
    <div className={styles.listHeading}><div><h3>Hồ sơ của bạn <span>{records.length}</span></h3><p>Tra cứu hồ sơ và theo dõi kết quả xử lý.</p></div><button type="button" className={styles.textButton} onClick={onSample}><FileText size={16} />Xem hồ sơ mẫu</button></div>
    <div className={styles.filterPanel} role="search" aria-label="Lọc hồ sơ chứng chỉ">
      <div className={styles.filterToolbar}>
        <label className={styles.filterSearch} htmlFor="cert-history-search"><span className={styles.srOnly}>Tìm hồ sơ theo tên hoặc số hiệu</span><div className={styles.searchInput}><Search size={17} aria-hidden="true" /><input id="cert-history-search" type="search" placeholder="Tìm tên hoặc số hiệu chứng chỉ…" value={filters.search} onChange={event => change("search", event.target.value)} /></div></label>
        <button type="button" className={styles.filterToggle} aria-expanded={expanded} aria-controls="cert-advanced-filters" onClick={() => setExpanded(previous => !previous)}><Filter size={16} /><span>Bộ lọc</span>{chips.length > 0 && <span className={styles.filterCount}>{chips.length}</span>}{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
      </div>
      {chips.length > 0 ? <div className={styles.filterChips} aria-label="Điều kiện đang áp dụng">{chips.map(chip => <button type="button" key={chip.key} onClick={chip.remove} aria-label={"Bỏ điều kiện " + chip.label}>{chip.label}<X size={13} aria-hidden="true" /></button>)}<button type="button" className={styles.clearFilters} onClick={reset}>Xóa tất cả</button></div> : !expanded && <p className={styles.filterHint}>Lọc theo loại hồ sơ, trạng thái và ngày cập nhật.</p>}
      <div id="cert-advanced-filters" hidden={!expanded} className={styles.advancedFilters}>
        <div className={styles.filterHeading}><span>Điều kiện lọc</span><button type="button" className={styles.textButton} onClick={reset} disabled={!hasFilters && filters.order === "newest"}><RotateCcw size={13} />Đặt lại</button></div>
        <div className={styles.filterGrid}>
          <label className={styles.filterField} htmlFor="cert-history-kind"><span>Loại hồ sơ</span><select id="cert-history-kind" value={filters.kind} onChange={event => change("kind", event.target.value as CertificateKind | "all")}><option value="all">Tất cả loại hồ sơ</option>{CATEGORIES.map(category => <option key={category.key} value={category.key}>{category.title}</option>)}</select></label>
          <label className={styles.filterField} htmlFor="cert-history-status"><span>Trạng thái</span><select id="cert-history-status" value={filters.status} onChange={event => change("status", event.target.value as CertificateStatus | "all")}><option value="all">Tất cả trạng thái</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className={styles.filterField} htmlFor="cert-history-order"><span>Sắp xếp</span><select id="cert-history-order" value={filters.order} onChange={event => change("order", event.target.value as CertificateFilters["order"])}><option value="newest">Cập nhật mới nhất</option><option value="oldest">Cập nhật cũ nhất</option></select></label>
          <label className={styles.filterField} data-date="true" htmlFor="cert-history-from"><span>Cập nhật từ ngày</span><input id="cert-history-from" type="date" value={filters.from} onChange={event => change("from", event.target.value)} aria-invalid={invalidRange} aria-describedby={invalidRange ? "cert-date-range-error" : undefined} /></label>
          <label className={styles.filterField} data-date="true" htmlFor="cert-history-to"><span>Đến hết ngày</span><input id="cert-history-to" type="date" value={filters.to} onChange={event => change("to", event.target.value)} aria-invalid={invalidRange} aria-describedby={invalidRange ? "cert-date-range-error" : undefined} /></label>
        </div>
      </div>
      {invalidRange && <p id="cert-date-range-error" className={styles.filterError} role="alert">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc. Hãy mở Bộ lọc để điều chỉnh.</p>}
    </div>

    <div className={styles.resultsBar}><span role="status" aria-live="polite">{invalidRange ? "Vui lòng kiểm tra khoảng ngày" : `${result.total} hồ sơ${hasFilters ? " phù hợp" : ""}`}</span>{records.length > 5 && <label htmlFor="cert-history-size">Hiển thị<select id="cert-history-size" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); setDeleteId(null); }}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select>hồ sơ / trang</label>}</div>

    {!result.items.length ? <div className={styles.empty}><span className={styles.emptyIcon}><FileText size={29} /></span><strong>{records.length ? "Không có hồ sơ phù hợp" : "Chưa có hồ sơ văn bằng / chứng chỉ"}</strong><p>{records.length ? "Thử thay đổi loại hồ sơ, trạng thái hoặc khoảng ngày cập nhật." : "Bắt đầu bằng cách chọn loại chứng chỉ và bổ sung minh chứng của bạn."}</p>{hasFilters ? <button type="button" className={styles.textButton} onClick={reset}>Xóa bộ lọc<RotateCcw size={14} /></button> : !records.length && <button type="button" className={styles.textButton} onClick={onCreate} disabled={formOpen}>Tạo hồ sơ đầu tiên<ChevronRight size={16} /></button>}</div> : <div className={styles.records}>{result.items.map(record => {
      const Icon = ICONS[record.kind];
      return <article className={styles.record} key={record.id}>
        <span className={styles.recordIcon}><Icon size={23} /></span>
        <div className={styles.recordBody}><div className={styles.recordTitle}><h4>{record.form.title || `Hồ sơ ${categoryName(record.kind).toLowerCase()} chưa đặt tên`}</h4><span className={styles.statusBadge} data-status={record.status}>{STATUS_LABELS[record.status]}</span></div>
          <p>{categoryName(record.kind)}<span>·</span>{record.attachments.length} tệp đính kèm<span>·</span>Cập nhật {new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(record.updatedAt))}</p>
          {deleteId === record.id && <div className={styles.deleteConfirmation}><span>Xóa bản nháp này?</span><button type="button" onClick={() => { onDelete(record.id); setDeleteId(null); }}>Xóa bản nháp</button><button type="button" onClick={() => setDeleteId(null)}>Giữ lại</button></div>}
        </div>
        <div className={styles.recordActions}><button type="button" className={styles.recordActionButton} title="Xem hồ sơ" aria-label={`Xem ${record.form.title || "hồ sơ"}`} onClick={() => onView(record)}><Eye size={16} /><span>Xem</span></button>{record.status === "draft" && <><button type="button" className={styles.recordActionButton} title="Sửa bản nháp" aria-label={`Sửa ${record.form.title || "bản nháp"}`} onClick={() => onEdit(record)}><Pencil size={15} /><span>Sửa</span></button><button type="button" className={styles.iconButton} title="Xóa bản nháp" aria-label={`Xóa ${record.form.title || "bản nháp"}`} onClick={() => setDeleteId(record.id)}><Trash2 size={17} /></button></>}</div>
      </article>;
    })}</div>}

    <footer className={styles.pagination}><span>{result.total ? `Hiển thị ${result.start}–${result.end} / ${result.total} hồ sơ` : "Hiển thị 0 hồ sơ"}</span>{result.totalPages > 1 && <nav aria-label="Phân trang hồ sơ chứng chỉ"><button type="button" disabled={result.page <= 1} aria-label="Trang trước" onClick={() => { setPage(result.page - 1); setDeleteId(null); }}><ChevronLeft size={16} /></button>{pages.map((number, index) => <span className={styles.pageItem} key={number}>{index > 0 && number - pages[index - 1] > 1 && <span className={styles.ellipsis} aria-hidden="true">…</span>}<button type="button" aria-label={`Trang ${number}`} aria-current={number === result.page ? "page" : undefined} onClick={() => { setPage(number); setDeleteId(null); }}>{number}</button></span>)}<button type="button" disabled={result.page >= result.totalPages} aria-label="Trang sau" onClick={() => { setPage(result.page + 1); setDeleteId(null); }}><ChevronRight size={16} /></button></nav>}</footer>
  </div>;
}
