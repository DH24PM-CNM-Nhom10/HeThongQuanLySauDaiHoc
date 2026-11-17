"use client";

import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { Award, Check, ChevronRight, Clock3, Eye, FileCheck2, FileText, Globe2, GraduationCap, Info, Laptop, Paperclip, Pencil, Plus, Save, Send, ShieldCheck, UploadCloud, X } from "lucide-react";
import type { StoredRecord } from "../../lib/db";
import { CATEGORIES, categoryName, STATUS_LABELS, duplicateCertificate, attachmentsForKind, fileError, fileSize, formatDate, inputDate, type Attachment, type CertificateForm, type CertificateKind, type CertificateRecord } from "./model";
import CertificateHistory from "./CertificateHistory";
import DiscardChangesDialog from "./DiscardChangesDialog";
import styles from "./StudentCertificates.module.css";

type Props = { student: StoredRecord | null; studentCode: string; studentName: string };
type Preview = { record: CertificateRecord; mode: "review" | "view" | "sample" };
const ICONS = { language: Globe2, informatics: Laptop, other: GraduationCap };

function value(student: StoredRecord | null, ...keys: string[]) {
  for (const key of keys) {
    const found = student?.[key];
    if (found !== undefined && found !== null && String(found).trim()) return String(found).trim();
  }
  return "";
}

function initialForm({ student, studentCode, studentName }: Props): CertificateForm {
  return {
    title: "", level: "", issuer: "", issuedAt: "", serial: "", note: "",
    fullName: value(student, "hoTen", "ho_ten") || studentName,
    birthDate: inputDate(value(student, "ngaySinh", "ngay_sinh")),
    birthPlace: value(student, "noiSinh", "noi_sinh"),
    phone: value(student, "soDienThoai", "so_dien_thoai", "dienThoai"),
    studentCode, className: value(student, "lop", "maLop"),
    major: value(student, "tenNganh", "ten_nganh", "nganh"),
    faculty: value(student, "khoa", "tenKhoa", "ten_khoa"),
    course: value(student, "khoaHoc", "khoa_hoc"),
    identityNumber: value(student, "cccd", "soCCCD"),
    identityIssuedAt: inputDate(value(student, "ngayCapCCCD", "ngay_cap_cccd")),
  };
}

function AttachmentLink({ attachment }: { attachment: Attachment }) {
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const next = URL.createObjectURL(attachment.file);
    if (link.current) link.current.href = next;
    return () => URL.revokeObjectURL(next);
  }, [attachment.file]);
  return <a ref={link} target="_blank" rel="noopener noreferrer" className={styles.fileLink}>
    <Paperclip size={15} aria-hidden="true" />{attachment.file.name}<span>{fileSize(attachment.file.size)}</span>
  </a>;
}

function Detail({ label, children }: { label: string; children: string }) {
  return <div className={styles.detail}><dt>{label}</dt><dd>{children || "Chưa bổ sung"}</dd></div>;
}

