"use client";
import { useEffect, useState } from "react";
import styles from "./TeacherGradebook.module.css";

type Review = {
  assignment: { id: string; courseCode: string; courseName: string; classCode: string };
  history: { action: string; actor: string; reason?: string; at: string }[]; revision: number; status: "draft" | "pending" | "published";
  students: { maHocVien: string; hoTen: string; processScore: number | null; examScore: number | null; totalScore: number | null }[];
};
export default function GradeReview({ office = false }: { office?: boolean }) {
  const endpoint = office ? "/api/training-office/gradebooks" : "/api/grade-review";
  const [books, setBooks] = useState<Review[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(endpoint, { cache: "no-store", signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Không tải được bảng điểm.");
      setBooks(result.data);
    }).catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [endpoint]);

  async function change(book: Review, action: string) {
    const reason = action === "reopen" ? window.prompt("Nhập lý do trả lại hoặc mở khóa bảng điểm") : "";
    if (action === "reopen" && !reason?.trim()) return;
    if (action === "publish" && !window.confirm("Duyệt, công bố và khóa bảng điểm này?")) return;
    setBusy(true);
    try {
      const response = await fetch(endpoint + "/" + book.assignment.id, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, revision: book.revision, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Không thể cập nhật.");
      setBooks(current => current.map(row => row.assignment.id === book.assignment.id
        ? { ...row, revision: result.revision, status: result.status } : row));
      const refreshed = await fetch(endpoint, { cache: "no-store" });
      if (refreshed.ok) setBooks((await refreshed.json()).data);
      setMessage("Đã cập nhật bảng điểm.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể cập nhật."); }
    finally { setBusy(false); }
  }

  return <section className={styles.page}>
    <h1>Duyệt và công bố điểm</h1>
    {message && <p role="status">{message}</p>}
    {books.map(book => <section key={book.assignment.id} className={styles.mainPanel}>
      <div className={styles.classInfo}>
        <div><h2>{book.assignment.courseName}</h2><p>{book.assignment.classCode} · {book.assignment.courseCode} · {book.status === "pending" ? "Chờ duyệt" : book.status === "published" ? "Đã công bố và khóa" : "Bản nháp"}</p></div>
        <button type="button" onClick={() => setSelected(selected === book.assignment.id ? "" : book.assignment.id)}>Xem điểm</button>
      </div>
      {selected === book.assignment.id && <div className={styles.tableScroll}><table className={styles.table}>
        <thead><tr><th>Mã học viên</th><th>Họ tên</th><th>Quá trình</th><th>Thi</th><th>Tổng kết</th></tr></thead>
        <tbody>{book.students.map(student => <tr key={student.maHocVien}>
          <td>{student.maHocVien}</td><td>{student.hoTen}</td><td>{student.processScore ?? "—"}</td><td>{student.examScore ?? "—"}</td><td>{student.totalScore ?? "—"}</td>
        </tr>)}</tbody>
      </table></div>}
      <details><summary>Lịch sử xử lý</summary>
        {book.history?.map((item, index) => <p key={index}>{new Date(item.at).toLocaleString("vi-VN")} · {item.actor} · {({ save: "Lưu nháp", submit: "Gửi duyệt", publish: "Công bố", reopen: "Mở lại" } as Record<string, string>)[item.action] || item.action}{item.reason ? " · " + item.reason : ""}</p>)}
      </details>
      <div className={styles.footer}>
        {book.status === "pending" && <button type="button" disabled={busy} onClick={() => void change(book, "publish")}>Duyệt và công bố</button>}
        {book.status !== "draft" && <button type="button" disabled={busy} onClick={() => void change(book, "reopen")}>{book.status === "pending" ? "Trả lại" : "Mở khóa điều chỉnh"}</button>}
      </div>
    </section>)}
  </section>;
}
