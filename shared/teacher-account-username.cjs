const DOMAIN = '@teacher.agu.edu.vn';

function nextTeacherUsername(name, used) {
  const base = String(name ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!base) return '';

  let local = base;
  let suffix = 2;
  while (used.has(`${local}${DOMAIN}`.toLowerCase())) local = `${base}${suffix++}`;
  const username = `${local}${DOMAIN}`;
  used.add(username.toLowerCase());
  return username;
}

module.exports = { nextTeacherUsername };
