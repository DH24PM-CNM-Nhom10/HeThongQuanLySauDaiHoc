// Creates only missing database/table objects. Existing notice rows are preserved.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

async function main() {
  const root = path.resolve(__dirname, '../..');
  const read = file => fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
  const env = { ...read(path.join(root, 'UI/.env.local')), ...read(path.join(root, 'api/.env')), ...process.env };
  if (!env.DB_HOST || !env.DB_USER || !/^[a-zA-Z0-9_]+$/.test(env.DB_NAME || '')) {
    throw new Error('Cần cấu hình DB_HOST, DB_USER và DB_NAME hợp lệ.');
  }
  const db = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306), user: env.DB_USER,
    password: env.DB_PASSWORD || '', connectTimeout: 10000,
  });
  try {
    await db.query(`CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await db.changeUser({ database: env.DB_NAME });
    const schema = fs.readFileSync(path.join(root, 'database/mysql/DB_QuanLyDaoTaoSauDaiHoc_v1.sql'), 'utf8');
    const statement = schema.match(/CREATE TABLE IF NOT EXISTS `thong_bao`\s*\([\s\S]*?;/)?.[0];
    if (!statement) throw new Error('Không tìm thấy cấu trúc bảng thong_bao trong SQL của dự án.');
    await db.query(statement);
    console.log('Cơ sở dữ liệu và bảng thông báo đã sẵn sàng. Dữ liệu cũ được giữ nguyên.');
  } finally { await db.end(); }
}
main().catch(error => { console.error(error.code || '', error.message); process.exitCode = 1; });
