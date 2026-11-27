"use client";

import { useEffect, useRef, useState } from "react";
import catalog from "../../data/agu_training_programmes.json";
import documentIndex from "../../data/agu_programme_documents.json";
import styles from "./TrainingProgrammes.module.css";

export default function TrainingProgrammes() {
  const [selected, setSelected] = useState<{name: string; code: string; mode: string; url: string} | null>(null);
  const viewer = useRef<HTMLElement>(null);
  const documents: Record<string, {available: boolean; path: string; format: string}> = documentIndex;
  const documentFor = (url: string) => documents[url.split("/").pop() || ""];
  const selectedDocument = selected ? documentFor(selected.url) : null;
  useEffect(() => { if (selected) viewer.current?.scrollIntoView({behavior: "smooth", block: "start"}); }, [selected]);
  const [search, setSearch] = useState("");
  const [institution, setInstitution] = useState("agu");
  const [majorId, setMajorId] = useState("");
  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
  const rows = catalog.majors.filter(m =>
    (!majorId || String(m.id) === majorId) &&
    (institution === "all" || (m.institution === "Trường Đại học An Giang") === (institution === "agu")) &&
    normalize(`${m.name} ${m.institution} ${m.programmes.map(p => p.code + " " + p.name).join(" ")}`).includes(normalize(search)));

  return <div className={styles.programmes}>
    <header className={styles.header}>
      <div><p>ĐÀO TẠO SAU ĐẠI HỌC</p><h1>Chương trình đào tạo thạc sĩ</h1><span>Tra cứu theo ngành, trường đào tạo và phiên bản chương trình do trường công bố.</span></div>
    </header>
    <div className={styles.filters}>
      <label>Tìm kiếm<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tên ngành, mã ngành hoặc khóa đào tạo" /></label>
      <label>Trường đào tạo<select value={institution} onChange={e => setInstitution(e.target.value)}><option value="agu">Trường Đại học An Giang</option><option value="other">Các trường khác trong danh mục</option><option value="all">Tất cả trường</option></select></label>
      <label>Ngành / chương trình<select value={majorId} onChange={e => setMajorId(e.target.value)}><option value="">Tất cả ngành và chương trình</option>{catalog.majors.map(m => <option key={m.id} value={m.id}>{m.name} — {m.institution}</option>)}</select></label>
    </div>
    <p className={styles.note}>{rows.length} mục phù hợp · Đối chiếu nguồn ngày 27/11/2026. Chương trình liên thông được trình bày riêng; chọn đúng phiên bản áp dụng cho khóa học.</p>
    <div className={styles.scroll} role="region" aria-label="Danh mục chương trình đào tạo" tabIndex={0}>
      <table className="excel-grid" data-grid="excel"><thead><tr><th>STT</th><th>Ngành / chương trình</th><th>Trường đào tạo</th><th>Phiên bản chương trình</th></tr></thead>
        <tbody>{rows.map((m, i) => <tr key={m.id}><td>{i + 1}</td><td><strong>{m.name}</strong>{[19, 20].includes(m.id) && <span className={styles.tag}>Liên thông đại học – thạc sĩ</span>}</td><td>{m.institution}</td><td>{m.programmes.length ? <details><summary>{m.programmes.length} phiên bản · Xem chương trình</summary><ul>{m.programmes.map(p => <li key={p.url}><strong>{p.name}</strong><span>Mã: {p.code} · {p.mode}</span>{documentFor(p.url)?.available ? <button type="button" className={styles.viewButton} aria-controls="programme-document" onClick={() => setSelected(p)}>Xem nội dung</button> : <span>Chưa có nội dung tài liệu được công bố.</span>}</li>)}</ul></details> : <p>Chưa có phiên bản trong danh sách nguồn.</p>}</td></tr>)}{!rows.length && <tr><td colSpan={4}>Không có chương trình phù hợp bộ lọc.</td></tr>}</tbody>
      </table>
    </div>
    {selected && selectedDocument?.available && <section id="programme-document" ref={viewer} className={styles.viewer} aria-label={`Nội dung ${selected.name}`}>
      <header><div><h2>{selected.name}</h2><p>Mã: {selected.code} · {selected.mode}</p></div><button type="button" className={styles.viewButton} onClick={() => {setSelected(null);}}>Đóng nội dung</button></header>
      <iframe key={selectedDocument.path} src={selectedDocument.path} title={`Tài liệu chương trình ${selected.name}`} {...(selectedDocument.format === "html" ? {sandbox: ""} : {})} />
      {selectedDocument.format === "pdf" && <p className={styles.note}>Nếu trình duyệt chưa hiển thị PDF, <a href={selectedDocument.path} download>Tải tài liệu</a> để xem.</p>}
    </section>}
    <p className={styles.note}>Trang này phục vụ tra cứu chương trình đào tạo; quy chế GPA và cấu hình chương trình được quản lý tại hệ thống riêng.</p>
  </div>;
}
