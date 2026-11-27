import { workflowView, applyWorkflow } from '../../../shared/thesis-workflow.cjs';
import { BadRequestException, Body, Controller, Get, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StudentRecordsService } from './student-records.service';
import { readStore, saveStore, studentCode } from '../common/data-store';
import { CONTACT_FIELDS, validateContact } from '../../../shared/student-profile.cjs';
import { TeacherGradesService } from '../teacher-auth/teacher-grades.service';
import { scheduleForStudent } from './student-schedule';

@Controller('api/student-records')
export class StudentRecordsController {
  constructor(
    private readonly auth: StudentRecordsService,
    private readonly grades: TeacherGradesService,
  ) {}

  @Post('login')
  login(@Body() body: { username?: string; password?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, session } = this.auth.login(body?.username, body?.password, req.ip || 'unknown');
    res.cookie(this.auth.cookieName(), session, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: this.auth.cookieMaxAgeMs(),
    });
    res.setHeader('Cache-Control', 'private, no-store');
    return { success: true, user };
  }

  @Get('me')
  me(@Req() req: Request) {
    return { success: true, user: this.auth.fromRequest(req, true) };
  }

  @Post('change-password')
  changePassword(
    @Body() body: { currentPassword?: string; newPassword?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = this.auth.changePassword(req, body?.currentPassword, body?.newPassword);
    res.cookie(this.auth.cookieName(), result.session, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
      path: '/', maxAge: this.auth.cookieMaxAgeMs(),
    });
    res.setHeader('Cache-Control', 'private, no-store');
    return { success: true, user: result.user };
  }

  @Get('profile')
  profile(@Req() req: Request) {
    const user = this.auth.fromRequest(req);
    const student = readStore().students.find(row => studentCode(row) === user.maHocVien.toUpperCase());
    return { success: true, data: student ? [student] : [] };
  }

  @Get('schedule')
  schedule(@Req() req: Request) {
    const user = this.auth.fromRequest(req);
    const store = readStore();
    const rows = scheduleForStudent({
      students: store.students, schedule: store.schedule, teachingAssignments: store.teachingAssignments,
    }, user.maHocVien);
    return { success: true, data: rows };
  }

  @Patch('profile')
  updateContact(@Req() req: Request, @Body() body: unknown) {
    const user = this.auth.fromRequest(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Thông tin không hợp lệ.');
    const input = body as Record<string, unknown>;
    if (!Object.keys(input).length || Object.keys(input).some(key => !CONTACT_FIELDS.includes(key) || typeof input[key] !== 'string')) throw new BadRequestException('Chỉ được cập nhật thông tin liên hệ cá nhân.');
    const store = readStore(), student = store.students.find(row => studentCode(row) === user.maHocVien);
    if (!student) throw new BadRequestException('Không tìm thấy hồ sơ học viên.');
    const updated = { ...student, ...Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value).trim()])) };
    const invalid = validateContact(updated, student);
    if (invalid) throw new BadRequestException(invalid);
    store.studentHistory.push({ action: 'update_contact', code: user.maHocVien, actor: user.maHocVien, at: new Date().toISOString(), before: student, after: updated });
    store.students[store.students.indexOf(student)] = updated;
    saveStore(store);
    return { success: true, data: updated };
  }

  @Get('thesis-workflow')
  thesisWorkflow(@Req() req: Request) { const user=this.auth.fromRequest(req); return {success:true,workflow:workflowView(readStore(),user.maHocVien)}; }
  @Post('thesis-workflow')
  thesisRequest(@Req() req: Request, @Body() body: unknown) { const user=this.auth.fromRequest(req); const store=readStore();try {const workflow=applyWorkflow(store,user.maHocVien,{manager:false,name:user.maHocVien},body);saveStore(store);return {success:true,workflow};}catch(e){throw new BadRequestException(e instanceof Error?e.message:'Không lưu được yêu cầu.');} }

  @Get('academic-progress')
  academicProgress(@Req() req: Request) { const user = this.auth.fromRequest(req); return {success:true,configured:false,message:'Quy chế GPA và chương trình đào tạo thuộc hệ thống riêng. Chưa tích hợp dữ liệu.'}; }

  @Get('grades')
  getMyGrades(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const student = this.auth.fromRequest(req);
    res.setHeader('Cache-Control', 'private, no-store');
    return { success: true, data: this.grades.transcriptForStudent(student.maHocVien) };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.auth.cookieName(), { path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return { success: true };
  }
}
