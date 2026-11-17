/* Run from api/: node scripts/seed-teacher-accounts.cjs [--demo] */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const apiRoot = path.resolve(__dirname, '..');
const accountsPath = path.join(apiRoot, '.teacher-accounts.local.json');
const csvPath = path.join(apiRoot, 'teacher-credentials.local.csv');
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
const slugify = (s) => String(s ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLowerCase().replace(/[^a-z0-9]/g, '');
const old = fs.existsSync(accountsPath) ? readJson(accountsPath) : [];
if (!Array.isArray(old)) throw new Error('File tài khoản giảng viên không đúng định dạng');
const accounts = [...old];
const used = new Set(accounts.map((a) => String(a.username).toLowerCase()));
const knownIds = new Set(accounts.map((a) => String(a.teacherId)));
const csv = [['Họ tên','Mã SHCC','Tên đăng nhập','Mật khẩu mới']];
let created = 0;
for (const [i, teacher] of teachers.entries()) {
  if (!teacher || !teacher.hoten) continue;
  const teacherId = String(teacher.shcc || teacher.id || `teacher-${i + 1}`);
  if (knownIds.has(teacherId)) continue;
  const base = slugify(teacher.hoten);
  if (!base) continue;
  let name = base, n = 2;
  while (used.has(`${name}@teacher.agu.edu.vn`)) name = `${base}${n++}`;
  const username = `${name}@teacher.agu.edu.vn`;
  const password = isDemo ? name : crypto.randomBytes(12).toString('base64url');
  const salt = crypto.randomBytes(16);
  const passwordHash = `scrypt$${salt.toString('hex')}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
  accounts.push({ teacherId, hoTen: teacher.hoten, shcc: String(teacher.shcc || ''), username, passwordHash, active: true });
  used.add(username);
  knownIds.add(teacherId);
  csv.push([teacher.hoten, String(teacher.shcc || ''), username, password]);
  created++;
}
if (created) {
  fs.writeFileSync(accountsPath, JSON.stringify(accounts, null, 2), { mode: 0o600 });
  const esc = (s) => `"${String(s).replaceAll('"', '""')}"`;
  fs.writeFileSync(csvPath, '\ufeff' + csv.map((row) => row.map(esc).join(',')).join('\r\n'), { mode: 0o600 });
}
console.log(`Giảng viên nguồn: ${teachers.length}; tài khoản đã có: ${old.length}; tạo mới: ${created}; tổng: ${accounts.length}`);
if (created) console.log(`Đã xuất tài khoản MỚI vào: ${csvPath}`);
if (!created) console.log('Không tạo lại mật khẩu của tài khoản đã tồn tại. Nếu quên mật khẩu, cần chức năng reset có kiểm soát.');
if (isDemo) console.warn('CẢNH BÁO: chế độ --demo dùng mật khẩu dễ đoán, chỉ chạy cục bộ với dữ liệu giả lập.');
console.log('Không được commit file .teacher-accounts.local.json hay teacher-credentials.local.csv.');
