"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import StudentPortalContent, { type StudentSection } from "./StudentPortalContent";
import styles from "./PublicHome.module.css";

// Có thể thay bằng /images/logo-agu.jpg khi lưu logo vào public/images.
const AGU_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/4/42/Logoagunew2026.jpg";
const SO_THONG_BAO_TRANG_CHU = 5;

type PublicPage = "home" | "notices" | "programs" | "contact" | "about" | StudentSection;
type SessionUser = {
  role: "admin" | "student";
  maHocVien?: string;
  hoTen?: string;
  email?: string;
};
type ThongBao = {
  ma_thong_bao: number;
  tieu_de: string;
  ten_file: string;
  duong_dan_file: string;
  ngay_dang: string;
  trang_thai: number;
};

const publicLinks = [
  { href: "/", label: "Trang chủ", page: "home" },
  { href: "/thong-bao", label: "Thông báo", page: "notices" },
  { href: "/chuong-trinh-dao-tao", label: "Chương trình đào tạo", page: "programs" },
] as const;
const studentLinks = [
  { href: "/profile", label: "Hồ sơ học viên", page: "profile" },
  { href: "/schedule", label: "Thời khóa biểu", page: "schedule" },
  { href: "/grades", label: "Bảng điểm", page: "grades" },
  { href: "/tien-do-hoc-tap", label: "Tiến độ học tập", page: "progress" },
] as const;
const secondaryLinks = [
  { href: "/gioi-thieu", label: "Giới thiệu", page: "about" },
  { href: "/lien-he", label: "Liên hệ", page: "contact" },
] as const;

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
    ten_file: typeof row.ten_file === "string" ? row.ten_file : "",
    duong_dan_file:
      typeof row.duong_dan_file === "string" ? row.duong_dan_file : "",
    ngay_dang: row.ngay_dang,
    trang_thai: status,
  };
}

function readUserFromLocalStorage(): SessionUser | null {
  try {
    const value = localStorage.getItem("currentUser");
    if (!value) return null;
    const raw: unknown = JSON.parse(value);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const obj = raw as Record<string, unknown>;
    if (obj.role !== "student" && obj.role !== "admin") return null;
    return {
      role: obj.role,
      maHocVien: typeof obj.maHocVien === "string" ? obj.maHocVien : undefined,
      hoTen: typeof obj.hoTen === "string" ? obj.hoTen : undefined,
      email: typeof obj.email === "string" ? obj.email : undefined,
    };
  } catch {
    return null;
  }
}

