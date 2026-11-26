const aliases = {
  shcc: ["ma_giang_vien", "magiangvien", "maGV", "id"],
  hoten: ["hoTen", "ho_ten", "name", "ten_giang_vien"],
  gioitinh: ["gioiTinh", "gioi_tinh"],
  t_dvi: ["donVi", "don_vi", "khoa", "bomon"],
  t_tdcmon: ["hocVi", "hoc_vi", "trinhDo"],
  t_hham: ["hocHam", "hoc_ham"],
  t_cmdtao: ["chuyenMon", "chuyen_mon", "chuyenNganh"],
  email: ["thu_dientu"],
  sdt: ["soDienThoai", "so_dien_thoai", "dienThoai"],
};
function normalizeTeacher(record, keys = Object.keys(aliases)) {
  return Object.fromEntries(
    keys.map((key) => {
      const v = [key, ...(aliases[key] || [])]
        .map((k) => record[k])
        .find((v) => v !== null && v !== undefined && String(v).trim() !== "");
      return [key, String(v ?? "").trim()];
    }),
  );
}
module.exports = { normalizeTeacher };
