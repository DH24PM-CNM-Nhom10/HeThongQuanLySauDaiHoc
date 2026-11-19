"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { CatalogEntry } from "../../shared/system-store.cjs";
import styles from "./StudentManagementTable.module.css";

export default function TrainingCatalogs() {
  const [rows, setRows] = useState<CatalogEntry[]>([]);
  const [kind, setKind] = useState("major");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function load() {
    const response = await fetch("/api/catalogs", { cache: "no-store" });
    if (!response.ok) throw new Error("Không tải được danh mục");
    setRows((await response.json()).data);
  }
  useEffect(() => { void load().catch(error => setMessage(error.message)); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    try {
      const response = await fetch("/api/catalogs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await load();
      form.reset();
      setMessage("Đã thêm danh mục.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không lưu được danh mục."); }
    finally { setSaving(false); }
  }
  return <section className={styles.management}>
    <h1>Danh mục đào tạo</h1>
    <form onSubmit={submit} className={styles.editFields}>
      <label>Loại danh mục<select name="kind" value={kind} onChange={event => setKind(event.target.value)}>
        <option value="major">Ngành</option><option value="class">Lớp</option>
        <option value="program">Loại chương trình</option><option value="level">Trình độ</option>
      </select></label>
      <label>{["major", "class"].includes(kind) ? "Mã" : "Tên"}<input name="code" required /></label>
      {kind === "major" && <label>Tên ngành<input name="name" required /></label>}
      {kind === "class" && <label>Ngành<select name="majorCode" required>
        <option value="">Chọn ngành</option>{rows.filter(row => row.kind === "major").map(row => <option key={row.id} value={row.code}>{row.code} · {row.name}</option>)}
      </select></label>}
      <button className={styles.addButton} disabled={saving}>Thêm danh mục</button>
    </form>
    {message && <p role="status">{message}</p>}
    <table className={styles.table}><thead><tr><th>Mã / Tên</th><th>Tên ngành / Mã ngành</th></tr></thead>
      <tbody>{rows.filter(row => row.kind === kind).map(row => <tr key={row.id}><td>{row.code}</td><td>{row.majorCode || row.name || "—"}</td></tr>)}</tbody>
    </table>
  </section>;
}
