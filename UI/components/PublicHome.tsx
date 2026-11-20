"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Globe, GraduationCap, MapPin, Menu, Phone, X } from "lucide-react";
import Image from "next/image";
import styles from "./PublicHome.module.css";
import PublicAccountMenu from "./PublicAccountMenu";
import OfficeNoticeInline from "./OfficeNoticeInline";
import StudentPortalContent, { type StudentSection } from "./StudentPortalContent";
import TeacherPortalContent from "./TeacherPortalContent";
import TeacherSchedule from "./TeacherSchedule";
import TeacherGradebook from "./TeacherGradebook";
import TrainingOfficeAssignmentReadonly from "./TrainingOfficeAssignmentReadonly";
import { verifySession, logoutSessions } from "../lib/session-client";
import { useRouter } from "next/navigation";

// Có thể thay bằng /images/logo-agu.jpg khi lưu logo vào public/images.
const AGU_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/4/42/Logoagunew2026.jpg";
const SO_THONG_BAO_TRANG_CHU = 5;

type PublicPage = "home" | "notices" | "programs" | "contact" | "about" | "teacher-profile" | "teacher-grades" | "teacher-schedule" | "office-assign" | StudentSection;

const publicLinks = [
  { href: "/", label: "Trang chủ", page: "home" },
  { href: "/thong-bao", label: "Thông báo", page: "notices" },
  { href: "/chuong-trinh-dao-tao", label: "Chương trình đào tạo", page: "programs" },
] as const;

// Giảng viên dùng thanh menu trang chủ, thay mục Chương trình đào tạo bằng 2 mục riêng.
const teacherLinks = [
  { href: "/", label: "Trang chủ", page: "home" },
  { href: "/thong-bao", label: "Thông báo", page: "notices" },
  { href: "/giang-vien/thong-tin", label: "Thông tin giảng viên", page: "teacher-profile" },
  { href: "/giang-vien/thoi-khoa-bieu", label: "Thời khóa biểu", page: "teacher-schedule" },
  { href: "/giang-vien/tra-cuu-diem", label: "Bảng điểm", page: "teacher-grades" },
  { href: "/gioi-thieu", label: "Giới thiệu", page: "about" },
  { href: "/lien-he", label: "Liên hệ", page: "contact" },
] as const;

// Menu chuyên biệt Phòng đào tạo: giữ trang chủ, thông báo, giới thiệu, liên hệ.
const trainingOfficeLinks = [
  { href: "/", label: "Trang chủ", page: "home" },
  { href: "/thong-bao", label: "Thông báo", page: "notices" },
  { href: "/phong-dao-tao/phan-cong", label: "Phân công giảng dạy", page: "office-assign" },
  { href: "/gioi-thieu", label: "Giới thiệu", page: "about" },
  { href: "/lien-he", label: "Liên hệ", page: "contact" },
] as const;

const secondaryLinks = [
  { href: "/gioi-thieu", label: "Giới thiệu", page: "about" },
  { href: "/lien-he", label: "Liên hệ", page: "contact" },
] as const;

const studentLinks = [
  { href: "/profile", label: "Hồ sơ học viên", page: "profile" },
  { href: "/schedule", label: "Thời khóa biểu", page: "schedule" },
  { href: "/grades", label: "Bảng điểm", page: "grades" },
  { href: "/tien-do-hoc-tap", label: "Tiến độ học tập", page: "progress" },
] as const;

type ThongBao = {
  ma_thong_bao: number;
  tieu_de: string;
  noi_dung?: string;
  ten_file: string;
  duong_dan_file: string;
  ngay_dang: string;
  trang_thai: number;
};
type SessionUser = { role: "admin" | "student" | "teacher" | "training_office"; maHocVien?: string; teacherId?: string; username?: string; shcc?: string; hoTen?: string; email?: string };

function dinhDangNgay(ngay: string): string {
  // Ngày kiểu YYYY-MM-DDTHH:mm:ss từ API, tránh lệch ngày do timezone khi chỉ cần ngày.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(ngay);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const d = new Date(ngay);
  return Number.isNaN(d.getTime()) ? ngay : d.toLocaleDateString("vi-VN");
}

function linkTaiLieuHopLe(path: string): string {
  const value = path.trim();
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) {
    return value;
  }
  if (/^https:\/\//i.test(value)) return value;
  return "";
}

