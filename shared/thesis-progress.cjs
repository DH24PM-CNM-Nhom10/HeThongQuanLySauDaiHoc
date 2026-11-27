const { studentStatus } = require("./student-status.cjs");
const FIELDS = [
  "tenLuanVan",
  "gvHuongDan1",
  "gvHuongDan2",
  "ngayQD",
  "trangThaiLv",
  "ngayBaoVe",
  "ngayTotNghiep",
  "ngayHetHan",
];
const ALIASES = {
  tenLuanVan: ["ten_luan_van", "TEN_LUAN_VAN", "tenDeAn"],
  gvHuongDan1: ["gvHuongDan", "nguoi_huong_dan_1", "NGUOI_HUONG_DAN_1"],
  gvHuongDan2: ["nguoi_huong_dan_2"],
  ngayQD: ["ngay_qd"],
  trangThaiLv: ["trang_thai_lv"],
  ngayBaoVe: ["ngay_bao_ve", "NGAY_BAO_VE"],
  ngayTotNghiep: ["ngay_tot_nghiep", "NGAY_TOT_NGHIEP"],
  ngayHetHan: ["ngay_het_han_dt", "NGAY_HET_HAN_DT", "hanGoc"],
};
function text(value) {
  const s = String(value ?? "").trim();
  return ["-", "—", "null", "undefined"].includes(s) ? "" : s;
}
function value(row, key) {
  return text(
    row[key] ?? (ALIASES[key] || []).map((k) => row[k]).find((v) => v != null),
  );
}
function dateISO(value) {
  let s = text(value);
  if (!s) return "";
  if (/^\d+(\.\d+)?$/.test(s) && +s > 30000 && +s < 100000)
    return new Date((Math.floor(+s) - 25569) * 86400000)
      .toISOString()
      .slice(0, 10);
  const vn = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (vn) s = `${vn[3]}-${vn[2].padStart(2, "0")}-${vn[1].padStart(2, "0")}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const d = new Date(s + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s
    ? s
    : "";
}
function thesisValues(row) {
  return Object.fromEntries(FIELDS.map((k) => [k, value(row, k)]));
}
function thesisRow(
  row,
  today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  }),
) {
  const fields = thesisValues(row),
    state = studentStatus(row),
    title = fields.tenLuanVan;
  const hasTitle = !!title && !/^chưa đăng ký(?: đề tài)?$/i.test(title);
  const status = fields.trangThaiLv.toLowerCase();
  let stage = !hasTitle ? "unregistered" : "working";
  if (/chờ bảo vệ|đủ điều kiện bảo vệ/.test(status)) stage = "ready";
  if (["đã bảo vệ", "bảo vệ thành công"].includes(status)) stage = "defended";
  if (
    state === "graduated" ||
    state === "completed" ||
    ["hoàn thành", "đã hoàn thành"].includes(status)
  )
    stage = "completed";
  const inactive = ["withdrawn", "left", "paused", "reserved"].includes(state);
  const deadline = dateISO(fields.ngayHetHan),
    finished = stage === "completed";
  const overdue =
    !finished &&
    !inactive &&
    (state === "overdue" || (!!deadline && deadline < today));
  return {
    code: text(row.maHocVien || row.ma_hoc_vien || row.MA_HOC_VIEN || row.id),
    name: text(row.hoTen || row.ho_ten || row.HO_TEN || row.name),
    classCode: text(row.lop || row.LOP || row.class),
    major: text(row.tenNganh || row.ten_nganh || row.major),
    fields,
    hasTitle,
    stage,
    inactive,
    deadline,
    overdue,
    daysOverdue:
      overdue && deadline && deadline < today
        ? Math.floor((Date.parse(today) - Date.parse(deadline)) / 86400000)
        : null,
  };
}
module.exports = { FIELDS, dateISO, thesisValues, thesisRow };
