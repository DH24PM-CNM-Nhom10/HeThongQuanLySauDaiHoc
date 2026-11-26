"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import styles from "../students/StudentManagementTable.module.css";
import AcademicProgress from "./AcademicProgress";
type Course = {
  code: string;
  name: string;
  credits: number;
  required: boolean;
};
export default function AcademicManagement() {
  const [data, setData] = useState<any>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [cls, setCls] = useState(""),
    [student, setStudent] = useState("");
  const [courses, setCourses] = useState<Course[]>([
      { code: "", name: "", credits: 0, required: true },
    ]),
    [thresholds, setThresholds] = useState([{ min: 0, letter: "", gpa: 0 }]);
  async function load() {
    try {
      const r = await fetch("/api/academic", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Không tải được cấu hình.");
      setData(d);
    } catch (e) {
      setMessage(String(e));
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(e: FormEvent<HTMLFormElement>, kind: string) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const f = new FormData(e.currentTarget);
    const values = Object.fromEntries(f);
    const payload =
      kind === "policy"
        ? {
            name: values.name,
            description: values.name,

            passScore: Number(values.pass),
            thresholds: [...thresholds].sort((a, b) => b.min - a.min),
          }
        : {
            classCode: cls,
            policyId: values.policyId,
            requiredCredits: Number(values.credits),
            courses,
          };
    try {
      const r = await fetch("/api/academic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          data: payload,
          revision: data.plans.find((p: any) => p.classCode === cls)?.revision,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      await load();
      setMessage("Đã lưu cấu hình thang điểm/kế hoạch học tập.");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.management}>
      <h1>Thang điểm và kế hoạch học tập</h1>
      <Link href="/courses">Quản lý môn học và trọng số</Link>
      <p>
        Cấu hình thang điểm chữ và GPA; trọng số được đặt tại từng môn học. Mỗi
        quy chế là một phiên bản riêng; không tự thay đổi điểm đã lưu.
      </p>
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          <details className={styles.editSection}>
            <summary>1. Thêm thang điểm chữ và GPA</summary>
            <form onSubmit={(e) => void save(e, "policy")}>
              <div className={styles.editFields}>
                <label>
                  Tên quy chế
                  <input name="name" required />
                </label>

                <label>
                  Điểm đạt (thang 10)
                  <input
                    type="number"
                    min="0.01"
                    max="10"
                    step="0.01"
                    name="pass"
                    required
                  />
                </label>
              </div>
              <h3>Thang quy đổi GPA</h3>
              <div className={styles.sheet}>
                <table className="excel-grid" data-grid="excel">
                  <thead>
                    <tr>
                      <th>Từ điểm</th>
                      <th>Điểm chữ</th>
                      <th>GPA (0–4)</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {thresholds.map((t, i) => (
                      <tr key={i}>
                        <td>
                          <input
                            aria-label={`Từ điểm dòng ${i + 1}`}
                            type="number"
                            min="0"
                            max="10"
                            step="0.01"
                            required
                            value={t.min}
                            onChange={(e) =>
                              setThresholds(
                                thresholds.map((x, j) =>
                                  i === j
                                    ? { ...x, min: Number(e.target.value) }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Điểm chữ dòng ${i + 1}`}
                            required
                            value={t.letter}
                            onChange={(e) =>
                              setThresholds(
                                thresholds.map((x, j) =>
                                  i === j
                                    ? { ...x, letter: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`GPA dòng ${i + 1}`}
                            type="number"
                            min="0"
                            max="4"
                            step="0.01"
                            required
                            value={t.gpa}
                            onChange={(e) =>
                              setThresholds(
                                thresholds.map((x, j) =>
                                  i === j
                                    ? { ...x, gpa: Number(e.target.value) }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() =>
                              setThresholds(
                                thresholds.filter((_, j) => j !== i),
                              )
                            }
                          >
                            Bỏ dòng
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() =>
                  setThresholds([...thresholds, { min: 0, letter: "", gpa: 0 }])
                }
              >
                Thêm mức điểm
              </button>
              <button disabled={busy}>Lưu phiên bản quy chế</button>
            </form>
          </details>
          <details className={styles.editSection}>
            <summary>2. Kế hoạch tín chỉ theo lớp</summary>
            <form onSubmit={(e) => void save(e, "plan")}>
              <div className={styles.editFields}>
                <label>
                  Lớp
                  <select
                    required
                    value={cls}
                    onChange={(e) => {
                      setCls(e.target.value);
                      setCourses(
                        data.plans.find(
                          (p: any) => p.classCode === e.target.value,
                        )?.courses || [
                          { code: "", name: "", credits: 0, required: true },
                        ],
                      );
                    }}
                  >
                    <option value="">Chọn lớp</option>
                    {data.classes.map((c: string) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Quy chế áp dụng
                  <select
                    name="policyId"
                    required
                    key={cls}
                    defaultValue={
                      data.plans.find((p: any) => p.classCode === cls)
                        ?.policyId || ""
                    }
                  >
                    <option value="">Chọn phiên bản</option>
                    {data.policies.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tín chỉ yêu cầu
                  <input
                    key={"credits-" + cls}
                    name="credits"
                    type="number"
                    min="0.5"
                    step="0.5"
                    required
                    defaultValue={
                      data.plans.find((p: any) => p.classCode === cls)
                        ?.requiredCredits || ""
                    }
                  />
                </label>
              </div>
              <div className={styles.sheet}>
                <table className="excel-grid" data-grid="excel">
                  <thead>
                    <tr>
                      <th>Mã học phần</th>
                      <th>Tên học phần</th>
                      <th>Tín chỉ</th>
                      <th>Bắt buộc</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((c, i) => (
                      <tr key={i}>
                        <td>
                          <select
                            aria-label={`Mã học phần dòng ${i + 1}`}
                            required
                            value={c.code}
                            onChange={(e) => {
                              const course = data.courses.find(
                                (r: any) => r.code === e.target.value,
                              );
                              setCourses(
                                courses.map((x, j) =>
                                  i === j
                                    ? {
                                        code: course?.code || "",
                                        name: course?.name || "",
                                        credits: course?.credits || 0,
                                        required: x.required,
                                      }
                                    : x,
                                ),
                              );
                            }}
                          >
                            <option value="">Chọn môn học đã cấu hình</option>
                            {data.courses.map((r: any) => (
                              <option key={r.code} value={r.code}>
                                {r.code} — {r.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            readOnly
                            aria-label={`Tên học phần dòng ${i + 1}`}
                            required
                            value={c.name}
                            onChange={(e) =>
                              setCourses(
                                courses.map((x, j) =>
                                  i === j ? { ...x, name: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            readOnly
                            aria-label={`Tín chỉ dòng ${i + 1}`}
                            type="number"
                            min="0.5"
                            step="0.5"
                            required
                            value={c.credits}
                            onChange={(e) =>
                              setCourses(
                                courses.map((x, j) =>
                                  i === j
                                    ? { ...x, credits: Number(e.target.value) }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Bắt buộc dòng ${i + 1}`}
                            type="checkbox"
                            checked={c.required}
                            onChange={(e) =>
                              setCourses(
                                courses.map((x, j) =>
                                  i === j
                                    ? { ...x, required: e.target.checked }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() =>
                              setCourses(courses.filter((_, j) => j !== i))
                            }
                          >
                            Bỏ dòng
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCourses([
                    ...courses,
                    { code: "", name: "", credits: 0, required: true },
                  ])
                }
              >
                Thêm học phần
              </button>
              <button disabled={busy}>Lưu kế hoạch lớp</button>
            </form>
          </details>
          <h2>Tra cứu tiến độ học viên</h2>
          <select
            aria-label="Học viên xem tiến độ"
            value={student}
            onChange={(e) => setStudent(e.target.value)}
          >
            <option value="">Chọn học viên</option>
            {data.students.map((s: any) => (
              <option key={s.code} value={s.code}>
                {s.code} — {s.name} — {s.classCode}
              </option>
            ))}
          </select>
          {student && <AcademicProgress key={student} code={student} />}
        </>
      )}
    </section>
  );
}
