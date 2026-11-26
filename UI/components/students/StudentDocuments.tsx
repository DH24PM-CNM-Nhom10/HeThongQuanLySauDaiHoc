"use client";
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import styles from './StudentDocuments.module.css';
const KINDS: Record<string, string> = { admission: 'Hồ sơ nhập học', bachelor: 'Văn bằng đại học', language: 'Chứng chỉ ngoại ngữ', informatics: 'Chứng chỉ tin học', evidence: 'Minh chứng khác' };
const STATUSES: Record<string, string> = { submitted: 'Chờ xét duyệt', approved: 'Đã công nhận', rejected: 'Cần nộp lại' };
type DocumentRecord = { id: string; maHocVien: string; hoTen: string; kind: string; title: string; serial: string; issuer: string; issuedAt: string;
  fileName: string; size: number; createdAt: string; status: string; revision: number; reviewReason?: string; reviewedBy?: string };

export default function StudentDocuments({ studentCode = '', review = false }: { studentCode?: string; review?: boolean }) {
  const [rows, setRows] = useState<DocumentRecord[]>([]), [canReview, setCanReview] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [search, setSearch] = useState(''), [kind, setKind] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1);
  const reload = useCallback(async () => {
    const response = await fetch('/api/student-documents' + (studentCode ? '?student=' + encodeURIComponent(studentCode) : ''), { cache: 'no-store', credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Không tải được hồ sơ minh chứng.');
    setRows(data.data); setCanReview(data.canReview);
  }, [studentCode]);
  useEffect(() => { let active = true; setLoading(true); void reload().catch(error => { if (active) setMessage(error.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [reload]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    if (studentCode) data.set('maHocVien', studentCode);
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/student-documents', { method: 'POST', body: data, credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Không lưu được hồ sơ.');
      await reload(); form.reset(); setMessage('Đã lưu tệp và gửi hồ sơ xét duyệt.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không lưu được hồ sơ.'); }
    finally { setBusy(false); }
  }
  async function change(row: DocumentRecord, action: string) {
    const reason = action === 'rejected' ? window.prompt('Lý do từ chối / yêu cầu nộp lại minh chứng') : '';
    if (action === 'rejected' && !reason?.trim()) return;
    if (action === 'withdraw' && !window.confirm('Thu hồi hồ sơ này? Tệp và lịch sử vẫn được lưu để đối chiếu.')) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/student-documents/' + row.id, { method: action === 'withdraw' ? 'DELETE' : 'PATCH',
        credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: row.revision, status: action, reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Không cập nhật được hồ sơ.');
      await reload(); setMessage('Đã cập nhật hồ sơ.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không cập nhật được hồ sơ.'); }
    finally { setBusy(false); }
  }
  const filtered = rows.filter(row => (!kind || row.kind === kind) && (!status || row.status === status) &&
    (!search.trim() || `${row.maHocVien} ${row.hoTen} ${row.title} ${row.serial}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi'))));
  const totalPages = Math.max(1, Math.ceil(filtered.length / 10)), current = Math.min(page, totalPages);
  return <section className={styles.panel} aria-label="Hồ sơ nhập học và minh chứng">
    <header><div><h2>{review ? 'Tiếp nhận và xét duyệt hồ sơ' : 'Hồ sơ nhập học, văn bằng và minh chứng'}</h2><p>Tệp được lưu riêng tư trên máy chủ. Chỉ học viên sở hữu và bộ phận quản lý được truy cập.</p></div><button type="button" onClick={() => void reload().catch(error => setMessage(error.message))}>Tải lại</button></header>
    <div className={styles.summary}><span>Tổng hồ sơ <strong>{rows.length}</strong></span><span>Chờ xử lý <strong>{rows.filter(row => row.status === 'submitted').length}</strong></span><span>Đã công nhận <strong>{rows.filter(row => row.status === 'approved').length}</strong></span></div>
    {message && <p className={styles.message} role="status">{message}</p>}
    {!loading && (!review || canReview) && <details className={styles.upload}><summary>Nộp hồ sơ / tải minh chứng</summary>
      <form onSubmit={upload} className={styles.form}>
        {!studentCode && canReview && <label>Mã học viên<input name="maHocVien" required maxLength={150} /></label>}
        <label>Loại hồ sơ<select name="kind">{Object.entries(KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Tên hồ sơ / văn bằng<input name="title" required maxLength={255} /></label>
        <label>Số hiệu / số chứng chỉ<input name="serial" maxLength={255} /></label><label>Đơn vị cấp<input name="issuer" maxLength={255} /></label><label>Ngày cấp<input type="date" name="issuedAt" /></label>
        <label className={styles.wide}>Tệp minh chứng (PDF, JPG, PNG; tối đa 10 MB)<input type="file" name="file" accept=".pdf,.jpg,.jpeg,.png" required /></label>
        <button className={styles.primary} disabled={busy} type="submit">{busy ? 'Đang xử lý...' : 'Lưu và gửi hồ sơ'}</button>
      </form></details>}
    <div className={styles.filters}><input aria-label="Tìm hồ sơ" placeholder="Tên, mã học viên, số hiệu hồ sơ" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /><select aria-label="Loại hồ sơ" value={kind} onChange={e => { setKind(e.target.value); setPage(1); }}><option value="">Tất cả loại hồ sơ</option>{Object.entries(KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select aria-label="Trạng thái hồ sơ" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>{Object.entries(STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    {loading ? <p role="status">Đang tải hồ sơ...</p> : <div className={styles.scroll} tabIndex={0} role="region" aria-label="Bảng dữ liệu"><table className="excel-grid" data-grid="excel"><thead><tr><th>Học viên</th><th>Hồ sơ</th><th>Văn bằng / chứng chỉ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
      {filtered.slice((current - 1) * 10, current * 10).map(row => <tr key={row.id}><td>{row.hoTen}<small>{row.maHocVien}</small></td><td><strong>{row.title}</strong><small>{KINDS[row.kind]} · {new Date(row.createdAt).toLocaleDateString('vi-VN')}</small><a href={'/api/student-documents/' + row.id + '/file'}>{row.fileName}</a><small>{Math.ceil(row.size / 1024)} KB</small></td><td>{row.serial || 'Chưa có số hiệu'}<small>{row.issuer}</small><small>{row.issuedAt}</small></td><td><span data-status={row.status}>{STATUSES[row.status]}</span>{row.reviewReason && <small>{row.reviewReason}</small>}{row.reviewedBy && <small>Xét duyệt: {row.reviewedBy}</small>}</td><td><div className={styles.buttons}>
        {canReview && row.status === 'submitted' && <><button className={styles.primary} disabled={busy} onClick={() => void change(row, 'approved')}>Công nhận</button><button className={styles.danger} disabled={busy} onClick={() => void change(row, 'rejected')}>Từ chối</button></>}
        {row.status !== 'approved' && <button disabled={busy} onClick={() => void change(row, 'withdraw')}>Thu hồi</button>}
      </div></td></tr>)}
      {!filtered.length && <tr><td colSpan={5}>Chưa có hồ sơ phù hợp.</td></tr>}
    </tbody></table></div>}
    <footer><span>{filtered.length} hồ sơ · Trang {current}/{totalPages}</span><button disabled={current <= 1} onClick={() => setPage(current - 1)}>Trước</button><button disabled={current >= totalPages} onClick={() => setPage(current + 1)}>Sau</button></footer>
  </section>;
}
