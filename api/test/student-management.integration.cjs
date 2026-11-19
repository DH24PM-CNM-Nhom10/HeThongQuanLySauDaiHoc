const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const workspace = path.resolve(__dirname, "../..");
const fromUI = require("node:module").createRequire(path.join(workspace, "UI/package.json"));
const ts = fromUI("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename,
);
const root = fs.mkdtempSync(path.join(os.tmpdir(), "qldt-student-api-"));
fs.mkdirSync(path.join(root, "UI"));
fs.writeFileSync(path.join(root, "UI/db.json"), JSON.stringify({
  students: [{ maHocVien: "S1", hoTen: "Có sẵn", lop: "L1", maNganh: "M1", tenNganh: "Ngành",
    trangThai: "Đang học", loaiChuongTrinh: "Ứng dụng", trinhDo: "Thạc sĩ", gioiTinh: "Nam" }],
  teachers: [{ hoten: "Giảng viên" }],
}));
process.env.QLDT_DATA_ROOT = root;
process.env.NODE_ENV = "test";
process.env.AGU_SESSION_SECRET = "fixture-session-secret-at-least-32-characters";
process.env.AGU_ADMIN_USERNAME = "admin";
const salt = crypto.randomBytes(16);
process.env.AGU_ADMIN_PASSWORD_HASH = "scrypt:" + salt.toString("hex") + ":" +
  crypto.scryptSync("fixture-password", salt, 64).toString("hex");

const { NextRequest } = fromUI("next/server");
const auth = require(path.join(workspace, "UI/app/api/auth/login/route.ts"));
const crud = require(path.join(workspace, "UI/app/api/[entity]/route.ts"));
const upload = require(path.join(workspace, "UI/app/api/upload/route.ts"));
const catalogs = require(path.join(workspace, "UI/app/api/catalogs/route.ts"));
const params = { params: Promise.resolve({ entity: "students" }) };
let cookie = "";
function request(method, body, query = "", authenticated = true) {
  return new NextRequest("http://localhost/api/students" + query, {
    method, headers: { ...(authenticated ? { cookie } : {}), "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function run() {
  assert.equal((await crud.GET(request("GET", null, "", false), params)).status, 403);
  assert.equal((await auth.POST(request("POST", { username: "admin", password: "wrong" }))).status, 401);
  const loggedIn = await auth.POST(request("POST", { username: "admin", password: "fixture-password" }));
  assert.equal(loggedIn.status, 200);
  for (const username of ["admin@agu.edu.vn", "admin@student.agu.edu.vn"]) {
    assert.equal((await auth.POST(request("POST", { username, password: "fixture-password" }))).status, 200);
  }
  cookie = loggedIn.headers.get("set-cookie").split(";")[0];
  assert.equal((await crud.GET(request("GET"), params)).status, 200);
  const invalid = { maHocVien: "S2", hoTen: "Mới", lop: "L2", maNganh: "M1", tenNganh: "Ngành" };
  assert.equal((await crud.POST(request("POST", invalid), params)).status, 400);
  assert.equal((await catalogs.POST(request("POST", { kind: "class", code: "L2", majorCode: "M1" }))).status, 200);
  assert.equal((await crud.POST(request("POST", invalid), params)).status, 200);
  assert.equal((await crud.POST(request("POST", invalid), params)).status, 409);
  assert.equal((await crud.PUT(request("PUT", { maHocVien: "S2", ngaySinh: "2026-02-31" }), params)).status, 400);
  assert.equal((await crud.PUT(request("PUT", { maHocVien: "S2", trangThai: "Bảo lưu" }), params)).status, 200);

  const xlsx = fromUI("xlsx");
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.aoa_to_sheet([
    ["Mã học viên", "Họ tên", "Lớp", "Mã ngành", "Tên ngành"],
    ["S1", "Tên không ghi đè", "L1", "M1", "Ngành"],
    ["S3", "Nhập Excel", "L1", "M1", "Ngành"],
  ]), "HOCVIEN");
  const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
  async function importFile() {
    const form = new FormData();
    form.set("file", new Blob([buffer]), "students.xlsx");
    form.set("entityKey", "students"); form.set("sheetName", "HOCVIEN"); form.set("headerIndex", "0");
    form.set("mapping", JSON.stringify({ maHocVien: 0, hoTen: 1, lop: 2, maNganh: 3, tenNganh: 4 }));
    return (await upload.POST(new NextRequest("http://localhost/api/upload", { method: "POST", headers: { cookie }, body: form }))).json();
  }
  const first = await importFile();
  assert.equal(first.added, 1); assert.equal(first.duplicates, 1);
  const second = await importFile();
  assert.equal(second.added, 0); assert.equal(second.duplicates, 2);
  assert.equal(second.data.find(row => row.maHocVien === "S1").hoTen, "Có sẵn");
  assert.equal((await crud.DELETE(request("DELETE", null, "?id=S2"), params)).status, 200);
  console.log("Admin auth, API permissions, catalogs, CRUD, dates, and duplicate Excel import passed.");
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  fs.unlinkSync(path.join(root, "UI/db.json"));
  fs.rmdirSync(path.join(root, "UI"));
  fs.rmdirSync(root);
});
