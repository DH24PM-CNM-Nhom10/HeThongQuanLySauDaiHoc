const normalize = value => String(value ?? "").trim().normalize("NFC");
function studentStatus(row) {
  const value = normalize(row.trangThai || row.trang_thai || row.TRANG_THAI || row.status).toLowerCase();
  const states = {
    "đang học": "studying", "đã tốt nghiệp": "graduated", "tốt nghiệp": "graduated",
    "hoàn thành": "completed", "đã hoàn thành": "completed",
    "quá hạn": "overdue", "quá thời hạn": "overdue", "bảo lưu": "reserved",
    "tạm dừng": "paused", "tạm ngừng": "paused", "thôi học": "left", "bỏ học": "left",
    "xóa tên": "withdrawn", "xoá tên": "withdrawn",
  };
  if (states[value]) return states[value];
  if (value) return "other";
  if (String(row.category || "").toUpperCase() === "GRADUATED") return "graduated";
  return "other";
}

module.exports = { studentStatus };
