"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { studentStatus } from "../../../shared/student-status.cjs";
import { logoutSessions, verifySession, type SessionUser } from "../../lib/session-client";

import styles from "./Dashboard.module.css";

type Student = Record<string, unknown>;
type Counts = Record<string, number>;

const statusColumns = [
  { key: "studying", label: "Đang học" },
  { key: "graduated", label: "Đã tốt nghiệp" },
  { key: "overdue", label: "Quá hạn" },
  { key: "withdrawn", label: "Xóa tên" },
  { key: "reserved", label: "Bảo lưu" },
  { key: "paused", label: "Tạm dừng" },
  { key: "left", label: "Thôi học" },
  { key: "completed", label: "Hoàn thành" },
  { key: "other", label: "Chưa xác định / Khác" },
] as const;

const numberFormat = new Intl.NumberFormat("vi-VN");
const percentFormat = new Intl.NumberFormat("vi-VN", {
  style: "percent",
  maximumFractionDigits: 1,
});

function emptyCounts(): Counts {
  return Object.fromEntries([["total", 0], ...statusColumns.map(({ key }) => [key, 0])]);
}

function summarize(students: Student[]) {
  const totals = emptyCounts();
  for (const student of students) {
    totals.total++;
    totals[studentStatus(student)]++;
  }

  return totals;
}

function AdminDashboard() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboardData() {
      try {
        const records: Student[] = [];
        let page = 1;
        let totalPages = 1;

        do {
          const response = await fetch(
            `/api/students?limit=2000&page=${page}`,
            { signal: controller.signal, cache: "no-store" },
          );
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const result = await response.json();
          const data = Array.isArray(result) ? result : result?.data ?? result?.records;
          if (!Array.isArray(data)) throw new Error("Dữ liệu học viên không hợp lệ");

          records.push(...data);
          totalPages = result?.pagination?.totalPages ?? 1;
          page++;
        } while (page <= totalPages);

        if (!controller.signal.aborted) setStudents(records);
      } catch (cause) {
        if (controller.signal.aborted) return;
        console.error("Lỗi tải dữ liệu báo cáo:", cause);
        setError(true);
      }
    }

    void loadDashboardData();
    return () => controller.abort();
  }, []);

  const totals = useMemo(() => summarize(students ?? []), [students]);
  const visibleStatuses = statusColumns.filter(({ key }) => totals[key] > 0);
  let segmentEnd = 0;
  const segments = visibleStatuses.map(({ key }) => {
    const start = segmentEnd;
    const share = totals.total ? totals[key] / totals.total : 0;
    segmentEnd += share * 100;
    return { key, share, start, end: segmentEnd };
  });
  const chartStops = segments
    .filter(({ share }) => share > 0)
    .map(({ key, start, end }) => `var(--chart-${key}) ${start}% ${end}%`);

  return (
    <div className={styles.dashboard}>
      <div>
        <h1>Báo cáo tổng hợp</h1>
      </div>
      {error ? (
        <p className={styles.notice} role="alert">Không tải được dữ liệu học viên.</p>
      ) : students === null ? (
        <p className={styles.notice} role="status">Đang tải dữ liệu báo cáo…</p>
      ) : totals.total === 0 ? (
        <p className={styles.notice}>Chưa có dữ liệu học viên để lập báo cáo.</p>
      ) : (
        <>
          <dl className={styles.metrics} aria-label="Tổng hợp học viên">
            <div><dt>Tổng học viên</dt><dd>{numberFormat.format(totals.total)}</dd></div>
            {visibleStatuses.map(({ key, label }) => (
              <div key={key} data-status={key}>
                <dt>{label}</dt>
                <dd>{numberFormat.format(totals[key])}</dd>
              </div>
            ))}
          </dl>

          <section className={styles.panel} aria-labelledby="status-analysis">
            <h2 id="status-analysis">Tỷ lệ trạng thái học viên</h2>
            <div className={styles.chartLayout}>
              <div
                className={styles.donut}
                style={{ background: `conic-gradient(${chartStops.join(", ")})` }}
                aria-hidden="true"
              >
                <div>
                  <strong>{numberFormat.format(totals.total)}</strong>
                  <span>Học viên</span>
                </div>
              </div>
              <ul className={styles.breakdown} aria-label="Tỷ lệ học viên theo trạng thái">
                {visibleStatuses.map(({ key, label }) => (
                  <li key={key} data-status={key}>
                    <span>{label}</span>
                    <strong>{percentFormat.format(totals[key] / totals.total)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          </section>

        </>
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const syncSession = () => {
      setChecking(true);
      void verifySession()
        .then((session) => {
          if (active) setUser(session);
        })
        .catch(() => {
          if (active) setError("Không kiểm tra được phiên đăng nhập. Vui lòng thử lại.");
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    };
    syncSession();
    window.addEventListener("agu-auth-changed", syncSession);
    return () => {
      active = false;
      window.removeEventListener("agu-auth-changed", syncSession);
    };
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const usernameInput = username.trim();
      const isTrainingOffice = usernameInput.toLowerCase() === "phongdaotao@agu.edu.vn";
      const expectedRole: SessionUser["role"] = isTrainingOffice ? "training_office" : "admin";
      const response = await fetch(isTrainingOffice ? "/api/training-office/login" : "/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password }),
      });
      const result: { user?: SessionUser; message?: string } = await response.json();
      if (!response.ok || result.user?.role !== expectedRole) {
        throw new Error(result.message || "Tên đăng nhập hoặc mật khẩu không đúng.");
      }

      await logoutSessions(expectedRole);
      localStorage.setItem("currentUser", JSON.stringify(result.user));
      localStorage.removeItem("aguAuthSource");
      window.dispatchEvent(new Event("agu-auth-changed"));
      setUser(result.user);
      setPassword("");
      if (expectedRole === "training_office") router.replace("/assignment");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đăng nhập.");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return <p className={styles.loginNotice} role="status">Đang kiểm tra phiên đăng nhập...</p>;
  }
  if (user?.role === "admin") return <AdminDashboard />;
  if (user) {
    return (
      <section className={styles.loginPanel}>
        <h1>Không có quyền truy cập</h1>
        <p>Tài khoản này không có quyền quản trị.</p>
        <Link href="/">Về cổng thông tin</Link>
      </section>
    );
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginPanel}>
        <p className={styles.loginEyebrow}>ADMIN / PHÒNG ĐÀO TẠO</p>
        <h1>Đăng nhập hệ thống quản lý</h1>
        <p>Admin vào bảng điều khiển; Phòng đào tạo vào giao diện phân công giảng dạy.</p>
        <form className={styles.loginForm} onSubmit={(event) => void handleLogin(event)}>
          <label>
            Tên đăng nhập
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label>
            Mật khẩu
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Đang kiểm tra..." : "Đăng nhập"}
          </button>
        </form>
        {error && <p className={styles.loginError} role="alert">{error}</p>}
        <Link className={styles.loginBack} href="/">Về cổng thông tin học viên, giảng viên</Link>
      </section>
    </main>
  );
}
