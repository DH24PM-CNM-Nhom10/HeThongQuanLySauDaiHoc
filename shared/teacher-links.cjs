const text = value => String(value ?? '').trim().toLowerCase();
function teacherDeletionConflict(store, teacher) {
  const ids = new Set([teacher.id, teacher.shcc].map(text).filter(Boolean));
  const names = new Set([teacher.hoten, teacher.hoTen, teacher.ho_ten].map(text).filter(Boolean));
  const linked = row => ['teacherId', 'maGV', 'ma_giang_vien', 'shcc'].some(key => ids.has(text(row[key]))) ||
    ['teacherName', 'tenGV', 'gvHuongDan1', 'gvHuongDan2', 'nguoi_huong_dan_1', 'nguoi_huong_dan_2'].some(key => names.has(text(row[key])));
  for (const key of ['teachingAssignments', 'assignments', 'schedule', 'thesis', 'teacherGrades', 'gradebooks']) {
    if ((store[key] || []).some(linked)) return 'Giảng viên còn hồ sơ liên kết (' + key + '). Hãy xử lý phân công, lịch và hồ sơ hướng dẫn trước khi xóa.';
  }
  return null;
}
module.exports = { teacherDeletionConflict };