function chuanHoaThongBao(raw: unknown): ThongBao | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const id = Number(row.ma_thong_bao);
  if (
    !Number.isSafeInteger(id) ||
    typeof row.tieu_de !== "string" ||
    typeof row.ngay_dang !== "string"
  ) return null;
  const status = row.trang_thai === undefined ? 1 : Number(row.trang_thai);
  return {
    ma_thong_bao: id,
    tieu_de: row.tieu_de,
    noi_dung: typeof row.noi_dung === "string" ? row.noi_dung : "",
    ten_file: typeof row.ten_file === "string" ? row.ten_file : "",
    duong_dan_file:
      typeof row.duong_dan_file === "string" ? row.duong_dan_file : "",
    ngay_dang: row.ngay_dang,
    trang_thai: status,
  };
}


export default function PublicHome({ page = "home" }: { page?: PublicPage }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [teacherVerified, setTeacherVerified] = useState(false);
  const [officeVerified, setOfficeVerified] = useState(false);
  const [menuMo, setMenuMo] = useState(false);
  const [logoBiLoi, setLogoBiLoi] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [danhSach, setDanhSach] = useState<ThongBao[]>([]);
  const [dangTai, setDangTai] = useState(false);
  const [loiThongBao, setLoiThongBao] = useState("");
  const [timKiem, setTimKiem] = useState("");
  const [noticePage, setNoticePage] = useState(1);
  const [selectedNotice, setSelectedNotice] = useState<ThongBao | null>(null);
  const [officeReload, setOfficeReload] = useState(0);

  useEffect(() => {
    let active = true;
    let latestCheck = 0;
    const sync = () => {
      const check = ++latestCheck;
      void verifySession().then(session => {
        if (!active || check !== latestCheck) return;
        setUser(session);
        setTeacherVerified(session?.role === "teacher");
        setOfficeVerified(session?.role === "training_office");
      }).catch(error => {
        if (active && check === latestCheck) {
          setUser(null);
          setLoginError(error instanceof Error ? error.message : "Không kiểm tra được phiên đăng nhập.");
        }
      });
    };
    sync();
    window.addEventListener("agu-auth-changed", sync);
    return () => { active = false; window.removeEventListener("agu-auth-changed", sync); };
  }, [page]);

  const isTeacherProfile = page === "teacher-profile";
  const isTeacherSchedule = page === "teacher-schedule";
  const isTeacherGrades = page === "teacher-grades";
  const isOfficeAssignment = page === "office-assign";
  // Trang chủ của giảng viên vẫn hiển thị thông báo như cổng thông tin chung.
  const isNoticePage = page === "home" || page === "notices";
  const isStudentPage = (["profile", "schedule", "grades", "progress"] as string[]).includes(page);

  useEffect(() => {
    if (!isNoticePage) return;
    const controller = new AbortController();
    async function taiThongBao() {
      setDangTai(true);
      setLoiThongBao("");
      try {
        const url = page === "home" ? "/api/thong-bao?limit=5" : "/api/thong-bao";
        const response = await fetch(url, {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Không thể tải thông báo (HTTP ${response.status}).`);
        const result: unknown = await response.json();
        let rows: unknown = result;
        if (result && typeof result === "object" && !Array.isArray(result)) {
          rows = (result as { data?: unknown; items?: unknown }).data ??
            (result as { items?: unknown }).items;
        }
        if (!Array.isArray(rows)) throw new Error("API trả về dữ liệu không phải danh sách thông báo.");
        const items = rows.map(chuanHoaThongBao).filter((item): item is ThongBao => item !== null);

        try {
          const extraResponse = await fetch(
            "/api/office-notices/public",
            {
              signal: controller.signal,
              cache: "no-store",
            }
          );

          if (extraResponse.ok) {
            const extra = await extraResponse.json();

            if (Array.isArray(extra.data)) {
              const officeItems: ThongBao[] = extra.data.map(
                (row: Record<string, unknown>) => ({
                  ma_thong_bao: Number(row.ma_thong_bao) + 1000000000,
                  tieu_de: String(row.tieu_de || ""),
                  noi_dung: String(row.noi_dung || ""),
                  ten_file: String(row.ten_file || ""),
                  duong_dan_file: String(row.duong_dan_file || ""),
                  ngay_dang: String(row.ngay_dang || ""),
                  trang_thai: 1,
                })
              );

              items.push(...officeItems);
            }
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          console.warn(
            "Không tải được thông báo Phòng đào tạo",
            error
          );
        }

        if (!controller.signal.aborted) setDanhSach(items);
      } catch (error) {
        if (controller.signal.aborted) return;
        setDanhSach([]);
        setLoiThongBao(error instanceof Error ? error.message : "Không thể kết nối máy chủ.");
      } finally {
        if (!controller.signal.aborted) setDangTai(false);
      }
    }
    void taiThongBao();
    return () => controller.abort();
  }, [isNoticePage, page, officeReload]);


  const ketQua = useMemo(() => {
    const keyword = timKiem.trim().toLocaleLowerCase("vi");
    return [...danhSach]
      .filter((item) => item.trang_thai === 1)
      .filter((item) => page !== "notices" || !keyword ||
        item.tieu_de.toLocaleLowerCase("vi").includes(keyword))
      .sort((a, b) =>
        (new Date(b.ngay_dang).getTime() || 0) - (new Date(a.ngay_dang).getTime() || 0) ||
        b.ma_thong_bao - a.ma_thong_bao);
  }, [danhSach, page, timKiem]);
  const totalNoticePages = Math.max(1, Math.ceil(ketQua.length / 10));
  const currentNoticePage = Math.min(noticePage, totalNoticePages);
  const hienThi = page === "home"
    ? ketQua.slice(0, SO_THONG_BAO_TRANG_CHU)
    : ketQua.slice((currentNoticePage - 1) * 10, currentNoticePage * 10);
  const handleInlineLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loggingIn) return;
    const inputUser = username.trim().toLowerCase();
    if (!inputUser || !password.trim()) {
      setLoginError("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }
    setLoggingIn(true);
    setLoginError("");
    try {
      const isAdmin = ["admin", "admin@agu.edu.vn", "admin@student.agu.edu.vn"].includes(inputUser);
      let session: SessionUser;
      if (inputUser === "phongdaotao@agu.edu.vn") {
        const response = await fetch("/api/training-office/login", {
          method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: inputUser, password }),
        });
        if (!response.ok) {
          setLoginError(response.status === 401
            ? "Tài khoản Phòng đào tạo hoặc mật khẩu không hợp lệ."
            : "Không thể đăng nhập Phòng đào tạo. Kiểm tra Backend và lệnh tạo tài khoản.");
          return;
        }
        const data: { user?: SessionUser } = await response.json();
        if (!data.user || data.user.role !== "training_office") throw new Error("Invalid office response");
        session = data.user;
      } else if (inputUser.endsWith("@teacher.agu.edu.vn")) {
        const response = await fetch("/api/teacher-auth/login", {
          method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: inputUser, password }),
        });
        if (!response.ok) {
          setLoginError(response.status === 401
            ? "Tài khoản giảng viên hoặc mật khẩu không hợp lệ."
            : "Không thể đăng nhập giảng viên. Hãy kiểm tra Backend và tài khoản đã tạo.");
          return;
        }
        const data: { user?: SessionUser } = await response.json();
        if (!data.user || data.user.role !== "teacher") throw new Error("Invalid teacher response");
        session = data.user;
      } else if (isAdmin) {
        const response = await fetch("/api/auth/login", {
          method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: inputUser, password }),
        });
        const data = await response.json();
        if (!response.ok || data.user?.role !== "admin") {
          setLoginError(data.message || "Không thể đăng nhập quản trị viên.");
          return;
        }
        session = data.user;
      } else {
        // Đăng nhập học viên DEMO có cookie xác thực trên Backend để đọc điểm riêng tư.
        const response = await fetch("/api/student-records/login", {
          method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: inputUser, password }),
        });
        const data = await response.json();
        if (!response.ok) {
          setLoginError(typeof data.message === "string" ? data.message : "Không đăng nhập được học viên.");
          return;
        }
        if (!data.user || data.user.role !== "student") throw new Error("Invalid student response");
        session = data.user;
      }
      await logoutSessions(session.role);
      localStorage.setItem("currentUser", JSON.stringify(session));
      localStorage.removeItem("aguAuthSource");
      window.dispatchEvent(new Event("agu-auth-changed"));
      setUser(session);
      if (session.role === "teacher") setTeacherVerified(true);
      if (session.role === "training_office") setOfficeVerified(true);
      setPassword("");
      setUsername("");
      setMenuMo(false);
      if (window.location.pathname === "/") router.refresh();
      else router.replace("/");
    } catch {
      setLoginError("Không thể đọc dữ liệu đăng nhập. Vui lòng kiểm tra máy chủ hoặc thử lại.");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutSessions();
    localStorage.removeItem("currentUser");
    localStorage.removeItem("aguAuthSource");
    window.dispatchEvent(new Event("agu-auth-changed"));
    setUser(null);
    setTeacherVerified(false);
    setOfficeVerified(false);
    setMenuMo(false);
    setLoginError("");
    router.replace("/");
    router.refresh();
  };

  return (
    <div className={styles.site}>
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <Link href="/" className={styles.identity} aria-label="Trang chủ cổng thông tin đào tạo AGU">
            <span className={styles.logoFrame}>
              {!logoBiLoi ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={AGU_LOGO_URL} alt="Logo Trường Đại học An Giang" width={72} height={72} onError={() => setLogoBiLoi(true)} />
              ) : <span className={styles.logoFallback}>AGU</span>}
            </span>
            <span className={styles.identityText}>
              <strong>TRƯỜNG ĐẠI HỌC AN GIANG</strong>
              <span>AN GIANG UNIVERSITY</span>
              <small>CỔNG THÔNG TIN ĐÀO TẠO SAU ĐẠI HỌC</small>
            </span>
          </Link>

          <div className={styles.headerAccount}>
            {user ? (
              (user.role === "teacher" || user.role === "training_office") ? (
                <PublicAccountMenu user={user} onLogout={handleLogout} />
              ) : (
                <div className={styles.welcomeBar}>
                <span>Xin chào, <strong>{user.hoTen || "Người dùng"}</strong></span>
                {user.role === "admin" && <Link href="/admin" className={styles.adminLink}>Quản trị</Link>}
                <button type="button" onClick={handleLogout} className={styles.signOut}>Đăng xuất</button>
              </div>
              )
            ) : (
              <div className={styles.loginBox}>
                <form className={styles.loginForm} onSubmit={(event) => void handleInlineLogin(event)}>
                  <div className={styles.loginField}>
                    <label htmlFor="inline-username">Tên đăng nhập</label>
                    <input id="inline-username" type="text" autoComplete="username"
                      placeholder="Mã HV / Email giảng viên / Phòng đào tạo" value={username}
                      onChange={(event) => { setUsername(event.target.value); setLoginError(""); }} required />
                  </div>
                  <div className={styles.loginField}>
                    <label htmlFor="inline-password">Mật khẩu</label>
                    <input id="inline-password" type="password" autoComplete="current-password" placeholder="Mật khẩu"
                      value={password} onChange={(event) => { setPassword(event.target.value); setLoginError(""); }} required />
                  </div>
                  <button type="submit" disabled={loggingIn}>{loggingIn ? "Đang kiểm tra..." : "Đăng nhập"}</button>
                </form>
                {loginError && <p className={styles.loginError} role="alert">{loginError}</p>}
              </div>
            )}
          </div>
          <button type="button" className={styles.menuButton}
            onClick={() => setMenuMo((prev) => !prev)} aria-expanded={menuMo} aria-controls="agu-navigation"
            aria-label={menuMo ? "Đóng menu" : "Mở menu"}>
            {menuMo ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <nav id="agu-navigation" className={`${styles.nav} ${menuMo ? styles.navOpen : ""}`} aria-label="Điều hướng chính">
        <div className={`${styles.container} ${styles.navInner}`}>
          {(user?.role === "teacher" ? teacherLinks : user?.role === "training_office" ? trainingOfficeLinks : publicLinks).map(({ href, label, page: linkPage }) => {
            const active = page === linkPage;
            return <Link key={href} href={href} className={active ? styles.active : ""}
              aria-current={active ? "page" : undefined}
              onClick={() => setMenuMo(false)}>{label}</Link>;
          })}
          {user?.role === "student" && studentLinks.map(({ href, label, page: linkPage }) => (
            <Link key={href} href={href} className={page === linkPage ? styles.active : ""}
              aria-current={page === linkPage ? "page" : undefined} onClick={() => setMenuMo(false)}>{label}</Link>
          ))}
          {user?.role !== "teacher" && user?.role !== "training_office" && secondaryLinks.map(({ href, label, page: linkPage }) => (
            <Link key={href} href={href} className={page === linkPage ? styles.active : ""}
              aria-current={page === linkPage ? "page" : undefined} onClick={() => setMenuMo(false)}>{label}</Link>
          ))}
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.container}>
          {isOfficeAssignment ? (
            officeVerified && user?.role === "training_office" ? (
              <TrainingOfficeAssignmentReadonly />
            ) : (
              <section className={styles.infoPanel} style={{ padding: 28 }} aria-live="polite">
                {user?.role === "training_office" ? "Đang xác thực tài khoản Phòng đào tạo..." : "Vui lòng đăng nhập bằng tài khoản Phòng đào tạo để xem các phân công đã lưu."}
              </section>
            )
          ) : isTeacherProfile || isTeacherGrades || isTeacherSchedule ? (
            teacherVerified && user?.role === "teacher" ? (
              isTeacherSchedule ? <TeacherSchedule /> : isTeacherGrades ? <TeacherGradebook /> : <TeacherPortalContent user={{ ...user, role: "teacher" }} section="profile" />
            ) : (
              <section className={styles.infoPanel} style={{ padding: 28 }} aria-live="polite">
                {user?.role === "teacher" ? "Đang xác thực tài khoản giảng viên..." : "Vui lòng đăng nhập bằng tài khoản giảng viên để xem thông tin."}
              </section>
            )
          ) : isNoticePage ? (
            <section className={styles.noticePanel} id="thong-bao" aria-label="Thông báo đào tạo">
              <div className={styles.noticeHeading}>
                <h1>{page === "home" ? "Thông báo mới nhất" : "Tất cả thông báo"}</h1>
                {page === "home" && <Link href="/thong-bao" className={styles.allNoticesLink}>Xem tất cả thông báo</Link>}
              </div>
              {page === "notices" && (
                <div className={styles.searchBox}>
                  <label className={styles.srOnly} htmlFor="search-notice">Tìm kiếm thông báo</label>
                  <input id="search-notice" type="search" value={timKiem}
                    onChange={(event) => setTimKiem(event.target.value)} placeholder="Tìm thông báo theo tiêu đề..." />
                  {!!timKiem && <button type="button" className={styles.clearSearch} onClick={() => setTimKiem("")} aria-label="Xóa tìm kiếm">Xóa</button>}
                </div>
              )}
              {page === "notices" && officeVerified &&
               user?.role === "training_office" && (
              <OfficeNoticeInline
               onChanged={() => setOfficeReload(x => x + 1)}
              />
              )}

              {selectedNotice && (
                <div className={styles.officeNoticeDetail}>
                  <button
                    type="button"
                      onClick={() => setSelectedNotice(null)}
                    >
                      ← Quay lại danh sách
                    </button>

                    <h2>{selectedNotice.tieu_de}</h2>

                    <p>{dinhDangNgay(selectedNotice.ngay_dang)}</p>

                    <div className={styles.officeNoticeContent}>
                      {selectedNotice.noi_dung ||
                        "Không có nội dung chi tiết."}
                    </div>

                    {linkTaiLieuHopLe(selectedNotice.duong_dan_file) && (
                      <a
                        href={
                          linkTaiLieuHopLe(selectedNotice.duong_dan_file)!
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Xem tệp đính kèm
                      </a>
                    )}
                  </div>
                )}

              <div className={styles.noticeList}>
                {dangTai ? (
                  <div className={styles.emptyState}><strong>Đang tải thông báo...</strong></div>
                ) : loiThongBao ? (
                  <div className={styles.emptyState}><strong>Không thể tải thông báo</strong><span>{loiThongBao}</span></div>
                ) : hienThi.length === 0 ? (
                  <div className={styles.emptyState}><strong>Chưa có thông báo</strong><span>Hiện chưa có thông báo được đăng tải.</span></div>
                ) : hienThi.map((item, index) => {
                  const url = linkTaiLieuHopLe(item.duong_dan_file);
                  return (
                    <article key={item.ma_thong_bao} className={`${styles.noticeItem} ${index === 0 && !timKiem ? styles.featuredNotice : ""}`}>
                      <div className={styles.noticeBody}>
                        <div className={styles.noticeTitleRow}>
                          {index === 0 && !timKiem && <span className={styles.newFlag}>MỚI NHẤT</span>}
                          <button
                           type="button"
                            className={styles.officeNoticeTitle}
                           onClick={() => setSelectedNotice(item)}
                          >
                          {item.tieu_de}
                          </button>
                        </div>
                        <div className={styles.noticeMeta}>
                          <span>{dinhDangNgay(item.ngay_dang)}</span>
                          {item.ten_file && <span className={styles.fileName}>{item.ten_file}</span>}
                        </div>
                      </div>
                      <div className={styles.docActions}>
                        {url ? (
                          <>
                            <a href={url} target="_blank" rel="noopener noreferrer" className={styles.viewButton}>Xem</a>
                            <a href={url} download={item.ten_file || undefined} className={styles.downloadButton}>Tải tệp</a>
                          </>
                        ) : <span className={styles.noFile}>Chưa có tệp</span>}
                      </div>
                    </article>
                  );
                })}
              </div>
              <div className={styles.noticeFooter}>
                {page === "home" ? (
                  <Link href="/thong-bao">Xem tất cả thông báo</Link>
                ) : <span>Đang hiển thị {ketQua.length} thông báo{timKiem ? ` phù hợp trong ${danhSach.length} bản ghi` : ""}.</span>}
              </div>

{page === "notices" && totalNoticePages > 1 && (
  <div className={styles.officeNoticePagination}>
    <button
      type="button"
      disabled={currentNoticePage === 1}
      onClick={() =>
        setNoticePage(p => Math.max(1, p - 1))
      }
    >
      Trước
    </button>

    <span>
      Trang {currentNoticePage}/{totalNoticePages}
    </span>

    <button
      type="button"
      disabled={currentNoticePage === totalNoticePages}
      onClick={() =>
        setNoticePage(p => Math.min(totalNoticePages, p + 1) )}> Sau </button></div> )}

            </section>
          ) : isStudentPage ? (
            user?.role === "student" ? <StudentPortalContent section={page as StudentSection} /> : (
              <section className={styles.infoPanel}>
                <div className={styles.emptyInfo}>
                  <strong>Vui lòng đăng nhập</strong>
                  <span>Bạn cần đăng nhập bằng tài khoản học viên để xem nội dung này.</span>
                </div>
              </section>
            )
          ) : (
            <section className={page === "programs" ? styles.infoPanel : undefined} aria-label={page === "programs" ? "Chương trình đào tạo" : page === "contact" ? "Liên hệ" : "Giới thiệu"}>
              {page === "programs" && (
                <div className={styles.emptyInfo}>
                  <strong>Chưa có tài liệu chương trình đào tạo được đăng tải</strong>
                  <span>Khi có dữ liệu chính thức, hệ thống sẽ hiển thị tài liệu cho học viên và người quan tâm.</span>
                </div>
              )}
              {page === "contact" && (
                <div className={styles.infoContent}>
                  <header className={styles.infoHero}>
                    <div className={styles.infoHeroText}>
                      <h1>Thông tin liên hệ</h1>
                      <p>
                        Liên hệ Phòng Quản lý Khoa học và Đào tạo Sau đại học để
                        hỏi về tuyển sinh, hồ sơ hoặc thủ tục học vụ.
                      </p>
                      <a className={styles.infoAction} href="tel:+842966256565">
                        <Phone size={17} aria-hidden="true" /> Gọi văn phòng
                      </a>
                    </div>
                    <figure className={styles.infoPhoto}>
                      <Image
                        src="https://www.agu.edu.vn/assets/frontend/images/phattrienbenvung/no-luc-cai-thien-tinh-hinh-giao-thong/h3.jpg"
                        alt="Cổng chính Trường Đại học An Giang"
                        fill
                        preload
                        unoptimized
                      />
                      <figcaption>
                        <a href="https://www.agu.edu.vn/vi/phat-trien-ben-vung/no-luc-cai-thien-tinh-hinh-giao-thong">
                          Ảnh: Trường Đại học An Giang
                        </a>
                      </figcaption>
                    </figure>
                  </header>
                  <div className={styles.infoGrid}>
                    <section className={styles.infoLinkCard}>
                      <h2>
                        <MapPin aria-hidden="true" /> Văn phòng và điện thoại
                      </h2>
                      <address>
                        Lầu 2, Khu Hiệu bộ, Trường Đại học An Giang, số 18 Ung
                        Văn Khiêm, phường Long Xuyên, tỉnh An Giang.
                      </address>
                      <p>
                        <a href="tel:+842966256565">(0296) 625 6565</a> · Máy lẻ
                        1720
                      </p>
                      <a href="https://www.google.com/maps/search/?api=1&query=Tr%C6%B0%E1%BB%9Dng%20%C4%90%E1%BA%A1i%20h%E1%BB%8Dc%20An%20Giang%2C%2018%20Ung%20V%C4%83n%20Khi%C3%AAm">
                        Xem đường đi trên Google Maps
                      </a>
                      <a href="https://pgd.agu.edu.vn/storage/844bb3d7f10387d705c2dfb6d17d6b03.pdf">
                        Xem thông tin liên hệ trong thông báo của Trường (PDF)
                      </a>
                    </section>
                    <section className={styles.infoLinkCard}>
                      <h2>
                        <Globe aria-hidden="true" /> Kênh thông tin chính thức
                      </h2>
                      <p>
                        Tra cứu điều kiện dự tuyển, thành phần hồ sơ và thời hạn
                        nộp theo thông báo của từng đợt.
                      </p>
                      <a href="https://pgd.agu.edu.vn/">
                        Website Phòng Quản lý Khoa học và Đào tạo Sau đại học
                      </a>
                      <a href="https://tuyensinh.agu.edu.vn/">
                        Cổng tuyển sinh Trường Đại học An Giang
                      </a>
                      <a href="https://www.agu.edu.vn/">
                        Website Trường Đại học An Giang
                      </a>
                    </section>
                  </div>
                </div>
              )}
              {page === "about" && (
                <div className={styles.infoContent}>
                  <header className={styles.infoHero}>
                    <div className={styles.infoHeroText}>
                      <h1>Giới thiệu Trường Đại học An Giang</h1>
                      <p>
                        Trường Đại học An Giang là cơ sở giáo dục đại học công
                        lập, thành lập ngày 30/12/1999 và trở thành trường thành
                        viên của Đại học Quốc gia Thành phố Hồ Chí Minh vào ngày
                        13/8/2019. Trường đào tạo nguồn nhân lực, nghiên cứu
                        khoa học và chuyển giao công nghệ phục vụ sự phát triển
                        của Đồng bằng sông Cửu Long.
                      </p>
                      <a
                        className={styles.infoAction}
                        href="https://rmgo.agu.edu.vn/sites/default/files/Brochure_Vi_Full.pdf"
                      >
                        Tìm hiểu về Trường (PDF){" "}
                        <ArrowUpRight size={17} aria-hidden="true" />
                      </a>
                    </div>
                    <figure className={styles.infoPhoto}>
                      <Image
                        src="https://www.agu.edu.vn/assets/frontend/images/poster.png"
                        alt="Toàn cảnh khuôn viên Trường Đại học An Giang nhìn từ trên cao"
                        fill
                        preload
                        unoptimized
                      />
                      <figcaption>
                        <a href="https://www.agu.edu.vn/en/about/an-giang-university-song">
                          Ảnh: Trường Đại học An Giang
                        </a>
                      </figcaption>
                    </figure>
                  </header>
                  <div className={styles.infoGrid}>
                    <section className={styles.infoLinkCard}>
                      <h2>
                        <GraduationCap aria-hidden="true" /> Đào tạo sau đại học
                      </h2>
                      <p>
                        Trường tổ chức đào tạo trình độ thạc sĩ và tiến sĩ. Ứng
                        viên có thể tra cứu ngành tuyển sinh, điều kiện dự tuyển
                        và lịch nộp hồ sơ theo từng đợt trên cổng tuyển sinh của
                        Trường.
                      </p>
                      <a href="https://tuyensinh.agu.edu.vn/">
                        Tra cứu thông tin tuyển sinh
                      </a>
                    </section>
                    <section className={styles.infoLinkCard}>
                      <h2>
                        <Globe aria-hidden="true" /> Cổng thông tin dành cho học
                        viên
                      </h2>
                      <p>
                        Học viên có thể xem thông báo đào tạo và đăng nhập để
                        tra cứu hồ sơ, thời khóa biểu, bảng điểm và tiến độ học
                        tập.
                      </p>
                      <Link href="/thong-bao">Xem thông báo đào tạo</Link>
                      <Link href="/lien-he">Liên hệ hỗ trợ</Link>
                    </section>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerInner}`}>
          <div><strong>TRƯỜNG ĐẠI HỌC AN GIANG</strong><span>Cổng thông tin đào tạo sau đại học</span></div>
          <p>© {new Date().getFullYear()} AGU. Giao diện hệ thống quản lý đào tạo thạc sĩ.</p>
          <Link href="/">Về trang chủ</Link>
        </div>
      </footer>
    </div>
  );
}
