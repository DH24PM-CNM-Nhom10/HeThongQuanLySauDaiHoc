// Local demo only: reset an EXISTING Training Office account to a deterministic demo password.
// Run from api/: node scripts/set-training-office-demo-password.cjs --confirm-local-demo
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

if (!process.argv.includes('--confirm-local-demo')) {
  console.error('Chỉ dùng cho demo cục bộ. Hãy thêm --confirm-local-demo để xác nhận.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('Không được đặt mật khẩu demo trong NODE_ENV=production.');
  process.exit(1);
}

const root = process.cwd();
if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'src', 'training-office', 'training-office.service.ts'))) {
  console.error('Hãy chạy lệnh tại thư mục api/ của dự án đã cài bản phân quyền Phòng đào tạo.');
  process.exit(1);
}

const accountPath = path.join(root, '.training-office-account.local.json');
if (!fs.existsSync(accountPath)) {
  console.error('Chưa có tài khoản. Hãy chạy: node scripts/seed-training-office.cjs --demo');
  process.exit(1);
}

let account;
try { account = JSON.parse(fs.readFileSync(accountPath, 'utf8')); }
catch { console.error('File tài khoản không phải JSON hợp lệ; không thay đổi.'); process.exit(1); }

const username = 'phongdaotao@agu.edu.vn';
if (!account || account.username !== username || account.role !== 'training_office' || typeof account.passwordHash !== 'string') {
  console.error('Thông tin tài khoản không đúng định dạng. Không thay đổi.');
  process.exit(1);
}

const newPassword = username.split('@')[0]; // "phongdaotao", KHÔNG phải nguyên chuỗi email.
const salt = crypto.randomBytes(16).toString('hex');
const passwordHash = 'scrypt$' + salt + '$' + crypto.scryptSync(newPassword, Buffer.from(salt, 'hex'), 64).toString('hex');
const backupDir = path.join(root, '.temp', 'training-office-backups');
fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
const backupPath = path.join(backupDir, `training-office-account-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.copyFileSync(accountPath, backupPath, fs.constants.COPYFILE_EXCL);
try { fs.chmodSync(backupPath, 0o600); } catch {}

const tmp = accountPath + '.tmp';
try {
  fs.writeFileSync(tmp, JSON.stringify({ ...account, passwordHash }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  fs.renameSync(tmp, accountPath);
} catch (err) {
  try { fs.unlinkSync(tmp); } catch {}
  console.error('Không cập nhật được tài khoản:', err.message);
  process.exit(1);
}
console.log('Đã đổi mật khẩu demo Phòng đào tạo.');
console.log('Username: ' + username);
console.log('Password demo: ' + newPassword);
console.log('Sao lưu tài khoản cũ tại: ' + backupPath);
console.log('File training-office-credentials.local.txt (nếu có) chứa mật khẩu cũ, có thể xóa.');
console.log('CHỈ DEMO CỤC BỘ, không dùng mật khẩu đoán được trên website public.');