function PreviewDialog({ preview, onClose, onConfirm }: { preview: Preview; onClose: () => void; onConfirm: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const { record, mode } = preview;
  const f = record.form;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="certificate-dialog-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.dialogHeader}>
      <div><span className={styles.eyebrow}>{mode === "sample" ? "HỒ SƠ MINH HỌA" : "KIỂM TRA HỒ SƠ"}</span><h3 id="certificate-dialog-title">{mode === "review" ? "Xem lại trước khi gửi" : "Chi tiết hồ sơ"}</h3></div>
      <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Đóng chi tiết hồ sơ"><X size={21} /></button>
    </div>
    <div className={styles.dialogBody}>
      {mode !== "sample" && <p className={styles.previewStatus}>Trạng thái: <span className={styles.statusBadge} data-status={record.status}>{STATUS_LABELS[record.status]}</span></p>}
      <div className={styles.document}>
        {record.kind === "language" ? <><p className={styles.documentOverline}>ĐƠN ĐỀ NGHỊ</p><h4>XÉT VÀ CÔNG NHẬN ĐẠT CHUẨN ĐẦU RA<br />TRÌNH ĐỘ NGOẠI NGỮ</h4>
          <dl className={styles.detailGrid}>
            <Detail label="Tôi tên">{f.fullName}</Detail><Detail label="Ngày sinh">{formatDate(f.birthDate)}</Detail>
            <Detail label="Nơi sinh">{f.birthPlace}</Detail><Detail label="Số điện thoại">{f.phone}</Detail>
            <Detail label="Mã số học viên">{f.studentCode}</Detail><Detail label="Lớp">{f.className}</Detail>
            <Detail label="Ngành đào tạo">{f.major}</Detail><Detail label="Khoa">{f.faculty}</Detail>
            <Detail label="Ngoại ngữ">Tiếng Anh</Detail><Detail label="Trình độ">{f.level}</Detail>
            <Detail label="Khóa">{f.course}</Detail><Detail label="Ngày cấp chứng chỉ">{formatDate(f.issuedAt)}</Detail>
            <Detail label="Nơi cấp">{f.issuer}</Detail><Detail label="Số hiệu">{f.serial}</Detail>
            <Detail label="Số CCCD">{f.identityNumber}</Detail><Detail label="Ngày cấp CCCD">{formatDate(f.identityIssuedAt)}</Detail>
          </dl></> : <><h4>{f.title || "Văn bằng / Chứng chỉ"}</h4><dl className={styles.detailGrid}>
            <Detail label="Nhóm chứng chỉ">{categoryName(record.kind)}</Detail><Detail label="Học viên">{`${f.fullName} · ${f.studentCode}`}</Detail>
            <Detail label="Trình độ / Xếp loại">{f.level}</Detail><Detail label="Nơi cấp">{f.issuer}</Detail>
            <Detail label="Ngày cấp">{formatDate(f.issuedAt)}</Detail><Detail label="Số hiệu">{f.serial}</Detail>
          </dl></>}
        <p className={styles.documentNote}><strong>Tên văn bằng / chứng chỉ:</strong> {f.title || "Chưa bổ sung"}</p>
        {f.note && <p className={styles.documentNote}><strong>Ghi chú:</strong> {f.note}</p>}
      </div>
      <h4 className={styles.smallHeading}>Tệp đính kèm</h4>
      {record.attachments.length ? record.attachments.map(file => <div key={file.id}><span className={styles.attachmentPurpose}>{file.purpose === "application" ? "Đơn đã ký" : "Minh chứng chứng chỉ"}</span><AttachmentLink attachment={file} /></div>) : <p className={styles.muted}>{mode === "sample" ? "Hồ sơ minh họa không kèm tệp thật." : "Chưa có tệp đính kèm."}</p>}
      {mode === "review" && <label className={styles.confirmation}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>Tôi xác nhận thông tin và tệp đính kèm trong hồ sơ đã được kiểm tra.</span></label>}
    </div>
    <div className={styles.dialogFooter}><button type="button" className={styles.secondaryButton} onClick={onClose}>{mode === "review" ? "Quay lại chỉnh sửa" : "Đóng"}</button>
      {mode === "review" && <button type="button" className={styles.primaryButton} disabled={!confirmed} onClick={onConfirm}><Send size={16} />Xác nhận gửi</button>}
    </div>
  </dialog>;
}

export default function StudentCertificates(props: Props) {
  const [kind, setKind] = useState<CertificateKind>("language");
  const [form, setForm] = useState<CertificateForm>(() => initialForm(props));
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [records, setRecords] = useState<CertificateRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<CertificateRecord | null>(null);
  const [notice, setNotice] = useState("");
  const [baseline, setBaseline] = useState("");
  const [pendingAction, setPendingAction] = useState<{ type: "close" } | { type: "edit"; record: CertificateRecord } | null>(null);
  const signature = JSON.stringify({ kind, form, attachments: attachments.map(file => file.id) });
  const dirty = open && signature !== baseline;
  const formSection = useRef<HTMLDivElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const today = new Date().toLocaleDateString("en-CA");
  const draftCount = records.filter(record => record.status === "draft").length;

  useEffect(() => {
    if (!records.length && !dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [records.length, dirty]);

  function update(key: keyof CertificateForm, next: string) {
    setForm(previous => ({ ...previous, [key]: next }));
    setNotice(""); setError(""); setDuplicate(null);
  }

  function start(next: CertificateKind = "language") {
    const nextForm = initialForm(props);
    setKind(next); setForm(nextForm); setAttachments([]); setEditingId(null);
    setBaseline(JSON.stringify({ kind: next, form: nextForm, attachments: [] }));
    setOpen(true); setError(""); setNotice(""); setDuplicate(null);
    requestAnimationFrame(() => formSection.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function selectKind(next: CertificateKind) {
    if (next === kind) return;
    setKind(next); setError(""); setDuplicate(null);
    // Retain the signed application when switching categories; only include it in a language submission.
  }

  function addFiles(files: FileList | File[], purpose: Attachment["purpose"]) {
    const incoming = Array.from(files);
    if (!incoming.length) return;
    const existing = attachments.filter(file => file.purpose === purpose);
    const unique = incoming.filter(file => !existing.some(saved => saved.file.name === file.name && saved.file.size === file.size && saved.file.lastModified === file.lastModified));
    const maximum = purpose === "certificate" ? 3 : 1;
    if (existing.length + unique.length > maximum) { setError(`Tối đa ${maximum} tệp ${purpose === "certificate" ? "minh chứng" : "đơn đã ký"}. Hãy xóa tệp cũ trước khi thay thế.`); return; }
    for (const file of unique) { const message = fileError(file); if (message) { setError(message); return; } }
    setAttachments(previous => [...previous, ...unique.map(file => ({ id: crypto.randomUUID(), file, purpose }))]);
    setError("");
  }

  function snapshot(): CertificateRecord {
    return { id: editingId || crypto.randomUUID(), kind, form: { ...form, studentCode: props.studentCode }, attachments: attachmentsForKind(attachments, kind), status: "draft", updatedAt: new Date().toISOString() };
  }

  function persist(record: CertificateRecord) {
    setRecords(previous => [record, ...previous.filter(item => item.id !== record.id)]);
    setOpen(false); setEditingId(null); setAttachments([]); setError(""); setPreview(null); setDuplicate(null);
    setNotice(record.status === "draft" ? "Đã lưu bản nháp." : "Đã gửi hồ sơ thành công. Hồ sơ đang được xét duyệt.");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requiredText = kind === "language"
      ? [form.title, form.issuer, form.serial, form.fullName, form.birthPlace, form.className, form.major, form.faculty, form.course, form.level]
      : [form.title, form.issuer, form.serial];
    if (requiredText.some(text => !text.trim())) { setError("Vui lòng nhập đầy đủ thông tin, không chỉ nhập khoảng trắng."); return; }
    if (!attachments.some(file => file.purpose === "certificate")) {
      setError("Vui lòng đính kèm ít nhất một tệp minh chứng chứng chỉ.");
      uploadInput.current?.focus(); return;
    }
    const existing = duplicateCertificate(records, kind, form.serial, editingId);
    if (existing) {
      setDuplicate(existing);
      setError(existing.status === "recognized"
        ? "Chứng chỉ này đã được công nhận. Bạn không cần gửi lại cùng chứng chỉ."
        : "Chứng chỉ này đã có hồ sơ đang xét duyệt. Vui lòng theo dõi hồ sơ đã gửi.");
      return;
    }
    setDuplicate(null); setError(""); setPreview({ record: snapshot(), mode: "review" });
  }

  function closeForm() {
    setOpen(false); setEditingId(null); setAttachments([]); setError(""); setPendingAction(null); setDuplicate(null);
  }

  function requestClose() {
    if (dirty) setPendingAction({ type: "close" });
    else closeForm();
  }

  function saveDraft() {
    if (!form.title.trim()) {
      setError("Đặt tên văn bằng / chứng chỉ để lưu bản nháp. Các thông tin khác có thể bổ sung sau.");
      document.getElementById("cert-title")?.focus();
      return;
    }
    persist(snapshot());
  }

  function edit(record: CertificateRecord) {
    if (dirty) { setPendingAction({ type: "edit", record }); return; }
    loadRecord(record);
  }

  function loadRecord(record: CertificateRecord) {
    setBaseline(JSON.stringify({ kind: record.kind, form: record.form, attachments: record.attachments.map(file => file.id) }));
    setKind(record.kind); setForm({ ...record.form }); setAttachments([...record.attachments]);
    setEditingId(record.id); setOpen(true); setError(""); setNotice(""); setDuplicate(null);
    requestAnimationFrame(() => formSection.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function field(key: keyof CertificateForm, label: string, options: InputHTMLAttributes<HTMLInputElement> = {}) {
    const { required = false, ...rest } = options;
    return <label className={styles.field} htmlFor={`cert-${key}`}><span>{label}{required && <span className={styles.required}> *</span>}</span>
      <input id={`cert-${key}`} name={key} value={form[key]} onChange={event => update(key, event.target.value)} required={required} maxLength={200} {...rest} />
    </label>;
  }

  function showSample() {
    setPreview({ mode: "sample", record: { id: "sample", kind: "language", status: "reviewing", updatedAt: "", attachments: [], form: {
      title: "Chứng chỉ tiếng Anh VSTEP", level: "Bậc 3/6 (B1)", issuer: "Đơn vị cấp chứng chỉ (minh họa)", issuedAt: "2026-08-15", serial: "VSTEP-MAU-001",
      fullName: "Nguyễn Văn A (minh họa)", birthDate: "1995-05-20", birthPlace: "An Giang", phone: "Chưa bổ sung", studentCode: "HV-MAU", className: "Lớp cao học (minh họa)", major: "Ngành đào tạo (minh họa)", faculty: "Khoa đào tạo (minh họa)", course: "Khóa 2026", identityNumber: "Không sử dụng CCCD thật", identityIssuedAt: "", note: "Dữ liệu mẫu để xem bố cục biểu mẫu.",
    } } });
  }

  return <section className={styles.section} aria-labelledby="student-certificates-heading">
    <header className={styles.header}>
      <div className={styles.titleGroup}><span className={styles.headerIcon}><Award size={25} aria-hidden="true" /></span><div><span className={styles.eyebrow}>MINH CHỨNG HỌC TẬP</span><h2 id="student-certificates-heading">Văn bằng / Chứng chỉ</h2><p>Bổ sung minh chứng, theo dõi hồ sơ của bạn.</p></div></div>
      <button type="button" className={styles.primaryButton} onClick={() => open ? formSection.current?.scrollIntoView({ behavior: "smooth" }) : start()}><Plus size={17} />{open ? "Đang tạo hồ sơ" : "Tạo hồ sơ"}</button>
    </header>
    <div className={styles.demoNotice}><Info size={18} aria-hidden="true" /><span><strong>Bản xem thử giao diện.</strong> Mọi thao tác bên dưới đang được mô phỏng, chưa gửi đến nhà trường. Hồ sơ và tệp chưa được lưu; rời trang hoặc tải lại sẽ mất dữ liệu.</span></div>
    <div className={styles.summary}>
      <div><span className={styles.summaryIcon}><FileText size={19} /></span><span><strong>{records.length.toString().padStart(2, "0")}</strong><small>Tổng hồ sơ</small></span></div>
      <div><span className={styles.summaryIcon}><Pencil size={18} /></span><span><strong>{draftCount.toString().padStart(2, "0")}</strong><small>Bản nháp</small></span></div>
      <div><span className={styles.summaryIcon}><Clock3 size={19} /></span><span><strong>{records.filter(record => record.status === "reviewing").length.toString().padStart(2, "0")}</strong><small>Đang xét duyệt</small></span></div>
    </div>
    {notice && <p className={styles.success} role="status"><Check size={18} /><span>{notice}</span></p>}
    {!open && <div className={styles.categoryOverview}>{CATEGORIES.map(category => { const Icon = ICONS[category.key]; return <button key={category.key} type="button" onClick={() => start(category.key)}><Icon size={23} /><strong>{category.title}</strong><span>{category.description}</span><ChevronRight size={17} className={styles.categoryArrow} /></button>; })}</div>}

    {open && <div ref={formSection} className={styles.formPanel}>
      <div className={styles.formHeading}><div><span className={styles.eyebrow}>{editingId ? "CHỈNH SỬA BẢN NHÁP" : "HỒ SƠ MỚI"}</span><h3>Thông tin văn bằng / chứng chỉ</h3></div><button type="button" className={styles.closeFormButton} aria-label="Đóng biểu mẫu" onClick={requestClose}><X size={16} />Đóng</button></div>
      <fieldset className={styles.categoryPicker}><legend>Chọn loại hồ sơ</legend><div className={styles.categoryOptions}>{CATEGORIES.map(category => { const Icon = ICONS[category.key]; return <label key={category.key} className={kind === category.key ? styles.categorySelected : ""}><input type="radio" name="certificate-kind" value={category.key} checked={kind === category.key} onChange={() => selectKind(category.key)} /><Icon size={20} /><span><strong>{category.title}</strong><small>{category.description}</small></span>{kind === category.key && <Check size={16} />}</label>; })}</div></fieldset>
      <form onSubmit={submit}>
        <p className={styles.formHelp}>Các trường có dấu <span className={styles.required}>*</span> cần hoàn thành khi gửi. Bạn có thể lưu nháp để bổ sung sau.</p>
        {kind === "language" && <fieldset className={styles.formGroup}><legend><span>01</span>Đơn đề nghị công nhận chuẩn đầu ra ngoại ngữ</legend>
          <p className={styles.groupDescription}>Thông tin có sẵn được điền từ hồ sơ học viên. Vui lòng kiểm tra và bổ sung các mục còn thiếu.</p>
          <div className={styles.formGrid}>
            {field("fullName", "Tôi tên", { required: true, autoComplete: "name" })}{field("birthDate", "Ngày sinh", { required: true, type: "date", max: today })}
            {field("birthPlace", "Nơi sinh", { required: true, placeholder: "Tỉnh / thành phố" })}{field("phone", "Số điện thoại", { required: true, type: "tel", pattern: "[+0-9 ()-]{9,20}", autoComplete: "tel", placeholder: "Nhập số điện thoại liên hệ" })}
            {field("studentCode", "Mã số học viên", { required: true, readOnly: true })}{field("className", "Lớp", { required: true })}
            {field("major", "Ngành đào tạo", { required: true })}{field("faculty", "Khoa", { required: true, placeholder: "Nhập tên khoa đào tạo" })}
            <label className={styles.field}><span>Ngoại ngữ</span><input value="Tiếng Anh" readOnly /></label>{field("course", "Khóa", { required: true, placeholder: "Ví dụ: CH2026" })}
            {field("identityNumber", "Số CCCD", { required: true, inputMode: "numeric", pattern: "[0-9]{12}", maxLength: 12, placeholder: "12 chữ số" })}{field("identityIssuedAt", "Ngày cấp CCCD", { required: true, type: "date", max: today })}
          </div>
        </fieldset>}
        <fieldset className={styles.formGroup}><legend><span>{kind === "language" ? "02" : "01"}</span>Thông tin chứng chỉ</legend><div className={styles.formGrid}>
          {field("title", kind === "other" ? "Tên văn bằng / chứng chỉ khác" : "Tên văn bằng / chứng chỉ", { required: true, placeholder: kind === "language" ? "Ví dụ: Chứng chỉ tiếng Anh VSTEP" : kind === "informatics" ? "Ví dụ: Ứng dụng CNTT cơ bản" : "Nhập tên văn bằng / chứng chỉ" })}
          {field("level", kind === "language" ? "Trình độ ngoại ngữ" : "Trình độ / Xếp loại", { required: kind === "language", placeholder: kind === "language" ? "Ví dụ: Bậc 3/6 (B1), IELTS 6.0" : "Nhập nếu có" })}
          {field("issuer", "Nơi cấp", { required: true, placeholder: "Tên đơn vị cấp văn bằng / chứng chỉ" })}{field("issuedAt", "Ngày cấp", { required: true, type: "date", max: today })}
          {field("serial", "Số hiệu văn bằng / chứng chỉ", { required: true, placeholder: "Nhập đúng số hiệu trên minh chứng" })}
        </div></fieldset>
        <fieldset className={styles.formGroup}><legend><span>{kind === "language" ? "03" : "02"}</span>Tệp minh chứng</legend>
          <div className={styles.dropZone} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(event.dataTransfer.files, "certificate"); }}>
            <UploadCloud size={31} aria-hidden="true" /><strong>Kéo thả tệp minh chứng vào đây</strong><span>PDF, JPG, PNG · Tối đa 10 MB/tệp · Tối đa 3 tệp</span>
            <label className={styles.filePicker}>Chọn tệp minh chứng<input ref={uploadInput} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" aria-label="Chọn tệp minh chứng" onChange={event => { if (event.target.files) addFiles(event.target.files, "certificate"); event.target.value = ""; }} /></label>
          </div>
          {attachments.filter(file => file.purpose === "certificate").map(file => <div className={styles.fileRow} key={file.id}><AttachmentLink attachment={file} /><button type="button" className={styles.iconButton} aria-label={`Xóa tệp ${file.file.name}`} onClick={() => setAttachments(previous => previous.filter(item => item.id !== file.id))}><X size={17} /></button></div>)}
          {kind === "language" && <div className={styles.signedApplication}><div><FileCheck2 size={20} /><span><strong>Đơn đề nghị đã ký <small>(nếu có)</small></strong><small>Có thể đính kèm bản PDF hoặc ảnh của đơn đã ký.</small></span></div><label className={styles.filePicker}>Chọn đơn đã ký<input type="file" accept=".pdf,.jpg,.jpeg,.png" aria-label="Chọn đơn đề nghị đã ký" onChange={event => { if (event.target.files) addFiles(event.target.files, "application"); event.target.value = ""; }} /></label></div>}
          {kind === "language" && attachments.filter(file => file.purpose === "application").map(file => <div className={styles.fileRow} key={file.id}><AttachmentLink attachment={file} /><button type="button" className={styles.iconButton} aria-label={`Xóa tệp ${file.file.name}`} onClick={() => setAttachments(previous => previous.filter(item => item.id !== file.id))}><X size={17} /></button></div>)}
          <label className={styles.field} htmlFor="cert-note"><span>Ghi chú <small>(không bắt buộc)</small></span><textarea id="cert-note" maxLength={1000} rows={3} value={form.note} onChange={event => update("note", event.target.value)} placeholder="Thông tin bổ sung để làm rõ hồ sơ của bạn" /></label>
        </fieldset>
        {error && <div className={styles.error} role="alert">{error}{duplicate && <div><button type="button" className={styles.textButton} onClick={() => setPreview({ record: duplicate, mode: "view" })}>Xem hồ sơ đã gửi<ChevronRight size={14} /></button></div>}</div>}
        {!props.studentCode && <p className={styles.error} role="alert">Chưa xác định mã học viên. Vui lòng đăng nhập lại trước khi tạo hồ sơ.</p>}
        <footer className={styles.formFooter}><span><ShieldCheck size={16} />Nộp hồ sơ chưa đồng nghĩa được công nhận chuẩn đầu ra.</span><div><button type="button" className={styles.secondaryButton} disabled={!props.studentCode} onClick={saveDraft}><Save size={16} />Lưu nháp</button><button type="submit" className={styles.primaryButton} disabled={!props.studentCode}><Eye size={16} />Xem lại & gửi</button></div></footer>
      </form>
    </div>}

    <CertificateHistory records={records} formOpen={open}
      onCreate={() => start()} onSample={showSample}
      onView={record => setPreview({ record, mode: "view" })} onEdit={edit}
      onDelete={id => {
        setRecords(previous => previous.filter(record => record.id !== id));
        if (editingId === id) { setOpen(false); setEditingId(null); }
        setNotice("Đã xóa bản nháp.");
      }} />
    <p className={styles.bottomNote}><ShieldCheck size={15} />Phòng Đào tạo cập nhật trạng thái sau khi có kết quả xử lý. Thông báo chung được công bố tại mục Thông báo.</p>
    {pendingAction && <DiscardChangesDialog onContinue={() => setPendingAction(null)} onDiscard={() => {
      const action = pendingAction;
      setPendingAction(null);
      if (action.type === "edit") loadRecord(action.record);
      else closeForm();
    }} />}
    {preview && <PreviewDialog key={preview.record.id + preview.mode} preview={preview} onClose={() => setPreview(null)} onConfirm={() => persist({ ...preview.record, status: "reviewing", updatedAt: new Date().toISOString() })} />}
  </section>;
}
