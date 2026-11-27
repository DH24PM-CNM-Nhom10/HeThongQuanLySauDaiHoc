import { TrainingOfficeService } from './training-office.service';
import { readStore } from '../common/data-store';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request } from 'express';
describe('Giới hạn phân công trong đào tạo thạc sĩ', () => {
  let root: string,
    previous: string | undefined,
    service: TrainingOfficeService;
  const req = {} as Request;
  beforeEach(() => {
    previous = process.env.QLDT_DATA_ROOT;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qldt-doctoral-'));
    fs.mkdirSync(path.join(root, 'UI/data'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'UI/data/agu_masters_curriculum.json'),
      '[]',
    );
    fs.writeFileSync(
      path.join(root, 'UI/db.json'),
      JSON.stringify({
        teachers: [{ shcc: 'T1', hoten: 'Giảng viên', t_dvi: 'Khoa' }],
        students: [
          {
            maHocVien: 'N1',
            hoTen: 'Nghiên cứu sinh',
            lop: 'NCS1',
            maNganh: 'DOC',
            tenNganh: 'Ngành tiến sĩ',
            trinhDo: 'Tiến sĩ',
            loaiChuongTrinh: 'Chương trình tiến sĩ',
            ngayNhapHoc: '2023-02-01',
            trangThai: 'Đang học',
          },
        ],
        academicPlans: [
          {
            classCode: 'NCS1',
            admissionSchoolYear: '2022-2023',
            startSemester: 2,
            durationSemesters: 8,
          },
        ],
        courses: [
          {
            code: 'DOC801',
            name: 'Chuyên đề',
            majorCode: 'DOC',
            majorName: 'Ngành tiến sĩ',
            track: 'tien_si',
            semesters: [8],
            credits: 3,
          },
        ],
      }),
    );
    process.env.QLDT_DATA_ROOT = root;
    service = new TrainingOfficeService();
    jest
      .spyOn(service, 'fromRequest')
      .mockReturnValue({
        role: 'training_office',
        username: 'office',
        hoTen: 'Phòng đào tạo',
      });
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.QLDT_DATA_ROOT;
    else process.env.QLDT_DATA_ROOT = previous;
    if (
      !path
        .resolve(root)
        .startsWith(path.resolve(os.tmpdir()) + path.sep + 'qldt-doctoral-')
    )
      throw new Error('Unsafe cleanup');
    fs.rmSync(root, { recursive: true });
  });
  it('ẩn lớp và môn tiến sĩ, giữ hồ sơ lịch sử', () => {
    expect(service.catalog(req).classes).toHaveLength(0);
    expect(readStore().students).toHaveLength(1);
  });
  it('chặn học kỳ vượt kế hoạch và chương trình không khớp', () => {
    expect(() =>
      service.publishAssignments(req, {
        confirmedOpen: true,
        assignments: [
          {
            teacherId: 'T1',
            classCode: 'NCS1',
            courseCode: 'DOC801',
            schoolYear: '2026-2027',
            semester: '2',
            trainingTrack: 'tien_si',
          },
        ],
      }),
    ).toThrow();
    expect(readStore().teachingAssignments).toHaveLength(0);
  });
});
