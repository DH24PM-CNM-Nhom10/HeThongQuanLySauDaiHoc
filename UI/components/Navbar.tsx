"use client";

export default function Navbar() {
  return (
    <nav className="navbar navbar-expand navbar-light navbar-bg">
      <a className="sidebar-toggle js-sidebar-toggle">
        <i className="hamburger align-self-center"></i>
      </a>

      <div className="navbar-collapse collapse">
        <ul className="navbar-nav navbar-align">
          <li className="nav-item dropdown">
            <a
              className="nav-link dropdown-toggle d-none d-sm-inline-block"
              href="#"
              data-bs-toggle="dropdown"
            >
              <img
                src="/img/avatars/avatar.jpg"
                className="avatar img-fluid rounded me-1"
                alt="Charles Hall"
              />
              <span className="text-dark">Charles Hall</span>
            </a>
            <div className="dropdown-menu dropdown-menu-end">
              <a className="dropdown-item" href="#">
                Hệ Thống
              </a>
              <div className="dropdown-divider"></div>
              <a className="dropdown-item" href="#">
                Settings & Privacy
              </a>
              <a className="dropdown-item" href="#">
                Help Center
              </a>
              <div className="dropdown-divider"></div>
              <a className="dropdown-item" href="#">
                Log out
              </a>
            </div>
          </li>
        </ul>
      </div>
    </nav>
  );
}
