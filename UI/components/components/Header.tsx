"use client";

export default function Header() {
  return (
    <div className="header-bar">
      <div className="header-left">
        <button
          className="btn-icon"
          title="Thu gọn/Mở rộng menu"
          onClick={() => {
            const el = document.getElementById("sidebar");
            if (!el) return;
            const next = !el.classList.contains("open");
            el.classList.toggle("open", next);
            el.classList.toggle("collapsed", !next);
            window.dispatchEvent(
              new CustomEvent("sidebar-toggle", { detail: { open: next } })
            );
          }}
        >
          ☰
        </button>
        <h1 className="page-title">Bảng điều khiển</h1>
      </div>

      <div className="header-right">
        <div className="user-info">
          <div className="user-avatar">A</div>
          <div className="user-meta">
            <span className="user-name">Admin Phòng Đào tạo</span>
            <span className="user-role">Quản trị viên</span>
          </div>
        </div>
      </div>
    </div>
  );
}
