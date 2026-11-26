"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { DB, type StoredRecord } from '../../lib/db';
import { studentCohort } from '../../../shared/student-profile.cjs';
import { dateISO, thesisRow } from '../../../shared/thesis-progress.cjs';
import ThesisWorkflow from './ThesisWorkflow';
import styles from './ThesisProgress.module.css';

type Row = ReturnType<typeof thesisRow> & { majorCode: string; cohort: string };
const TABLE_HEADERS = ['STT', 'Mã học viên', 'Họ và tên', 'Lớp', 'Tên ngành', 'Tên luận văn / Đề tài', 'GV hướng dẫn 1', 'GV hướng dẫn 2', 'Ngày QĐ giao đề tài / Đề cương', 'Trạng thái luận văn', 'Ngày bảo vệ', 'Cảnh báo thời hạn', 'Thao tác'];
const STAGES: Record<string, string> = { unregistered: 'Chưa có đề tài', working: 'Đang thực hiện', ready: 'Chờ bảo vệ', defended: 'Đã bảo vệ', completed: 'Hoàn thành' };
const STATUS_OPTIONS = ['', 'Chưa đăng ký', 'Đang thực hiện', 'Chờ bảo vệ', 'Đã bảo vệ', 'Hoàn thành'];
const EDIT_FIELDS: Record<string, string> = { tenLuanVan: 'Tên luận văn / Đề tài', gvHuongDan1: 'Giảng viên hướng dẫn 1', gvHuongDan2: 'Giảng viên hướng dẫn 2', trangThaiLv: 'Trạng thái luận văn', ngayQD: 'Ngày quyết định giao đề tài', ngayBaoVe: 'Ngày bảo vệ', ngayTotNghiep: 'Ngày tốt nghiệp', ngayHetHan: 'Thời hạn đào tạo tối đa' };
function formatDate(value: unknown) { const date = dateISO(value); return date ? date.split('-').reverse().join('/') : 'Chưa cập nhật'; }

function ProgressEditor({ row, onClose, onSaved }: { row: Row; onClose: () => void; onSaved: (data: StoredRecord) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState(row.fields), [advisors, setAdvisors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [advisorError, setAdvisorError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/students/advisors', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Không tải được danh sách giảng viên. Bạn vẫn có thể cập nhật các mốc thời gian.');
      const result = await response.json(); setAdvisors(result.data);
    }).catch(error => { if (!controller.signal.aborted) setAdvisorError(error.message); });
    return () => controller.abort();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const changes = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== row.fields[key]));
    if (!Object.keys(changes).length) { onClose(); return; }
    try {
      const response = await fetch('/api/students/thesis', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ maHocVien: row.code, changes, previous: row.fields }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Không lưu được tiến độ.');
      onSaved(result.data);
    } catch (error) { setError(error instanceof Error ? error.message : 'Không lưu được tiến độ.'); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="progress-editor-title" onCancel={event => { if (busy) event.preventDefault(); else onClose(); }}>
    <form onSubmit={submit}>
      <header><div><p className={styles.eyebrow}>CẬP NHẬT TIẾN ĐỘ</p><h2 id="progress-editor-title">{row.name}</h2><p>{row.code} · {row.classCode || 'Chưa có lớp'}</p></div><button type="button" disabled={busy} onClick={onClose}>Đóng</button></header>
      <p className={styles.hint}>Cập nhật đề tài và các mốc thực hiện. Trạng thái học của học viên được quản lý riêng trong hồ sơ.</p>
      {advisorError && <p role="status" className={styles.warning}>{advisorError}</p>}
      <div className={styles.fields}>{Object.entries(EDIT_FIELDS).map(([key, label]) => <label key={key} className={key === 'tenLuanVan' ? styles.full : undefined}>{label}
        {key === 'tenLuanVan' ? <textarea value={values[key]} maxLength={2000} rows={3} onChange={event => setValues({ ...values, [key]: event.target.value })} />
        : key.startsWith('gvHuongDan') ? <select value={values[key]} onChange={event => setValues({ ...values, [key]: event.target.value })}><option value="">Chưa phân công</option>{[...new Set([...(values[key] ? [values[key]] : []), ...advisors])].map(name => <option key={name}>{name}</option>)}</select>
        : key === 'trangThaiLv' ? <select value={values[key]} onChange={event => setValues({ ...values, [key]: event.target.value })}>{[...new Set([...STATUS_OPTIONS, values[key]])].map(status => <option key={status} value={status}>{status || 'Tự xác định theo dữ liệu'}</option>)}</select>
        : <><input type="date" value={dateISO(values[key])} onChange={event => setValues({ ...values, [key]: event.target.value })} />{values[key] && !dateISO(values[key]) && <small>Giá trị cũ: {values[key]}. Chọn ngày để thay thế.</small>}</>}
      </label>)}</div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={onClose}>Hủy</button><button className={styles.primary} disabled={busy} type="submit">{busy ? 'Đang lưu...' : 'Lưu tiến độ'}</button></footer>
    </form>
  </dialog>;
}

