"use client";

import { useEffect, useRef } from "react";
import { FilePenLine } from "lucide-react";
import styles from "./StudentCertificates.module.css";

export default function DiscardChangesDialog({ onContinue, onDiscard }: { onContinue: () => void; onDiscard: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);
  return <dialog ref={dialog} className={`${styles.dialog} ${styles.discardDialog}`} aria-labelledby="cert-discard-title" aria-describedby="cert-discard-description" onCancel={event => { event.preventDefault(); onContinue(); }}>
    <div className={styles.discardBody}><span className={styles.discardIcon}><FilePenLine size={24} /></span><h3 id="cert-discard-title">Bạn có thay đổi chưa lưu</h3><p id="cert-discard-description">Tiếp tục chỉnh sửa để lưu nháp, hoặc bỏ các thay đổi vừa nhập. Bản nháp đã lưu trước đó vẫn được giữ nguyên.</p></div>
    <div className={styles.dialogFooter}><button type="button" className={styles.secondaryButton} onClick={onDiscard}>Bỏ thay đổi</button><button type="button" className={styles.primaryButton} autoFocus onClick={onContinue}>Tiếp tục chỉnh sửa</button></div>
  </dialog>;
}
