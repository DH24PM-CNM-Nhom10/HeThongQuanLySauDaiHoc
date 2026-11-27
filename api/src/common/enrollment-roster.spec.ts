import { assignmentRoster } from './enrollment-roster';
describe('Đối tượng học viên được đưa vào bảng điểm mới', () => {
  const rows = [
    'Đang học',
    'Quá hạn',
    'Đã tốt nghiệp',
    'Hoàn thành',
    'Bảo lưu',
    'Tạm dừng',
    'Xóa tên',
    'Thôi học',
  ].map((trangThai, i) => ({
    maHocVien: 'S' + i,
    hoTen: 'HV' + i,
    lop: 'L1',
    trinhDo: 'Thạc sĩ',
    trangThai,
  }));
  it('chỉ tự đưa học viên đang học/quá hạn vào roster mới', () => {
    expect(
      assignmentRoster({ classCode: 'L1' }, rows).map((s) => s.maHocVien),
    ).toEqual(['S0', 'S1']);
  });
  it('không đưa nghiên cứu sinh vào bảng điểm thạc sĩ', () => {
    const students = [
      {
        maHocVien: 'N1',
        hoTen: 'NCS',
        lop: 'NCS1',
        trinhDo: 'Tiến sĩ',
        loaiChuongTrinh: 'Chương trình tiến sĩ',
        trangThai: 'Đang học',
      },
    ];
    expect(
      assignmentRoster(
        { classCode: 'NCS1', trainingTrack: 'tien_si' },
        students,
      ),
    ).toHaveLength(0);
    expect(
      assignmentRoster(
        { classCode: 'NCS1', trainingTrack: 'nghien_cuu' },
        students,
      ),
    ).toHaveLength(0);
  });
});
