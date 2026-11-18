"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Globe,
  GraduationCap,
  MapPin,
  Menu,
  Phone,
  X,
} from "lucide-react";
import styles from "./PublicHome.module.css";
import StudentPortalContent, {
  type StudentSection,
} from "./StudentPortalContent";
import { useRouter } from "next/navigation";
import { DB, type StoredRecord } from "../lib/db";

// Có thể thay bằng "/images/logo-agu.jpg" sau khi lưu logo chính thức vào public/images.
const AGU_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/4/42/Logoagunew2026.jpg";
const SO_THONG_BAO_TRANG_CHU = 5;

type PublicPage =
  | "home"
  | "notices"
  | "programs"
  | "contact"
  | "about"
  | StudentSection;

const publicLinks = [
  { href: "/", label: "Trang chủ", page: "home" },
  { href: "/thong-bao", label: "Thông báo", page: "notices" },
  {
    href: "/chuong-trinh-dao-tao",
    label: "Chương trình đào tạo",
    page: "programs",
  },
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
  ten_file: string;
  duong_dan_file: string;
  ngay_dang: string;
};
type SessionUser = {
  role: "admin" | "student";
  maHocVien?: string;
  hoTen?: string;
  email?: string;
};

// Chỉ là dữ liệu DEMO để hiển thị giao diện; KHÔNG phải thông báo chính thức.
const DU_LIEU_MAU: ThongBao[] = [
  {
    ma_thong_bao: 6,
    tieu_de: "Thông báo đăng ký học phần học kỳ II năm học 2026–2027",
    ten_file: "HuongDanDangKyHocPhan.txt",
    duong_dan_file: "/demo-documents/HuongDanDangKyHocPhan.txt",
    ngay_dang: "2026-11-16T09:00:00",
  },
  {
    ma_thong_bao: 5,
    tieu_de: "Kế hoạch thực hiện và báo cáo tiến độ luận văn thạc sĩ",
    ten_file: "KeHoachLuanVan.txt",
    duong_dan_file: "/demo-documents/KeHoachLuanVan.txt",
    ngay_dang: "2026-11-12T08:30:00",
  },
  {
    ma_thong_bao: 4,
    tieu_de: "Hướng dẫn hoàn thiện hồ sơ học viên sau đại học",
    ten_file: "HoSoHocVien.txt",
    duong_dan_file: "/demo-documents/HoSoHocVien.txt",
    ngay_dang: "2026-11-09T10:15:00",
  },
  {
    ma_thong_bao: 3,
    tieu_de: "Thông báo cập nhật thông tin học tập cá nhân",
    ten_file: "ThongTinHocTap.txt",
    duong_dan_file: "/demo-documents/ThongTinHocTap.txt",
    ngay_dang: "2026-11-06T14:00:00",
  },
  {
    ma_thong_bao: 2,
    tieu_de: "Hướng dẫn theo dõi lịch học và kết quả học phần",
    ten_file: "LichHocVaKetQua.txt",
    duong_dan_file: "/demo-documents/LichHocVaKetQua.txt",
    ngay_dang: "2026-11-03T07:45:00",
  },
  {
    ma_thong_bao: 1,
    tieu_de: "Hướng dẫn sử dụng cổng thông tin đào tạo thạc sĩ",
    ten_file: "HuongDanSuDung.txt",
    duong_dan_file: "/demo-documents/HuongDanSuDung.txt",
    ngay_dang: "2026-10-29T15:25:00",
  },
];

function dinhDangNgay(ngay: string) {
  const d = new Date(ngay);
  return Number.isNaN(d.getTime())
    ? ngay
    : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(d);
}

