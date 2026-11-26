const { studentStatus } = require('./student-status.cjs');
const text = value => String(value ?? '').trim();
const CONTACT_FIELDS = ['email', 'soDienThoai', 'diaChi', 'donViCongTac', 'noiSinh'];
function studentCohort(row) {
  const saved = text(row.khoaHoc || row.khoa_hoc || row.namTuyenSinh || row.nam_tuyen_sinh);
  if (saved) return saved;
  const admission = text(row.ngayNhapHoc || row.ngay_nhap_hoc);
  if (/^(19|20)\d{2}(?:-|$)/.test(admission)) return admission.slice(0, 4);
  if (/^\d{5}$/.test(admission)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(admission) * 86400000);
    return String(date.getUTCFullYear());
  }
  const vn = /\/(\d{4})$/.exec(admission);
  return vn ? vn[1] : '';
}
function filterStudents(rows, filters = {}) {
  const search = text(filters.search).toLocaleLowerCase('vi');
  return rows.filter(row => {
    const major = text(row.maNganh || row.ma_nganh), name = text(row.tenNganh || row.ten_nganh);
    const cls = text(row.lop || row.LOP);
    return (!filters.major || filters.major === major || filters.major === name) &&
      (!filters.cohort || studentCohort(row) === filters.cohort) &&
      (!filters.classCode || cls === filters.classCode) &&
      (!filters.status || filters.status === 'ALL' || studentStatus(row) === filters.status) &&
      (!search || [row.hoTen, row.ho_ten, row.maHocVien, row.ma_hoc_vien, row.MA_HOC_VIEN, cls, row.email, row.cccd]
        .some(value => text(value).toLocaleLowerCase('vi').includes(search)));
  });
}
function validateContact(record, previous = {}) {
  for (const key of CONTACT_FIELDS) {
    const value = text(record[key]);
    if (value === text(previous[key])) continue;
    if (value.length > (key === 'diaChi' ? 1000 : 255)) return 'Thông tin liên hệ quá dài.';
    if (key === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Email không hợp lệ.';
    if (key === 'soDienThoai' && value && !/^[+\d().\s-]{7,25}$/.test(value)) return 'Số điện thoại không hợp lệ.';
  }
  return null;
}
function expectedGraduation(admission, months) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(admission) || !Number.isInteger(Number(months)) || Number(months) < 1) return '';
  const date = new Date(admission + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== admission) return '';
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + Number(months) + 1, 0));
  end.setUTCDate(Math.min(date.getUTCDate(), end.getUTCDate()));
  return end.toISOString().slice(0, 10);
}
module.exports = { CONTACT_FIELDS, studentCohort, filterStudents, validateContact, expectedGraduation };
