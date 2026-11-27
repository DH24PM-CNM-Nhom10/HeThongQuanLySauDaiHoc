const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function projectRoot() {
  if (process.env.QLDT_DATA_ROOT) return process.env.QLDT_DATA_ROOT;
  const root = [path.resolve(__dirname, ".."), process.cwd(), path.resolve(process.cwd(), "..")]
    .find(directory => fs.existsSync(path.join(directory, "UI", "package.json")));
  if (!root) throw new Error("Không xác định được thư mục dữ liệu hệ thống.");
  return root;
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function normalize(value) {
  return String(value ?? "").trim().normalize("NFC");
}

function studentCode(row) {
  return normalize(row.maHocVien || row.ma_hoc_vien || row.MA_HOC_VIEN || row.mahv).toUpperCase();
}

const { studentStatus } = require("./student-status.cjs");
const { studentCohort } = require("./student-profile.cjs");

function catalogFromStudents(students, saved = []) {
  const entries = new Map(saved.map(row => [row.id, row]));
  for (const row of students) {
    const code = normalize(row.maNganh || row.ma_nganh || row.MA_NGANH);
    const name = normalize(row.tenNganh || row.ten_nganh || row.TEN_NGANH);
    const classCode = normalize(row.lop || row.LOP);
    if (code && name && !entries.has("major:" + code)) {
      entries.set("major:" + code, { id: "major:" + code, kind: "major", code, name });
    }
    if (classCode && code && !entries.has("class:" + classCode + ":" + code)) {
      entries.set("class:" + classCode + ":" + code, {
        id: "class:" + classCode + ":" + code, kind: "class", code: classCode, majorCode: code,
      });
    }
    for (const [field, kind] of [["loaiChuongTrinh", "program"], ["trinhDo", "level"]]) {
      const value = normalize(row[field]);
      if (value) entries.set(kind + ":" + value, { id: kind + ":" + value, kind, code: value, name: value });
    }
    const cohort = studentCohort(row);
    if (cohort) entries.set('cohort:' + cohort, { id: 'cohort:' + cohort, kind: 'cohort', code: cohort, name: cohort });
    const mode = normalize(row.hinhThucDaoTao);
    if (mode) entries.set('study_mode:' + mode, { id: 'study_mode:' + mode, kind: 'study_mode', code: mode, name: mode });
  }
  return [...entries.values()];
}

const versions = new WeakMap();
function dataFile() { return path.join(projectRoot(), "UI", "db.json"); }
function fingerprint(raw) { return crypto.createHash("sha256").update(raw).digest("hex"); }

function readStore() {
  const file = dataFile();
  const raw = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "{}";
  const store = JSON.parse(raw.replace(/^\uFEFF/, ""));
  if (!store || typeof store !== "object" || Array.isArray(store)) throw new Error("Kho dữ liệu không hợp lệ");
  for (const [key, value] of Object.entries(store)) {
    if (!Array.isArray(value)) throw new Error("Nhóm dữ liệu không hợp lệ: " + key);
  }
  // Chỉ lấy các nhóm dữ liệu chưa có trong kho chính. Các file cũ được giữ để đối chiếu.
  const legacy = readJson(path.join(projectRoot(), "api", "db.json"), {});
  for (const key of ["teachers", "thesis", "schedule", "grades", "assignments"]) {
    if (!Array.isArray(store[key])) store[key] = legacy[key] || [];
  }
  store.students ??= [];
  store.teachingAssignments ??= readJson(path.join(projectRoot(), "api", ".training-assignments.local.json"), []);
  store.teacherGrades ??= readJson(path.join(projectRoot(), "api", ".teacher-grades.local.json"), []);
  store.gradebooks ??= [];
  store.gradeHistory ??= [];
  store.studentHistory ??= [];
  store.studentDocuments ??= [];
  store.documentHistory ??= [];
  for (const key of ["academicTerms", "courses", "assignmentHistory", "teacherHistory", "scheduleHistory", "academicPolicies", "academicPlans", "academicHistory", "thesisWorkflows", "thesisHistory", "noticeAttachments"]) store[key] ??= [];
  store.catalogs = catalogFromStudents(store.students, store.catalogs || []);
  versions.set(store, fingerprint(raw));
  return store;
}

function saveStore(store) {
  const file = dataFile();
  const lock = file + ".lock";
  try { fs.mkdirSync(lock); }
  catch { throw new Error("Dữ liệu đang được cập nhật. Vui lòng thử lại."); }
  const temporary = file + "." + crypto.randomUUID() + ".tmp";
  try {
    const raw = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "{}";
    if (versions.has(store) && versions.get(store) !== fingerprint(raw)) {
      throw new Error("Dữ liệu đã thay đổi. Vui lòng tải lại trước khi lưu.");
    }
    store.catalogs = catalogFromStudents(store.students || [], store.catalogs || []);
    fs.writeFileSync(temporary, JSON.stringify(store, null, 2), "utf8");
    fs.renameSync(temporary, file);
    versions.set(store, fingerprint(fs.readFileSync(file, "utf8")));
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.rmdirSync(lock);
  }
}

module.exports = { projectRoot, readStore, saveStore, normalize, studentCode, studentStatus, catalogFromStudents };
