"use client";
import { useState, type FormEvent } from 'react';
import type { StoredRecord } from '../../lib/db';
import styles from './StudentManagementTable.module.css';
const FIELDS = [['email', 'Email'], ['soDienThoai', 'Số điện thoại'], ['diaChi', 'Địa chỉ liên hệ'], ['donViCongTac', 'Đơn vị công tác'], ['noiSinh', 'Nơi sinh']];
export default function StudentContactForm({ student, onSaved }: { student: StoredRecord; onSaved: (record: StoredRecord) => void }) {
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const body = Object.fromEntries(new FormData(event.currentTarget));
      const response = await fetch('/api/student-records/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Không lưu được thông tin.');
      onSaved(data.data); setMessage('Đã lưu thông tin liên hệ.'); window.dispatchEvent(new Event('agu-auth-changed'));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Không lưu được thông tin.'); }
    finally { setBusy(false); }
  }
  return <details className={styles.editSection}><summary>Cập nhật thông tin liên hệ</summary>
    <form onSubmit={save}><div className={styles.editFields}>{FIELDS.map(([key, label]) => <label key={key}>{label}<input name={key} type={key === 'email' ? 'email' : key === 'soDienThoai' ? 'tel' : 'text'} maxLength={key === 'diaChi' ? 1000 : 255} defaultValue={String(student[key] || '')} /></label>)}</div>
      <p>Thông tin học tập và định danh được cập nhật bởi bộ phận quản lý.</p>
      {message && <p role="status">{message}</p>}<button type="submit" className={styles.addButton} disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu thông tin liên hệ'}</button>
    </form></details>;
}
