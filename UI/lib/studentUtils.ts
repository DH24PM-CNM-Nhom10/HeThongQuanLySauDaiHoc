// src/lib/studentUtils.ts

/**
 * Hàm parse ngày linh hoạt hỗ trợ nhiều định dạng:
 * - Ngày dạng DD/MM/YYYY hoặc DD-MM-YYYY
 * - Ngày dạng ISO YYYY-MM-DD
 * - Excel Serial Date (ví dụ: 44500)
 * - JS Date object / Timestamp
 */
export function parseVNStyleDate(dateInput: any): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;

  if (typeof dateInput === "number" || (!isNaN(Number(dateInput)) && String(dateInput).trim() !== "")) {
    const num = Number(dateInput);
    if (num > 30000 && num < 60000) {
      const d = new Date((num - (25567 + 2)) * 86400 * 1000);
      return isNaN(d.getTime()) || d.getFullYear() < 1990 ? null : d;
    }
    if (num > 100000000000) return new Date(num);
  }

  const str = String(dateInput).trim();
  if (!str || str === "-" || str === "null" || str === "undefined") return null;

  let day = 0, month = 0, year = 0;

  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    }
  } else if (str.includes("-")) {
    const parts = str.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        year = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        day = parseInt(parts[2], 10);
      } else {
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
      }
    }
  }

  if (day > 0 && month >= 0 && year > 0) {
    if (year < 100) year += year < 50 ? 2000 : 1900;
    const d = new Date(year, month, day);
    d.setFullYear(year);
    if (!isNaN(d.getTime()) && d.getFullYear() >= 1990) return d;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1990) {
    return parsed;
  }

  return null;
}

/**
 * Kiêm tra học viên có thuộc diện cảnh báo / quá hạn hay không.
 * Khắc phục triệt để lỗi loại trừ nhầm các trường hợp "chưa tốt nghiệp" hoặc ngày dạng DD/MM/YYYY.
 */
export function checkIsOverdue(s: any): boolean {
  if (!s) return false;

  const today = new Date().getTime();
  const tt = (s.trangThai || s.trang_thai || s.TRANG_THAI || s.status || s.STATUS || "").toString().toLowerCase().trim();
  const category = (s.category || s.CATEGORY || "").toString().toUpperCase();

  // 1. Kiểm tra Tốt nghiệp / Bảo vệ thành công
  // QUAN TRỌNG: Loại trừ cụm từ phủ định "chưa tốt nghiệp", "chưa bảo vệ", "chưa hoàn thành"
  const hasNegativeGrad =
    tt.includes("chưa tốt nghiệp") ||
    tt.includes("chưa bảo vệ") ||
    tt.includes("chưa hoàn thành") ||
    tt.includes("chưa xong");

  const isGraduated = !hasNegativeGrad && (
    category === "GRADUATED" ||
    tt.includes("đã tốt nghiệp") ||
    tt.includes("đã bảo vệ") ||
    tt.includes("đã hoàn thành") ||
    tt === "tốt nghiệp" ||
    tt === "bảo vệ" ||
    s.daBaoVe === true ||
    s.da_bao_ve === true ||
    (s.ngayTotNghiep && s.ngayTotNghiep !== "-" && s.ngayTotNghiep !== "null") ||
    (s.ngay_tot_nghiep && s.ngay_tot_nghiep !== "-" && s.ngay_tot_nghiep !== "null") ||
    (s.ngayBaoVe && s.ngayBaoVe !== "-" && s.ngayBaoVe !== "null") ||
    (s.ngay_bao_ve && s.ngay_bao_ve !== "-" && s.ngay_bao_ve !== "null")
  );

  if (isGraduated) return false;

  // 2. Kiểm tra cờ trạng thái cảnh báo / cảnh cáo / quá hạn
  if (
    category === "OVERDUE" ||
    category === "CANH_BAO" ||
    category === "CANH_CAO" ||
    category === "WARNING" ||
    s.isOverdue === true ||
    s.is_overdue === true ||
    tt.includes("quá hạn") ||
    tt.includes("quá thời hạn") ||
    tt.includes("cảnh báo") ||
    tt.includes("cảnh cáo") ||
    tt.includes("chậm tiến độ")
  ) {
    return true;
  }

  // 3. Kiểm tra số ngày quá hạn
  const daysOverdue = s.daysOverdue ?? s.days_overdue ?? s.soNgayQuaHan ?? s.so_ngay_qua_han;
  if (daysOverdue !== undefined && daysOverdue !== null && Number(daysOverdue) > 0) {
    return true;
  }

  // 4. Kiểm tra ngày hết hạn so với thời điểm hiện tại (sử dụng parseVNStyleDate)
  const ngayHetHanVal =
    s.ngayHetHan ||
    s.ngay_het_han ||
    s.ngay_het_han_dt ||
    s.NGAY_HET_HAN_DT ||
    s.NGAY_HET_HAN ||
    s.hanGoc ||
    s.han_goc ||
    s.HAN_GOC ||
    s.thoiHanDaoTao ||
    s.thoi_han_dao_tao;

  const parsedDueDate = parseVNStyleDate(ngayHetHanVal);
  if (parsedDueDate) {
    if (parsedDueDate.getTime() < today) {
      return true;
    }
  }

  return false;
}