function linkTaiLieuHopLe(path: string) {
  if (path.startsWith("/") && !path.startsWith("//") && !path.includes("\\"))
    return path;
  if (/^https:\/\//i.test(path)) return path;
  return "";
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
  const [danhSach, setDanhSach] = useState<ThongBao[]>(DU_LIEU_MAU);
  const [dangDungDuLieuMau, setDangDungDuLieuMau] = useState(true);
  const [timKiem, setTimKiem] = useState("");

  useEffect(() => {
    try {
      const value = localStorage.getItem("currentUser");
      const parsed: unknown = value ? JSON.parse(value) : null;
      if (
        parsed &&
        typeof parsed === "object" &&
        "role" in parsed &&
        (parsed.role === "student" || parsed.role === "admin")
      ) {
        setUser(parsed as SessionUser);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }

    if (page !== "home" && page !== "notices") return;

    const controller = new AbortController();
    async function taiDuLieu() {
      try {
        const response = await fetch("/api/thong-bao?limit=10000", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) return;
        const data: unknown = await response.json();
        const rows: unknown = Array.isArray(data)
          ? data
          : data && typeof data === "object" && "data" in data
            ? (data as { data: unknown }).data
            : null;
        if (!Array.isArray(rows)) return;
        const items = rows.filter(
          (row): row is ThongBao =>
            !!row &&
            typeof row === "object" &&
            typeof row.ma_thong_bao === "number" &&
            typeof row.tieu_de === "string" &&
            typeof row.ten_file === "string" &&
            typeof row.duong_dan_file === "string" &&
            typeof row.ngay_dang === "string",
        );
        // API /api/thong-bao chuyên biệt trả [] là không có thông báo.
        // Giữ demo khi API dùng chung trả { data: [] } dù chưa có entity này.
        if (
          !controller.signal.aborted &&
          rows.length === items.length &&
          (rows.length > 0 || Array.isArray(data))
        ) {
          setDanhSach(items);
          setDangDungDuLieuMau(false);
        }
      } catch {
        // Khi API chưa có hoặc mất kết nối, vẫn xem được giao diện DEMO.
      }
    }
    void taiDuLieu();
    return () => controller.abort();
  }, [page]);

  // Trang chủ luôn có tối đa 5 thông báo mới nhất; trang Thông báo có tất cả.
  const ketQua = useMemo(
    () =>
      [...danhSach]
        .sort(
          (a, b) =>
            b.ngay_dang.localeCompare(a.ngay_dang) ||
            b.ma_thong_bao - a.ma_thong_bao,
        )
        .filter(
          (item) =>
            page !== "notices" ||
            item.tieu_de
              .toLocaleLowerCase("vi")
              .includes(timKiem.trim().toLocaleLowerCase("vi")),
        ),
    [danhSach, timKiem, page],
  );

  const hienThi =
    page === "home" ? ketQua.slice(0, SO_THONG_BAO_TRANG_CHU) : ketQua;
  const isNoticePage = page === "home" || page === "notices";
  const isStudentPage = (
    ["profile", "schedule", "grades", "progress"] as string[]
  ).includes(page);

  // Xac thuc THU NGHIEM theo code cu: doi chieu email/mã học viên.
  // Chua co backend xac thuc mat khau: KHONG dung cho moi truong production.
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
      const isAdmin = [
        "admin",
        "admin@agu.edu.vn",
        "admin@student.agu.edu.vn",
      ].includes(inputUser);
      let session: SessionUser;
      if (isAdmin) {
        session = {
          role: "admin",
          maHocVien: "admin",
          hoTen: "Admin Phòng Đào tạo",
          email: "admin@agu.edu.vn",
        };
      } else {
        let students: StoredRecord[] = DB.get("students");
        if (!students.length) {
          const response = await fetch("/api/students?limit=2000", {
            cache: "no-store",
          });
          if (!response.ok) throw new Error("Không đọc được dữ liệu học viên");
          const json: unknown = await response.json();
          const list: unknown = Array.isArray(json)
            ? json
            : json && typeof json === "object"
              ? ((json as { data?: unknown; records?: unknown }).data ??
                (json as { records?: unknown }).records)
              : null;
          students = Array.isArray(list)
            ? list.filter(
                (item): item is StoredRecord =>
                  item !== null &&
                  typeof item === "object" &&
                  !Array.isArray(item),
              )
            : [];
        }
        const found = students.find((student) => {
          const code = String(
            student.maHocVien ||
              student.ma_hoc_vien ||
              student.mahv ||
              student.id ||
              "",
          )
            .trim()
            .toLowerCase();
          const email = String(student.email || student.Email || "")
            .trim()
            .toLowerCase();
          return (
            inputUser === email ||
            (code &&
              (inputUser === `${code}@student.agu.edu.vn` ||
                inputUser === `${code}@agu.edu.vn`))
          );
        });
        if (!found) {
          setLoginError("Tài khoản không có trong danh sách học viên.");
          return;
        }
        const maHocVien = String(
          found.maHocVien || found.ma_hoc_vien || found.id || inputUser,
        );
        const hoTen = String(
          found.hoTen ||
            found.ho_ten ||
            found.HO_TEN ||
            found.hoten ||
            "Học viên",
        );
        const email = String(found.email || `${maHocVien}@student.agu.edu.vn`);
        session = { role: "student", maHocVien, hoTen, email };
      }
      localStorage.setItem("currentUser", JSON.stringify(session));
      setUser(session);
      setPassword("");
      setUsername("");
      setMenuMo(false);
      // Ca hoc vien va quan ly deu tro ve trang chu; Admin co nut vao dashboard rieng.
      router.replace("/");
      router.refresh();
    } catch {
      setLoginError(
        "Không thể đọc dữ liệu đăng nhập. Vui lòng kiểm tra máy chủ hoặc thử lại.",
      );
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    setUser(null);
    setMenuMo(false);
    setLoginError("");
    router.replace("/");
    router.refresh();
  };

  return (
    <div className={styles.site}>
      <header className={styles.header}>
        <div className={`${styles.container} ${styles.headerInner}`}>
          <Link
            href="/"
            className={styles.identity}
            aria-label="Trang chủ cổng thông tin đào tạo AGU"
          >
            <span className={styles.logoFrame}>
              {!logoBiLoi ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={AGU_LOGO_URL}
                  alt="Logo Trường Đại học An Giang"
                  width={72}
                  height={72}
                  onError={() => setLogoBiLoi(true)}
                />
              ) : (
                <span className={styles.logoFallback}>AGU</span>
              )}
            </span>
            <span className={styles.identityText}>
              <strong>TRƯỜNG ĐẠI HỌC AN GIANG</strong>
              <span>AN GIANG UNIVERSITY</span>
              <small>CỔNG THÔNG TIN ĐÀO TẠO SAU ĐẠI HỌC</small>
            </span>
          </Link>

          {/* Đăng nhập/đăng xuất nằm trong cùng header với logo, không có thanh riêng. */}
          <div className={styles.headerAccount}>
            {user ? (
              <div className={styles.welcomeBar}>
                <span>
                  Xin chào, <strong>{user.hoTen || "Người dùng"}</strong>
                </span>
                {user.role === "admin" && (
                  <Link href="/admin" className={styles.adminLink}>
                    Quản trị
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className={styles.signOut}
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <div className={styles.loginBox}>
                <form className={styles.loginForm} onSubmit={handleInlineLogin}>
                  <div className={styles.loginField}>
                    <label htmlFor="inline-username">Tên đăng nhập</label>
                    <input
                      id="inline-username"
                      type="text"
                      autoComplete="username"
                      placeholder="Mã HV / Email"
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        setLoginError("");
                      }}
                      required
                    />
                  </div>
                  <div className={styles.loginField}>
                    <label htmlFor="inline-password">Mật khẩu</label>
                    <input
                      id="inline-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Mật khẩu"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setLoginError("");
                      }}
                      required
                    />
                  </div>
                  <button type="submit" disabled={loggingIn}>
                    {loggingIn ? "Đang kiểm tra..." : "Đăng nhập"}
                  </button>
                </form>
                {loginError && (
                  <p className={styles.loginError} role="alert">
                    {loginError}
                  </p>
                )}
                <p className={styles.demoAuthWarning}>
                  Đăng nhập thử nghiệm: không sử dụng mật khẩu thật.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setMenuMo((prev) => !prev)}
            aria-expanded={menuMo}
            aria-controls="agu-navigation"
            aria-label={menuMo ? "Đóng menu" : "Mở menu"}
          >
            {menuMo ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      <nav
        id="agu-navigation"
        className={`${styles.nav} ${menuMo ? styles.navOpen : ""}`}
        aria-label="Điều hướng chính"
      >
        <div className={`${styles.container} ${styles.navInner}`}>
          {publicLinks.map(({ href, label, page: linkPage }) => (
            <Link
              key={href}
              href={href}
              className={page === linkPage ? styles.active : ""}
              aria-current={page === linkPage ? "page" : undefined}
              onClick={() => setMenuMo(false)}
            >
              {label}
            </Link>
          ))}
          {user?.role === "student" &&
            studentLinks.map(({ href, label, page: linkPage }) => (
              <Link
                key={href}
                href={href}
                className={page === linkPage ? styles.active : ""}
                aria-current={page === linkPage ? "page" : undefined}
                onClick={() => setMenuMo(false)}
              >
                {label}
              </Link>
            ))}
          {secondaryLinks.map(({ href, label, page: linkPage }) => (
            <Link
              key={href}
              href={href}
              className={page === linkPage ? styles.active : ""}
              aria-current={page === linkPage ? "page" : undefined}
              onClick={() => setMenuMo(false)}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.container}>
          {isNoticePage ? (
            <section
              className={styles.noticePanel}
              id="thong-bao"
              aria-label="Thông báo đào tạo"
            >
              <div className={styles.noticeHeading}>
                <h1>
                  {page === "home" ? "Thông báo mới nhất" : "Tất cả thông báo"}
                </h1>
                {page === "home" && (
                  <Link href="/thong-bao" className={styles.allNoticesLink}>
                    Xem tất cả thông báo
                  </Link>
                )}
              </div>
              {page === "notices" && (
                <div className={styles.searchBox}>
                  <label className={styles.srOnly} htmlFor="search-notice">
                    Tìm kiếm thông báo
                  </label>
                  <input
                    id="search-notice"
                    value={timKiem}
                    onChange={(event) => setTimKiem(event.target.value)}
                    placeholder="Tìm thông báo theo tiêu đề..."
                  />
                  {!!timKiem && (
                    <button
                      type="button"
                      className={styles.clearSearch}
                      onClick={() => setTimKiem("")}
                      aria-label="Xóa tìm kiếm"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              )}
              {dangDungDuLieuMau && (
                <p className={styles.demoNote}>
                  Thông báo mẫu để xem giao diện, chưa phải dữ liệu chính thức.
                </p>
              )}
              <div className={styles.noticeList}>
                {hienThi.length ? (
                  hienThi.map((item, index) => {
                    const url = linkTaiLieuHopLe(item.duong_dan_file);
                    const laTinMoi = !timKiem.trim() && index === 0;
                    return (
                      <article
                        key={item.ma_thong_bao}
                        className={`${styles.noticeItem} ${laTinMoi ? styles.featuredNotice : ""}`}
                      >
                        <div className={styles.noticeBody}>
                          <div className={styles.noticeTitleRow}>
                            {laTinMoi && (
                              <span className={styles.newFlag}>MỚI NHẤT</span>
                            )}
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.noticeTitle}
                              >
                                {item.tieu_de}
                              </a>
                            ) : (
                              <strong className={styles.noticeTitle}>
                                {item.tieu_de}
                              </strong>
                            )}
                          </div>
                          <div className={styles.noticeMeta}>
                            <span>{dinhDangNgay(item.ngay_dang)}</span>
                            <span className={styles.fileName}>
                              {item.ten_file}
                            </span>
                          </div>
                        </div>
                        <div className={styles.docActions}>
                          {url ? (
                            <>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.viewButton}
                                aria-label={`Xem ${item.tieu_de}`}
                              >
                                Xem
                              </a>
                              <a
                                href={url}
                                download={item.ten_file}
                                className={styles.downloadButton}
                                aria-label={`Tải ${item.tieu_de}`}
                              >
                                Tải tệp
                              </a>
                            </>
                          ) : (
                            <span className={styles.noFile}>Chưa có tệp</span>
                          )}
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <div className={styles.emptyState}>
                    <strong>Không có thông báo phù hợp</strong>
                    <span>Hãy thử một từ khóa khác.</span>
                  </div>
                )}
              </div>
              <div className={styles.noticeFooter}>
                {page === "home" ? (
                  <Link href="/thong-bao">
                    Xem tất cả {danhSach.length} thông báo
                  </Link>
                ) : (
                  <span>
                    Đang hiển thị {ketQua.length} thông báo
                    {timKiem ? ` phù hợp trong tổng số ${danhSach.length}` : ""}
                    .
                  </span>
                )}
              </div>
            </section>
          ) : isStudentPage ? (
            <StudentPortalContent section={page as StudentSection} />
          ) : (
            <section
              className={page === "programs" ? styles.infoPanel : undefined}
              aria-label={
                page === "programs"
                  ? "Chương trình đào tạo"
                  : page === "contact"
                    ? "Liên hệ"
                    : "Giới thiệu"
              }
            >
              {page === "programs" && (
                <>
                  <div className={styles.emptyInfo}>
                    <strong>
                      Chưa có tài liệu chương trình đào tạo được đăng tải
                    </strong>
                    <span>
                      Khi có dữ liệu chính thức, trang này có thể hiển thị danh
                      sách ngành, khóa học và tệp chương trình đào tạo. Không
                      cần xây dựng chức năng quản lý chương trình tại đây.
                    </span>
                  </div>
                </>
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
          <div>
            <strong>TRƯỜNG ĐẠI HỌC AN GIANG</strong>
            <span>Cổng thông tin đào tạo sau đại học</span>
          </div>
          <p>
            © {new Date().getFullYear()} AGU. Giao diện hệ thống quản lý đào tạo
            thạc sĩ.
          </p>
          <Link href="/">Về trang chủ</Link>
        </div>
      </footer>
    </div>
  );
}
