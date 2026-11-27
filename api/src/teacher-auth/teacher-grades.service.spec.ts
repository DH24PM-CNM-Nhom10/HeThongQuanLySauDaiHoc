import { TeacherGradesService } from './teacher-grades.service';
import { TeacherAuthService } from './teacher-auth.service';
import { TrainingOfficeService } from '../training-office/training-office.service';
import { readStore, saveStore } from '../common/data-store';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Request } from 'express';
describe('Lưu điểm trực tiếp và trọng số từng môn', () => {
  let root: string,
    previous: string | undefined,
    service: TeacherGradesService,
    teacherId: string;
  const req = {} as Request,
    id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  beforeEach(() => {
    previous = process.env.QLDT_DATA_ROOT;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'qldt-direct-grade-'));
    fs.mkdirSync(path.join(root, 'UI'));
    process.env.QLDT_DATA_ROOT = root;
    teacherId = 'T1';
    fs.writeFileSync(
      path.join(root, 'UI/db.json'),
      JSON.stringify({
        students: [
          {
            maHocVien: 'S1',
            hoTen: 'Học viên',
            lop: 'L1',
            trinhDo: 'Thạc sĩ',
            trangThai: 'Đang học',
          },
        ],
        academicPolicies: [
          {
            id: 'P1',
            name: 'Thang GPA',
            passScore: 5,
            thresholds: [
              { min: 8, letter: 'A', gpa: 4 },
              { min: 5, letter: 'C', gpa: 2 },
              { min: 0, letter: 'F', gpa: 0 },
            ],
          },
        ],
        courses: [
          {
            code: 'C1',
            name: 'Môn 1',
            revision: 1,
            credits: 3,
            gpaWeight: 3,
            processWeight: 0.3,
            examWeight: 0.7,
            policyId: 'P1',
          },
          {
            code: 'C2',
            name: 'Môn 2',
            revision: 1,
            credits: 2,
            gpaWeight: 1,
            processWeight: 0.5,
            examWeight: 0.5,
            policyId: 'P1',
          },
        ],
        teachingAssignments: [
          {
            id,
            teacherId: 'T1',
            courseCode: 'C1',
            classCode: 'L1',
            schoolYear: '2026-2027',
            semester: '1',
          },
          {
            id: 'A2',
            teacherId: 'T1',
            courseCode: 'C2',
            classCode: 'L1',
            schoolYear: '2026-2027',
            semester: '1',
          },
        ],
      }),
    );
    service = new TeacherGradesService(
      { fromRequest: () => ({ teacherId }) } as unknown as TeacherAuthService,
      {
        allSavedAssignments: () => readStore().teachingAssignments,
      } as unknown as TrainingOfficeService,
    );
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.QLDT_DATA_ROOT;
    else process.env.QLDT_DATA_ROOT = previous;
    fs.unlinkSync(path.join(root, 'UI/db.json'));
    fs.rmdirSync(path.join(root, 'UI'));
    fs.rmdirSync(root);
  });
  function save(
    assignment = id,
    processScore: number | null = 8,
    examScore: number | null = 9,
  ) {
    const b = service.getGradebook(req, assignment);
    return service.saveGradebook(req, assignment, {
      revision: b.revision,
      scores: [{ maHocVien: 'S1', processScore, examScore }],
    });
  }
  it('hiển thị ngay điểm đã lưu, mỗi môn dùng trọng số riêng', () => {
    service.getGradebook(req, id);
    expect(service.transcriptForStudent('S1')[0].totalScore).toBeNull();
    save();
    save('A2');
    const transcript = service.transcriptForStudent('S1');
    expect(transcript.find((t) => t.courseCode === 'C1')?.totalScore).toBe(8.7);
    expect(transcript.find((t) => t.courseCode === 'C2')?.totalScore).toBe(8.5);
    expect(readStore().gradeHistory.map((r) => r.action)).toEqual([
      'save',
      'save',
    ]);
  });
  it('bảng cũ chờ duyệt/đã công bố vẫn được sửa trực tiếp, giữ lịch sử', () => {
    save();
    const s = readStore();
    s.gradebooks[0].status = 'published';
    s.gradebooks[0].publishedScores = JSON.parse(
      JSON.stringify(s.gradebooks[0].scores),
    );
    saveStore(s);
    save(id, 2, 4);
    expect(service.transcriptForStudent('S1')[0].totalScore).toBe(3.4);
    expect(readStore().gradebooks[0].publishedScores[0].totalScore).toBe(8.7);
  });
  it('chặn ghi bản cũ và sửa điểm lớp của giảng viên khác', () => {
    save();
    expect(() =>
      service.saveGradebook(req, id, { revision: 0, scores: [] }),
    ).toThrow(ConflictException);
    teacherId = 'T2';
    expect(() => service.getGradebook(req, id)).toThrow(NotFoundException);
  });
  it('bổ sung học viên không cần mở khóa, giữ điểm và học viên chuyển lớp', () => {
    save();
    const s = readStore();
    s.students[0].lop = 'L2';
    s.students.push({
      maHocVien: 'S2',
      hoTen: 'HV mới',
      lop: 'L1',
      trinhDo: 'Thạc sĩ',
      trangThai: 'Đang học',
    });
    saveStore(s);
    const b = service.getGradebook(req, id);
    const result = service.syncForTeacher(req, id, b.revision);
    expect(result.added).toBe(1);
    expect(
      service.getGradebook(req, id).students.map((s) => s.maHocVien),
    ).toEqual(['S1', 'S2']);
    expect(service.transcriptForStudent('S1')[0].totalScore).toBe(8.7);
  });
  it('giữ điểm 0, điểm thiếu không sinh tổng kết giả', () => {
    save(id, 0, 0);
    expect(service.transcriptForStudent('S1')[0].totalScore).toBe(0);
    save(id, 8, null);
    expect(service.transcriptForStudent('S1')[0].totalScore).toBeNull();
    expect(service.transcriptForStudent('S1')[0].processScore).toBe(8);
  });
  it('lưu điểm thành phần khi không có quy chế và giữ quy chế lịch sử', () => {
    const s = readStore();
    s.courses[0].processWeight = 0;
    s.courses[0].examWeight = 1;
    saveStore(s);
    save(id, null, 7);
    expect(service.transcriptForStudent('S1')[0].totalScore).toBe(7);
    const changed = readStore();
    changed.courses = [];
    saveStore(changed);
    changed.gradebooks[0].gradingPolicy = undefined;
    saveStore(changed);
    save(id);
    expect(service.transcriptForStudent('S1')[0].totalScore).toBeNull();
    expect(service.transcriptForStudent('S1')[0].processScore).not.toBeNull();
  });
  it('giữ tổng kết lịch sử khi điểm thành phần không đổi và không có quy chế', () => {
    save();
    const s = readStore();s.courses=[];s.gradebooks[0].gradingPolicy=undefined;saveStore(s);
    const before=service.getGradebook(req,id);const score=before.students[0];
    service.saveGradebook(req,id,{revision:before.revision,scores:[{maHocVien:score.maHocVien,processScore:score.processScore,examScore:score.examScore}]});
    expect(service.transcriptForStudent('S1')[0].totalScore).toBe(8.7);
    save(id,1,1);expect(service.transcriptForStudent('S1')[0].totalScore).toBeNull();
  });

});
