"use client";

import { useEffect, useState } from "react";
import { DB } from "@/lib/db";

function formatDate(val: any) {
  if (!val) return "—";
  if (typeof val === "number") {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toLocaleDateString("vi-VN");
  }
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.split("T")[0].split("-");
    return `${d}/${m}/${y}`;
  }
  return s;
}

function calculateRemainingDays(student: any) {
  if (!student.ngayNhapHoc) return "—";
  const start = new Date(student.ngayNhapHoc);
  if (isNaN(start.getTime())) return "—";
  const end = new Date(start);
  end.setMonth(end.getMonth() + 24);
  const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(days, 0);
}

function calculateExpectedGraduation(student: any) {
  if (!student.ngayNhapHoc) return "—";
  const start = new Date(student.ngayNhapHoc);
  if (isNaN(start.getTime())) return "—";
  const end = new Date(start);
  end.setMonth(end.getMonth() + 24);
  return end.toLocaleDateString("vi-VN");
}

function calculateTrainingProgress(student: any) {
  if (!student.ngayNhapHoc) return 0;
  const start = new Date(student.ngayNhapHoc);
  if (isNaN(start.getTime())) return 0;
  const end = new Date(start);
  end.setMonth(end.getMonth() + 24);
  const total = end.getTime() - start.getTime();
  const used = Date.now() - start.getTime();
  return Math.min(Math.max(Math.round((used / total) * 100), 0), 100);
}

export default function StudentProfile() {
  const [student, setStudent] = useState<any>(null);

  useEffect(() => {
    // Demo: lấy học viên đầu tiên
    const list = DB.get("students");
    setStudent(list[0] || null);
  }, []);

  if (!student) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="icon">📭</div>
          <p>Không tìm thấy hồ sơ học viên.</p>
          <p style={{ marginTop: 8 }}>Hãy upload dữ liệu học viên trước.</p>
        </div>
      </div>
    );
  }

  const progress = calculateTrainingProgress(student);

  return (
    <div className="student-profile">
      <div className="student-profile-header">
        <div>
          <h1>{student.hoTen || "Chưa cập nhật"}</h1>
          <div className="student-subtitle">
            Mã học viên <strong>{student.maHocVien || "—"}</strong>
            <span>•</span>
            {student.trinhDo || "—"}
            <span>•</span>
            {student.tenNganh || "—"}
          </div>
        </div>
        <div className="student-status">
          <span className="status-dot"></span>
          {student.trangThai || "—"}
        </div>
      </div>

      <div className="training-warning">
        <div className="warning-title">⚠ CẢNH BÁO TIẾN ĐỘ ĐÀO TẠO</div>
        <div className="training-info">
          <div className="days-box">
            <div className="days-number">{calculateRemainingDays(student)}</div>
            <div className="days-label">ngày</div>
            <div className="days-description">còn lại đến hạn tốt nghiệp</div>
          </div>
          <div className="training-detail">
            <div className="date-info">
              <div>
                <span>Ngày nhập học</span>
                <strong>{formatDate(student.ngayNhapHoc)}</strong>
              </div>
              <div>
                <span>Thời hạn đào tạo dự kiến</span>
                <strong>{calculateExpectedGraduation(student)}</strong>
              </div>
            </div>
            <div className="progress-track">
              <div
                className="progress-bar"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="progress-label">
              {progress}% thời gian đã sử dụng
            </div>
          </div>
        </div>
        <div className="training-alert">
          ⚠️ Vui lòng hoàn thành chương trình đúng thời hạn.
        </div>
      </div>

      <div className="student-info-grid">
        <div className="profile-card">
          <div className="profile-card-title">Thông tin học viên</div>
          <div className="profile-row">
            <span>Họ và tên</span>
            <strong>{student.hoTen || "—"}</strong>
          </div>
          <div className="profile-row">
            <span>Mã học viên</span>
            <strong>{student.maHocVien || "—"}</strong>
          </div>
          <div className="profile-row">
            <span>Ngày sinh</span>
            <strong>{formatDate(student.ngaySinh)}</strong>
          </div>
          <div className="profile-row">
            <span>Giới tính</span>
            <strong>{student.gioiTinh || "—"}</strong>
          </div>
          <div className="profile-row">
            <span>Email</span>
            <strong>{student.email || "—"}</strong>
          </div>
        </div>

        <div className="profile-card">
          <div className="profile-card-title">Thông tin đào tạo</div>
          <div className="profile-row">
            <span>Ngành</span>
            <strong>{student.tenNganh || "—"}</strong>
          </div>
          <div className="profile-row">
            <span>Trình độ</span>
            <strong>{student.trinhDo || "—"}</strong>
          </div>
          <div className="profile-row">
            <span>Lớp</span>
            <strong>{student.lop || "—"}</strong>
          </div>
          <div className="profile-row">
            <span>Ngày nhập học</span>
            <strong>{formatDate(student.ngayNhapHoc)}</strong>
          </div>
          <div className="profile-row">
            <span>Trạng thái</span>
            <strong className="status-text">{student.trangThai || "—"}</strong>
          </div>
        </div>
      </div>

      <div className="profile-card thesis-profile-card">
        <div className="profile-card-title">Thông tin luận văn</div>
        <div className="profile-row">
          <span>Tên luận văn</span>
          <strong>{student.tenLuanVan || "Chưa cập nhật"}</strong>
        </div>
        <div className="profile-row">
          <span>Giảng viên hướng dẫn</span>
          <strong>{student.gvHuongDan || "Chưa cập nhật"}</strong>
        </div>
      </div>
    </div>
  );
}
