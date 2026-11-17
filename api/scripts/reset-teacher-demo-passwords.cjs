/**
 * Local test data only. Usage from the project root:
 *   node api/scripts/reset-teacher-demo-passwords.cjs --confirm-local-demo
 * Resets passwords to username before @teacher.agu.edu.vn.
 * Does not change usernames, teacher IDs or roles.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const apiDir = path.resolve(__dirname, '..');
const accountsFile = path.join(apiDir, '.teacher-accounts.local.json');
if (process.env.NODE_ENV === 'production') {
  console.error('TỪ CHỐI: Không sử dụng mật khẩu demo trong môi trường production.');
  process.exit(1);
}
if (!process.argv.includes('--confirm-local-demo')) {
  console.error('Chỉ dùng trên máy thử nghiệm với dữ liệu giả.');
  console.error('Muốn tiếp tục, chạy: node scripts/reset-teacher-demo-passwords.cjs --confirm-local-demo');
  process.exit(1);
}
if (!fs.existsSync(accountsFile)) {
  console.error('Không có api/.teacher-accounts.local.json; hãy chạy seed-teacher-accounts.cjs trước.');
  process.exit(1);
}

const accounts = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
if (!Array.isArray(accounts) || accounts.length === 0) {
  throw new Error('Kho tài khoản trống hoặc sai định dạng. Không thực hiện thay đổi.');
}
const passwords = accounts.map((account, index) => {
  const username = typeof account.username === 'string' ? account.username.toLowerCase().trim() : '';
  const match = /^([a-z0-9]+)@teacher\.agu\.edu\.vn$/.exec(username);
  if (!match || typeof account.passwordHash !== 'string' || typeof account.teacherId !== 'string') {
    throw new Error(`Tài khoản số ${index + 1} không đúng định dạng. Không thay đổi dữ liệu.`);
  }
  return match[1];
});

// Sao lưu tài khoản hiện có vào file được .gitignore bỏ qua.
const backupDir = path.join(apiDir, '.teacher-auth-backups', new Date().toISOString().replace(/[.:]/g, '-'));
fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
const backupPath = path.join(backupDir, '.teacher-accounts.local.json');
fs.copyFileSync(accountsFile, backupPath);

// Hash riêng từng mật khẩu với salt ngẫu nhiên; tuyệt đối không lưu mật khẩu rõ.
const updated = accounts.map((account, index) => {
  const salt = crypto.randomBytes(16);
  const digest = crypto.scryptSync(passwords[index], salt, 64);
  return { ...account, passwordHash: `scrypt$${salt.toString('hex')}$${digest.toString('hex')}` };
});
const tempFile = `${accountsFile}.tmp`;
fs.writeFileSync(tempFile, JSON.stringify(updated, null, 2), { mode: 0o600 });
try {
  fs.renameSync(tempFile, accountsFile);
} catch (error) {
  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  console.error('Không ghi được tài khoản mới. Bản cũ vẫn có trong:', backupPath);
  throw error;
}

console.log(`Đã cập nhật mật khẩu demo cho ${updated.length} tài khoản giảng viên.`);
console.log('Mật khẩu demo = phần username trước @teacher.agu.edu.vn');
console.log('Ví dụ: tothienhien@teacher.agu.edu.vn / tothienhien');
console.log('Đã sao lưu tài khoản cũ tại:', backupPath);
console.log('LƯU Ý: teacher-credentials.local.csv cũ (nếu có) không còn đúng.');
console.warn('CHỈ DÙNG CỤC BỘ ĐỂ DEMO. Không triển khai lên website public hoặc dùng dữ liệu thật.');
