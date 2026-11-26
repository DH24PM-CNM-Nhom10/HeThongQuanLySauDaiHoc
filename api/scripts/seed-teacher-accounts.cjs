/* Run from api/: node scripts/seed-teacher-accounts.cjs [--demo] */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const apiRoot = path.resolve(__dirname, '..');
const { nextTeacherUsername } = require(path.resolve(apiRoot, '../shared/teacher-account-username.cjs'));
const accountsPath = path.join(apiRoot, '.teacher-accounts.local.json');
const uiDbPath = path.resolve(apiRoot, '../UI/db.json');
const apiDbPath = path.join(apiRoot, 'db.json');
const isDemo = process.argv.includes('--demo');
if (isDemo && process.env.NODE_ENV === 'production') {
  console.error('Không được tạo mật khẩu demo trong môi trường production');
  process.exit(1);
}
const readJson = (file) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const uiStore = readJson(uiDbPath);
const apiStore = readJson(apiDbPath);
const teachers = uiStore.teachers?.length ? uiStore.teachers : apiStore.teachers;
if (!Array.isArray(teachers) || teachers.length === 0) {
  console.error('Không tìm thấy giảng viên. Hãy kiểm tra UI/db.json hoặc api/db.json');
  process.exit(1);
}
const old = fs.existsSync(accountsPath) ? readJson(accountsPath) : [];
if (!Array.isArray(old)) throw new Error('File tài khoản giảng viên không đúng định dạng');
const accounts = [...old];
const used = new Set(accounts.map((a) => String(a.username).toLowerCase()));
const knownIds = new Set(accounts.map((a) => String(a.teacherId)));
let created = 0;
let skippedWithoutCode = 0;
for (const teacher of teachers) {
  if (!teacher || !teacher.hoten) continue;
  const teacherId = String(teacher.shcc || teacher.id || '').trim();
  if (!teacherId) {
    skippedWithoutCode++;
    continue;
  }
  if (knownIds.has(teacherId)) continue;
  const username = nextTeacherUsername(teacher.hoten, used);
  if (!username) continue;
  const password = teacherId;
  const salt = crypto.randomBytes(16);
  const passwordHash = `scrypt$${salt.toString('hex')}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
  accounts.push({
    teacherId,
    hoTen: teacher.hoten,
    shcc: String(teacher.shcc || ''),
    username,
    passwordHash,
    mustChangePassword: false,
    sessionVersion: 0,
    active: true,
  });
  knownIds.add(teacherId);
  created++;
}
if (created) {
  fs.writeFileSync(accountsPath, JSON.stringify(accounts, null, 2), { mode: 0o600 });
}
console.log(`Giảng viên nguồn: ${teachers.length}; tài khoản đã có: ${old.length}; tạo mới: ${created}; tổng: ${accounts.length}`);
if (created) console.log('Tài khoản mới dùng mã giảng viên làm mật khẩu khởi tạo.');
if (skippedWithoutCode) console.log(`Bỏ qua ${skippedWithoutCode} giảng viên không có mã giảng viên.`);
if (!created) console.log('Không tạo lại mật khẩu của tài khoản đã tồn tại.');
if (isDemo) console.warn('CẢNH BÁO: chế độ --demo dùng mật khẩu dễ đoán, chỉ chạy cục bộ với dữ liệu giả lập.');
console.log('Không được commit file .teacher-accounts.local.json.');