function WorkflowDialog({row,close}:{row:Row;close:()=>void}) { const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();},[]);return <dialog ref={ref} className={styles.dialog} aria-label="Quy trình luận văn" onCancel={close}><header><h2>{row.code} — {row.name}</h2><button onClick={close}>Đóng</button></header><ThesisWorkflow manager code={row.code}/></dialog>; }
function ProgressDetails({ row, onClose }: { row: Row; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const fields = { 'Mã học viên': row.code, 'Họ và tên': row.name, 'Lớp': row.classCode, 'Mã ngành': row.majorCode, 'Tên ngành': row.major, 'Khóa đào tạo': row.cohort,
    ...Object.fromEntries(Object.entries(EDIT_FIELDS).map(([key, label]) => [label, key.startsWith('ngay') ? formatDate(row.fields[key]) : row.fields[key] || (key === 'trangThaiLv' ? STAGES[row.stage] : '—')])) };
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="thesis-details-title" onCancel={onClose}>
    <header><div><p className={styles.eyebrow}>THÔNG TIN LUẬN VĂN</p><h2 id="thesis-details-title">{row.name}</h2></div><button type="button" onClick={onClose}>Đóng</button></header>
    <dl className={styles.details}>{Object.entries(fields).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
  </dialog>;
}

export default function ThesisProgressTable() {
  const [students, setStudents] = useState<StoredRecord[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [search, setSearch] = useState(''), [major, setMajor] = useState(''), [classCode, setClassCode] = useState(''), [stage, setStage] = useState(''), [scope, setScope] = useState('all'), [page, setPage] = useState(1);
  const [cohort, setCohort] = useState(''), [exporting, setExporting] = useState(false), [mode, setMode] = useState<'details' | 'edit' | 'workflow'>('edit');
  const [selected, setSelected] = useState<Row | null>(null);
  async function load() { setLoading(true); setError(''); try { setStudents(await DB.syncFromApi('students')); } catch (error) { setError(error instanceof Error ? error.message : 'Không tải được tiến độ.'); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  const rows = useMemo(() => students.map(student => ({ ...thesisRow(student), majorCode: String(student.maNganh || student.ma_nganh || student.MA_NGANH || ''), cohort: studentCohort(student) })), [students]);
  const scoped = rows.filter(row => scope === 'all' || scope === 'overdue' && row.overdue || scope === 'active' && !row.inactive && !['completed', 'defended'].includes(row.stage) || scope === 'finished' && ['completed', 'defended'].includes(row.stage));
  const filtered = scoped.filter(row => (!cohort || row.cohort === cohort) && (!major || row.major === major) && (!classCode || row.classCode === classCode) && (!stage || row.stage === stage) && (!search.trim() || `${row.code} ${row.name} ${row.fields.tenLuanVan} ${row.fields.gvHuongDan1} ${row.fields.gvHuongDan2}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))));
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20)), current = Math.min(page, totalPages);
  async function exportExcel() {
    setExporting(true); setMessage('');
    try {
      const XLSX = await import('xlsx');
      const header = [...TABLE_HEADERS];
      const data = filtered.map((row, index) => [index + 1, row.code, row.name, row.classCode, row.major, row.fields.tenLuanVan, row.fields.gvHuongDan1, row.fields.gvHuongDan2, formatDate(row.fields.ngayQD), row.fields.trangThaiLv || STAGES[row.stage], formatDate(row.fields.ngayBaoVe), row.inactive ? 'Tạm ngừng theo dõi' : row.overdue ? row.daysOverdue === null ? 'Quá hạn' : `Quá hạn ${row.daysOverdue} ngày` : !row.deadline ? 'Chưa có thời hạn' : ['defended', 'completed'].includes(row.stage) ? 'Đã kết thúc theo dõi' : 'Trong hạn']);
      const sheet = XLSX.utils.aoa_to_sheet([header.slice(0, -1), ...data]);
      sheet['!cols'] = header.slice(0, -1).map(label => ({ wch: Math.max(18, Math.min(45, label.length + 5)) }));
      sheet['!autofilter'] = { ref: sheet['!ref'] || 'A1:L1' };
      const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Tiến độ luận văn');
      XLSX.writeFile(book, 'Tien_do_luan_van.xlsx');
    } catch { setMessage('Không xuất được Excel. Vui lòng thử lại.'); }
    finally { setExporting(false); }
  }
  function saved(data: StoredRecord) { const code = thesisRow(data).code; setStudents(items => items.map(item => thesisRow(item).code === code ? data : item)); setSelected(null); setMessage('Đã lưu tiến độ luận văn.'); }
  return <div className={styles.workspace}>
    <header className={styles.heading}><h1>Quản lý tiến độ luận văn</h1><div className={styles.actions}>
      <button className={styles.exportButton} onClick={() => void exportExcel()} disabled={loading || !!error || !filtered.length || exporting}>{exporting ? 'Đang xuất...' : 'Xuất Excel theo bộ lọc'}</button>
      <button className={styles.reloadButton} onClick={() => void load()} disabled={loading}>Tải lại dữ liệu</button>
    </div></header>
    {message && <p className={styles.feedback} role="status">{message}</p>}
    {error && <p className={styles.error} role="alert">{error} <button onClick={() => void load()}>Thử lại</button></p>}
    <section className={styles.panel} aria-label="Danh sách tiến độ luận văn">
      <div className={styles.filters}>
        <label>Khóa đào tạo<select value={cohort} onChange={e => { setCohort(e.target.value); setPage(1); }}><option value="">Tất cả khóa</option>{[...new Set(rows.map(row => row.cohort).filter(Boolean))].sort().map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Tìm kiếm<input placeholder="Tên, mã học viên, đề tài, người hướng dẫn" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label>
        <label>Ngành<select value={major} onChange={e => { setMajor(e.target.value); setClassCode(''); setPage(1); }}><option value="">Tất cả ngành</option>{[...new Set(rows.map(row => row.major).filter(Boolean))].sort((a,b) => a.localeCompare(b,'vi')).map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Lớp<select value={classCode} onChange={e => { setClassCode(e.target.value); setPage(1); }}><option value="">Tất cả lớp</option>{[...new Set(rows.filter(row => !major || row.major === major).map(row => row.classCode).filter(Boolean))].sort().map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Tiến độ<select value={stage} onChange={e => { setStage(e.target.value); setPage(1); }}><option value="">Tất cả tiến độ</option>{Object.entries(STAGES).map(([key,label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <label>Nhóm theo dõi<select value={scope} onChange={e => { setScope(e.target.value); setPage(1); }}><option value="all">Tất cả hồ sơ</option><option value="active">Đang theo dõi</option><option value="overdue">Cần xử lý quá hạn</option><option value="finished">Đã bảo vệ / hoàn thành</option></select></label>
        <p className={styles.count}>{loading ? 'Đang tải...' : `${filtered.length} / ${rows.length} học viên`}</p>
      </div>
      <div className={styles.scroll} tabIndex={0} role="region" aria-label="Bảng tiến độ luận văn">
        <table className={`excel-grid ${styles.table}`} data-grid="excel">
          <thead><tr>{TABLE_HEADERS.map((label, index) => <th scope="col" key={label} className={index === 0 ? 'grid-row-number' : index === TABLE_HEADERS.length - 1 ? styles.actionCell : undefined}>{label}</th>)}</tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={TABLE_HEADERS.length} className={styles.empty}>Đang tải danh sách tiến độ...</td></tr>
            : error ? <tr><td colSpan={TABLE_HEADERS.length} className={styles.empty}>Dữ liệu chưa được tải đầy đủ. Vui lòng thử lại.</td></tr>
            : !filtered.length ? <tr><td colSpan={TABLE_HEADERS.length} className={styles.empty}>Không có học viên phù hợp với bộ lọc.</td></tr>
            : filtered.slice((current - 1) * 20, current * 20).map((row, index) => <tr key={`${row.code}-${index}`}>
              <td className="grid-row-number">{(current - 1) * 20 + index + 1}</td>
              <td>{row.code || '—'}</td>
              <td>{row.name || 'Chưa có tên'}</td>
              <td>{row.classCode || '—'}</td>
              <td>{row.major || '—'}</td>
              <td className={styles.topic}>{row.hasTitle ? row.fields.tenLuanVan : 'Chưa đăng ký đề tài'}</td>
              <td>{row.fields.gvHuongDan1 || 'Chưa phân công'}</td>
              <td>{row.fields.gvHuongDan2 || '—'}</td>
              <td>{formatDate(row.fields.ngayQD)}</td>
              <td><span className={styles.badge} data-stage={row.stage}>{row.fields.trangThaiLv || STAGES[row.stage]}</span></td>
              <td>{formatDate(row.fields.ngayBaoVe)}</td>
              <td>{row.inactive ? 'Tạm ngừng theo dõi' : row.overdue
                ? <span className={styles.overdue}>{row.daysOverdue !== null ? `Quá hạn ${row.daysOverdue} ngày` : 'Trạng thái: Quá hạn'}</span>
                : !row.deadline ? 'Chưa có thời hạn' : ['defended', 'completed'].includes(row.stage) ? 'Đã kết thúc theo dõi' : 'Trong hạn'}</td>
              <td className={styles.actionCell}><div className={styles.rowActions}><button className={styles.detailButton} onClick={() => { setMode('details'); setSelected(row); }}>Chi tiết</button><button onClick={() => { setMode('workflow'); setSelected(row); }}>Xét duyệt</button><button className={styles.edit} onClick={() => { setMessage(''); setMode('edit'); setSelected(row); }}>Sửa</button></div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <footer className={styles.pagination}><span>{filtered.length ? (current - 1) * 20 + 1 : 0}–{Math.min(current * 20, filtered.length)} / {filtered.length} học viên</span><div><button disabled={loading || current <= 1} onClick={() => setPage(current - 1)}>Trước</button><span>Trang {current} / {totalPages}</span><button disabled={loading || current >= totalPages} onClick={() => setPage(current + 1)}>Sau</button></div></footer>
    </section>
    {selected && (mode === 'workflow' ? <WorkflowDialog row={selected} close={() => {setSelected(null);void load();}}/> : mode === 'details' ? <ProgressDetails key={selected.code} row={selected} onClose={() => setSelected(null)} /> : <ProgressEditor key={selected.code} row={selected} onClose={() => setSelected(null)} onSaved={saved} />)}
  </div>;
}
