"use client";
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import styles from './OfficeNoticeInline.module.css';
type Notice={ma_thong_bao:number;tieu_de:string;noi_dung:string;ten_file:string;duong_dan_file:string;ngay_dang:string;trang_thai:'nhap'|'da_dang'};
type Draft=Pick<Notice,'tieu_de'|'noi_dung'|'ten_file'|'duong_dan_file'|'trang_thai'>;
const blank:Draft={tieu_de:'',noi_dung:'',ten_file:'',duong_dan_file:'',trang_thai:'nhap'};
export default function OfficeNoticeInline({onChanged}:{onChanged:()=>void}) {
 const [items,setItems]=useState<Notice[]>([]),[draft,setDraft]=useState<Draft>({...blank});
 const [edit,setEdit]=useState<number|null>(null),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[page,setPage]=useState(1);
 const reload=useCallback(async()=>{try{const r=await fetch('/api/office-notices',{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.message||'Không thể tải thông báo');setItems(j.data||[]);}catch(e){setError(e instanceof Error?e.message:'Lỗi tải dữ liệu');}},[]);
 useEffect(()=>{void reload();},[reload]);
 async function send(url:string,method:string,body:Draft){const r=await fetch(url,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(j.message||'Lưu thất bại');}
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await send(`/api/office-notices${edit?'/'+edit:''}`,edit?'PUT':'POST',draft);setOpen(false);setEdit(null);setDraft({...blank});await reload();onChanged();}catch(e){setError(e instanceof Error?e.message:'Lỗi lưu');}finally{setBusy(false);}}
 async function toggle(n:Notice){setBusy(true);setError('');try{await send('/api/office-notices/'+n.ma_thong_bao,'PUT',{tieu_de:n.tieu_de,noi_dung:n.noi_dung,ten_file:n.ten_file,duong_dan_file:n.duong_dan_file,trang_thai:n.trang_thai==='da_dang'?'nhap':'da_dang'});await reload();onChanged();}catch(e){setError(e instanceof Error?e.message:'Lỗi cập nhật');}finally{setBusy(false);}}
 const pages=Math.max(1,Math.ceil(items.length/10)),current=Math.min(page,pages);
 return <div className={styles.panel}>
 <div className={styles.heading}><h2>Quản lý thông báo – Phòng đào tạo</h2><button type="button" onClick={()=>{setEdit(null);setDraft({...blank});setOpen(true);}}>+ Đăng thông báo</button></div>
 {error&&<p role="alert" className={styles.error}>{error}</p>}
 {open&&<form className={styles.form} onSubmit={save}><label>Tiêu đề<input required maxLength={255} value={draft.tieu_de} onChange={e=>setDraft({...draft,tieu_de:e.target.value})}/></label><label>Nội dung<textarea required rows={6} value={draft.noi_dung} onChange={e=>setDraft({...draft,noi_dung:e.target.value})}/></label><label>Tên tệp<input value={draft.ten_file} onChange={e=>setDraft({...draft,ten_file:e.target.value})}/></label><label>Đường dẫn tệp<input value={draft.duong_dan_file} onChange={e=>setDraft({...draft,duong_dan_file:e.target.value})}/></label><label>Trạng thái<select value={draft.trang_thai} onChange={e=>setDraft({...draft,trang_thai:e.target.value as Draft['trang_thai']})}><option value="nhap">Lưu nháp / Gỡ xuống</option><option value="da_dang">Đăng công khai</option></select></label><div className={styles.actions}><button disabled={busy} type="submit">Lưu</button><button type="button" onClick={()=>setOpen(false)}>Hủy</button></div></form>}
 {items.slice((current-1)*10,current*10).map(n=><div className={styles.item} key={n.ma_thong_bao}><div><strong>{n.tieu_de}</strong><small>{n.trang_thai==='da_dang'?'Đang đăng':'Bản nháp / Đã gỡ'}</small></div><div className={styles.actions}><button type="button" onClick={()=>{setEdit(n.ma_thong_bao);setDraft({tieu_de:n.tieu_de,noi_dung:n.noi_dung,ten_file:n.ten_file,duong_dan_file:n.duong_dan_file,trang_thai:n.trang_thai});setOpen(true);}}>Sửa</button><button disabled={busy} type="button" onClick={()=>void toggle(n)}>{n.trang_thai==='da_dang'?'Gỡ xuống':'Đăng lên'}</button></div></div>)}
 <div className={styles.actions}><button disabled={current<=1} onClick={()=>setPage(current-1)}>Trước</button><span>Trang {current}/{pages}</span><button disabled={current>=pages} onClick={()=>setPage(current+1)}>Sau</button></div>
 </div>;
}
