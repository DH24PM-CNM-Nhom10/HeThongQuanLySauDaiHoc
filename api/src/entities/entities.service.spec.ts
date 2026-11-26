import { ConflictException, NotFoundException } from '@nestjs/common';
import { EntitiesService } from './entities.service';
import { StoreService } from '../store/store.service';

describe('Bảo vệ xóa giảng viên', () => {
  function fixture(extra: Record<string, unknown[]> = {}) {
    const store = { teachers: [{ id: 'T1', shcc: 'GV001', hoten: 'Giảng viên' }], ...extra };
    const save = jest.fn();
    const service = new EntitiesService({ getStore: () => store, saveStoreToFile: save } as unknown as StoreService);
    return { service, store, save };
  }
  it.each(['teachingAssignments', 'assignments', 'schedule', 'teacherGrades', 'gradebooks'])(
    'chặn xóa khi có %s liên kết', key => {
      const { service, store, save } = fixture({ [key]: [{ teacherId: 'GV001' }] });
      expect(() => service.delete('teachers', 'GV001')).toThrow(ConflictException);
      expect(store.teachers).toHaveLength(1);
      expect(save).not.toHaveBeenCalled();
    },
  );
  it('chặn xóa giảng viên đang hướng dẫn luận văn', () => {
    expect(() => fixture({ thesis: [{ gvHuongDan1: 'Giảng viên' }] }).service.delete('teachers', 'T1')).toThrow(ConflictException);
  });
  it('cho phép xóa hồ sơ không có liên kết và báo lỗi mã không tồn tại', () => {
    const { service, store, save } = fixture();
    expect(() => service.delete('teachers', 'missing')).toThrow(NotFoundException);
    service.delete('teachers', 'GV001');
    expect(store.teachers).toEqual([]);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
