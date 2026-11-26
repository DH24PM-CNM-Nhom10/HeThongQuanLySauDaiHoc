"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import styles from "../../components/students/StudentManagementTable.module.css";
export default function CoursesPage() {
  const [data, setData] = useState<any>(null),
    [editing, setEditing] = useState<any>(null),
    [open, setOpen] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState("");
  async function load() {
    try {
      const r = await fetch("/api/courses", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Không tải được môn học.");
      setData(d);
    } catch (e) {
      setMessage(String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    const c = {
      code: String(f.get("code") || ""),
      name: String(f.get("name") || ""),
      majorCode: String(f.get("majorCode") || ""),
      track: String(f.get("track") || ""),
      semesters: f.getAll("semesters").map(Number),
      credits: Number(f.get("credits")),
      gpaWeight: Number(f.get("gpaWeight")),
      processWeight: Number(f.get("process")) / 100,
      examWeight: Number(f.get("exam")) / 100,
      policyId: String(f.get("policyId") || ""),
    };
    try {
      const r = await fetch("/api/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: c, revision: editing?.revision }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      setOpen(false);
      await load();
      setMessage("Đã lưu môn học cùng trọng số tính điểm và GPA.");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.management}>
      <header className={styles.toolbar}>
        <h1>Quản lý môn học</h1>
        <div className={styles.actions}>
          <Link href="/academic">Thang điểm và kế hoạch học tập</Link>
          <button
            className={styles.addButton}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Thêm môn học
          </button>
        </div>
      </header>
      <p>
        Điểm tổng kết = điểm quá trình × tỷ trọng quá trình + điểm thi × tỷ
        trọng thi. GPA chung = tổng (GPA môn × trọng số GPA môn) / tổng trọng số
        GPA các môn có điểm.
      </p>
      {message && <p role="status">{message}</p>}
      {data && open && (
        <form
          key={editing?.code || "new"}
          onSubmit={save}
          className={styles.editSection}
        >
          <h2>{editing ? "Sửa môn học" : "Thêm môn học"}</h2>
          <div className={styles.editFields}>
            <label>
              Mã môn
              <input
                name="code"
                required
                readOnly={!!editing}
                defaultValue={editing?.code || ""}
              />
            </label>
            <label>
              Tên môn
              <input name="name" required defaultValue={editing?.name || ""} />
            </label>
            <label>
              Ngành
              <select
                name="majorCode"
                required
                defaultValue={editing?.majorCode || ""}
              >
                <option value="">Chọn ngành</option>
                {data.majors.map((m: any) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Định hướng
              <select
                name="track"
                defaultValue={editing?.track || "nghien_cuu"}
              >
                <option value="nghien_cuu">Nghiên cứu</option>
                <option value="ung_dung">Ứng dụng</option>
              </select>
            </label>
            <label>
              Số tín chỉ
              <input
                type="number"
                name="credits"
                required
                min="0.5"
                max="100"
                step="0.5"
                defaultValue={editing?.credits || ""}
              />
            </label>
            <label>
              Trọng số GPA môn
              <input
                type="number"
                name="gpaWeight"
                required
                min="0.01"
                max="100"
                step="0.01"
                defaultValue={editing?.gpaWeight || ""}
              />
            </label>
            <label>
              Tỷ trọng quá trình (%)
              <input
                type="number"
                name="process"
                required
                min="0"
                max="100"
                step="0.01"
                defaultValue={editing ? editing.processWeight * 100 : ""}
              />
            </label>
            <label>
              Tỷ trọng thi (%)
              <input
                type="number"
                name="exam"
                required
                min="0"
                max="100"
                step="0.01"
                defaultValue={editing ? editing.examWeight * 100 : ""}
              />
            </label>
            <label>
              Thang điểm / GPA
              <select
                name="policyId"
                required
                defaultValue={editing?.policyId || ""}
              >
                <option value="">Chọn thang điểm</option>
                {data.policies.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Học kỳ trong chương trình</legend>
              {[1, 2, 3, 4].map((n) => (
                <label key={n}>
                  <input
                    type="checkbox"
                    name="semesters"
                    value={n}
                    defaultChecked={editing?.semesters?.includes(n)}
                  />
                  Học kỳ {n}
                </label>
              ))}
            </fieldset>
          </div>
          <div className={styles.actions}>
            <button disabled={busy} className={styles.addButton}>
              Lưu môn học
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Hủy
            </button>
          </div>
        </form>
      )}
      <input
        aria-label="Tìm môn học"
        placeholder="Tìm mã, tên môn học"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div
        className={styles.sheet}
        role="region"
        tabIndex={0}
        aria-label="Danh mục môn học"
      >
        <table className={`excel-grid ${styles.table}`} data-grid="excel">
          <thead>
            <tr>
              <th>Mã môn</th>
              <th>Tên môn</th>
              <th>Ngành</th>
              <th>Tín chỉ</th>
              <th>Trọng số GPA</th>
              <th>Quá trình (%)</th>
              <th>Thi (%)</th>
              <th>Thang điểm</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {data?.courses
              .filter((c: any) =>
                `${c.code} ${c.name}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((c: any) => (
                <tr key={c.code}>
                  <td>{c.code}</td>
                  <td>{c.name}</td>
                  <td>{c.majorName}</td>
                  <td>{c.credits}</td>
                  <td>{c.gpaWeight}</td>
                  <td>{c.processWeight * 100}</td>
                  <td>{c.examWeight * 100}</td>
                  <td>
                    {data.policies.find((p: any) => p.id === c.policyId)?.name}
                  </td>
                  <td>
                    <button
                      className={styles.editButton}
                      onClick={() => {
                        setEditing(c);
                        setOpen(true);
                      }}
                    >
                      Sửa
                    </button>
                  </td>
                </tr>
              ))}
            {data && !data.courses.length && (
              <tr>
                <td colSpan={9}>Chưa có môn học được cấu hình trọng số.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
