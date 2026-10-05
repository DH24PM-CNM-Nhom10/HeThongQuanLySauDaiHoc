"use client";

export default function Header() {
  return (
    <div className="header-bar">
      <div className="header-left">
        <button
          className="btn-icon"
          title="Thu gọn/Mở rộng menu"
          onClick={() => {
            document.getElementById("sidebar")?.classList.toggle("collapsed");
            document.getElementById("sidebar")?.classList.toggle("open");
          }}
        >
          ☰
        </button>
        <h1 className="page-title">Bảng điều khiển</h1>
      </div>

      <div className="header-right">
        <div className="search-box">
          <input type="text" placeholder="Tìm kiếm nhanh..." />
          <span className="search-icon">🔍</span>
        </div>

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