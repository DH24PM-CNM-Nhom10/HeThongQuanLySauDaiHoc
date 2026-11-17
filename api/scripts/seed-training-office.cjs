// Chạy trong thư mục api/: node scripts/seed-training-office.cjs
// Local demo: node scripts/seed-training-office.cjs --demo
// Chỉ tạo tài khoản MỚI, không ghi đè mật khẩu tài khoản đã tồn tại.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.cwd();
const accountFile = path.join(root, '.training-office-account.local.json');
const credentialsFile = path.join(root, 'training-office-credentials.local.txt');
const isDemo = process.argv.includes('--demo');
if (isDemo && process.env.NODE_ENV === 'production') {
  console.error('Không cho phép mật khẩu demo trong NODE_ENV=production.');
  process.exit(1);
}
if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'src', 'training-office', 'training-office.service.ts'))) {
  console.error('Hãy chạy trong thư mục api/ của dự án đã cài bản phân quyền Phòng đào tạo.');
  process.exit(1);
}
if (fs.existsSync(accountFile)) {
  console.log('Tài khoản Phòng đào tạo đã tồn tại. Không đổi mật khẩu.');
  console.log('Để đổi sang mật khẩu demo, chạy: node scripts/set-training-office-demo-password.cjs --confirm-local-demo');
  process.exit(0);
}
const username = 'phongdaotao@agu.edu.vn';
const password = isDemo ? username.split('@')[0] : crypto.randomBytes(18).toString('base64url');
const salt = crypto.randomBytes(16).toString('hex');
const passwordHash = 'scrypt$' + salt + '$' + crypto.scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex');
fs.writeFileSync(accountFile, JSON.stringify({ role: 'training_office', displayName: 'Phòng Đào tạo', username, passwordHash, active: true }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
if (!fs.existsSync(credentialsFile)) {
  fs.writeFileSync(credentialsFile, 'TÀI KHOẢN CHỈ DÙNG CHO DEMO CỤC BỘ - KHÔNG COMMIT\nUsername: ' + username + '\nPassword: ' + password + '\n', { flag: 'wx', mode: 0o600 });
} else {
  console.warn('Đã tạo tài khoản nhưng file credentials cũ tồn tại; không ghi đè.');
}
console.log('Đã tạo tài khoản Phòng đào tạo.');
if (isDemo) console.log('Demo password: ' + password + ' (không sử dụng public)');
else console.log('Mật khẩu ngẫu nhiên trong file training-office-credentials.local.txt nếu file mới được tạo.');