export default function PublicHome({ page = "home" }: { page?: PublicPage }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [menuMo, setMenuMo] = useState(false);
  const [logoBiLoi, setLogoBiLoi] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [danhSach, setDanhSach] = useState<ThongBao[]>([]);
  const [dangTai, setDangTai] = useState(false);
  const [loiThongBao, setLoiThongBao] = useState("");
  const [timKiem, setTimKiem] = useState("");

  const isNoticePage = page === "home" || page === "notices";
  const isStudentPage = (["profile", "schedule", "grades", "progress"] as string[]).includes(page);

  useEffect(() => {
    const readUser = () => setUser(readUserFromLocalStorage());
    readUser();
    window.addEventListener("storage", readUser);
    return () => window.removeEventListener("storage", readUser);
  }, []);

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
  }, [isNoticePage, page]);

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
  const hienThi = page === "home" ? ketQua.slice(0, SO_THONG_BAO_TRANG_CHU) : ketQua;

  async function handleInlineLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loggingIn) return;
    if (!username.trim() || !password) {
      setLoginError("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }
    setLoggingIn(true);
    setLoginError("");
    try {
      // Chỉ backend mới có quyền xác minh mật khẩu và vai trò.
      // API này phải tồn tại và xác thực thật trước khi triển khai đăng nhập.
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const body: unknown = await response.json().catch(() => null);
      const data = body && typeof body === "object" ? body as Record<string, unknown> : {};
      if (!response.ok) {
        const message = typeof data.message === "string" ? data.message : `Đăng nhập thất bại (HTTP ${response.status}).`;
        throw new Error(message);
      }
      const nestedData = data.data && typeof data.data === "object" ? data.data as Record<string, unknown> : {};
      const candidate = data.user ?? nestedData.user;
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        throw new Error("API đăng nhập chưa trả về tài khoản hợp lệ.");
      }
      const account = candidate as Record<string, unknown>;
      if (account.role !== "admin" && account.role !== "student") {
        throw new Error("Vai trò tài khoản không hợp lệ.");
      }
      const session: SessionUser = {
        role: account.role,
        maHocVien: typeof account.maHocVien === "string" ? account.maHocVien : undefined,
        hoTen: typeof account.hoTen === "string" ? account.hoTen : undefined,
        email: typeof account.email === "string" ? account.email : undefined,
      };
      // Chỉ phục vụ hiển thị; quyền thực tế phải kiểm tra bằng phiên máy chủ.
      localStorage.setItem("currentUser", JSON.stringify(session));
      setUser(session);
      setUsername("");
      setPassword("");
      setMenuMo(false);
      router.replace("/");
      router.refresh();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Đăng nhập không thành công.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLoginError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("Máy chủ chưa xác nhận đăng xuất.");
      localStorage.removeItem("currentUser");
      setUser(null);
      setMenuMo(false);
      router.replace("/");
      router.refresh();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Đăng xuất không thành công.");
    } finally {
      setLoggingOut(false);
    }
  }

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
              <div className={styles.welcomeBar}>
                <span>Xin chào, <strong>{user.hoTen || "Người dùng"}</strong></span>
                {user.role === "admin" && <Link href="/admin" className={styles.adminLink}>Quản trị</Link>}
                <button type="button" disabled={loggingOut} onClick={() => void handleLogout()} className={styles.signOut}>
                  {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
                </button>
                {loginError && <p className={styles.loginError} role="alert">{loginError}</p>}
              </div>
            ) : (
              <div className={styles.loginBox}>
                <form className={styles.loginForm} onSubmit={(event) => void handleInlineLogin(event)}>
                  <div className={styles.loginField}>
                    <label htmlFor="inline-username">Tên đăng nhập</label>
                    <input id="inline-username" type="text" autoComplete="username" placeholder="Mã HV / Email"
                      value={username} onChange={(event) => { setUsername(event.target.value); setLoginError(""); }} required />
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
          {publicLinks.map(({ href, label, page: linkPage }) => (
            <Link key={href} href={href} className={page === linkPage ? styles.active : ""}
              aria-current={page === linkPage ? "page" : undefined} onClick={() => setMenuMo(false)}>{label}</Link>
          ))}
          {user?.role === "student" && studentLinks.map(({ href, label, page: linkPage }) => (
            <Link key={href} href={href} className={page === linkPage ? styles.active : ""}
              aria-current={page === linkPage ? "page" : undefined} onClick={() => setMenuMo(false)}>{label}</Link>
          ))}
          {secondaryLinks.map(({ href, label, page: linkPage }) => (
            <Link key={href} href={href} className={page === linkPage ? styles.active : ""}
              aria-current={page === linkPage ? "page" : undefined} onClick={() => setMenuMo(false)}>{label}</Link>
          ))}
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.container}>
          {isNoticePage ? (
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
                          {url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className={styles.noticeTitle}>{item.tieu_de}</a>
                          ) : <strong className={styles.noticeTitle}>{item.tieu_de}</strong>}
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
            <section className={styles.infoPanel} aria-label={page === "programs" ? "Chương trình đào tạo" : page === "contact" ? "Liên hệ" : "Giới thiệu"}>
              {page === "programs" && (
                <div className={styles.emptyInfo}>
                  <strong>Chưa có tài liệu chương trình đào tạo được đăng tải</strong>
                  <span>Khi có dữ liệu chính thức, hệ thống sẽ hiển thị tài liệu cho học viên và người quan tâm.</span>
                </div>
              )}
              {page === "contact" && (
                <div className={styles.infoLinkCard}>
                  <strong>Website Trường Đại học An Giang</strong>
                  <span>Xem các kênh liên hệ do nhà trường công bố.</span>
                  <a href="https://www.agu.edu.vn/" target="_blank" rel="noopener noreferrer">Truy cập website trường</a>
                </div>
              )}
              {page === "about" && (
                <div className={styles.infoLinkCard}>
                  <strong>Cổng thông tin đào tạo sau đại học</strong>
                  <span>Hỗ trợ tra cứu thông báo, hồ sơ, thời khóa biểu, bảng điểm và tiến độ học tập.</span>
                  <Link href="/thong-bao">Đến danh sách thông báo</Link>
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
