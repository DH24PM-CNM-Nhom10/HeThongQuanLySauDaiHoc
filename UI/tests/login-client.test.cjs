const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/login-client.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function client(fetch) {
  const module = { exports: {} };
  vm.runInNewContext(`(function(exports){${code}\n})`, { fetch })(module.exports);
  return module.exports.loginAccount;
}

test('Homepage credentials route all four roles to the correct authentication API', async () => {
  for (const [username, role, endpoint] of [
    [' ADMIN ', 'admin', '/api/auth/login'],
    ['admin@agu.edu.vn', 'admin', '/api/auth/login'],
    ['phongdaotao@agu.edu.vn', 'training_office', '/api/training-office/login'],
    ['teacher@teacher.agu.edu.vn', 'teacher', '/api/teacher-auth/login'],
    ['CH259421@agu.edu.vn', 'student', '/api/student-records/login'],
    ['CH259421', 'student', '/api/student-records/login'],
  ]) {
    const login = client(async (url, options) => {
      assert.equal(url, endpoint);
      assert.equal(options.credentials, 'same-origin');
      assert.equal(JSON.parse(options.body).username, username.trim().toLowerCase());
      assert.equal(JSON.parse(options.body).password, '  KeepCase123  ');
      return Response.json({ user: { role, mustChangePassword: true } });
    });
    assert.equal((await login(username, '  KeepCase123  ')).role, role);
  }
});

test('Invalid credentials preserve the server error', async () => {
  const login = client(async () => Response.json({ message: 'Mật khẩu không đúng' }, { status: 401 }));
  await assert.rejects(login('admin', 'wrong'), /Mật khẩu không đúng/);
});

test('Network and non-JSON server failures are explained without logging in', async () => {
  await assert.rejects(client(async () => { throw new Error('offline'); })('admin', 'password'), /Không kết nối/);
  await assert.rejects(client(async () => new Response('Bad Gateway', { status: 502 }))('S001', 'password'), /3001/);
});

test('Unexpected authentication roles are rejected', async () => {
  const login = client(async () => Response.json({ user: { role: 'student' } }));
  await assert.rejects(login('admin', 'password'), /không hợp lệ/);
});
