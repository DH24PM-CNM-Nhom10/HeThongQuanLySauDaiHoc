import type { CatalogEntry } from "../../shared/system-store.cjs";

export function validateStudentRecord(record: Record<string, any>, catalogs: CatalogEntry[], teachers: Record<string, any>[], previous: Record<string, any> = {}) {
  if (!catalogs.some(row => row.kind === "class" && row.code === record.lop && row.majorCode === record.maNganh)) {
    return "Lớp và mã ngành không khớp danh mục.";
  }
  const major = catalogs.find(row => row.kind === "major" && row.code === record.maNganh);
  if (!major || major.name !== record.tenNganh) return "Tên ngành không khớp mã ngành.";
  for (const [field, kind] of [["loaiChuongTrinh", "program"], ["trinhDo", "level"]]) {
    if (record[field] && !catalogs.some(row => row.kind === kind && row.code === record[field])) return "Loại chương trình hoặc trình độ không có trong danh mục.";
  }
  if (record.gioiTinh && !["Nam", "Nữ"].includes(record.gioiTinh)) return "Giới tính phải là Nam hoặc Nữ.";
  const advisorNames = new Set(teachers.map(row => String(row.hoten || row.hoTen || row.ho_ten || "")));
  for (const field of ["gvHuongDan1", "gvHuongDan2"]) {
    if (record[field] && !advisorNames.has(record[field])) return "Giảng viên hướng dẫn không có trong danh mục.";
  }
  if (record.gvHuongDan1 && record.gvHuongDan1 === record.gvHuongDan2) return "Hai giảng viên hướng dẫn phải khác nhau.";
  for (const field of ["ngayNhapHoc", "ngaySinh", "ngayTotNghiep"]) {
    const value = String(record[field] ?? "").trim();
    if (!value || value === String(previous[field] ?? "").trim()) continue;
    const date = new Date(value + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value) return "Hãy chọn ngày hợp lệ từ lịch.";
  }
  return null;
}
