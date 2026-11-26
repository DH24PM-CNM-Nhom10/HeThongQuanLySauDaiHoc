'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import styles from './ThongBaoAdmin.module.css';

type Notice = {
  ma_thong_bao: number;
  tieu_de: string;
  noi_dung: string;
  ten_file: string;
  duong_dan_file: string;
  ngay_dang: string;
  trang_thai: 'nhap' | 'da_dang';
};

type Draft = Pick<Notice, 'tieu_de' | 'noi_dung' | 'ten_file' | 'duong_dan_file' | 'trang_thai'>;
const EMPTY: Draft = { tieu_de: '', noi_dung: '', ten_file: '', duong_dan_file: '', trang_thai: 'nhap' };

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export default function QuanLyThongBao() {
  const [items, setItems] = useState<Notice[]>([]);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState<'all' | 'nhap' | 'da_dang'>('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY });
  const [uploading, setUploading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/thong-bao?admin=1', { cache: 'no-store', credentials: 'same-origin' });
      const json: { data?: Notice[]; message?: string } = await response.json();
      if (!response.ok || !Array.isArray(json.data)) throw new Error(response.status === 401 ? 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại tại trang chủ.' : json.message || 'Không thể tải thông báo từ database.');
      setItems(json.data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể kết nối máy chủ.');
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  const shown = useMemo(() => items.filter((item) => {
    const query = filter.toLocaleLowerCase('vi').trim();
    return (status === 'all' || item.trang_thai === status) && (!query || `${item.tieu_de} ${item.noi_dung}`.toLocaleLowerCase('vi').includes(query));
  }), [items, status, filter]);
  const published = items.filter((x) => x.trang_thai === 'da_dang').length;
  const drafts = items.length - published;

  const startCreate = () => {
    setEditingId(null);
    setDraft({ ...EMPTY });
    setError(''); setSuccess(''); setFormOpen(true);
  };
  const startEdit = (item: Notice) => {
    setEditingId(item.ma_thong_bao);
    setDraft({ tieu_de: item.tieu_de, noi_dung: item.noi_dung || '', ten_file: item.ten_file || '', duong_dan_file: item.duong_dan_file || '', trang_thai: item.trang_thai });
    setError(''); setSuccess(''); setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || uploading) return;
    if (!draft.tieu_de.trim()) { setError('Vui lòng nhập tiêu đề thông báo.'); return; }
    if (draft.duong_dan_file && !draft.ten_file) { setError('Vui lòng nhập tên tệp khi có đường dẫn.'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await fetch(editingId === null ? '/api/thong-bao' : `/api/thong-bao/${editingId}`, {
        method: editingId === null ? 'POST' : 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const json: { message?: string; error?: string } = await response.json();
      if (!response.ok) throw new Error(json.message || json.error || 'Không thể lưu thông báo.');
      setSuccess(editingId === null ? 'Đã thêm thông báo thành công.' : 'Đã cập nhật thông báo.');
      setEditingId(null); setDraft({ ...EMPTY }); setFormOpen(false);
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể lưu thông báo.'); }
    finally { setSaving(false); }
  };
  const uploadAttachment = async (file: File | undefined) => {
    if (!file) return; setUploading(true); setError('');
    try { const form=new FormData();form.set('file',file);const response=await fetch('/api/thong-bao/files',{method:'POST',body:form});const data=await response.json();if(!response.ok)throw new Error(data.message);setDraft(current=>({...current,ten_file:data.ten_file,duong_dan_file:data.duong_dan_file})); }
    catch(error){setError(error instanceof Error?error.message:'Không tải được tệp.');}finally{setUploading(false);}
  };
  const remove = async (item: Notice) => {
    if (!window.confirm(`Bạn muốn xóa vĩnh viễn thông báo “${item.tieu_de}”?`)) return;
    setError(''); setSuccess('');
    try {
      const response = await fetch(`/api/thong-bao/${item.ma_thong_bao}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Không thể xóa thông báo.');
      setSuccess('Đã xóa thông báo.');
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Có lỗi xảy ra.'); }
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}><Link href="/admin">Quản trị</Link><span>/</span><span>Quản lý thông báo</span></div>
      <header className={styles.heading}>
        <div><span className={styles.eyebrow}>QUẢN TRỊ NỘI DUNG</span><h1>Quản lý thông báo</h1><p>Đăng tải và cập nhật thông báo trên Cổng thông tin đào tạo sau đại học.</p></div>
        <div className={styles.actions}><Link className={styles.secondaryButton} href="/thong-bao" target="_blank">Xem trang công khai</Link><button type="button" className={styles.primaryButton} onClick={startCreate}>+ Tạo thông báo</button></div>
      </header>

      <section className={styles.metrics} aria-label="Thống kê thông báo">
        <div className={styles.metric}><span>Tổng thông báo</span><strong>{items.length}</strong><small>Tất cả bản ghi</small></div>
        <div className={styles.metric}><span>Đã công bố</span><strong>{published}</strong><small>Hiển thị trên website</small></div>
        <div className={styles.metric}><span>Bản nháp</span><strong>{drafts}</strong><small>Chưa hiển thị công khai</small></div>
      </section>

      {error && <div role="alert" className={styles.error}>{error}</div>}
      {success && <div role="status" className={styles.success}>{success}</div>}

      {formOpen && <section className={styles.panel}>
        <div className={styles.panelHeader}><h2>{editingId === null ? 'Tạo thông báo mới' : `Chỉnh sửa thông báo #${editingId}`}</h2><button className={styles.textButton} type="button" onClick={() => setFormOpen(false)}>Đóng</button></div>
        <form onSubmit={save} className={styles.form}>
          <label>Tiêu đề thông báo <span className={styles.required}>*</span><input maxLength={255} required value={draft.tieu_de} onChange={(e) => setDraft({ ...draft, tieu_de: e.target.value })} placeholder="Nhập tiêu đề thông báo..." /></label>
          <label>Nội dung thông báo<textarea rows={5} maxLength={20000} value={draft.noi_dung} onChange={(e) => setDraft({ ...draft, noi_dung: e.target.value })} placeholder="Nhập nội dung chính..." /></label>
          <div className={styles.formGrid}>
            <label>Tên tệp đính kèm<input maxLength={255} value={draft.ten_file} onChange={(e) => setDraft({ ...draft, ten_file: e.target.value })} placeholder="Ví dụ: KeHoachHocTap.pdf" /></label>
            <label>Đường dẫn tệp (nếu có)<input maxLength={1024} value={draft.duong_dan_file} onChange={(e) => setDraft({ ...draft, duong_dan_file: e.target.value })} placeholder="/tai-lieu/file.pdf hoặc https://..." /></label>
          </div>
          <label>Tải tệp đính kèm (PDF, DOCX, XLSX, JPG, PNG; tối đa 10 MB)<input type="file" accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png" disabled={uploading || saving} onChange={e=>void uploadAttachment(e.target.files?.[0])}/></label>{uploading && <p role="status">Đang tải tệp...</p>}
          <div className={styles.formFooter}><label>Trạng thái<select value={draft.trang_thai} onChange={(e) => setDraft({ ...draft, trang_thai: e.target.value as Draft['trang_thai'] })}><option value="nhap">Lưu bản nháp</option><option value="da_dang">Công bố trên website</option></select></label><div className={styles.actions}><button type="button" className={styles.secondaryButton} onClick={() => setFormOpen(false)}>Hủy</button><button type="submit" className={styles.primaryButton} disabled={saving || uploading}>{saving ? 'Đang lưu...' : 'Lưu thông báo'}</button></div></div>
        </form>
      </section>}

      <section className={styles.panel}>
        <div className={styles.panelHeader}><div><h2>Danh sách thông báo</h2><p>Những thông báo đã công bố sẽ xuất hiện trên trang chủ và trang Thông báo.</p></div><button className={styles.textButton} type="button" onClick={() => void reload()}>Làm mới</button></div>
        <div className={styles.toolbar}><input aria-label="Tìm thông báo" type="search" placeholder="Tìm theo tiêu đề hoặc nội dung..." value={filter} onChange={(e) => setFilter(e.target.value)} /><select aria-label="Lọc trạng thái" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="all">Tất cả trạng thái</option><option value="da_dang">Đã công bố</option><option value="nhap">Bản nháp</option></select></div>
        <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Bảng dữ liệu"><table className="excel-grid" data-grid="excel"><thead><tr><th>THÔNG BÁO</th><th>NGÀY ĐĂNG</th><th>TRẠNG THÁI</th><th>THAO TÁC</th></tr></thead><tbody>
          {!busy && shown.map((item) => <tr key={item.ma_thong_bao}><td><strong>{item.tieu_de}</strong><small>{item.ten_file || (item.noi_dung ? item.noi_dung.slice(0, 100) : 'Không có tệp đính kèm')}</small></td><td className={styles.date}>{formatDate(item.ngay_dang)}</td><td><span className={item.trang_thai === 'da_dang' ? styles.published : styles.draft}>{item.trang_thai === 'da_dang' ? 'Đã công bố' : 'Bản nháp'}</span></td><td><div className={styles.tableActions}><button type="button" onClick={() => startEdit(item)}>Sửa</button><button type="button" className={styles.danger} onClick={() => void remove(item)}>Xóa</button></div></td></tr>)}
        </tbody></table>{busy && <div className={styles.empty}>Đang tải dữ liệu...</div>}{!busy && shown.length === 0 && <div className={styles.empty}>Chưa có thông báo phù hợp.</div>}</div>
        <div className={styles.tableFooter}>Hiển thị {shown.length} / {items.length} thông báo</div>
      </section>
    </div>
  );
}
