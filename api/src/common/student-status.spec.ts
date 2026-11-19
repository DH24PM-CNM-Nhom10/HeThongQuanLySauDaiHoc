import { studentStatus } from './data-store';
describe('Phân loại trạng thái học viên', () => {
  it.each([
    ['Bảo lưu', 'reserved'], ['Tạm dừng', 'paused'], ['Thôi học', 'left'],
    ['Xóa tên', 'withdrawn'], ['Đã tốt nghiệp', 'graduated'], ['Đang học', 'studying'],
    ['Quá hạn', 'overdue'], ['Hoàn thành', 'completed'], ['Chưa tốt nghiệp', 'other'],
    ['Chưa bảo vệ', 'other'], ['Đã bảo vệ', 'other'],
  ])('%s được phân loại là %s', (status, expected) => {
    expect(studentStatus({ trangThai: status, ngayBaoVe: '2026-11-18' })).toBe(expected);
  });
});
