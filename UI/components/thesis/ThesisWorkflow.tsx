"use client";
import { useEffect, useState, type FormEvent } from "react";
import styles from "../students/StudentManagementTable.module.css";
const KINDS: Record<string, string> = {
  topic: "Đăng ký đề tài",
  extension: "Gia hạn",
  defense: "Đề nghị bảo vệ",
};
const STATES: Record<string, string> = {
  pending: "Chờ xử lý",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};
export default function ThesisWorkflow({
  code,
  manager = false,
}: {
  code?: string;
  manager?: boolean;
}) {
  const [data, setData] = useState<any>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [kind, setKind] = useState("topic");
  const endpoint = manager
    ? "/api/students/thesis/workflow"
    : "/api/student-records/thesis-workflow";
  async function load() {
    try {
      const r = await fetch(
        endpoint +
          (manager ? "?student=" + encodeURIComponent(code || "") : ""),
        { cache: "no-store" },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Không tải được quy trình.");
      setData(d);
    } catch (e) {
      setMessage(String(e));
    }
  }
  useEffect(() => {
    void load();
  }, [code, manager]);
  async function send(values: any) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...values,
          code,
          revision: data.workflow.revision,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      await load();
      setMessage("Đã lưu yêu cầu và lịch sử xử lý.");
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>, action: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void send({ ...Object.fromEntries(f), action });
  }
  async function review(request: any, action: string) {
    const reason = window.prompt("Ý kiến xét duyệt (bắt buộc)");
    if (!reason?.trim()) return;
    let decisionDate = "";
    let eligibilityConfirmed = false;
    if (action === "approve" && request.kind === "topic") {
      decisionDate =
        window.prompt("Ngày quyết định giao đề tài (YYYY-MM-DD)") || "";
      if (!decisionDate) return;
    }
    if (action === "approve" && request.kind === "defense") {
      eligibilityConfirmed = window.confirm(
        "Đã trực tiếp kiểm tra đủ điều kiện bảo vệ theo quy chế, kết quả học tập và hồ sơ minh chứng? Ý kiến xác nhận được lưu lịch sử.",
      );
      if (!eligibilityConfirmed) return;
    }
    await send({
      action,
      requestId: request.id,
      reason,
      decisionDate,
      eligibilityConfirmed,
    });
  }
  return (
    <section className={styles.management}>
      <h2>Đăng ký, gia hạn và xét duyệt luận văn</h2>
      {message && <p role="status">{message}</p>}
      {data && (
        <>
          {manager && (
            <>
              <p>
                Điều kiện học thuật:{" "}
                {!data.academic.configured
                  ? "Chưa cấu hình"
                  : data.academic.academicEligible
                    ? "Đạt theo kế hoạch"
                    : "Chưa đạt theo kế hoạch"}{" "}
                · Hồ sơ được công nhận:{" "}
                {
                  data.documents.filter((d: any) => d.status === "approved")
                    .length
                }
                /{data.documents.length}. Cán bộ phải đối chiếu quy chế trước
                khi duyệt bảo vệ.
              </p>
              <form
                onSubmit={(e) => submit(e, "council")}
                className={styles.editFields}
              >
                <label>
                  Chủ tịch
                  <select
                    required
                    name="chair"
                    defaultValue={data.workflow.council?.chair || ""}
                  >
                    <option value="">Chọn giảng viên</option>
                    {data.teachers.map((t: any) => (
                      <option value={t.id} key={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Phản biện
                  <select
                    required
                    name="reviewer"
                    defaultValue={data.workflow.council?.reviewer || ""}
                  >
                    <option value="">Chọn giảng viên</option>
                    {data.teachers.map((t: any) => (
                      <option value={t.id} key={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Số quyết định hội đồng
                  <input
                    required
                    name="decision"
                    defaultValue={data.workflow.council?.decision || ""}
                  />
                </label>
                <button disabled={busy}>Lưu hội đồng</button>
              </form>
            </>
          )}
          {data.workflow.council && (
            <p>
              Hội đồng: {data.workflow.council.chairName} (chủ tịch),{" "}
              {data.workflow.council.reviewerName} (phản biện) · QĐ:{" "}
              {data.workflow.council.decision}
            </p>
          )}
          <details className={styles.editSection}>
            <summary>
              {manager ? "Ghi nhận đề nghị của học viên" : "Gửi đề nghị mới"}
            </summary>
            <form
              onSubmit={(e) => submit(e, kind + "_request")}
              className={styles.editFields}
            >
              <label>
                Loại đề nghị
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  {Object.entries(KINDS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              {kind === "topic" && (
                <label>
                  Tên đề tài
                  <input required name="title" maxLength={2000} />
                </label>
              )}
              {kind === "extension" && (
                <label>
                  Đề nghị gia hạn đến
                  <input required type="date" name="deadline" />
                </label>
              )}
              <label>
                Nội dung / lý do
                <textarea required name="reason" maxLength={2000} />
              </label>
              <button disabled={busy}>Gửi đề nghị</button>
            </form>
          </details>
          <div
            className={styles.sheet}
            tabIndex={0}
            role="region"
            aria-label="Yêu cầu luận văn"
          >
            <table className="excel-grid" data-grid="excel">
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Nội dung</th>
                  <th>Ngày gửi</th>
                  <th>Trạng thái</th>
                  <th>Ý kiến xét duyệt</th>
                  {manager && <th>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {data.workflow.requests.map((r: any) => (
                  <tr key={r.id}>
                    <td>{KINDS[r.kind]}</td>
                    <td>
                      {r.title || r.deadline || r.reason}
                      <small>{r.reason}</small>
                    </td>
                    <td>{new Date(r.createdAt).toLocaleDateString("vi-VN")}</td>
                    <td>{STATES[r.status]}</td>
                    <td>{r.reviewReason || "—"}</td>
                    {manager && (
                      <td>
                        {r.status === "pending" && (
                          <div className={styles.rowActions}>
                            <button
                              disabled={busy}
                              className={styles.addButton}
                              onClick={() => void review(r, "approve")}
                            >
                              Duyệt
                            </button>
                            <button
                              disabled={busy}
                              className={styles.deleteButton}
                              onClick={() => void review(r, "reject")}
                            >
                              Từ chối
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {!data.workflow.requests.length && (
                  <tr>
                    <td colSpan={manager ? 6 : 5}>Chưa có yêu cầu.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
